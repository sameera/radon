// The background worker's logic. It owns the sign-in record: tokens exist here and in the
// extension's storage and are never sent to a tab (G3). Tabs learn only the username.
import {
    SignInError,
    createGitHubClient,
    type GitHubClient,
    type GitHubRequest,
    type GitHubResult,
    type RecordStore,
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

const OTHER_FAILURE: GitHubResult = { ok: false, kind: "other" };

function shapedRequest(value: unknown): GitHubRequest | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const r = value as { path?: unknown; method?: unknown; query?: unknown; to?: unknown };
    if (r.to !== undefined && r.to !== "github" && r.to !== "backend") {
        return null;
    }
    const queryOk: boolean =
        r.query === undefined ||
        (typeof r.query === "object" && r.query !== null && Object.values(r.query).every((v: unknown) => typeof v === "string"));
    if (typeof r.path !== "string" || !queryOk || (r.method !== undefined && r.method !== "GET" && r.method !== "POST")) {
        return null;
    }
    return value as GitHubRequest;
}

export function createWorker(deps: WorkerDeps): Worker {
    const records: RecordStore = {
        async get(): Promise<SignInRecord | null> {
            const r = (await deps.storage.get(SIGNIN_KEY)) as SignInRecord | null | undefined;
            return r && typeof r.accessToken === "string" && typeof r.login === "string" ? r : null;
        },
        set: (record: SignInRecord | null): Promise<void> => deps.storage.set(SIGNIN_KEY, record),
    };
    // The one shared GitHub client runs here, so the token never reaches a tab (D6, G3).
    const client: GitHubClient = createGitHubClient({ settings: deps.settings, records, fetch: deps.fetch });
    let inFlight: Promise<{ login: string | null }> | null = null;

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
            if (type !== "raiden/status" && type !== "raiden/sign-in" && type !== "raiden/github") {
                return null;
            }
            if (sender.id !== deps.extensionId) {
                return Promise.resolve({ error: "refused" });
            }
            if (type === "raiden/github") {
                const request: GitHubRequest | null = shapedRequest((message as { request?: unknown }).request);
                return request ? client.request(request) : Promise.resolve(OTHER_FAILURE);
            }
            if (type === "raiden/status") {
                return client.status().then(
                    (login) => ({ login }),
                    () => ({ unavailable: true }),
                );
            }
            inFlight ??= signIn().finally(() => {
                inFlight = null;
            });
            return inFlight;
        },
    };
}
