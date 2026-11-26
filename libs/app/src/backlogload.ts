// Reads the live backlog from GitHub (D1, D4). One backlog load reads every page of the fixed
// query for one repository. It counts only when every request succeeded.
import type { GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "./gateway.ts";
import type { Repo } from "./repo.tsx";

// The fixed backlog query. A later Settings page replaces this text only. Raiden adds the
// repository part itself (G3).
export const BACKLOG_QUERY: string = "is:issue state:open";
// GitHub search returns at most this many results for one query (D7).
export const SEARCH_CAP: number = 1000;
const PAGE: number = 100;
const NAME_PART: RegExp = /^[A-Za-z0-9_.-]+$/;

export type BacklogCause = "signed-out" | "cannot-read" | "rate-limit" | "other";

// One issue of the backlog: a query issue, or an issue above one. The tree joins on `id`, GitHub's
// own identifier, never on the bare number (D3).
export interface LiveIssue {
    id: string;
    number: number;
    title: string;
    // GitHub's state, for example "OPEN" or "CLOSED".
    state: string;
    // "owner/name" of the issue's own repository.
    repo: string;
    // The parent's identity, or null at the top of a chain.
    parentId: string | null;
    // Whether the query returned it.
    inQuery: boolean;
}

export type BacklogLoad =
    | { ok: true; issues: LiveIssue[]; hidden: number }
    | { ok: false; cause: BacklogCause };

// The fields read for each issue, and its ancestor chain to the inline depth: three full levels,
// then the next parent's identity only.
const FIELDS: string = "id number title state repository { nameWithOwner }";
export const INLINE_DEPTH: number = 3;
function chain(levels: number): string {
    return levels === 0 ? "parent { id }" : `parent { ${FIELDS} ${chain(levels - 1)} }`;
}
export const ISSUE_SELECTION: string = `${FIELDS} ${chain(INLINE_DEPTH)}`;

const SEARCH: string = `query Backlog($owner: String!, $name: String!, $q: String!, $cursor: String) {
  repository(owner: $owner, name: $name) { id }
  search(type: ISSUE, query: $q, first: ${PAGE}, after: $cursor) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { ... on Issue { ${ISSUE_SELECTION} } }
  }
}`;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export class LoadFailed extends Error {
    constructor(readonly cause: BacklogCause) {
        super(cause);
    }
}

function causeOf(result: GitHubResult & { ok: false }): BacklogCause {
    switch (result.kind) {
        case "sign-in-needed":
            return "signed-out";
        case "permission":
            return "cannot-read";
        case "rate-limit":
            return "rate-limit";
        default:
            return "other";
    }
}

// Sends one GraphQL read and returns its data. An answer that reports errors, or that has no
// data, is a failed request (G13). `allowed` may accept some errors as part of the answer.
export async function graphql(
    gateway: GitHubGateway,
    query: string,
    variables: Record<string, unknown>,
    allowed: (error: Record<string, unknown>) => boolean = () => false,
): Promise<{ data: Record<string, unknown>; errors: Record<string, unknown>[] }> {
    let result: GitHubResult;
    try {
        result = await gateway.request({ path: "/graphql", method: "POST", body: { query, variables } });
    } catch {
        throw new LoadFailed("other");
    }
    if (!result.ok) {
        throw new LoadFailed(causeOf(result));
    }
    const body: unknown = result.body;
    if (!isRecord(body)) {
        throw new LoadFailed("other");
    }
    const errors: Record<string, unknown>[] = Array.isArray(body.errors) ? body.errors.map((e) => (isRecord(e) ? e : {})) : [];
    const blocking: Record<string, unknown>[] = errors.filter((e) => !allowed(e));
    if (blocking.length > 0) {
        if (blocking.some((e) => e.type === "RATE_LIMITED")) {
            throw new LoadFailed("rate-limit");
        }
        if (blocking.some((e) => e.type === "NOT_FOUND" && Array.isArray(e.path) && e.path[0] === "repository")) {
            throw new LoadFailed("cannot-read");
        }
        throw new LoadFailed("other");
    }
    if (body.errors !== undefined && !Array.isArray(body.errors)) {
        throw new LoadFailed("other");
    }
    if (!isRecord(body.data)) {
        throw new LoadFailed("other");
    }
    return { data: body.data, errors };
}

// Reads one issue node and the ancestors inside it into `into`. Returns the identity of the next
// ancestor that came as an identity only, if any, so a later round can read it.
export function readIssue(node: unknown, inQuery: boolean, into: Map<string, LiveIssue>, unknown: Set<string>): void {
    if (!isRecord(node) || typeof node.id !== "string" || typeof node.number !== "number" || typeof node.title !== "string") {
        throw new LoadFailed("other");
    }
    if (typeof node.state !== "string" || !isRecord(node.repository) || typeof node.repository.nameWithOwner !== "string") {
        throw new LoadFailed("other");
    }
    const parent: unknown = node.parent;
    let parentId: string | null = null;
    if (isRecord(parent)) {
        if (typeof parent.id !== "string") {
            throw new LoadFailed("other");
        }
        parentId = parent.id;
        if (typeof parent.number === "number") {
            readIssue(parent, false, into, unknown);
        } else if (!into.has(parentId)) {
            unknown.add(parentId);
        }
    } else if (parent !== null && parent !== undefined) {
        throw new LoadFailed("other");
    }
    const known: LiveIssue | undefined = into.get(node.id);
    into.set(node.id, {
        id: node.id,
        number: node.number,
        title: node.title,
        state: node.state,
        repo: node.repository.nameWithOwner,
        parentId,
        inQuery: inQuery || (known?.inQuery ?? false),
    });
    unknown.delete(node.id);
}

// One backlog load: every page of the query, as the signed-in lead (D1, D4, D7).
export async function loadBacklog(gateway: GitHubGateway, repo: Repo): Promise<BacklogLoad> {
    if (!NAME_PART.test(repo.owner) || !NAME_PART.test(repo.name)) {
        return { ok: false, cause: "other" };
    }
    const issues: Map<string, LiveIssue> = new Map();
    const unknown: Set<string> = new Set();
    const q: string = `repo:${repo.owner}/${repo.name} ${BACKLOG_QUERY}`;
    try {
        let cursor: string | null = null;
        let read: number = 0;
        let total: number = 0;
        for (let page = 0; page < SEARCH_CAP / PAGE; page++) {
            const { data } = await graphql(gateway, SEARCH, { owner: repo.owner, name: repo.name, q, cursor });
            if (data.repository === null) {
                return { ok: false, cause: "cannot-read" };
            }
            if (!isRecord(data.repository)) {
                return { ok: false, cause: "other" };
            }
            const search: unknown = data.search;
            if (!isRecord(search) || typeof search.issueCount !== "number" || !Array.isArray(search.nodes) || !isRecord(search.pageInfo)) {
                return { ok: false, cause: "other" };
            }
            total = search.issueCount;
            for (const node of search.nodes) {
                readIssue(node, true, issues, unknown);
                read++;
            }
            const next: unknown = search.pageInfo.endCursor;
            if (search.pageInfo.hasNextPage !== true || read >= Math.min(total, SEARCH_CAP)) {
                break;
            }
            if (typeof next !== "string" || search.nodes.length === 0) {
                return { ok: false, cause: "other" };
            }
            cursor = next;
        }
        const shown: number = [...issues.values()].filter((i) => i.inQuery).length;
        return { ok: true, issues: [...issues.values()], hidden: total > SEARCH_CAP ? Math.max(0, total - shown) : 0 };
    } catch (error) {
        return { ok: false, cause: error instanceof LoadFailed ? error.cause : "other" };
    }
}

// One row of the tree.
export interface TreeNode {
    issue: LiveIssue;
    children: TreeNode[];
}

function byNumber(a: TreeNode, b: TreeNode): number {
    return a.issue.number - b.issue.number || a.issue.repo.localeCompare(b.issue.repo);
}

// Builds the tree from the query issues, joined on identity. Each issue appears once. An issue
// sits under its parent when that parent is in the tree, or at the top level (D3, G9).
export function buildTree(issues: LiveIssue[]): TreeNode[] {
    const members: LiveIssue[] = issues.filter((i) => i.inQuery);
    const nodes: Map<string, TreeNode> = new Map(members.map((i) => [i.id, { issue: i, children: [] }]));
    const top: TreeNode[] = [];
    for (const node of nodes.values()) {
        const parent: TreeNode | undefined = node.issue.parentId ? nodes.get(node.issue.parentId) : undefined;
        (parent ? parent.children : top).push(node);
    }
    const sort = (list: TreeNode[]): TreeNode[] => {
        list.sort(byNumber);
        list.forEach((n) => sort(n.children));
        return list;
    };
    return sort(top);
}

function matches(issue: LiveIssue, text: string): boolean {
    const num: string = text.startsWith("#") ? text.slice(1) : text;
    return (/^\d+$/.test(num) && Number(num) === issue.number) || issue.title.toLowerCase().includes(text);
}

// The tree as the filter shows it: a matching row with all its descendants, under its full chain.
export function filterTree(tree: TreeNode[], filter: string): TreeNode[] {
    const text: string = filter.trim().toLowerCase();
    if (text === "") {
        return tree;
    }
    const out: TreeNode[] = [];
    for (const node of tree) {
        if (matches(node.issue, text)) {
            out.push(node);
            continue;
        }
        const children: TreeNode[] = filterTree(node.children, text);
        if (children.length > 0) {
            out.push({ issue: node.issue, children });
        }
    }
    return out;
}
