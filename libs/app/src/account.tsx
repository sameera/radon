import type { VNode } from "preact";
import { useSignIn, type SignInController } from "./signin.ts";

// The sign-in control: the same in both hosts. Pages never wait for it (D9).
export function Account({ signIn }: { signIn: SignInController }): VNode | null {
    const state = useSignIn(signIn);
    if (!state) {
        return null;
    }
    return (
        <div class="rd-nav__account">
            {state.login ? (
                <span class="rd-nav__user">{state.login}</span>
            ) : (
                <button type="button" class="rd-btn rd-btn--primary" disabled={state.busy} onClick={() => signIn.start()}>
                    Sign in with GitHub
                </button>
            )}
            {state.notice && !state.login && (
                <p class="rd-nav__notice" role="alert">
                    Sign-in did not finish
                </p>
            )}
        </div>
    );
}
