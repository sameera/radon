// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";
import { createRepoStore, repoFromUrl } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub } from "./testing/fakegraph.ts";

const REPO: string = "https://github.com/acme/widgets";

let root: HTMLElement;
let unmount: () => void;
let fetchSpy: ReturnType<typeof vi.fn>;

// Story #104: the link lives in the band view, so the page opens signed in with a live connection.
async function open(repoUrl: string | undefined = REPO): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, {
            repo: createRepoStore(repoFromUrl(repoUrl)),
            gateway: fakeGitHub({ issues: [{ n: 1, title: "One" }] }),
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
        });
    });
    for (let i = 0; i < 8; i++) {
        await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
    }
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const link = (): HTMLAnchorElement | null =>
    root.querySelector<HTMLAnchorElement>("a.rd-backlog__new");

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
    unmount?.();
    root.remove();
    vi.unstubAllGlobals();
});

describe("New initiative in GitHub link", () => {
    it("sits in the band view's tool row, above the bands", async () => {
        await open();
        const a: HTMLAnchorElement = link()!;
        expect(a).toBeTruthy();
        expect(a.textContent!.trim()).toBe("New initiative in GitHub");
        expect($(".rd-bands__tools").contains(a)).toBe(true);
    });

    it("opens the create-issue page of the current repository in a new tab", async () => {
        await open();
        const a: HTMLAnchorElement = link()!;
        expect(a.getAttribute("href")).toBe(`${REPO}/issues/new`);
        expect(a.getAttribute("target")).toBe("_blank");
        const rel: string[] = a.getAttribute("rel")!.split(" ");
        expect(rel).toContain("noopener");
        expect(rel).toContain("noreferrer");
    });

    it("has no template or label preset in its address", async () => {
        await open();
        expect(new URL(link()!.href).search).toBe("");
    });

    it("leaves the Raiden page and its address as they were", async () => {
        await open();
        const before: string = root.innerHTML.replace(/\s+/g, " ");
        const address: string = location.href;
        const a: HTMLAnchorElement = link()!;
        a.addEventListener("click", (e) => e.preventDefault());
        await act(() => a.click());
        expect(location.href).toBe(address);
        expect(root.innerHTML.replace(/\s+/g, " ")).toBe(before);
    });

    it("keeps the click from reaching the page's own click handlers", async () => {
        await open();
        const seen = vi.fn();
        document.addEventListener("click", seen);
        const a: HTMLAnchorElement = link()!;
        a.addEventListener("click", (e) => e.preventDefault());
        await act(() => a.click());
        document.removeEventListener("click", seen);
        expect(seen).not.toHaveBeenCalled();
    });

    it("is not draggable", async () => {
        await open();
        expect(link()!.getAttribute("draggable")).toBe("false");
    });

    it("makes no network request and adds no prefetch or preload", async () => {
        await open();
        await act(() => {
            const a: HTMLAnchorElement = link()!;
            a.addEventListener("click", (e) => e.preventDefault());
            a.click();
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(document.querySelector('link[rel="prefetch"], link[rel="preload"], link[rel="prerender"]')).toBeNull();
        expect(root.querySelector('link[rel="prefetch"], link[rel="preload"], link[rel="prerender"]')).toBeNull();
    });

    it("is not shown when no repository is known; the page asks for one instead (G3)", async () => {
        await open("");
        expect(link()).toBeNull();
        expect(root.textContent).not.toContain("New initiative in GitHub");
        expect(root.querySelector(".rd-pick-prompt")).not.toBeNull();
    });

    it("stays while the backlog filter hides every row", async () => {
        await open();
        const input: HTMLInputElement = $('input[aria-label="Filter backlog"]');
        await act(() => {
            input.value = "zzz";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(link()).toBeTruthy();
    });

    it("drops the trailing slash of the repository address", async () => {
        await open(`${REPO}/`);
        expect(link()!.getAttribute("href")).toBe(`${REPO}/issues/new`);
    });
});
