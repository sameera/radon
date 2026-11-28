// The settings command: gives the deployed backend its GitHub App settings from the terminal
// (D6, D7). AWS and the terminal are reached only through the injected dependencies.
import { BACKEND_STACK, WEB_STACK } from "./names.ts";
import { checkHealth, type Outputs } from "./setup.ts";

export interface SignInSettings {
    clientId: string;
    allowedRedirects: string[];
    allowedOrigins: string[];
}

export interface SettingsDeps {
    outputs(stack: string): Promise<Outputs | null>;
    // Returns the answer, or the suggestion when the answer is blank.
    ask(question: string, suggested?: string): Promise<string>;
    // A hidden prompt, or a line of standard input when it is not a terminal (G8).
    askSecret(question: string): Promise<string>;
    putSecret(id: string, value: string): Promise<void>;
    // Sets a configuration value that holds no secret, so Lambda starts fresh instances that read
    // the stores again, and waits until the update finishes (D7).
    recycle(functionName: string, version: string): Promise<void>;
    health(url: string): Promise<boolean>;
    now(): string;
    log(line: string): void;
}

// The command takes no arguments at all, so the client secret can never be one (G8).
export function assertNoArguments(argv: string[]): void {
    if (argv.length > 0) {
        throw new Error("the settings command takes no arguments; it asks for each value, and reads the secret from a hidden prompt");
    }
}

export function suggestAddresses(
    webViewUrl: string | null,
    extensionId: string | null,
): Pick<SignInSettings, "allowedRedirects" | "allowedOrigins"> {
    const allowedRedirects: string[] = [];
    const allowedOrigins: string[] = [];
    if (webViewUrl) {
        allowedRedirects.push(new URL(webViewUrl).toString());
        allowedOrigins.push(new URL(webViewUrl).origin);
    }
    if (extensionId) {
        allowedRedirects.push(`https://${extensionId}.chromiumapp.org/`);
        allowedOrigins.push(`chrome-extension://${extensionId}`);
    }
    return { allowedRedirects, allowedOrigins };
}

function list(s: string): string[] {
    return s
        .split(",")
        .map((p: string) => p.trim())
        .filter((p: string) => p !== "");
}

export async function runSettings(deps: SettingsDeps): Promise<void> {
    const backend: Outputs | null = await deps.outputs(BACKEND_STACK);
    if (!backend?.ClientSecretArn || !backend.SignInSettingsArn || !backend.FunctionName || !backend.BackendUrl) {
        throw new Error("the backend is not deployed; run pnpm aws:setup first");
    }
    const web: Outputs | null = await deps.outputs(WEB_STACK);
    const webViewUrl: string | null = web?.WebViewUrl ?? null;

    const clientId: string = (await deps.ask("GitHub App client ID")).trim();
    if (!clientId) {
        throw new Error("a client ID is required");
    }
    const extensionId: string = (await deps.ask("Chrome extension ID (blank if none)")).trim();
    const clientSecret: string = (await deps.askSecret("GitHub App client secret (hidden)")).trim();
    if (!clientSecret) {
        throw new Error("a client secret is required");
    }
    const suggested = suggestAddresses(webViewUrl, extensionId);
    const allowedRedirects: string[] = list(
        await deps.ask("Allowed return addresses, comma-separated", suggested.allowedRedirects.join(",")),
    );
    const allowedOrigins: string[] = list(
        await deps.ask("Allowed origins, comma-separated", suggested.allowedOrigins.join(",")),
    );

    const settings: SignInSettings = { clientId, allowedRedirects, allowedOrigins };
    await deps.putSecret(backend.ClientSecretArn, clientSecret);
    await deps.putSecret(backend.SignInSettingsArn, JSON.stringify(settings));
    deps.log("Settings stored. Restarting the backend so it reads them.");
    await deps.recycle(backend.FunctionName, deps.now());
    await checkHealth(deps, backend.BackendUrl);
    deps.log(`Client ID: ${clientId}`);
    deps.log(`Allowed return addresses: ${allowedRedirects.join(", ") || "(none)"}`);
    deps.log(`Allowed origins: ${allowedOrigins.join(", ") || "(none)"}`);
    deps.log("The backend now uses these settings.");
}
