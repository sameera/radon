import { useEffect, useState } from "preact/hooks";
import type { GitHubRequest, GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "./gateway.ts";
import type { Repo } from "./repo.tsx";

const PER_PAGE: number = 100;

// The reachable list (D4): every repository the signed-in person can reach through Raiden's GitHub
// App, across all of the App's installations they can see. It is complete only when every request
// succeeded and every page was read, up to the total GitHub reports (D7).
export interface Reachable {
    complete: boolean;
    repos: Repo[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

// Reads one list that GitHub serves 100 at a time, with a total_count and the rows under `key`.
// Returns null when any page fails, comes back in another shape, or ends before the total.
async function readAll(
    gateway: GitHubGateway,
    path: string,
    key: string,
): Promise<unknown[] | null> {
    const rows: unknown[] = [];
    for (let page = 1; ; page++) {
        const request: GitHubRequest = { path, query: { per_page: String(PER_PAGE), page: String(page) } };
        let result: GitHubResult;
        try {
            result = await gateway.request(request);
        } catch {
            return null;
        }
        if (!result.ok || !isRecord(result.body)) {
            return null;
        }
        const total: unknown = result.body.total_count;
        const batch: unknown = result.body[key];
        if (typeof total !== "number" || !Array.isArray(batch)) {
            return null;
        }
        rows.push(...batch);
        if (rows.length >= total) {
            return rows;
        }
        if (batch.length === 0) {
            return null;
        }
    }
}

function toRepo(row: unknown): Repo | null {
    if (!isRecord(row) || typeof row.name !== "string" || !isRecord(row.owner) || typeof row.owner.login !== "string") {
        return null;
    }
    const owner: string = row.owner.login;
    const url: string = typeof row.html_url === "string" ? row.html_url : `https://github.com/${owner}/${row.name}`;
    return { owner, name: row.name, url };
}

export async function loadReachable(gateway: GitHubGateway): Promise<Reachable> {
    const installs: unknown[] | null = await readAll(gateway, "/user/installations", "installations");
    if (!installs) {
        return { complete: false, repos: [] };
    }
    const byAddress: Map<string, Repo> = new Map();
    for (const install of installs) {
        const id: unknown = isRecord(install) ? install.id : undefined;
        if (typeof id !== "number") {
            return { complete: false, repos: [] };
        }
        const rows: unknown[] | null = await readAll(gateway, `/user/installations/${id}/repositories`, "repositories");
        if (!rows) {
            return { complete: false, repos: [] };
        }
        for (const row of rows) {
            const repo: Repo | null = toRepo(row);
            if (!repo) {
                return { complete: false, repos: [] };
            }
            byAddress.set(`${repo.owner}/${repo.name}`, repo);
        }
    }
    const repos: Repo[] = [...byAddress.values()].sort(
        (a, b) => a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name),
    );
    return { complete: true, repos };
}

// Loads the reachable list while `login` is set. A failed or partial load changes nothing (G12).
export function useRepoList(gateway: GitHubGateway | undefined, login: string | null | undefined): Repo[] {
    const [repos, setRepos] = useState<Repo[]>([]);
    useEffect(() => {
        if (!gateway || !login) {
            setRepos([]);
            return;
        }
        let live = true;
        void loadReachable(gateway).then((result: Reachable) => {
            if (live && result.complete) {
                setRepos(result.repos);
            }
        });
        return () => {
            live = false;
        };
    }, [gateway, login]);
    return repos;
}
