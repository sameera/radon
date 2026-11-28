// The web view build takes its three settings from the deployment itself (D9).

// Reads one secret store; null when the store has no value yet.
export type ReadSecret = (id: string) => Promise<string | null>;

// The client ID comes from the sign-in settings store. The client secret store is never read,
// so the web build cannot leak the secret (G9).
export async function readClientId(read: ReadSecret, backend: Record<string, string>): Promise<string | null> {
    const store: string | undefined = backend.SignInSettingsArn;
    if (!store) {
        return null;
    }
    const raw: string | null = await read(store);
    if (!raw) {
        return null;
    }
    const id: unknown = (JSON.parse(raw) as { clientId?: unknown }).clientId;
    return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

// Exactly the three values the existing web view build reads. They are passed in the build's
// environment, so they win over any local settings file. No client ID, no build (G20).
export function webBuildEnv(backendUrl: string, webViewUrl: string, clientId: string | null): Record<string, string> {
    if (!clientId) {
        throw new Error("no client ID is set; run pnpm aws:settings first");
    }
    return {
        RAIDEN_BACKEND_URL: backendUrl,
        RAIDEN_WEB_RETURN_URL: webViewUrl,
        RAIDEN_GITHUB_CLIENT_ID: clientId,
    };
}
