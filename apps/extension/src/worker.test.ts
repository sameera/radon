import { describe, expect, it, vi } from "vitest";
import { SIGNIN_KEY, createWorker, type WorkerDeps } from "./worker.ts";

const EXT_ID: string = "abcdefgh";
const REDIRECT: string = "https://abcdefgh.chromiumapp.org/";

function makeDeps(over: Partial<WorkerDeps> = {}): { deps: WorkerDeps; data: Map<string, unknown>; fetchFn: ReturnType<typeof vi.fn> } {
    const data: Map<string, unknown> = new Map();
    const fetchFn = vi.fn(async () => Response.json({ access_token: "at", expires_in: 100, refresh_token: "rt", login: "octo" }));
    const deps: WorkerDeps = {
        settings: { clientId: "Iv1.x", backendUrl: "https://api.team.example" },
        extensionId: EXT_ID,
        redirectUri: REDIRECT,
        // Plays GitHub: approves and returns to the extension's address with the same state.
        launch: async (url: string) => {
            const state: string = new URL(url).searchParams.get("state")!;
            return `${REDIRECT}?code=c1&state=${state}`;
        },
        storage: {
            get: async (key: string) => data.get(key),
            set: async (key: string, value: unknown) => void data.set(key, value),
        },
        fetch: fetchFn as unknown as typeof fetch,
        ...over,
    };
    return { deps, data, fetchFn };
}
const own = { id: EXT_ID };

describe("extension worker sign-in", () => {
    it("signs in, keeps the record in extension storage and tells the tab only the username (G3)", async () => {
        const { deps, data } = makeDeps();
        const worker = createWorker(deps);
        const answer = await worker.handle({ type: "raiden/sign-in" }, own);
        expect(answer).toEqual({ login: "octo" });
        expect(JSON.stringify(answer)).toBe('{"login":"octo"}');
        expect((data.get(SIGNIN_KEY) as { accessToken: string }).accessToken).toBe("at");
    });

    it("reports status as the stored username, and null when signed out (G14)", async () => {
        const { deps, data } = makeDeps();
        const worker = createWorker(deps);
        expect(await worker.handle({ type: "raiden/status" }, own)).toEqual({ login: null });
        data.set(SIGNIN_KEY, { accessToken: "at", login: "octo" });
        expect(await worker.handle({ type: "raiden/status" }, own)).toEqual({ login: "octo" });
    });

    it("stays signed out when the window is closed (G13)", async () => {
        const { deps, data, fetchFn } = makeDeps({ launch: async () => undefined });
        const answer = await createWorker(deps).handle({ type: "raiden/sign-in" }, own);
        expect(answer).toEqual({ login: null });
        expect(data.has(SIGNIN_KEY)).toBe(false);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("stays signed out when the launch throws, as when the user cancels", async () => {
        const { deps, data } = makeDeps({
            launch: async () => {
                throw new Error("The user did not approve access.");
            },
        });
        expect(await createWorker(deps).handle({ type: "raiden/sign-in" }, own)).toEqual({ login: null });
        expect(data.has(SIGNIN_KEY)).toBe(false);
    });

    it("stays signed out when consent is denied or the state does not match (G7)", async () => {
        for (const back of [`${REDIRECT}?error=access_denied`, `${REDIRECT}?code=c1&state=forged`]) {
            const { deps, data, fetchFn } = makeDeps({ launch: async () => back });
            expect(await createWorker(deps).handle({ type: "raiden/sign-in" }, own)).toEqual({ login: null });
            expect(data.has(SIGNIN_KEY)).toBe(false);
            expect(fetchFn).not.toHaveBeenCalled();
        }
    });

    it("stays signed out when the backend exchange fails", async () => {
        const { deps, data } = makeDeps({ fetch: (async () => Response.json({}, { status: 500 })) as unknown as typeof fetch });
        expect(await createWorker(deps).handle({ type: "raiden/sign-in" }, own)).toEqual({ login: null });
        expect(data.has(SIGNIN_KEY)).toBe(false);
    });

    it("uses a new state each attempt and forgets it afterwards (G7, G8)", async () => {
        const states: string[] = [];
        const { deps } = makeDeps({
            launch: async (url: string) => {
                states.push(new URL(url).searchParams.get("state")!);
                return undefined;
            },
        });
        const worker = createWorker(deps);
        await worker.handle({ type: "raiden/sign-in" }, own);
        await worker.handle({ type: "raiden/sign-in" }, own);
        expect(states[0]).not.toBe(states[1]);
        // A late return of the first attempt's state cannot finish a later attempt.
        const { deps: d2, data } = makeDeps({ launch: async () => `${REDIRECT}?code=c1&state=${states[0]}` });
        expect(await createWorker(d2).handle({ type: "raiden/sign-in" }, own)).toEqual({ login: null });
        expect(data.has(SIGNIN_KEY)).toBe(false);
    });

    it("refuses messages from other senders (G21)", async () => {
        const { deps, data } = makeDeps();
        const worker = createWorker(deps);
        expect(await worker.handle({ type: "raiden/sign-in" }, { id: "evil" })).toEqual({ error: "refused" });
        expect(await worker.handle({ type: "raiden/status" }, {})).toEqual({ error: "refused" });
        expect(data.size).toBe(0);
    });

    it("ignores messages it does not know", () => {
        const { deps } = makeDeps();
        expect(createWorker(deps).handle({ type: "other" }, own)).toBeNull();
        expect(createWorker(deps).handle("x", own)).toBeNull();
    });
});
