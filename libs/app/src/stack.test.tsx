// @vitest-environment jsdom
// Story #92: the columns stack under 760px (D11, G33, G34).
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub } from "./testing/fakegraph.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const SYNC = {
    source: { project: "P", field: "F" },
    sprints: [{ id: "F#a", field: "F", iteration: "a", name: "Sprint a", start: "2030-01-01", end: "2030-01-14", origin: "github" }],
};
const CSS_TEXT: string = readFileSync(fileURLToPath(new NodeURL("./app.css", import.meta.url)), "utf8");

let root: HTMLElement;
let unmount: (() => void) | undefined;
let stored: Record<string, unknown>;
let prefs: PreferenceStore;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    stored = {};
    prefs = { get: async (k: string) => stored[k], set: async (k: string, v: unknown) => void (stored[k] = v) };
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
});

async function openAt(width: number): Promise<void> {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            gateway: fakeGitHub({ issues: [{ n: 1, title: "A very long title ".repeat(20), sprints: [["P", "F", "a"]] }], sync: SYNC }),
            repo: createRepoStore(WIDGETS),
        });
    });
    for (let i = 0; i < 8; i++) {
        await flush();
    }
}

const band = (): HTMLElement => root.querySelector<HTMLElement>('.rd-band[data-sprint="F#a"]')!;
const order = (el: HTMLElement): string[] =>
    Array.from(el.children, (c) => (c.classList.contains("rd-band__card") ? "card" : c.classList.contains("rd-band__rows") ? "rows" : "?"));

describe("stacking (story #92)", () => {
    it("stacks the columns below 760px, each band's card above its rows (AC1, G34, G43)", async () => {
        await openAt(759);
        expect(root.querySelector(".rd-bands")!.classList.contains("rd-bands--stacked")).toBe(true);
        expect(order(band())).toEqual(["card", "rows"]);
        expect(root.querySelector(".rd-divider")).toBeNull();
    });

    it("sets the columns side by side at 760px and wider, with the divider (AC2, G33)", async () => {
        await openAt(760);
        expect(root.querySelector(".rd-bands")!.classList.contains("rd-bands--stacked")).toBe(false);
        // The same order as stacked, so nothing is reordered on screen (D11, G43).
        expect(order(band())).toEqual(["card", "rows"]);
        expect(CSS_TEXT).toMatch(/\.rd-band__card[^{]*\{[^}]*grid-column: 1/);
        expect(CSS_TEXT).toMatch(/\.rd-band__rows[^{]*\{[^}]*grid-column: 3/);
        expect(root.querySelector(".rd-divider")).not.toBeNull();
    });

    it("restacks when the window narrows", async () => {
        await openAt(1200);
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
        await act(async () => void window.dispatchEvent(new Event("resize")));
        expect(root.querySelector(".rd-bands--stacked")).not.toBeNull();
    });

    it("never scrolls sideways at 360px: stacked bands take the full width and long text wraps (AC3, G34)", async () => {
        await openAt(360);
        expect(root.querySelector(".rd-bands--stacked")).not.toBeNull();
        expect(CSS_TEXT).toMatch(/\.rd-bands--stacked \.rd-band[^{]*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
        expect(CSS_TEXT).toMatch(/\.rd-bands \.rd-ref__title[^{]*\{[^}]*overflow-wrap: anywhere/);
        expect(CSS_TEXT).toMatch(/\.rd-bands \.rd-lb-head[^{]*\{[^}]*flex-wrap: wrap/);
        expect(band().style.getPropertyValue("width")).toBe("");
    });

    it("keeps the expanded sidebar out of the page's width below 760px: it overlays the page (G34)", async () => {
        await openAt(360);
        // The sidebar is expanded by default.
        expect(root.querySelector(".rd-nav")!.classList.contains("rd-nav--collapsed")).toBe(false);
        const narrow: string | undefined = CSS_TEXT.match(/@media \(max-width: 759\.98px\) \{([\s\S]*?)\n\}/)?.[1];
        expect(narrow).toBeDefined();
        // The expanded sidebar leaves the flow and floats over the page.
        expect(narrow).toMatch(/\.rd-nav:not\(\.rd-nav--collapsed\)[^{]*\{[^}]*position: absolute/);
        // The page keeps only the collapsed rail's width beside it, the same in both states.
        expect(narrow).toMatch(/\.rd-nav:not\(\.rd-nav--collapsed\) \+ \.rd-main[^{]*\{[^}]*margin-left: 56px/);
    });
});
