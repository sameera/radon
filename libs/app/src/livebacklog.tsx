import type { VNode } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { ChevronIcon } from "./icons.tsx";
import { ExternalLink, repoPage } from "./links.tsx";
import type { GitHubGateway } from "./gateway.ts";
import { useRepo, type Repo } from "./repo.tsx";
import { buildTree, filterTree, loadBacklog, type BacklogCause, type BacklogLoad, type LiveIssue, type TreeNode } from "./backlogload.ts";

// What a page needs to read the live backlog: the gateway and the signed-in person (D1, G12).
export interface LiveSource {
    gateway: GitHubGateway;
    login: string;
}

// null while the load runs.
type LoadState = BacklogLoad | null;

// Runs a backlog load for the current repository and person. A new load starts when either
// changes, or on Try again. An answer for an earlier repository or person is dropped (G12).
function useBacklogLoad(source: LiveSource, repo: Repo | null, attempt: number): LoadState {
    const [state, setState] = useState<LoadState>(null);
    useEffect(() => {
        setState(null);
        if (!repo) {
            return;
        }
        let live = true;
        void loadBacklog(source.gateway, repo).then((result: BacklogLoad) => {
            if (live) {
                setState(result);
            }
        });
        return () => {
            live = false;
        };
    }, [source.gateway, source.login, repo?.owner, repo?.name, repo?.url, attempt]);
    return state;
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

function LiveRef({ issue, current }: { issue: LiveIssue; current: Repo | null }): VNode {
    const body: VNode = (
        <>
            <span class="rd-ref__num">#{issue.number}</span>
            <span class="rd-ref__title">{issue.title}</span>
        </>
    );
    const href: string | null = issueHref(current?.url, issue);
    return href === null ? <span class="rd-ref">{body}</span> : <ExternalLink class="rd-ref" href={href}>{body}</ExternalLink>;
}

interface RowsProps {
    nodes: TreeNode[];
    depth: number;
    collapsed: Set<string>;
    filtering: boolean;
    onToggle: (id: string) => void;
    current: Repo | null;
}

function Rows({ nodes, depth, collapsed, filtering, onToggle, current }: RowsProps): VNode {
    return (
        <>
            {nodes.map((node: TreeNode) => {
                const { issue } = node;
                const parent: boolean = node.children.length > 0;
                // While filtering, matches show open. Each row's own setting stays.
                const open: boolean = filtering || !collapsed.has(issue.id);
                return (
                    <div class="rd-lb-group" key={issue.id}>
                        <div
                            class="rd-bl-row rd-lb-row"
                            data-num={issue.number}
                            data-depth={depth}
                            style={{ "--rd-lb-depth": depth }}
                        >
                            {parent ? (
                                <button
                                    type="button"
                                    class="rd-icon-btn rd-bl-chev"
                                    aria-expanded={open}
                                    aria-label={`${open ? "Hide" : "Show"} issues under #${issue.number}`}
                                    onClick={() => onToggle(issue.id)}
                                >
                                    <ChevronIcon open={open} />
                                </button>
                            ) : (
                                <span class="rd-lb-spacer" aria-hidden="true" />
                            )}
                            <LiveRef issue={issue} current={current} />
                        </div>
                        {parent && open && (
                            <Rows
                                nodes={node.children}
                                depth={depth + 1}
                                collapsed={collapsed}
                                filtering={filtering}
                                onToggle={onToggle}
                                current={current}
                            />
                        )}
                    </div>
                );
            })}
        </>
    );
}

interface LiveBacklogProps {
    source: LiveSource;
    width: number;
    filter: string;
    onFilter: (text: string) => void;
    // The drop zone that takes a planned row out of the plan (G20). Rows here are never dragged (G18).
    zone: Record<string, unknown>;
    over: boolean;
}

// The backlog read from GitHub: the current repository's open issues as a tree (D3, D4).
export function LiveBacklog({ source, width, filter, onFilter, zone, over }: LiveBacklogProps): VNode {
    const current: Repo | null = useRepo();
    const [attempt, setAttempt] = useState<number>(0);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const state: LoadState = useBacklogLoad(source, current, attempt);
    const tree: TreeNode[] = useMemo(() => (state?.ok ? buildTree(state.issues) : []), [state]);
    const shown: TreeNode[] = useMemo(() => filterTree(tree, filter), [tree, filter]);
    const filtering: boolean = filter.trim() !== "";
    const count: number = state?.ok ? state.issues.filter((i) => i.inQuery).length : 0;
    const newInitiative: string | null = repoPage(current?.url, "issues/new");
    const toggle = (id: string): void => {
        const next: Set<string> = new Set(collapsed);
        if (!next.delete(id)) {
            next.add(id);
        }
        setCollapsed(next);
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
            <div class="rd-backlog__list">
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
                        <Rows nodes={shown} depth={0} collapsed={collapsed} filtering={filtering} onToggle={toggle} current={current} />
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
