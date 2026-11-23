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
            const answer = await send({ type: "raiden/status" });
            if (typeof answer === "object" && answer !== null && "unavailable" in answer) {
                throw new Error("Sign-in status unavailable");
            }
            return loginOf(answer);
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
