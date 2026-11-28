import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = (p: string): string => new URL(p, import.meta.url).pathname;

describe("web view files (G9, G11)", () => {
    const html: string = readFileSync(here("../index.html"), "utf8");

    it("loads its script by a relative address", () => {
        expect(html).toMatch(/src="\.\/main\.js"/);
    });

    it("names no other host and no root-absolute address", () => {
        expect(html).not.toMatch(/(?:src|href)="(?:https?:)?\/\//);
        expect(html).not.toMatch(/(?:src|href)="\//);
    });

    it("asks the browser not to cache the page, so a new build is picked up on the next load", () => {
        const meta = (name: string): string | undefined =>
            new RegExp(`<meta http-equiv="${name}" content="([^"]+)"`).exec(html)?.[1];
        expect(meta("Cache-Control")).toMatch(/\bno-store\b/);
        expect(meta("Cache-Control")).toMatch(/\bno-cache\b/);
        expect(meta("Pragma")).toBe("no-cache");
        expect(meta("Expires")).toBe("0");
    });

    it("does not use extension code", () => {
        for (const file of readdirSync(here("."))) {
            if (file.endsWith(".test.ts")) continue;
            const text: string = readFileSync(here(`./${file}`), "utf8");
            expect(text, file).not.toMatch(/chrome\.|from "[^"]*apps\//);
        }
    });
});
