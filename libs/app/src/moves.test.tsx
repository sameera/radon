// @vitest-environment jsdom
// Story #114: the lead drags a row onto another sprint's band (D1, D2, D3, D6, D8).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitHubRequest, GitHubResult } from "@raiden/shared";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo, type RepoStore } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, idOf, type FakeGitHub, type FakeIssue, type FakeOptions } from "./testing/fakegraph.ts";
import { MOVE_MARKER, MOVE_PATH } from "./moves.ts";

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const GADGETS: Repo = { owner: "acme", name: "gadgets", url: "https://github.com/acme/gadgets" };
const sprint = (id: string, start: string, end: string) => ({ id, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
// Sprint a sits under milestone One; b and c come after every due date, behind the "No milestone" break.
const SPRINTS = [sprint("a", "2026-10-05", "2026-10-18"), sprint("b", "2026-10-19", "2026-11-01"), sprint("c", "2027-01-04", "2027-01-17")];
const MILESTONES = [{ id: "M_1", number: 1, title: "One", due: "2026-10-18T00:00:00Z", description: "", state: "OPEN", origin: "github" }];
const ISSUES: FakeIssue[] = [
    { n: 1, title: "Parent", sprints: [["P", "F", "a"]] },
    { n: 2, title: "Child", parent: 1, sprints: [["P", "F", "a"]] },
    { n: 3, title: "Loose" },
    { n: 4, title: "Other in b", sprints: [["P", "F", "b"]] },
];
const id = (n: number): string => idOf("acme/widgets", n);

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

function live(o: Partial<FakeOptions> & { mayEdit?: boolean; assignments?: Record<string, string | null> } = {}): FakeGitHub {
    const { mayEdit, assignments, ...rest } = o;
    return fakeGitHub({
        issues: ISSUES,
        sync: { source: { project: "P", field: "F" }, sprints: SPRINTS, milestones: MILESTONES, assignments, mayEdit: mayEdit ?? true },
        ...rest,
    });
}

const $ = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const band = (key: string): HTMLElement => (key === "none" ? $<HTMLElement>('.rd-band[data-band="none"]')! : $<HTMLElement>(`.rd-band[data-sprint="${key}"]`)!);
const rowsIn = (key: string): string[] => Array.from(band(key).querySelectorAll<HTMLElement>(".rd-lb-row"), (r) => r.dataset.num!);
const row = (n: number): HTMLElement => $<HTMLElement>(`.rd-lb-row[data-num="${n}"]`)!;
const moves = (g: FakeGitHub): GitHubRequest[] => g.backend.filter((r) => r.path === MOVE_PATH);
const notice = (): HTMLElement | null => $<HTMLElement>(".rd-bands__notice");

// A DataTransfer as the browser gives it: the data set at dragstart, readable on drop.
class Transfer {
    data: Map<string, string> = new Map();
    set: string[] = [];
    effectAllowed: string = "";
    dropEffect: string = "";
    constructor(init: Record<string, string> = {}) {
        for (const [k, v] of Object.entries(init)) {
            this.data.set(k, v);
        }
    }
    get types(): string[] {
        return [...this.data.keys()];
    }
    setData(type: string, value: string): void {
        this.set.push(type);
        this.data.set(type, value);
    }
    getData(type: string): string {
        return this.data.get(type) ?? "";
    }
}
function fire(el: Element, type: string, dt: Transfer): Event {
    const event: Event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dt });
    el.dispatchEvent(event);
    return event;
}
// A whole drag from one element onto a drop target, as the browser runs it.
async function dragOnto(from: Element, onto: Element): Promise<Transfer> {
    const dt = new Transfer();
    await act(async () => {
        fire(from, "dragstart", dt);
        fire(onto, "dragenter", dt);
        fire(onto, "dragover", dt);
        fire(onto, "drop", dt);
        fire(from, "dragend", dt);
    });
    await settle();
    return dt;
}

// A move write the test answers by hand.
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

describe("drag a row onto another sprint's band (story #114)", () => {
    it("shows the dropped row at the top of the new band at once, and there after a reload (AC1, G1, D8)", async () => {
        const gateway = live();
        await open(gateway);
        expect(rowsIn("a")).toEqual(["1", "2"]);
        await dragOnto(row(1), band("b"));
        expect(rowsIn("b")).toEqual(["1", "4"]);
        expect(rowsIn("a")).toEqual(["2"]);
        expect(moves(gateway)).toEqual([{ to: "backend", path: MOVE_PATH, method: "POST", body: { owner: "acme", name: "widgets", issue: id(1), sprint: "b" } }]);
        await open(gateway);
        expect(rowsIn("b")).toContain("1");
        expect(rowsIn("a")).toEqual(["2"]);
    });

    it("accepts a drop on the band's card as well as its rows (D8)", async () => {
        const gateway = live();
        await open(gateway);
        await dragOnto(row(3), band("c").querySelector(".rd-band__card")!);
        expect(rowsIn("c")).toEqual(["3"]);
        expect(gateway.assignments[id(3)]).toBe("c");
    });

    it("records no sprint for a row dropped on the no-sprint band, and keeps it there after a reload (AC2, G2, D1)", async () => {
        const gateway = live();
        await open(gateway);
        await dragOnto(row(4), band("none"));
        expect(rowsIn("none")).toEqual(["4", "3"]);
        expect(moves(gateway)[0]!.body).toEqual({ owner: "acme", name: "widgets", issue: id(4), sprint: null });
        await open(gateway);
        expect(rowsIn("none")).toContain("4");
        expect(rowsIn("b")).toEqual([]);
    });

    it("sends no write to GitHub, and the move carries only the repository, the issue's identity and the target (AC3, G29, G30)", async () => {
        const gateway = live();
        await open(gateway);
        const before: number = gateway.requests.length;
        await dragOnto(row(1), band("c"));
        expect(gateway.requests.length).toBe(before);
        for (const r of gateway.requests) {
            expect((r.body as { query: string }).query).not.toMatch(/mutation/);
        }
        const body = JSON.stringify(moves(gateway)[0]!.body);
        expect(body).not.toMatch(/Parent|"number"|labels|title/);
        expect(Object.keys(moves(gateway)[0]!.body as object).sort()).toEqual(["issue", "name", "owner", "sprint"]);
    });

    it("moves only the dragged issue; its child keeps its own sprint (AC4, G3)", async () => {
        const gateway = live();
        await open(gateway);
        await dragOnto(row(1), band("c"));
        expect(rowsIn("c")).toEqual(["1"]);
        expect(rowsIn("a")).toEqual(["2"]);
        // The child shows under the moved parent's crumb.
        expect(band("a").querySelector(".rd-lb-crumb")?.getAttribute("data-num")).toBe("1");
        expect(moves(gateway)).toHaveLength(1);
        await open(gateway);
        expect(rowsIn("a")).toEqual(["2"]);
        expect(rowsIn("c")).toEqual(["1"]);
        // G36: every query issue is a row in exactly one band.
        expect($$<HTMLElement>(".rd-lb-row").map((r) => r.dataset.num).sort()).toEqual(["1", "2", "3", "4"]);
    });

    it("returns the row to its band and says the move was not saved when the save fails (AC5, G21, G24)", async () => {
        for (const [answer, cause] of [
            [{ ok: false, kind: "permission" }, "You are not allowed to move this repository's issues."],
            [{ ok: false, kind: "other", reason: "unknown-sprint" }, "That sprint no longer exists."],
            [{ ok: false, kind: "network" }, "Raiden's backend is unavailable."],
            [{ ok: false, kind: "other" }, "Something went wrong."],
        ] as [GitHubResult, string][]) {
            const gateway = live({ move: () => answer });
            await open(gateway);
            await dragOnto(row(4), band("c"));
            expect(rowsIn("b")).toEqual(["4"]);
            expect(rowsIn("c")).toEqual([]);
            expect(notice()?.getAttribute("role")).toBe("status");
            expect(notice()?.textContent).toBe(`The move of #4 was not saved. ${cause}`);
            expect(gateway.assignments).toEqual({});
        }
    });

    it("rolls back to the last band Raiden saved, not the band the row was dragged from (D6)", async () => {
        const d = deferred();
        let calls = 0;
        const gateway = live({ move: (r) => (++calls === 1 ? undefined : d.move!(r)) });
        await open(gateway);
        await dragOnto(row(4), band("c"));
        expect(gateway.assignments[id(4)]).toBe("c");
        await dragOnto(row(4), band("a"));
        expect(rowsIn("a")).toContain("4");
        await d.answer({ ok: false, kind: "network" });
        expect(rowsIn("c")).toEqual(["4"]);
        expect(gateway.assignments[id(4)]).toBe("c");
    });

    it("sends nothing for a drop on the row's own band (G4)", async () => {
        const gateway = live();
        await open(gateway);
        await dragOnto(row(1), band("a"));
        expect(moves(gateway)).toEqual([]);
        expect(rowsIn("a")).toEqual(["1", "2"]);
    });

    it("lets every sprint band, past or future, and the no-sprint band take a drop, but never a milestone header or the No milestone break (G5)", async () => {
        await open(live());
        for (const target of [band("a"), band("b"), band("c"), band("none")]) {
            const dt = new Transfer();
            await act(async () => {
                fire(row(3), "dragstart", dt);
                expect(fire(target, "dragover", dt).defaultPrevented).toBe(true);
                fire(row(3), "dragend", dt);
            });
        }
        for (const target of [$(".rd-milestone")!, $(".rd-bands__loose")!]) {
            const dt = new Transfer();
            await act(async () => {
                fire(row(3), "dragstart", dt);
                expect(fire(target, "dragover", dt).defaultPrevented).toBe(false);
                fire(target, "drop", dt);
                fire(row(3), "dragend", dt);
            });
        }
        await settle();
        expect(rowsIn("none")).toEqual(["3"]);
    });

    it("never moves an issue for a drag that started outside Raiden or that carries text, files or a link (G6)", async () => {
        const gateway = live();
        await open(gateway);
        for (const init of [{ "text/plain": "#4" } as Record<string, string>, { Files: "" }, { "text/uri-list": "https://github.com/acme/widgets/issues/4" }, { [MOVE_MARKER]: id(4) }]) {
            const dt = new Transfer(init);
            await act(async () => {
                expect(fire(band("c"), "dragover", dt).defaultPrevented).toBe(false);
                fire(band("c"), "drop", dt);
            });
        }
        // A Raiden drag that also carries a link is refused too.
        const dt = new Transfer();
        await act(async () => {
            fire(row(4), "dragstart", dt);
            dt.data.set("text/uri-list", "https://example.com");
            expect(fire(band("c"), "dragover", dt).defaultPrevented).toBe(false);
            fire(band("c"), "drop", dt);
            fire(row(4), "dragend", dt);
        });
        await settle();
        expect(moves(gateway)).toEqual([]);
        expect(rowsIn("b")).toEqual(["4"]);
    });

    it("moves the row and carries no link when the drag starts on the issue link (G7)", async () => {
        const gateway = live();
        await open(gateway);
        const link: HTMLAnchorElement = row(4).querySelector<HTMLAnchorElement>("a.rd-ref")!;
        expect(link.getAttribute("draggable")).toBe("false");
        const dt = await dragOnto(link, band("c"));
        expect(dt.set).toEqual([MOVE_MARKER]);
        expect(rowsIn("c")).toEqual(["4"]);
    });

    it("gives a person without the maintain or admin role no draggable rows, and a drag moves nothing (G26)", async () => {
        const gateway = live({ mayEdit: false });
        await open(gateway);
        for (const r of $$<HTMLElement>(".rd-lb-row")) {
            expect(r.getAttribute("draggable")).not.toBe("true");
        }
        await dragOnto(row(4), band("c"));
        expect(moves(gateway)).toEqual([]);
        expect(rowsIn("b")).toEqual(["4"]);
    });

    it("keeps one move in flight per row and saves the last band the lead chose (G22, D6)", async () => {
        const d = deferred();
        const gateway = live({ move: d.move });
        await open(gateway);
        await dragOnto(row(4), band("c"));
        await dragOnto(row(4), band("a"));
        await dragOnto(row(4), band("none"));
        expect(d.pending()).toBe(1);
        expect(rowsIn("none")).toContain("4");
        await d.answer(undefined);
        expect(d.pending()).toBe(1);
        await d.answer(undefined);
        expect(moves(gateway).map((r) => (r.body as { sprint: string | null }).sprint)).toEqual(["c", null]);
        expect(gateway.assignments[id(4)]).toBe(null);
        expect(rowsIn("none")).toContain("4");
    });

    it("sends no newer write when the lead moves the row back to the band just written (D6 step 4)", async () => {
        const d = deferred();
        const gateway = live({ move: d.move });
        await open(gateway);
        await dragOnto(row(4), band("c"));
        await dragOnto(row(4), band("a"));
        await dragOnto(row(4), band("c"));
        await d.answer(undefined);
        expect(d.pending()).toBe(0);
        expect(moves(gateway)).toHaveLength(1);
        expect(rowsIn("c")).toEqual(["4"]);
    });

    it("moves different rows independently (D6)", async () => {
        const d = deferred();
        const gateway = live({ move: d.move });
        await open(gateway);
        await dragOnto(row(4), band("c"));
        await dragOnto(row(3), band("c"));
        expect(d.pending()).toBe(2);
    });

    it("lands a running move on its own repository and issue, and never shows its result on another repository's page (G23)", async () => {
        const d = deferred();
        const gateway = live({ move: d.move });
        await open(gateway);
        await dragOnto(row(4), band("c"));
        await act(async () => repos.set(GADGETS));
        await settle();
        await d.answer({ ok: false, kind: "other" });
        expect(moves(gateway)[0]!.body).toEqual({ owner: "acme", name: "widgets", issue: id(4), sprint: "c" });
        expect(notice()).toBeNull();
        expect(root.textContent).not.toMatch(/not saved/);
    });

    it("shows a saved move to another signed-in person on their next load (G8)", async () => {
        const gateway = live();
        await open(gateway, "ada");
        await dragOnto(row(4), band("c"));
        gateway.backend.length = 0;
        const reader = live({ mayEdit: false });
        reader.assignments = { ...gateway.assignments };
        await open(reader, "bob");
        expect(rowsIn("c")).toEqual(["4"]);
    });
});
