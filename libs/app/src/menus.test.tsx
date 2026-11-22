// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";
import { createSessionStore } from "./session.ts";

let root: HTMLElement;
let unmount: () => void;
let fetchSpy: ReturnType<typeof vi.fn>;

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { session: createSessionStore() });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const active = (): Element | null => document.activeElement;
const card = (n: number): HTMLElement => $$<HTMLElement>(".rd-goal-card")[n]!;
const trigger = (kind: string, num: number): HTMLButtonElement =>
    $(`button[data-focus-key="item:${kind}:${num}"]`);
const menu = (): HTMLElement => $('[role="menu"]');
const entries = (): HTMLButtonElement[] => $$<HTMLButtonElement>('[role="menu"] [role="menuitem"]');
const entry = (label: string): HTMLButtonElement => entries().find((b) => b.textContent!.includes(label))!;
const click = (el: HTMLElement): Promise<void> => act(() => el.click());
const planned = (): string =>
    $$<HTMLElement>(".rd-goal-card")
        .map((c) =>
            [
                c.querySelector(".rd-goal-card__count")!.textContent,
                ...$$<HTMLElement>(".rd-plan-item").filter((p) => c.contains(p)).map((p) => `${p.dataset.kind}:${p.dataset.num}`),
            ].join(","),
        )
        .join("|") +
    $$<HTMLElement>(".rd-bl-meta").map((m) => m.textContent).join(",") +
    $(".rd-groom__summary").textContent;

function drag(el: Element, type: string): void {
    const event: Event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
        value: { setData: vi.fn(), getData: () => "", effectAllowed: "", dropEffect: "" },
    });
    el.dispatchEvent(event);
}
async function dragTo(source: Element, target: Element): Promise<void> {
    for (const [el, type] of [
        [source, "dragstart"],
        [target, "dragover"],
        [target, "drop"],
        [source, "dragend"],
    ] as const) {
        await act(() => drag(el, type));
    }
}
const backlogRow = (kind: string, num: number): HTMLElement =>
    kind === "init" ? $(`.rd-bl-init[data-num="${num}"] .rd-bl-row--init`) : $(`.rd-bl-epic[data-num="${num}"]`);
const planRow = (kind: string, num: number): HTMLElement => $(`.rd-plan-item[data-kind="${kind}"][data-num="${num}"]`);

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

describe("item menu", () => {
    it("gives every backlog item a menu button that Tab can reach", async () => {
        await open();
        for (const t of $$<HTMLButtonElement>("button[data-focus-key^=\"item:\"]")) {
            expect(t.tabIndex).toBe(0);
            expect(t.getAttribute("aria-haspopup")).toBe("menu");
        }
        expect($$("button[data-focus-key^=\"item:\"]").length).toBe(4 + 9);
    });

    it("lists the goals, enabled exactly when a drop on that goal would be accepted", async () => {
        await open();
        await click(trigger("epic", 31));
        const goals: HTMLButtonElement[] = entries().filter((b) => b.textContent!.startsWith("Plan in"));
        expect(goals.length).toBe(3);
        expect(goals.map((b) => b.disabled)).toEqual([true, false, false]);
        expect(entry("Take out of plan")).toBeTruthy();
    });

    it("offers Take out of plan only for an item with a plan of its own", async () => {
        await open();
        await click(trigger("epic", 51));
        expect(entries().some((b) => b.textContent!.includes("Take out of plan"))).toBe(false);
        expect(entries().filter((b) => b.textContent!.startsWith("Plan in")).map((b) => b.disabled)).toEqual([false, true, false]);
        expect(menu().textContent).toContain("plans it on its own");
    });

    it("changes the plan exactly as the same drop does", async () => {
        const cases: Array<[string, number, number]> = [
            ["epic", 34, 2],
            ["epic", 51, 0],
            ["init", 13, 2],
            ["init", 14, 0],
            ["epic", 31, 1],
        ];
        for (const [kind, num, goal] of cases) {
            await open();
            await dragTo(backlogRow(kind, num), card(goal));
            const dropped: string = planned();
            unmount();
            await open();
            await click(trigger(kind, num));
            await click(entries().filter((b) => b.textContent!.startsWith("Plan in"))[goal]!);
            expect(planned()).toBe(dropped);
            unmount();
        }
        await open();
    });

    it("takes an item out of its plan exactly as dragging it to the backlog does", async () => {
        await open();
        await dragTo(planRow("epic", 31), $(".rd-backlog"));
        const dropped: string = planned();
        unmount();
        await open();
        await click(trigger("epic", 31));
        await click(entry("Take out of plan"));
        expect(planned()).toBe(dropped);
        unmount();
        await open();
        await click($('.rd-plan-item[data-num="31"] button[aria-label^="Take out of plan"]'));
        expect(planned()).toBe(dropped);
    });

    it("closes on Escape and returns focus to the button", async () => {
        await open();
        await click(trigger("epic", 34));
        expect(menu()).toBeTruthy();
        await act(() => {
            menu().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
        });
        expect(root.querySelector('[role="menu"]')).toBeNull();
        expect(active()).toBe(trigger("epic", 34));
    });

    it("moves focus into the menu, and Up and Down move between enabled entries", async () => {
        await open();
        await click(trigger("epic", 31));
        const first: HTMLButtonElement = entries().find((b) => !b.disabled)!;
        expect(active()).toBe(first);
        await act(() => {
            first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        });
        expect(active()).not.toBe(first);
        expect((active() as HTMLButtonElement).disabled).toBe(false);
        await act(() => {
            active()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
        });
        expect(active()).toBe(first);
    });

    it("keeps only one menu open, and closes on a click outside", async () => {
        await open();
        await click(trigger("epic", 34));
        await click($('button[aria-label="Goal options"]'));
        expect($$('[role="menu"]').length).toBe(1);
        await act(() => document.body.click());
        expect($$('[role="menu"]').length).toBe(0);
    });

    it("leaves focus on the same item's button after an action", async () => {
        await open();
        await click(trigger("epic", 34));
        await click(entry("Plan in Goal 3"));
        expect(active()).toBe(trigger("epic", 34));
    });

    it("leaves focus on a control that still exists after Take out of plan from a goal card", async () => {
        await open();
        await click($('.rd-plan-item[data-num="31"] button[aria-label^="Take out of plan"]'));
        expect(active()).not.toBe(document.body);
        expect(root.contains(active())).toBe(true);
    });
});

describe("goal menu", () => {
    const options = (n: number): HTMLButtonElement => card(n).querySelector('[aria-label="Goal options"]')!;
    const bar = (): string[] => $$<HTMLInputElement>('input[aria-label="Goal name"]').map((i) => i.value);

    it("keeps Move up, Move down and Delete goal, and focuses the moved goal's button", async () => {
        await open();
        await click(options(1));
        expect(entries().map((b) => b.textContent)).toEqual(["Move up", "Move down", "Delete goal"]);
        const titles: string[] = bar();
        await click(entry("Move up"));
        expect(bar()).toEqual([titles[1], titles[0], titles[2]]);
        expect(active()).toBe(options(0));
    });

    it("closes on Escape with focus back on its button", async () => {
        await open();
        await click(options(0));
        await act(() => {
            menu().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
        });
        expect(active()).toBe(options(0));
    });

    it("moves focus to the next goal's button after Delete goal, or to Add goal after the last", async () => {
        await open();
        await click(options(1));
        await click(entry("Delete goal"));
        expect(active()).toBe(options(1));
        await click(options(1));
        await click(entry("Delete goal"));
        expect(active()).toBe($(".rd-goals__add"));
    });
});

describe("no network and no links", () => {
    it("sends no request from either menu and adds no links", async () => {
        await open();
        await click(trigger("epic", 34));
        await click(entry("Plan in Goal 3"));
        await click(trigger("epic", 31));
        await click(entry("Take out of plan"));
        expect(fetchSpy).not.toHaveBeenCalled();
        expect($$("a[href]").length).toBe(0);
    });
});
