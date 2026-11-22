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

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { prefs, session: createSessionStore() });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const filter = (): HTMLInputElement => $('input[aria-label="Filter backlog"]');
const divider = (): HTMLElement => $('[role="separator"].rd-divider');
const backlog = (): HTMLElement => $(".rd-backlog");
const width = (): number => parseInt(backlog().style.flexBasis, 10);
const shownEpics = (): number[] => $$<HTMLElement>(".rd-bl-epic").map((e) => Number(e.dataset.num));
const shownInits = (): number[] => $$<HTMLElement>(".rd-bl-init").map((e) => Number(e.dataset.num));

async function type(value: string): Promise<void> {
    await act(() => {
        filter().value = value;
        filter().dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function key(el: Element, k: string, extra: KeyboardEventInit = {}): Promise<void> {
    await act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, composed: true, cancelable: true, ...extra }));
    });
}

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    stored = {};
    prefs = {
        get: async (k: string) => stored[k],
        set: async (k: string, v: unknown) => {
            stored[k] = v;
        },
    };
});
afterEach(() => {
    unmount();
    root.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("backlog filter", () => {
    it("shows only items whose title matches, ignoring case, and keeps a matching epic under its initiative", async () => {
        await open();
        await type("TODAY LINE");
        expect(shownInits()).toEqual([13]);
        expect(shownEpics()).toEqual([42]);
        expect($('.rd-bl-init[data-num="13"]').textContent).toContain("Hierarchical timeline");
    });

    it("matches an issue number with or without a leading #", async () => {
        await open();
        await type("#41");
        expect(shownEpics()).toEqual([41]);
        await type("41");
        expect(shownEpics()).toEqual([41]);
        await type("#12");
        expect(shownInits()).toEqual([12]);
        expect(shownEpics()).toEqual([31, 34]);
    });

    it("shows all the epics of a matching initiative", async () => {
        await open();
        await type("hierarchical");
        expect(shownInits()).toEqual([13]);
        expect(shownEpics()).toEqual([40, 41, 42]);
    });

    it("says nothing matches, and how to see everything, when no item matches", async () => {
        await open();
        await type("zzzz");
        expect(shownInits()).toEqual([]);
        expect($(".rd-backlog__empty").textContent).toBe(
            "No initiatives or epics match. Clear the filter to show them all.",
        );
        await type("");
        expect(root.querySelector(".rd-backlog__empty")).toBeNull();
        expect(shownInits().length).toBe(4);
    });

    it("shows matches inside a closed initiative, and restores each initiative's own open state when cleared", async () => {
        await open();
        await act(() => $<HTMLButtonElement>('.rd-bl-init[data-num="13"] .rd-icon-btn').click());
        expect(shownEpics().includes(41)).toBe(false);
        await type("#41");
        expect(shownEpics()).toEqual([41]);
        await type("");
        expect(shownEpics().includes(41)).toBe(false);
        expect(shownEpics().includes(31)).toBe(true);
    });

    it("never changes the plan or the save state, and sends no request", async () => {
        await open();
        const before: string = $(".rd-groom__summary").textContent! + $(".rd-groom__save-state").textContent!;
        await type("goal");
        expect($(".rd-groom__summary").textContent! + $(".rd-groom__save-state").textContent!).toBe(before);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect($$("a[href]").length).toBe(0);
    });
});

describe("backlog divider", () => {
    it("is a focusable separator that reports the backlog width and its range", async () => {
        await open();
        expect(divider().getAttribute("tabindex")).toBe("0");
        expect(divider().getAttribute("aria-orientation")).toBe("vertical");
        expect(divider().getAttribute("aria-valuenow")).toBe("360");
        expect(Number(divider().getAttribute("aria-valuemin"))).toBeLessThan(360);
        expect(Number(divider().getAttribute("aria-valuemax"))).toBeGreaterThan(360);
        expect(width()).toBe(360);
    });

    it("changes the width in steps with the arrow keys, larger with Shift, and Home and End go to the limits", async () => {
        await open();
        const min: number = Number(divider().getAttribute("aria-valuemin"));
        const max: number = Number(divider().getAttribute("aria-valuemax"));
        await key(divider(), "ArrowRight");
        const small: number = width() - 360;
        expect(small).toBeGreaterThan(0);
        await key(divider(), "ArrowLeft");
        expect(width()).toBe(360);
        await key(divider(), "ArrowRight", { shiftKey: true });
        expect(width() - 360).toBeGreaterThan(small);
        await key(divider(), "Home");
        expect(width()).toBe(min);
        await key(divider(), "ArrowLeft");
        expect(width()).toBe(min);
        await key(divider(), "End");
        expect(width()).toBe(max);
        expect(divider().getAttribute("aria-valuenow")).toBe(String(max));
    });

    it("changes the width when the divider is dragged with a pointer", async () => {
        await open();
        const ev = (type: string, x: number): void => {
            const e: Event = new Event(type, { bubbles: true, cancelable: true });
            Object.assign(e, { clientX: x, pointerId: 1 });
            divider().dispatchEvent(e);
        };
        divider().setPointerCapture = vi.fn();
        divider().releasePointerCapture = vi.fn();
        await act(() => ev("pointerdown", 400));
        await act(() => ev("pointermove", 450));
        expect(width()).toBe(410);
        await act(() => ev("pointerup", 450));
        expect(stored["backlogWidth"]).toBe(410);
    });

    it("resets to the default width on double click", async () => {
        await open();
        await key(divider(), "ArrowRight", { shiftKey: true });
        await act(() => {
            divider().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        });
        expect(width()).toBe(360);
    });

    it("keeps the chosen width through the preference store and reads it before the first render", async () => {
        await open();
        await key(divider(), "ArrowRight", { shiftKey: true });
        const chosen: number = width();
        expect(stored["backlogWidth"]).toBe(chosen);
        unmount();
        await open();
        expect(width()).toBe(chosen);
    });

    it("fits the stored width between the panel minimums, and returns to the chosen width when space allows", async () => {
        stored["backlogWidth"] = 900;
        const space = { w: 700 };
        const original = HTMLElement.prototype.getBoundingClientRect;
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            return this.classList.contains("rd-groom__panels")
                ? ({ width: space.w, left: 0, right: space.w, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect)
                : original.call(this);
        });
        await open();
        const fitted: number = width();
        expect(fitted).toBeLessThan(900);
        expect(Number(divider().getAttribute("aria-valuemax"))).toBe(fitted);
        space.w = 2000;
        await act(() => {
            window.dispatchEvent(new Event("resize"));
        });
        expect(width()).toBe(900);
        expect(stored["backlogWidth"]).toBe(900);
    });
});

describe("keys typed inside Raiden", () => {
    it("do not reach the page's own shortcut handlers when typed in the filter or a goal name", async () => {
        await open();
        const onPage = vi.fn();
        document.addEventListener("keydown", onPage);
        for (const field of [filter(), $('input[aria-label="Goal name"]')]) {
            await key(field, "s");
            await key(field, ".");
        }
        expect(onPage).not.toHaveBeenCalled();
        document.removeEventListener("keydown", onPage);
    });
});
