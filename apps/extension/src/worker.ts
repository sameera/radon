// The background worker's logic. It owns the sign-in record: tokens exist here and in the
// extension's storage and are never sent to a tab (G3). Tabs learn only the username.
import {
    SignInError,
    checkReturn,
    exchangeCode,
    startAttempt,
    type SignInRecord,
    type TeamSettings,
} from "@raiden/shared";

export const SIGNIN_KEY: string = "raiden.signin";

export interface WorkerDeps {
    settings: TeamSettings;
    extensionId: string;
    // The extension's own return address, for example https://<id>.chromiumapp.org/.
    redirectUri: string;
    // Opens the browser's sign-in window. Resolves to the return address, or nothing if it closed.
    launch(url: string): Promise<string | undefined>;
    storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> };
    fetch: typeof fetch;
}

export interface Worker {
    // Returns null for a message that is not Raiden's, so another listener may answer.
    handle(message: unknown, sender: { id?: string }): Promise<unknown> | null;
}

export function createWorker(deps: WorkerDeps): Worker {
    let inFlight: Promise<{ login: string | null }> | null = null;

    async function readLogin(): Promise<string | null> {
        const record: SignInRecord | undefined = (await deps.storage.get(SIGNIN_KEY)) as SignInRecord | undefined;
        return typeof record?.login === "string" ? record.login : null;
    }

    async function signIn(): Promise<{ login: string | null }> {
        // The pending attempt lives in this closure only and is dropped when the attempt ends (G8).
        try {
            const { url, pending } = await startAttempt(deps.settings, deps.redirectUri);
            const returned: string | undefined = await deps.launch(url);
            const checked = checkReturn(returned, pending);
            if (!checked.ok) {
                return { login: null };
            }
            const record: SignInRecord = await exchangeCode(deps.settings, deps.fetch, checked.code, pending);
            await deps.storage.set(SIGNIN_KEY, record);
            return { login: record.login };
        } catch (e: unknown) {
            // A closed window or a refusal throws. Either way the user stays signed out.
            if (!(e instanceof SignInError) && !(e instanceof Error)) {
                throw e;
            }
            return { login: null };
        }
    }

    return {
        handle(message: unknown, sender: { id?: string }): Promise<unknown> | null {
            const type: unknown = typeof message === "object" && message !== null ? (message as { type?: unknown }).type : undefined;
            if (type !== "raiden/status" && type !== "raiden/sign-in") {
                return null;
            }
            if (sender.id !== deps.extensionId) {
                return Promise.resolve({ error: "refused" });
            }
            if (type === "raiden/status") {
                return readLogin().then((login: string | null) => ({ login }));
            }
            inFlight ??= signIn().finally(() => {
                inFlight = null;
            });
            return inFlight;
        },
    };
}
