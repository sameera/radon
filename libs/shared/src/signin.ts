// The sign-in core: host-agnostic code shared by the extension and the web view. It builds the
// GitHub authorize address, makes the state and verifier, checks the returned state and calls the
// team backend's exchange. It holds no token storage of its own: a host supplies a record store.

// Per-team values fixed when each host is built (D10).
export interface TeamSettings {
    clientId: string;
    backendUrl: string;
}

// What a host keeps after sign-in.
export interface SignInRecord {
    accessToken: string;
    // Epoch milliseconds. Absent when the App issues non-expiring tokens.
    expiresAt?: number;
    refreshToken?: string;
    login: string;
}

export interface RecordStore {
    get(): Promise<SignInRecord | null>;
    set(record: SignInRecord | null): Promise<void>;
}

// The state, verifier and return address of one sign-in that has not finished.
export interface PendingAttempt {
    state: string;
    verifier: string;
    redirectUri: string;
}

export type ReturnResult = { ok: true; code: string } | { ok: false };

// Carries only a fixed message. It never holds a code, verifier or token (G5).
export class SignInError extends Error {}

const AUTHORIZE_URL: string = "https://github.com/login/oauth/authorize";
const RETURN_PARAMS: string[] = ["code", "state", "error", "error_description"];

function base64url(bytes: Uint8Array): string {
    let binary: string = "";
    for (const b of bytes) {
        binary += String.fromCharCode(b);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes: number): string {
    return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

// Makes a new attempt. No scope is asked: a GitHub App's read-only access comes from its
// registration, not from the sign-in request (G11).
export async function startAttempt(
    settings: TeamSettings,
    redirectUri: string,
): Promise<{ url: string; pending: PendingAttempt }> {
    const pending: PendingAttempt = { state: randomToken(32), verifier: randomToken(48), redirectUri };
    const digest: ArrayBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pending.verifier));
    const url: URL = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", settings.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", pending.state);
    url.searchParams.set("code_challenge", base64url(new Uint8Array(digest)));
    url.searchParams.set("code_challenge_method", "S256");
    return { url: url.toString(), pending };
}

// Reads the address GitHub returned to. Any doubt leaves the user signed out (G7).
export function checkReturn(returnUrl: string | undefined, pending: PendingAttempt | null): ReturnResult {
    if (!returnUrl || !pending) {
        return { ok: false };
    }
    let params: URLSearchParams;
    try {
        params = new URL(returnUrl).searchParams;
    } catch {
        return { ok: false };
    }
    const code: string | null = params.get("code");
    if (params.has("error") || !code || params.get("state") !== pending.state) {
        return { ok: false };
    }
    return { ok: true, code };
}

// The address without the sign-in return parameters, for history.replaceState (G9).
export function removeReturnParams(address: string): string {
    const url: URL = new URL(address);
    for (const name of RETURN_PARAMS) {
        url.searchParams.delete(name);
    }
    return url.toString();
}

interface TokenAnswer {
    access_token?: unknown;
    expires_in?: unknown;
    refresh_token?: unknown;
    login?: unknown;
}

export async function backendPost(
    settings: TeamSettings,
    fetchFn: typeof fetch,
    path: string,
    body: unknown,
): Promise<TokenAnswer> {
    let res: Response;
    try {
        res = await fetchFn(`${settings.backendUrl.replace(/\/+$/, "")}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch {
        throw new SignInError("The sign-in server could not be reached");
    }
    if (!res.ok) {
        throw new SignInError(`The sign-in server refused the request (${res.status})`);
    }
    try {
        return (await res.json()) as TokenAnswer;
    } catch {
        throw new SignInError("The sign-in server sent an answer that could not be read");
    }
}

// Sends the code and verifier to the backend exchange and turns the answer into a record.
export async function exchangeCode(
    settings: TeamSettings,
    fetchFn: typeof fetch,
    code: string,
    pending: PendingAttempt,
    now: () => number = Date.now,
): Promise<SignInRecord> {
    const answer: TokenAnswer = await backendPost(settings, fetchFn, "/auth/exchange", {
        code,
        verifier: pending.verifier,
        redirect_uri: pending.redirectUri,
    });
    if (typeof answer.access_token !== "string" || typeof answer.login !== "string") {
        throw new SignInError("The sign-in server's answer was incomplete");
    }
    const record: SignInRecord = { accessToken: answer.access_token, login: answer.login };
    if (typeof answer.expires_in === "number") {
        record.expiresAt = now() + answer.expires_in * 1000;
    }
    if (typeof answer.refresh_token === "string") {
        record.refreshToken = answer.refresh_token;
    }
    // Keep the key order stable for equality checks: accessToken, expiresAt, refreshToken, login.
    return {
        accessToken: record.accessToken,
        ...(record.expiresAt !== undefined ? { expiresAt: record.expiresAt } : {}),
        ...(record.refreshToken !== undefined ? { refreshToken: record.refreshToken } : {}),
        login: record.login,
    };
}

// Asks the backend to renew a sign-in. The refresh token goes only to the backend (G6). The
// username is kept from the old record.
export async function refreshTokens(
    settings: TeamSettings,
    fetchFn: typeof fetch,
    record: SignInRecord,
    now: () => number = Date.now,
): Promise<SignInRecord> {
    if (!record.refreshToken) {
        throw new SignInError("There is no refresh token to renew with");
    }
    const answer: TokenAnswer = await backendPost(settings, fetchFn, "/auth/refresh", { refresh_token: record.refreshToken });
    if (typeof answer.access_token !== "string") {
        throw new SignInError("The sign-in server's answer was incomplete");
    }
    return {
        accessToken: answer.access_token,
        ...(typeof answer.expires_in === "number" ? { expiresAt: now() + answer.expires_in * 1000 } : {}),
        ...(typeof answer.refresh_token === "string" ? { refreshToken: answer.refresh_token } : {}),
        login: record.login,
    };
}
