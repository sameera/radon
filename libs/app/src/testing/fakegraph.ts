// A fake GitHub GraphQL endpoint for backlog tests. It answers the backlog's search and its
// batched ancestor reads from a list of issues, the way GitHub shapes them: each issue comes with
// its ancestor chain to three levels, and the next ancestor as an identity only.
import type { GitHubRequest, GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "../gateway.ts";

export interface FakeIssue {
    n: number;
    title?: string;
    // The parent: a number in the same repository, or "owner/name#n" for another repository.
    parent?: number | string;
    state?: "OPEN" | "CLOSED";
    // "owner/name". Defaults to the fake's current repository.
    repo?: string;
    // Whether the search returns it. Defaults to true for an open issue in the current repository.
    inQuery?: boolean;
    // The parent cannot be read: GitHub answers no parent and no error at this issue (R2).
    hiddenParent?: boolean;
}

export interface FakeOptions {
    repo?: string;
    issues: FakeIssue[];
    // The total GitHub reports. Defaults to the number of query issues.
    total?: number;
    // Answers the request at this index instead of the fake, when it returns a result.
    override?: (index: number, request: GitHubRequest) => GitHubResult | undefined | Promise<GitHubResult | undefined>;
    // The repository is unreadable: GitHub answers NOT_FOUND on the repository field.
    cannotRead?: boolean;
    // What Raiden's backend answers to the Grooming sync. Defaults to an empty partition.
    sync?: FakeSync | ((request: GitHubRequest) => GitHubResult | Promise<GitHubResult>);
}

export interface FakeSync {
    source?: { project: string; field: string } | null;
    sprints?: Record<string, unknown>[];
    milestones?: Record<string, unknown>[];
}

export interface FakeGitHub extends GitHubGateway {
    // Requests to GitHub's API.
    requests: GitHubRequest[];
    // Requests to Raiden's backend, kept apart so GitHub request indexes stay as they were.
    backend: GitHubRequest[];
}

const INLINE: number = 3;

export function idOf(repo: string, n: number): string {
    return `I_${repo}#${n}`;
}

export function fakeGitHub(o: FakeOptions): FakeGitHub {
    const current: string = o.repo ?? "acme/widgets";
    const byId: Map<string, FakeIssue & { repo: string }> = new Map();
    for (const issue of o.issues) {
        const full = { ...issue, repo: issue.repo ?? current };
        byId.set(idOf(full.repo, full.n), full);
    }
    const parentId = (issue: FakeIssue & { repo: string }): string | null => {
        if (issue.parent === undefined) {
            return null;
        }
        if (typeof issue.parent === "number") {
            return idOf(issue.repo, issue.parent);
        }
        const [repo, n] = issue.parent.split("#");
        return idOf(repo!, Number(n));
    };
    const errors: unknown[] = [];
    const node = (issue: FakeIssue & { repo: string }, level: number, path: (string | number)[]): Record<string, unknown> => {
        const out: Record<string, unknown> = {
            id: idOf(issue.repo, issue.n),
            number: issue.n,
            title: issue.title ?? `Issue ${issue.n}`,
            state: issue.state ?? "OPEN",
            url: `https://github.com/${issue.repo}/issues/${issue.n}`,
            repository: { nameWithOwner: issue.repo },
        };
        const pid: string | null = parentId(issue);
        if (issue.hiddenParent) {
            // What GitHub really answers for a parent the viewer cannot read: no parent and no
            // error (seen on 2026-11-26 for elastic/kibana#307949, whose parent search reports).
            out.parent = null;
        } else if (!pid || !byId.has(pid)) {
            out.parent = null;
        } else if (level < INLINE) {
            out.parent = node(byId.get(pid)!, level + 1, [...path, "parent"]);
        } else {
            out.parent = { id: pid };
        }
        return out;
    };
    const queryIssues = (): (FakeIssue & { repo: string })[] =>
        [...byId.values()].filter((i) => i.inQuery ?? (i.repo === current && (i.state ?? "OPEN") === "OPEN"));

    const gateway: FakeGitHub = {
        requests: [],
        backend: [],
        async request(request: GitHubRequest): Promise<GitHubResult> {
            if (request.to === "backend") {
                gateway.backend.push(request);
                if (typeof o.sync === "function") {
                    return o.sync(request);
                }
                const sync: FakeSync = o.sync ?? {};
                return {
                    ok: true,
                    status: 200,
                    body: { repository: 1, source: sync.source ?? null, sprints: sync.sprints ?? [], milestones: sync.milestones ?? [] },
                };
            }
            const index: number = gateway.requests.length;
            gateway.requests.push(request);
            const forced = await o.override?.(index, request);
            if (forced) {
                return forced;
            }
            errors.length = 0;
            const body = request.body as { query: string; variables: Record<string, unknown> };
            const vars = body.variables;
            if (Array.isArray(vars.ids)) {
                const nodes = (vars.ids as string[]).map((id, i) => (byId.has(id) ? node(byId.get(id)!, 0, ["nodes", i]) : null));
                return { ok: true, status: 200, body: { data: { nodes }, ...(errors.length ? { errors: [...errors] } : {}) } };
            }
            const all = queryIssues();
            const start: number = vars.cursor ? Number(vars.cursor) : 0;
            const capped = all.slice(0, 1000);
            const page = capped.slice(start, start + 100);
            const end: number = start + page.length;
            const search = {
                issueCount: o.total ?? all.length,
                pageInfo: { hasNextPage: end < capped.length, endCursor: String(end) },
                nodes: page.map((issue, i) => node(issue, 0, ["search", "nodes", i])),
            };
            if (o.cannotRead) {
                return {
                    ok: true,
                    status: 200,
                    body: {
                        data: { repository: null, search: { issueCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } },
                        errors: [{ type: "NOT_FOUND", path: ["repository"], message: "Could not resolve to a Repository" }],
                    },
                };
            }
            return {
                ok: true,
                status: 200,
                body: { data: { repository: { id: "R_1" }, search }, ...(errors.length ? { errors: [...errors] } : {}) },
            };
        },
    };
    return gateway;
}
