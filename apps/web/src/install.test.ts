import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = (p: string): string => new URL(p, import.meta.url).pathname;
const text = (p: string): string => readFileSync(here(p), "utf8");
function pngSize(p: string): [number, number] {
    const b: Buffer = readFileSync(here(p));
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("app manifest (G12, G13)", () => {
    const manifest = JSON.parse(text("../manifest.webmanifest")) as {
        name: string;
        short_name: string;
        display: string;
        start_url: string;
        scope: string;
        icons: { src: string; sizes: string; type: string }[];
    };

    it("names the app Raiden and opens it in its own window", () => {
        expect(manifest.name).toBe("Raiden");
        expect(manifest.short_name).toBe("Raiden");
        expect(manifest.display).toBe("standalone");
    });

    it("uses relative start address and scope so it works under a sub-path", () => {
        expect(manifest.start_url).toBe("./");
        expect(manifest.scope).toBe("./");
    });

    it("lists the Raiden icon at the sizes Chrome requires, each a real PNG of that size", () => {
        const sizes: string[] = manifest.icons.map((i) => i.sizes);
        expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
        for (const icon of manifest.icons) {
            expect(icon.src).not.toMatch(/^(?:https?:)?\//);
            expect(icon.type).toBe("image/png");
            const [w, h] = icon.sizes.split("x").map(Number);
            expect(pngSize(`../../../docs/assets/${icon.src}`)).toEqual([w, h]);
        }
    });

    it("is linked from the page by a relative address", () => {
        expect(text("../index.html")).toMatch(/<link rel="manifest" href="\.\/manifest\.webmanifest"/);
    });
});

describe("offline page (G10, G14)", () => {
    const html: string = text("../offline.html");

    it("says the web view needs a connection and carries the Raiden name", () => {
        expect(html).toContain("Raiden");
        expect(html).toMatch(/needs a connection/i);
    });

    it("is self-contained: makes no request to any host", () => {
        expect(html).not.toMatch(/(?:src|href)="(?:https?:)?\/\//);
        expect(html).not.toMatch(/<script[^>]+src=/);
        expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    });

    it("takes its theme from the system setting", () => {
        expect(html).toContain("prefers-color-scheme");
        expect(html).toContain("data-theme");
    });

    it("takes its colors from the design-system tokens, with a slot the build fills", () => {
        expect(html).toContain("/*TOKENS*/");
        expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
    });
});
