// The web view's own sign-in. It keeps the pending attempt in this tab's session storage and the
// sign-in record in the web view's local storage. Tokens never enter the DOM, the address or
// history (G4).
import type { SignInPort } from "@raiden/app";
import {
    checkReturn,
    createGitHubClient,
    type GitHubClient,
    exchangeCode,
    removeReturnParams,
    startAttempt,
    type PendingAttempt,
    type RecordStore,
    type SignInRecord,
    type TeamSettings,
} from "@raiden/shared";

export const RECORD_KEY: string = "raiden:signin";
export const PENDING_KEY: string = "raiden:signin-pending";
// Set in this tab's session storage by Sign out. It holds no secret, only the mark "1" (G21).
export const SIGNED_OUT_KEY: string = "raiden:signed-out";
const REFRESH_LOCK: string = "raiden:signin-refresh";
// The picker's two stored values and the preference prefix, as the shared prefs write them.
const PERSONAL_KEYS: string[] = ["raiden:repository", "raiden:repositories"];

interface LockManagerLike {
    request<T>(name: string, run: () => Promise<T>): Promise<T>;
}

export interface WebSignInDeps {
    settings: TeamSettings;
    // The web view's registered return address.
    returnUrl: string;
    win: { location: { href: string; assign(url: string): void }; history: { replaceState(state: unknown, title: string, url: string): void } };
    local: Storage;
    session: Storage;
    fetch: typeof fetch;
    // The browser's lock manager. Sign out takes the same lock as a token renewal. Null means none.
    locks?: LockManagerLike | null;
}

function safely<T>(run: () => T, fallback: T): T {
    try {
        return run();
    } catch {
        return fallback;
    }
}

export function webRecordStore(local: Storage): RecordStore {
    return {
        async get(): Promise<SignInRecord | null> {
            return safely(() => {
                const raw: string | null = local.getItem(RECORD_KEY);
                const record: SignInRecord | null = raw ? (JSON.parse(raw) as SignInRecord) : null;
                return record && typeof record.accessToken === "string" && typeof record.login === "string" ? record : null;
            }, null);
        },
        async set(record: SignInRecord | null): Promise<void> {
            safely(() => (record ? local.setItem(RECORD_KEY, JSON.stringify(record)) : local.removeItem(RECORD_KEY)), undefined);
        },
    };
}

function takePending(session: Storage): PendingAttempt | null {
    return safely(() => {
        const raw: string | null = session.getItem(PENDING_KEY);
        // Used once: it is gone whether the attempt succeeds or fails (G8).
        session.removeItem(PENDING_KEY);
        return raw ? (JSON.parse(raw) as PendingAttempt) : null;
    }, null);
}

function isReturn(href: string): boolean {
    const params: URLSearchParams = new URL(href).searchParams;
    return params.has("code") || params.has("state") || params.has("error");
}

// Runs before the shell mounts. It finishes a sign-in return, if this load is one.
// `notice` is true when the user came back from an attempt that did not finish.
export async function finishReturn(deps: WebSignInDeps): Promise<{ notice: boolean }> {
    const href: string = deps.win.location.href;
    if (!safely(() => isReturn(href), false)) {
        return { notice: false };
    }
    // The code and state leave the address and history entry before anything else runs (G9).
    deps.win.history.replaceState(null, "", removeReturnParams(href));
    const pending: PendingAttempt | null = takePending(deps.session);
    const checked = checkReturn(href, pending);
    if (!checked.ok || !pending) {
        return { notice: true };
    }
    try {
        const record: SignInRecord = await exchangeCode(deps.settings, deps.fetch, checked.code, pending);
        await webRecordStore(deps.local).set(record);
        safely(() => deps.session.removeItem(SIGNED_OUT_KEY), undefined);
        return { notice: false };
    } catch {
        return { notice: true };
    }
}

// True while the marker from a Sign out is present in this tab.
export function wasSignedOut(session: Storage): boolean {
    return safely(() => session.getItem(SIGNED_OUT_KEY) !== null, false);
}

// Ends the web view's sign-in on this host only. It sends no request. It waits for any renewal
// under way, removes the sign-in record first, then the picker's values, then marks the tab and
// reloads at the web view's own address so nothing in memory survives (D5, D6, D7).
async function signOut(deps: WebSignInDeps): Promise<void> {
    const locks: LockManagerLike | null | undefined =
        deps.locks === undefined ? (globalThis.navigator?.locks as LockManagerLike | undefined) : deps.locks;
    const clear = async (): Promise<void> => {
        await webRecordStore(deps.local).set(null);
        safely(() => deps.session.removeItem(PENDING_KEY), undefined);
        for (const key of PERSONAL_KEYS) {
            safely(() => deps.local.removeItem(key), undefined);
        }
        safely(() => deps.session.setItem(SIGNED_OUT_KEY, "1"), undefined);
    };
    try {
        await (locks ? locks.request(REFRESH_LOCK, clear) : clear());
    } finally {
        deps.win.location.assign(deps.returnUrl);
    }
}

export function webSignInPort(
    deps: WebSignInDeps,
    client: Pick<GitHubClient, "status"> = createGitHubClient({
        settings: deps.settings, records: webRecordStore(deps.local), fetch: deps.fetch,
    }),
): SignInPort {
    return {
        status: () => client.status(),
        signOut: () => signOut(deps),
        async signIn(): Promise<{ login: string } | null> {
            const { url, pending } = await startAttempt(deps.settings, deps.returnUrl, {
                chooser: wasSignedOut(deps.session),
            });
            deps.session.setItem(PENDING_KEY, JSON.stringify(pending));
            deps.win.location.assign(url);
            // The page leaves for GitHub, so this never settles.
            return new Promise<never>(() => undefined);
        },
    };
}
