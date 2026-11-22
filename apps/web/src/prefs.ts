import type { PreferenceStore } from "@raiden/app";

const PREFIX: string = "raiden:";

// The web view's preferences live in the browser's local storage for its own address, under keys
// with a Raiden prefix. They are separate from the Raiden tab's choices. A storage error reads as
// "not set" and a failed write is dropped, so the page opens with defaults and still works.
export function webPreferences(storage?: Storage): PreferenceStore {
    const open = (): Storage | undefined => {
        try {
            return storage ?? globalThis.localStorage;
        } catch {
            return undefined;
        }
    };
    return {
        async get(key: string): Promise<unknown> {
            try {
                const raw: string | null | undefined = open()?.getItem(PREFIX + key);
                return raw == null ? undefined : JSON.parse(raw);
            } catch {
                return undefined;
            }
        },
        async set(key: string, value: unknown): Promise<void> {
            try {
                open()?.setItem(PREFIX + key, JSON.stringify(value));
            } catch {
                // Storage is full or blocked: the choice lasts until reload.
            }
        },
    };
}
