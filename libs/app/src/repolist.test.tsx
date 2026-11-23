// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubRequest, GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "./gateway.ts";
import { mountApp } from "./mount.tsx";
import { createRepoStore, type RepoStore } from "./repo.tsx";
import { loadReachable } from "./repolist.ts";
import { createSignInController, type SignInController, type SignInPort } from "./signin.ts";
import { createSessionStore } from "./session.ts";

function repoRow(owner: string, name: string): unknown {
    return { name, owner: { login: owner }, html_url: `https://github.com/${owner}/${name}` };
}

// A fake GitHub: installations 1 and 2, each with its own repositories, served 100 at a time.
function fakeGitHub(
    installs: Record<number, [string, string][]>,
    fail?: (request: GitHubRequest) => GitHubResult | undefined,
): { gateway: GitHubGateway; calls: GitHubRequest[] } {
    const calls: GitHubRequest[] = [];
    const gateway: GitHubGateway = {
        async request(request) {
            calls.push(request);
            const failed = fail?.(request);
            if (failed) {
                return failed;
            }
            const page = Number(request.query?.page ?? "1");
            const per = Number(request.query?.per_page ?? "30");
            if (request.path === "/user/installations") {
                const ids = Object.keys(installs).map(Number);
                return {
                    ok: true,
                    status: 200,
                    body: { total_count: ids.length, installations: ids.slice((page - 1) * per, page * per).map((id) => ({ id })) },
                };
            }
            const m = /^\/user\/installations\/(\d+)\/repositories$/.exec(request.path);
            const rows = installs[Number(m![1])] ?? [];
            return {
                ok: true,
                status: 200,
                body: { total_count: rows.length, repositories: rows.slice((page - 1) * per, page * per).map(([o, n]) => repoRow(o, n)) },
            };
        },
    };
    return { gateway, calls };
}

describe("loadReachable (D4, G7, G15)", () => {
    it("lists every repository of every installation, sorted by owner and name", async () => {
        const { gateway } = fakeGitHub({ 1: [["zeta", "b"], ["acme", "widgets"]], 2: [["acme", "gadgets"]] });
        const result = await loadReachable(gateway);
        expect(result.complete).toBe(true);
        expect(result.repos.map((r) => `${r.owner}/${r.name}`)).toEqual(["acme/gadgets", "acme/widgets", "zeta/b"]);
        expect(result.repos[0]).toEqual({ owner: "acme", name: "gadgets", url: "https://github.com/acme/gadgets" });
    });

    it("reads every page of an account with several hundred repositories", async () => {
        const many: [string, string][] = Array.from({ length: 350 }, (_, i) => ["acme", `r${String(i).padStart(3, "0")}`]);
        const { gateway, calls } = fakeGitHub({ 1: many, 2: [["beta", "x"]] });
        const result = await loadReachable(gateway);
        expect(result.complete).toBe(true);
        expect(result.repos.length).toBe(351);
        expect(calls.filter((c) => c.path === "/user/installations/1/repositories").length).toBe(4);
    });

    it("asks only for GET requests on GitHub's API, with no token of its own", async () => {
        const { gateway, calls } = fakeGitHub({ 1: [["acme", "a"]] });
        await loadReachable(gateway);
        expect(calls.every((c) => (c.method ?? "GET") === "GET" && c.path.startsWith("/user/installations"))).toBe(true);
        expect(JSON.stringify(calls)).not.toMatch(/token|authorization/i);
    });

    it("is incomplete when any request fails, and says nothing it cannot vouch for", async () => {
        const { gateway } = fakeGitHub({ 1: [["acme", "a"]], 2: [["acme", "b"]] }, (r) =>
            r.path === "/user/installations/2/repositories" ? { ok: false, kind: "rate-limit" } : undefined,
        );
        const result = await loadReachable(gateway);
        expect(result.complete).toBe(false);
    });

    it("is incomplete when a page comes back short of the reported total", async () => {
        const gateway: GitHubGateway = {
            async request(request) {
                if (request.path === "/user/installations") {
                    return { ok: true, status: 200, body: { total_count: 1, installations: [{ id: 1 }] } };
                }
                const first = request.query?.page === "1";
                return { ok: true, status: 200, body: { total_count: 5, repositories: first ? [repoRow("acme", "a")] : [] } };
            },
        };
        expect((await loadReachable(gateway)).complete).toBe(false);
    });

    it("is incomplete when the answer is not the shape GitHub documents", async () => {
        const gateway: GitHubGateway = { request: async () => ({ ok: true, status: 200, body: "nope" }) };
        expect((await loadReachable(gateway)).complete).toBe(false);
    });
});

let root: HTMLElement;
let unmount: (() => void) | undefined;
const port = (login: string | null): SignInPort => ({ status: async () => login, signIn: async () => (login ? { login } : null) });
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

async function open(opts: { login: string | null; gateway?: GitHubGateway; repo?: RepoStore; banner?: boolean }): Promise<SignInController> {
    const signIn = createSignInController(port(opts.login));
    await act(async () => {
        unmount = await mountApp(root, {
            session: createSessionStore(),
            signIn,
            gateway: opts.gateway,
            repo: opts.repo ?? createRepoStore(null),
            banner: opts.banner === false ? undefined : { icon: "i.png" },
        });
    });
    await flush();
    await flush();
    return signIn;
}
const select = (): HTMLSelectElement | null => root.querySelector<HTMLSelectElement>(".rd-banner select");
const labels = (): string[] => Array.from(select()!.querySelectorAll("option")).map((o) => o.textContent!);

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

describe("repository drop-down in the banner (D5, G6, G8)", () => {
    it("sits beside the Raiden mark and word for a signed-in person", async () => {
        const { gateway } = fakeGitHub({ 1: [["acme", "widgets"]] });
        await open({ login: "ada", gateway });
        const banner = root.querySelector(".rd-banner")!;
        const kids = Array.from(banner.children).map((e) => e.className);
        expect(kids[0]).toContain("rd-banner__mark");
        expect(kids[1]).toContain("rd-banner__word");
        expect(select()).not.toBeNull();
        expect(select()!.getAttribute("aria-label")).toBe("Repository");
    });

    it("lists the reachable repositories as owner/name", async () => {
        const { gateway } = fakeGitHub({ 1: [["acme", "widgets"]], 2: [["acme", "gadgets"]] });
        await open({ login: "ada", gateway });
        expect(labels().filter((l) => l.includes("/"))).toEqual(["acme/gadgets", "acme/widgets"]);
    });

    it("lists all several hundred repositories", async () => {
        const many: [string, string][] = Array.from({ length: 420 }, (_, i) => ["acme", `r${i}`]);
        const { gateway } = fakeGitHub({ 1: many });
        await open({ login: "ada", gateway });
        expect(labels().filter((l) => l.includes("/")).length).toBe(420);
    });

    it("makes the picked repository the current repository", async () => {
        const { gateway } = fakeGitHub({ 1: [["acme", "widgets"], ["acme", "gadgets"]] });
        const repo = createRepoStore(null);
        await open({ login: "ada", gateway, repo });
        expect(root.querySelector(".rd-pick-prompt")).not.toBeNull();
        await act(() => {
            select()!.value = "acme/gadgets";
            select()!.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(repo.get()).toEqual({ owner: "acme", name: "gadgets", url: "https://github.com/acme/gadgets" });
        expect(root.querySelector(".rd-groom")).not.toBeNull();
        expect(select()!.value).toBe("acme/gadgets");
    });

    it("shows neither the banner nor its drop-down when signed out", async () => {
        const { gateway } = fakeGitHub({ 1: [["acme", "widgets"]] });
        await open({ login: null, gateway });
        expect(root.querySelector(".rd-banner")).toBeNull();
        expect(select()).toBeNull();
    });

    it("shows no drop-down in a host with no banner, and makes no listing request", async () => {
        const { gateway, calls } = fakeGitHub({ 1: [["acme", "widgets"]] });
        await open({ login: "ada", gateway, banner: false, repo: createRepoStore({ owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" }) });
        expect(root.querySelector("select")).toBeNull();
        expect(calls.length).toBe(0);
    });
});
