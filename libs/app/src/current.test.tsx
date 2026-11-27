// @vitest-environment jsdom
// Story #91: the current sprint shows the one glow and a progress bar (D10, G31, G32).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { createSessionStore } from "./session.ts";
import { fakeGitHub, type FakeGitHub, type FakeIssue, type FakeSync } from "./testing/fakegraph.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const sprint = (id: string, start: string, end: string) => ({ id: `F#${id}`, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
const SYNC: FakeSync = {
    source: { project: "P", field: "F" },
    sprints: [sprint("a", "2026-11-02", "2026-11-15"), sprint("b", "2026-11-16", "2026-11-29"), sprint("c", "2026-11-30", "2026-12-13")],
};
const inB: [string, string, string] = ["P", "F", "b"];

let root: HTMLElement;
let unmount: (() => void) | undefined;
let stored: Record<string, unknown>;
let prefs: PreferenceStore;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0));
    root = document.createElement("div");
    document.body.appendChild(root);
    stored = {};
    prefs = { get: async (k: string) => stored[k], set: async (k: string, v: unknown) => void (stored[k] = v) };
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
    vi.useRealTimers();
});

async function open(issues: FakeIssue[], sync: FakeSync = SYNC): Promise<FakeGitHub> {
    const gateway = fakeGitHub({ issues, sync });
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            session: createSessionStore(),
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            gateway,
            repo: createRepoStore(WIDGETS),
        });
    });
    for (let i = 0; i < 10; i++) {
        await flush();
    }
    return gateway;
}

// Nine open and three closed issues in sprint b, one in sprint a, one in another repository.
function sprintB(): FakeIssue[] {
    const out: FakeIssue[] = [];
    for (let n = 1; n <= 12; n++) {
        out.push({ n, sprints: [inB], state: n <= 3 ? "CLOSED" : "OPEN" });
    }
    out.push({ n: 40, sprints: [["P", "F", "a"]] });
    out.push({ n: 41, repo: "acme/other", sprints: [inB], inQuery: false });
    return out;
}

const glowing = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(".is-current, .rd-glow"));

describe("the current sprint (story #91)", () => {
    it("gives the band of the sprint containing today the only glow (AC1, G31)", async () => {
        await open(sprintB());
        expect(glowing().map((el) => el.dataset.sprint)).toEqual(["F#b"]);
        expect(root.querySelectorAll(".rd-btn--primary")).toHaveLength(0);
    });

    it("shows the closed share of all its issues in GitHub, open and closed: 3 of 12 is 25% (AC2, G32)", async () => {
        await open(sprintB());
        const bar = root.querySelector<HTMLElement>('.rd-band[data-sprint="F#b"] .rd-progress')!;
        expect(bar.getAttribute("aria-label")).toBe("3 of 12 issues closed, 25%");
        expect(bar.querySelector<HTMLElement>(".rd-progress__seg--done")!.style.width).toBe("25%");
        expect(root.querySelector('.rd-band[data-sprint="F#b"] .rd-progress__legend')!.textContent).toContain("3 of 12 closed");
        expect(root.querySelectorAll(".rd-progress")).toHaveLength(1);
    });

    it("picks the earliest start when several sprints contain today (D10)", async () => {
        await open(sprintB(), { ...SYNC, sprints: [...SYNC.sprints!, sprint("z", "2026-11-10", "2026-11-25")] });
        expect(glowing().map((el) => el.dataset.sprint)).toEqual(["F#z"]);
    });

    it("shows no glow and no progress bar when no sprint contains today (AC3)", async () => {
        vi.setSystemTime(new Date(2027, 5, 1, 12, 0, 0));
        await open(sprintB());
        expect(glowing()).toHaveLength(0);
        expect(root.querySelector(".rd-progress")).toBeNull();
    });

    it("fails the load rather than show a bar from an incomplete read (D10)", async () => {
        await open([...sprintB(), { n: 50, sprints: [inB], moreValues: true, inQuery: false, state: "CLOSED" }]);
        expect(root.querySelector(".rd-band")).toBeNull();
        expect(Array.from(root.querySelectorAll("button")).filter((b) => b.textContent === "Try again")).toHaveLength(1);
    });
});
