// The band view (story #88): each sprint is a horizontal band with the goal column on the left and
// the backlog column on the right, under the milestone that contains it (D8, D9, D15). The goal
// column holds the milestone headers and each band's sprint card (D17). Bands show only after the
// Grooming sync and the backlog load both succeeded (D5).
import { Fragment, type VNode } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ExternalLink, repoPage } from "./links.tsx";
import { useRepo, type Repo } from "./repo.tsx";
import { LoadStatus, useBacklogLoad, type LiveSource, type LoadState } from "./livebacklog.tsx";
import { syncGrooming, type Milestone, type Sprint, type SyncLoad } from "./groomingsync.ts";
import { DEFAULT_BACKLOG_WIDTH, Divider, fit, limits } from "./grooming.tsx";
import { assignBands, BandRows } from "./bandrows.tsx";
import { currentSprint, loadProgress, localToday, type Progress } from "./progress.ts";
import { buildTree, filterTree, type LiveIssue } from "./backlogload.ts";
import { SprintGoal } from "./goalcard.tsx";

export type BandEntry =
    | { kind: "milestone"; milestone: Milestone; sprints: Sprint[]; start: string | null }
    | { kind: "sprint"; sprint: Sprint; milestone: Milestone | null };

// A milestone's due date as a calendar date read in UTC, as GitHub's milestone page shows it (D9).
export function dueDate(m: Milestone): string | null {
    if (!m.due) {
        return null;
    }
    const t: number = Date.parse(m.due);
    return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function bySprintDate(a: Sprint, b: Sprint): number {
    return a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id);
}

// The view top to bottom. Sprints go in date order. Each sprint sits under its placing milestone:
// the one with the earliest due date on or after the sprint's start. A sprint after every due
// date has no header. A milestone with no due date takes no sprints; its header follows the last
// sprint band (D9, G28, G30).
export function placeSprints(sprints: Sprint[], milestones: Milestone[]): BandEntry[] {
    const sorted: Sprint[] = [...sprints].sort(bySprintDate);
    const dated = milestones
        .filter((m) => dueDate(m) !== null)
        .map((m) => ({ m, due: dueDate(m)! }))
        .sort((a, b) => a.due.localeCompare(b.due) || a.m.number - b.m.number);
    const under: Map<string, Sprint[]> = new Map(dated.map((d) => [d.m.id, []]));
    const loose: Sprint[] = [];
    for (const s of sorted) {
        const placing = dated.find((d) => d.due >= s.start);
        if (placing) {
            under.get(placing.m.id)!.push(s);
        } else {
            loose.push(s);
        }
    }
    const out: BandEntry[] = [];
    for (const { m } of dated) {
        const own: Sprint[] = under.get(m.id)!;
        out.push({ kind: "milestone", milestone: m, sprints: own, start: own[0]?.start ?? null });
        own.forEach((s) => out.push({ kind: "sprint", sprint: s, milestone: m }));
    }
    loose.forEach((s) => out.push({ kind: "sprint", sprint: s, milestone: null }));
    milestones
        .filter((m) => dueDate(m) === null)
        .sort((a, b) => a.number - b.number)
        .forEach((m) => out.push({ kind: "milestone", milestone: m, sprints: [], start: null }));
    return out;
}

export function formatDate(date: string): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// A milestone header: title, start, due date, the description as read-only text, and a link that
// opens the milestone for editing in GitHub in a new tab (G29).
function MilestoneHeader({ entry, repo }: { entry: BandEntry & { kind: "milestone" }; repo: Repo | null }): VNode {
    const m: Milestone = entry.milestone;
    const due: string | null = dueDate(m);
    const href: string | null = repoPage(repo?.url, `milestones/${m.number}/edit`);
    return (
        <div class="rd-milestone" data-title={m.title} data-due={due ?? ""} data-start={entry.start ?? ""}>
            <div class="rd-milestone__line">
                <span class="rd-milestone__title rd-text-axis">{m.title}</span>
                {entry.start !== null && <span class="rd-milestone__start rd-text-small">{`Starts ${formatDate(entry.start)}`}</span>}
                {due !== null && <span class="rd-milestone__due rd-text-small">{`Due ${formatDate(due)}`}</span>}
                {href !== null && (
                    <ExternalLink class="rd-milestone__edit rd-text-small" href={href}>
                        Edit in GitHub
                    </ExternalLink>
                )}
            </div>
            {m.description !== "" && <p class="rd-milestone__desc rd-text-small">{m.description}</p>}
        </div>
    );
}

interface CardProps {
    name: string;
    detail: string;
    // Set for the current sprint only: its card alone carries the glow and the bar (G31, G32).
    progress?: Progress | null;
    // The sprint's goal; the no-sprint band has none (D8, G9).
    goal?: VNode | null;
}

function ProgressBar({ progress }: { progress: Progress }): VNode {
    const share: number = progress.total === 0 ? 0 : Math.round((progress.closed / progress.total) * 100);
    return (
        <div class="rd-band__progress">
            <div class="rd-progress" role="img" aria-label={`${progress.closed} of ${progress.total} issues closed, ${share}%`}>
                <div class="rd-progress__seg rd-progress__seg--done" style={{ width: `${share}%` }} />
            </div>
            <div class="rd-progress__legend">
                <span>
                    <b>{`${progress.closed} of ${progress.total} closed`}</b>
                    {` · ${share}%`}
                </span>
            </div>
        </div>
    );
}

// A sprint card in the goal column: the sprint's name and dates, its goal, and the progress bar of
// the current sprint (D17, story #103).
function SprintCard({ name, detail, progress, goal }: CardProps): VNode {
    return (
        <div class={`rd-band__card${progress ? " is-current" : ""}`}>
            <div class="rd-band__label">
                <b class="rd-band__name">{name}</b>
                <span class="rd-band__dates rd-text-small">{detail}</span>
            </div>
            {goal}
            {progress && <ProgressBar progress={progress} />}
        </div>
    );
}

interface BandProps extends CardProps {
    // The band's key: the sprint's id, or none for the no-sprint band.
    band: { sprint: string } | { none: true };
    label: string;
    children?: VNode | null;
}

// One band: the card first, then the rows, in this order at every width (D11, G43).
function Band({ band, label, children, ...card }: BandProps): VNode {
    return (
        <div class="rd-band" data-sprint={"sprint" in band ? band.sprint : undefined} data-band={"none" in band ? "none" : undefined} role="group" aria-label={label}>
            <SprintCard {...card} />
            <div class="rd-band__rows">{children}</div>
        </div>
    );
}

// Runs the Grooming sync for the current repository and person. An answer kept for an earlier
// repository, person or attempt reads as loading (G20).
type SyncWithProgress = (SyncLoad & { ok: false }) | (SyncLoad & { ok: true; current: Sprint | null; progress: Progress | null });

async function syncAndProgress(live: LiveSource, repo: Repo): Promise<SyncWithProgress> {
    const sync: SyncLoad = await syncGrooming(live.gateway, repo);
    if (!sync.ok) {
        return sync;
    }
    const current: Sprint | null = currentSprint(sync.sprints, localToday());
    if (!current) {
        return { ...sync, current, progress: null };
    }
    if (!current.synced || !sync.source || current.field !== sync.source.field) {
        return { ...sync, current, progress: { sprint: current.id, closed: 0, total: 0 } };
    }
    const read = await loadProgress(live.gateway, repo, sync.source, current);
    return read.ok ? { ...sync, current, progress: read.progress } : { ok: false, cause: read.cause };
}

function useGroomingSync(live: LiveSource, repo: Repo | null, attempt: number): SyncWithProgress | null {
    const key: string = JSON.stringify([live.login, repo?.owner, repo?.name, repo?.url, attempt]);
    const [state, setState] = useState<{ key: string; load: SyncWithProgress } | null>(null);
    useEffect(() => {
        if (!repo) {
            return;
        }
        let current = true;
        void syncAndProgress(live, repo).then((load: SyncWithProgress) => {
            if (current) {
                setState({ key, load });
            }
        });
        return () => {
            current = false;
        };
    }, [live.gateway, key]);
    return state !== null && state.key === key ? state.load : null;
}

// The two reads of a Grooming load, started together, as one state: loading until both answered,
// then the first failure, else the backlog (D5, G18).
function useGroomingLoad(live: LiveSource, repo: Repo | null, attempt: number): { state: LoadState; sync: SyncWithProgress | null } {
    const sync: SyncWithProgress | null = useGroomingSync(live, repo, attempt);
    const backlog = useBacklogLoad(live, repo, attempt);
    if (sync === null || backlog === null) {
        return { state: null, sync: null };
    }
    if (!backlog.ok) {
        return { state: backlog, sync: null };
    }
    if (!sync.ok) {
        return { state: { ok: false, cause: sync.cause }, sync: null };
    }
    return { state: backlog, sync };
}

interface BandPageProps {
    live: LiveSource;
    // The lead's preferred backlog width. Unset, the backlog takes its default share (D18).
    backlogWidth?: number;
    onBacklogWidth?: (value: number, final: boolean) => void;
}

// Below this page width the two columns stack (D11).
export const STACK_BELOW: number = 760;
// The goal column's default share of the view. The backlog takes the rest, less the divider.
export const GOAL_SHARE: number = 0.25;
const DIVIDER_W: number = 16;

export function BandPage({ live, backlogWidth, onBacklogWidth }: BandPageProps): VNode {
    const repo: Repo | null = useRepo();
    const [attempt, setAttempt] = useState<number>(0);
    const [filter, setFilter] = useState<string>("");
    const { state, sync } = useGroomingLoad(live, repo, attempt);
    const bandsRef = useRef<HTMLDivElement>(null);
    const [space, setSpace] = useState<number>(0);
    const [stacked, setStacked] = useState<boolean>(window.innerWidth < STACK_BELOW);
    useEffect(() => {
        const measure = (): void => {
            setSpace(bandsRef.current?.getBoundingClientRect().width ?? 0);
            setStacked(window.innerWidth < STACK_BELOW);
        };
        measure();
        window.addEventListener("resize", measure);
        const observer: ResizeObserver | null = typeof ResizeObserver === "function" && bandsRef.current ? new ResizeObserver(measure) : null;
        if (observer && bandsRef.current) {
            observer.observe(bandsRef.current);
        }
        return () => {
            window.removeEventListener("resize", measure);
            observer?.disconnect();
        };
    }, []);
    const defaultWidth: number = space > 0 ? Math.round(space * (1 - GOAL_SHARE)) - DIVIDER_W : DEFAULT_BACKLOG_WIDTH;
    const shownWidth: number = fit(backlogWidth ?? defaultWidth, space);
    const { min, max } = limits(space);
    const entries: BandEntry[] = sync?.ok ? placeSprints(sync.sprints, sync.milestones) : [];
    // The sprints after every due date have no header. When a milestone comes before them, a break
    // marks where they start, so the first one does not read as under that milestone (AC5, G30).
    const firstLoose: number = entries.findIndex((e: BandEntry) => e.kind === "sprint" && e.milestone === null);
    const loose: number = firstLoose > 0 ? firstLoose : -1;
    const issues: LiveIssue[] = state?.ok ? state.issues : [];
    const assigned: Map<string, string | null> = useMemo(
        () => (sync?.ok ? assignBands(issues, sync.sprints, sync.source) : new Map()),
        [issues, sync],
    );
    // The lead's order inside each band, in page memory only, kept with the repository and person.
    const orderKey: string = JSON.stringify([live.login, repo?.owner, repo?.name]);
    const [orders, setOrders] = useState<{ key: string; bands: Record<string, string[]> }>({ key: orderKey, bands: {} });
    const bandOrder = (band: string): string[] | null => (orders.key === orderKey ? (orders.bands[band] ?? null) : null);
    const setBandOrder = (band: string, ids: string[]): void =>
        setOrders({ key: orderKey, bands: { ...(orders.key === orderKey ? orders.bands : {}), [band]: ids } });
    const anyQuery: boolean = issues.some((i) => i.inQuery);
    const anyMatch: boolean = useMemo(() => filterTree(buildTree(issues), filter).length > 0, [issues, filter]);
    const emptyText: string | null = !anyQuery
        ? "This repository has no open issues."
        : !anyMatch
          ? "No issues match. Clear the filter to show them all."
          : null;
    const count: number = issues.filter((i) => i.inQuery).length;
    const newInitiative: string | null = repoPage(repo?.url, "issues/new");
    return (
        <section class="rd-groom rd-groom--bands" aria-labelledby="rd-groom-title">
            <header class="rd-groom__header">
                <div>
                    <div class="rd-text-axis rd-groom__eyebrow">{repo ? `Grooming · ${repo.owner}/${repo.name}` : "Grooming"}</div>
                    <h1 class="rd-text-view-title" id="rd-groom-title">
                        Backlog grooming
                    </h1>
                </div>
            </header>
            <div class="rd-bands__tools">
                <input
                    class="rd-input"
                    type="search"
                    aria-label="Filter backlog"
                    placeholder="Filter by title or number"
                    value={filter}
                    onInput={(e) => setFilter((e.currentTarget as HTMLInputElement).value)}
                />
                {state?.ok && <span class="rd-panel__sub">{`${count} ${count === 1 ? "issue" : "issues"}`}</span>}
                {newInitiative !== null && (
                    <ExternalLink class="rd-backlog__new rd-text-small" href={newInitiative}>
                        New initiative in GitHub
                    </ExternalLink>
                )}
            </div>
            <div
                class={`rd-bands${stacked ? " rd-bands--stacked" : ""}`}
                ref={bandsRef}
                style={stacked ? undefined : { "--rd-backlog-w": `${shownWidth}px` }}
            >
                {!state?.ok && <LoadStatus state={state} onRetry={() => setAttempt(attempt + 1)} />}
                {state?.ok && (
                    <>
                        {state.hidden > 0 && (
                            <p class="rd-lb-capped rd-text-small" role="note">
                                {`${state.hidden} ${state.hidden === 1 ? "issue is" : "issues are"} not shown. GitHub search returns at most 1,000 issues. A later Settings page will let you narrow the query.`}
                            </p>
                        )}
                        {emptyText && <p class="rd-backlog__empty rd-text-small">{emptyText}</p>}
                        {!stacked && (
                            <div class="rd-bands__head">
                                <h2 class="rd-text-axis rd-bands__col rd-bands__col--goals">Goals</h2>
                                <Divider
                                    width={shownWidth}
                                    min={min}
                                    max={max}
                                    side="right"
                                    defaultWidth={defaultWidth}
                                    onChange={(value: number, final: boolean) => onBacklogWidth?.(value, final)}
                                />
                                <h2 class="rd-text-axis rd-bands__col rd-bands__col--backlog">Backlog</h2>
                            </div>
                        )}
                        {entries.map((entry: BandEntry, at: number) =>
                            entry.kind === "milestone" ? (
                                <MilestoneHeader entry={entry} repo={repo} key={`m:${entry.milestone.id}`} />
                            ) : (
                                <Fragment key={`s:${entry.sprint.id}`}>
                                    {at === loose && (
                                        <div class="rd-bands__loose rd-text-axis" role="separator">
                                            No milestone
                                        </div>
                                    )}
                                    <Band
                                        band={{ sprint: entry.sprint.id }}
                                        label={sync?.ok && sync.progress?.sprint === entry.sprint.id ? `${entry.sprint.name}, current sprint` : entry.sprint.name}
                                        name={entry.sprint.name}
                                        detail={`${formatDate(entry.sprint.start)} – ${formatDate(entry.sprint.end)}`}
                                        progress={sync?.ok && sync.progress?.sprint === entry.sprint.id ? sync.progress : null}
                                        goal={
                                            sync?.ok && repo ? (
                                                <SprintGoal
                                                    key={`${repo.owner}/${repo.name}#${entry.sprint.id}`}
                                                    gateway={live.gateway}
                                                    repo={repo}
                                                    sprint={entry.sprint.id}
                                                    sprintName={entry.sprint.name}
                                                    saved={sync.goals[entry.sprint.id] ?? ""}
                                                    mayEdit={sync.mayEdit}
                                                />
                                            ) : null
                                        }
                                    >
                                        <BandRows
                                            issues={issues}
                                            band={entry.sprint.id}
                                            assigned={assigned}
                                            filter={filter}
                                            order={bandOrder(entry.sprint.id)}
                                            onOrder={(ids: string[]) => setBandOrder(entry.sprint.id, ids)}
                                            current={repo}
                                        />
                                    </Band>
                                </Fragment>
                            ),
                        )}
                        <Band band={{ none: true }} label="Issues with no sprint" name="No sprint" detail="Issues with no sprint in GitHub">
                            <BandRows
                                issues={issues}
                                band={null}
                                assigned={assigned}
                                filter={filter}
                                order={bandOrder("")}
                                onOrder={(ids: string[]) => setBandOrder("", ids)}
                                current={repo}
                            />
                        </Band>
                    </>
                )}
            </div>
        </section>
    );
}
