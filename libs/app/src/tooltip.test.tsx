// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";

let root: HTMLElement;
let unmount: () => void;

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { repoUrl: "https://github.com/acme/widgets" });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const item = (name: string): HTMLButtonElement =>
    $$<HTMLButtonElement>(".rd-nav-item").find((b) => b.dataset["label"] === name)!;
const tips = (): HTMLElement[] => $$<HTMLElement>(".rd-tooltip");
const hover = (el: Element): Promise<void> => act(() => void el.dispatchEvent(new MouseEvent("mouseenter")));
const leave = (el: Element): Promise<void> => act(() => void el.dispatchEvent(new MouseEvent("mouseleave")));
const focus = (el: HTMLElement): Promise<void> => act(() => el.focus());
const blur = (el: HTMLElement): Promise<void> => act(() => el.blur());
const escape = (): Promise<void> =>
    act(() => void document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true })));
const css: string = readFileSync(resolve(import.meta.dirname, "../../design-system/components.css"), "utf8");

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
});
afterEach(() => {
    unmount?.();
    root.remove();
});

describe("sidebar tooltips", () => {
    it("show nothing until the pointer or focus arrives", async () => {
        await open();
        expect(tips().length).toBe(0);
    });

    it("show the page name when the pointer is over an item", async () => {
        await open();
        for (const name of ["Sprint goal", "Timeline", "Settings"]) {
            await hover(item(name).parentElement!);
            expect(tips().map((t) => t.textContent)).toEqual([name]);
            await leave(item(name).parentElement!);
        }
    });

    it("show the page name when an item has keyboard focus", async () => {
        await open();
        await focus(item("Timeline"));
        expect(tips().map((t) => t.textContent)).toEqual(["Timeline"]);
    });

    it("are gone when the pointer leaves", async () => {
        await open();
        await hover(item("Settings").parentElement!);
        await leave(item("Settings").parentElement!);
        expect(tips().length).toBe(0);
    });

    it("are gone when focus leaves", async () => {
        await open();
        await focus(item("Settings"));
        await blur(item("Settings"));
        expect(tips().length).toBe(0);
    });

    it("stay while the pointer is gone but focus remains, and the reverse", async () => {
        await open();
        await focus(item("Settings"));
        await hover(item("Settings").parentElement!);
        await leave(item("Settings").parentElement!);
        expect(tips().length).toBe(1);
        await blur(item("Settings"));
        expect(tips().length).toBe(0);
    });

    it("hide on Escape, and show again after the pointer or focus comes back", async () => {
        await open();
        await focus(item("Timeline"));
        await escape();
        expect(tips().length).toBe(0);
        await blur(item("Timeline"));
        await focus(item("Timeline"));
        expect(tips().length).toBe(1);
    });

    // Story #104, G22: the Grooming item carries no count, so its tooltip is its name alone.
    it("show only the page name on Grooming", async () => {
        await open();
        await focus(item("Grooming"));
        expect(tips()[0]!.textContent).toBe("Grooming");
        expect(item("Grooming").querySelector(".rd-nav-item__count")).toBeNull();
    });

    it("also show while the sidebar is collapsed", async () => {
        await open();
        await act(() => $<HTMLButtonElement>(".rd-nav__toggle").click());
        await focus(item("Settings"));
        expect(tips().map((t) => t.textContent)).toEqual(["Settings"]);
    });

    it("are hidden from assistive technology, so nothing is announced twice", async () => {
        await open();
        await focus(item("Grooming"));
        const tip: HTMLElement = tips()[0]!;
        expect(tip.getAttribute("aria-hidden")).toBe("true");
        expect(tip.getAttribute("role")).toBeNull();
        expect(item("Grooming").getAttribute("aria-label")).toBe("Grooming");
        expect(item("Grooming").hasAttribute("aria-describedby")).toBe(false);
    });

    it("never take focus", async () => {
        await open();
        await focus(item("Timeline"));
        expect(document.activeElement).toBe(item("Timeline"));
        const tip: HTMLElement = tips()[0]!;
        expect(tip.hasAttribute("tabindex")).toBe(false);
        expect(tip.querySelector("a, button, input, [tabindex]")).toBeNull();
        await hover(item("Settings").parentElement!);
        expect(document.activeElement).toBe(item("Timeline"));
    });

    it("never stop a click on what lies under them", async () => {
        await open();
        await hover(item("Timeline").parentElement!);
        expect(css).toMatch(/\.rd-tooltip\s*\{[^}]*pointer-events:\s*none/);
        await act(() => item("Timeline").click());
        expect(item("Timeline").getAttribute("aria-current")).toBe("page");
    });
});

describe("tooltip in the design system", () => {
    const block: string = css.match(/\.rd-tooltip\s*\{[^}]*\}/)![0];

    it("is styled with design-system tokens only", () => {
        expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(block).not.toMatch(/\brgba?\(/);
        expect(block).toContain("var(--rd-");
    });

    it("has its own guideline page", () => {
        const page: string = readFileSync(resolve(import.meta.dirname, "../../design-system/components/Tooltip.md"), "utf8");
        expect(page).toMatch(/^# Tooltip/);
        expect(page).toContain("rd-tooltip");
        expect(page).toContain("Escape");
    });

    it("replaces the rail's own name bubble, so one control draws every tooltip", () => {
        expect(css).not.toContain(".rd-nav-item::after");
    });

    it("makes no network request", async () => {
        const spy = vi.fn();
        vi.stubGlobal("fetch", spy);
        await open();
        await focus(item("Grooming"));
        expect(spy).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
