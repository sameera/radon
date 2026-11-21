// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createSessionStore } from "./session.ts";

let root: HTMLElement;
let unmount: () => void;
let fetchSpy: ReturnType<typeof vi.fn>;
let stored: Record<string, unknown>;
let prefs: PreferenceStore;
const set = vi.fn<(key: string, value: unknown) => Promise<void>>();

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { prefs, session: createSessionStore() });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const meta = (kind: string, num: number): string =>
    $(`.rd-bl-${kind}[data-num="${num}"] .rd-bl-meta`).textContent!.trim();
const card = (n: number): HTMLElement => $$<HTMLElement>(".rd-goal-card")[n]!;
const planItems = (n: number): string[] =>
    Array.from(card(n).querySelectorAll<HTMLElement>(".rd-plan-item")).map((e) => `${e.dataset.kind}:${e.dataset.num}`);

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    stored = {};
    set.mockReset();
    set.mockImplementation(async (key, value) => {
        stored[key] = value;
    });
    prefs = { get: async (key: string) => stored[key], set };
});
afterEach(() => {
    unmount();
    root.remove();
    vi.unstubAllGlobals();
});

describe("header", () => {
    it("shows sprint, title, instruction, planned count, save state and Save plan", async () => {
        await open();
        expect($(".rd-groom__eyebrow").textContent).toContain("Sprint 15");
        expect($(".rd-groom__eyebrow").textContent).toContain("Dec 1 – Dec 12");
        expect($("h1").textContent).toBe("Backlog grooming");
        expect($(".rd-groom__instruction").textContent!.length).toBeGreaterThan(20);
        expect($(".rd-groom__summary").textContent).toBe("5 of 9 epics planned");
        expect($(".rd-groom__save-state").textContent!.length).toBeGreaterThan(0);
        expect($$<HTMLButtonElement>("button").some((b) => b.textContent === "Save plan")).toBe(true);
    });
});

describe("backlog panel", () => {
    it("nests each initiative's epics under its number and title", async () => {
        await open();
        const inits: HTMLElement[] = $$(".rd-bl-init");
        expect(inits.length).toBe(4);
        expect(inits[0]!.querySelector(".rd-ref__num")!.textContent).toBe("#12");
        expect(inits[0]!.textContent).toContain("Sprint planning in Projects");
        expect(inits[0]!.querySelectorAll(".rd-bl-epic").length).toBe(2);
        expect(inits[1]!.querySelectorAll(".rd-bl-epic").length).toBe(3);
    });

    it("hides and shows an initiative's epics", async () => {
        await open();
        const chevron = (): HTMLButtonElement => $(`.rd-bl-init[data-num="13"] .rd-icon-btn`);
        expect(chevron().getAttribute("aria-expanded")).toBe("true");
        await act(() => chevron().click());
        expect($$(`.rd-bl-init[data-num="13"] .rd-bl-epic`).length).toBe(0);
        expect(chevron().getAttribute("aria-expanded")).toBe("false");
        await act(() => chevron().click());
        expect($$(`.rd-bl-init[data-num="13"] .rd-bl-epic`).length).toBe(3);
    });

    it("shows the goal a planned item is planned in, and how many epics of a partly planned initiative", async () => {
        await open();
        expect(meta("epic", 31)).toBe("Goal 1");
        expect(meta("epic", 50)).toBe("Goal 1");
        expect(meta("epic", 51)).toBe("Goal 2");
        expect(meta("init", 14)).toBe("Goal 2");
        expect(meta("init", 12)).toBe("1 of 2 epics planned");
        expect(meta("init", 13)).toBe("1 of 3 epics planned");
        expect(meta("epic", 34)).toBe("");
        expect(meta("init", 15)).toBe("1 of 2 epics planned");
    });
});

describe("goals panel", () => {
    it("shows rank, name, description, epic count and planned items", async () => {
        await open();
        expect($$(".rd-goal-card").length).toBe(3);
        expect(card(0).querySelector(".rd-goal-card__rank")!.textContent).toBe("1");
        expect(card(2).querySelector(".rd-goal-card__rank")!.textContent).toBe("3");
        expect(card(0).querySelector<HTMLInputElement>("input.rd-input")!.value).toContain("Pilot team");
        expect(card(0).querySelector<HTMLTextAreaElement>("textarea.rd-input")!.value.length).toBeGreaterThan(10);
        expect(card(0).querySelector(".rd-goal-card__count")!.textContent).toBe("3 epics");
        expect(card(1).querySelector(".rd-goal-card__count")!.textContent).toBe("2 epics");
        expect(planItems(0)).toEqual(["epic:31", "epic:40", "epic:50"]);
        expect(planItems(1)).toEqual(["init:14", "epic:60"]);
    });

    it("shows a drop hint only on a goal with no items", async () => {
        await open();
        expect(card(0).querySelector(".rd-goal-card__drop")).toBeNull();
        expect(card(1).querySelector(".rd-goal-card__drop")).toBeNull();
        expect(card(2).querySelector(".rd-goal-card__drop")).not.toBeNull();
        expect(card(2).querySelector(".rd-goal-card__count")!.textContent).toBe("0 epics");
    });
});

describe("Show issues", () => {
    const toggle = (): HTMLInputElement => $("input[role=\"switch\"]");

    it("is on at first, and turning it off keeps counts and hides items", async () => {
        await open();
        expect(toggle().checked).toBe(true);
        await act(() => toggle().click());
        expect($$(".rd-plan-item").length).toBe(0);
        expect(card(0).querySelector(".rd-goal-card__count")!.textContent).toBe("3 epics");
        expect(card(1).textContent).toContain("1 initiative");
        expect(card(2).querySelector(".rd-goal-card__drop")).not.toBeNull();
        expect(set).toHaveBeenCalledWith("showIssues", false);
    });

    it("is kept after a reload, and is read before the first render", async () => {
        await open();
        await act(() => toggle().click());
        unmount();
        await open();
        expect(toggle().checked).toBe(false);
        expect($$(".rd-plan-item").length).toBe(0);
    });
});

describe("no network", () => {
    it("sends no request when the page opens or Save plan is selected", async () => {
        await open();
        const save: HTMLButtonElement = $$<HTMLButtonElement>("button").find((b) => b.textContent === "Save plan")!;
        await act(() => save.click());
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
        expect(root.querySelectorAll("a[href]").length).toBe(0);
    });
});
