import { Fragment, type VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import { WorkItemIcon, workItemKind } from "./workitemicon.tsx";
import { ExternalLink, repoPage } from "./links.tsx";
import type { GitHubGateway } from "./gateway.ts";
import type { Repo } from "./repo.tsx";
import { loadBacklog, type BacklogCause, type BacklogLoad, type LiveIssue } from "./backlogload.ts";
import type { ListGroup } from "./backloglist.ts";
import { MOVE_MARKER } from "./moves.ts";

// What a page needs to read the live backlog: the gateway and the signed-in person (D1, G12).
export interface LiveSource {
    gateway: GitHubGateway;
    login: string;
}

// null while the load runs. A failure may be the backlog's or the Grooming sync's (D5).
export type LoadCause = BacklogCause | "cannot-read-project" | "backend-unavailable";
export type LoadState = { ok: true; issues: LiveIssue[]; hidden: number } | { ok: false; cause: LoadCause } | null;

// Runs a backlog load for the current repository and person. A new load starts when either
// changes, or on Try again. Each answer is stored with the repository, person and attempt it was
// read for, and an answer stored for anything else reads as loading. So no render, not even the
// first one after a change, shows an answer for an earlier repository or person (G12).
export function useBacklogLoad(source: LiveSource, repo: Repo | null, attempt: number): BacklogLoad | null {
    const key: string = JSON.stringify([source.login, repo?.owner, repo?.name, repo?.url, attempt]);
    const [state, setState] = useState<{ key: string; load: BacklogLoad } | null>(null);
    useEffect(() => {
        if (!repo) {
            return;
        }
        let live = true;
        void loadBacklog(source.gateway, repo).then((result: BacklogLoad) => {
            if (live) {
                setState({ key, load: result });
            }
        });
        return () => {
            live = false;
        };
    }, [source.gateway, key]);
    return state !== null && state.key === key ? state.load : null;
}

const MESSAGES: Record<LoadCause, string> = {
    "signed-out": "You are signed out of GitHub. Sign in to see the backlog.",
    "cannot-read": "Raiden's GitHub App cannot read this repository's issues.",
    "rate-limit": "GitHub's rate limit was reached. Wait a few minutes, then try again.",
    "cannot-read-project": "You cannot read the GitHub project that supplies this repository's sprints. Ask its owner for access.",
    "backend-unavailable": "Raiden's backend is not available, so sprints and milestones could not load.",
    other: "The backlog could not load.",
};

// The address of an issue's page on the current repository's GitHub server (D3).
function issueHref(repoUrl: string | undefined, issue: LiveIssue): string | null {
    if (!repoUrl || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(issue.repo)) {
        return null;
    }
    let origin: string;
    try {
        origin = new URL(repoUrl).origin;
    } catch {
        return null;
    }
    return repoPage(`${origin}/${issue.repo}`, `issues/${issue.number}`);
}

function sameRepoName(issue: LiveIssue, current: Repo | null): boolean {
    return current !== null && issue.repo.toLowerCase() === `${current.owner}/${current.name}`.toLowerCase();
}

// An issue's number and title, linked to its page. An issue in another repository shows its
// repository-qualified reference (D3).
function LiveRef({ issue, current, icon = false }: { issue: LiveIssue; current: Repo | null; icon?: boolean }): VNode {
    const ref: string = sameRepoName(issue, current) ? `#${issue.number}` : `${issue.repo}#${issue.number}`;
    const kind = workItemKind(issue.issueType ?? null, issue.labels ?? []);
    const body: VNode = (
        <>
            <span class="rd-ref__num">{ref}</span>
            {icon && <span class="rd-ref__icon" data-kind={kind ?? "unknown"} role="img" aria-label={kind ?? "Issue"}><WorkItemIcon kind={kind} /></span>}
            <span class="rd-ref__title">{issue.title}</span>
        </>
    );
    const href: string | null = issueHref(current?.url, issue);
    return href === null ? <span class="rd-ref">{body}</span> : <ExternalLink class="rd-ref" href={href}>{body}</ExternalLink>;
}

// One ancestor on a header row. A parent the query did not return is muted and carries a text
// label for screen readers, so color is not the only signal (D6, G8).
function Crumb({ issue, current }: { issue: LiveIssue; current: Repo | null }): VNode {
    const outside: boolean = !issue.inQuery && !issue.elsewhere;
    const label: string = issue.hidden ? "Not in the backlog query" : `Not in the backlog query, ${issue.state.toLowerCase()}`;
    return (
        <span
            class={`rd-lb-crumb${outside ? " is-outside" : ""}${issue.hidden ? " is-hidden" : ""}`}
            data-num={issue.hidden ? "" : issue.number}
            title={outside ? label : undefined}
        >
            {issue.hidden ? <span class="rd-ref rd-lb-hidden">Parent not visible</span> : <LiveRef issue={issue} current={current} />}
            {outside && <span class="rd-lb-outside">{` (${label})`}</span>}
        </span>
    );
}

export type Side = "before" | "after";

interface ListProps {
    groups: ListGroup[];
    current: Repo | null;
    // Moves an item one place up (-1) or down (1) in the shown list.
    onStep: (id: string, by: -1 | 1) => void;
    // Set for an editor only: a row can be dragged, carrying only Raiden's row marker, and this
    // hears its start (the row's identity) and its end (null) (story #114, D8, G6, G26).
    onDragRow?: (id: string | null) => void;
}

// The backlog list. Only an editor's rows can be dragged, to move the issue to another sprint's
// band; Alt+Up and Alt+Down move an item one place inside its band.
export function List({ groups, current, onStep, onDragRow }: ListProps): VNode {
    return (
        <ul class="rd-lb-list">
            {groups.map((group: ListGroup) => (
                <li class="rd-lb-group" key={group.items[0]!.issue.id}>
                    {group.chain.length > 0 && (
                        <div class="rd-lb-head rd-text-small">
                            {group.chain.map((issue: LiveIssue, i: number) => (
                                <Fragment key={issue.id}>
                                    {i > 0 && (
                                        <span class="rd-lb-sep" aria-hidden="true">
                                            {">"}
                                        </span>
                                    )}
                                    <Crumb issue={issue} current={current} />
                                </Fragment>
                            ))}
                        </div>
                    )}
                    {group.items.map(({ issue, depth }) => (
                        <div
                            class="rd-bl-row rd-lb-row"
                            data-num={issue.number}
                            data-id={issue.id}
                            data-depth={depth ?? 0}
                            style={depth ? { paddingLeft: `calc(${depth} * var(--rd-space-4))` } : undefined}
                            key={issue.id}
                            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                            draggable={onDragRow ? true : undefined}
                            onDragStart={
                                onDragRow
                                    ? (e: DragEvent) => {
                                          // A drag that starts on the issue link drags the row and carries no link (G7).
                                          e.dataTransfer?.setData(MOVE_MARKER, issue.id);
                                          if (e.dataTransfer) {
                                              e.dataTransfer.effectAllowed = "move";
                                          }
                                          onDragRow(issue.id);
                                      }
                                    : undefined
                            }
                            onDragEnd={onDragRow ? () => onDragRow(null) : undefined}
                            onKeyDown={(e: KeyboardEvent) => {
                                if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                                    e.preventDefault();
                                    onStep(issue.id, e.key === "ArrowUp" ? -1 : 1);
                                }
                            }}
                        >
                            <LiveRef issue={issue} current={current} icon />
                        </div>
                    ))}
                </li>
            ))}
        </ul>
    );
}

interface LoadStatusProps {
    state: LoadState;
    onRetry: () => void;
}

// The page's load while it runs, or its named failure and the one Try again that reruns it (D5).
export function LoadStatus({ state, onRetry }: LoadStatusProps): VNode | null {
    if (state === null) {
        return (
            <p class="rd-backlog__empty rd-lb-status rd-text-small" role="status">
                Loading the backlog from GitHub…
            </p>
        );
    }
    if (state.ok) {
        return null;
    }
    return (
        <div class="rd-backlog__empty rd-lb-failed">
            <p class="rd-lb-status rd-text-small" role="status">
                {MESSAGES[state.cause]}
            </p>
            <button type="button" class="rd-btn rd-lb-retry" onClick={onRetry}>
                Try again
            </button>
        </div>
    );
}
