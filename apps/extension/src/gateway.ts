import type { GitHubGateway } from "@raiden/app";
import type { GitHubFailureKind, GitHubResult } from "@raiden/shared";

type Send = (message: { type: string; request: unknown }) => Promise<unknown>;

const KINDS: GitHubFailureKind[] = ["sign-in-needed", "network", "rate-limit", "permission", "other"];

function readResult(answer: unknown): GitHubResult {
    const a = (typeof answer === "object" && answer !== null ? answer : {}) as { ok?: unknown; status?: unknown; kind?: unknown; body?: unknown };
    if (a.ok === true && typeof a.status === "number") {
        return { ok: true, status: a.status, body: a.body };
    }
    if (a.ok === false && KINDS.includes(a.kind as GitHubFailureKind)) {
        return { ok: false, kind: a.kind as GitHubFailureKind };
    }
    return { ok: false, kind: "other" };
}

// What the Raiden tab gives its pages: requests pass to the background worker, which holds the token.
export function extensionGateway(send: Send): GitHubGateway {
    return {
        async request(request) {
            try {
                return readResult(await send({ type: "raiden/github", request }));
            } catch {
                return { ok: false, kind: "other" };
            }
        },
    };
}
