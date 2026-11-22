import type { SignInPort } from "@raiden/app";

type Send = (message: { type: string }) => Promise<unknown>;

function loginOf(answer: unknown): string | null {
    const login: unknown = typeof answer === "object" && answer !== null ? (answer as { login?: unknown }).login : null;
    return typeof login === "string" ? login : null;
}

// How the Raiden tab reaches the background worker. The tab sees only the username.
export function extensionSignInPort(send: Send): SignInPort {
    return {
        async status(): Promise<string | null> {
            try {
                return loginOf(await send({ type: "raiden/status" }));
            } catch {
                return null;
            }
        },
        async signIn(): Promise<{ login: string } | null> {
            try {
                const login: string | null = loginOf(await send({ type: "raiden/sign-in" }));
                return login ? { login } : null;
            } catch {
                return null;
            }
        },
    };
}
