import { describe, expect, it, vi } from "vitest";
import {
    SignInError,
    checkReturn,
    exchangeCode,
    removeReturnParams,
    startAttempt,
    type PendingAttempt,
    type TeamSettings,
} from "./signin.ts";

const settings: TeamSettings = { clientId: "Iv1.abc", backendUrl: "https://api.team.example" };
const redirect: string = "https://ext.chromiumapp.org/";

function b64url(bytes: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

describe("startAttempt", () => {
    it("builds GitHub's authorize address with the client id, return address, state and a challenge", async () => {
        const { url, pending } = await startAttempt(settings, redirect);
        const u: URL = new URL(url);
        expect(u.origin + u.pathname).toBe("https://github.com/login/oauth/authorize");
        expect(u.searchParams.get("client_id")).toBe("Iv1.abc");
        expect(u.searchParams.get("redirect_uri")).toBe(redirect);
        expect(u.searchParams.get("state")).toBe(pending.state);
        expect(u.searchParams.get("code_challenge_method")).toBe("S256");
        const digest: ArrayBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pending.verifier));
        expect(u.searchParams.get("code_challenge")).toBe(b64url(digest));
    });

    it("asks for no scope, because read access comes from the App registration (G11)", async () => {
        const { url } = await startAttempt(settings, redirect);
        expect(new URL(url).searchParams.has("scope")).toBe(false);
    });

    it("makes a new random state and verifier for every attempt (G7)", async () => {
        const a = await startAttempt(settings, redirect);
        const b = await startAttempt(settings, redirect);
        expect(a.pending.state).not.toBe(b.pending.state);
        expect(a.pending.verifier).not.toBe(b.pending.verifier);
        expect(a.pending.state.length).toBeGreaterThanOrEqual(32);
        expect(a.pending.verifier.length).toBeGreaterThanOrEqual(43);
        expect(a.pending.redirectUri).toBe(redirect);
    });

    it("never puts a client secret in the address (G1)", async () => {
        const { url } = await startAttempt(settings, redirect);
        expect(url).not.toMatch(/secret/i);
    });

    it("asks for GitHub's account chooser only when told to, and still asks for no scope (G16, G20)", async () => {
        const plain = new URL((await startAttempt(settings, redirect)).url);
        expect(plain.searchParams.has("prompt")).toBe(false);
        const chooser = new URL((await startAttempt(settings, redirect, { chooser: true })).url);
        expect(chooser.searchParams.get("prompt")).toBe("select_account");
        expect(chooser.searchParams.has("scope")).toBe(false);
        expect(chooser.searchParams.get("code_challenge_method")).toBe("S256");
    });
});

describe("checkReturn", () => {
    const pending: PendingAttempt = { state: "s1", verifier: "v1", redirectUri: redirect };
    it("accepts a return whose state matches and that carries a code", () => {
        expect(checkReturn(`${redirect}?code=c1&state=s1`, pending)).toEqual({ ok: true, code: "c1" });
    });
    it("fails when the state does not match the pending attempt (G7)", () => {
        expect(checkReturn(`${redirect}?code=c1&state=other`, pending)).toEqual({ ok: false });
    });
    it("fails when there is no pending attempt", () => {
        expect(checkReturn(`${redirect}?code=c1&state=s1`, null)).toEqual({ ok: false });
    });
    it("fails when the user denied consent", () => {
        expect(checkReturn(`${redirect}?error=access_denied&state=s1`, pending)).toEqual({ ok: false });
    });
    it("fails when the window closed with no return address, or the code is missing", () => {
        expect(checkReturn(undefined, pending)).toEqual({ ok: false });
        expect(checkReturn(`${redirect}?state=s1`, pending)).toEqual({ ok: false });
    });
    it("fails on an address that cannot be read", () => {
        expect(checkReturn("not a url", pending)).toEqual({ ok: false });
    });
});

describe("removeReturnParams", () => {
    it("drops code, state and error parameters and keeps the rest (G9)", () => {
        expect(removeReturnParams("https://web.example/app/?code=c&state=s&error=e&error_description=d&keep=1#h")).toBe(
            "https://web.example/app/?keep=1#h",
        );
        expect(removeReturnParams("https://web.example/?code=c&state=s")).toBe("https://web.example/");
    });
});

describe("exchangeCode", () => {
    const pending: PendingAttempt = { state: "s1", verifier: "v1", redirectUri: redirect };
    it("posts the code, verifier and return address to the backend and returns a sign-in record", async () => {
        const fetchFn = vi.fn(async () =>
            Response.json({ access_token: "at", expires_in: 28800, refresh_token: "rt", login: "octo" }),
        );
        const record = await exchangeCode(settings, fetchFn as unknown as typeof fetch, "c1", pending, () => 1000);
        const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("https://api.team.example/auth/exchange");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual({ code: "c1", verifier: "v1", redirect_uri: redirect });
        expect(record).toEqual({ accessToken: "at", expiresAt: 1000 + 28800 * 1000, refreshToken: "rt", login: "octo" });
    });
    it("keeps no expiry or refresh token when the App issues none", async () => {
        const fetchFn = async () => Response.json({ access_token: "at", login: "octo" });
        const record = await exchangeCode(settings, fetchFn as unknown as typeof fetch, "c", pending);
        expect(record).toEqual({ accessToken: "at", login: "octo" });
    });
    it("throws a SignInError that holds no code, verifier or token (G5)", async () => {
        const fetchFn = async () => Response.json({ error: "boom", access_token: "leak" }, { status: 400 });
        const err: unknown = await exchangeCode(settings, fetchFn as unknown as typeof fetch, "secretcode", pending).catch(
            (e: unknown) => e,
        );
        expect(err).toBeInstanceOf(SignInError);
        expect((err as Error).message).not.toMatch(/secretcode|v1|leak/);
    });
    it("throws a SignInError when the network fails", async () => {
        const fetchFn = async () => {
            throw new TypeError("offline secretcode");
        };
        const err: unknown = await exchangeCode(settings, fetchFn as unknown as typeof fetch, "secretcode", pending).catch(
            (e: unknown) => e,
        );
        expect(err).toBeInstanceOf(SignInError);
        expect((err as Error).message).not.toContain("secretcode");
    });
    it("throws when the answer lacks a token or a username", async () => {
        const fetchFn = async () => Response.json({ access_token: "at" });
        await expect(exchangeCode(settings, fetchFn as unknown as typeof fetch, "c", pending)).rejects.toBeInstanceOf(SignInError);
    });
});
