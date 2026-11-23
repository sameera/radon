import type { VNode } from "preact";
import type { SignInController, SignInState } from "./signin.ts";

export function Account({ signIn, state }: { signIn: SignInController; state: SignInState }): VNode {
    return (
        <div class="rd-nav__account">
            {state.login ? (
                <span class="rd-nav__user">{state.login}</span>
            ) : state.status === "checking" ? (
                <p role="status">Checking sign-in…</p>
            ) : state.status === "unavailable" ? (
                <>
                    <p role="alert">Could not check your GitHub sign-in</p>
                    <button type="button" class="rd-btn rd-btn--primary" onClick={signIn.check}>Retry</button>
                </>
            ) : (
                <button type="button" class="rd-btn rd-btn--primary" disabled={state.busy} onClick={() => signIn.start()}>
                    Sign in with GitHub
                </button>
            )}
            {state.notice && !state.login && state.status === "ready" && (
                <p class="rd-nav__notice" role="alert">
                    Sign-in did not finish
                </p>
            )}
        </div>
    );
}
