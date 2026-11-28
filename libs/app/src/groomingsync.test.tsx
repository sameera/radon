// @vitest-environment jsdom
// Story #85: opening Grooming syncs the repository's sprints through Raiden's backend.
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitHubResult } from "@raiden/shared";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, type FakeGitHub } from "./testing/fakegraph.ts";
import { syncGrooming, SYNC_PATH } from "./groomingsync.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const SPRINT = { id: "F#a1", field: "F", iteration: "a1", name: "Sprint 1", start: "2026-11-02", end: "2026-11-15", origin: "github" };

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

async function open(gateway: FakeGitHub): Promise<void> {
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

describe("Grooming sync (story #85)", () => {
    it("asks Raiden's backend to sync the current repository when the lead opens Grooming (AC1)", async () => {
        const gateway = fakeGitHub({ issues: [{ n: 1 }], sync: { source: { project: "P", field: "F" }, sprints: [SPRINT] } });
        await open(gateway);
        expect(gateway.backend).toEqual([{ to: "backend", path: SYNC_PATH, method: "POST", body: { owner: "acme", name: "widgets" } }]);
    });

    it("shows no error for a repository with no linked project (AC3)", async () => {
        const gateway = fakeGitHub({ issues: [{ n: 1 }], sync: { source: null, sprints: [] } });
        await open(gateway);
        expect(gateway.backend).toHaveLength(1);
        expect(root.textContent).not.toMatch(/could not|cannot/i);
    });

    it("reads the synced sprints and the source from the backend's answer", async () => {
        const gateway = fakeGitHub({ issues: [], sync: { source: { project: "P", field: "F" }, sprints: [SPRINT, { ...SPRINT, id: "own", origin: "raiden" }] } });
        const out = await syncGrooming(gateway, WIDGETS);
        expect(out).toEqual({
            ok: true,
            goals: {},
            assignments: new Map(),
            mayEdit: false,
            source: { project: "P", field: "F" },
            sprints: [
                { id: "F#a1", field: "F", iteration: "a1", name: "Sprint 1", start: "2026-11-02", end: "2026-11-15", synced: true },
                { id: "own", field: "F", iteration: "a1", name: "Sprint 1", start: "2026-11-02", end: "2026-11-15", synced: false },
            ],
            milestones: [],
        });
    });

    it("names each failure's cause", async () => {
        const cases: [GitHubResult, string][] = [
            [{ ok: false, kind: "sign-in-needed" }, "signed-out"],
            [{ ok: false, kind: "permission" }, "cannot-read"],
            [{ ok: false, kind: "permission", reason: "project-unreadable" }, "cannot-read-project"],
            [{ ok: false, kind: "rate-limit" }, "rate-limit"],
            [{ ok: false, kind: "network" }, "backend-unavailable"],
            [{ ok: false, kind: "other" }, "backend-unavailable"],
            [{ ok: true, status: 200, body: { sprints: "no" } }, "other"],
            [{ ok: true, status: 200, body: { source: null, sprints: [{ id: 1 }], milestones: [] } }, "other"],
        ];
        for (const [result, cause] of cases) {
            const gateway = fakeGitHub({ issues: [], sync: () => result });
            expect(await syncGrooming(gateway, WIDGETS)).toEqual({ ok: false, cause });
        }
    });

    it("sends no request for a repository name it cannot use", async () => {
        const gateway = fakeGitHub({ issues: [] });
        expect(await syncGrooming(gateway, { owner: "a/b", name: "c", url: "https://github.com/a/b" })).toEqual({ ok: false, cause: "other" });
        expect(gateway.backend).toHaveLength(0);
    });
});

describe("Grooming sync: milestones (story #86)", () => {
    it("reads each milestone's title, due date, description and state", async () => {
        const milestones = [
            { id: "M_1", number: 1, title: "Alpha", due: "2026-10-01T00:00:00Z", description: "First", state: "CLOSED", origin: "github" },
            { id: "M_3", number: 3, title: "Someday", due: "", description: "", state: "OPEN", origin: "github" },
        ];
        const gateway = fakeGitHub({ issues: [], sync: { milestones } });
        expect(await syncGrooming(gateway, WIDGETS)).toEqual({
            ok: true,
            goals: {},
            assignments: new Map(),
            mayEdit: false,
            source: null,
            sprints: [],
            milestones: [
                { id: "M_1", number: 1, title: "Alpha", due: "2026-10-01T00:00:00Z", description: "First", state: "CLOSED", synced: true },
                { id: "M_3", number: 3, title: "Someday", due: null, description: "", state: "OPEN", synced: true },
            ],
        });
    });

    it("fails on an unreadable milestone", async () => {
        const gateway = fakeGitHub({ issues: [], sync: { milestones: [{ id: "M_1", title: "x" }] } });
        expect(await syncGrooming(gateway, WIDGETS)).toEqual({ ok: false, cause: "other" });
    });
});

describe("Grooming sync: goals (story #103)", () => {
    it("reads the saved goals and the may-edit flag (D2, D3)", async () => {
        const gateway = fakeGitHub({ issues: [], sync: { sprints: [SPRINT], goals: { "F#a1": "Ship it" }, mayEdit: true } });
        const out = await syncGrooming(gateway, WIDGETS);
        expect(out.ok && out.goals).toEqual({ "F#a1": "Ship it" });
        expect(out.ok && out.mayEdit).toBe(true);
    });

    it("fails the sync on an unreadable goal", async () => {
        const gateway = fakeGitHub({
            issues: [],
            sync: () => ({ ok: true, status: 200, body: { source: null, sprints: [], milestones: [], goals: [{ sprint: 1, text: "x" }] } }),
        });
        expect(await syncGrooming(gateway, WIDGETS)).toEqual({ ok: false, cause: "other" });
    });
});

describe("Grooming sync: sprint assignments (story #114)", () => {
    it("reads each saved assignment, with null as the no-sprint mark (D3)", async () => {
        const gateway = fakeGitHub({ issues: [], sync: { sprints: [SPRINT], assignments: { I_1: "F#a1", I_2: null } } });
        const out = await syncGrooming(gateway, WIDGETS);
        expect(out.ok && [...out.assignments]).toEqual([
            ["I_1", "F#a1"],
            ["I_2", null],
        ]);
    });

    it("fails the sync on an unreadable assignment", async () => {
        for (const assignments of [{}, [{ issue: "I_1" }], [{ issue: 1, sprint: "F#a1" }], [{ issue: "I_1", sprint: 3 }]]) {
            const gateway = fakeGitHub({
                issues: [],
                sync: () => ({ ok: true, status: 200, body: { source: null, sprints: [], milestones: [], assignments } }),
            });
            expect(await syncGrooming(gateway, WIDGETS)).toEqual({ ok: false, cause: "other" });
        }
    });
});
