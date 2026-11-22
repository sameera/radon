// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withBackend } from "./csp.ts";

const html: string = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

function policy(page: string): Map<string, string[]> {
    const content: string = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(page)![1]!;
    return new Map(content.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name!, values];
    }));
}

describe("web view content security policy (G22)", () => {
    it("is set in the page and allows scripts only from its own address", () => {
        const csp = policy(html);
        expect(csp.get("script-src")).toEqual(["'self'"]);
        expect(csp.get("default-src")).toEqual(["'self'"]);
        expect(html).not.toMatch(/unsafe-eval/);
    });
    it("allows network calls only to itself, GitHub's API and the team's backend", () => {
        const csp = policy(withBackend(html, "https://api.team.example/prod"));
        expect(csp.get("connect-src")).toEqual(["'self'", "https://api.github.com", "https://api.team.example"]);
    });
    it("allows only itself and GitHub's API when no backend is set", () => {
        expect(policy(withBackend(html, "")).get("connect-src")).toEqual(["'self'", "https://api.github.com"]);
    });
    it("has no placeholder left after the build step", () => {
        expect(withBackend(html, "https://api.team.example")).not.toContain("BACKEND");
    });
    it("loads no script from another host", () => {
        expect(html).not.toMatch(/<script[^>]+src="(?:https?:)?\/\//);
    });
});
