import { useEffect, useState } from "preact/hooks";
import { initialState, type SessionState } from "./plan.ts";

export interface SessionStore {
    get(): SessionState;
    update(change: (state: SessionState) => SessionState): void;
    // The one entry point for plan changes. Drops, menus, buttons and goal fields all use it.
    change(change: (state: SessionState) => SessionState): void;
    subscribe(listener: () => void): () => void;
}

export function createSessionStore(initial: SessionState = initialState()): SessionStore {
    let state: SessionState = initial;
    const listeners: Set<() => void> = new Set();
    return {
        get: () => state,
        update(change) {
            state = change(state);
            listeners.forEach((l) => l());
        },
        change(change) {
            const next: SessionState = change(state);
            if (next !== state) {
                state = next;
                listeners.forEach((l) => l());
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

// One store for the whole visit, kept in memory only. It lives outside the mounted page, so a
// remount does not lose the plan.
let shared: SessionStore | null = null;
export function sharedSession(): SessionStore {
    shared ??= createSessionStore();
    return shared;
}

export function useSession(store: SessionStore): SessionState {
    const [state, setState] = useState<SessionState>(store.get());
    useEffect(() => {
        setState(store.get());
        return store.subscribe(() => setState(store.get()));
    }, [store]);
    return state;
}
