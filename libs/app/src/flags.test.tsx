// @vitest-environment jsdom
// Story #115: Raiden's sprint wins and the row shows an unsynced-with-GitHub flag (D4, D5, D7, D11, D12).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubRequest } from "@raiden/shared";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, idOf, type FakeGitHub, type FakeIssue } from "./testing/fakegraph.ts";
import { MOVE_MARKER, MOVE_PATH } from "./moves.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const sprint = (id: string, start: string, end: string) => ({ id, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
// Sprint b is the current sprint on the fixed test date.
const SPRINTS = [sprint("a", "2026-11-02", "2026-11-15"), sprint("b", "2026-11-16", "2026-11-29"), sprint("c", "2026-11-30", "2026-12-13")];
const id = (n: number): string => idOf("acme/widgets", n);
const inSprint = (s: string): [string, string, string][] => [["P", "F", s]];

let root: HTMLElement;
let unmount: (() => void) | undefined;
let prefs: PreferenceStore;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) {
        await flush();
    }
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0));
    root = document.createElement("div");
    document.body.appendChild(root);
    const stored: Record<string, unknown> = {};
    prefs = { get: async (k: string) => stored[k], set: async (k: string, v: unknown) => void (stored[k] = v) };
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
    vi.useRealTimers();
});

// Opens Grooming on GitHub's `issues` with Raiden's saved `assignments`.
async function open(issues: FakeIssue[], assignments: Record<string, string | null> = {}, mayEdit = true): Promise<FakeGitHub> {
    unmount?.();
    root.innerHTML = "";
    const gateway = fakeGitHub({ issues, sync: { source: { project: "P", field: "F" }, sprints: SPRINTS, assignments, mayEdit } });
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            gateway,
            repo: createRepoStore(WIDGETS),
        });
    });
    await settle();
    return gateway;
}

const $ = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const band = (key: string): HTMLElement => (key === "none" ? $<HTMLElement>('.rd-band[data-band="none"]')! : $<HTMLElement>(`.rd-band[data-sprint="${key}"]`)!);
const rowsIn = (key: string): string[] => Array.from(band(key).querySelectorAll<HTMLElement>(".rd-lb-row"), (r) => r.dataset.num!);
const row = (n: number): HTMLElement => $<HTMLElement>(`.rd-lb-row[data-num="${n}"]`)!;
const flag = (n: number): string | null => row(n).querySelector(".rd-lb-flag")?.textContent ?? null;
const flagged = (): string[] => $$<HTMLElement>(".rd-lb-row").filter((r) => r.querySelector(".rd-lb-flag")).map((r) => r.dataset.num!).sort();
const moves = (g: FakeGitHub): GitHubRequest[] => g.backend.filter((r) => r.path === MOVE_PATH);

class Transfer {
    data: Map<string, string> = new Map();
    effectAllowed: string = "";
    dropEffect: string = "";
    get types(): string[] {
        return [...this.data.keys()];
    }
    setData(type: string, value: string): void {
        this.data.set(type, value);
    }
    getData(type: string): string {
        return this.data.get(type) ?? "";
    }
}
async function dragOnto(from: Element, onto: Element): Promise<void> {
    const dt = new Transfer();
    const fire = (el: Element, type: string): void => {
        const event: Event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", { value: dt });
        el.dispatchEvent(event);
    };
    await act(async () => {
        fire(from, "dragstart");
        fire(onto, "dragover");
        fire(onto, "drop");
        fire(from, "dragend");
    });
    await settle();
    expect(dt.types).toEqual([MOVE_MARKER]);
}

describe("Raiden's sprint wins, with an unsynced-with-GitHub flag (story #115)", () => {
    it("shows a row in Raiden's sprint with a flag naming its GitHub sprint, or saying it has none, and flags no other row (AC1, G9, D4)", async () => {
        await open(
            [
                { n: 1, sprints: inSprint("b") },
                { n: 2 },
                { n: 3, sprints: inSprint("a") },
                { n: 4, sprints: inSprint("a") },
                { n: 5, sprints: inSprint("c") },
            ],
            { [id(1)]: "c", [id(2)]: "a", [id(3)]: null, [id(4)]: "a" },
        );
        expect(rowsIn("c")).toEqual(["1", "5"]);
        expect(flag(1)).toBe("In GitHub: Sprint b");
        expect(rowsIn("a")).toEqual(["2", "4"]);
        expect(flag(2)).toBe("In GitHub: no sprint");
        expect(rowsIn("none")).toEqual(["3"]);
        expect(flag(3)).toBe("In GitHub: Sprint a");
        // Issue 4's saved sprint equals its GitHub sprint, and issue 5 has no saved sprint.
        expect(flagged()).toEqual(["1", "2", "3"]);
    });

    it("keeps the row in Raiden's sprint when GitHub moves it to a third sprint, and the flag names the new one (AC2, G10, D5)", async () => {
        const saved = { [id(1)]: "c" };
        await open([{ n: 1, sprints: inSprint("b") }], saved);
        expect(flag(1)).toBe("In GitHub: Sprint b");
        await open([{ n: 1, sprints: inSprint("a") }], saved);
        expect(rowsIn("c")).toEqual(["1"]);
        expect(flag(1)).toBe("In GitHub: Sprint a");
    });

    it("drops the flag once GitHub's sprint equals Raiden's, and keeps Raiden's sprint when GitHub changes again (AC3, G11)", async () => {
        const saved = { [id(1)]: "c" };
        await open([{ n: 1, sprints: inSprint("c") }], saved);
        expect(rowsIn("c")).toEqual(["1"]);
        expect(flag(1)).toBeNull();
        await open([{ n: 1, sprints: inSprint("b") }], saved);
        expect(rowsIn("c")).toEqual(["1"]);
        expect(flag(1)).toBe("In GitHub: Sprint b");
    });

    it("stores a move back to the GitHub sprint, drops the flag, and keeps that sprint when GitHub later changes (AC3, G11, D5)", async () => {
        const gateway = await open([{ n: 1, sprints: inSprint("b") }], { [id(1)]: "c" });
        await dragOnto(row(1), band("b"));
        expect(rowsIn("b")).toEqual(["1"]);
        expect(flag(1)).toBeNull();
        expect(moves(gateway).map((r) => (r.body as { sprint: string }).sprint)).toEqual(["b"]);
        expect(gateway.assignments).toEqual({ [id(1)]: "b" });
        await open([{ n: 1, sprints: inSprint("a") }], gateway.assignments);
        expect(rowsIn("b")).toEqual(["1"]);
        expect(flag(1)).toBe("In GitHub: Sprint a");
    });

    it("flags a row as soon as the lead moves it away from its GitHub sprint (G9)", async () => {
        await open([{ n: 1, sprints: inSprint("b") }, { n: 2, sprints: inSprint("a") }]);
        expect(flagged()).toEqual([]);
        await dragOnto(row(1), band("none"));
        expect(flag(1)).toBe("In GitHub: Sprint b");
        await dragOnto(row(2), band("c"));
        expect(flag(2)).toBe("In GitHub: Sprint a");
        expect(flagged()).toEqual(["1", "2"]);
    });

    it("shows an issue Raiden holds no sprint assignment for in its GitHub sprint's band with no flag (AC4, G12, D11)", async () => {
        await open([{ n: 1, sprints: inSprint("b") }, { n: 2 }], {});
        expect(rowsIn("b")).toEqual(["1"]);
        expect(rowsIn("none")).toEqual(["2"]);
        expect(flagged()).toEqual([]);
    });

    it("lets a row whose saved sprint no longer exists follow GitHub with no flag (G13, D7)", async () => {
        await open([{ n: 1, sprints: inSprint("b") }, { n: 2 }], { [id(1)]: "gone", [id(2)]: "F#deleted" });
        expect(rowsIn("b")).toEqual(["1"]);
        expect(rowsIn("none")).toEqual(["2"]);
        expect(flagged()).toEqual([]);
    });

    it("makes the flag worded text that is not a control, and gives rows no edit control on the issue's own data (G14)", async () => {
        for (const mayEdit of [true, false]) {
            await open([{ n: 1, title: "Flagged", sprints: inSprint("b") }], { [id(1)]: "c" }, mayEdit);
            const f: HTMLElement = row(1).querySelector<HTMLElement>(".rd-lb-flag")!;
            expect(f.tagName).toBe("SPAN");
            expect(f.textContent).toBe("In GitHub: Sprint b");
            expect(f.hasAttribute("tabindex")).toBe(false);
            expect(f.getAttribute("role")).toBeNull();
            expect(f.closest("a, button")).toBeNull();
            expect(row(1).querySelectorAll("input, textarea, select, button, [contenteditable]")).toHaveLength(0);
        }
    });

    it("says the no-sprint band holds issues with no sprint, without 'in GitHub' (G15)", async () => {
        await open([{ n: 1 }]);
        const card: HTMLElement = band("none").querySelector<HTMLElement>(".rd-band__card")!;
        expect(card.textContent).toMatch(/no sprint/i);
        expect(card.textContent).not.toMatch(/in GitHub/i);
    });

    it("keeps counting the current sprint's issues in GitHub on its progress bar (G37, D12)", async () => {
        const issues: FakeIssue[] = [
            { n: 1, sprints: inSprint("b"), state: "CLOSED" },
            { n: 2, sprints: inSprint("b") },
            { n: 3, sprints: inSprint("b") },
            { n: 4, sprints: inSprint("a") },
        ];
        await open(issues, { [id(2)]: "c", [id(4)]: "b" });
        expect(rowsIn("b")).toEqual(["3", "4"]);
        expect(band("b").querySelector(".rd-progress__legend")!.textContent).toContain("1 of 3 closed");
    });
});
