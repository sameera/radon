import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root: string = fileURLToPath(new URL("../../../", import.meta.url));

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name: string): string[] => {
        const path: string = join(dir, name);
        if (name === "node_modules" || name === "dist") return [];
        if (statSync(path).isDirectory()) return sources(path);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
}

describe("one place sends GitHub requests (G17)", () => {
    it("names GitHub's API address only in the shared GitHub client", () => {
        const offenders: string[] = ["libs", "apps"]
            .flatMap((d: string) => sources(join(root, d)))
            .filter((f: string) => readFileSync(f, "utf8").includes("api.github.com"))
            .map((f: string) => relative(root, f));
        expect(offenders).toEqual(["libs/shared/src/github.ts"]);
    });
    it("never reads the sign-in record from the app lib or the content script (G3)", () => {
        const files: string[] = [...sources(join(root, "libs/app")), join(root, "apps/extension/src/content.ts"), join(root, "apps/extension/src/app.ts")];
        for (const f of files) {
            expect(readFileSync(f, "utf8"), relative(root, f)).not.toMatch(/raiden\.signin|accessToken|refreshToken/);
        }
    });
});
