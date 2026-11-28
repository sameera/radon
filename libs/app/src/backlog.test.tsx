// @vitest-environment jsdom
// The divider's keyboard range and the keys typed inside Raiden, on the band view. Story #104
// removed the sample page these first ran on; the live filter has its own tests.
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub } from "./testing/fakegraph.ts";

let root: HTMLElement;
let unmount: () => void;
let stored: Record<string, unknown>;
let prefs: PreferenceStore;

async function open(): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            repo: createRepoStore({ owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" }),
            gateway: fakeGitHub({
                issues: [{ n: 1, title: "One" }],
                sync: { sprints: [{ id: "a", field: "F", iteration: "a", name: "Sprint a", start: "2026-10-05", end: "2026-10-18", origin: "github" }], mayEdit: true },
            }),
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
        });
    });
    for (let i = 0; i < 8; i++) {
        await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
    }
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const divider = (): HTMLElement => $('[role="separator"].rd-divider');
const now = (): number => Number(divider().getAttribute("aria-valuenow"));

async function key(el: HTMLElement, k: string, init: KeyboardEventInit = {}): Promise<void> {
    await act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, composed: true, ...init }));
    });
}

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    stored = {};
    prefs = { get: async (k: string) => stored[k], set: async (k: string, v: unknown) => void (stored[k] = v) };
});
afterEach(() => {
    unmount?.();
    root.remove();
    vi.unstubAllGlobals();
});

describe("backlog divider", () => {
    it("is a focusable separator that reports the backlog width and its range", async () => {
        await open();
        expect(divider().getAttribute("tabindex")).toBe("0");
        expect(divider().getAttribute("aria-orientation")).toBe("vertical");
        const min: number = Number(divider().getAttribute("aria-valuemin"));
        const max: number = Number(divider().getAttribute("aria-valuemax"));
        expect(min).toBeLessThanOrEqual(now());
        expect(max).toBeGreaterThanOrEqual(now());
    });

    it("goes to the limits with Home and End, and stays at a limit", async () => {
        await open();
        const min: number = Number(divider().getAttribute("aria-valuemin"));
        const max: number = Number(divider().getAttribute("aria-valuemax"));
        await key(divider(), "Home");
        expect(now()).toBe(min);
        await key(divider(), "Home");
        expect(now()).toBe(min);
        await key(divider(), "End");
        expect(now()).toBe(max);
        expect(stored.groomBacklogWidth).toBe(max);
    });
});

describe("keys typed inside Raiden", () => {
    it("do not reach the page's own shortcut handlers when typed in the filter or a goal field", async () => {
        await open();
        const onPage = vi.fn();
        document.addEventListener("keydown", onPage);
        const fields: HTMLElement[] = [$('input[aria-label="Filter backlog"]'), $(".rd-band__card textarea")];
        expect(fields.every(Boolean)).toBe(true);
        for (const field of fields) {
            await key(field, "s");
            await key(field, ".");
        }
        expect(onPage).not.toHaveBeenCalled();
        document.removeEventListener("keydown", onPage);
    });
});
