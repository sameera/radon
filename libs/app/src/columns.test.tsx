// @vitest-environment jsdom
// Story #88: the band view's divider moves in the direction of the key, and the backlog column
// takes 58% of the view by default (D16, D18, G33, G44, G45, G48).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { createSessionStore } from "./session.ts";
import { fakeGitHub } from "./testing/fakegraph.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const SYNC = {
    source: { project: "P", field: "F" },
    sprints: [{ id: "F#a", field: "F", iteration: "a", name: "Sprint a", start: "2030-01-01", end: "2030-01-14", origin: "github" }],
};

let root: HTMLElement;
let unmount: (() => void) | undefined;
let stored: Record<string, unknown>;
let prefs: PreferenceStore;
const space = { w: 1000 };
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    stored = {};
    space.w = 1000;
    prefs = { get: async (k: string) => stored[k], set: async (k: string, v: unknown) => void (stored[k] = v) };
    const original = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("rd-bands")
            ? ({ width: space.w, left: 0, right: space.w, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect)
            : original.call(this);
    });
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
    vi.restoreAllMocks();
});

async function open(): Promise<void> {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            session: createSessionStore(),
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            gateway: fakeGitHub({ issues: [{ n: 1 }], sync: SYNC }),
            repo: createRepoStore(WIDGETS),
        });
    });
    for (let i = 0; i < 8; i++) {
        await flush();
    }
}

const divider = (): HTMLElement => root.querySelector<HTMLElement>(".rd-divider")!;
const width = (): number => Number(divider().getAttribute("aria-valuenow"));
const shown = (): number => parseInt(root.querySelector<HTMLElement>(".rd-bands")!.style.getPropertyValue("--rd-backlog-w"), 10);
async function key(k: string, extra: KeyboardEventInit = {}): Promise<void> {
    await act(() => {
        divider().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));
    });
}
async function drag(from: number, to: number): Promise<void> {
    const ev = (type: string, x: number): void => {
        const e: Event = new Event(type, { bubbles: true, cancelable: true });
        Object.assign(e, { clientX: x, pointerId: 1 });
        divider().dispatchEvent(e);
    };
    divider().setPointerCapture = vi.fn();
    divider().releasePointerCapture = vi.fn();
    await act(() => ev("pointerdown", from));
    await act(() => ev("pointermove", to));
    await act(() => ev("pointerup", to));
}

describe("the band view's divider (D16, D18)", () => {
    it("reports the backlog column's width, and the column is on the right of the divider (G45)", async () => {
        await open();
        expect(width()).toBe(shown());
        const head = Array.from(root.querySelectorAll(".rd-bands__head > *"), (el) => el.className.split(" ").find((c) => c.startsWith("rd-bands__col--") || c === "rd-divider"));
        expect(head).toEqual(["rd-bands__col--goals", "rd-divider", "rd-bands__col--backlog"]);
    });

    it("takes 58% of the view by default, fitted to both minimums (G48)", async () => {
        await open();
        expect(shown()).toBe(580);
        expect(stored["backlogWidth"]).toBeUndefined();
        unmount?.();
        space.w = 700;
        root.innerHTML = "";
        await open();
        // 58% is 406, but the goal column must keep its minimum: 700 - 360 - 16.
        expect(shown()).toBe(324);
    });

    it("moves the divider in the direction of the key: Left widens the backlog, Right narrows it (G44)", async () => {
        await open();
        const start: number = width();
        await key("ArrowLeft");
        expect(width()).toBeGreaterThan(start);
        const wider: number = width();
        await key("ArrowRight");
        expect(width()).toBe(start);
        await key("ArrowLeft", { shiftKey: true });
        expect(width() - start).toBeGreaterThan(wider - start);
        await key("Home");
        expect(width()).toBe(Number(divider().getAttribute("aria-valuemin")));
        await key("End");
        expect(width()).toBe(Number(divider().getAttribute("aria-valuemax")));
    });

    it("widens the backlog on a drag to the left and narrows it on a drag to the right (G44)", async () => {
        await open();
        const start: number = width();
        await drag(500, 480);
        expect(width()).toBe(start + 20);
        expect(stored["backlogWidth"]).toBe(start + 20);
        await drag(500, 530);
        expect(width()).toBe(start - 10);
    });

    it("resets to 58% on double click and on Enter (G48)", async () => {
        await open();
        await key("ArrowLeft", { shiftKey: true });
        expect(width()).not.toBe(580);
        await act(() => {
            divider().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        });
        expect(width()).toBe(580);
        await key("ArrowLeft", { shiftKey: true });
        await key("Enter");
        expect(width()).toBe(580);
    });

    it("keeps one preferred width, fits it to the view and never overwrites it (G39, G45)", async () => {
        stored["backlogWidth"] = 900;
        space.w = 700;
        await open();
        expect(shown()).toBe(324);
        expect(stored["backlogWidth"]).toBe(900);
        space.w = 2000;
        await act(() => void window.dispatchEvent(new Event("resize")));
        expect(shown()).toBe(900);
    });
});
