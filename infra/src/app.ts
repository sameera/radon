// The AWS CDK app. Run from the repo root by the deploy commands: `cdk --app "node infra/src/app.ts"`.
// Every Raiden AWS resource is defined here (G1); AWS CDK's bootstrap resources are its own.
import { existsSync } from "node:fs";
import { App } from "aws-cdk-lib";
import { BackendStack } from "./backend-stack.ts";
import { BACKEND_STACK, LAMBDA_ZIP, WEB_STACK } from "./names.ts";
import { WebStack } from "./web-stack.ts";

const app: App = new App();
// The web view update deploys only the web stack and builds no backend, so the backend stack
// is defined only when its zip exists. CDK deploys exactly the stack it is asked for.
if (existsSync(LAMBDA_ZIP)) {
    new BackendStack(app, BACKEND_STACK, { codePath: LAMBDA_ZIP });
} else if (process.env.RAIDEN_DEPLOY_STACK !== WEB_STACK) {
    throw new Error(`${LAMBDA_ZIP} is missing; run "nx run backend:build" first`);
}
new WebStack(app, WEB_STACK);
app.synth();
