import { useEffect, useRef, useState } from "preact/hooks";
import type { GitHubRequest, GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "./gateway.ts";
import type { PreferenceStore } from "./mount.tsx";
import type { Repo } from "./repo.tsx";

export const KEPT_LIST: string = "repositories";

// The kept list as stored: the login of the person who wrote it and their repositories (D6, G14).
function readKept(value: unknown, login: string): Repo[] | null {
    if (!isRecord(value) || value.login !== login || !Array.isArray(value.repos)) {
        return null;
    }
    const repos: Repo[] = [];
    for (const row of value.repos) {
        if (!isRecord(row) || typeof row.owner !== "string" || typeof row.name !== "string" || typeof row.url !== "string") {
            return null;
        }
        repos.push({ owner: row.owner, name: row.name, url: row.url });
    }
    return repos;
}

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

// The loaded list and whether a load of the fresh list is running (D6).
export interface RepoList {
    repos: Repo[];
    loading: boolean;
}

// Loads the reachable list while `login` is set. Only a complete load counts: `onComplete` runs
// with it. A failed or partial load changes nothing (G12).
export function useRepoList(
    gateway: GitHubGateway | undefined,
    login: string | null | undefined,
    onComplete?: (repos: Repo[]) => void,
    prefs?: PreferenceStore,
): RepoList {
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const latest = useRef(onComplete);
    latest.current = onComplete;
    useEffect(() => {
        if (!gateway || !login) {
            setRepos([]);
            setLoading(false);
            return;
        }
        let live = true;
        let fresh = false;
        // The kept list shows at once, unless another person wrote it or a fresh list came first.
        setRepos([]);
        setLoading(true);
        void prefs?.get(KEPT_LIST).then((value: unknown) => {
            const kept: Repo[] | null = readKept(value, login);
            if (live && !fresh && kept) {
                setRepos(kept);
            }
        });
        void loadReachable(gateway).then((result: Reachable) => {
            if (!live) {
                return;
            }
            setLoading(false);
            if (result.complete) {
                fresh = true;
                setRepos(result.repos);
                void prefs?.set(KEPT_LIST, { login, repos: result.repos.map((r) => ({ owner: r.owner, name: r.name, url: r.url })) });
                latest.current?.(result.repos);
            }
        });
        return () => {
            live = false;
        };
    }, [gateway, login, prefs]);
    return { repos, loading };
}
