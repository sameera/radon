// @vitest-environment jsdom
// Story #75: parents the query did not return still appear in their places, grayed out.
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { createSessionStore } from "./session.ts";
import { fakeGitHub, idOf, type FakeGitHub, type FakeIssue } from "./testing/fakegraph.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };

let root: HTMLElement;
let unmount: (() => void) | undefined;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) {
        await flush();
    }
}
async function open(gateway: FakeGitHub): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, {
            session: createSessionStore(),
            signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
            gateway,
            repo: createRepoStore(WIDGETS),
        });
    });
    await settle();
}

const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const rows = (): HTMLElement[] => $$<HTMLElement>(".rd-backlog .rd-lb-row");
// Each list item as "<header numbers>: <item numbers>". "~" marks a parent the query did not return.
const shape = (): string[] =>
    $$<HTMLElement>(".rd-backlog .rd-lb-group").map((g) => {
        const head: string = Array.from(
            g.querySelectorAll<HTMLElement>(".rd-lb-crumb"),
            (c) => `${c.dataset.num}${c.classList.contains("is-outside") ? "~" : ""}`,
        ).join(">");
        const items: string = Array.from(g.querySelectorAll<HTMLElement>(".rd-lb-row"), (r) => r.dataset.num).join(" ");
        return head ? `${head}: ${items}` : items;
    });
// An issue on screen: an item, or an ancestor on a header.
const row = (num: number | string): HTMLElement => $(`.rd-lb-row[data-num="${num}"], .rd-lb-crumb[data-num="${num}"]`);
const shown = (): string[] => $$<HTMLElement>(".rd-backlog .rd-lb-crumb, .rd-backlog .rd-lb-row").map((r) => r.dataset.num!);
const status = (): string => $(".rd-backlog .rd-lb-status")?.textContent ?? "";
async function type(value: string): Promise<void> {
    const input: HTMLInputElement = $('input[aria-label="Filter backlog"]');
    await act(() => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
type Body = { query: string; variables: Record<string, unknown> };
const idRounds = (github: FakeGitHub): string[][] =>
    github.requests.map((r) => (r.body as Body).variables.ids).filter(Array.isArray) as string[][];

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    vi.stubGlobal("fetch", vi.fn());
});
afterEach(async () => {
    // Unmount inside act, so Preact runs its effects now and leaves no timer for after teardown.
    await act(() => unmount?.());
    unmount = undefined;
    root.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// I1 (10) > E1 (20, closed) > S11 (25), S12 (30).
const CLOSED_EPIC: FakeIssue[] = [
    { n: 10, title: "Initiative one" },
    { n: 20, title: "Epic one", parent: 10, state: "CLOSED" },
    { n: 25, title: "Story eleven", parent: 20 },
    { n: 30, title: "Story twelve", parent: 20 },
];

describe("outside parents in their places (D3)", () => {
    it("shows a closed E1 under I1, grayed out, with S11 and S12 under it", async () => {
        await open(fakeGitHub({ issues: CLOSED_EPIC }));
        expect(shape()).toEqual(["10>20~: 25 30"]);
    });

    it("shows a parent and a grandparent that were not returned, both grayed out", async () => {
        await open(
            fakeGitHub({
                issues: [
                    { n: 1, title: "Initiative", state: "CLOSED" },
                    { n: 2, title: "Epic", parent: 1, state: "CLOSED" },
                    { n: 3, title: "Story", parent: 2 },
                ],
            }),
        );
        expect(shape()).toEqual(["1~>2~: 3"]);
    });

    it("shows a parent once, however many returned issues sit under it (G6)", async () => {
        await open(
            fakeGitHub({
                issues: [
                    { n: 1, state: "CLOSED" },
                    { n: 2, parent: 1, state: "CLOSED" },
                    { n: 3, parent: 2 },
                    { n: 4, parent: 2 },
                    { n: 5, parent: 1 },
                ],
            }),
        );
        expect(shape()).toEqual(["1~>2~: 3 4", "1~: 5"]);
    });

    it("never shows an issue that was not returned and has no returned descendant (G7)", async () => {
        await open(
            fakeGitHub({
                issues: [...CLOSED_EPIC, { n: 40, title: "Closed sibling", parent: 10, state: "CLOSED" }, { n: 41, parent: 40, state: "CLOSED" }],
            }),
        );
        expect(shown()).not.toContain("40");
        expect(shown()).not.toContain("41");
    });

    it("does not count outside parents in the backlog's count", async () => {
        await open(fakeGitHub({ issues: CLOSED_EPIC }));
        expect($(".rd-backlog .rd-panel__sub").textContent).toBe("3 issues");
    });
});

describe("how an outside parent looks (D6, G8)", () => {
    it("carries a text label with its state, and stays a link", async () => {
        await open(fakeGitHub({ issues: CLOSED_EPIC }));
        const label: string = row(20).querySelector(".rd-lb-outside")!.textContent!;
        expect(label).toMatch(/not in the backlog query/i);
        expect(label).toMatch(/closed/);
        expect(row(20).querySelector<HTMLAnchorElement>("a.rd-ref")!.href).toBe("https://github.com/acme/widgets/issues/20");
    });

    it("shows returned issues at normal weight, with no outside label", async () => {
        await open(fakeGitHub({ issues: CLOSED_EPIC }));
        for (const num of [10, 25, 30]) {
            expect(row(num).classList.contains("is-outside")).toBe(false);
            expect(row(num).querySelector(".rd-lb-outside")).toBeNull();
        }
    });

    it("grays outside parents with the muted foreground", () => {
        const css: string = readFileSync(resolve(__dirname, "app.css"), "utf8");
        expect(css).toMatch(/\.rd-lb-crumb\.is-outside[^{]*\{[^}]*var\(--rd-fg-subtle\)/);
    });

    it("keeps the chain of outside parents above a filtered match", async () => {
        await open(fakeGitHub({ issues: CLOSED_EPIC }));
        await type("twelve");
        expect(shape()).toEqual(["10>20~: 30"]);
    });
});

describe("parents in another repository (D3)", () => {
    it("shows the parent with its repository and links to that repository's issue", async () => {
        await open(fakeGitHub({ issues: [{ n: 3, repo: "acme/planning", title: "Planning initiative" }, { n: 7, parent: "acme/planning#3" }] }));
        expect(shape()).toEqual(["3~: 7"]);
        expect(row(3).textContent).toContain("acme/planning#3");
        expect(row(3).querySelector<HTMLAnchorElement>("a.rd-ref")!.href).toBe("https://github.com/acme/planning/issues/3");
        expect(row(3).querySelector(".rd-lb-outside")!.textContent).toMatch(/open/);
    });

    it("never merges a parent in another repository with a same-numbered local issue", async () => {
        await open(fakeGitHub({ issues: [{ n: 3, repo: "acme/planning" }, { n: 3, title: "Local three" }, { n: 7, parent: "acme/planning#3" }] }));
        expect(shown().filter((n) => n === "3")).toHaveLength(2);
        expect(shape()).toEqual(["3~: 7", "3"]);
    });

    it("builds links on the current repository's GitHub server", async () => {
        const github = fakeGitHub({ issues: [{ n: 3, repo: "acme/planning" }, { n: 7, parent: "acme/planning#3" }] });
        await act(async () => {
            unmount = await mountApp(root, {
                session: createSessionStore(),
                signIn: createSignInController({ status: async () => "ada", signIn: async () => ({ login: "ada" }) }),
                gateway: github,
                repo: createRepoStore({ owner: "acme", name: "widgets", url: "https://ghe.example.com/acme/widgets" }),
            });
        });
        await settle();
        expect(row(3).querySelector<HTMLAnchorElement>("a.rd-ref")!.href).toBe("https://ghe.example.com/acme/planning/issues/3");
    });
});

describe("ancestors above the inline depth (D2)", () => {
    // A chain of closed ancestors 101 > 102 > ... above an open story.
    function chain(top: number, height: number, story: number): FakeIssue[] {
        const out: FakeIssue[] = [];
        for (let i = 0; i < height; i++) {
            out.push({ n: top + i, state: "CLOSED", ...(i > 0 ? { parent: top + i - 1 } : {}) });
        }
        out.push({ n: story, parent: top + height - 1 });
        return out;
    }

    it("reads every missing ancestor together, one level at a time, until every chain ends (G5)", async () => {
        const github = fakeGitHub({ issues: [...chain(101, 6, 1), ...chain(201, 5, 2)] });
        await open(github);
        expect(shape()).toEqual(["101~>102~>103~>104~>105~>106~: 1", "201~>202~>203~>204~>205~: 2"]);
        const rounds: string[][] = idRounds(github);
        expect(rounds).toHaveLength(1);
        expect([...rounds[0]!].sort()).toEqual([idOf("acme/widgets", 103), idOf("acme/widgets", 202)].sort());
        for (const request of github.requests) {
            expect(request.path).toBe("/graphql");
            expect((request.body as Body).query).not.toMatch(/mutation/i);
        }
    });

    it("needs no extra round when every chain fits the inline depth", async () => {
        const github = fakeGitHub({ issues: chain(101, 3, 1) });
        await open(github);
        expect(idRounds(github)).toHaveLength(0);
        expect(shape()).toEqual(["101~>102~>103~: 1"]);
    });

    it("runs further rounds for taller chains, and asks for each ancestor once", async () => {
        const github = fakeGitHub({ issues: chain(101, 10, 1) });
        await open(github);
        expect(shown()).toHaveLength(11);
        const asked: string[] = idRounds(github).flat();
        expect(asked).toHaveLength(new Set(asked).size);
        expect(idRounds(github).length).toBe(2);
    });

    it("ends when GitHub reports a loop of parents, and shows every returned issue once (G14, G4)", async () => {
        const github = fakeGitHub({
            issues: [
                { n: 1, state: "CLOSED", parent: 6 },
                { n: 2, state: "CLOSED", parent: 1 },
                { n: 3, state: "CLOSED", parent: 2 },
                { n: 4, state: "CLOSED", parent: 3 },
                { n: 5, state: "CLOSED", parent: 4 },
                { n: 6, state: "CLOSED", parent: 5 },
                { n: 9, parent: 4 },
            ],
        });
        await open(github);
        const nums: string[] = rows().map((r) => r.dataset.num!);
        expect(nums.filter((n) => n === "9")).toHaveLength(1);
        expect(new Set(nums).size).toBe(nums.length);
        for (const head of $$(".rd-lb-head")) {
            const crumbs: string[] = Array.from(head.querySelectorAll<HTMLElement>(".rd-lb-crumb"), (c) => c.dataset.num!);
            expect(new Set(crumbs).size).toBe(crumbs.length);
        }
        expect(idRounds(github).length).toBeLessThanOrEqual(3);
    });

    it("fails the whole load when an ancestor round fails (G10)", async () => {
        const github = fakeGitHub({
            issues: chain(101, 6, 1),
            override: (_i, request) => (Array.isArray((request.body as Body).variables.ids) ? { ok: false, kind: "network" } : undefined),
        });
        await open(github);
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("The backlog could not load");
    });
});

describe("a parent the lead cannot read (R2)", () => {
    it("shows the issue at the top, as GitHub answers no parent and no error, and the load does not fail", async () => {
        await open(fakeGitHub({ issues: [{ n: 7, title: "Story", hiddenParent: true }] }));
        expect(shape()).toEqual(["7"]);
        expect(root.querySelector(".rd-lb-crumb.is-hidden")).toBeNull();
        expect(status()).toBe("");
        expect($(".rd-backlog .rd-panel__sub").textContent).toBe("1 issue");
    });

    it("fails on an error at a parent, as GitHub sends none for a parent the lead cannot read (G13)", async () => {
        const github = fakeGitHub({ issues: [{ n: 7, title: "Story", parent: 3 }, { n: 3, title: "Epic" }] });
        const real = github.request.bind(github);
        github.request = async (request) => {
            const result = await real(request);
            if (result.ok && typeof result.body === "object" && result.body !== null) {
                return { ...result, body: { ...result.body, errors: [{ type: "FORBIDDEN", path: ["search", "nodes", 0, "parent"] }] } };
            }
            return result;
        };
        await open(github);
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("could not load");
    });

    it("still fails on an error that is not about a parent (G13)", async () => {
        await open(
            fakeGitHub({
                issues: [{ n: 7 }],
                override: () => ({
                    ok: true,
                    status: 200,
                    body: { data: { repository: { id: "R" }, search: null }, errors: [{ type: "FORBIDDEN", path: ["search"] }] },
                }),
            }),
        );
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("could not load");
    });
});
