// @vitest-environment jsdom
// Story #88: Grooming shows sprint bands under milestone headers (D5, D8, D9).
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitHubResult } from "@raiden/shared";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { fakeGitHub, type FakeGitHub, type FakeOptions } from "./testing/fakegraph.ts";
import { placeSprints } from "./bands.tsx";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";

const CSS_TEXT: string = readFileSync(fileURLToPath(new NodeURL("./app.css", import.meta.url)), "utf8");
// The body of the first rule whose selector matches, so a style change is asserted where it is written.
const rule = (selector: string): string => {
    const at: number = CSS_TEXT.indexOf(`${selector} {`);
    return at < 0 ? "" : CSS_TEXT.slice(at + selector.length + 2, CSS_TEXT.indexOf("}", at));
};

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const sprint = (id: string, start: string, end: string) => ({ id, field: "F", iteration: id, name: `Sprint ${id}`, start, end, origin: "github" });
const milestone = (n: number, title: string, due: string | null, description = "") => ({
    id: `M_${n}`,
    number: n,
    title,
    due: due ?? "",
    description,
    state: "OPEN",
    origin: "github",
});

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

async function open(gateway: FakeGitHub | undefined): Promise<void> {
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

const $ = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
// The band view top to bottom: "M:<title>" for a milestone header, "S:<sprint id>" for a band.
const sequence = (): string[] =>
    $$<HTMLElement>(".rd-milestone, .rd-band[data-sprint]").map((el) =>
        el.classList.contains("rd-milestone") ? `M:${el.dataset.title}` : `S:${el.dataset.sprint}`,
    );

function live(o: Partial<FakeOptions> = {}): FakeGitHub {
    return fakeGitHub({ issues: [{ n: 1, title: "One" }], ...o });
}

describe("band view (story #88)", () => {
    it("shows two columns and one band per sprint, in date order (AC1, G26)", async () => {
        const gateway = live({ sync: { sprints: [sprint("b", "2026-11-16", "2026-11-29"), sprint("a", "2026-11-02", "2026-11-15"), sprint("c", "2026-11-16", "2026-11-22")] } });
        await open(gateway);
        const heads = $$<HTMLElement>(".rd-bands__head h2").map((h) => h.textContent);
        // D15: the goal column is on the left, so it comes first in the page's order.
        expect(heads).toEqual(["Goals", "Backlog"]);
        expect(sequence()).toEqual(["S:a", "S:c", "S:b"]);
        for (const band of $$<HTMLElement>(".rd-band[data-sprint]")) {
            expect(Array.from(band.children, (c) => c.className.split(" ")[0])).toEqual(["rd-band__card", "rd-band__rows"]);
        }
    });

    it("places each sprint under the earliest milestone due on or after its start (AC2, G28)", async () => {
        const gateway = live({
            sync: {
                sprints: [
                    sprint("s1", "2026-11-02", "2026-11-15"),
                    sprint("s2", "2026-11-16", "2026-11-29"),
                    sprint("s3", "2026-11-30", "2026-12-13"),
                    sprint("s4", "2027-01-05", "2027-01-18"),
                ],
                milestones: [milestone(2, "Two", "2026-12-31T08:00:00Z"), milestone(1, "One", "2026-11-20T00:00:00Z")],
            },
        });
        await open(gateway);
        expect(sequence()).toEqual(["M:One", "S:s1", "S:s2", "M:Two", "S:s3", "S:s4"]);
    });

    it("reads a due date in UTC (D9)", () => {
        const sprints = [
            { id: "x", field: "F", iteration: "x", name: "x", start: "2026-11-16", end: "2026-11-29", synced: true },
        ];
        const base = { number: 1, description: "", state: "OPEN", synced: true };
        const late = placeSprints(sprints, [{ ...base, id: "a", title: "A", due: "2026-11-16T00:00:00Z" }]);
        expect(late.map((e) => (e.kind === "milestone" ? `M:${e.milestone.title}` : `S:${e.sprint.id}`))).toEqual(["M:A", "S:x"]);
        const early = placeSprints(sprints, [{ ...base, id: "a", title: "A", due: "2026-11-15T23:59:00Z" }]);
        expect(early.map((e) => (e.kind === "milestone" ? `M:${e.milestone.title}` : `S:${e.sprint.id}`))).toEqual(["M:A", "S:x"]);
        expect(early[0]!.kind === "milestone" && early[0]!.sprints).toEqual([]);
    });

    it("shows each header's title, due date, start date, description and edit link (AC3, AC4, G29)", async () => {
        const gateway = live({
            sync: {
                sprints: [sprint("s1", "2026-11-02", "2026-11-15"), sprint("s2", "2026-11-16", "2026-11-29")],
                milestones: [milestone(3, "Beta", "2026-11-30T00:00:00Z", "Ship the beta"), milestone(4, "Empty", "2026-12-31T00:00:00Z")],
            },
        });
        await open(gateway);
        const [beta, empty] = $$<HTMLElement>(".rd-milestone");
        expect(beta!.querySelector(".rd-milestone__title")!.textContent).toBe("Beta");
        expect(beta!.dataset.due).toBe("2026-11-30");
        expect(beta!.dataset.start).toBe("2026-11-02");
        expect(beta!.querySelector(".rd-milestone__due")!.textContent).toContain("Nov 30, 2026");
        expect(beta!.querySelector(".rd-milestone__start")!.textContent).toContain("Nov 2, 2026");
        expect(beta!.querySelector(".rd-milestone__desc")!.textContent).toBe("Ship the beta");
        expect(beta!.querySelector("input, textarea, [contenteditable]")).toBeNull();
        const link = beta!.querySelector<HTMLAnchorElement>("a.rd-milestone__edit")!;
        expect(link.getAttribute("href")).toBe("https://github.com/acme/widgets/milestones/3/edit");
        expect(link.getAttribute("target")).toBe("_blank");
        expect(empty!.dataset.start).toBe("");
        expect(empty!.querySelector(".rd-milestone__start")).toBeNull();
    });

    it("shows a sprint after every due date, or with no milestones, with no header (AC5, G30)", async () => {
        await open(live({ sync: { sprints: [sprint("s1", "2026-11-02", "2026-11-15")] } }));
        expect(sequence()).toEqual(["S:s1"]);
        expect($(".rd-bands__loose")).toBeNull();
    });

    it("marks where the sprints after every due date start, so none reads as under the last milestone (AC5, G30)", async () => {
        // "|" stands for the break before the loose sprints.
        const layout = (): string[] =>
            $$<HTMLElement>(".rd-milestone, .rd-band[data-sprint], .rd-bands__loose").map((el) =>
                el.classList.contains("rd-bands__loose") ? "|" : el.classList.contains("rd-milestone") ? `M:${el.dataset.title}` : `S:${el.dataset.sprint}`,
            );
        await open(
            live({
                sync: {
                    sprints: [sprint("s1", "2026-11-02", "2026-11-15"), sprint("s2", "2027-01-05", "2027-01-18"), sprint("s3", "2027-01-19", "2027-02-01")],
                    milestones: [milestone(1, "One", "2026-11-20T00:00:00Z")],
                },
            }),
        );
        expect(layout()).toEqual(["M:One", "S:s1", "|", "S:s2", "S:s3"]);
        const mark = $<HTMLElement>(".rd-bands__loose")!;
        expect(mark.getAttribute("role")).toBe("separator");
        expect(mark.textContent).toBe("No milestone");
        expect(mark.classList.contains("rd-milestone")).toBe(false);
        unmount?.();
        root.innerHTML = "";
        await open(live({ sync: { sprints: [sprint("s2", "2027-01-05", "2027-01-18")], milestones: [milestone(1, "One", "2026-11-20T00:00:00Z")] } }));
        expect(layout()).toEqual(["M:One", "|", "S:s2"]);
    });

    it("puts a milestone with no due date after the last sprint band (D9)", async () => {
        await open(live({ sync: { sprints: [sprint("s1", "2026-11-02", "2026-11-15")], milestones: [milestone(1, "Someday", null)] } }));
        expect(sequence()).toEqual(["S:s1", "M:Someday"]);
    });

    it("shows no sample goals, ranking, Undo or Save plan for a signed-in lead (D8, G26)", async () => {
        await open(live({ sync: { sprints: [sprint("s1", "2026-11-02", "2026-11-15")] } }));
        expect($(".rd-goals")).toBeNull();
        expect($(".rd-goal")).toBeNull();
        const buttons = $$<HTMLButtonElement>("button").map((b) => b.textContent);
        expect(buttons).not.toContain("Undo");
        expect(buttons).not.toContain("Save plan");
        expect($(".rd-divider")).not.toBeNull();
    });

    // Story #104, D10 replaces G27: a host with no live connection shows a sign-in note, not the sample page.
    it("shows a sign-in note, and no sample page, for a host with no live connection (G23)", async () => {
        await open(undefined);
        expect($(".rd-bands")).toBeNull();
        expect($(".rd-goals")).toBeNull();
        expect($(".rd-groom-note")!.textContent).toContain("Grooming needs a GitHub sign-in");
    });

    it("puts the name and dates on the card in the goal column, and only rows in the backlog column (AC2, G41, G46)", async () => {
        await open(live({ sync: { sprints: [sprint("s1", "2026-11-02", "2026-11-15")] } }));
        const band = $<HTMLElement>('.rd-band[data-sprint="s1"]')!;
        const card = band.querySelector<HTMLElement>(".rd-band__card")!;
        expect(card.querySelector(".rd-band__name")!.textContent).toBe("Sprint s1");
        expect(card.querySelector(".rd-band__dates")!.textContent).toBe("Nov 2, 2026 – Nov 15, 2026");
        const rows = band.querySelector<HTMLElement>(".rd-band__rows")!;
        expect(rows.querySelector(".rd-band__name, .rd-band__dates, .rd-progress, .is-current")).toBeNull();
        expect(rows.textContent).not.toContain("Sprint s1");
        // G46: no goal field, sample goal, met or missed pill, or prompt to drag issues.
        expect(card.querySelector("input, textarea, [contenteditable], .rd-pill, .rd-goal-card__drop")).toBeNull();
        expect(card.textContent).not.toMatch(/drag|met|missed/i);
    });

    it("keeps every milestone header in the goal column, and the backlog column empty beside it (G42, D17)", async () => {
        await open(live({ sync: { sprints: [sprint("s1", "2026-11-02", "2026-11-15")], milestones: [milestone(1, "One", "2026-11-20T00:00:00Z")] } }));
        const header = $<HTMLElement>(".rd-milestone")!;
        expect(header.parentElement!.classList.contains("rd-bands")).toBe(true);
        expect($(".rd-milestone .rd-lb-row")).toBeNull();
        expect(CSS_TEXT).toMatch(/\.rd-milestone > \*[^{]*\{[^}]*grid-column: 1/);
    });

    it("rules sprints and issues with a dotted line, keeps the line after a milestone solid, and shows no column line (D15)", () => {
        expect(rule(".rd-band")).toMatch(/border-top:\s*1px dotted var\(--rd-border-muted\)/);
        expect(rule(".rd-milestone + .rd-band")).toMatch(/border-top:\s*1px solid var\(--rd-border\)/);
        expect(rule(".rd-lb-group + .rd-lb-group, .rd-lb-group > .rd-lb-row + .rd-lb-row")).toMatch(/border-top:\s*1px dotted var\(--rd-border-muted\)/);
        // The divider is a drag handle only: its line is transparent at rest.
        expect(rule(".rd-divider::after")).toMatch(/background:\s*transparent/);
        expect(CSS_TEXT).not.toMatch(/\.rd-bands__head > \.rd-divider::after\s*\{[^}]*var\(--rd-border-muted\)/);
    });
});

describe("band view: complete loads only (D5, G18, G19)", () => {
    const failures: [GitHubResult, RegExp][] = [
        [{ ok: false, kind: "network" }, /Raiden's backend is not available/],
        [{ ok: false, kind: "permission", reason: "project-unreadable" }, /cannot read the GitHub project that supplies this repository's sprints/],
        [{ ok: false, kind: "permission" }, /cannot read this repository/],
        [{ ok: false, kind: "rate-limit" }, /rate limit/],
        [{ ok: false, kind: "sign-in-needed" }, /signed out/],
    ];
    for (const [result, message] of failures) {
        it(`shows no bands and names the cause when the sync fails: ${message}`, async () => {
            let calls = 0;
            const gateway = live({ sync: () => (++calls === 1 ? result : { ok: true, status: 200, body: { source: null, sprints: [sprint("s1", "2026-11-02", "2026-11-15")], milestones: [] } }) });
            await open(gateway);
            expect($(".rd-band")).toBeNull();
            expect(root.textContent).toMatch(message);
            const retry = $$<HTMLButtonElement>("button").filter((b) => b.textContent === "Try again");
            expect(retry).toHaveLength(1);
            const githubBefore = gateway.requests.length;
            await act(async () => retry[0]!.click());
            await settle();
            expect(gateway.backend).toHaveLength(2);
            expect(gateway.requests.length).toBeGreaterThan(githubBefore);
            expect(sequence()).toEqual(["S:s1"]);
        });
    }

    it("shows no bands when the backlog load fails, even after a good sync", async () => {
        await open(live({ cannotRead: true, sync: { sprints: [sprint("s1", "2026-11-02", "2026-11-15")] } }));
        expect($(".rd-band")).toBeNull();
        expect($$<HTMLButtonElement>("button").filter((b) => b.textContent === "Try again")).toHaveLength(1);
    });
});
