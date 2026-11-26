import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FRONTEND_ENV_PATH, loadFrontendEnv } from "../../../scripts/env.ts";

const saved: Record<string, string | undefined> = { RAIDEN_GITHUB_CLIENT_ID: process.env.RAIDEN_GITHUB_CLIENT_ID };

afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    }
});

function envFile(text: string): string {
    const dir: string = mkdtempSync(join(tmpdir(), "raiden-env-"));
    const path: string = join(dir, ".env.frontend.local");
    writeFileSync(path, text);
    return path;
}

describe("frontend env loading", () => {
    it("points at the repo-root file", () => {
        expect(FRONTEND_ENV_PATH).toBe(join(process.cwd(), ".env.frontend.local"));
    });

    it("fills the team settings from the file", () => {
        delete process.env.RAIDEN_GITHUB_CLIENT_ID;
        expect(loadFrontendEnv(envFile("RAIDEN_GITHUB_CLIENT_ID='Iv1test'\n"))).toBe(true);
        expect(process.env.RAIDEN_GITHUB_CLIENT_ID).toBe("Iv1test");
    });

    it("keeps a value already exported", () => {
        process.env.RAIDEN_GITHUB_CLIENT_ID = "from-shell";
        loadFrontendEnv(envFile("RAIDEN_GITHUB_CLIENT_ID='from-file'\n"));
        expect(process.env.RAIDEN_GITHUB_CLIENT_ID).toBe("from-shell");
    });

    it("reports a missing file without failing the build", () => {
        expect(loadFrontendEnv(join(tmpdir(), "raiden-env-absent", ".env.frontend.local"))).toBe(false);
    });
});
