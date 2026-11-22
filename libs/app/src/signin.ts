import { useEffect, useState } from "preact/hooks";

// What the shell shows about sign-in. It never holds a token (G3, G4).
export interface SignInState {
    login: string | null;
    // True after a sign-in that did not finish: cancelled, denied, or failed.
    notice: boolean;
    busy: boolean;
}

// How a host reaches its own sign-in. The shell is the same in both hosts; only the port differs.
export interface SignInPort {
    // The signed-in username, or null when signed out.
    status(): Promise<string | null>;
    // Runs a sign-in. Null means it did not finish.
    signIn(): Promise<{ login: string } | null>;
}

export interface SignInController {
    get(): SignInState;
    start(): void;
    subscribe(listener: () => void): () => void;
}

export function createSignInController(port: SignInPort, initial: { notice?: boolean } = {}): SignInController {
    let state: SignInState = { login: null, notice: initial.notice ?? false, busy: false };
    const listeners: Set<() => void> = new Set();
    const set = (next: SignInState): void => {
        state = next;
        listeners.forEach((l) => l());
    };
    void port
        .status()
        .then((login: string | null) => {
            if (login && state.login === null) {
                set({ ...state, login });
            }
        })
        .catch(() => undefined);
    return {
        get: () => state,
        start() {
            if (state.busy) {
                return;
            }
            set({ ...state, busy: true, notice: false });
            void port
                .signIn()
                .catch(() => null)
                .then((result: { login: string } | null) => {
                    set(result ? { login: result.login, notice: false, busy: false } : { ...state, notice: true, busy: false });
                });
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export function useSignIn(controller: SignInController | undefined): SignInState | null {
    const [state, setState] = useState<SignInState | null>(controller?.get() ?? null);
    useEffect(() => {
        if (!controller) {
            return;
        }
        setState(controller.get());
        return controller.subscribe(() => setState(controller.get()));
    }, [controller]);
    return controller ? state : null;
}
