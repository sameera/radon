import { useEffect, useState } from "preact/hooks";

// What the shell shows about sign-in. It never holds a token (G3, G4).
export interface SignInState {
    login: string | null;
    // True after a sign-in that did not finish: cancelled, denied, or failed.
    notice: boolean;
    busy: boolean;
    // True from the moment the person signs out until they sign in again. The sign-in screen then
    // warns that GitHub may still be signed in (D8).
    signedOut: boolean;
    status: "checking" | "ready" | "unavailable";
}

// How a host reaches its own sign-in. The shell is the same in both hosts; only the port differs.
export interface SignInPort {
    // The signed-in username, or null when signed out.
    status(): Promise<string | null>;
    // Runs a sign-in. Null means it did not finish.
    signIn(): Promise<{ login: string } | null>;
    // Optional (D4). Ends this host's sign-in. Only a host that supplies it shows a Sign out item.
    signOut?(): Promise<void>;
}

export interface SignInController {
    get(): SignInState;
    start(): void;
    check(): void;
    // Present only when the host's port supplies a sign-out step.
    signOut?: () => void;
    subscribe(listener: () => void): () => void;
}

export function createSignInController(port: SignInPort, initial: { notice?: boolean; signedOut?: boolean } = {}): SignInController {
    let state: SignInState = { login: null, notice: initial.notice ?? false, busy: false, signedOut: initial.signedOut ?? false, status: "checking" };
    const listeners: Set<() => void> = new Set();
    const set = (next: SignInState): void => {
        state = next;
        listeners.forEach((l) => l());
    };
    let checking = false;
    function check(): void {
        if (checking || state.busy) {
            return;
        }
        checking = true;
        const previous = state;
        void port.status()
            .then(
                (login) => {
                    if (state === previous) {
                        set({ ...state, login, status: "ready" });
                    }
                },
                () => {
                    if (state === previous) {
                        set({ ...state, login: null, status: "unavailable" });
                    }
                },
            )
            .finally(() => {
                checking = false;
            });
    }
    check();
    function signOut(): void {
        const signOutStep = port.signOut;
        if (!signOutStep || !state.login || state.busy) {
            return;
        }
        const before = state;
        // The sign-in screen replaces the pages at once. Busy keeps Sign in off until the host reloads.
        set({ login: null, notice: false, busy: true, signedOut: true, status: "ready" });
        void signOutStep.call(port).then(undefined, () => {
            set({ ...before });
            check();
        });
    }
    return {
        get: () => state,
        check,
        signOut: port.signOut ? signOut : undefined,
        start() {
            if (state.busy || state.login || state.status !== "ready") {
                return;
            }
            set({ ...state, busy: true, notice: false });
            void port
                .signIn()
                .catch(() => null)
                .then((result: { login: string } | null) => {
                    set(result ? { login: result.login, notice: false, busy: false, signedOut: false, status: "ready" } : { ...state, notice: true, busy: false });
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
        const unsubscribe = controller.subscribe(() => setState(controller.get()));
        const timer = window.setInterval(controller.check, 60_000);
        window.addEventListener("focus", controller.check);
        document.addEventListener("visibilitychange", controller.check);
        return () => {
            unsubscribe();
            window.clearInterval(timer);
            window.removeEventListener("focus", controller.check);
            document.removeEventListener("visibilitychange", controller.check);
        };
    }, [controller]);
    return controller ? state : null;
}
