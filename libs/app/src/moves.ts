// The move write (story #114, D2, D6). Raiden's backend saves one issue's sprint in its own store:
// a sprint's identity, or null for the band of issues with no sprint. Nothing is written to GitHub
// (G30). The page sends only the repository, the issue's identity and the target (G29).
import { useMemo, useRef, useState } from "preact/hooks";
import type { GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "./gateway.ts";
import type { Repo } from "./repo.tsx";

export const MOVE_PATH: string = "/grooming/move";
// The private data a Raiden row drag carries. It is the only thing a drop accepts (D8, G6).
export const MOVE_MARKER: string = "application/x-raiden-row";

export type MoveCause = "not-allowed" | "sprint-gone" | "backend-unavailable" | "other";
export type MoveSave = { ok: true } | { ok: false; cause: MoveCause };

function causeOf(result: GitHubResult & { ok: false }): MoveCause {
    if (result.reason === "unknown-sprint") {
        return "sprint-gone";
    }
    switch (result.kind) {
        case "permission":
            return "not-allowed";
        case "network":
            return "backend-unavailable";
        default:
            return "other";
    }
}

// Saves `sprint` as the issue's sprint in Raiden, or the no-sprint mark when it is null. The
// repository and issue are fixed when the write starts, so it lands where it was made (G23).
export async function saveMove(gateway: GitHubGateway, repo: Repo, issue: string, sprint: string | null): Promise<MoveSave> {
    let result: GitHubResult;
    try {
        result = await gateway.request({ to: "backend", path: MOVE_PATH, method: "POST", body: { owner: repo.owner, name: repo.name, issue, sprint } });
    } catch {
        return { ok: false, cause: "backend-unavailable" };
    }
    return result.ok ? { ok: true } : { ok: false, cause: causeOf(result) };
}

export const MOVE_CAUSE_TEXT: Record<MoveCause, string> = {
    "not-allowed": "You are not allowed to move this repository's issues.",
    "sprint-gone": "That sprint no longer exists.",
    "backend-unavailable": "Raiden's backend is unavailable.",
    other: "Something went wrong.",
};

// Whether a drag carries only Raiden's row marker: no text, files or link (G6).
export function onlyMarker(dt: DataTransfer | null | undefined): boolean {
    const types: string[] = Array.from((dt?.types ?? []) as ArrayLike<string>);
    return types.length === 1 && types[0] === MOVE_MARKER;
}

// One page load's moves: per row, the last band Raiden confirmed and the band the lead last put
// it in, and at most one write in flight with the newest waiting target (D6).
interface MoveBook {
    saved: Map<string, string | null>;
    targets: Map<string, string | null>;
    inFlight: Set<string>;
    queued: Map<string, string | null>;
}

export interface Moves {
    // Each query issue's shown band, with the lead's moves applied.
    bands: Map<string, string | null>;
    // Moves the row to the band, shows it there at once and saves it. False when nothing moved.
    move: (id: string, to: string | null) => boolean;
    // The announced message of the last failed move on this page, or null.
    notice: string | null;
}

interface MovesArgs {
    gateway: GitHubGateway;
    repo: Repo | null;
    // The repository and person the page shows; a change starts a fresh book.
    pageKey: string;
    // Each query issue's band as loaded. A new load starts a fresh book.
    loaded: Map<string, string | null>;
    mayEdit: boolean;
    // The issue's number, for the failure message.
    numberOf: (id: string) => number | null;
}

export function useMoves({ gateway, repo, pageKey, loaded, mayEdit, numberOf }: MovesArgs): Moves {
    const book: MoveBook = useMemo(() => ({ saved: new Map(), targets: new Map(), inFlight: new Set(), queued: new Map() }), [pageKey, loaded]);
    const current = useRef<MoveBook>(book);
    current.current = book;
    const [version, setVersion] = useState<number>(0);
    const [failure, setFailure] = useState<{ book: MoveBook; text: string } | null>(null);
    const bump = (): void => setVersion((v: number) => v + 1);
    const bands: Map<string, string | null> = useMemo(() => {
        const out: Map<string, string | null> = new Map(loaded);
        for (const layer of [book.saved, book.targets]) {
            for (const [id, band] of layer) {
                if (out.has(id)) {
                    out.set(id, band);
                }
            }
        }
        return out;
    }, [loaded, book, version]);

    const send = (id: string, to: string | null): void => {
        if (!repo) {
            return;
        }
        book.inFlight.add(id);
        void saveMove(gateway, repo, id, to).then((result: MoveSave) => {
            book.inFlight.delete(id);
            // A write for an earlier repository, person or load lands, but its result is not shown (G23).
            if (current.current !== book) {
                return;
            }
            const next: string | null | undefined = book.queued.get(id);
            book.queued.delete(id);
            if (result.ok) {
                book.saved.set(id, to);
                if (next !== undefined && next !== to) {
                    send(id, next);
                }
                bump();
                return;
            }
            // Drop any waiting target and go back to the last band Raiden saved (G21, G24).
            book.targets.delete(id);
            bump();
            const n: number | null = numberOf(id);
            setFailure({ book, text: `The move of ${n === null ? "the issue" : `#${n}`} was not saved. ${MOVE_CAUSE_TEXT[result.cause]}` });
        });
    };

    // The band the row shows now: its newest target, else its saved band, else its loaded band.
    const shownOf = (id: string): string | null | undefined =>
        book.targets.has(id) ? book.targets.get(id) : book.saved.has(id) ? book.saved.get(id) : loaded.get(id);

    const move = (id: string, to: string | null): boolean => {
        if (!mayEdit || !loaded.has(id) || shownOf(id) === to) {
            return false;
        }
        book.targets.set(id, to);
        bump();
        if (book.inFlight.has(id)) {
            book.queued.set(id, to);
        } else {
            send(id, to);
        }
        return true;
    };

    return { bands, move, notice: failure !== null && failure.book === book ? failure.text : null };
}
