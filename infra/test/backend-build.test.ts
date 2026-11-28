// Story #97: the backend build is repeatable, so an unchanged checkout uploads no new code (D8, G2).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function buildInto(dir: string): string {
    execFileSync("scripts/emulator.sh", ["build"], {
        env: { ...process.env, RAIDEN_LAMBDA_DIR: dir, PATH: `${process.env.PATH}:/usr/local/go/bin` },
        stdio: "pipe",
    });
    return createHash("sha256").update(readFileSync(join(dir, "lambda.zip"))).digest("hex");
}

describe("backend build", () => {
    it("gives the same zip from the same source", () => {
        const a: string = buildInto(mkdtempSync(join(tmpdir(), "raiden-build-a-")));
        const b: string = buildInto(mkdtempSync(join(tmpdir(), "raiden-build-b-")));
        expect(a).toBe(b);
    });
});
