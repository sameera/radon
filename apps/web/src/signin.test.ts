// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignInController } from "@raiden/app";
import { boot, HOST_ID } from "./boot.ts";
import { webPreferences } from "./prefs.ts";
import { createGitHubClient } from "@raiden/shared";
import { PENDING_KEY, RECORD_KEY, SIGNED_OUT_KEY, finishReturn, wasSignedOut, webRecordStore, webSignInPort, type WebSignInDeps } from "./signin.ts";

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

function rig(href: string, answer: () => Response = () => Response.json({ access_token: "at", expires_in: 28_800, refresh_token: "rt", login: "octo" })): Rig {
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

// A lock that runs one holder at a time, like the browser's lock manager.
function fakeLocks(): { request<T>(name: string, run: () => Promise<T>): Promise<T>; held: string[] } {
    let tail: Promise<unknown> = Promise.resolve();
    const held: string[] = [];
    return {
        held,
        request<T>(name: string, run: () => Promise<T>): Promise<T> {
            const next = tail.then(async () => {
                held.push(`take:${name}`);
                try {
                    return await run();
                } finally {
                    held.push(`release:${name}`);
                }
            });
            tail = next.catch(() => undefined);
            return next;
        },
    };
}

describe("web view sign-out (#60)", () => {
    const seed = (r: Rig): void => {
        r.local.setItem(RECORD_KEY, JSON.stringify({ accessToken: "at", refreshToken: "rt", login: "octo" }));
        r.local.setItem("raiden:repository", JSON.stringify({ login: "octo", owner: "a", name: "b", url: "u" }));
        r.local.setItem("raiden:repositories", JSON.stringify({ login: "octo", repos: [] }));
        r.local.setItem("raiden:showIssues", "false");
        r.local.setItem("raiden:sidebarCollapsed", "true");
        r.local.setItem("raiden:backlogWidth", "400");
        r.session.setItem(PENDING_KEY, pendingFor("s1"));
    };
    const ports = (r: Rig, locks = fakeLocks()) => ({ locks, port: webSignInPort({ ...r.deps, locks }) });

    it("removes the sign-in, the pending attempt, the remembered repository and the saved list (G8, G9)", async () => {
        const r = rig(RETURN);
        seed(r);
        await ports(r).port.signOut!();
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
        expect(r.session.getItem(PENDING_KEY)).toBeNull();
        expect(r.local.getItem("raiden:repository")).toBeNull();
        expect(r.local.getItem("raiden:repositories")).toBeNull();
        expect(JSON.stringify({ ...localStorage })).not.toMatch(/"at"|"rt"|octo/);
    });

    it("keeps the layout choices (G10)", async () => {
        const r = rig(RETURN);
        seed(r);
        await ports(r).port.signOut!();
        expect(r.local.getItem("raiden:showIssues")).toBe("false");
        expect(r.local.getItem("raiden:sidebarCollapsed")).toBe("true");
        expect(r.local.getItem("raiden:backlogWidth")).toBe("400");
    });

    it("removes the record first, under the refresh lock, then writes the marker and reloads at its own address (D5, D6)", async () => {
        const r = rig(`${RETURN}?x=1#h`);
        seed(r);
        const { locks, port } = ports(r);
        const order: string[] = [];
        const remove = r.local.removeItem.bind(r.local);
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key: string) {
            order.push(`${locks.held.at(-1)}|${key}`);
            remove(key);
        });
        await port.signOut!();
        vi.restoreAllMocks();
        expect(order[0]).toBe(`take:raiden:signin-refresh|${RECORD_KEY}`);
        expect(locks.held).toEqual(["take:raiden:signin-refresh", "release:raiden:signin-refresh"]);
        expect(r.session.getItem(SIGNED_OUT_KEY)).not.toBeNull();
        expect(r.assign).toHaveBeenCalledWith(RETURN);
    });

    it("sends no request, so it works offline (G14, G15)", async () => {
        const r = rig(RETURN);
        seed(r);
        await ports(r).port.signOut!();
        expect(r.fetchFn).not.toHaveBeenCalled();
    });

    it("waits for a renewal under way, and a renewal never writes a sign-in back (G11)", async () => {
        const r = rig(RETURN);
        const locks = fakeLocks();
        r.local.setItem(RECORD_KEY, JSON.stringify({ accessToken: "old", refreshToken: "rt", expiresAt: 1, login: "octo" }));
        let release!: () => void;
        const gate = new Promise<void>((res) => (release = res));
        const client = createGitHubClient({
            settings,
            records: webRecordStore(r.local),
            now: () => 10,
            fetch: (async () => {
                await gate;
                return Response.json({ access_token: "new", expires_in: 28_800, refresh_token: "rt2", login: "octo" });
            }) as unknown as typeof fetch,
            withRefreshLock: (run) => locks.request("raiden:signin-refresh", run),
        });
        const status = client.status();
        await vi.waitFor(() => expect(locks.held).toEqual(["take:raiden:signin-refresh"]));
        let done = false;
        const out = webSignInPort({ ...r.deps, locks }).signOut!().then(() => (done = true));
        await new Promise((res) => setTimeout(res, 5));
        expect(done).toBe(false);
        release();
        await status;
        await out;
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
        // A request queued behind the sign-out finds no record and writes nothing.
        expect(await client.status()).toBeNull();
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
    });

    it("still signs out and reloads when storage throws (G24)", async () => {
        const r = rig(RETURN);
        const broken = { getItem: () => null, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } } as unknown as Storage;
        await expect(webSignInPort({ ...r.deps, local: broken, session: broken, locks: fakeLocks() }).signOut!()).resolves.toBeUndefined();
        expect(r.assign).toHaveBeenCalledWith(RETURN);
    });

    it("signs out without a lock manager", async () => {
        const r = rig(RETURN);
        seed(r);
        await webSignInPort({ ...r.deps, locks: null }).signOut!();
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
    });

    it("holds nothing sensitive in the marker or the reload address (G21)", async () => {
        const r = rig(RETURN);
        seed(r);
        await ports(r).port.signOut!();
        expect(r.session.getItem(SIGNED_OUT_KEY)).toBe("1");
        expect(r.assign.mock.calls[0]![0]).toBe(RETURN);
    });

    it("asks for the account chooser on the next sign-in while the marker is present, then asks no more (D8, G16, G20)", async () => {
        const r = rig(RETURN);
        r.session.setItem(SIGNED_OUT_KEY, "1");
        void webSignInPort(r.deps).signIn();
        await vi.waitFor(() => expect(r.assign).toHaveBeenCalledTimes(1));
        const url = new URL(r.assign.mock.calls[0]![0] as string);
        expect(url.searchParams.get("prompt")).toBe("select_account");
        expect(url.searchParams.has("scope")).toBe(false);
        // The marker stays until a sign-in finishes.
        expect(wasSignedOut(r.session)).toBe(true);
    });

    it("asks for no chooser on a normal sign-in", async () => {
        const r = rig(RETURN);
        void webSignInPort(r.deps).signIn();
        await vi.waitFor(() => expect(r.assign).toHaveBeenCalledTimes(1));
        expect(new URL(r.assign.mock.calls[0]![0] as string).searchParams.has("prompt")).toBe(false);
    });

    it("clears the marker when a sign-in finishes, and keeps it when one does not", async () => {
        const failed = rig(`${RETURN}?error=access_denied&state=s1`);
        failed.session.setItem(SIGNED_OUT_KEY, "1");
        failed.session.setItem(PENDING_KEY, pendingFor("s1"));
        await finishReturn(failed.deps);
        expect(wasSignedOut(failed.session)).toBe(true);
        const ok = rig(`${RETURN}?code=c1&state=s1`);
        ok.session.setItem(SIGNED_OUT_KEY, "1");
        ok.session.setItem(PENDING_KEY, pendingFor("s1"));
        await finishReturn(ok.deps);
        expect(wasSignedOut(ok.session)).toBe(false);
    });

    it("reads blocked storage as not signed out", () => {
        const broken = { getItem: () => { throw new Error("blocked"); } } as unknown as Storage;
        expect(wasSignedOut(broken)).toBe(false);
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

    async function open(r: Rig, notice: boolean, signedOut: boolean = false): Promise<ShadowRoot> {
        await act(async () => {
            unmount = await boot(document, window, {
                css: "",
                prefs: webPreferences(),
                signIn: createSignInController(webSignInPort(r.deps), { notice, signedOut }),
            });
        });
        await act(async () => {
            await new Promise((res) => setTimeout(res, 0));
        });
        return document.getElementById(HOST_ID)!.shadowRoot!;
    }

    it("shows the account after the page reloads, as the banner avatar named for the username (G14, D1)", async () => {
        const r = rig(RETURN);
        r.local.setItem(RECORD_KEY, JSON.stringify({ accessToken: "at", login: "octo" }));
        const root = await open(r, false);
        expect(root.querySelector(".rd-banner__avatar")!.getAttribute("aria-label")).toContain("octo");
        expect(root.querySelector(".rd-nav__user")).toBeNull();
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
        const r = rig(`${RETURN}?code=c1&state=s1`);
        r.session.setItem(PENDING_KEY, pendingFor("s1"));
        const { notice } = await finishReturn(r.deps);
        const root = await open(r, notice);
        expect(root.querySelector(".rd-nav-item[aria-current=\"page\"]")!.textContent).toContain("Grooming");
    });

    it("signs out from the avatar menu: the sign-in screen shows with the warning, and a reload stays signed out (G12, G13, G16)", async () => {
        const r = rig(RETURN);
        r.local.setItem(RECORD_KEY, JSON.stringify({ accessToken: "at", login: "octo" }));
        let root = await open(r, false);
        await act(async () => {
            root.querySelector<HTMLElement>(".rd-banner__avatar")!.click();
        });
        await act(async () => {
            root.querySelector<HTMLElement>("[role=menuitem]")!.click();
            await new Promise((res) => setTimeout(res, 0));
        });
        expect(root.querySelector(".rd-sign-in")).not.toBeNull();
        expect(root.querySelector(".rd-main")).toBeNull();
        expect(root.querySelector(".rd-banner")).toBeNull();
        expect(r.local.getItem(RECORD_KEY)).toBeNull();
        expect(r.assign).toHaveBeenCalledWith(RETURN);
        unmount?.();
        document.body.innerHTML = "";
        root = await open(r, false, wasSignedOut(r.session));
        expect(root.querySelector(".rd-sign-in")).not.toBeNull();
        expect(root.querySelector(".rd-main")).toBeNull();
        expect(root.querySelector(".rd-sign-in a")!.getAttribute("href")).toBe("https://github.com/logout");
    });
});
