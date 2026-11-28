// @vitest-environment jsdom
// Story #104: the sample goals and their ranking are removed (D9, D10).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountApp, type AppOptions, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, type FakeGitHub } from "./testing/fakegraph.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const sprint = (id: string, start: string, end: string) => ({ id, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
const milestone = (n: number, title: string, due: string) => ({ id: `M_${n}`, number: n, title, due, description: "", state: "OPEN", origin: "github" });
// Words only the sample page used: its goals, ranks, plan controls and summary.
const SAMPLE_WORDS: RegExp = /Save plan|Undo|Show issues|epics planned|not planned|Add goal|Plan in|Take out of plan|Drag initiatives|Drop an initiative/i;

let root: HTMLElement;
let unmount: (() => void) | undefined;
let prefs: PreferenceStore;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

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

async function open(options: Partial<AppOptions>): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { prefs, repo: createRepoStore(WIDGETS), ...options });
    });
    for (let i = 0; i < 8; i++) {
        await flush();
    }
}

function live(o: { mayEdit?: boolean; goals?: Record<string, string> } = {}): FakeGitHub {
    return fakeGitHub({
        issues: [{ n: 1, title: "One", sprints: [["P", "F", "s2"]] }, { n: 2, title: "Two" }],
        sync: {
            source: { project: "P", field: "F" },
            sprints: [sprint("s3", "2026-12-28", "2027-01-10"), sprint("s1", "2026-10-05", "2026-10-18"), sprint("s2", "2026-10-19", "2026-11-01")],
            milestones: [milestone(2, "Two", "2027-01-31T00:00:00Z"), milestone(1, "One", "2026-11-15T00:00:00Z")],
            goals: o.goals ?? { s1: "First goal", s2: "Second goal", s3: "Third goal" },
            mayEdit: o.mayEdit ?? true,
        },
    });
}
const signedIn = () => createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) });

const $ = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const goalTexts = (): string[] =>
    $$<HTMLElement>(".rd-band[data-sprint] .rd-band__card").map((c) => {
        const f = c.querySelector<HTMLTextAreaElement>("textarea");
        return f ? f.value : (c.querySelector(".rd-band__goal")?.textContent ?? "");
    });

describe("sample goals removed (story #104)", () => {
    it("shows no sample page in a host with no live GitHub connection, only a sign-in note (AC1, G18, G23)", async () => {
        await open({});
        const note = $<HTMLElement>(".rd-groom-note");
        expect(note?.textContent).toMatch(/Grooming needs a GitHub sign-in/);
        expect(root.textContent).not.toMatch(SAMPLE_WORDS);
        expect($$(".rd-goal-card, .rd-goals, .rd-backlog, .rd-band, .rd-switch")).toHaveLength(0);
        expect($$("button").map((b) => b.textContent)).not.toContain("Undo");
    });

    it("shows no sample goal for a signed-in lead (AC1, G18)", async () => {
        await open({ gateway: live(), signIn: signedIn() });
        expect(root.textContent).not.toMatch(SAMPLE_WORDS);
        expect($$(".rd-goal-card, .rd-goals")).toHaveLength(0);
    });

    it("shows no rank, and goals follow milestone order then sprint order (AC2, G19, D9)", async () => {
        for (const mayEdit of [true, false]) {
            unmount?.();
            root.innerHTML = "";
            await open({ gateway: live({ mayEdit }), signIn: signedIn() });
            expect(goalTexts()).toEqual(["First goal", "Second goal", "Third goal"]);
            expect($$(".rd-goal-card__rank")).toHaveLength(0);
            for (const c of $$<HTMLElement>(".rd-band__card")) {
                expect(c.textContent).not.toMatch(/^\s*\d+\s/);
            }
        }
    });

    it("gives each sprint exactly one goal card and no control to add, delete or reorder goals (AC3, G20)", async () => {
        await open({ gateway: live(), signIn: signedIn() });
        const bands = $$<HTMLElement>(".rd-band[data-sprint]");
        expect(bands).toHaveLength(3);
        for (const b of bands) {
            expect(b.querySelectorAll(".rd-band__card")).toHaveLength(1);
            expect(b.querySelectorAll(".rd-band__card textarea")).toHaveLength(1);
        }
        const names = $$<HTMLElement>("button, [role='menuitem']").map((b) => `${b.textContent} ${b.getAttribute("aria-label") ?? ""}`);
        expect(names.join("|")).not.toMatch(/add goal|delete goal|remove goal|move up|move down/i);
        expect($$(".rd-band__card [draggable='true'], .rd-goal-card__grip")).toHaveLength(0);
    });

    it("has no menu entry, drop or button that plans an item into a goal (AC4, G21)", async () => {
        await open({ gateway: live(), signIn: signedIn() });
        for (const trigger of $$<HTMLButtonElement>(".rd-lb-row button[aria-haspopup]")) {
            await act(async () => trigger.click());
            expect(root.textContent).not.toMatch(/Plan in|Take out of plan/);
        }
        expect(root.textContent).not.toMatch(/Plan in|Take out of plan/);
        expect($$(".rd-goal-card__drop, .rd-takeout")).toHaveLength(0);
        // A drop of a backlog row on a goal card plans nothing and changes no goal.
        const row = $<HTMLElement>(".rd-lb-row")!;
        const card = $<HTMLElement>(".rd-band__card")!;
        const drag = (el: Element, type: string): Event => {
            const event: Event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, "dataTransfer", { value: { setData: () => {}, getData: () => "", effectAllowed: "", dropEffect: "" } });
            el.dispatchEvent(event);
            return event;
        };
        await act(async () => {
            drag(row, "dragstart");
            expect(drag(card, "dragover").defaultPrevented).toBe(false);
            drag(card, "drop");
            drag(row, "dragend");
        });
        expect(goalTexts()).toEqual(["First goal", "Second goal", "Third goal"]);
    });

    it("shows no count on the Grooming sidebar item, live or not (AC4, G22)", async () => {
        await open({});
        const item = (): HTMLElement => $$<HTMLElement>(".rd-nav-item").find((b) => b.textContent?.includes("Grooming"))!;
        expect(item().querySelector(".rd-nav-item__count")).toBeNull();
        expect(item().getAttribute("aria-label") ?? "Grooming").toBe("Grooming");
        unmount?.();
        root.innerHTML = "";
        await open({ gateway: live(), signIn: signedIn() });
        expect(item().querySelector(".rd-nav-item__count")).toBeNull();
        expect($$(".rd-nav-item__count")).toHaveLength(0);
    });
});
