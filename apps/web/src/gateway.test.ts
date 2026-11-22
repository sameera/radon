// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECORD_KEY } from "./signin.ts";
import { webGateway } from "./gateway.ts";

const settings = { clientId: "Iv1.x", backendUrl: "https://api.team.example" };

beforeEach(() => localStorage.clear());

describe("web gateway", () => {
    it("runs the shared client in the page with the stored token (D6)", async () => {
        localStorage.setItem(RECORD_KEY, JSON.stringify({ accessToken: "at1", login: "octo" }));
        const fetchFn = vi.fn(async () => Response.json({ n: 1 }));
        const out = await webGateway({ settings, local: localStorage, fetch: fetchFn as unknown as typeof fetch }).request({ path: "/user" });
        expect(out).toEqual({ ok: true, status: 200, body: { n: 1 } });
        const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("https://api.github.com/user");
        expect((init.headers as Record<string, string>).authorization).toBe("Bearer at1");
    });
    it("sends nothing when signed out", async () => {
        const fetchFn = vi.fn();
        const out = await webGateway({ settings, local: localStorage, fetch: fetchFn as unknown as typeof fetch }).request({ path: "/user" });
        expect(out).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(fetchFn).not.toHaveBeenCalled();
    });
    it("drops the stored sign-in when it is rejected and cannot be renewed", async () => {
        localStorage.setItem(RECORD_KEY, JSON.stringify({ accessToken: "at1", login: "octo" }));
        const fetchFn = async () => new Response("{}", { status: 401 });
        const out = await webGateway({ settings, local: localStorage, fetch: fetchFn as unknown as typeof fetch }).request({ path: "/user" });
        expect(out).toEqual({ ok: false, kind: "sign-in-needed" });
        expect(localStorage.getItem(RECORD_KEY)).toBeNull();
    });
});
