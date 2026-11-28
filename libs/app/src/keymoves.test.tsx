// @vitest-environment jsdom
// Story #116: move a row with the keyboard inside its band and to the next band (D6, D9).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitHubRequest, GitHubResult } from "@raiden/shared";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, idOf, type FakeGitHub, type FakeIssue, type FakeOptions } from "./testing/fakegraph.ts";
import { MOVE_PATH } from "./moves.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const sprint = (id: string, start: string, end: string) => ({ id, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
// Band order on screen: milestone One's header, a, the "No milestone" break, b, c, then no sprint.
const SPRINTS = [sprint("c", "2027-01-04", "2027-01-17"), sprint("a", "2026-10-05", "2026-10-18"), sprint("b", "2026-10-19", "2026-11-01")];
const MILESTONES = [{ id: "M_1", number: 1, title: "One", due: "2026-10-18T00:00:00Z", description: "", state: "OPEN", origin: "github" }];
const ISSUES: FakeIssue[] = [
    { n: 1, title: "Parent", sprints: [["P", "F", "a"]] },
    { n: 2, title: "Child", parent: 1, sprints: [["P", "F", "a"]] },
    { n: 3, title: "Loose" },
    { n: 4, title: "In b", sprints: [["P", "F", "b"]] },
    { n: 5, title: "Also in b", sprints: [["P", "F", "b"]] },
];
const id = (n: number): string => idOf("acme/widgets", n);

let root: HTMLElement;
let unmount: (() => void) | undefined;
let prefs: PreferenceStore;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
        await flush();
    }
}

beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const stored: Record<string, unknown> = {};
    prefs = { get: async (k: string) => stored[k], set: async (k: string, v: unknown) => void (stored[k] = v) };
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
});

async function open(gateway: FakeGitHub): Promise<void> {
    unmount?.();
    root.innerHTML = "";
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            gateway,
            repo: createRepoStore(WIDGETS),
        });
    });
    await settle();
}

function live(o: Partial<FakeOptions> & { mayEdit?: boolean } = {}): FakeGitHub {
    const { mayEdit, ...rest } = o;
    return fakeGitHub({ issues: ISSUES, sync: { source: { project: "P", field: "F" }, sprints: SPRINTS, milestones: MILESTONES, mayEdit: mayEdit ?? true }, ...rest });
}

const $ = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
const band = (key: string): HTMLElement => (key === "none" ? $<HTMLElement>('.rd-band[data-band="none"]')! : $<HTMLElement>(`.rd-band[data-sprint="${key}"]`)!);
const rowsIn = (key: string): string[] => Array.from(band(key).querySelectorAll<HTMLElement>(".rd-lb-row"), (r) => r.dataset.num!);
const link = (n: number): HTMLElement => $<HTMLElement>(`.rd-lb-row[data-num="${n}"] .rd-ref`)!;
const moves = (g: FakeGitHub): GitHubRequest[] => g.backend.filter((r) => r.path === MOVE_PATH);
const targets = (g: FakeGitHub): (string | null)[] => moves(g).map((r) => (r.body as { sprint: string | null }).sprint);

async function press(n: number, k: "ArrowUp" | "ArrowDown", shift: boolean): Promise<void> {
    const el: HTMLElement = link(n);
    await act(async () => {
        el.focus();
        el.dispatchEvent(new KeyboardEvent("keydown", { key: k, altKey: true, shiftKey: shift, bubbles: true, cancelable: true }));
    });
    await settle();
}

function deferred(): { move: FakeOptions["move"]; answer(r: GitHubResult | undefined): Promise<void>; pending(): number } {
    const waiting: ((r: GitHubResult | undefined) => void)[] = [];
    return {
        move: () => new Promise<GitHubResult | undefined>((resolve) => waiting.push(resolve)),
        async answer(r) {
            waiting.shift()!(r);
            await settle();
        },
        pending: () => waiting.length,
    };
}

describe("keyboard moves between bands (story #116)", () => {
    it("moves a row to the top of the band below with Alt+Shift+Down, saves it, and keeps focus on it (AC1, G16)", async () => {
        const gateway = live();
        await open(gateway);
        await press(4, "ArrowDown", true);
        expect(rowsIn("c")).toEqual(["4"]);
        expect(rowsIn("b")).toEqual(["5"]);
        expect(moves(gateway)).toEqual([{ to: "backend", path: MOVE_PATH, method: "POST", body: { owner: "acme", name: "widgets", issue: id(4), sprint: "c" } }]);
        expect(document.activeElement).toBe(link(4));
        await press(5, "ArrowDown", true);
        expect(rowsIn("c")).toEqual(["5", "4"]);
        expect(document.activeElement).toBe(link(5));
        await open(gateway);
        expect(rowsIn("c").sort()).toEqual(["4", "5"]);
    });

    it("moves a row to the bottom of the band above with Alt+Shift+Up, saves it, and keeps focus on it (AC2, G17)", async () => {
        const gateway = live();
        await open(gateway);
        await press(4, "ArrowUp", true);
        expect(rowsIn("a")).toEqual(["1", "2", "4"]);
        expect(targets(gateway)).toEqual(["a"]);
        expect(document.activeElement).toBe(link(4));
        await press(3, "ArrowUp", true);
        expect(rowsIn("c")).toEqual(["3"]);
        expect(document.activeElement).toBe(link(3));
    });

    it("walks the bands in screen order, past the milestone header and the No milestone break, to the no-sprint band last (G20, D9)", async () => {
        const gateway = live();
        await open(gateway);
        await press(1, "ArrowDown", true);
        expect(rowsIn("b")[0]).toBe("1");
        await press(1, "ArrowDown", true);
        expect(rowsIn("c")).toEqual(["1"]);
        await press(1, "ArrowDown", true);
        expect(rowsIn("none")[0]).toBe("1");
        await press(1, "ArrowUp", true);
        await press(1, "ArrowUp", true);
        await press(1, "ArrowUp", true);
        expect(rowsIn("a")).toContain("1");
        expect(targets(gateway)).toEqual(["b", "c", null, "c", "b", "a"]);
        expect(document.activeElement).toBe(link(1));
    });

    it("moves nothing and sends nothing from the last band down or the first band up (AC3, G18)", async () => {
        const gateway = live();
        await open(gateway);
        await press(3, "ArrowDown", true);
        await press(1, "ArrowUp", true);
        expect(rowsIn("none")).toEqual(["3"]);
        expect(rowsIn("a")).toEqual(["1", "2"]);
        expect(moves(gateway)).toEqual([]);
    });

    it("keeps Alt+Up and Alt+Down as a reorder inside the band that sends nothing and keeps the sprint (AC4, G19)", async () => {
        for (const mayEdit of [true, false]) {
            const gateway = live({ mayEdit });
            await open(gateway);
            await press(5, "ArrowUp", false);
            expect(rowsIn("b")).toEqual(["5", "4"]);
            await press(5, "ArrowDown", false);
            expect(rowsIn("b")).toEqual(["4", "5"]);
            await press(4, "ArrowUp", false);
            expect(rowsIn("b")).toEqual(["4", "5"]);
            expect(rowsIn("a")).toEqual(["1", "2"]);
            expect(moves(gateway)).toEqual([]);
            expect(gateway.backend.filter((r) => r.path !== "/grooming/sync")).toEqual([]);
        }
    });

    it("moves nothing for a person without the maintain or admin role (G26)", async () => {
        const gateway = live({ mayEdit: false });
        await open(gateway);
        await press(4, "ArrowDown", true);
        await press(4, "ArrowUp", true);
        expect(rowsIn("b")).toEqual(["4", "5"]);
        expect(moves(gateway)).toEqual([]);
    });

    it("sends quick presses one at a time and saves the last band (G22, D6)", async () => {
        const d = deferred();
        const gateway = live({ move: d.move });
        await open(gateway);
        await press(4, "ArrowDown", true);
        await press(4, "ArrowDown", true);
        expect(rowsIn("none")[0]).toBe("4");
        expect(d.pending()).toBe(1);
        await d.answer(undefined);
        await d.answer(undefined);
        expect(targets(gateway)).toEqual(["c", null]);
        expect(gateway.assignments[id(4)]).toBe(null);
    });

    it("returns the row to its saved band when a keyboard move fails, and keeps focus on it (G21)", async () => {
        const gateway = live({ move: () => ({ ok: false, kind: "permission" }) });
        await open(gateway);
        await press(4, "ArrowDown", true);
        expect(rowsIn("b")).toContain("4");
        expect(rowsIn("c")).toEqual([]);
        expect($(".rd-bands__notice")?.textContent).toBe("The move of #4 was not saved. You are not allowed to move this repository's issues.");
        expect(document.activeElement).toBe(link(4));
    });
});
