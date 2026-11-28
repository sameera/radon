// @vitest-environment jsdom
// Story #74: the backlog shows the current repository's open issues as a list.
import { options, type VNode } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubResult } from "@raiden/shared";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo, type RepoStore } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { createSessionStore } from "./session.ts";
import { fakeGitHub, type FakeGitHub, type FakeIssue } from "./testing/fakegraph.ts";
import { LiveBacklog } from "./livebacklog.tsx";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const GADGETS: Repo = { owner: "acme", name: "gadgets", url: "https://github.com/acme/gadgets" };

// I1 > E1 > S11, S12, with numbers chosen so that sibling order differs from the list order.
const TREE: FakeIssue[] = [
    { n: 30, title: "Story twelve", parent: 20 },
    { n: 10, title: "Initiative one" },
    { n: 25, title: "Story eleven", parent: 20 },
    { n: 20, title: "Epic one", parent: 10 },
    { n: 5, title: "Loose issue" },
];

let root: HTMLElement;
let unmount: (() => void) | undefined;
let stored: Record<string, unknown>;
let prefs: PreferenceStore;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
        await flush();
    }
}

async function open(gateway: FakeGitHub, repo: RepoStore = createRepoStore(WIDGETS), login: string | null = "ada"): Promise<RepoStore> {
    await act(async () => {
        unmount = await mountApp(root, {
            prefs,
            session: createSessionStore(),
            signIn: createSignInController({ status: async () => login, signIn: async () => (login ? { login } : null) }),
            gateway,
            repo,
        });
    });
    await settle();
    return repo;
}

const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const rows = (): HTMLElement[] => $$<HTMLElement>(".rd-backlog .rd-lb-row");
// Each list item as "<header numbers>: <item numbers>", or the item numbers alone with no header.
const shape = (): string[] =>
    $$<HTMLElement>(".rd-backlog .rd-lb-group").map((g) => {
        const head: string = Array.from(g.querySelectorAll<HTMLElement>(".rd-lb-crumb"), (c) => c.dataset.num).join(">");
        const items: string = Array.from(g.querySelectorAll<HTMLElement>(".rd-lb-row"), (r) => r.dataset.num).join(" ");
        return head ? `${head}: ${items}` : items;
    });
const row = (num: number): HTMLElement => $(`.rd-lb-row[data-num="${num}"]`);
// Drags one backlog item onto another, to the given half of it.
async function reorder(from: number, to: number, side: "before" | "after"): Promise<void> {
    const target: HTMLElement = row(to);
    target.getBoundingClientRect = () => ({ top: 0, height: 20, bottom: 20, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => ({}) });
    const at = (type: string, el: Element): void => {
        const event: Event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", { value: { setData: vi.fn(), getData: () => "", effectAllowed: "", dropEffect: "" } });
        Object.defineProperty(event, "clientY", { value: side === "before" ? 2 : 18 });
        el.dispatchEvent(event);
    };
    await act(() => at("dragstart", row(from)));
    await act(() => at("dragover", target));
    await act(() => at("drop", target));
    await act(() => at("dragend", row(from)));
}
async function key(el: Element, k: string): Promise<void> {
    await act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: k, altKey: true, bubbles: true, cancelable: true }));
    });
}
const status = (): string => $(".rd-backlog .rd-lb-status")?.textContent ?? "";
const retry = (): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>(".rd-backlog .rd-lb-retry");
const filter = (): HTMLInputElement => $('input[aria-label="Filter backlog"]');
async function type(value: string): Promise<void> {
    await act(() => {
        filter().value = value;
        filter().dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function click(el: Element): Promise<void> {
    await act(() => {
        (el as HTMLElement).click();
    });
    await settle();
}
function drag(el: Element, type: string): void {
    const event: Event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { setData: vi.fn(), getData: () => "", effectAllowed: "", dropEffect: "" } });
    el.dispatchEvent(event);
}
const many = (count: number): FakeIssue[] => Array.from({ length: count }, (_, i) => ({ n: i + 1, title: `Bulk ${i + 1}` }));
const fail = (kind: "network" | "rate-limit" | "permission" | "sign-in-needed" | "other"): GitHubResult => ({ ok: false, kind });

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    vi.stubGlobal("fetch", vi.fn());
    stored = {};
    prefs = {
        get: async (k: string) => stored[k],
        set: async (k: string, v: unknown) => {
            stored[k] = v;
        },
    };
});
afterEach(async () => {
    // Unmount inside act, so Preact runs its effects now and leaves no timer for after teardown.
    await act(() => unmount?.());
    unmount = undefined;
    root.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("reading the backlog from GitHub (D1)", () => {
    it("shows the ID, type icon, then title for each supported issue type", async () => {
        const types = ["Milestone", "Initiative", "Epic", "Decision Record", "Story", "Bug", "Task"];
        const kinds = ["milestone", "initiative", "epic", "decision", "story", "bug", "task"];
        await open(fakeGitHub({ issues: types.map((issueType, i) => ({ n: i + 1, title: `Item ${i + 1}`, issueType })) }));
        for (let i = 0; i < types.length; i++) {
            const parts = Array.from(row(i + 1).querySelector(".rd-ref")!.children);
            expect(parts.map((part) => part.className)).toEqual(["rd-ref__num", "rd-ref__icon", "rd-ref__title"]);
            expect(parts[1]!.getAttribute("data-kind")).toBe(kinds[i]);
            expect(parts[1]!.querySelector("svg")).toBeTruthy();
        }
    });

    it("uses a type label when GitHub has no issue type and keeps unknown issues neutral", async () => {
        await open(fakeGitHub({ issues: [
            { n: 1, title: "Labeled", labels: ["type:decision-record"] },
            { n: 2, title: "Untyped" },
        ] }));
        expect(row(1).querySelector(".rd-ref__icon")?.getAttribute("data-kind")).toBe("decision");
        expect(row(2).querySelector(".rd-ref__icon")?.getAttribute("data-kind")).toBe("unknown");
    });

    it("lists the issues the fixed query returns for the current repository", async () => {
        const github = fakeGitHub({ issues: TREE });
        await open(github);
        const nums: string[] = $$<HTMLElement>(".rd-backlog [data-num]").map((r) => r.dataset.num!);
        expect([...new Set(nums)].sort()).toEqual(["10", "20", "25", "30", "5"]);
        expect($(".rd-backlog").textContent).toContain("Story eleven");
    });

    it("asks GitHub's GraphQL search, confined by Raiden to the current repository, and only reads (G1, G2, G3)", async () => {
        const github = fakeGitHub({ issues: TREE });
        await open(github);
        expect(github.requests.length).toBeGreaterThan(0);
        for (const request of github.requests) {
            expect(request.path).toBe("/graphql");
            expect(request.method).toBe("POST");
            const body = request.body as { query: string; variables: Record<string, unknown> };
            expect(body.query.trim().startsWith("query")).toBe(true);
            expect(body.query).not.toMatch(/mutation/i);
        }
        const first = github.requests[0]!.body as { variables: Record<string, unknown> };
        expect(first.variables.q).toBe("repo:acme/widgets is:issue state:open");
        expect(first.variables.owner).toBe("acme");
        expect(first.variables.name).toBe("widgets");
    });

    it("never lets a repository owner or name change the query (G3)", async () => {
        const github = fakeGitHub({ issues: TREE });
        await open(github, createRepoStore({ owner: "acme", name: "widgets is:closed", url: "https://github.com/acme/widgets" }));
        expect(github.requests).toHaveLength(0);
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("could not load");
    });

    it("sends no request and shows the pick prompt while the repository is none (G21)", async () => {
        const github = fakeGitHub({ issues: TREE });
        await open(github, createRepoStore(null));
        expect(github.requests).toHaveLength(0);
        expect(root.querySelector(".rd-pick-prompt")).not.toBeNull();
        expect(root.querySelector(".rd-groom")).toBeNull();
    });
});

describe("the list (D3)", () => {
    it("shows each issue at the end of a chain as an item, under a header of its ancestors", async () => {
        await open(fakeGitHub({ issues: TREE }));
        expect(shape()).toEqual(["5", "10>20: 25 30"]);
        expect(rows().map((r) => r.dataset.num)).toEqual(["5", "25", "30"]);
        // The header is set in the design system's small style, not a literal font size.
        expect($(".rd-lb-head").classList.contains("rd-text-small")).toBe(true);
    });

    it("shows each returned issue exactly once (G4)", async () => {
        await open(fakeGitHub({ issues: TREE }));
        const nums: string[] = $$<HTMLElement>(".rd-backlog .rd-lb-crumb, .rd-backlog .rd-lb-row").map((r) => r.dataset.num!);
        expect(new Set(nums).size).toBe(nums.length);
        expect(nums).toHaveLength(5);
    });

    it("gives siblings one shared header, and children of another parent their own", async () => {
        await open(
            fakeGitHub({
                issues: [
                    { n: 1, title: "I1" },
                    { n: 11, parent: 1 },
                    { n: 111, parent: 11 },
                    { n: 112, parent: 11 },
                    { n: 21, parent: 1 },
                    { n: 3 },
                    { n: 4 },
                ],
            }),
        );
        expect(shape()).toEqual(["1>11: 111 112", "1: 21", "3", "4"]);
    });

    it("shows an issue with no parent as its own item, ordered by number, with no header (G9)", async () => {
        await open(fakeGitHub({ issues: [{ n: 9 }, { n: 3 }, { n: 7 }] }));
        expect(shape()).toEqual(["3", "7", "9"]);
        expect(root.querySelector(".rd-lb-head")).toBeNull();
    });

    it("links every row to its issue in a new tab with no handle back, and the link never drags (G22, G24)", async () => {
        await open(fakeGitHub({ issues: TREE }));
        const link: HTMLAnchorElement = $('.rd-lb-row[data-num="25"] a.rd-ref');
        expect(link.href).toBe("https://github.com/acme/widgets/issues/25");
        expect(link.target).toBe("_blank");
        expect(link.rel).toBe("noopener noreferrer");
        expect(link.getAttribute("draggable")).toBe("false");
    });

    it("shows a title as plain text, never as markup (G17)", async () => {
        await open(fakeGitHub({ issues: [{ n: 1, title: "<img src=x onerror=alert(1)><b>bold</b>" }] }));
        expect($('.rd-lb-row[data-num="1"]').querySelector("img, b")).toBeNull();
        expect($('.rd-lb-row[data-num="1"]').textContent).toContain("<b>bold</b>");
    });

    it("links each header ancestor to its issue", async () => {
        await open(fakeGitHub({ issues: TREE }));
        expect($<HTMLAnchorElement>('.rd-lb-crumb[data-num="20"] a.rd-ref').href).toBe("https://github.com/acme/widgets/issues/20");
    });

    it("filters at every level: a match shows under its chain, with its descendants", async () => {
        await open(fakeGitHub({ issues: TREE }));
        await type("story ELEVEN");
        expect(shape()).toEqual(["10>20: 25"]);
        await type("#20");
        expect(shape()).toEqual(["10>20: 25 30"]);
        await type("nothing matches this");
        expect(rows()).toHaveLength(0);
        expect($(".rd-backlog").textContent).toContain("No issues match");
    });

    it("filtering never changes the plan, the save state or Undo (G27)", async () => {
        await open(fakeGitHub({ issues: TREE }));
        const plan: string = $(".rd-goals").textContent!;
        const save: string = $(".rd-groom__save-state").textContent!;
        await type("epic");
        await type("");
        expect($(".rd-goals").textContent).toBe(plan);
        expect($(".rd-groom__save-state").textContent).toBe(save);
        expect($$<HTMLButtonElement>(".rd-btn").find((b) => b.textContent === "Undo")!.getAttribute("aria-disabled")).toBe("true");
    });

    it("moves an item by drag and drop", async () => {
        await open(fakeGitHub({ issues: TREE }));
        await reorder(5, 30, "after");
        expect(shape()).toEqual(["10>20: 25 30", "5"]);
        await reorder(5, 25, "before");
        expect(shape()).toEqual(["5", "10>20: 25 30"]);
    });

    it("gives an item moved away from its siblings its own header, and joins them again when moved back", async () => {
        await open(fakeGitHub({ issues: TREE }));
        await reorder(25, 5, "before");
        expect(shape()).toEqual(["10>20: 25", "5", "10>20: 30"]);
        await reorder(25, 30, "before");
        expect(shape()).toEqual(["5", "10>20: 25 30"]);
    });

    it("moves an item one place with Alt+Up and Alt+Down, and keeps focus on it", async () => {
        await open(fakeGitHub({ issues: TREE }));
        await key(row(30).querySelector("a.rd-ref")!, "ArrowUp");
        expect(shape()).toEqual(["5", "10>20: 30 25"]);
        await key(row(5).querySelector("a.rd-ref")!, "ArrowDown");
        await settle();
        expect(shape()).toEqual(["10>20: 30", "5", "10>20: 25"]);
        expect(document.activeElement).toBe(row(5).querySelector("a.rd-ref"));
        await key(row(25).querySelector("a.rd-ref")!, "ArrowDown");
        expect(shape()).toEqual(["10>20: 30", "5", "10>20: 25"]);
    });

    it("keeps hidden items in place when an item moves while filtering", async () => {
        await open(fakeGitHub({ issues: TREE }));
        await type("story");
        await reorder(30, 25, "before");
        await type("");
        expect(shape()).toEqual(["5", "10>20: 30 25"]);
    });

    it("reordering never changes the plan, the save state or Undo, and sends no request", async () => {
        const github = fakeGitHub({ issues: TREE });
        await open(github);
        const plan: string = $(".rd-goals").textContent!;
        const sent: number = github.requests.length;
        await reorder(5, 30, "after");
        expect($(".rd-goals").textContent).toBe(plan);
        expect($(".rd-groom__save-state").textContent).toBe("All changes saved");
        expect(github.requests).toHaveLength(sent);
        expect(JSON.stringify(stored)).not.toMatch(/I_|order/);
    });

    it("counts the returned issues", async () => {
        await open(fakeGitHub({ issues: TREE }));
        expect($(".rd-backlog .rd-panel__sub").textContent).toBe("5 issues");
    });
});

describe("paging and the search cap (D1, D7)", () => {
    it("reads every page until the reported total", async () => {
        const github = fakeGitHub({ issues: many(250) });
        await open(github);
        expect(rows()).toHaveLength(250);
        expect(github.requests).toHaveLength(3);
        const cursors = github.requests.map((r) => (r.body as { variables: { cursor: unknown } }).variables.cursor);
        expect(cursors).toEqual([null, "100", "200"]);
        expect(root.querySelector(".rd-lb-capped")).toBeNull();
    });

    it("above 1,000 issues shows the first 1,000 and says how many it does not show (G15)", async () => {
        const github = fakeGitHub({ issues: many(1200) });
        await open(github);
        expect(rows()).toHaveLength(1000);
        expect(github.requests).toHaveLength(10);
        expect($(".rd-lb-capped").textContent).toContain("200 issues are not shown");
        expect($(".rd-backlog .rd-panel__sub").textContent).toBe("1000 issues");
    });
});

describe("loading and failure (D4)", () => {
    it("shows a loading state and no issues until every answer has arrived (G10)", async () => {
        let release: () => void = () => undefined;
        const held = new Promise<void>((r) => (release = r));
        const github = fakeGitHub({
            issues: many(150),
            override: async (i) => {
                if (i === 1) {
                    await held;
                }
                return undefined;
            },
        });
        await open(github);
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("Loading");
        release();
        await settle();
        expect(rows()).toHaveLength(150);
        expect(root.querySelector(".rd-lb-status")).toBeNull();
    });

    it("a failed later page shows no issues, says why, and offers Try again (G10)", async () => {
        let broken = true;
        const github = fakeGitHub({ issues: many(150), override: (i) => (i === 1 && broken ? fail("network") : undefined) });
        await open(github);
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("The backlog could not load");
        expect(retry()).not.toBeNull();
        broken = false;
        await click(retry()!);
        expect(rows()).toHaveLength(150);
        expect(retry()).toBeNull();
    });

    it("names a rate limit", async () => {
        await open(fakeGitHub({ issues: TREE, override: () => fail("rate-limit") }));
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("rate limit");
        expect(retry()).not.toBeNull();
    });

    it("names a repository the App cannot read, by status or by GraphQL error, never as empty (G11)", async () => {
        await open(fakeGitHub({ issues: TREE, cannotRead: true }));
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("Raiden's GitHub App cannot read this repository's issues");
        expect(retry()).not.toBeNull();
        await act(() => unmount?.());
        await open(fakeGitHub({ issues: TREE, override: () => fail("permission") }));
        expect(status()).toContain("Raiden's GitHub App cannot read this repository's issues");
    });

    it("asks a signed-out lead to sign in", async () => {
        await open(fakeGitHub({ issues: TREE, override: () => fail("sign-in-needed") }));
        expect(root.textContent).toMatch(/sign in/i);
    });

    it("counts an answer that reports errors as a failed request (G13)", async () => {
        const github = fakeGitHub({
            issues: TREE,
            override: () => ({ ok: true, status: 200, body: { data: null, errors: [{ type: "INTERNAL", message: "boom" }] } }),
        });
        await open(github);
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("The backlog could not load");
    });

    it("counts an answer in an unexpected shape as a failed request", async () => {
        await open(fakeGitHub({ issues: TREE, override: () => ({ ok: true, status: 200, body: { data: { search: { nodes: "x" } } } }) }));
        expect(rows()).toHaveLength(0);
        expect(status()).toContain("The backlog could not load");
    });

    it("shows the new repository's backlog on a repository change and drops the earlier answer (G12)", async () => {
        let release: () => void = () => undefined;
        const held = new Promise<void>((r) => (release = r));
        const github = fakeGitHub({
            issues: [{ n: 1, title: "Widget issue" }],
            override: async (i, request) => {
                const vars = (request.body as { variables: Record<string, unknown> }).variables;
                if (i === 0) {
                    await held;
                    return undefined;
                }
                if (vars.name === "gadgets") {
                    return {
                        ok: true,
                        status: 200,
                        body: {
                            data: {
                                repository: { id: "R_2" },
                                search: {
                                    issueCount: 1,
                                    pageInfo: { hasNextPage: false, endCursor: "1" },
                                    nodes: [{ id: "G_7", number: 7, title: "Gadget issue", state: "OPEN", url: "", repository: { nameWithOwner: "acme/gadgets" }, parent: null }],
                                },
                            },
                        },
                    };
                }
                return undefined;
            },
        });
        const repo = await open(github);
        await act(() => repo.set(GADGETS));
        await settle();
        release();
        await settle();
        expect(rows().map((r) => r.dataset.num)).toEqual(["7"]);
        expect($(".rd-backlog").textContent).not.toContain("Widget issue");
    });

    it("never paints the earlier repository's backlog, even for one render, after a repository change (G12)", async () => {
        let held = false;
        const github = fakeGitHub({
            issues: [{ n: 1, title: "Widget issue" }],
            // The new repository's answer never arrives, so every render after the change is before it.
            override: (_i, request) =>
                (request.body as { variables: Record<string, unknown> }).variables.name === "gadgets"
                    ? new Promise<GitHubResult>(() => (held = true))
                    : undefined,
        });
        const repo = await open(github);
        expect($(".rd-backlog").textContent).toContain("Widget issue");
        // What the backlog shows each time it finishes a render, including the first one after the
        // change, which Preact paints before it runs any effect.
        const painted: string[] = [];
        const before = options.diffed;
        options.diffed = (vnode: VNode) => {
            if (vnode.type === LiveBacklog) {
                painted.push($(".rd-backlog").textContent ?? "");
            }
            before?.(vnode);
        };
        try {
            await act(() => repo.set(GADGETS));
            await settle();
        } finally {
            options.diffed = before;
        }
        expect(held).toBe(true);
        expect(painted.length).toBeGreaterThan(0);
        expect(painted.filter((text) => text.includes("Widget issue"))).toEqual([]);
        expect(status()).toContain("Loading");
    });

    it("keeps titles and repository names in page memory only (G16)", async () => {
        await open(fakeGitHub({ issues: TREE }));
        expect(JSON.stringify(stored)).not.toContain("Story eleven");
        expect(JSON.stringify(stored)).not.toContain("acme/widgets");
    });
});

describe("live rows beside the sample plan (D5)", () => {
    it("live rows have no item menu, show no goal label, and dropping one on a goal plans nothing (G18)", async () => {
        await open(fakeGitHub({ issues: [{ n: 31, title: "Same number as a sample epic" }, { n: 12, title: "Same as a sample initiative" }] }));
        const goal: HTMLElement = $(".rd-goal-card");
        const plan: string = $(".rd-goals").textContent!;
        await act(() => drag(row(31), "dragstart"));
        await act(() => drag(goal, "dragover"));
        await act(() => drag(goal, "drop"));
        await act(() => drag(row(31), "dragend"));
        expect($(".rd-goals").textContent).toBe(plan);
        expect($(".rd-groom__save-state").textContent).toBe("All changes saved");
        for (const row of rows()) {
            expect(row.querySelector('[aria-haspopup="menu"]')).toBeNull();
            expect(row.textContent).not.toMatch(/Goal \d/);
            expect(row.querySelector(".rd-glyph")).toBeNull();
        }
    });

    it("hides the header's planned count and the sidebar's not-planned count (G19)", async () => {
        await open(fakeGitHub({ issues: TREE }));
        expect(root.querySelector(".rd-groom__summary")).toBeNull();
        expect(root.querySelector(".rd-nav-item__count")).toBeNull();
        const grooming = $$<HTMLButtonElement>(".rd-nav-item").find((b) => b.dataset.label === "Grooming")!;
        expect(grooming.getAttribute("aria-label")).toBe("Grooming");
    });

    it("keeps the goals, and dragging a planned row onto the backlog still takes it out of the plan (G20)", async () => {
        await open(fakeGitHub({ issues: TREE }));
        const item: HTMLElement = $('.rd-plan-item[data-kind="epic"][data-num="50"]');
        expect(item).not.toBeNull();
        await act(() => drag(item, "dragstart"));
        await act(() => drag($(".rd-backlog"), "dragover"));
        await act(() => drag($(".rd-backlog"), "drop"));
        await act(() => drag(item, "dragend"));
        expect(root.querySelector('.rd-plan-item[data-kind="epic"][data-num="50"]')).toBeNull();
        expect($(".rd-groom__save-state").textContent).toBe("Unsaved changes");
        const undo = $$<HTMLButtonElement>(".rd-btn").find((b) => b.textContent === "Undo")!;
        await click(undo);
        expect(root.querySelector('.rd-plan-item[data-kind="epic"][data-num="50"]')).not.toBeNull();
    });

    it("keeps the New initiative in GitHub link", async () => {
        await open(fakeGitHub({ issues: TREE }));
        expect($<HTMLAnchorElement>(".rd-backlog__new").href).toBe("https://github.com/acme/widgets/issues/new");
    });
});
