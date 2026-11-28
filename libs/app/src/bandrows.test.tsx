// @vitest-environment jsdom
// Story #89: each issue appears once, in its own sprint's band (D6, D7).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, type FakeGitHub, type FakeIssue } from "./testing/fakegraph.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const SOURCE = { project: "P", field: "F" };
const sprint = (id: string, start: string, end: string) => ({ id: `F#${id}`, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
const SPRINTS = [sprint("a", "2026-11-02", "2026-11-15"), sprint("b", "2026-11-16", "2026-11-29")];
const inA: [string, string, string] = ["P", "F", "a"];
const inB: [string, string, string] = ["P", "F", "b"];

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

async function open(issues: FakeIssue[]): Promise<FakeGitHub> {
    const gateway = fakeGitHub({ issues, sync: { source: SOURCE, sprints: SPRINTS } });
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
    return gateway;
}

// A band's rows as "<crumb numbers>: <row number>@<depth> ...", one entry per group.
function band(id: string): string[] {
    const el = root.querySelector<HTMLElement>(`.rd-band[data-sprint="${id}"]`)!;
    return Array.from(el.querySelectorAll<HTMLElement>(".rd-lb-group"), (g) => {
        const head = Array.from(g.querySelectorAll<HTMLElement>(".rd-lb-crumb"), (c) => c.dataset.num).join(">");
        const rows = Array.from(g.querySelectorAll<HTMLElement>(".rd-lb-row"), (r) => `${r.dataset.num}@${r.dataset.depth}`).join(" ");
        return head ? `${head}: ${rows}` : rows;
    });
}
const rowNums = (): string[] => Array.from(root.querySelectorAll<HTMLElement>(".rd-lb-row"), (r) => r.dataset.num!);

describe("issues in their sprint's band (story #89)", () => {
    it("shows an issue as a row in its sprint's band and in no other band (AC1, G22)", async () => {
        await open([{ n: 1, sprints: [inA] }, { n: 2, sprints: [inB] }, { n: 3, sprints: [["Other", "G", "a"], inB] }]);
        expect(band("F#a")).toEqual(["1@0"]);
        expect(band("F#b")).toEqual(["2@0", "3@0"]);
        expect(rowNums().filter((n) => n === "1")).toHaveLength(1);
    });

    it("shows a parent in another band, or outside the query, as a crumb only (AC2, G25)", async () => {
        await open([
            { n: 10, title: "Epic", sprints: [inA] },
            { n: 11, parent: 10, sprints: [inB] },
            { n: 20, title: "Closed parent", state: "CLOSED" },
            { n: 21, parent: 20, sprints: [inB] },
        ]);
        expect(band("F#a")).toEqual(["10@0"]);
        expect(band("F#b")).toEqual(["10: 11@0", "20: 21@0"]);
        // A parent in another band is in the query, so its crumb does not say it is outside.
        const crumbs = Array.from(root.querySelectorAll<HTMLElement>('.rd-band[data-sprint="F#b"] .rd-lb-crumb'));
        expect(crumbs.map((c) => c.classList.contains("is-outside"))).toEqual([false, true]);
        expect(rowNums().filter((n) => n === "10")).toHaveLength(1);
    });

    it("keeps today's list form inside a band: a parent in the same band is a row, its children indented (AC3, D7)", async () => {
        await open([
            { n: 1, title: "Initiative" },
            { n: 2, parent: 1, sprints: [inA] },
            { n: 3, parent: 2, sprints: [inA] },
            { n: 4, parent: 2, sprints: [inA] },
        ]);
        expect(band("F#a")).toEqual(["1: 2@0 3@1 4@1"]);
    });

    it("fails the load rather than misplace an issue whose project values were not all returned (G24)", async () => {
        await open([{ n: 1, sprints: [inA], moreValues: true }]);
        expect(root.querySelector(".rd-band")).toBeNull();
        expect(Array.from(root.querySelectorAll("button")).filter((b) => b.textContent === "Try again")).toHaveLength(1);
    });

    it("sends no issue data to the backend (G7)", async () => {
        const gateway = await open([{ n: 1, title: "Secret title", sprints: [inA] }]);
        expect(JSON.stringify(gateway.backend)).not.toContain("Secret title");
    });
});
