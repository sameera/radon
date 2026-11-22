// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignInController } from "@raiden/app";
import { boot, HOST_ID } from "./boot.ts";
import { webPreferences } from "./prefs.ts";
import { PENDING_KEY, RECORD_KEY, finishReturn, webRecordStore, webSignInPort, type WebSignInDeps } from "./signin.ts";

const RETURN: string = "https://raiden.team.example/app/";
const settings = { clientId: "Iv1.x", backendUrl: "https://api.team.example" };

interface Rig {
    deps: WebSignInDeps;
    local: Storage;
    session: Storage;
    fetchFn: ReturnType<typeof vi.fn>;
    replaceState: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
    events: string[];
}

function rig(href: string, answer: () => Response = () => Response.json({ access_token: "at", expires_in: 60, refresh_token: "rt", login: "octo" })): Rig {
    const events: string[] = [];
    const replaceState = vi.fn((_s: unknown, _t: string, url: string) => events.push(`replace:${url}`));
    const assign = vi.fn();
    const fetchFn = vi.fn(async () => {
        events.push("fetch");
        return answer();
    });
    const local: Storage = window.localStorage;
    const session: Storage = window.sessionStorage;
    const deps: WebSignInDeps = {
        settings,
        returnUrl: RETURN,
        win: { location: { href, assign }, history: { replaceState } } as unknown as WebSignInDeps["win"],
        local,
        session,
        fetch: fetchFn as unknown as typeof fetch,
    };
    return { deps, local, session, fetchFn, replaceState, assign, events };
}
const pendingFor = (state: string): string => JSON.stringify({ state, verifier: "v1", redirectUri: RETURN });

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

describe("web view sign-in start", () => {
    it("keeps a pending attempt in this tab's session storage and goes to GitHub (D4)", async () => {
        const r = rig(RETURN);
        void webSignInPort(r.deps).signIn();
        await vi.waitFor(() => expect(r.assign).toHaveBeenCalledTimes(1));
        const url: URL = new URL(r.assign.mock.calls[0]![0] as string);
        expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
        expect(url.searchParams.get("redirect_uri")).toBe(RETURN);
        const pending = JSON.parse(r.session.getItem(PENDING_KEY)!);
        expect(url.searchParams.get("state")).toBe(pending.state);
        expect(r.local.getItem(PENDING_KEY)).toBeNull();
        expect(url.searchParams.has("scope")).toBe(false);
    });
});

describe("web view sign-in return", () => {
    it("exchanges the code, stores the record in local storage and cleans the address first (G4, G9)", async () => {
        const r = rig(`${RETURN}?code=c1&state=s1&keep=1`);
        r.session.setItem(PENDING_KEY, pendingFor("s1"));
        const result = await finishReturn(r.deps);
        expect(result).toEqual({ notice: false });
        expect(r.events[0]).toBe(`replace:${RETURN}?keep=1`);
        expect(r.events.indexOf("fetch")).toBeGreaterThan(0);
        const [url, init] = r.fetchFn.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("https://api.team.example/auth/exchange");
        expect(JSON.parse(init.body as string)).toEqual({ code: "c1", verifier: "v1", redirect_uri: RETURN });
        const stored = JSON.parse(r.local.getItem(RECORD_KEY)!);
        expect(stored.login).toBe("octo");
        expect(stored.accessToken).toBe("at");
        // The pending attempt is used once (G8).
        expect(r.session.getItem(PENDING_KEY)).toBeNull();
        // The store reads it back and the port reports the username (G14).
        expect((await webRecordStore(r.local).get())?.login).toBe("octo");
        expect(await webSignInPort(r.deps).status()).toBe("octo");
    });

    it("stays signed out with a message when consent was denied (G13)", async () => {
        const r = rig(`${RETURN}?error=access_denied&state=s1`);
        r.session.setItem(PENDING_KEY, pendingFor("s1"));
        expect(await finishReturn(r.deps)).toEqual({ notice: true });
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
        expect(r.fetchFn).not.toHaveBeenCalled();
        expect(r.session.getItem(PENDING_KEY)).toBeNull();
        expect(r.replaceState).toHaveBeenCalled();
    });

    it("stays signed out when the state does not match, and calls no backend (G7)", async () => {
        const r = rig(`${RETURN}?code=c1&state=forged`);
        r.session.setItem(PENDING_KEY, pendingFor("s1"));
        expect(await finishReturn(r.deps)).toEqual({ notice: true });
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
        expect(r.fetchFn).not.toHaveBeenCalled();
    });

    it("stays signed out when no attempt is pending in this tab", async () => {
        const r = rig(`${RETURN}?code=c1&state=s1`);
        expect(await finishReturn(r.deps)).toEqual({ notice: true });
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
    });

    it("stays signed out when the backend exchange fails, and drops the attempt (G8)", async () => {
        const r = rig(`${RETURN}?code=c1&state=s1`, () => Response.json({}, { status: 500 }));
        r.session.setItem(PENDING_KEY, pendingFor("s1"));
        expect(await finishReturn(r.deps)).toEqual({ notice: true });
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
        expect(r.session.getItem(PENDING_KEY)).toBeNull();
    });

    it("does nothing on an ordinary load", async () => {
        const r = rig(RETURN);
        r.session.setItem(PENDING_KEY, pendingFor("s1"));
        expect(await finishReturn(r.deps)).toEqual({ notice: false });
        expect(r.replaceState).not.toHaveBeenCalled();
        expect(r.session.getItem(PENDING_KEY)).not.toBeNull();
    });

    it("reads blocked storage as signed out", async () => {
        const r = rig(RETURN);
        const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} } as unknown as Storage;
        expect(await webSignInPort({ ...r.deps, local: broken }).status()).toBeNull();
    });
});

describe("web view shell", () => {
    let unmount: (() => void) | undefined;
    afterEach(() => {
        unmount?.();
        unmount = undefined;
        document.body.innerHTML = "";
        document.head.innerHTML = "";
    });
    beforeEach(() => {
        const q = { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
        window.matchMedia = (() => q) as unknown as typeof window.matchMedia;
    });

    async function open(r: Rig, notice: boolean): Promise<ShadowRoot> {
        await act(async () => {
            unmount = await boot(document, window, {
                css: "",
                prefs: webPreferences(),
                signIn: createSignInController(webSignInPort(r.deps), { notice }),
            });
        });
        await act(async () => {
            await new Promise((res) => setTimeout(res, 0));
        });
        return document.getElementById(HOST_ID)!.shadowRoot!;
    }

    it("shows the username after the page reloads (G14)", async () => {
        const r = rig(RETURN);
        r.local.setItem(RECORD_KEY, JSON.stringify({ accessToken: "at", login: "octo" }));
        const root = await open(r, false);
        expect(root.querySelector(".rd-nav__account")!.textContent).toContain("octo");
    });

    it("never puts a token in the page (G4)", async () => {
        const r = rig(RETURN);
        r.local.setItem(RECORD_KEY, JSON.stringify({ accessToken: "TOKEN-X", refreshToken: "REFRESH-X", login: "octo" }));
        await open(r, false);
        expect(document.documentElement.outerHTML).not.toMatch(/TOKEN-X|REFRESH-X/);
    });

    it("shows the did-not-finish message and a sign-in button when the return failed (G13)", async () => {
        const r = rig(RETURN);
        const root = await open(r, true);
        expect(root.querySelector("[role=alert]")!.textContent).toBe("Sign-in did not finish");
        expect(root.querySelector(".rd-nav__account button")!.textContent).toBe("Sign in with GitHub");
    });

    it("opens on the first page, Grooming, after the return (D4)", async () => {
        const r = rig(RETURN);
        const root = await open(r, false);
        expect(root.querySelector(".rd-nav-item[aria-current=\"page\"]")!.textContent).toContain("Grooming");
    });
});
