// @vitest-environment jsdom
import { render, type VNode } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";
import { createRepoStore, repoFromUrl, useRepo, RepoContext, type RepoStore } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub } from "./testing/fakegraph.ts";

async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
        await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
    }
}

const ACME = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const OTHER = { owner: "acme", name: "gadgets", url: "https://github.com/acme/gadgets" };

let root: HTMLElement;
let unmount: (() => void) | undefined;
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

function Leaf(): VNode {
    const repo = useRepo();
    return <b class="leaf">{repo ? `${repo.owner}/${repo.name}` : "none"}</b>;
}
function Nest({ depth }: { depth: number }): VNode {
    return depth === 0 ? <Leaf /> : <div><Nest depth={depth - 1} /></div>;
}
const leaf = (): string => root.querySelector(".leaf")!.textContent!;

describe("repository context (D1, G1, G2)", () => {
    it("gives a component three levels down the owner and name the host supplied, with no parent passing them", async () => {
        const store: RepoStore = createRepoStore(ACME);
        await act(() => render(<RepoContext.Provider value={store}><Nest depth={3} /></RepoContext.Provider>, root));
        expect(leaf()).toBe("acme/widgets");
    });

    it("shows the new repository without a reload when the host changes it", async () => {
        const store: RepoStore = createRepoStore(ACME);
        await act(() => render(<RepoContext.Provider value={store}><Nest depth={3} /></RepoContext.Provider>, root));
        await act(() => store.set(OTHER));
        expect(leaf()).toBe("acme/gadgets");
        await act(() => store.set(null));
        expect(leaf()).toBe("none");
    });

    it("reads \"none\" with no store above it", async () => {
        await act(() => render(<Leaf />, root));
        expect(leaf()).toBe("none");
    });

    it("works the owner and name out of a repository address", () => {
        expect(repoFromUrl("https://github.com/acme/widgets/")).toEqual(ACME);
        expect(repoFromUrl("https://github.example.com/acme/app")).toEqual({
            owner: "acme",
            name: "app",
            url: "https://github.example.com/acme/app",
        });
        expect(repoFromUrl(undefined)).toBeNull();
        expect(repoFromUrl("not a url")).toBeNull();
        expect(repoFromUrl("https://github.com/acme")).toBeNull();
    });
});

describe("shell with the repository context (D2, G3)", () => {
    it("shows the page for the host's repository and updates links when it changes", async () => {
        const store: RepoStore = createRepoStore(ACME);
        // Story #104: Grooming needs a live connection, so the page opens signed in.
        await act(async () => {
            unmount = await mountApp(root, {
                repo: store,
                gateway: fakeGitHub({ issues: [{ n: 31, title: "One" }] }),
                signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            });
        });
        await settle();
        expect(root.querySelector(".rd-groom")).not.toBeNull();
        expect(root.querySelector(".rd-pick-prompt")).toBeNull();
        const href = (): string => root.querySelector<HTMLAnchorElement>("a.rd-backlog__new")!.getAttribute("href")!;
        expect(href()).toBe("https://github.com/acme/widgets/issues/new");
        await act(() => store.set(OTHER));
        await settle();
        expect(href()).toBe("https://github.com/acme/gadgets/issues/new");
    });

    it("asks the person to pick a repository, above every page, when none is chosen", async () => {
        const store: RepoStore = createRepoStore(null);
        await act(async () => {
            unmount = await mountApp(root, { repo: store });
        });
        expect(root.querySelector(".rd-pick-prompt")!.textContent).toContain("Pick a repository");
        expect(root.querySelector(".rd-groom")).toBeNull();
        expect(root.querySelector(".rd-nav")).not.toBeNull();
        await act(() => store.set(ACME));
        expect(root.querySelector(".rd-groom")).not.toBeNull();
        expect(root.querySelector(".rd-pick-prompt")).toBeNull();
    });
});
