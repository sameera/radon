// Runs the AWS CDK command-line tool that pnpm installs, from the repo root.
import { spawn } from "node:child_process";

const APP: string = "node infra/src/app.ts";
const OUT: string = "dist/infra/cdk.out";

// One stack only, with CloudFormation's rollback on and never the "hotswap" path, so a failed
// deploy returns to the previous code (D8, G15).
export function deployArgs(stack: string): string[] {
    return [
        "deploy",
        stack,
        "--exclusively",
        "--app",
        APP,
        "--output",
        OUT,
        "--require-approval",
        "never",
        "--rollback",
        "--no-notices",
    ];
}

// The default bootstrap, as the lead chose (D1, R1).
export function bootstrapArgs(): string[] {
    return ["bootstrap", "--app", APP, "--output", OUT, "--no-notices"];
}

export function runCdk(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn("pnpm", ["exec", "cdk", ...args], { stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code: number | null) =>
            code === 0 ? resolve() : reject(new Error(`cdk ${args[0]} failed with exit code ${code}`)),
        );
    });
}
