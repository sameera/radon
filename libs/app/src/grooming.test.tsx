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

// ---------- drag and drop ----------

function drag(el: Element, type: string): Event {
    const event: Event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
        value: { setData: vi.fn(), getData: () => "", effectAllowed: "", dropEffect: "" },
    });
    el.dispatchEvent(event);
    return event;
}
const backlogRow = (kind: string, num: number): HTMLElement =>
    kind === "init" ? $(`.rd-bl-init[data-num="${num}"] .rd-bl-row--init`) : $(`.rd-bl-epic[data-num="${num}"]`);
const planRow = (kind: string, num: number): HTMLElement => $(`.rd-plan-item[data-kind="${kind}"][data-num="${num}"]`);
const backlogPanel = (): HTMLElement => $(".rd-backlog");
const summary = (): string => $(".rd-groom__summary").textContent!;

async function dragTo(source: Element, target: Element): Promise<void> {
    await act(() => {
        drag(source, "dragstart");
    });
    await act(() => {
        drag(target, "dragover");
    });
    await act(() => {
        drag(target, "drop");
    });
    await act(() => {
        drag(source, "dragend");
    });
}

describe("planning by drag and drop", () => {
    it("drops an unplanned epic on a goal: it appears there, the backlog row and count update", async () => {
        await open();
        await dragTo(backlogRow("epic", 34), card(2));
        expect(planItems(2)).toEqual(["epic:34"]);
        expect(meta("epic", 34)).toBe("Goal 3");
        expect(summary()).toBe("6 of 9 epics planned");
        expect(card(2).querySelector(".rd-goal-card__drop")).toBeNull();
        expect(card(2).querySelector(".rd-goal-card__count")!.textContent).toBe("1 epic");
    });

    it("drops an unplanned initiative on a goal", async () => {
        await open();
        await dragTo(backlogRow("init", 13), card(2));
        expect(planItems(2)).toEqual(["init:13"]);
        expect(meta("init", 13)).toBe("Goal 3");
        expect(meta("epic", 41)).toBe("Goal 3");
        expect(meta("epic", 40)).toBe("Goal 1");
    });

    it("moves a planned item to a different goal, and it leaves the first", async () => {
        await open();
        await dragTo(planRow("epic", 31), card(1));
        expect(planItems(0)).toEqual(["epic:40", "epic:50"]);
        expect(planItems(1)).toEqual(["init:14", "epic:60", "epic:31"]);
        expect(meta("epic", 31)).toBe("Goal 2");
        expect(summary()).toBe("5 of 9 epics planned");
    });

    it("drops a planned item on the backlog: it is no longer planned", async () => {
        await open();
        await dragTo(planRow("epic", 40), backlogPanel());
        expect(planItems(0)).toEqual(["epic:31", "epic:50"]);
        expect(meta("epic", 40)).toBe("");
        expect(summary()).toBe("4 of 9 epics planned");
    });

    it("drops an epic whose initiative is planned on the backlog: it stays with its initiative", async () => {
        await open();
        await dragTo(planRow("epic", 50), backlogPanel());
        expect(planItems(0)).toEqual(["epic:31", "epic:40"]);
        expect(meta("epic", 50)).toBe("Goal 2");
        expect(summary()).toBe("5 of 9 epics planned");
        expect(card(1).querySelector(".rd-goal-card__count")!.textContent).toBe("3 epics");
    });

    it("plans an epic of a planned initiative in another goal on its own", async () => {
        await open();
        await dragTo(backlogRow("epic", 51), card(0));
        expect(planItems(0)).toContain("epic:51");
        expect(planItems(1)).toContain("init:14");
        expect(meta("epic", 51)).toBe("Goal 1");
        expect(meta("init", 14)).toBe("Goal 2");
        expect(summary()).toBe("5 of 9 epics planned");
    });

    it("changes nothing when an item is dropped on the goal it is already in", async () => {
        await open();
        await dragTo(backlogRow("epic", 51), card(1));
        expect(planItems(1)).toEqual(["init:14", "epic:60"]);
        expect(meta("epic", 51)).toBe("Goal 2");
    });
});

describe("drag highlighting", () => {
    it("highlights a goal that can accept the drag while the pointer is over it, and clears it on leave", async () => {
        await open();
        await act(() => {
            drag(backlogRow("epic", 34), "dragstart");
        });
        let over: Event | undefined;
        await act(() => {
            over = drag(card(2), "dragover");
        });
        expect(over!.defaultPrevented).toBe(true);
        expect(card(2).classList.contains("is-over")).toBe(true);
        expect(card(0).classList.contains("is-over")).toBe(false);
        await act(() => {
            drag(card(2), "dragleave");
        });
        expect(card(2).classList.contains("is-over")).toBe(false);
    });

    it("highlights the backlog only for an item dragged out of a goal", async () => {
        await open();
        await act(() => {
            drag(backlogRow("epic", 34), "dragstart");
        });
        let over: Event | undefined;
        await act(() => {
            over = drag(backlogPanel(), "dragover");
        });
        expect(over!.defaultPrevented).toBe(false);
        expect(backlogPanel().classList.contains("is-over")).toBe(false);
        await act(() => {
            drag(backlogRow("epic", 34), "dragend");
            drag(planRow("epic", 31), "dragstart");
        });
        await act(() => {
            over = drag(backlogPanel(), "dragover");
        });
        expect(over!.defaultPrevented).toBe(true);
        expect(backlogPanel().classList.contains("is-over")).toBe(true);
    });

    it("does not highlight the goal an item is already planned in", async () => {
        await open();
        await act(() => {
            drag(planRow("epic", 31), "dragstart");
        });
        await act(() => {
            drag(card(0), "dragover");
        });
        expect(card(0).classList.contains("is-over")).toBe(false);
    });
});

describe("drags from outside the Raiden page", () => {
    it("change nothing when dropped", async () => {
        await open();
        const before: string = root.innerHTML;
        let over: Event | undefined;
        await act(() => {
            over = drag(card(2), "dragover");
            drag(card(2), "drop");
            drag(backlogPanel(), "drop");
        });
        expect(over!.defaultPrevented).toBe(false);
        expect(root.innerHTML).toBe(before);
    });

    it("are not accepted after a Raiden drag ends", async () => {
        await open();
        await act(() => {
            drag(backlogRow("epic", 34), "dragstart");
            drag(backlogRow("epic", 34), "dragend");
        });
        await act(() => {
            drag(card(2), "drop");
        });
        expect(planItems(2)).toEqual([]);
    });
});

// ---------- goals: add, edit, reorder, delete ----------

const titles = (): string[] => $$<HTMLInputElement>("input.rd-goal-card__title").map((i) => i.value);
const ranksShown = (): string[] => $$(".rd-goal-card__rank").map((e) => e.textContent!);
const goalNames = ["Pilot team plans its next sprint from Raiden", "Teams install Raiden without help", "Nexus status shows in every view"];
const optionsBtn = (n: number): HTMLButtonElement => card(n).querySelector("[aria-label=\"Goal options\"]")!;
const menuItem = (n: number, label: string): HTMLButtonElement =>
    Array.from(card(n).querySelectorAll<HTMLButtonElement>("[role=\"menu\"] [role=\"menuitem\"]")).find((b) => b.textContent === label)!;
const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> => {
    await act(() => {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
};
const addGoalBtn = (): HTMLButtonElement => $$<HTMLButtonElement>("button").find((b) => b.textContent!.trim() === "Add goal")!;

describe("Add goal", () => {
    it("adds an empty goal last and focuses its name field", async () => {
        await open();
        await act(() => addGoalBtn().click());
        expect($$(".rd-goal-card").length).toBe(4);
        expect(titles()[3]).toBe("");
        expect(ranksShown()).toEqual(["1", "2", "3", "4"]);
        expect(card(3).querySelector(".rd-goal-card__drop")).not.toBeNull();
        expect(document.activeElement).toBe(card(3).querySelector("input.rd-goal-card__title"));
    });
});

describe("editing a goal", () => {
    it("keeps edited name and description", async () => {
        await open();
        await type(card(1).querySelector("input.rd-goal-card__title")!, "Teams install in minutes");
        await type(card(1).querySelector("textarea.rd-goal-card__desc")!, "Short.");
        expect(titles()[1]).toBe("Teams install in minutes");
        expect(card(1).querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("Short.");
    });

    it("grows the description field to fit its text", async () => {
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 84 });
        try {
            await open();
            const desc: HTMLTextAreaElement = card(0).querySelector("textarea.rd-goal-card__desc")!;
            expect(desc.style.height).toBe("84px");
            await type(desc, "A much longer description that wraps onto several lines.");
            expect(desc.style.height).toBe("84px");
        } finally {
            if (original) {
                Object.defineProperty(HTMLElement.prototype, "scrollHeight", original);
            } else {
                delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
            }
        }
    });
});

describe("goal options menu", () => {
    it("moves a goal up or down one position and updates every rank", async () => {
        await open();
        await act(() => optionsBtn(1).click());
        await act(() => menuItem(1, "Move up").click());
        expect(titles()).toEqual([goalNames[1], goalNames[0], goalNames[2]]);
        expect(ranksShown()).toEqual(["1", "2", "3"]);
        expect(meta("epic", 60)).toBe("Goal 1");
        await act(() => optionsBtn(1).click());
        await act(() => menuItem(1, "Move down").click());
        expect(titles()).toEqual([goalNames[1], goalNames[2], goalNames[0]]);
    });

    it("disables Move up on the first goal and Move down on the last", async () => {
        await open();
        await act(() => optionsBtn(0).click());
        expect(menuItem(0, "Move up").disabled).toBe(true);
        expect(menuItem(0, "Move down").disabled).toBe(false);
        await act(() => optionsBtn(2).click());
        expect(menuItem(2, "Move down").disabled).toBe(true);
        expect(menuItem(2, "Move up").disabled).toBe(false);
    });

    it("opens as a menu, shows one at a time and closes on Escape", async () => {
        await open();
        await act(() => optionsBtn(0).click());
        expect(optionsBtn(0).getAttribute("aria-expanded")).toBe("true");
        expect($$("[role=\"menu\"]").length).toBe(1);
        await act(() => optionsBtn(1).click());
        expect($$("[role=\"menu\"]").length).toBe(1);
        await act(() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        });
        expect($$("[role=\"menu\"]").length).toBe(0);
    });

    it("deletes a goal and returns its items to the backlog", async () => {
        await open();
        await act(() => optionsBtn(0).click());
        await act(() => menuItem(0, "Delete goal").click());
        expect(titles()).toEqual([goalNames[1], goalNames[2]]);
        expect(ranksShown()).toEqual(["1", "2"]);
        expect(meta("epic", 31)).toBe("");
        expect(meta("epic", 40)).toBe("");
        expect(meta("epic", 50)).toBe("Goal 1");
        expect(summary()).toBe("3 of 9 epics planned");
    });
});

describe("reordering goals by their handle", () => {
    const handle = (n: number): HTMLElement => card(n).querySelector(".rd-goal-card__grip")!;
    const place = (n: number): void => {
        card(n).getBoundingClientRect = () => ({ top: 0, height: 100, bottom: 100, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON() {} });
    };
    async function dragOver(from: number, to: number, clientY: number): Promise<void> {
        place(to);
        await act(() => {
            drag(handle(from), "dragstart");
        });
        await act(() => {
            const event = new Event("dragover", { bubbles: true, cancelable: true });
            Object.defineProperty(event, "clientY", { value: clientY });
            Object.defineProperty(event, "dataTransfer", { value: { dropEffect: "" } });
            card(to).dispatchEvent(event);
        });
    }
    async function dropAt(from: number, to: number, clientY: number): Promise<void> {
        await dragOver(from, to, clientY);
        await act(() => {
            const event = new Event("drop", { bubbles: true, cancelable: true });
            Object.defineProperty(event, "clientY", { value: clientY });
            card(to).dispatchEvent(event);
            drag(handle(from), "dragend");
        });
    }

    it("moves the goal before the card when dropped on its upper half, and updates ranks", async () => {
        await open();
        await dropAt(2, 0, 25);
        expect(titles()).toEqual([goalNames[2], goalNames[0], goalNames[1]]);
        expect(ranksShown()).toEqual(["1", "2", "3"]);
    });

    it("moves the goal after the card when dropped on its lower half", async () => {
        await open();
        await dropAt(2, 0, 75);
        expect(titles()).toEqual([goalNames[0], goalNames[2], goalNames[1]]);
    });

    it("shows where the goal will land and highlights no other kind of target", async () => {
        await open();
        await dragOver(2, 0, 25);
        expect(card(0).classList.contains("insert-before")).toBe(true);
        expect(card(0).classList.contains("insert-after")).toBe(false);
        expect(backlogPanel().classList.contains("is-over")).toBe(false);
        await act(() => {
            drag(card(0), "dragleave");
        });
        expect(card(0).classList.contains("insert-before")).toBe(false);
    });

    it("does not accept a goal dropped on itself or on the backlog", async () => {
        await open();
        place(2);
        await act(() => {
            drag(handle(2), "dragstart");
        });
        let over: Event | undefined;
        await act(() => {
            over = drag(card(2), "dragover");
        });
        expect(over!.defaultPrevented).toBe(false);
        await act(() => {
            over = drag(backlogPanel(), "dragover");
            drag(backlogPanel(), "drop");
        });
        expect(over!.defaultPrevented).toBe(false);
        expect(titles()).toEqual(goalNames);
    });

    it("lets no handle start a drag when there is only one goal", async () => {
        await open();
        for (const n of [2, 1]) {
            await act(() => optionsBtn(n).click());
            await act(() => menuItem(n, "Delete goal").click());
        }
        expect(handle(0).getAttribute("draggable")).toBe("false");
    });

    it("does not let an item drag act on a goal's position, or a goal drag act on a plan", async () => {
        await open();
        await act(() => {
            drag(handle(2), "dragstart");
        });
        await act(() => {
            drag(card(1), "drop");
        });
        expect(planItems(1)).toEqual(["init:14", "epic:60"]);
    });
});
