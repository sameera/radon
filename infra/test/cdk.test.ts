// Story #97: how the commands call AWS CDK (D1, D8, D13).
import { describe, expect, it } from "vitest";
import { bootstrapArgs, deployArgs } from "../src/cdk.ts";
import { BACKEND_STACK } from "../src/names.ts";

describe("cdk arguments", () => {
    it("deploys exactly one stack, with rollback on, no hotswap and no approval prompt", () => {
        const args: string[] = deployArgs(BACKEND_STACK);
        expect(args[0]).toBe("deploy");
        expect(args).toContain(BACKEND_STACK);
        expect(args).toContain("--exclusively");
        expect(args).toContain("--rollback");
        expect(args.join(" ")).toContain("--require-approval never");
        expect(args.some((a) => a.includes("hotswap"))).toBe(false);
        expect(args.join(" ")).toContain("--app node infra/src/app.ts");
    });

    it("runs the default bootstrap", () => {
        const args: string[] = bootstrapArgs();
        expect(args[0]).toBe("bootstrap");
        expect(args.some((a) => a.includes("trust") || a.includes("execution-policies"))).toBe(false);
    });
});
