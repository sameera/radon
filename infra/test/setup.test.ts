// Story #97: the setup command (D1, D2, D13, R1, G2, G4).
import { describe, expect, it } from "vitest";
import { runSetup, type SetupDeps } from "../src/setup.ts";
import { BACKEND_STACK, WEB_STACK } from "../src/names.ts";
import { fakeWeb } from "./fakes.ts";

function fake(
    over: Partial<SetupDeps> = {},
    settings: string | null = null,
): { deps: SetupDeps; calls: string[]; lines: string[] } {
    const web = fakeWeb({}, settings);
    const calls: string[] = web.calls;
    const lines: string[] = web.lines;
    const deps: SetupDeps = {
        ...web.deps,
        bootstrapExists: async () => {
            calls.push("bootstrapExists");
            return true;
        },
        bootstrap: async () => {
            calls.push("bootstrap");
        },
        deploy: async (stack: string) => {
            calls.push(`deploy ${stack}`);
        },
        outputs: async (stack: string) => {
            calls.push(`outputs ${stack}`);
            return web.deps.outputs(stack);
        },
        health: async (url: string) => {
            calls.push(`health ${url}`);
            return true;
        },
        log: (line: string) => {
            lines.push(line);
        },
        ...over,
    };
    return { deps, calls, lines };
}

describe("setup", () => {
    it("reuses an existing bootstrap", async () => {
        const { deps, calls } = fake();
        await runSetup(deps);
        expect(calls).not.toContain("bootstrap");
    });

    it("runs the default bootstrap when the account has none, before any deploy", async () => {
        const { deps, calls } = fake({ bootstrapExists: async () => false });
        await runSetup(deps);
        expect(calls.indexOf("bootstrap")).toBeGreaterThanOrEqual(0);
        expect(calls.indexOf("bootstrap")).toBeLessThan(calls.indexOf(`deploy ${BACKEND_STACK}`));
    });

    it("deploys the backend stack, checks health and prints the backend address", async () => {
        const { deps, calls, lines } = fake();
        const result = await runSetup(deps);
        expect(calls).toContain(`deploy ${BACKEND_STACK}`);
        expect(calls).toContain("health https://abc.lambda-url.us-east-1.on.aws/");
        expect(result.backendUrl).toBe("https://abc.lambda-url.us-east-1.on.aws/");
        expect(lines.join("\n")).toContain("Backend address: https://abc.lambda-url.us-east-1.on.aws/");
        expect(lines.join("\n")).toMatch(/Web view address:/);
    });

    it("fails unless the backend answers health with ok (G4)", async () => {
        const { deps } = fake({ health: async () => false });
        await expect(runSetup(deps)).rejects.toThrow(/health/);
    });

    it("fails when a deploy fails, and checks nothing after it", async () => {
        const { deps, calls } = fake({
            deploy: async () => {
                throw new Error("stack failed");
            },
        });
        await expect(runSetup(deps)).rejects.toThrow(/stack failed/);
        expect(calls.some((c) => c.startsWith("health"))).toBe(false);
    });

    it("deploys the backend stack, then the web hosting stack, and prints the web view address (D2)", async () => {
        const { deps, calls, lines } = fake();
        const result = await runSetup(deps);
        expect(calls.indexOf(`deploy ${WEB_STACK}`)).toBeGreaterThan(calls.indexOf(`deploy ${BACKEND_STACK}`));
        expect(result.webViewUrl).toBe("https://d1.cloudfront.net/");
        expect(lines.join("\n")).toContain("Web view address: https://d1.cloudfront.net/");
    });

    it("skips the web view upload before the settings exist and names the settings command", async () => {
        const { deps, calls, lines } = fake({}, null);
        await runSetup(deps);
        expect(calls.some((c) => c.startsWith("build") || c.startsWith("put"))).toBe(false);
        expect(lines.join("\n")).toContain("pnpm aws:settings");
    });

    it("builds and uploads the web view once the settings exist", async () => {
        const { deps, calls } = fake({}, '{"clientId":"Iv1.abc"}');
        await runSetup(deps);
        expect(calls.some((c) => c.startsWith("build"))).toBe(true);
        expect(calls.some((c) => c.startsWith("put"))).toBe(true);
    });
});
