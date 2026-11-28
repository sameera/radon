// @vitest-environment jsdom
// Story #90: issues with no sprint sit in a last band (D6, G21, G23).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, type FakeIssue, type FakeSync } from "./testing/fakegraph.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const sprint = (id: string, start: string) => ({ id: `F#${id}`, field: "F", iteration: id, name: `Sprint ${id}`, start, end: start, origin: "github" });

let root: HTMLElement;
let unmount: (() => void) | undefined;
let stored: Record<string, unknown>;
let prefs: PreferenceStore;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    stored = {};
    prefs = { get: async (k: string) => stored[k], set: async (k: string, v: unknown) => void (stored[k] = v) };
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
});

async function open(issues: FakeIssue[], sync: FakeSync): Promise<void> {
    const gateway = fakeGitHub({ issues, sync });
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            gateway,
            repo: createRepoStore(WIDGETS),
        });
    });
    for (let i = 0; i < 8; i++) {
        await flush();
    }
}

const last = (): HTMLElement | null => root.querySelector<HTMLElement>('.rd-band[data-band="none"]');
const rowsIn = (el: Element | null): string[] => Array.from(el?.querySelectorAll<HTMLElement>(".rd-lb-row") ?? [], (r) => r.dataset.num!);

describe("the no-sprint band (story #90)", () => {
    it("puts an issue with no sprint, or one that matches no sprint, in a band after every sprint band (AC1, G23)", async () => {
        await open(
            [{ n: 1, sprints: [["P", "F", "a"]] }, { n: 2 }, { n: 3, sprints: [["P", "F", "gone"]] }, { n: 4, sprints: [["Q", "F", "a"]] }],
            { source: { project: "P", field: "F" }, sprints: [sprint("a", "2026-11-02")], milestones: [{ id: "M", number: 1, title: "Someday", due: "", description: "", state: "OPEN", origin: "github" }] },
        );
        const bands = Array.from(root.querySelectorAll<HTMLElement>(".rd-band, .rd-milestone"));
        expect(bands[bands.length - 1]).toBe(last());
        expect(rowsIn(last())).toEqual(["2", "3", "4"]);
        expect(rowsIn(root.querySelector('.rd-band[data-sprint="F#a"]'))).toEqual(["1"]);
    });

    it("holds every backlog issue when the repository has no linked project (AC2)", async () => {
        await open([{ n: 1 }, { n: 2, parent: 1 }, { n: 3 }], { source: null, sprints: [] });
        expect(rowsIn(last())).toEqual(["1", "2", "3"]);
        // G21: every query issue is a row, a parent too, exactly once.
        expect(root.querySelectorAll(".rd-lb-row")).toHaveLength(3);
    });

    it("labels the band as holding issues with no sprint (AC3)", async () => {
        await open([{ n: 1 }], { source: null, sprints: [] });
        expect(last()!.querySelector(".rd-band__name")!.textContent).toBe("No sprint");
        expect(last()!.getAttribute("aria-label")).toBe("Issues with no sprint");
    });

    it("still says the repository has no open issues when the query returns none", async () => {
        await open([], { source: null, sprints: [sprint("a", "2026-11-02")] });
        expect(root.textContent).toContain("This repository has no open issues.");
    });
});
