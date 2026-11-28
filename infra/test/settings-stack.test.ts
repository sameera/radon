// Story #98: the two settings stores in the backend stack (D6, G7, G12).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { BackendStack } from "../src/backend-stack.ts";
import { BACKEND_STACK } from "../src/names.ts";

const dir: string = mkdtempSync(join(tmpdir(), "raiden-infra-"));
writeFileSync(join(dir, "lambda.zip"), "placeholder");
const template: Template = Template.fromStack(
    new BackendStack(new App(), BACKEND_STACK, { codePath: join(dir, "lambda.zip") }),
);

describe("settings stores", () => {
    it("creates exactly two stores with no value, which the stack never writes (D6)", () => {
        const secrets = template.findResources("AWS::SecretsManager::Secret");
        expect(Object.keys(secrets)).toHaveLength(2);
        for (const s of Object.values(secrets) as any[]) {
            expect(s.Properties.SecretString).toBeUndefined();
            expect(s.Properties.GenerateSecretString).toBeUndefined();
        }
        expect(JSON.stringify(template.toJSON())).not.toContain("SecretString");
    });

    it("names the stores, not their values, in the function's configuration (G7)", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    RAIDEN_CLIENT_SECRET_ID: Match.anyValue(),
                    RAIDEN_SIGNIN_SETTINGS_ID: Match.anyValue(),
                }),
            },
        });
        const fn = Object.values(template.findResources("AWS::Lambda::Function"))[0] as any;
        const names: string[] = Object.keys(fn.Properties.Environment.Variables);
        expect(names.some((n) => /GITHUB_CLIENT_SECRET|GITHUB_CLIENT_ID/.test(n))).toBe(false);
    });

    it("lets the role read only its two stores (G12)", () => {
        const statements = Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
            (p: any) => p.Properties.PolicyDocument.Statement as any[],
        );
        const reads = statements.filter((s) => [s.Action].flat().some((a: string) => a.startsWith("secretsmanager:")));
        expect(reads.flatMap((s) => [s.Action].flat())).toEqual(["secretsmanager:GetSecretValue"]);
        expect([reads[0].Resource].flat()).toHaveLength(2);
    });

    it("outputs the store identifiers the settings and web view commands need", () => {
        template.hasOutput("ClientSecretArn", {});
        template.hasOutput("SignInSettingsArn", {});
    });
});
