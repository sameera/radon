// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "./mount.tsx";

const ds = (file: string): string => readFileSync(resolve(__dirname, "../../design-system", file), "utf8");

let root: HTMLElement;
let unmount: () => void;

async function open(banner?: { icon: string }): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, { css: ".x{}", banner, repoUrl: "https://github.com/acme/widgets" });
    });
}

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
    unmount();
    root.remove();
    vi.unstubAllGlobals();
});

describe("banner option (G17, G18, G21)", () => {
    it("draws the banner above the sidebar and the page when the host sets the option", async () => {
        await open({ icon: "raiden-128x.png" });
        const frame: HTMLElement = root.querySelector(".rd-frame")!;
        const kids: Element[] = Array.from(frame.children);
        expect(kids[0].classList.contains("rd-banner")).toBe(true);
        expect(kids[1].classList.contains("rd-app")).toBe(true);
        expect(kids[1].querySelector(".rd-nav")).not.toBeNull();
        expect(kids[1].querySelector(".rd-main")).not.toBeNull();
    });

    it("shows the icon, then the word Raiden, at its left end", async () => {
        await open({ icon: "raiden-128x.png" });
        const banner: HTMLElement = root.querySelector(".rd-banner")!;
        const [mark, word] = Array.from(banner.children);
        expect(mark.tagName).toBe("IMG");
        expect(mark.getAttribute("src")).toBe("raiden-128x.png");
        expect(mark.getAttribute("alt")).toBe("");
        expect(word.textContent).toBe("Raiden");
        expect(word.classList.contains("rd-banner__word")).toBe(true);
    });

    it("has no search, notifications or account menu", async () => {
        await open({ icon: "raiden-128x.png" });
        const banner: HTMLElement = root.querySelector(".rd-banner")!;
        expect(banner.querySelectorAll("input, button, a, [role=search]")).toHaveLength(0);
    });

    it("draws no banner and keeps the tab's layout when the option is not set", async () => {
        await open();
        expect(root.querySelector(".rd-banner")).toBeNull();
        expect(root.querySelector(".rd-frame")).toBeNull();
        expect(root.querySelector(".rd-root > .rd-app")).not.toBeNull();
        expect(root.querySelector(".rd-app--framed")).toBeNull();
    });

    it("sends no request", async () => {
        await open({ icon: "raiden-128x.png" });
        expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps the Raiden pages working under the banner", async () => {
        await open({ icon: "raiden-128x.png" });
        expect(root.querySelector(".rd-nav-item[aria-current=\"page\"]")!.textContent).toContain("Grooming");
    });
});

describe("banner style (G17, G20, G22)", () => {
    const css: string = `${ds("components.css")}\n${readFileSync(resolve(__dirname, "app.css"), "utf8")}`;
    const rule = (selector: string): string => {
        const m: RegExpMatchArray | null = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`));
        expect(m, `rule ${selector}`).not.toBeNull();
        return m![1];
    };

    it("pins the banner to the top of the window while the document scrolls", () => {
        const banner: string = rule(".rd-banner");
        expect(banner).toMatch(/position:\s*sticky/);
        expect(banner).toMatch(/top:\s*0/);
        expect(rule(".rd-frame")).not.toMatch(/overflow|height:\s*100/);
    });

    it("takes the height and padding from design-system values", () => {
        const banner: string = rule(".rd-banner");
        expect(banner).toMatch(/height:\s*var\(--rd-header-height\)/);
        expect(banner).toMatch(/padding:[^;]*var\(--rd-header-padding\)/);
        expect(ds("tokens.css")).toMatch(/--rd-header-height:\s*64px/);
        expect(ds("tokens.css")).toMatch(/--rd-header-padding:\s*32px/);
    });

    it("uses tokens only: no literal color, no literal size", () => {
        for (const sel of [".rd-frame", ".rd-banner", ".rd-banner__mark", ".rd-banner__word", ".rd-app--framed"]) {
            const body: string = rule(sel);
            expect(body, sel).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
            expect(body.replace(/\b1px\b/g, ""), sel).not.toMatch(/\b[1-9]\d*(?:\.\d+)?(?:px|rem|em)\b/);
        }
    });

    it("has a neutral ground, a thin muted bottom edge and a brand-colored word", () => {
        const banner: string = rule(".rd-banner");
        expect(banner).toMatch(/background:\s*var\(--rd-canvas-subtle\)/);
        expect(banner).toMatch(/border-bottom:\s*1px solid var\(--rd-border-muted\)/);
        expect(rule(".rd-banner__word")).toMatch(/color:\s*var\(--rd-brand-fg\)/);
    });

    it("sets the word in the display typeface at weight 800", () => {
        const tokens = ds("tokens.css");
        expect(tokens).toMatch(/\.rd-text-wordmark\s*\{[^}]*var\(--font-display\)[^}]*font-weight:\s*800/);
    });

    it("fills the window below the banner only in the framed layout", () => {
        expect(rule(".rd-app--framed")).toMatch(/min-height:\s*calc\(100vh - var\(--rd-header-height\)\)/);
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

describe("banner contrast (G19)", () => {
    const tokens = JSON.parse(ds("tokens.json")) as {
        color: { tokens: { name: string; value: Record<string, string> }[] };
    };
    const value = (name: string, theme: string): string => tokens.color.tokens.find((t) => t.name === name)!.value[theme];

    for (const theme of ["light", "dark"]) {
        it(`the word meets 4.5:1 against the banner ground in the ${theme} theme`, () => {
            expect(contrast(value("rd-brand-fg", theme), value("rd-canvas-subtle", theme))).toBeGreaterThanOrEqual(4.5);
        });
    }
});

describe("design-system documentation (D7, D10)", () => {
    it("has a guideline page and a preview for the banner", () => {
        expect(ds("components/Banner.md")).toContain("rd-banner");
        expect(ds("preview.html")).toContain("rd-banner");
    });

    it("no longer says Raiden has no logo", () => {
        expect(ds("README.md")).not.toMatch(/No logo yet/i);
    });
});
