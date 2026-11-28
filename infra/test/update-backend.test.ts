// Story #99: the backend update command (D8, D13, G13, G15, G16, R2).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runBackendUpdate, type BackendUpdateDeps } from "../src/update-backend.ts";
import { BACKEND_STACK } from "../src/names.ts";

function fake(over: Partial<BackendUpdateDeps> = {}) {
    const calls: string[] = [];
    const lines: string[] = [];
    const deps: BackendUpdateDeps = {
        deploy: async (stack: string) => {
            calls.push(`deploy ${stack}`);
        },
        outputs: async (stack: string) => {
            calls.push(`outputs ${stack}`);
            return { BackendUrl: "https://abc.lambda-url.us-east-1.on.aws/" };
        },
        health: async () => {
            calls.push("health");
            return true;
        },
        log: (line: string) => {
            lines.push(line);
        },
        ...over,
    };
    return { deps, calls, lines };
}

describe("backend update", () => {
    it("deploys only the backend stack, then checks health (G16)", async () => {
        const { deps, calls } = fake();
        await runBackendUpdate(deps);
        expect(calls.filter((c) => c.startsWith("deploy"))).toEqual([`deploy ${BACKEND_STACK}`]);
        expect(calls.at(-1)).toBe("health");
    });

    it("fails with an error and no health check when the deploy fails (G15)", async () => {
        const { deps, calls } = fake({
            deploy: async () => {
                throw new Error("UPDATE_ROLLBACK_COMPLETE");
            },
        });
        await expect(runBackendUpdate(deps)).rejects.toThrow(/previous version/);
        expect(calls).not.toContain("health");
    });

    it("fails and names the recovery when new code fails its health check (R2)", async () => {
        const { deps } = fake({ health: async () => false });
        await expect(runBackendUpdate(deps)).rejects.toThrow(/previous commit/);
    });
});

describe("backend update target", () => {
    const project = JSON.parse(readFileSync("infra/project.json", "utf8"));
    const root = JSON.parse(readFileSync("package.json", "utf8"));

    it("builds the backend before any upload, and is never cached (D8, D13)", () => {
        const target = project.targets["update-backend"];
        expect(target.cache).toBe(false);
        expect(target.dependsOn).toContainEqual({ target: "build", projects: ["backend"] });
    });

    it("is one root command, not named deploy", () => {
        expect(root.scripts["aws:update-backend"]).toBe("nx run infra:update-backend");
        expect(Object.keys(root.scripts)).not.toContain("deploy");
    });

    it("never touches the table: the command has no data access (G13)", () => {
        for (const f of ["infra/src/update-backend.ts", "infra/src/commands/update-backend.ts"]) {
            expect(readFileSync(f, "utf8")).not.toMatch(/dynamodb/i);
        }
    });
});
