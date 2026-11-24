// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubGateway } from "./gateway.ts";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo, type RepoStore } from "./repo.tsx";
import { createSignInController, type SignInPort } from "./signin.ts";
import { createSessionStore } from "./session.ts";
import { pickRepository } from "./remember.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const GADGETS: Repo = { owner: "acme", name: "gadgets", url: "https://github.com/acme/gadgets" };

type Rows = Repo[];
// A gateway whose answer the test controls: a list of repositories, "fail", or a promise to wait on.
function gatewayFor(answer: () => Rows | "fail" | Promise<Rows | "fail">): GitHubGateway {
    return {
        async request(request) {
            if (request.path === "/user/installations") {
                return { ok: true, status: 200, body: { total_count: 1, installations: [{ id: 1 }] } };
            }
            const got = await answer();
            if (got === "fail") {
                return { ok: false, kind: "network" };
            }
            return {
                ok: true,
                status: 200,
                body: {
                    total_count: got.length,
                    repositories: got.map((r) => ({ name: r.name, owner: { login: r.owner }, html_url: r.url })),
                },
            };
        },
    };
}

function memoryPrefs(initial: Record<string, unknown> = {}): PreferenceStore & { data: Record<string, unknown> } {
    const data: Record<string, unknown> = { ...initial };
    return {
        data,
        get: async (k) => data[k],
        set: async (k, v) => void (data[k] = v),
    };
}

let root: HTMLElement;
let unmount: (() => void) | undefined;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const port = (login: string | null): SignInPort => ({ status: async () => login, signIn: async () => (login ? { login } : null) });

async function open(o: {
    login: string | null;
    prefs: PreferenceStore;
    gateway: GitHubGateway;
    repo?: RepoStore;
    banner?: boolean;
}): Promise<RepoStore> {
    const repo = o.repo ?? createRepoStore(null);
    await act(async () => {
        unmount = await mountApp(root, {
            session: createSessionStore(),
            signIn: createSignInController(port(o.login)),
            gateway: o.gateway,
            prefs: o.prefs,
            repo,
            banner: o.banner === false ? undefined : { icon: "i.png" },
        });
    });
    await flush();
    await flush();
    current = o.login ? { store: repo, prefs: o.prefs, login: o.login } : undefined;
    return repo;
}
// Picks through the app's pick path, as the person's pick does.
let current: { store: RepoStore; prefs: PreferenceStore; login: string } | undefined;
async function pick(value: string): Promise<void> {
    const [owner, name] = value.split("/");
    await act(() => {
        pickRepository(current!.store, current!.prefs, current!.login, { owner, name, url: `https://github.com/${value}` });
    });
}

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
    vi.unstubAllGlobals();
});

describe("the remembered repository (D6, D7, G8-G10, G13, G14)", () => {
    it("is written, tagged with the login, when the person picks a repository", async () => {
        const prefs = memoryPrefs();
        await open({ login: "ada", prefs, gateway: gatewayFor(() => [GADGETS, WIDGETS]) });
        await pick("acme/gadgets");
        expect(prefs.data["repository"]).toEqual({ login: "ada", ...GADGETS });
    });

    it("holds only the login and the repository's owner, name and address (G14)", async () => {
        const prefs = memoryPrefs();
        await open({ login: "ada", prefs, gateway: gatewayFor(() => [WIDGETS]) });
        await pick("acme/widgets");
        expect(Object.keys(prefs.data["repository"] as object).sort()).toEqual(["login", "name", "owner", "url"]);
        expect(JSON.stringify(prefs.data)).not.toMatch(/token/i);
    });

    it("becomes the current repository before GitHub answers, with no pick", async () => {
        const prefs = memoryPrefs({ repository: { login: "ada", ...WIDGETS } });
        let release!: (rows: Rows) => void;
        const slow = new Promise<Rows>((r) => (release = r));
        const repo = await open({ login: "ada", prefs, gateway: gatewayFor(() => slow) });
        expect(repo.get()).toEqual(WIDGETS);
        expect(root.querySelector(".rd-groom")).not.toBeNull();
        await act(async () => release([WIDGETS]));
        await flush();
        expect(repo.get()).toEqual(WIDGETS);
    });

    it("becomes none and is cleared when a complete fresh list lacks it", async () => {
        const prefs = memoryPrefs({ repository: { login: "ada", ...WIDGETS } });
        const repo = await open({ login: "ada", prefs, gateway: gatewayFor(() => [GADGETS]) });
        expect(repo.get()).toBeNull();
        expect(prefs.data["repository"]).toBeNull();
        expect(root.querySelector(".rd-pick-prompt")).not.toBeNull();
    });

    it("stays current and stays stored when the fresh list load fails (G12)", async () => {
        const prefs = memoryPrefs({ repository: { login: "ada", ...WIDGETS } });
        const repo = await open({ login: "ada", prefs, gateway: gatewayFor(() => "fail") });
        expect(repo.get()).toEqual(WIDGETS);
        expect(prefs.data["repository"]).toEqual({ login: "ada", ...WIDGETS });
    });

    it("stays when the fresh list is partial: one page refused", async () => {
        const prefs = memoryPrefs({ repository: { login: "ada", ...WIDGETS } });
        const gateway: GitHubGateway = {
            async request(request) {
                if (request.path === "/user/installations") {
                    return { ok: true, status: 200, body: { total_count: 2, installations: [{ id: 1 }, { id: 2 }] } };
                }
                if (request.path.includes("/2/")) {
                    return { ok: false, kind: "rate-limit" };
                }
                return { ok: true, status: 200, body: { total_count: 1, repositories: [{ name: "gadgets", owner: { login: "acme" } }] } };
            },
        };
        const repo = await open({ login: "ada", prefs, gateway });
        expect(repo.get()).toEqual(WIDGETS);
        expect(prefs.data["repository"]).toEqual({ login: "ada", ...WIDGETS });
    });

    it("is not used for a different person on the same browser, and their pick overwrites it", async () => {
        const prefs = memoryPrefs({ repository: { login: "ada", ...WIDGETS } });
        const repo = await open({ login: "bob", prefs, gateway: gatewayFor(() => [WIDGETS, GADGETS]) });
        expect(repo.get()).toBeNull();
        expect(root.querySelector(".rd-pick-prompt")).not.toBeNull();
        await pick("acme/gadgets");
        expect(prefs.data["repository"]).toEqual({ login: "bob", ...GADGETS });
    });

    it("reads a malformed stored value as nothing stored", async () => {
        for (const bad of ["x", 7, { login: "ada" }, { login: "ada", owner: 1, name: "n", url: "u" }, null]) {
            const prefs = memoryPrefs({ repository: bad });
            const repo = await open({ login: "ada", prefs, gateway: gatewayFor(() => "fail") });
            expect(repo.get()).toBeNull();
            unmount?.();
            unmount = undefined;
        }
    });

    it("is neither read nor written by a host with no banner, the extension (G5)", async () => {
        const prefs = memoryPrefs({ repository: { login: "ada", ...GADGETS } });
        const get = vi.spyOn(prefs, "get");
        const set = vi.spyOn(prefs, "set");
        const repo = await open({ login: "ada", prefs, gateway: gatewayFor(() => [WIDGETS]), banner: false, repo: createRepoStore(WIDGETS) });
        expect(repo.get()).toEqual(WIDGETS);
        expect(get.mock.calls.map((c) => c[0])).not.toContain("repository");
        expect(set.mock.calls.map((c) => c[0])).not.toContain("repository");
    });
});
