// The setup command: one idempotent path that bootstraps AWS CDK if needed, deploys the stacks,
// checks the backend and prints the addresses (D1, D2, D13). AWS is reached only through the
// injected dependencies, so the order and the failures are tested without credentials.
import { BACKEND_STACK } from "./names.ts";

export type Outputs = Record<string, string>;

export interface SetupDeps {
    bootstrapExists(): Promise<boolean>;
    bootstrap(): Promise<void>;
    deploy(stack: string): Promise<void>;
    outputs(stack: string): Promise<Outputs | null>;
    health(url: string): Promise<boolean>;
    log(line: string): void;
}

export interface SetupResult {
    backendUrl: string;
    webViewUrl: string | null;
}

export async function deployBackend(deps: SetupDeps): Promise<string> {
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
    const webViewUrl: string | null = null;
    deps.log("");
    deps.log(`Backend address: ${backendUrl}`);
    deps.log(`Web view address: ${webViewUrl ?? "(not hosted yet)"}`);
    return { backendUrl, webViewUrl };
}
