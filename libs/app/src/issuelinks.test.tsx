// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";
import { createSessionStore, type SessionStore } from "./session.ts";

const REPO: string = "https://github.com/acme/widgets";

let root: HTMLElement;
let unmount: () => void;
let session: SessionStore;
let fetchSpy: ReturnType<typeof vi.fn>;

async function open(repoUrl: string | undefined = REPO, showIssues: boolean = true): Promise<void> {
    session = createSessionStore();
    await act(async () => {
        unmount = await mountApp(root, {
            session,
            repoUrl,
            prefs: { get: async (k) => (k === "showIssues" ? showIssues : undefined), set: async () => {} },
        });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const refs = (scope: string): HTMLAnchorElement[] => $$<HTMLAnchorElement>(`${scope} a.rd-ref`);

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

describe("issue numbers open the issue on GitHub", () => {
    it("makes every backlog initiative and epic reference a link to its issue", async () => {
        await open();
        const links: HTMLAnchorElement[] = refs(".rd-backlog");
        expect(links.length).toBe(4 + 9);
        expect($('.rd-bl-init[data-num="12"] a.rd-ref').getAttribute("href")).toBe(`${REPO}/issues/12`);
        expect($('.rd-bl-epic[data-num="31"] a.rd-ref').getAttribute("href")).toBe(`${REPO}/issues/31`);
        for (const a of links) {
            expect(a.getAttribute("target")).toBe("_blank");
            expect(a.getAttribute("rel")!.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
        }
    });

    it("makes every goal row reference a link to its issue", async () => {
        await open();
        const links: HTMLAnchorElement[] = refs(".rd-goal-card");
        expect(links.length).toBe(5);
        expect($('.rd-plan-item[data-kind="init"][data-num="14"] a.rd-ref').getAttribute("href")).toBe(
            `${REPO}/issues/14`,
        );
        expect($('.rd-plan-item[data-kind="epic"][data-num="60"] a.rd-ref').getAttribute("href")).toBe(
            `${REPO}/issues/60`,
        );
    });

    it("makes the whole reference, number and title, the link", async () => {
        await open();
        const a: HTMLAnchorElement = $('.rd-bl-epic[data-num="31"] a.rd-ref');
        expect(a.querySelector(".rd-ref__num")!.textContent).toBe("#31");
        expect(a.querySelector(".rd-ref__title")!.textContent).toBe("Sprint goal card");
    });

    it("is a native link, so Enter on focus opens it as a click does", async () => {
        await open();
        const a: HTMLAnchorElement = $('.rd-bl-epic[data-num="31"] a.rd-ref');
        expect(a.tagName).toBe("A");
        expect(a.hasAttribute("href")).toBe(true);
        expect(a.tabIndex).toBe(0);
        a.focus();
        expect(document.activeElement).toBe(a);
    });

    it("leaves the Raiden address, plan, goal order and collapsed initiatives as they were", async () => {
        await open();
        await act(() => $<HTMLButtonElement>('button[aria-label="Hide epics of initiative 13"]').click());
        const before: string = root.innerHTML.replace(/\s+/g, " ");
        const address: string = location.href;
        const state = session.get();
        for (const a of [$<HTMLAnchorElement>('.rd-bl-epic[data-num="31"] a.rd-ref'), $<HTMLAnchorElement>('.rd-plan-item a.rd-ref')]) {
            a.addEventListener("click", (e) => e.preventDefault());
            await act(() => a.click());
        }
        expect(location.href).toBe(address);
        expect(session.get()).toBe(state);
        expect(root.innerHTML.replace(/\s+/g, " ")).toBe(before);
    });

    it("keeps the click from reaching the page's own click handlers", async () => {
        await open();
        const seen = vi.fn();
        document.addEventListener("click", seen);
        const a: HTMLAnchorElement = $('.rd-bl-epic[data-num="31"] a.rd-ref');
        a.addEventListener("click", (e) => e.preventDefault());
        await act(() => a.click());
        document.removeEventListener("click", seen);
        expect(seen).not.toHaveBeenCalled();
    });

    it("still closes an open item menu when a link is clicked", async () => {
        await open();
        await act(() => $<HTMLButtonElement>('button[data-focus-key="item:epic:34"]').click());
        expect($('[role="menu"]')).toBeTruthy();
        const a: HTMLAnchorElement = $('.rd-bl-epic[data-num="31"] a.rd-ref');
        a.addEventListener("click", (e) => e.preventDefault());
        await act(() => a.click());
        expect(root.querySelector('[role="menu"]')).toBeNull();
    });

    it("gives the opened page no handle back, and makes no request or prefetch", async () => {
        await open();
        for (const a of $$<HTMLAnchorElement>("a.rd-ref")) {
            expect(a.getAttribute("rel")).toContain("noopener");
        }
        const a: HTMLAnchorElement = $('.rd-bl-epic[data-num="31"] a.rd-ref');
        a.addEventListener("click", (e) => e.preventDefault());
        await act(() => a.click());
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(root.querySelector('link[rel="prefetch"], link[rel="preload"], link[rel="prerender"]')).toBeNull();
    });

    it("keeps every row draggable and makes no link draggable", async () => {
        await open();
        for (const a of $$<HTMLAnchorElement>("a.rd-ref")) {
            expect(a.getAttribute("draggable")).toBe("false");
        }
        expect($('.rd-bl-epic[data-num="31"]').getAttribute("draggable")).toBe("true");
        expect($('.rd-plan-item[data-num="31"]').getAttribute("draggable")).toBe("true");
    });

    it("drags the row when a drag starts on its issue reference", async () => {
        await open();
        const a: HTMLAnchorElement = $('.rd-bl-epic[data-num="34"] a.rd-ref');
        const data: Record<string, string> = {};
        const event: Event = new Event("dragstart", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
            value: { setData: (t: string, v: string) => (data[t] = v), effectAllowed: "", dropEffect: "" },
        });
        await act(() => void a.dispatchEvent(event));
        expect($('.rd-bl-epic[data-num="34"]').classList.contains("is-dragged")).toBe(true);
        // Only the in-page marker is carried: no link address and no URL.
        expect(Object.keys(data)).toEqual(["application/x-raiden"]);
    });

    it("shows no issue rows and no links, only the pick prompt, when no repository is known (G3)", async () => {
        session = createSessionStore();
        await act(async () => {
            unmount = await mountApp(root, { session });
        });
        expect($$("a[href]").length).toBe(0);
        expect($$(".rd-ref").length).toBe(0);
        expect($(".rd-pick-prompt").textContent).toContain("Pick a repository");
    });

    it("shows no goal rows and so no goal links while Show issues is off", async () => {
        await open(REPO, false);
        expect(refs(".rd-goal-card").length).toBe(0);
        expect(refs(".rd-backlog").length).toBe(13);
    });

    it("keeps links after a plan change", async () => {
        await open();
        await act(() => $<HTMLButtonElement>('button[aria-label="Take epic #31 out of Goal 1"]').click());
        expect(refs(".rd-goal-card").length).toBe(4);
        expect(refs(".rd-goal-card").every((a) => a.getAttribute("href")!.startsWith(`${REPO}/issues/`))).toBe(true);
    });
});
