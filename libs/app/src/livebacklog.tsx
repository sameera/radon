import { Fragment, type VNode } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { GripIcon } from "./icons.tsx";
import { WorkItemIcon, workItemKind } from "./workitemicon.tsx";
import { ExternalLink, repoPage } from "./links.tsx";
import type { GitHubGateway } from "./gateway.ts";
import { useRepo, type Repo } from "./repo.tsx";
import { buildTree, filterTree, loadBacklog, type BacklogCause, type BacklogLoad, type LiveIssue, type TreeNode } from "./backlogload.ts";
import { flattenTree, groupItems, moveItem, orderItems, type ListGroup, type ListItem } from "./backloglist.ts";

// What a page needs to read the live backlog: the gateway and the signed-in person (D1, G12).
export interface LiveSource {
    gateway: GitHubGateway;
    login: string;
}

// null while the load runs.
type LoadState = BacklogLoad | null;

// Runs a backlog load for the current repository and person. A new load starts when either
// changes, or on Try again. Each answer is stored with the repository, person and attempt it was
// read for, and an answer stored for anything else reads as loading. So no render, not even the
// first one after a change, shows an answer for an earlier repository or person (G12).
function useBacklogLoad(source: LiveSource, repo: Repo | null, attempt: number): LoadState {
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

const MESSAGES: Record<BacklogCause, string> = {
    "signed-out": "You are signed out of GitHub. Sign in to see the backlog.",
    "cannot-read": "Raiden's GitHub App cannot read this repository's issues.",
    "rate-limit": "GitHub's rate limit was reached. Wait a few minutes, then try again.",
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
    const outside: boolean = !issue.inQuery;
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

type Side = "before" | "after";

interface ListProps {
    groups: ListGroup[];
    current: Repo | null;
    onMove: (id: string, target: string, side: Side) => void;
    // Moves an item one place up (-1) or down (1) in the shown list.
    onStep: (id: string, by: -1 | 1) => void;
}

// The backlog list. Each item can be dragged to a new place. This drag is the backlog's own: it
// never plans an item, and the page's drop zones ignore it (G18).
function List({ groups, current, onMove, onStep }: ListProps): VNode {
    const [dragging, setDragging] = useState<string | null>(null);
    const [over, setOver] = useState<{ id: string; side: Side } | null>(null);
    const end = (): void => {
        setDragging(null);
        setOver(null);
    };
    const sideOf = (e: DragEvent): Side => {
        const rect: DOMRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    };
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
                    {group.items.map(({ issue }) => {
                        const side: Side | null = over?.id === issue.id && dragging !== issue.id ? over.side : null;
                        return (
                            <div
                                class={`rd-bl-row rd-lb-row${dragging === issue.id ? " is-dragged" : ""}${side ? ` insert-${side}` : ""}`}
                                data-num={issue.number}
                                data-id={issue.id}
                                key={issue.id}
                                draggable={true}
                                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                                onDragStart={(e: DragEvent) => {
                                    e.stopPropagation();
                                    setDragging(issue.id);
                                    if (e.dataTransfer) {
                                        e.dataTransfer.effectAllowed = "move";
                                        e.dataTransfer.setData("application/x-raiden-backlog", issue.id);
                                    }
                                }}
                                onDragEnd={end}
                                onDragOver={(e: DragEvent) => {
                                    if (dragging === null) {
                                        return;
                                    }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const next: Side = sideOf(e);
                                    setOver((c) => (c?.id === issue.id && c.side === next ? c : { id: issue.id, side: next }));
                                }}
                                onDrop={(e: DragEvent) => {
                                    if (dragging === null) {
                                        return;
                                    }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onMove(dragging, issue.id, sideOf(e));
                                    end();
                                }}
                                onKeyDown={(e: KeyboardEvent) => {
                                    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                                        e.preventDefault();
                                        onStep(issue.id, e.key === "ArrowUp" ? -1 : 1);
                                    }
                                }}
                            >
                                <span class="rd-lb-grip" aria-hidden="true">
                                    <GripIcon />
                                </span>
                                <LiveRef issue={issue} current={current} icon />
                            </div>
                        );
                    })}
                </li>
            ))}
        </ul>
    );
}

interface LiveBacklogProps {
    source: LiveSource;
    width: number;
    filter: string;
    onFilter: (text: string) => void;
    // The drop zone that takes a planned row out of the plan (G20). Rows here are dragged only to
    // reorder the backlog, never onto a goal (G18).
    zone: Record<string, unknown>;
    over: boolean;
}

// The backlog read from GitHub: the current repository's open issues as a list, each item under
// a header of its ancestors (D3, D4).
export function LiveBacklog({ source, width, filter, onFilter, zone, over }: LiveBacklogProps): VNode {
    const current: Repo | null = useRepo();
    const [attempt, setAttempt] = useState<number>(0);
    const state: LoadState = useBacklogLoad(source, current, attempt);
    // The lead's order, in page memory only, kept with the repository and person it was made for.
    // A change of either starts again from tree order.
    const orderKey: string = JSON.stringify([source.login, current?.owner, current?.name]);
    const [order, setOrder] = useState<{ key: string; ids: string[] } | null>(null);
    const ids: string[] | null = order !== null && order.key === orderKey ? order.ids : null;
    const tree: TreeNode[] = useMemo(() => (state?.ok ? buildTree(state.issues) : []), [state]);
    const all: ListItem[] = useMemo(() => orderItems(flattenTree(tree), ids), [tree, ids]);
    const shown: ListItem[] = useMemo(() => orderItems(flattenTree(filterTree(tree, filter)), ids), [tree, filter, ids]);
    const groups: ListGroup[] = useMemo(() => groupItems(shown), [shown]);
    const filtering: boolean = filter.trim() !== "";
    const count: number = state?.ok ? state.issues.filter((i) => i.inQuery).length : 0;
    const newInitiative: string | null = repoPage(current?.url, "issues/new");
    // After a keyboard move, focus returns to the moved item, which may now sit in a new group.
    const listRef = useRef<HTMLDivElement>(null);
    const [refocus, setRefocus] = useState<string | null>(null);
    useEffect(() => {
        if (refocus !== null) {
            listRef.current?.querySelector<HTMLElement>(`.rd-lb-row[data-id="${CSS.escape(refocus)}"] .rd-ref`)?.focus();
            setRefocus(null);
        }
    }, [refocus, groups]);
    const move = (id: string, target: string, side: "before" | "after"): void =>
        setOrder({ key: orderKey, ids: moveItem(all, id, target, side) });
    const step = (id: string, by: -1 | 1): void => {
        const at: number = shown.findIndex((i) => i.issue.id === id);
        const target: ListItem | undefined = shown[at + by];
        if (at >= 0 && target) {
            move(id, target.issue.id, by < 0 ? "before" : "after");
            setRefocus(id);
        }
    };
    return (
        <section
            class={`rd-panel rd-backlog${over ? " is-over" : ""}`}
            style={{ flexBasis: `${width}px` }}
            aria-labelledby="rd-backlog-title"
            {...zone}
        >
            <div class="rd-panel__head">
                <h2 class="rd-text-axis" id="rd-backlog-title">
                    Backlog
                </h2>
                {state?.ok && <span class="rd-panel__sub">{`${count} ${count === 1 ? "issue" : "issues"}`}</span>}
            </div>
            <div class="rd-backlog__filter">
                <input
                    class="rd-input"
                    type="search"
                    aria-label="Filter backlog"
                    placeholder="Filter by title or number"
                    value={filter}
                    onInput={(e) => onFilter((e.currentTarget as HTMLInputElement).value)}
                />
            </div>
            <div class="rd-backlog__list" ref={listRef}>
                {state === null ? (
                    <p class="rd-backlog__empty rd-lb-status rd-text-small" role="status">
                        Loading the backlog from GitHub…
                    </p>
                ) : !state.ok ? (
                    <div class="rd-backlog__empty rd-lb-failed">
                        <p class="rd-lb-status rd-text-small" role="status">
                            {MESSAGES[state.cause]}
                        </p>
                        <button type="button" class="rd-btn rd-lb-retry" onClick={() => setAttempt(attempt + 1)}>
                            Try again
                        </button>
                    </div>
                ) : (
                    <>
                        {state.hidden > 0 && (
                            <p class="rd-lb-capped rd-text-small" role="note">
                                {`${state.hidden} ${state.hidden === 1 ? "issue is" : "issues are"} not shown. GitHub search returns at most 1,000 issues. A later Settings page will let you narrow the query.`}
                            </p>
                        )}
                        {shown.length === 0 && (
                            <p class="rd-backlog__empty rd-text-small">
                                {filtering ? "No issues match. Clear the filter to show them all." : "This repository has no open issues."}
                            </p>
                        )}
                        {groups.length > 0 && <List groups={groups} current={current} onMove={move} onStep={step} />}
                    </>
                )}
            </div>
            {newInitiative !== null && (
                <div class="rd-backlog__foot">
                    <ExternalLink class="rd-backlog__new rd-text-small" href={newInitiative}>
                        New initiative in GitHub
                    </ExternalLink>
                </div>
            )}
        </section>
    );
}
