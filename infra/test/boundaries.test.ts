// The infrastructure project imports nothing from the apps (G33), and its stack definitions make no
// AWS call, so synthesis and tests run without credentials (G3).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
    );
}

describe("infra boundaries", () => {
    it("imports nothing from the apps", () => {
        for (const f of files("infra")) {
            expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["'][^"']*apps\//);
        }
    });

    it("keeps the AWS SDK out of the stack definitions", () => {
        for (const f of files("infra/src").filter((f) => f.endsWith("-stack.ts") || f.endsWith("app.ts"))) {
            expect(readFileSync(f, "utf8"), f).not.toContain("@aws-sdk/");
        }
    });
});
