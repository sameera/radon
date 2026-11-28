// Story #102: the deployment guide (D14, G26, R1, R2).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guide: string = readFileSync("docs/setup/deploy-aws.md", "utf8");
const appSetup: string = readFileSync("docs/setup/github-app.md", "utf8");
const scripts: Record<string, string> = JSON.parse(readFileSync("package.json", "utf8")).scripts;

function section(heading: RegExp): string {
    const lines: string[] = guide.split("\n");
    const start: number = lines.findIndex((l) => /^#+ /.test(l) && heading.test(l));
    expect(start, `section ${heading}`).toBeGreaterThanOrEqual(0);
    const level: number = lines[start]!.indexOf(" ");
    const rest: string[] = lines.slice(start + 1);
    const end: number = rest.findIndex((l) => /^#+ /.test(l) && l.indexOf(" ") <= level);
    return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

describe("deployment guide", () => {
    it("names only commands that exist", () => {
        const named: string[] = [...guide.matchAll(/pnpm (aws:[a-z-]+)/g)].map((m) => m[1]!);
        expect(new Set(named)).toEqual(new Set(["aws:setup", "aws:settings", "aws:update-backend", "aws:update-web"]));
        for (const n of named) {
            expect(scripts[n], n).toBeDefined();
        }
    });

    it("gives the first-run order: setup, register the callback, settings, web view upload", () => {
        const first: string = section(/first/i);
        const order: number[] = [
            first.indexOf("pnpm aws:setup"),
            first.search(/callback URL/i),
            first.indexOf("pnpm aws:settings"),
            first.lastIndexOf("pnpm aws:setup"),
        ];
        expect(order.every((i) => i >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(order[3]).toBeGreaterThan(order[2]!);
    });

    it("covers the settings change and both update deploys", () => {
        expect(section(/settings/i)).toContain("pnpm aws:settings");
        expect(section(/update the backend/i)).toContain("pnpm aws:update-backend");
        expect(section(/update the web view/i)).toContain("pnpm aws:update-web");
    });

    it("gives the recovery for new backend code that fails its health check (R2)", () => {
        expect(section(/update the backend/i)).toMatch(/previous commit/i);
    });

    it("names the AWS permissions for each phase (D14)", () => {
        const perms: string = section(/permissions/i);
        expect(perms).toMatch(/bootstrap/i);
        for (const action of [
            "cloudformation:DescribeStacks",
            "sts:AssumeRole",
            "secretsmanager:PutSecretValue",
            "secretsmanager:GetSecretValue",
            "lambda:GetFunctionConfiguration",
            "lambda:UpdateFunctionConfiguration",
            "s3:ListBucket",
            "s3:PutObject",
            "s3:DeleteObject",
            "cloudfront:CreateInvalidation",
            "cloudfront:GetInvalidation",
        ]) {
            expect(perms, action).toContain(action);
        }
    });

    it("names every right the commands' waiters and checks call, and the secrets with their ARN suffix (#102 AC3)", () => {
        const perms: string = section(/permissions/i);
        expect(perms).toContain("`lambda:GetFunction`");
        expect(perms).toContain("`cloudfront:ListInvalidations`");
        expect(perms).toContain("`raiden/github-client-secret-*`");
        expect(perms).toContain("`raiden/signin-settings-*`");
        expect(perms).not.toMatch(/`raiden\/(github-client-secret|signin-settings)`/);
    });

    it("names the bootstrap resources and their administrator rights (R1)", () => {
        const boot: string = section(/bootstrap/i);
        expect(boot).toContain("CDKToolkit");
        expect(boot).toMatch(/staging bucket/i);
        expect(boot).toMatch(/AdministratorAccess/);
    });

    it("names what a lead needs on the machine", () => {
        for (const tool of ["Node", "pnpm", "Go"]) {
            expect(guide).toContain(tool);
        }
    });

    it("is linked from the GitHub App setup page, whose settings section points to the settings command", () => {
        expect(appSetup).toContain("deploy-aws.md");
        const start: number = appSetup.indexOf("## Give the backend its settings");
        const end: number = appSetup.indexOf("\n## ", start + 1);
        expect(appSetup.slice(start, end)).toContain("pnpm aws:settings");
    });
});
