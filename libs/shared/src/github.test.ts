import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitHubClient, type GitHubResult } from "./github.ts";
import { refreshTokens, type RecordStore, type SignInRecord, type TeamSettings } from "./signin.ts";

const settings: TeamSettings = { clientId: "Iv1.x", backendUrl: "https://api.team.example" };

function memoryStore(initial: SignInRecord | null): RecordStore & { current: SignInRecord | null; writes: (SignInRecord | null)[] } {
    const store = {
        current: initial,
        writes: [] as (SignInRecord | null)[],
        async get() {
            return store.current;
        },
        async set(r: SignInRecord | null) {
            store.writes.push(r);
            store.current = r;
        },
    };
    return store;
}

interface Call {
    url: string;
    init: RequestInit;
}
type Handler = (call: Call) => Response | Promise<Response>;

function fakeFetch(handler: Handler): { fetchFn: typeof fetch; calls: Call[] } {
    const calls: Call[] = [];
    const fetchFn = (async (url: string, init: RequestInit = {}) => {
        const call: Call = { url, init };
        calls.push(call);
        return handler(call);
    }) as unknown as typeof fetch;
    return { fetchFn, calls };
}

const headerOf = (c: Call, name: string): string | undefined => (c.init.headers as Record<string, string>)[name];
const isApi = (c: Call): boolean => c.url.startsWith("https://api.github.com/");
const isBackend = (c: Call): boolean => c.url.startsWith("https://api.team.example/");
const signed: SignInRecord = { accessToken: "at1", refreshToken: "rt1", login: "octo", expiresAt: 10_000 };
const ok = (body: unknown = { n: 1 }): Response => Response.json(body);
const refreshed = (): Response => Response.json({ access_token: "at2", expires_in: 60, refresh_token: "rt2" });

afterEach(() => vi.restoreAllMocks());

describe("GitHub client: signing", () => {
    it("sends the request to GitHub's API with the signed-in user's token (G17)", async () => {
        const { fetchFn, calls } = fakeFetch(() => ok());
        const client = createGitHubClient({ settings, records: memoryStore(signed), fetch: fetchFn, now: () => 0 });
        const res: GitHubResult = await client.request({ path: "/repos/acme/widgets/issues", query: { state: "open" } });
        expect(res).toEqual({ ok: true, status: 200, body: { n: 1 } });
        expect(calls[0]!.url).toBe("https://api.github.com/repos/acme/widgets/issues?state=open");
        expect(headerOf(calls[0]!, "authorization")).toBe("Bearer at1");
        expect(headerOf(calls[0]!, "accept")).toBe("application/vnd.github+json");
        expect(headerOf(calls[0]!, "x-github-api-version")).toBe("2022-11-28");
    });

    it("sends no request at all with no sign-in, and reports sign-in needed (G17)", async () => {
        const { fetchFn, calls } = fakeFetch(() => ok());
        const client = createGitHubClient({ settings, records: memoryStore(null), fetch: fetchFn });
        expect(await client.request({ path: "/user" })).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(calls).toHaveLength(0);
    });

    it("makes the same request to GitHub for the same page request in either host (G18)", async () => {
        const a = fakeFetch(() => ok());
        const b = fakeFetch(() => ok());
        const req = { path: "/graphql", method: "POST" as const, body: { query: "{ viewer { login } }" } };
        await createGitHubClient({ settings, records: memoryStore({ ...signed }), fetch: a.fetchFn, now: () => 0 }).request(req);
        await createGitHubClient({ settings, records: memoryStore({ ...signed }), fetch: b.fetchFn, now: () => 0 }).request(req);
        expect(a.calls).toEqual(b.calls);
        expect(headerOf(a.calls[0]!, "content-type")).toBe("application/json");
        expect(a.calls[0]!.init.body).toBe(JSON.stringify(req.body));
    });

    it("does not cache: a repeat request is sent again (G18)", async () => {
        const { fetchFn, calls } = fakeFetch(() => ok());
        const client = createGitHubClient({ settings, records: memoryStore(signed), fetch: fetchFn, now: () => 0 });
        await client.request({ path: "/user" });
        await client.request({ path: "/user" });
        expect(calls).toHaveLength(2);
    });

    it("refuses an address that is not GitHub's API, before any request (G21)", async () => {
        const { fetchFn, calls } = fakeFetch(() => ok());
        const client = createGitHubClient({ settings, records: memoryStore(signed), fetch: fetchFn, now: () => 0 });
        for (const path of ["//evil.example/x", "https://evil.example/x", "user", "/\\evil.example", "/a/../../b@evil.example"]) {
            const res = await client.request({ path });
            expect(res.ok, path).toBe(false);
        }
        expect(calls).toHaveLength(0);
    });
});

describe("GitHub client: failure kinds (G19)", () => {
    const kind = async (res: Response | Error): Promise<string> => {
        const { fetchFn } = fakeFetch(() => {
            if (res instanceof Error) throw res;
            return res;
        });
        const client = createGitHubClient({ settings, records: memoryStore({ accessToken: "at1", login: "octo" }), fetch: fetchFn });
        const out = await client.request({ path: "/user" });
        return out.ok ? "ok" : out.kind;
    };
    it("tells network, rate-limit, permission and other failures apart", async () => {
        expect(await kind(new TypeError("offline"))).toBe("network");
        expect(await kind(new Response("{}", { status: 429 }))).toBe("rate-limit");
        expect(await kind(new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } }))).toBe("rate-limit");
        expect(await kind(new Response("{}", { status: 403 }))).toBe("permission");
        expect(await kind(new Response("{}", { status: 404 }))).toBe("permission");
        expect(await kind(new Response("{}", { status: 500 }))).toBe("other");
        expect(await kind(new Response("{}", { status: 422 }))).toBe("other");
    });
    it("reports a rejected sign-in with no way to renew as sign-in needed, and drops the record", async () => {
        const store = memoryStore({ accessToken: "at1", login: "octo" });
        const { fetchFn } = fakeFetch(() => new Response("{}", { status: 401 }));
        const out = await createGitHubClient({ settings, records: store, fetch: fetchFn }).request({ path: "/user" });
        expect(out).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(store.current).toBeNull();
    });
    it("returns an empty body for 204", async () => {
        const { fetchFn } = fakeFetch(() => new Response(null, { status: 204 }));
        const out = await createGitHubClient({ settings, records: memoryStore(signed), fetch: fetchFn, now: () => 0 }).request({ path: "/x" });
        expect(out).toEqual({ ok: true, status: 204, body: null });
    });
});

describe("GitHub client: renewal (D7, G20)", () => {
    it("renews first when the stored expiry has passed, then sends with the new token", async () => {
        const store = memoryStore({ ...signed, expiresAt: 1000 });
        const { fetchFn, calls } = fakeFetch((c) => (isBackend(c) ? refreshed() : ok()));
        const out = await createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 2000 }).request({ path: "/user" });
        expect(out.ok).toBe(true);
        expect(calls.map((c) => c.url)).toEqual(["https://api.team.example/auth/refresh", "https://api.github.com/user"]);
        expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ refresh_token: "rt1" });
        expect(headerOf(calls[1]!, "authorization")).toBe("Bearer at2");
        expect(store.current).toEqual({ accessToken: "at2", refreshToken: "rt2", expiresAt: 2000 + 60_000, login: "octo" });
    });

    it("renews once on a rejected answer and retries once", async () => {
        const store = memoryStore(signed);
        let apiCalls = 0;
        const { fetchFn, calls } = fakeFetch((c) => {
            if (isBackend(c)) return refreshed();
            apiCalls++;
            return apiCalls === 1 ? new Response("{}", { status: 401 }) : ok({ fine: true });
        });
        const out = await createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 0 }).request({ path: "/user" });
        expect(out).toEqual({ ok: true, status: 200, body: { fine: true } });
        expect(calls.filter(isBackend)).toHaveLength(1);
        expect(calls.filter(isApi)).toHaveLength(2);
    });

    it("renews at most once per failed request: a second rejection ends in sign-in needed (G20)", async () => {
        const store = memoryStore(signed);
        const { fetchFn, calls } = fakeFetch((c) => (isBackend(c) ? refreshed() : new Response("{}", { status: 401 })));
        const out = await createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 0 }).request({ path: "/user" });
        expect(out).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(calls.filter(isBackend)).toHaveLength(1);
        expect(calls.filter(isApi)).toHaveLength(2);
        expect(store.current).toBeNull();
    });

    it("shares one renewal between requests that fail at the same time (G20)", async () => {
        const store = memoryStore(signed);
        const { fetchFn, calls } = fakeFetch(async (c) => {
            if (isBackend(c)) {
                await new Promise((r) => setTimeout(r, 5));
                return refreshed();
            }
            return headerOf(c, "authorization") === "Bearer at1" ? new Response("{}", { status: 401 }) : ok();
        });
        const client = createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 0 });
        const results = await Promise.all([client.request({ path: "/a" }), client.request({ path: "/b" }), client.request({ path: "/c" })]);
        expect(results.every((r) => r.ok)).toBe(true);
        expect(calls.filter(isBackend)).toHaveLength(1);
    });

    it("uses a sign-in another tab renewed meanwhile, and does not drop it (G20)", async () => {
        const store = memoryStore(signed);
        const { fetchFn, calls } = fakeFetch((c) => {
            if (isBackend(c)) {
                // Another tab used the single-use refresh token first and stored a new record.
                store.current = { accessToken: "at9", refreshToken: "rt9", login: "octo" };
                return new Response("{}", { status: 400 });
            }
            return headerOf(c, "authorization") === "Bearer at9" ? ok() : new Response("{}", { status: 401 });
        });
        const out = await createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 0 }).request({ path: "/user" });
        expect(out.ok).toBe(true);
        expect(store.current?.accessToken).toBe("at9");
        expect(store.writes).not.toContain(null);
        expect(headerOf(calls.filter(isApi).at(-1)!, "authorization")).toBe("Bearer at9");
    });

    it("skips the backend renewal when another tab already stored a newer record (G20)", async () => {
        const store = memoryStore(signed);
        const { fetchFn, calls } = fakeFetch((c) => {
            if (isApi(c) && headerOf(c, "authorization") === "Bearer at1") {
                // Another tab renewed while this request was in flight.
                store.current = { accessToken: "at9", refreshToken: "rt9", login: "octo" };
                return new Response("{}", { status: 401 });
            }
            return ok();
        });
        const out = await createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 0 }).request({ path: "/user" });
        expect(out.ok).toBe(true);
        expect(calls.filter(isBackend)).toHaveLength(0);
    });

    it("drops the record when renewal fails and nothing newer is stored (G20)", async () => {
        const store = memoryStore(signed);
        const { fetchFn } = fakeFetch((c) => (isBackend(c) ? new Response("{}", { status: 400 }) : new Response("{}", { status: 401 })));
        const out = await createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 0 }).request({ path: "/user" });
        expect(out).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(store.current).toBeNull();
    });
});

describe("GitHub client: token custody (G5, G6)", () => {
    it("sends the access token only to GitHub's API and the refresh token only to the backend (G6)", async () => {
        const store = memoryStore({ ...signed, expiresAt: 1 });
        const { fetchFn, calls } = fakeFetch((c) => (isBackend(c) ? refreshed() : new Response("{}", { status: 401 })));
        await createGitHubClient({ settings, records: store, fetch: fetchFn, now: () => 5 }).request({ path: "/user" });
        for (const c of calls) {
            const carried: string = JSON.stringify(c);
            if (isApi(c)) expect(carried).not.toMatch(/rt1|rt2/);
            if (isBackend(c)) expect(carried).not.toMatch(/at1|at2|Bearer/);
        }
    });

    it("writes nothing to the console and puts no token in a result (G5)", async () => {
        const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
        const { fetchFn } = fakeFetch((c) => (isBackend(c) ? new Response("rt1", { status: 500 }) : new Response("at1", { status: 401 })));
        const out = await createGitHubClient({ settings, records: memoryStore(signed), fetch: fetchFn, now: () => 0 }).request({ path: "/user" });
        expect(JSON.stringify(out)).not.toMatch(/at1|rt1/);
        for (const s of spies) expect(s).not.toHaveBeenCalled();
    });
});

describe("refreshTokens", () => {
    it("posts the refresh token to the backend and keeps the username", async () => {
        const { fetchFn, calls } = fakeFetch(() => refreshed());
        const rec = await refreshTokens(settings, fetchFn, { accessToken: "at1", refreshToken: "rt1", login: "octo" }, () => 100);
        expect(calls[0]!.url).toBe("https://api.team.example/auth/refresh");
        expect(rec).toEqual({ accessToken: "at2", expiresAt: 100 + 60_000, refreshToken: "rt2", login: "octo" });
    });
    it("throws when the record has no refresh token or the answer is incomplete", async () => {
        const { fetchFn } = fakeFetch(() => Response.json({}));
        await expect(refreshTokens(settings, fetchFn, { accessToken: "a", login: "o" })).rejects.toThrow();
        await expect(refreshTokens(settings, fetchFn, { accessToken: "a", refreshToken: "r", login: "o" })).rejects.toThrow();
    });
});
