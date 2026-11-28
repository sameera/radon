// The one piece of code that sends GitHub API requests, in both hosts (D6, G17). It attaches the
// signed-in user's token, renews it, and sorts each failure into a kind. Callers never see a
// token. Results are plain data, so the extension can pass them between contexts.
import { refreshTokens, SignInError, type RecordStore, type SignInRecord, type TeamSettings } from "./signin.ts";

export interface GitHubRequest {
    // Where the request goes: GitHub's API (the default), or the team's configured backend (D1).
    to?: "github" | "backend";
    // An absolute path on the destination, for example "/repos/acme/widgets/issues".
    path: string;
    method?: "GET" | "POST";
    query?: Record<string, string>;
    body?: unknown;
}

// "sign-in-needed" covers a missing, rejected or unrenewable sign-in. The rest stay apart from it (G19).
export type GitHubFailureKind = "sign-in-needed" | "network" | "rate-limit" | "permission" | "other";

// The named causes Raiden's backend may give for a failure. Any other text is dropped, so nothing
// the backend says can carry a token or request detail to a page. "unknown-sprint" is a move to a
// sprint the backend no longer holds (story #114).
export const BACKEND_REASONS = ["project-unreadable", "unknown-sprint"] as const;
export type BackendReason = (typeof BACKEND_REASONS)[number];

export type GitHubResult =
    | { ok: true; status: number; body: unknown }
    | { ok: false; kind: GitHubFailureKind; reason?: BackendReason };

export interface GitHubClient {
    status(): Promise<string | null>;
    request(request: GitHubRequest): Promise<GitHubResult>;
}

export interface GitHubClientDeps {
    settings: TeamSettings;
    records: RecordStore;
    fetch: typeof fetch;
    now?: () => number;
    withRefreshLock?: (run: () => Promise<SignInRecord | null>) => Promise<SignInRecord | null>;
}

const REFRESH_LEAD_MS = 5 * 60_000;
const API_ORIGIN: string = "https://api.github.com";
const API_VERSION: string = "2022-11-28";
const SAFE_PATH: RegExp = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/;
const SIGN_IN_NEEDED: GitHubResult = { ok: false, kind: "sign-in-needed" };

// Only an absolute path on GitHub's API, or on the team's configured backend, is accepted, so the
// token cannot be sent elsewhere (G21, D1).
export function apiAddress(request: GitHubRequest, settings?: TeamSettings): string | null {
    if (typeof request?.path !== "string" || !SAFE_PATH.test(request.path) || request.path.startsWith("//")) {
        return null;
    }
    if (request.path.split("/").includes("..")) {
        return null;
    }
    let url: URL;
    if (request.to === "backend") {
        let base: URL;
        try {
            base = new URL(settings?.backendUrl ?? "");
        } catch {
            return null;
        }
        if (base.protocol !== "https:" && base.protocol !== "http:") {
            return null;
        }
        url = new URL(base.pathname.replace(/\/+$/, "") + request.path, base.origin);
        if (url.origin !== base.origin) {
            return null;
        }
    } else if (request.to === undefined || request.to === "github") {
        url = new URL(request.path, API_ORIGIN);
        if (url.origin !== API_ORIGIN) {
            return null;
        }
    } else {
        return null;
    }
    for (const [name, value] of Object.entries(request.query ?? {})) {
        url.searchParams.set(name, value);
    }
    return url.toString();
}

async function readBody(res: Response): Promise<unknown> {
    const text: string = await res.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function failureKind(res: Response): GitHubFailureKind {
    if (res.status === 429 || (res.status === 403 && (res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after")))) {
        return "rate-limit";
    }
    // GitHub answers 404 for a repository the App is not installed on (R4), so it reads as permission.
    if (res.status === 403 || res.status === 404) {
        return "permission";
    }
    return "other";
}

export function createGitHubClient(deps: GitHubClientDeps): GitHubClient {
    const now: () => number = deps.now ?? Date.now;
    let renewing: Promise<SignInRecord | null> | null = null;

    // Renews the sign-in that `used` stands for. Returns null when the user must sign in again.
    async function renewOnce(used: SignInRecord): Promise<SignInRecord | null> {
        const current: SignInRecord | null = await deps.records.get();
        if (!current) {
            return null;
        }
        // Another request or tab already renewed it. Refresh tokens work once, so use that one.
        if (current.accessToken !== used.accessToken) {
            return current;
        }
        if (!current.refreshToken) {
            await deps.records.set(null);
            return null;
        }
        let next: SignInRecord;
        try {
            next = await refreshTokens(deps.settings, deps.fetch, current, now);
        } catch (error) {
            // Read the storage again before giving up, in case another tab just renewed.
            const again: SignInRecord | null = await deps.records.get();
            if (again?.accessToken !== used.accessToken) {
                return again;
            }
            if (!(error instanceof SignInError) || error.status !== 400) {
                throw error;
            }
            await deps.records.set(null);
            return null;
        }
        const latest = await deps.records.get();
        if (latest?.accessToken !== used.accessToken) {
            return latest;
        }
        await deps.records.set(next);
        return next;
    }

    // Requests that fail together share one renewal (G20).
    function renew(used: SignInRecord): Promise<SignInRecord | null> {
        const run = () => renewOnce(used);
        renewing ??= (deps.withRefreshLock ? deps.withRefreshLock(run) : run()).finally(() => {
            renewing = null;
        });
        return renewing;
    }

    function send(url: string, request: GitHubRequest, record: SignInRecord): Promise<Response> {
        // The backend gets the token header and a JSON body only, the headers its preflight allows.
        const headers: Record<string, string> =
            request.to === "backend"
                ? { authorization: `Bearer ${record.accessToken}` }
                : {
                      authorization: `Bearer ${record.accessToken}`,
                      accept: "application/vnd.github+json",
                      "x-github-api-version": API_VERSION,
                  };
        const init: RequestInit = { method: request.method ?? "GET", headers };
        if (request.body !== undefined && init.method === "POST") {
            headers["content-type"] = "application/json";
            init.body = JSON.stringify(request.body);
        }
        return deps.fetch(url, init);
    }

    return {
        async status() {
            const record = await deps.records.get();
            if (!record || record.expiresAt === undefined) {
                return record?.login ?? null;
            }
            const remaining = record.expiresAt - now();
            if (remaining > 0 && (!record.refreshToken || remaining > REFRESH_LEAD_MS)) {
                return record.login;
            }
            try {
                return (await renew(record))?.login ?? null;
            } catch (error) {
                if (record.expiresAt > now()) {
                    return record.login;
                }
                throw error;
            }
        },
        async request(request: GitHubRequest): Promise<GitHubResult> {
            const url: string | null = apiAddress(request, deps.settings);
            if (!url || (request.method !== undefined && request.method !== "GET" && request.method !== "POST")) {
                return { ok: false, kind: "other" };
            }
            let record: SignInRecord | null = await deps.records.get();
            if (!record) {
                return SIGN_IN_NEEDED;
            }
            let res: Response;
            try {
                if (record.expiresAt !== undefined && record.expiresAt <= now()) {
                    record = await renew(record);
                    if (!record) {
                        return SIGN_IN_NEEDED;
                    }
                }
                res = await send(url, request, record);
                if (res.status === 401) {
                    const next: SignInRecord | null = await renew(record);
                    if (!next) {
                        return SIGN_IN_NEEDED;
                    }
                    res = await send(url, request, next);
                    if (res.status === 401) {
                        if ((await deps.records.get())?.accessToken === next.accessToken) {
                            await deps.records.set(null);
                        }
                        return SIGN_IN_NEEDED;
                    }
                }
            } catch {
                return { ok: false, kind: "network" };
            }
            if (!res.ok) {
                const kind: GitHubFailureKind = failureKind(res);
                if (request.to === "backend") {
                    const body: unknown = await readBody(res).catch(() => null);
                    const reason: unknown = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
                    if (BACKEND_REASONS.includes(reason as BackendReason)) {
                        return { ok: false, kind, reason: reason as BackendReason };
                    }
                }
                return { ok: false, kind };
            }
            return { ok: true, status: res.status, body: await readBody(res) };
        },
    };
}
