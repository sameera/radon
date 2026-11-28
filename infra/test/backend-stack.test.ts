// Story #97: the backend stack (D1, D2, D4, D5). Synthesized locally, with no AWS credentials (G3).
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { BackendStack } from "../src/backend-stack.ts";
import { BACKEND_STACK, FUNCTION_NAME, TABLE_NAME } from "../src/names.ts";

function synth(): Template {
    const dir: string = mkdtempSync(join(tmpdir(), "raiden-infra-"));
    const codePath: string = join(dir, "lambda.zip");
    writeFileSync(codePath, "placeholder");
    const app: App = new App();
    return Template.fromStack(new BackendStack(app, BACKEND_STACK, { codePath }));
}

const template: Template = synth();

describe("backend stack", () => {
    it("keeps one on-demand table with the local key shape, retained and deletion-protected (D5, G13, G14)", () => {
        const local = JSON.parse(readFileSync("backend/local/table.json", "utf8"));
        template.resourceCountIs("AWS::DynamoDB::Table", 1);
        template.hasResource("AWS::DynamoDB::Table", {
            DeletionPolicy: "Retain",
            UpdateReplacePolicy: "Retain",
            Properties: {
                TableName: TABLE_NAME,
                BillingMode: local.BillingMode,
                KeySchema: local.KeySchema,
                AttributeDefinitions: local.AttributeDefinitions,
                DeletionProtectionEnabled: true,
            },
        });
        expect(TABLE_NAME).toBe(local.TableName);
    });

    it("runs the Go handler on arm64 with a fixed name and names the table (D4)", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            FunctionName: FUNCTION_NAME,
            Runtime: "provided.al2023",
            Handler: "bootstrap",
            Architectures: ["arm64"],
            Environment: { Variables: Match.objectLike({ RAIDEN_TABLE: TABLE_NAME }) },
        });
    });

    it("exposes a public function URL with no cross-origin policy of its own (D4, G5, G6)", () => {
        template.resourceCountIs("AWS::Lambda::Url", 1);
        template.hasResourceProperties("AWS::Lambda::Url", { AuthType: "NONE", Cors: Match.absent() });
    });

    it("gives the role only the table actions and its own logs (G12)", () => {
        template.hasResourceProperties("AWS::IAM::Role", { ManagedPolicyArns: Match.absent() });
        const policies = template.findResources("AWS::IAM::Policy");
        const statements = Object.values(policies).flatMap(
            (p: any) => p.Properties.PolicyDocument.Statement as any[],
        );
        const actions: string[] = statements.flatMap((s) => [s.Action].flat());
        const dynamo: string[] = actions.filter((a) => a.startsWith("dynamodb:")).sort();
        expect(dynamo).toEqual(["dynamodb:DeleteItem", "dynamodb:DescribeTable", "dynamodb:PutItem", "dynamodb:Query"]);
        for (const s of statements) {
            expect(JSON.stringify(s.Resource)).not.toContain('"*"');
        }
        const logs = statements.filter((s) => [s.Action].flat().some((a: string) => a.startsWith("logs:")));
        expect(logs.length).toBeGreaterThan(0);
        template.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: `/aws/lambda/${FUNCTION_NAME}` });
    });

    it("outputs the backend address and the function name (G4)", () => {
        template.hasOutput("BackendUrl", {});
        template.hasOutput("FunctionName", {});
    });

    it("defines only the backend's own resources (G1)", () => {
        const types: string[] = [...new Set(Object.values(template.toJSON().Resources).map((r: any) => r.Type))].sort();
        expect(types).toEqual([
            "AWS::DynamoDB::Table",
            "AWS::IAM::Policy",
            "AWS::IAM::Role",
            "AWS::Lambda::Function",
            "AWS::Lambda::Permission",
            "AWS::Lambda::Url",
            "AWS::Logs::LogGroup",
        ]);
    });
});
