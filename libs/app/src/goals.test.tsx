// @vitest-environment jsdom
// Story #103: the lead writes and edits a sprint goal (D1-D8).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitHubRequest, GitHubResult } from "@raiden/shared";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo, type RepoStore } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, type FakeGitHub, type FakeOptions } from "./testing/fakegraph.ts";
import { GOAL_CAP, GOAL_PATH, normalizeGoal } from "./goals.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const GADGETS: Repo = { owner: "acme", name: "gadgets", url: "https://github.com/acme/gadgets" };
const sprint = (id: string, start: string, end: string) => ({ id, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
const SPRINTS = [sprint("a", "2026-10-05", "2026-10-18"), sprint("b", "2026-10-19", "2026-11-01")];

let root: HTMLElement;
let unmount: (() => void) | undefined;
let prefs: PreferenceStore;
let repos: RepoStore;
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

async function open(gateway: FakeGitHub, login = "ada"): Promise<void> {
    unmount?.();
    root.innerHTML = "";
    repos = createRepoStore(WIDGETS);
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            signIn: createSignInController({ status: async () => login, signIn: async () => ({ login }) }),
            gateway,
            repo: repos,
        });
    });
    await settle();
}

function live(o: Partial<FakeOptions> & { goals?: Record<string, string>; mayEdit?: boolean } = {}): FakeGitHub {
    const { goals, mayEdit, ...rest } = o;
    return fakeGitHub({ issues: [{ n: 1, title: "One" }], sync: { sprints: SPRINTS, goals, mayEdit: mayEdit ?? true }, ...rest });
}

const $ = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const card = (id: string): HTMLElement => $<HTMLElement>(`.rd-band[data-sprint="${id}"] .rd-band__card`)!;
const field = (id: string): HTMLTextAreaElement | null => card(id).querySelector<HTMLTextAreaElement>("textarea");
const goalWrites = (g: FakeGitHub): GitHubRequest[] => g.backend.filter((r) => r.path === GOAL_PATH);

async function type(id: string, text: string): Promise<void> {
    const f: HTMLTextAreaElement = field(id)!;
    await act(async () => {
        f.focus();
        f.value = text;
        f.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function leave(id: string): Promise<void> {
    await act(async () => field(id)!.blur());
    await settle();
}
async function write(id: string, text: string): Promise<void> {
    await type(id, text);
    await leave(id);
}

// A goal write the test answers by hand.
function deferred(): { goal: FakeOptions["goal"]; answer(r: GitHubResult | undefined): Promise<void>; pending(): number } {
    const waiting: ((r: GitHubResult | undefined) => void)[] = [];
    return {
        goal: () => new Promise<GitHubResult | undefined>((resolve) => waiting.push(resolve)),
        async answer(r) {
            waiting.shift()!(r);
            await settle();
        },
        pending: () => waiting.length,
    };
}

describe("sprint goals (story #103)", () => {
    it("shows a written goal in its card once the lead leaves the field (AC1, G1)", async () => {
        const gateway = live();
        await open(gateway);
        expect(field("a")!.placeholder).toBe("Set sprint goal");
        await write("a", "Pilot team plans its next sprint");
        expect(field("a")!.value).toBe("Pilot team plans its next sprint");
        expect(goalWrites(gateway)).toEqual([
            { to: "backend", path: GOAL_PATH, method: "POST", body: { owner: "acme", name: "widgets", sprint: "a", text: "Pilot team plans its next sprint" } },
        ]);
        expect(card("a").textContent).not.toMatch(/Saving|Not saved/);
    });

    it("marks the goal as saving while its write is in flight (G1)", async () => {
        const d = deferred();
        await open(live({ goal: d.goal }));
        await write("a", "Ship it");
        expect(field("a")!.value).toBe("Ship it");
        expect(card("a").textContent).toContain("Saving");
        await d.answer(undefined);
        expect(card("a").textContent).not.toContain("Saving");
    });

    it("shows the saved goal after a reload, and an edit replaces it (AC2, AC3, G2, G3)", async () => {
        const gateway = live({ goals: { a: "Old goal" } });
        await open(gateway);
        expect(field("a")!.value).toBe("Old goal");
        await write("a", "New goal");
        await open(gateway);
        expect(field("a")!.value).toBe("New goal");
        expect(card("a").querySelectorAll("textarea")).toHaveLength(1);
        expect(gateway.goals).toEqual({ a: "New goal" });
    });

    it("shows the same goal to another signed-in person, as text when they may not edit (AC4, G4, G14)", async () => {
        const gateway = live();
        await open(gateway);
        await write("b", "Ship the pilot");
        const other = live({ goals: gateway.goals, mayEdit: false });
        await open(other, "bob");
        expect(field("b")).toBeNull();
        expect(card("b").querySelector(".rd-band__goal")!.textContent).toBe("Ship the pilot");
        expect(card("a").querySelector(".rd-band__goal")).toBeNull();
        expect($$("textarea")).toHaveLength(0);
    });

    it("keeps the text when a save fails, says why, and Try again resends it (AC5, G10, G11)", async () => {
        let fail = true;
        const gateway = live({ goals: { b: "Keep me" }, goal: () => (fail ? { ok: false, kind: "permission" } : undefined) });
        await open(gateway);
        await write("a", "Unsaved goal");
        expect(field("a")!.value).toBe("Unsaved goal");
        const alert = card("a").querySelector('[role="alert"]')!;
        expect(alert.textContent).toContain("Not saved");
        expect(alert.textContent).toMatch(/not allowed/i);
        expect(field("b")!.value).toBe("Keep me");
        expect(card("b").textContent).not.toContain("Not saved");
        expect(gateway.goals).toEqual({ b: "Keep me" });
        fail = false;
        const retry = Array.from(card("a").querySelectorAll("button")).find((b) => b.textContent === "Try again")!;
        await act(async () => retry.click());
        await settle();
        expect(goalWrites(gateway).map((r) => (r.body as { text: string }).text)).toEqual(["Unsaved goal", "Unsaved goal"]);
        expect(card("a").textContent).not.toContain("Not saved");
        expect(gateway.goals).toEqual({ a: "Unsaved goal", b: "Keep me" });
    });

    it("names an unavailable backend as the cause (D6)", async () => {
        await open(live({ goal: () => ({ ok: false, kind: "network" }) }));
        await write("a", "Ship it");
        expect(card("a").querySelector('[role="alert"]')!.textContent).toMatch(/backend/i);
    });

    it("drops unsaved text on a reload (D6)", async () => {
        const gateway = live({ goals: { a: "Saved" }, goal: () => ({ ok: false, kind: "other" }) });
        await open(gateway);
        await write("a", "Lost");
        await open(gateway);
        expect(field("a")!.value).toBe("Saved");
    });

    it("sends nothing when the text is unchanged, and Enter ends the edit (G6, D5)", async () => {
        const gateway = live({ goals: { a: "Same" } });
        await open(gateway);
        await write("a", "  Same  ");
        expect(goalWrites(gateway)).toHaveLength(0);
        await type("a", "Changed");
        await act(async () => {
            field("a")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        });
        await settle();
        expect(goalWrites(gateway)).toHaveLength(1);
        expect(document.activeElement).not.toBe(field("a"));
    });

    it("keeps one write in flight per card and stores the last text left in the field (G6, D5)", async () => {
        const d = deferred();
        const gateway = live({ goal: d.goal });
        await open(gateway);
        await write("a", "First");
        await write("a", "Second");
        await write("a", "Third");
        expect(goalWrites(gateway)).toHaveLength(1);
        await d.answer(undefined);
        expect(goalWrites(gateway).map((r) => (r.body as { text: string }).text)).toEqual(["First", "Third"]);
        expect(d.pending()).toBe(1);
        await d.answer(undefined);
        expect(goalWrites(gateway)).toHaveLength(2);
        expect(field("a")!.value).toBe("Third");
        expect(card("a").textContent).not.toContain("Saving");
    });

    it("removes the goal when the lead clears the text and leaves the field (G5)", async () => {
        const gateway = live({ goals: { a: "Old" } });
        await open(gateway);
        await write("a", "   ");
        expect((goalWrites(gateway)[0]!.body as { text: string }).text).toBe("");
        await open(gateway);
        expect(field("a")!.value).toBe("");
        expect(gateway.goals).toEqual({});
    });

    it("caps a goal at 200 characters and keeps it on one line (G7, D7)", async () => {
        const gateway = live();
        await open(gateway);
        expect(GOAL_CAP).toBe(200);
        expect(field("a")!.maxLength).toBe(200);
        expect(normalizeGoal("  one\r\ntwo\nthree  ")).toBe("one two three");
        expect(Array.from(normalizeGoal("é".repeat(250)))).toHaveLength(200);
        await write("a", "line one\nline two");
        expect((goalWrites(gateway)[0]!.body as { text: string }).text).toBe("line one line two");
    });

    it("shows a goal as plain text, never as markup (G8)", async () => {
        const markup = '<b class="x">Bold</b><img src=x>';
        await open(live({ goals: { a: markup }, mayEdit: false }));
        const goal = card("a").querySelector(".rd-band__goal")!;
        expect(goal.textContent).toBe(markup);
        expect(goal.querySelector("b, img")).toBeNull();
    });

    it("gives each sprint card at most one goal, and the no-sprint band none (G9, D8)", async () => {
        await open(live({ goals: { a: "Past goal" } }));
        for (const id of ["a", "b"]) {
            expect(card(id).querySelectorAll("textarea, .rd-band__goal")).toHaveLength(1);
        }
        const none = $<HTMLElement>('.rd-band[data-band="none"] .rd-band__card')!;
        expect(none.querySelectorAll("textarea, .rd-band__goal")).toHaveLength(0);
    });

    it("lands a running save on its own repository and sprint, never on the next one's page (G12)", async () => {
        const d = deferred();
        const gateway = live({ goal: d.goal });
        await open(gateway);
        await write("a", "Widgets goal");
        await act(async () => repos.set(GADGETS));
        await settle();
        await d.answer({ ok: false, kind: "other" });
        expect(goalWrites(gateway)[0]!.body).toEqual({ owner: "acme", name: "widgets", sprint: "a", text: "Widgets goal" });
        expect(root.textContent).not.toMatch(/Not saved|Widgets goal/);
        expect(field("a")!.value).toBe("");
    });

    it("sends no request to GitHub while goals are written (G17)", async () => {
        const gateway = live();
        await open(gateway);
        const before = gateway.requests.length;
        await write("a", "One");
        await write("b", "Two");
        expect(gateway.requests.length).toBe(before);
    });
});
