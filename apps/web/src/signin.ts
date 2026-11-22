// The web view's own sign-in. It keeps the pending attempt in this tab's session storage and the
// sign-in record in the web view's local storage. Tokens never enter the DOM, the address or
// history (G4).
import type { SignInPort } from "@raiden/app";
import {
    checkReturn,
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

export interface WebSignInDeps {
    settings: TeamSettings;
    // The web view's registered return address.
    returnUrl: string;
    win: { location: { href: string; assign(url: string): void }; history: { replaceState(state: unknown, title: string, url: string): void } };
    local: Storage;
    session: Storage;
    fetch: typeof fetch;
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
        return { notice: false };
    } catch {
        return { notice: true };
    }
}

export function webSignInPort(deps: WebSignInDeps): SignInPort {
    return {
        async status(): Promise<string | null> {
            return (await webRecordStore(deps.local).get())?.login ?? null;
        },
        async signIn(): Promise<{ login: string } | null> {
            const { url, pending } = await startAttempt(deps.settings, deps.returnUrl);
            deps.session.setItem(PENDING_KEY, JSON.stringify(pending));
            deps.win.location.assign(url);
            // The page leaves for GitHub, so this never settles.
            return new Promise<never>(() => undefined);
        },
    };
}
