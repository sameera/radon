// The goal on a sprint card (story #103, D5, D6, D7, D8). A goal editor gets a one-line goal field
// that saves when the lead leaves it. Everyone else sees the goal as plain text (G14).
import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { GitHubGateway } from "./gateway.ts";
import type { Repo } from "./repo.tsx";
import { CAUSE_TEXT, GOAL_CAP, normalizeGoal, saveGoal, type GoalCause } from "./goals.ts";

interface SprintGoalProps {
    gateway: GitHubGateway;
    repo: Repo;
    sprint: string;
    sprintName: string;
    // The goal the Grooming sync returned, or "" when the sprint has none.
    saved: string;
    mayEdit: boolean;
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "failed"; cause: GoalCause };

export function SprintGoal(props: SprintGoalProps): VNode | null {
    // Text is rendered as text only, so markup in a goal is never read as markup (G8).
    if (!props.mayEdit) {
        return props.saved === "" ? null : <p class="rd-band__goal">{props.saved}</p>;
    }
    return <GoalField {...props} />;
}

function GoalField({ gateway, repo, sprint, sprintName, saved }: SprintGoalProps): VNode {
    const [text, setText] = useState<string>(saved);
    const [state, setState] = useState<SaveState>({ kind: "idle" });
    // The last goal the store holds, the text waiting for the write in flight, and whether a
    // write is in flight: at most one per card (D5).
    const stored = useRef<string>(saved);
    const queued = useRef<string | null>(null);
    const inFlight = useRef<boolean>(false);
    const mounted = useRef<boolean>(true);
    useEffect(
        () => () => {
            mounted.current = false;
        },
        [],
    );

    // A write keeps going after the card goes away, so it lands on its own repository and sprint,
    // but its result is never shown on another page (G12).
    const send = (value: string): void => {
        inFlight.current = true;
        setState({ kind: "saving" });
        void saveGoal(gateway, repo, sprint, value).then((result) => {
            inFlight.current = false;
            if (!mounted.current) {
                return;
            }
            if (result.ok) {
                stored.current = value;
            }
            const next: string | null = queued.current;
            queued.current = null;
            if (next !== null && (next !== stored.current || !result.ok)) {
                send(next);
            } else if (result.ok || next !== null) {
                setState({ kind: "idle" });
            } else {
                setState({ kind: "failed", cause: result.cause });
            }
        });
    };

    const commit = (raw: string): void => {
        const value: string = normalizeGoal(raw);
        setText(value);
        if (inFlight.current) {
            queued.current = value;
            return;
        }
        if (value === stored.current) {
            setState({ kind: "idle" });
            return;
        }
        send(value);
    };

    const retry = (): void => {
        if (inFlight.current) {
            queued.current = text;
            return;
        }
        send(text);
    };

    return (
        <div class="rd-band__goal-edit">
            <textarea
                class="rd-input rd-input--inline rd-band__goal-field"
                rows={1}
                maxLength={GOAL_CAP}
                placeholder="Set sprint goal"
                aria-label={`Sprint goal for ${sprintName}`}
                value={text}
                onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        (e.currentTarget as HTMLTextAreaElement).blur();
                    }
                }}
                onBlur={(e) => commit((e.currentTarget as HTMLTextAreaElement).value)}
            />
            {state.kind === "saving" && (
                <span class="rd-band__goal-state rd-text-small" role="status">
                    Saving
                </span>
            )}
            {state.kind === "failed" && (
                <div class="rd-band__goal-failed">
                    <p class="rd-band__goal-state rd-text-small" role="alert">
                        {`Not saved. ${CAUSE_TEXT[state.cause]}`}
                    </p>
                    <button type="button" class="rd-btn rd-btn--sm" onClick={retry}>
                        Try again
                    </button>
                </div>
            )}
        </div>
    );
}
