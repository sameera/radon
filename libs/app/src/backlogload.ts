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
    issueType?: string | null;
    labels?: string[];
    // GitHub's state, for example "OPEN" or "CLOSED".
    state: string;
    // "owner/name" of the issue's own repository.
    repo: string;
    // The parent's identity, or null at the top of a chain.
    parentId: string | null;
    // Whether the query returned it.
    inQuery: boolean;
    // A parent GitHub would not show to the lead (R2). It has no number, title or link.
    hidden?: boolean;
}

export type BacklogLoad =
    | { ok: true; issues: LiveIssue[]; hidden: number }
    | { ok: false; cause: BacklogCause };

// The fields read for each issue, and its ancestor chain to the inline depth: three full levels,
// then the next parent's identity only.
const FIELDS: string = "id number title state issueType { name } labels(first: 50) { nodes { name } } repository { nameWithOwner }";
export const INLINE_DEPTH: number = 3;
function chain(levels: number): string {
    return levels === 0 ? "parent { id }" : `parent { ${FIELDS} ${chain(levels - 1)} }`;
}
export const ISSUE_SELECTION: string = `${FIELDS} ${chain(INLINE_DEPTH)}`;

// Ancestors past the inline depth, read together by identity (D2).
const ANCESTORS: string = `query Ancestors($ids: [ID!]!) {
  nodes(ids: $ids) { ... on Issue { ${ISSUE_SELECTION} } }
}`;
const MAX_ROUNDS: number = 100;
// A parent the lead cannot read comes back from GitHub as no parent, with no error (R2, seen on
// real GitHub on 2026-11-26). So the chain simply ends at the last issue the lead can read, and
// any error, at a parent or anywhere else, is a failed request (G13).

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

// Reads one issue node and the ancestors inside it into `into`. An ancestor that came as an
// identity only goes into `unknown`, so a later round can read it.
export function readIssue(node: unknown, inQuery: boolean, into: Map<string, LiveIssue>, unknown: Set<string>): void {
    if (!isRecord(node) || typeof node.id !== "string" || typeof node.number !== "number" || typeof node.title !== "string") {
        throw new LoadFailed("other");
    }
    if (typeof node.state !== "string" || !isRecord(node.repository) || typeof node.repository.nameWithOwner !== "string") {
        throw new LoadFailed("other");
    }
    if (node.issueType !== null && node.issueType !== undefined && (!isRecord(node.issueType) || typeof node.issueType.name !== "string")) {
        throw new LoadFailed("other");
    }
    if (node.labels !== undefined && (!isRecord(node.labels) || !Array.isArray(node.labels.nodes) ||
        node.labels.nodes.some((label: unknown) => !isRecord(label) || typeof label.name !== "string"))) {
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
        issueType: isRecord(node.issueType) ? node.issueType.name as string : null,
        labels: isRecord(node.labels) ? (node.labels.nodes as { name: string }[]).map((label) => label.name) : [],
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
            search.nodes.forEach((node: unknown) => {
                readIssue(node, true, issues, unknown);
                read++;
            });
            const next: unknown = search.pageInfo.endCursor;
            if (search.pageInfo.hasNextPage !== true || read >= Math.min(total, SEARCH_CAP)) {
                break;
            }
            if (typeof next !== "string" || search.nodes.length === 0) {
                return { ok: false, cause: "other" };
            }
            cursor = next;
        }
        await readAncestors(gateway, issues, unknown);
        const shown: number = [...issues.values()].filter((i) => i.inQuery).length;
        return { ok: true, issues: [...issues.values()], hidden: total > SEARCH_CAP ? Math.max(0, total - shown) : 0 };
    } catch (error) {
        return { ok: false, cause: error instanceof LoadFailed ? error.cause : "other" };
    }
}

// Reads every ancestor still unknown, all together, one level at a time, until every chain ends.
// The visited set ends the rounds when GitHub reports a loop of parents (D2, G14).
async function readAncestors(gateway: GitHubGateway, issues: Map<string, LiveIssue>, unknown: Set<string>): Promise<void> {
    const visited: Set<string> = new Set();
    for (let round = 0; unknown.size > 0; round++) {
        if (round >= MAX_ROUNDS) {
            throw new LoadFailed("other");
        }
        const ids: string[] = [...unknown].filter((id) => !visited.has(id) && !issues.has(id));
        unknown.clear();
        ids.forEach((id) => visited.add(id));
        for (let at = 0; at < ids.length; at += PAGE) {
            const batch: string[] = ids.slice(at, at + PAGE);
            const { data } = await graphql(gateway, ANCESTORS, { ids: batch });
            if (!Array.isArray(data.nodes) || data.nodes.length !== batch.length) {
                throw new LoadFailed("other");
            }
            data.nodes.forEach((node: unknown) => readIssue(node, false, issues, unknown));
        }
        for (const id of [...unknown]) {
            if (visited.has(id) || issues.has(id)) {
                unknown.delete(id);
            }
        }
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

// Builds the tree from the query issues and every issue in their ancestor chains, joined on
// identity. Nothing else enters it, so each issue appears once and an issue with no returned
// descendant never appears (D3, G4, G7). A parent GitHub would not show becomes one "parent not
// visible" row. A loop of parents is cut at its lowest-numbered issue, which goes to the top.
export function buildTree(issues: LiveIssue[]): TreeNode[] {
    const byId: Map<string, LiveIssue> = new Map(issues.map((i) => [i.id, i]));
    const parentOf = (issue: LiveIssue): LiveIssue | null => {
        if (!issue.parentId) {
            return null;
        }
        let parent: LiveIssue | undefined = byId.get(issue.parentId);
        if (!parent) {
            parent = { id: issue.parentId, number: 0, title: "", issueType: null, labels: [], state: "", repo: "", parentId: null, inQuery: false, hidden: true };
            byId.set(parent.id, parent);
        }
        return parent;
    };
    const members: Map<string, LiveIssue> = new Map();
    const up: Map<string, string | null> = new Map();
    for (const issue of issues) {
        let at: LiveIssue | null = issue.inQuery ? issue : null;
        while (at && !members.has(at.id)) {
            members.set(at.id, at);
            const parent: LiveIssue | null = parentOf(at);
            up.set(at.id, parent?.id ?? null);
            at = parent;
        }
    }
    // Each issue has at most one parent, so every loop is a cycle of parent links.
    const done: Set<string> = new Set();
    for (const id of members.keys()) {
        const walk: string[] = [];
        const onWalk: Set<string> = new Set();
        let at: string | null = id;
        while (at !== null && !done.has(at) && !onWalk.has(at)) {
            walk.push(at);
            onWalk.add(at);
            at = up.get(at) ?? null;
        }
        if (at !== null && onWalk.has(at)) {
            const loop: LiveIssue[] = walk.slice(walk.indexOf(at)).map((x) => members.get(x)!);
            loop.sort((a, b) => a.number - b.number || a.repo.localeCompare(b.repo));
            up.set(loop[0]!.id, null);
        }
        walk.forEach((x) => done.add(x));
    }
    const nodes: Map<string, TreeNode> = new Map([...members.values()].map((i) => [i.id, { issue: i, children: [] }]));
    const top: TreeNode[] = [];
    for (const node of nodes.values()) {
        const parentId: string | null = up.get(node.issue.id) ?? null;
        const parent: TreeNode | undefined = parentId ? nodes.get(parentId) : undefined;
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
    if (issue.hidden) {
        return false;
    }
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
