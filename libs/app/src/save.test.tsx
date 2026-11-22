// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";
import { createSessionStore, type SessionStore } from "./session.ts";
import { INITIATIVES } from "./sample.ts";
import { planItem } from "./plan.ts";

let root: HTMLElement;
let unmount: () => void;
let fetchSpy: ReturnType<typeof vi.fn>;
let session: SessionStore;

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { session, repoUrl: "https://github.com/acme/widgets" });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const button = (label: string): HTMLButtonElement => $$<HTMLButtonElement>("button").find((b) => b.textContent === label)!;
const status = (): string => $(".rd-groom__save-state").textContent!;
const available = (label: string): boolean => button(label).getAttribute("aria-disabled") !== "true";
const click = (el: HTMLElement): Promise<void> => act(() => el.click());
const card = (n: number): HTMLElement => $$<HTMLElement>(".rd-goal-card")[n]!;
const planned = (): string =>
    $$<HTMLElement>(".rd-plan-item").map((p) => `${p.dataset.kind}:${p.dataset.num}`).join(",") +
    "|" +
    $(".rd-groom__summary").textContent +
    "|" +
    $$<HTMLInputElement>('input[aria-label="Goal name"]').map((i) => i.value).join(",");
const itemTrigger = (num: number): HTMLButtonElement => $(`button[data-focus-key="item:epic:${num}"]`);
async function planEpic(num: number, goal: number): Promise<void> {
    await click(itemTrigger(num));
    await click($$<HTMLButtonElement>('[role="menu"] [role="menuitem"]')[goal]!);
}
async function typeIn(el: HTMLInputElement, value: string): Promise<void> {
    await act(() => {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    session = createSessionStore();
});
afterEach(() => {
    unmount();
    root.remove();
    vi.unstubAllGlobals();
});

describe("save state", () => {
    it("starts saved, with Save plan and Undo unavailable", async () => {
        await open();
        expect(status()).toBe("All changes saved");
        expect(available("Save plan")).toBe(false);
        expect(available("Undo")).toBe(false);
    });

    it("announces the save state to screen readers", async () => {
        await open();
        expect($(".rd-groom__save-state").getAttribute("role")).toBe("status");
    });

    it("shows unsaved changes after a plan change, and saved after Save plan, without a request", async () => {
        await open();
        await planEpic(34, 2);
        expect(status()).toBe("Unsaved changes");
        expect(available("Save plan")).toBe(true);
        await click(button("Save plan"));
        expect(status()).toBe("All changes saved");
        expect(available("Save plan")).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("keeps keyboard focus on the page when Save plan or Undo becomes unavailable", async () => {
        await open();
        await planEpic(34, 2);
        button("Save plan").focus();
        await click(button("Save plan"));
        expect(document.activeElement).toBe(button("Save plan"));
        await planEpic(31, 1);
        button("Undo").focus();
        await click(button("Undo"));
        expect(document.activeElement).toBe(button("Undo"));
    });

    it("ignores a press on an unavailable Save plan or Undo", async () => {
        await open();
        const before: string = planned();
        await click(button("Save plan"));
        await click(button("Undo"));
        expect(planned()).toBe(before);
        expect(status()).toBe("All changes saved");
    });

    it("does not count a change that alters nothing", async () => {
        const state = session.get();
        session.change((s) => planItem(INITIATIVES, s, "epic", 31, "g1"));
        expect(session.get()).toBe(state);
        await open();
        expect(status()).toBe("All changes saved");
        expect(available("Undo")).toBe(false);
    });
});

describe("undo", () => {
    it("is a button beside Save plan", async () => {
        await open();
        expect(button("Undo").parentElement).toBe(button("Save plan").parentElement);
    });

    it("returns the plan to its state before the latest change, one change per press, back to the start", async () => {
        await open();
        const start: string = planned();
        await planEpic(34, 2);
        const one: string = planned();
        await planEpic(31, 1);
        expect(planned()).not.toBe(one);
        await click(button("Undo"));
        expect(planned()).toBe(one);
        await click(button("Undo"));
        expect(planned()).toBe(start);
        expect(available("Undo")).toBe(false);
    });

    it("undoes any change, including adding and deleting a goal and moving one", async () => {
        await open();
        const start: string = planned();
        await click($(".rd-goals__add"));
        await click(card(0).querySelector('[aria-label="Goal options"]')!);
        await click($$<HTMLButtonElement>('[role="menuitem"]').find((b) => b.textContent === "Move down")!);
        await click(card(0).querySelector('[aria-label="Goal options"]')!);
        await click($$<HTMLButtonElement>('[role="menuitem"]').find((b) => b.textContent === "Delete goal")!);
        for (let i = 0; i < 3; i++) {
            await click(button("Undo"));
        }
        expect(planned()).toBe(start);
    });

    it("shows the plan as saved when undone back to the saved plan, and unsaved again past a save", async () => {
        await open();
        await planEpic(34, 2);
        await click(button("Undo"));
        expect(status()).toBe("All changes saved");
        await planEpic(34, 2);
        await click(button("Save plan"));
        await planEpic(31, 1);
        expect(status()).toBe("Unsaved changes");
        await click(button("Undo"));
        expect(status()).toBe("All changes saved");
        await click(button("Undo"));
        expect(status()).toBe("Unsaved changes");
        expect(available("Save plan")).toBe(true);
    });

    it("undoes typing in a goal field as one step per field edit", async () => {
        await open();
        const name = (): HTMLInputElement => card(0).querySelector('input[aria-label="Goal name"]')!;
        const original: string = name().value;
        await typeIn(name(), "A");
        await typeIn(name(), "AB");
        await typeIn(name(), "ABC");
        await click(button("Undo"));
        expect(name().value).toBe(original);
        expect(available("Undo")).toBe(false);
        await typeIn(name(), "X");
        await act(() => {
            name().dispatchEvent(new FocusEvent("blur"));
        });
        await typeIn(name(), "XY");
        await click(button("Undo"));
        expect(name().value).toBe("X");
    });

    it("never changes which initiatives are open, the filter, the width or the sidebar", async () => {
        await open();
        await planEpic(34, 2);
        await click($('.rd-bl-init[data-num="13"] .rd-icon-btn'));
        const filter: HTMLInputElement = $('input[aria-label="Filter backlog"]');
        await typeIn(filter, "goal");
        $('[role="separator"]').dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
        await click($(".rd-nav__toggle"));
        const width: string = $<HTMLElement>(".rd-backlog").style.flexBasis;
        await click(button("Undo"));
        expect(session.get().collapsed).toEqual([13]);
        expect(filter.value).toBe("goal");
        expect($<HTMLElement>(".rd-backlog").style.flexBasis).toBe(width);
        expect($(".rd-nav--collapsed")).toBeTruthy();
    });

    it("never reuses a goal identity", async () => {
        await open();
        await click($(".rd-goals__add"));
        const added: string = $$<HTMLElement>(".rd-goal-card").at(-1)!.dataset.goal!;
        await click(button("Undo"));
        await click($(".rd-goals__add"));
        expect($$<HTMLElement>(".rd-goal-card").at(-1)!.dataset.goal).not.toBe(added);
    });
});

describe("session", () => {
    it("keeps the undo list and the save state when the page is switched and mounted again, and loses them on a new session", async () => {
        await open();
        await planEpic(34, 2);
        await click($$<HTMLButtonElement>(".rd-nav-item").find((b) => b.textContent!.includes("Timeline"))!);
        await click($$<HTMLButtonElement>(".rd-nav-item").find((b) => b.textContent!.includes("Grooming"))!);
        expect(status()).toBe("Unsaved changes");
        unmount();
        await open();
        expect(status()).toBe("Unsaved changes");
        expect(available("Undo")).toBe(true);
        unmount();
        session = createSessionStore();
        await open();
        expect(status()).toBe("All changes saved");
        expect(available("Undo")).toBe(false);
    });

    it("sends no request from Save plan or Undo", async () => {
        await open();
        await planEpic(34, 2);
        await click(button("Undo"));
        await planEpic(34, 2);
        await click(button("Save plan"));
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(Array.from($$("a[href]")).every((a) => (a as HTMLAnchorElement).href.startsWith("https://github.com/acme/widgets/"))).toBe(true);
    });
});
