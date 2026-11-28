// Story #85, D1: the client's second permitted destination is the team's configured backend.
import { describe, expect, it } from "vitest";
import { apiAddress, createGitHubClient, type GitHubResult } from "./github.ts";
import type { RecordStore, SignInRecord, TeamSettings } from "./signin.ts";

const settings: TeamSettings = { clientId: "Iv1.x", backendUrl: "https://api.team.example/prod" };
const signed: SignInRecord = { accessToken: "at1", refreshToken: "rt1", login: "octo", expiresAt: 10_000 };

function memory(initial: SignInRecord | null): RecordStore & { current: SignInRecord | null } {
    const s = {
        current: initial,
        async get() {
            return s.current;
        },
        async set(r: SignInRecord | null) {
            s.current = r;
        },
    };
    return s;
}

function fake(handler: (url: string, init: RequestInit) => Response): { fetchFn: typeof fetch; calls: { url: string; init: RequestInit }[] } {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        return handler(url, init);
    }) as unknown as typeof fetch;
    return { fetchFn, calls };
}

const header = (init: RequestInit, name: string): string | undefined => (init.headers as Record<string, string>)[name];

describe("GitHub client: the backend route (D1, G1)", () => {
    it("sends a backend request to the configured backend, with the token and a JSON body", async () => {
        const { fetchFn, calls } = fake(() => Response.json({ sprints: [] }));
        const client = createGitHubClient({ settings, records: memory(signed), fetch: fetchFn, now: () => 0 });
        const res: GitHubResult = await client.request({ to: "backend", path: "/grooming/sync", method: "POST", body: { owner: "acme", name: "widgets" } });
        expect(res).toEqual({ ok: true, status: 200, body: { sprints: [] } });
        expect(calls).toHaveLength(1);
        expect(calls[0]!.url).toBe("https://api.team.example/prod/grooming/sync");
        expect(header(calls[0]!.init, "authorization")).toBe("Bearer at1");
        expect(header(calls[0]!.init, "content-type")).toBe("application/json");
        expect(calls[0]!.init.body).toBe(JSON.stringify({ owner: "acme", name: "widgets" }));
    });

    it("accepts only a path on the backend or on GitHub's API, never another address", () => {
        expect(apiAddress({ to: "backend", path: "/grooming/sync" }, settings)).toBe("https://api.team.example/prod/grooming/sync");
        expect(apiAddress({ to: "backend", path: "//evil.example/x" }, settings)).toBeNull();
        expect(apiAddress({ to: "backend", path: "/../x" }, settings)).toBeNull();
        expect(apiAddress({ to: "backend", path: "https://evil.example/x" }, settings)).toBeNull();
        expect(apiAddress({ to: "backend", path: "/grooming/sync" }, { clientId: "x", backendUrl: "" })).toBeNull();
        expect(apiAddress({ to: "elsewhere" as never, path: "/x" }, settings)).toBeNull();
        expect(apiAddress({ path: "/graphql" }, settings)).toBe("https://api.github.com/graphql");
    });

    it("renews once and retries once when the backend reports rejected credentials (G6)", async () => {
        let backendCalls = 0;
        const { fetchFn, calls } = fake((url) => {
            if (url.endsWith("/auth/refresh")) {
                return Response.json({ access_token: "at2", expires_in: 60, refresh_token: "rt2" });
            }
            backendCalls++;
            return backendCalls === 1 ? new Response(JSON.stringify({ error: "rejected-credentials" }), { status: 401 }) : Response.json({ ok: 1 });
        });
        const records = memory(signed);
        const client = createGitHubClient({ settings, records, fetch: fetchFn, now: () => 0 });
        const res = await client.request({ to: "backend", path: "/grooming/sync", method: "POST", body: {} });
        expect(res.ok).toBe(true);
        expect(calls.filter((c) => c.url.endsWith("/auth/refresh"))).toHaveLength(1);
        expect(header(calls[calls.length - 1]!.init, "authorization")).toBe("Bearer at2");
    });

    it("carries the backend's named cause on a failure", async () => {
        const { fetchFn } = fake(() => new Response(JSON.stringify({ error: "project-unreadable" }), { status: 403 }));
        const client = createGitHubClient({ settings, records: memory(signed), fetch: fetchFn, now: () => 0 });
        expect(await client.request({ to: "backend", path: "/grooming/sync", method: "POST", body: {} })).toEqual({
            ok: false,
            kind: "permission",
            reason: "project-unreadable",
        });
    });

    it("never passes on an unknown cause text from the backend", async () => {
        const { fetchFn } = fake(() => new Response(JSON.stringify({ error: "token ghu_123 bad" }), { status: 403 }));
        const client = createGitHubClient({ settings, records: memory(signed), fetch: fetchFn, now: () => 0 });
        expect(await client.request({ to: "backend", path: "/grooming/sync", method: "POST", body: {} })).toEqual({ ok: false, kind: "permission" });
    });
});
