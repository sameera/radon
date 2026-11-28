// The backend stack: the Raiden table, the backend function, its function URL, its role, its
// log group and its two settings stores (D2, D4, D5, D6).
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Architecture, Code, Function as LambdaFunction, FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { CfnSecret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { CLIENT_SECRET_NAME, FUNCTION_NAME, SIGNIN_SETTINGS_NAME, TABLE_NAME } from "./names.ts";

export interface BackendStackProps extends StackProps {
    // The backend zip. The build is repeatable, so an unchanged checkout gives the same asset
    // hash and the deploy uploads nothing (D8, G2).
    codePath: string;
}

export class BackendStack extends Stack {
    constructor(scope: Construct, id: string, props: BackendStackProps) {
        super(scope, id, props);

        // Same key shape as backend/local/table.json (G14). Kept through stack deletion and
        // protected from deletion, so stored data survives every update (D5, G13).
        const table: Table = new Table(this, "Table", {
            tableName: TABLE_NAME,
            partitionKey: { name: "pk", type: AttributeType.STRING },
            sortKey: { name: "sk", type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            deletionProtection: true,
            removalPolicy: RemovalPolicy.RETAIN,
        });

        const logs: LogGroup = new LogGroup(this, "Logs", {
            logGroupName: `/aws/lambda/${FUNCTION_NAME}`,
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.RETAIN,
        });

        // Two stores created with no value. The stack never writes one, so a later stack change can
        // never reset what the settings command wrote, and the secret is in no template (D6, G7).
        // The client secret has a store of its own, so the web view update can read the client ID
        // without ever reading the secret (G9).
        const clientSecret: CfnSecret = new CfnSecret(this, "ClientSecret", {
            name: CLIENT_SECRET_NAME,
            description: "Raiden: the GitHub App's client secret. Written by pnpm aws:settings.",
        });
        const signInSettings: CfnSecret = new CfnSecret(this, "SignInSettings", {
            name: SIGNIN_SETTINGS_NAME,
            description:
                "Raiden: the GitHub App's client ID, allowed return addresses and allowed origins. Written by pnpm aws:settings.",
        });

        // No managed policy: the role may use only its table, its two stores and its own logs (G12).
        const role: Role = new Role(this, "Role", {
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        });
        role.addToPolicy(
            new PolicyStatement({
                actions: ["dynamodb:DescribeTable", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:DeleteItem"],
                resources: [table.tableArn],
            }),
        );
        role.addToPolicy(
            new PolicyStatement({
                actions: ["secretsmanager:GetSecretValue"],
                resources: [clientSecret.ref, signInSettings.ref],
            }),
        );
        role.addToPolicy(
            new PolicyStatement({
                actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
                resources: [logs.logGroupArn],
            }),
        );

        const fn: LambdaFunction = new LambdaFunction(this, "Function", {
            functionName: FUNCTION_NAME,
            runtime: Runtime.PROVIDED_AL2023,
            architecture: Architecture.ARM_64,
            handler: "bootstrap",
            code: Code.fromAsset(props.codePath),
            role,
            logGroup: logs,
            memorySize: 256,
            timeout: Duration.seconds(30),
            // Store identifiers only; the backend reads the values at start (D6).
            environment: {
                RAIDEN_TABLE: TABLE_NAME,
                RAIDEN_CLIENT_SECRET_ID: clientSecret.ref,
                RAIDEN_SIGNIN_SETTINGS_ID: signInSettings.ref,
            },
        });

        // The backend answers preflights and origin checks itself, so the URL adds no
        // cross-origin policy of its own (D4, G6).
        const url = fn.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });

        new CfnOutput(this, "BackendUrl", { value: url.url });
        new CfnOutput(this, "FunctionName", { value: fn.functionName });
        new CfnOutput(this, "ClientSecretArn", { value: clientSecret.ref });
        new CfnOutput(this, "SignInSettingsArn", { value: signInSettings.ref });
    }
}
