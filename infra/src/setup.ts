// The setup command: one idempotent path that bootstraps AWS CDK if needed, deploys the backend
// stack and the web hosting stack, checks the backend, uploads the web view once settings exist,
// and prints both addresses (D1, D2, D13). AWS is reached only through the injected
// dependencies, so the order and the failures are tested without credentials.
import { BACKEND_STACK } from "./names.ts";
import { deployWebStack, uploadWebView, type WebDeps } from "./update-web.ts";
import { readClientId } from "./web-build.ts";

export type Outputs = Record<string, string>;

export interface SetupDeps extends WebDeps {
    bootstrapExists(): Promise<boolean>;
    bootstrap(): Promise<void>;
    health(url: string): Promise<boolean>;
}

export interface SetupResult {
    backendUrl: string;
    webViewUrl: string | null;
}

export async function deployBackend(deps: Pick<SetupDeps, "deploy" | "outputs" | "health">): Promise<string> {
    await deps.deploy(BACKEND_STACK);
    const out: Outputs | null = await deps.outputs(BACKEND_STACK);
    const backendUrl: string | undefined = out?.BackendUrl;
    if (!backendUrl) {
        throw new Error(`stack ${BACKEND_STACK} has no BackendUrl output`);
    }
    await checkHealth(deps, backendUrl);
    return backendUrl;
}

export async function checkHealth(deps: Pick<SetupDeps, "health">, backendUrl: string): Promise<void> {
    if (!(await deps.health(backendUrl))) {
        throw new Error(`the backend at ${backendUrl} did not answer the health request with ok`);
    }
}

export async function runSetup(deps: SetupDeps): Promise<SetupResult> {
    if (!(await deps.bootstrapExists())) {
        deps.log("No AWS CDK bootstrap in this account and region; running the default bootstrap.");
        await deps.bootstrap();
    }
    const backendUrl: string = await deployBackend(deps);
    const backend: Outputs = (await deps.outputs(BACKEND_STACK)) ?? {};
    const web: Outputs = await deployWebStack(deps);
    const webViewUrl: string = web.WebViewUrl!;
    const hasSettings: boolean = (await readClientId(deps.readSecret, backend)) !== null;
    if (hasSettings) {
        await uploadWebView(deps, backend, web);
    }
    deps.log("");
    deps.log(`Backend address: ${backendUrl}`);
    deps.log(`Web view address: ${webViewUrl}`);
    if (!hasSettings) {
        deps.log("");
        deps.log("The web view is not uploaded yet: the backend has no settings.");
        deps.log("Register the web view address as a callback URL in the GitHub App, then run pnpm aws:settings,");
        deps.log("then pnpm aws:setup again to build and upload the web view.");
    }
    return { backendUrl, webViewUrl };
}
