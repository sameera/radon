import { describe, expect, it, vi } from "vitest";
import { SIGNIN_KEY, createWorker, type WorkerDeps } from "./worker.ts";

const EXT_ID: string = "abcdefgh";
const own = { id: EXT_ID };

function setup(record: unknown, answer: (url: string, init: RequestInit) => Response = () => Response.json({ n: 1 })) {
    const data = new Map<string, unknown>(record ? [[SIGNIN_KEY, record]] : []);
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => answer(url, init));
    const deps: WorkerDeps = {
        settings: { clientId: "Iv1.x", backendUrl: "https://api.team.example" },
        extensionId: EXT_ID,
        redirectUri: "https://abcdefgh.chromiumapp.org/",
        launch: async () => undefined,
        storage: { get: async (k) => data.get(k), set: async (k, v) => void data.set(k, v) },
        fetch: fetchFn as unknown as typeof fetch,
    };
    return { worker: createWorker(deps), data, fetchFn };
}
const msg = (request: unknown) => ({ type: "raiden/github", request });

describe("extension worker GitHub requests", () => {
    it("runs the shared client with the stored token and returns only the result (D6, G3)", async () => {
        const { worker, fetchFn } = setup({ accessToken: "at1", login: "octo" });
        const out = await worker.handle(msg({ path: "/user" }), own);
        expect(out).toEqual({ ok: true, status: 200, body: { n: 1 } });
        expect(fetchFn.mock.calls[0]![0]).toBe("https://api.github.com/user");
        expect(JSON.stringify(out)).not.toContain("at1");
    });
    it("sends no request and reports sign-in needed when signed out (G17)", async () => {
        const { worker, fetchFn } = setup(null);
        expect(await worker.handle(msg({ path: "/user" }), own)).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(fetchFn).not.toHaveBeenCalled();
    });
    it("refuses senders that are not Raiden's own extension contexts (G21)", async () => {
        const { worker, fetchFn } = setup({ accessToken: "at1", login: "octo" });
        expect(await worker.handle(msg({ path: "/user" }), { id: "evil" })).toEqual({ error: "refused" });
        expect(await worker.handle(msg({ path: "/user" }), {})).toEqual({ error: "refused" });
        expect(fetchFn).not.toHaveBeenCalled();
    });
    it("accepts only GitHub API addresses and shaped requests (G21)", async () => {
        const { worker, fetchFn } = setup({ accessToken: "at1", login: "octo" });
        for (const request of [{ path: "https://evil.example/x" }, { path: "//evil.example" }, { path: 5 }, null, "x", { path: "/x", method: "DELETE" }]) {
            expect(await worker.handle(msg(request), own)).toEqual({ ok: false, kind: "other" });
        }
        expect(fetchFn).not.toHaveBeenCalled();
    });
    it("drops the stored sign-in when it cannot be renewed, and status then reads signed out (D7)", async () => {
        const { worker, data } = setup({ accessToken: "at1", login: "octo" }, () => new Response("{}", { status: 401 }));
        expect(await worker.handle(msg({ path: "/user" }), own)).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(data.get(SIGNIN_KEY) ?? null).toBeNull();
        expect(await worker.handle({ type: "raiden/status" }, own)).toEqual({ login: null });
    });
});
