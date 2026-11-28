// The AWS CDK app. Run from the repo root by the deploy commands: `cdk --app "node infra/src/app.ts"`.
// Every Raiden AWS resource is defined here (G1); AWS CDK's bootstrap resources are its own.
import { existsSync } from "node:fs";
import { App } from "aws-cdk-lib";
import { BackendStack } from "./backend-stack.ts";
import { BACKEND_STACK, LAMBDA_ZIP } from "./names.ts";

if (!existsSync(LAMBDA_ZIP)) {
    throw new Error(`${LAMBDA_ZIP} is missing; run "nx run backend:build" first`);
}

const app: App = new App();
new BackendStack(app, BACKEND_STACK, { codePath: LAMBDA_ZIP });
app.synth();
