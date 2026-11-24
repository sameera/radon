// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GitHubGateway } from "./gateway.ts";
import { mountApp } from "./mount.tsx";
import { createRepoStore, type Repo, type RepoStore } from "./repo.tsx";
import { createSignInController } from "./signin.ts";
import { createSessionStore } from "./session.ts";

const ds = (file: string): string => readFileSync(resolve(__dirname, "../../design-system", file), "utf8");

const WIDGETS: Repo = { owner: "acme", name: "widgets", url: "https://github.com/acme/widgets" };
const LONG: Repo = { owner: "a-very-long-organisation-name-indeed", name: "an-even-longer-repository-name-for-the-banner", url: "https://github.com/x/y" };

// A GitHub whose reachable list is `rows`, which may lack the current repository.
function gatewayFor(rows: Repo[]): GitHubGateway {
    return {
        async request(request) {
            if (request.path === "/user/installations") {
                return { ok: true, status: 200, body: { total_count: 1, installations: [{ id: 1 }] } };
            }
            return {
                ok: true,
                status: 200,
                body: { total_count: rows.length, repositories: rows.map((r) => ({ name: r.name, owner: { login: r.owner }, html_url: r.url })) },
            };
        },
    };
}

let root: HTMLElement;
let unmount: (() => void) | undefined;
const flush = (): Promise<void> => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

async function open(o: { login: string | null; repo: RepoStore; rows?: Repo[]; banner?: boolean }): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, {
            session: createSessionStore(),
            signIn: createSignInController({ status: async () => o.login, signIn: async () => (o.login ? { login: o.login } : null) }),
            gateway: gatewayFor(o.rows ?? []),
            repo: o.repo,
            banner: o.banner === false ? undefined : { icon: "i.png" },
        });
    });
    await flush();
    await flush();
}
const crumb = (): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>(".rd-banner .rd-breadcrumb");

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

describe("the repository breadcrumb (D1, D2, G1, G2, G4, G5)", () => {
    it("reads owner, a slash, then name, for the chosen repository (G1)", async () => {
        await open({ login: "ada", repo: createRepoStore(WIDGETS), rows: [WIDGETS] });
        const parts: string[] = Array.from(crumb()!.children).map((e) => e.textContent!);
        expect(parts).toEqual(["acme", "/", "widgets"]);
        expect(crumb()!.querySelector(".rd-breadcrumb__owner")!.textContent).toBe("acme");
        expect(crumb()!.querySelector(".rd-breadcrumb__sep")!.textContent).toBe("/");
        expect(crumb()!.querySelector(".rd-breadcrumb__name")!.textContent).toBe("widgets");
    });

    it("shows the shared repository even when the loaded list lacks it (G1)", async () => {
        const repo: RepoStore = createRepoStore(null);
        await open({ login: "ada", repo, rows: [] });
        await act(() => repo.set(WIDGETS));
        expect(crumb()!.textContent).toBe("acme/widgets");
    });

    it("follows the shared repository when it changes", async () => {
        const repo: RepoStore = createRepoStore(WIDGETS);
        await open({ login: "ada", repo, rows: [WIDGETS] });
        await act(() => repo.set({ owner: "zeta", name: "gadgets", url: "https://github.com/zeta/gadgets" }));
        expect(crumb()!.textContent).toBe("zeta/gadgets");
    });

    it("shows the prompt Pick a repository in its place while none is chosen (G2)", async () => {
        await open({ login: "ada", repo: createRepoStore(null), rows: [WIDGETS] });
        expect(crumb()!.textContent).toBe("Pick a repository");
        expect(crumb()!.tagName).toBe("BUTTON");
        expect(root.textContent).not.toContain("Choose a repository");
    });

    it("is one control: one button with no link or other control inside (G4)", async () => {
        await open({ login: "ada", repo: createRepoStore(WIDGETS), rows: [WIDGETS] });
        expect(root.querySelectorAll(".rd-banner .rd-breadcrumb")).toHaveLength(1);
        expect(crumb()!.querySelectorAll("a, button, select, input, [role=menu], [tabindex]")).toHaveLength(0);
        expect(root.querySelector(".rd-banner select")).toBeNull();
        expect(root.querySelector(".rd-banner a")).toBeNull();
    });

    it("carries the full owner/name in its accessible name (G5)", async () => {
        await open({ login: "ada", repo: createRepoStore(LONG), rows: [LONG] });
        expect(crumb()!.getAttribute("aria-label")).toBe(`Repository: ${LONG.owner}/${LONG.name}`);
        expect(crumb()!.getAttribute("type")).toBe("button");
    });

    it("shows only in the web view's banner while signed in (G17, G18)", async () => {
        await open({ login: null, repo: createRepoStore(null) });
        expect(crumb()).toBeNull();
        unmount?.();
        await open({ login: "ada", repo: createRepoStore(WIDGETS), banner: false });
        expect(root.querySelector(".rd-breadcrumb")).toBeNull();
    });

    it("leaves the avatar at the right end of the banner (G23)", async () => {
        await open({ login: "ada", repo: createRepoStore(WIDGETS), rows: [WIDGETS] });
        const banner: HTMLElement = root.querySelector(".rd-banner")!;
        expect(banner.lastElementChild!.classList.contains("rd-banner__account")).toBe(true);
    });
});

describe("breadcrumb style (D1, G3, G5)", () => {
    const css: string = ds("components.css");
    const rule = (selector: string): string => {
        const m: RegExpMatchArray | null = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, "\\.").replace(/[:]/g, "\\:")}\\s*\\{([^}]*)\\}`));
        expect(m, `rule ${selector}`).not.toBeNull();
        return m![1];
    };
    const sels: string[] = [
        ".rd-breadcrumb",
        ".rd-breadcrumb:hover",
        ".rd-breadcrumb:focus-visible",
        ".rd-breadcrumb__owner",
        ".rd-breadcrumb__sep",
        ".rd-breadcrumb__name",
        ".rd-breadcrumb__prompt",
    ];

    it("uses tokens only: no literal color, no literal size", () => {
        for (const sel of sels) {
            const body: string = rule(sel);
            expect(body, sel).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
            expect(body.replace(/\b[12]px\b/g, ""), sel).not.toMatch(/\b[1-9]\d*(?:\.\d+)?(?:px|rem|em)\b/);
        }
    });

    it("is set in the sans type, owner regular, name semibold, slash muted", () => {
        expect(rule(".rd-breadcrumb")).toMatch(/var\(--font-sans\)/);
        expect(rule(".rd-breadcrumb")).not.toMatch(/--font-mono/);
        expect(rule(".rd-breadcrumb__owner")).toMatch(/font-weight:\s*400/);
        expect(rule(".rd-breadcrumb__name")).toMatch(/font-weight:\s*600/);
        expect(rule(".rd-breadcrumb__sep")).toMatch(/color:\s*var\(--rd-fg-muted\)/);
        expect(rule(".rd-breadcrumb")).toMatch(/color:\s*var\(--rd-fg\)/);
    });

    it("gives hover a one-step darker ground and the design system's focus ring", () => {
        expect(rule(".rd-breadcrumb:hover")).toMatch(/background:\s*var\(--rd-canvas-inset\)/);
        expect(rule(".rd-breadcrumb:focus-visible")).toMatch(/outline:\s*2px solid var\(--rd-accent\)/);
    });

    it("keeps the banner on one line: a capped width and an ellipsis (G5)", () => {
        const body: string = rule(".rd-breadcrumb");
        expect(body).toMatch(/max-width:\s*var\(--rd-header-crumb-max\)/);
        expect(body).toMatch(/white-space:\s*nowrap/);
        expect(body).toMatch(/overflow:\s*hidden/);
        expect(rule(".rd-breadcrumb__name")).toMatch(/text-overflow:\s*ellipsis/);
        expect(rule(".rd-breadcrumb__owner")).toMatch(/text-overflow:\s*ellipsis/);
        expect(ds("tokens.css")).toMatch(/--rd-header-crumb-max:\s*\d+px/);
    });
});

function luminance(hex: string): number {
    const c: number[] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe("breadcrumb contrast (G3)", () => {
    const tokens = JSON.parse(ds("tokens.json")) as { color: { tokens: { name: string; value: Record<string, string> }[] } };
    const value = (name: string, theme: string): string => tokens.color.tokens.find((t) => t.name === name)!.value[theme];

    for (const theme of ["light", "dark"]) {
        for (const ground of ["rd-canvas-subtle", "rd-canvas-inset"]) {
            for (const fg of ["rd-fg", "rd-fg-muted"]) {
                it(`${fg} meets 4.5:1 on ${ground} in the ${theme} theme`, () => {
                    expect(contrast(value(fg, theme), value(ground, theme))).toBeGreaterThanOrEqual(4.5);
                });
            }
        }
    }
});

describe("design-system documentation (D1, D7)", () => {
    it("has a guideline page and a preview for the breadcrumb", () => {
        const page: string = ds("components/Breadcrumb.md");
        expect(page).toContain("rd-breadcrumb");
        expect(page).toMatch(/Repository: owner\/name/);
        expect(ds("preview.html")).toContain("rd-breadcrumb");
    });

    it("has the Banner guideline hold the breadcrumb, not the drop-down", () => {
        const banner: string = ds("components/Banner.md");
        expect(banner).toContain("rd-breadcrumb");
        expect(banner).toContain("Breadcrumb.md");
        expect(banner).not.toMatch(/drop-down/i);
    });

    it("narrows the README's mono rule to repo names inside references", () => {
        const readme: string = ds("README.md");
        expect(readme).toMatch(/repo names inside references and lists of references/);
        expect(readme).not.toMatch(/for issue numbers and repo names\./);
    });
});
