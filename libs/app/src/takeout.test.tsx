// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountApp } from "./mount.tsx";
import { createSessionStore } from "./session.ts";

let root: HTMLElement;
let unmount: () => void;

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { session: createSessionStore() });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const click = (el: HTMLElement): Promise<void> => act(() => el.click());
const card = (n: number): HTMLElement => $$<HTMLElement>(".rd-goal-card")[n]!;
const takeOut = (name: string): HTMLButtonElement =>
    $$<HTMLButtonElement>(".rd-plan-item button").find((b) => b.getAttribute("aria-label") === name)!;
const summary = (): string => $(".rd-groom__summary").textContent!;
const counts = (): string[] => $$(".rd-goal-card__count").map((c) => c.textContent!);

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
});
afterEach(() => {
    unmount?.();
    root.remove();
});

describe("Take out of plan button on a goal row", () => {
    it("shows an icon button on every row, named for the item and the goal", async () => {
        await open();
        const rows: HTMLElement[] = $$(".rd-plan-item");
        expect(rows.length).toBe(5);
        for (const row of rows) {
            expect(row.querySelectorAll("button").length).toBe(1);
        }
        expect(takeOut("Take epic #31 out of Goal 1")).toBeTruthy();
        expect(takeOut("Take initiative #14 out of Goal 2")).toBeTruthy();
        expect(takeOut("Take epic #60 out of Goal 2").classList.contains("rd-icon-btn")).toBe(true);
    });

    it("removes only that item's own plan, so every count matches the new plan", async () => {
        await open();
        expect(summary()).toBe("5 of 9 epics planned");
        expect(counts()).toEqual(["3 epics", "2 epics", "0 epics"]);
        await click(takeOut("Take epic #40 out of Goal 1"));
        expect($$(".rd-plan-item").length).toBe(4);
        expect(card(0).querySelector('.rd-plan-item[data-num="40"]')).toBeNull();
        expect(card(0).querySelector('.rd-plan-item[data-num="31"]')).toBeTruthy();
        expect(counts()).toEqual(["2 epics", "2 epics", "0 epics"]);
        expect(summary()).toBe("4 of 9 epics planned");
    });

    it("keeps an epic planned with its initiative when the initiative is planned", async () => {
        await open();
        // Epic 50 is planned in Goal 1. Its initiative 14 is planned in Goal 2.
        await click(takeOut("Take epic #50 out of Goal 1"));
        expect(card(0).querySelector('.rd-plan-item[data-num="50"]')).toBeNull();
        expect(summary()).toBe("5 of 9 epics planned");
        expect(counts()).toEqual(["2 epics", "3 epics", "0 epics"]);
        const row: HTMLElement = $$<HTMLElement>(".rd-bl-epic").find((r) => r.dataset.num === "50")!;
        expect(row.querySelector(".rd-bl-meta")!.textContent).toBe("Goal 2");
    });

    it("moves focus to the next row's button, else to the goal's options button", async () => {
        await open();
        await click(takeOut("Take epic #31 out of Goal 1"));
        expect(document.activeElement).toBe(takeOut("Take epic #40 out of Goal 1"));
        await click(takeOut("Take epic #40 out of Goal 1"));
        await click(takeOut("Take epic #50 out of Goal 1"));
        expect(document.activeElement).toBe(card(0).querySelector('[aria-label="Goal options"]'));
    });

    it("makes the same plan change as the item menu's Take out of plan", async () => {
        await open();
        await click(takeOut("Take epic #60 out of Goal 2"));
        expect(card(1).querySelector('.rd-plan-item[data-num="60"]')).toBeNull();
        expect(card(1).querySelector('.rd-plan-item[data-num="14"]')).toBeTruthy();
        expect(summary()).toBe("4 of 9 epics planned");
    });
});
