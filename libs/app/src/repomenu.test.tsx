// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GitHubGateway } from "./gateway.ts";
import { mountApp, type PreferenceStore } from "./mount.tsx";
import { createRepoStore, type Repo, type RepoStore } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { createSessionStore } from "./session.ts";

const ds = (file: string): string => readFileSync(resolve(__dirname, "../../design-system", file), "utf8");

const r = (owner: string, name: string): Repo => ({ owner, name, url: `https://github.com/${owner}/${name}` });
const ROWS: Repo[] = [r("acme", "gadgets"), r("acme", "widgets"), r("Beta", "Raiden"), r("zeta", "rail")];

// A GitHub whose repository list the test controls: rows, "fail", or a promise to wait on.
function gatewayFor(answer: () => Repo[] | "fail" | Promise<Repo[] | "fail">): GitHubGateway & { calls: number } {
    const gateway = {
        calls: 0,
        async request(request: { path: string }) {
            gateway.calls++;
            if (request.path === "/user/installations") {
                return { ok: true as const, status: 200, body: { total_count: 1, installations: [{ id: 1 }] } };
            }
            const got = await answer();
            if (got === "fail") {
                return { ok: false as const, kind: "network" as const };
            }
            return {
                ok: true as const,
                status: 200,
                body: { total_count: got.length, repositories: got.map((x) => ({ name: x.name, owner: { login: x.owner }, html_url: x.url })) },
            };
        },
    };
    return gateway;
}
function memoryPrefs(initial: Record<string, unknown> = {}): PreferenceStore & { data: Record<string, unknown> } {
    const data: Record<string, unknown> = { ...initial };
    return { data, get: async (k) => data[k], set: async (k, v) => void (data[k] = v) };
}

let root: HTMLElement;
let unmount: (() => void) | undefined;
const flush = (): Promise<void> => act(async () => void (await new Promise((res) => setTimeout(res, 0))));

async function open(o: { gateway: GitHubGateway; repo?: RepoStore; prefs?: PreferenceStore; login?: string }): Promise<RepoStore> {
    const repo: RepoStore = o.repo ?? createRepoStore(null);
    const login: string = o.login ?? "ada";
    await act(async () => {
        unmount = await mountApp(root, {
            session: createSessionStore(),
            signIn: createSignInController({ status: async () => login, signIn: async () => ({ login }), signOut: async () => undefined }),
            gateway: o.gateway,
            prefs: o.prefs,
            repo,
            banner: { icon: "i.png" },
        });
    });
    await flush();
    await flush();
    return repo;
}
const crumb = (): HTMLButtonElement => root.querySelector<HTMLButtonElement>(".rd-banner .rd-breadcrumb")!;
const menu = (): HTMLElement | null => root.querySelector<HTMLElement>(".rd-banner .rd-search-menu");
const search = (): HTMLInputElement => menu()!.querySelector<HTMLInputElement>("input")!;
const options = (): HTMLElement[] => Array.from(menu()!.querySelectorAll<HTMLElement>("[role=option]"));
const labels = (): string[] => options().map((o) => o.textContent!);
const status = (): string | null => menu()!.querySelector("[role=status]")?.textContent ?? null;
const highlighted = (): string | null => {
    const id: string | null = search().getAttribute("aria-activedescendant");
    return id ? root.querySelector(`[id="${id}"]`)!.textContent : null;
};
const avatar = (): HTMLButtonElement => root.querySelector<HTMLButtonElement>(".rd-banner__avatar")!;

async function openMenu(): Promise<void> {
    await act(() => crumb().click());
}
async function type(text: string): Promise<void> {
    await act(() => {
        search().value = text;
        search().dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function press(key: string, target: Element = search()): Promise<KeyboardEvent> {
    const event: KeyboardEvent = new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true });
    await act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    root.remove();
    vi.unstubAllGlobals();
});

describe("opening the repository menu (D3, D5, G2, G6, G10, G12)", () => {
    it("opens under the breadcrumb with an empty, focused search box and every loaded repository", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        expect(menu()).toBeNull();
        expect(crumb().getAttribute("aria-expanded")).toBe("false");
        await openMenu();
        expect(menu()).not.toBeNull();
        expect(crumb().getAttribute("aria-expanded")).toBe("true");
        expect(search().value).toBe("");
        expect(document.activeElement).toBe(search());
        expect(search().getAttribute("role")).toBe("combobox");
        expect(menu()!.querySelector("[role=listbox]")).not.toBeNull();
        expect(labels()).toEqual(["acme/gadgets", "acme/widgets", "Beta/Raiden", "zeta/rail"]);
    });

    it("opens from the prompt while no repository is chosen (G2)", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        expect(crumb().textContent).toBe("Pick a repository");
        await openMenu();
        expect(menu()).not.toBeNull();
    });

    it("lists all several hundred repositories", async () => {
        const many: Repo[] = Array.from({ length: 420 }, (_, i) => r("acme", `r${String(i).padStart(3, "0")}`));
        await open({ gateway: gatewayFor(() => many) });
        await openMenu();
        expect(options().length).toBe(420);
    });

    it("marks the current repository as selected (G12)", async () => {
        await open({ gateway: gatewayFor(() => ROWS), repo: createRepoStore(r("acme", "widgets")) });
        await openMenu();
        const selected: HTMLElement[] = options().filter((o) => o.getAttribute("aria-selected") === "true");
        expect(selected.map((o) => o.textContent)).toEqual(["acme/widgets"]);
    });

    it("sends no request to GitHub when opened or typed in (G10)", async () => {
        const gateway = gatewayFor(() => ROWS);
        await open({ gateway });
        const before: number = gateway.calls;
        await openMenu();
        await type("acme");
        await type("");
        expect(gateway.calls).toBe(before);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("clears the search text on each open", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        await openMenu();
        await type("wid");
        await press("Escape");
        await openMenu();
        expect(search().value).toBe("");
        expect(options().length).toBe(4);
    });
});

describe("searching (D4, D5, G7, G8, G11)", () => {
    it("keeps only owner/name entries containing the text, ignoring case and outer spaces, in order (G7)", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        await openMenu();
        await type("RAI");
        expect(labels()).toEqual(["Beta/Raiden", "zeta/rail"]);
        await type("  acme  ");
        expect(labels()).toEqual(["acme/gadgets", "acme/widgets"]);
        await type("me/wid");
        expect(labels()).toEqual(["acme/widgets"]);
        await type("");
        expect(labels().length).toBe(4);
    });

    it("says no repository matches and lists nothing when the text matches none (G8)", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        await openMenu();
        await type("nothing-like-it");
        expect(options()).toHaveLength(0);
        expect(status()).toBe("No repository matches");
    });

    it("highlights the first match after each change, and Up and Down move it (G11)", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        await openMenu();
        expect(highlighted()).toBe("acme/gadgets");
        await press("ArrowDown");
        expect(highlighted()).toBe("acme/widgets");
        await press("ArrowDown");
        await press("ArrowDown");
        await press("ArrowDown");
        expect(highlighted()).toBe("zeta/rail");
        await press("ArrowUp");
        expect(highlighted()).toBe("Beta/Raiden");
        await type("a");
        expect(highlighted()).toBe("acme/gadgets");
        expect(document.activeElement).toBe(search());
    });

    it("re-applies the text to a complete fresh list that arrives while open (D5)", async () => {
        let release!: (rows: Repo[]) => void;
        const slow = new Promise<Repo[]>((res) => (release = res));
        const prefs = memoryPrefs({ repositories: { login: "ada", repos: [r("acme", "widgets")] } });
        await open({ gateway: gatewayFor(() => slow), prefs });
        await openMenu();
        await type("rai");
        expect(status()).toBe("No repository matches");
        await act(async () => release(ROWS));
        await flush();
        expect(search().value).toBe("rai");
        expect(labels()).toEqual(["Beta/Raiden", "zeta/rail"]);
    });

    it("never stores the search text (G22)", async () => {
        const prefs = memoryPrefs();
        await open({ gateway: gatewayFor(() => ROWS), prefs });
        await openMenu();
        await type("unique-search-text");
        await press("Escape");
        expect(JSON.stringify(prefs.data)).not.toContain("unique-search-text");
    });
});

describe("empty list messages (D6, G9)", () => {
    it("says Loading repositories while the first load runs, then lists what arrives", async () => {
        let release!: (rows: Repo[]) => void;
        const slow = new Promise<Repo[]>((res) => (release = res));
        await open({ gateway: gatewayFor(() => slow) });
        await openMenu();
        expect(options()).toHaveLength(0);
        expect(status()).toBe("Loading repositories");
        await act(async () => release(ROWS));
        await flush();
        expect(status()).toBeNull();
        expect(options().length).toBe(4);
    });

    it("says No repositories to show when the list is empty and no load runs", async () => {
        await open({ gateway: gatewayFor(() => "fail") });
        await openMenu();
        expect(options()).toHaveLength(0);
        expect(status()).toBe("No repositories to show");
    });

    it("puts each message in a status region", async () => {
        await open({ gateway: gatewayFor(() => []) });
        await openMenu();
        expect(menu()!.querySelector("[role=status]")!.textContent).toBe("No repositories to show");
    });
});

describe("picking and closing (D3, G13, G14, G15, G16)", () => {
    it("picks by click: closes, sets and remembers it, refocuses the breadcrumb, switches the pages (G13)", async () => {
        const prefs = memoryPrefs();
        const repo = await open({ gateway: gatewayFor(() => ROWS), prefs });
        expect(root.querySelector(".rd-pick-prompt")).not.toBeNull();
        await openMenu();
        await act(() => options()[1].click());
        expect(menu()).toBeNull();
        expect(repo.get()).toEqual(r("acme", "widgets"));
        expect(prefs.data["repository"]).toEqual({ login: "ada", ...r("acme", "widgets") });
        expect(document.activeElement).toBe(crumb());
        expect(crumb().textContent).toBe("acme/widgets");
        expect(root.querySelector(".rd-groom")).not.toBeNull();
    });

    it("picks the highlighted entry with Enter, so typing then Enter picks the first match", async () => {
        const repo = await open({ gateway: gatewayFor(() => ROWS) });
        await openMenu();
        await type("rai");
        await press("Enter");
        expect(menu()).toBeNull();
        expect(repo.get()).toEqual(r("Beta", "Raiden"));
        expect(document.activeElement).toBe(crumb());
    });

    it("closes and changes nothing when the current repository is picked", async () => {
        const prefs = memoryPrefs();
        const set = vi.spyOn(prefs, "set");
        const repo = await open({ gateway: gatewayFor(() => ROWS), prefs, repo: createRepoStore(r("acme", "widgets")) });
        set.mockClear();
        await openMenu();
        await act(() => options()[1].click());
        expect(menu()).toBeNull();
        expect(repo.get()).toEqual(r("acme", "widgets"));
        expect(set.mock.calls.map((c) => c[0])).not.toContain("repository");
    });

    it("closes on Escape, returns focus to the breadcrumb and changes nothing (G14)", async () => {
        const prefs = memoryPrefs({ repository: { login: "ada", ...r("acme", "widgets") } });
        const repo = await open({ gateway: gatewayFor(() => ROWS), prefs });
        await openMenu();
        await press("ArrowDown");
        await press("Escape");
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(crumb());
        expect(repo.get()).toEqual(r("acme", "widgets"));
        expect(prefs.data["repository"]).toEqual({ login: "ada", ...r("acme", "widgets") });
    });

    it("closes on a click outside and changes nothing (G14)", async () => {
        const repo = await open({ gateway: gatewayFor(() => ROWS), repo: createRepoStore(r("acme", "widgets")) });
        await openMenu();
        await act(() => {
            document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
        });
        expect(menu()).toBeNull();
        expect(repo.get()).toEqual(r("acme", "widgets"));
    });

    it("stays open on a click inside it", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        await openMenu();
        await act(() => {
            search().dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
        });
        expect(menu()).not.toBeNull();
    });

    it("closes on Tab and changes nothing (G14)", async () => {
        const repo = await open({ gateway: gatewayFor(() => ROWS), repo: createRepoStore(r("acme", "widgets")) });
        await openMenu();
        await press("Tab");
        expect(menu()).toBeNull();
        expect(repo.get()).toEqual(r("acme", "widgets"));
    });

    it("keeps keys typed in the search box inside Raiden, and Escape closes only this menu (G15)", async () => {
        const outside = vi.fn();
        document.addEventListener("keydown", outside);
        try {
            await open({ gateway: gatewayFor(() => ROWS) });
            await openMenu();
            await press("s");
            await press("Escape");
            expect(outside).not.toHaveBeenCalled();
            expect(menu()).toBeNull();
            expect(root.querySelector("[role=menu]")).toBeNull();
        } finally {
            document.removeEventListener("keydown", outside);
        }
    });

    it("opening it closes the avatar menu, and the reverse (G16)", async () => {
        await open({ gateway: gatewayFor(() => ROWS) });
        await act(() => avatar().click());
        expect(root.querySelector(".rd-banner [role=menu]")).not.toBeNull();
        await openMenu();
        expect(menu()).not.toBeNull();
        expect(root.querySelector(".rd-banner [role=menu]")).toBeNull();
        await act(() => avatar().click());
        expect(root.querySelector(".rd-banner [role=menu]")).not.toBeNull();
        expect(menu()).toBeNull();
    });
});

describe("searchable menu style (D7, G3)", () => {
    const css: string = ds("components.css");
    const rule = (selector: string): string => {
        const esc: string = selector.replace(/[.[\]="]/g, (c) => `\\${c}`);
        const m: RegExpMatchArray | null = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
        expect(m, `rule ${selector}`).not.toBeNull();
        return m![1];
    };

    it("uses tokens only: no literal color, no literal size", () => {
        for (const sel of [
            ".rd-menu--start",
            ".rd-search-menu",
            ".rd-search-menu__list",
            ".rd-search-menu__option",
            ".rd-search-menu__option--active",
            ".rd-search-menu__option[aria-selected=\"true\"]",
            ".rd-search-menu__status",
        ]) {
            const body: string = rule(sel);
            expect(body, sel).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
            expect(body.replace(/\b[12]px\b/g, ""), sel).not.toMatch(/\b[1-9]\d*(?:\.\d+)?(?:px|rem|em)\b/);
        }
    });

    it("opens left-aligned under its trigger", () => {
        const body: string = rule(".rd-menu--start");
        expect(body).toMatch(/left:\s*0/);
        expect(body).toMatch(/right:\s*auto/);
    });

    it("scrolls at a fixed height", () => {
        const body: string = rule(".rd-search-menu__list");
        expect(body).toMatch(/max-height:\s*var\(--rd-search-menu-height\)/);
        expect(body).toMatch(/overflow-y:\s*auto/);
        expect(ds("tokens.css")).toMatch(/--rd-search-menu-height:\s*\d+px/);
    });
});

describe("design-system documentation (D3, D7)", () => {
    it("has a guideline page and a preview for the searchable menu", () => {
        const page: string = ds("components/SearchMenu.md");
        expect(page).toContain("rd-search-menu");
        expect(page).toContain("combobox");
        expect(ds("preview.html")).toContain("rd-search-menu");
    });

    it("updates the Select guideline: no banner use, search lists use the searchable menu", () => {
        const select: string = ds("components/Select.md");
        expect(select).not.toContain("The repository drop-down in the banner is its one use today");
        expect(select).toMatch(/unless the list offers search; then use the searchable menu/);
    });

    it("has the Banner guideline name the searchable menu the breadcrumb opens", () => {
        expect(ds("components/Banner.md")).toContain("SearchMenu.md");
    });
});

function luminance(hex: string): number {
    const c: number[] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [rr, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * rr + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe("searchable menu contrast (G3)", () => {
    const tokens = JSON.parse(ds("tokens.json")) as { color: { tokens: { name: string; value: Record<string, string> }[] } };
    const value = (name: string, theme: string): string => tokens.color.tokens.find((t) => t.name === name)!.value[theme];

    for (const theme of ["light", "dark"]) {
        for (const ground of ["rd-overlay", "rd-canvas-subtle", "rd-canvas-inset"]) {
            for (const fg of ["rd-fg", "rd-fg-muted"]) {
                it(`${fg} meets 4.5:1 on ${ground} in the ${theme} theme`, () => {
                    expect(contrast(value(fg, theme), value(ground, theme))).toBeGreaterThanOrEqual(4.5);
                });
            }
        }
    }
});
