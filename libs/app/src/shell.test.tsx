// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp, type PreferenceStore } from "./mount.tsx";

let root: HTMLElement;
let unmount: () => void;
let fetchSpy: ReturnType<typeof vi.fn>;

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { css: ".x{}" });
    });
}
const text = (): string => root.textContent ?? "";
const items = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(".rd-nav-item"));
const item = (label: string): HTMLElement => items().find((e: HTMLElement) => e.textContent?.includes(label))!;
const current = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(".rd-nav-item[aria-current=\"page\"]"));

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
    unmount();
    root.remove();
    vi.unstubAllGlobals();
});

describe("sidebar", () => {
    it("shows the Raiden name, the project name, the groups and Settings", async () => {
        await open();
        expect(root.querySelector(".rd-nav__word")!.textContent).toBe("Raiden");
        expect(root.querySelector(".rd-nav__proj")!.textContent).toBe("Raiden roadmap");
        const groups: string[] = Array.from(root.querySelectorAll(".rd-nav__group")).map((e: Element) => e.textContent!);
        expect(groups).toEqual(["Sprint", "Roadmap"]);
        expect(items().map((e: HTMLElement) => e.textContent!.trim())).toEqual([
            "Sprint goal",
            "Grooming",
            "Timeline",
            "Settings",
        ]);
    });

    it("shows the current sprint, the days until it ends and the next sprint", async () => {
        await open();
        const foot: string = root.querySelector(".rd-nav__foot")!.textContent!;
        expect(foot).toContain("Sprint 14");
        expect(foot).toContain("ends in 7 days");
        expect(foot).toContain("Next: Sprint 15, Dec 1 – Dec 12");
    });

    it("opens on Grooming and marks only the selected item as the current page", async () => {
        await open();
        expect(current().map((e: HTMLElement) => e.textContent!.trim())).toEqual(["Grooming"]);
        for (const label of ["Timeline", "Settings", "Sprint goal"]) {
            await act(() => item(label).click());
            expect(current().length).toBe(1);
            expect(current()[0]).toBe(item(label));
        }
    });

    it("shows a title and a short placeholder for Sprint goal, Timeline and Settings", async () => {
        await open();
        for (const label of ["Sprint goal", "Timeline", "Settings"]) {
            await act(() => item(label).click());
            expect(root.querySelector("h1")!.textContent).toBe(label);
            expect(root.querySelector(".rd-page__placeholder")!.textContent!.length).toBeGreaterThan(10);
        }
    });

    it("switches pages without a reload, an address change or a network request", async () => {
        const before: string = location.href;
        await open();
        await act(() => item("Timeline").click());
        expect(location.href).toBe(before);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe("mounting", () => {
    it("wraps the app in rd-root, loads the styles it is given, and removes everything on unmount", async () => {
        await open();
        expect(root.querySelector(".rd-root")).not.toBeNull();
        expect(root.querySelector("style")!.textContent).toBe(".x{}");
        unmount();
        expect(root.children.length).toBe(0);
        unmount = () => {};
    });
});

describe("collapsible sidebar", () => {
    let stored: Record<string, unknown>;
    let prefs: PreferenceStore;
    const toggle = (): HTMLButtonElement => root.querySelector<HTMLButtonElement>(".rd-nav__toggle")!;
    const nav = (): HTMLElement => root.querySelector<HTMLElement>("nav.rd-nav")!;
    async function openWithPrefs(): Promise<void> {
        await act(async () => {
            unmount = await mountApp(root, { prefs });
        });
    }
    beforeEach(() => {
        stored = {};
        prefs = {
            get: async (key: string) => stored[key],
            set: async (key: string, value: unknown) => {
                stored[key] = value;
            },
        };
    });

    it("starts expanded, with a button that says what it will do and whether the sidebar is expanded", async () => {
        await openWithPrefs();
        expect(nav().classList.contains("rd-nav--collapsed")).toBe(false);
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        expect(toggle().getAttribute("aria-label")).toBe("Collapse sidebar");
    });

    it("collapses to a rail and expands again with its labels", async () => {
        await openWithPrefs();
        await act(() => toggle().click());
        expect(nav().classList.contains("rd-nav--collapsed")).toBe(true);
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        expect(toggle().getAttribute("aria-label")).toBe("Expand sidebar");
        await act(() => toggle().click());
        expect(nav().classList.contains("rd-nav--collapsed")).toBe(false);
        expect(items().map((e) => e.textContent!.trim())).toEqual(["Sprint goal", "Grooming", "Timeline", "Settings"]);
    });

    it("keeps each item's accessible name and its name for hover and focus in the rail", async () => {
        await openWithPrefs();
        await act(() => toggle().click());
        expect(items().map((e) => e.getAttribute("aria-label"))).toEqual(["Sprint goal", "Grooming", "Timeline", "Settings"]);
        expect(items().map((e) => e.getAttribute("data-label"))).toEqual(["Sprint goal", "Grooming", "Timeline", "Settings"]);
    });

    it("keeps the choice through the preference store and reads it before the first render", async () => {
        await openWithPrefs();
        await act(() => toggle().click());
        expect(stored["sidebarCollapsed"]).toBe(true);
        unmount();
        await openWithPrefs();
        expect(nav().classList.contains("rd-nav--collapsed")).toBe(true);
        await act(() => toggle().click());
        expect(stored["sidebarCollapsed"]).toBe(false);
    });

    it("uses no network request, and the rail styling lives in the design system", async () => {
        await openWithPrefs();
        await act(() => toggle().click());
        expect(fetchSpy).not.toHaveBeenCalled();
        const componentsCss: string = readFileSync(resolve(import.meta.dirname, "../../design-system/components.css"), "utf8");
        expect(componentsCss).toContain(".rd-nav--collapsed");
    });
});
