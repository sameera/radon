// @vitest-environment jsdom
import { render, type VNode } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubGateway } from "./gateway.ts";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { createSessionStore } from "./session.ts";
import { useRepoList } from "./repolist.ts";

const A: Repo = { owner: "acme", name: "alpha", url: "https://github.com/acme/alpha" };
const B: Repo = { owner: "acme", name: "beta", url: "https://github.com/acme/beta" };
const C: Repo = { owner: "acme", name: "gamma", url: "https://github.com/acme/gamma" };

function gatewayFor(answer: () => Repo[] | "fail" | Promise<Repo[] | "fail">): GitHubGateway {
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
                body: { total_count: got.length, repositories: got.map((r) => ({ name: r.name, owner: { login: r.owner }, html_url: r.url })) },
            };
        },
    };
}
function memoryPrefs(initial: Record<string, unknown> = {}): PreferenceStore & { data: Record<string, unknown> } {
    const data: Record<string, unknown> = { ...initial };
    return { data, get: async (k) => data[k], set: async (k, v) => void (data[k] = v) };
}

let root: HTMLElement;
let unmount: (() => void) | undefined;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
// Renders the list holder alone, so its list can be read without a control that shows it.
function ListProbe({ login, prefs, gateway }: { login: string; prefs: PreferenceStore; gateway: GitHubGateway }): VNode {
    const { repos } = useRepoList(gateway, login, undefined, prefs);
    return (
        <ul class="probe">
            {repos.map((r: Repo) => (
                <li key={`${r.owner}/${r.name}`}>{`${r.owner}/${r.name}`}</li>
            ))}
        </ul>
    );
}

// With the banner, the list holder runs as the web view runs it; without, the whole app mounts as
// the extension mounts it.
async function open(login: string, prefs: PreferenceStore, gateway: GitHubGateway, banner = true): Promise<void> {
    await act(async () => {
        if (banner) {
            render(<ListProbe login={login} prefs={prefs} gateway={gateway} />, root);
            unmount = () => render(null, root);
            return;
        }
        unmount = await mountApp(root, {
            session: createSessionStore(),
            signIn: createSignInController({ status: async () => login, signIn: async () => ({ login }) }),
            gateway,
            prefs,
            repo: createRepoStore(null),
        });
    });
    await flush();
}
const labels = (): string[] => Array.from(root.querySelectorAll(".probe li")).map((o) => o.textContent!);

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

describe("the kept repository list (D6, D7, G11-G14)", () => {
    it("is written, tagged with the login, when a complete list arrives, holding no sign-in data", async () => {
        const prefs = memoryPrefs();
        await open("ada", prefs, gatewayFor(() => [A, B]));
        expect(prefs.data["repositories"]).toEqual({ login: "ada", repos: [A, B] });
        expect(JSON.stringify(prefs.data)).not.toMatch(/token/i);
    });

    it("fills the loaded list before GitHub answers", async () => {
        const prefs = memoryPrefs({ repositories: { login: "ada", repos: [A, B] } });
        let release!: (rows: Repo[]) => void;
        const slow = new Promise<Repo[]>((r) => (release = r));
        await open("ada", prefs, gatewayFor(() => slow));
        expect(labels()).toEqual(["acme/alpha", "acme/beta"]);
        await act(async () => release([B, C]));
        await flush();
        expect(labels()).toEqual(["acme/beta", "acme/gamma"]);
    });

    it("replaces the kept list on screen and in storage when the complete fresh list arrives", async () => {
        const prefs = memoryPrefs({ repositories: { login: "ada", repos: [A, B] } });
        await open("ada", prefs, gatewayFor(() => [C]));
        expect(labels()).toEqual(["acme/gamma"]);
        expect(prefs.data["repositories"]).toEqual({ login: "ada", repos: [C] });
    });

    it("leaves the loaded list and storage unchanged when the fresh load fails", async () => {
        const prefs = memoryPrefs({ repositories: { login: "ada", repos: [A, B] } });
        await open("ada", prefs, gatewayFor(() => "fail"));
        expect(labels()).toEqual(["acme/alpha", "acme/beta"]);
        expect(prefs.data["repositories"]).toEqual({ login: "ada", repos: [A, B] });
    });

    it("never shows the previous person's repositories, even before GitHub answers or when it fails", async () => {
        const prefs = memoryPrefs({ repositories: { login: "ada", repos: [A, B] } });
        await open("bob", prefs, gatewayFor(() => "fail"));
        expect(labels()).toEqual([]);
        expect(prefs.data["repositories"]).toEqual({ login: "ada", repos: [A, B] });
    });

    it("overwrites the previous person's list with the new person's complete list", async () => {
        const prefs = memoryPrefs({ repositories: { login: "ada", repos: [A, B] } });
        await open("bob", prefs, gatewayFor(() => [C]));
        expect(labels()).toEqual(["acme/gamma"]);
        expect(prefs.data["repositories"]).toEqual({ login: "bob", repos: [C] });
    });

    it("reads a malformed kept list as nothing stored", async () => {
        for (const bad of ["x", 4, null, { login: "ada" }, { login: "ada", repos: [1] }, { login: "ada", repos: [{ owner: "a" }] }]) {
            const prefs = memoryPrefs({ repositories: bad });
            await open("ada", prefs, gatewayFor(() => "fail"));
            expect(labels()).toEqual([]);
            unmount?.();
            unmount = undefined;
        }
    });

    it("is neither read nor written by a host with no banner, the extension (G5)", async () => {
        const prefs = memoryPrefs({ repositories: { login: "ada", repos: [A] } });
        const get = vi.spyOn(prefs, "get");
        const set = vi.spyOn(prefs, "set");
        await open("ada", prefs, gatewayFor(() => [B]), false);
        expect(get.mock.calls.map((c) => c[0])).not.toContain("repositories");
        expect(set.mock.calls.map((c) => c[0])).not.toContain("repositories");
    });
});
