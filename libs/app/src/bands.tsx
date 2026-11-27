// The band view (story #88): each sprint is a horizontal band with the backlog column on the left
// and the goal column on the right, under the milestone that contains it (D8, D9). Bands show only
// after the Grooming sync and the backlog load both succeeded (D5).
import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ExternalLink, repoPage } from "./links.tsx";
import { useRepo, type Repo } from "./repo.tsx";
import { LiveBacklog, useBacklogLoad, type LiveSource, type LoadState } from "./livebacklog.tsx";
import { syncGrooming, type Milestone, type Sprint, type SyncLoad } from "./groomingsync.ts";
import { Divider, fit, limits } from "./grooming.tsx";

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
    const href: string | null = repoPage(repo?.url, `milestone/${m.number}/edit`);
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

export interface BandProps {
    sprint: Sprint;
}

// One sprint band. The goal area stays empty until the sprint-goals epic fills it.
function Band({ sprint }: BandProps): VNode {
    return (
        <div class="rd-band" data-sprint={sprint.id} role="group" aria-label={sprint.name}>
            <div class="rd-band__rows">
                <div class="rd-band__label">
                    <b class="rd-band__name">{sprint.name}</b>
                    <span class="rd-band__dates rd-text-small">{`${formatDate(sprint.start)} – ${formatDate(sprint.end)}`}</span>
                </div>
            </div>
            <div class="rd-band__goal" aria-label={`Goal for ${sprint.name}`} />
        </div>
    );
}

// Runs the Grooming sync for the current repository and person. An answer kept for an earlier
// repository, person or attempt reads as loading (G20).
function useGroomingSync(live: LiveSource, repo: Repo | null, attempt: number): SyncLoad | null {
    const key: string = JSON.stringify([live.login, repo?.owner, repo?.name, repo?.url, attempt]);
    const [state, setState] = useState<{ key: string; load: SyncLoad } | null>(null);
    useEffect(() => {
        if (!repo) {
            return;
        }
        let current = true;
        void syncGrooming(live.gateway, repo).then((load: SyncLoad) => {
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
function useGroomingLoad(live: LiveSource, repo: Repo | null, attempt: number): { state: LoadState; sync: SyncLoad | null } {
    const sync: SyncLoad | null = useGroomingSync(live, repo, attempt);
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
    backlogWidth: number;
    onBacklogWidth?: (value: number, final: boolean) => void;
}

export function BandPage({ live, backlogWidth, onBacklogWidth }: BandPageProps): VNode {
    const repo: Repo | null = useRepo();
    const [attempt, setAttempt] = useState<number>(0);
    const [filter, setFilter] = useState<string>("");
    const { state, sync } = useGroomingLoad(live, repo, attempt);
    const bandsRef = useRef<HTMLDivElement>(null);
    const [space, setSpace] = useState<number>(0);
    useEffect(() => {
        const measure = (): void => setSpace(bandsRef.current?.getBoundingClientRect().width ?? 0);
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
    const shownWidth: number = fit(backlogWidth, space);
    const { min, max } = limits(space);
    const entries: BandEntry[] = sync?.ok ? placeSprints(sync.sprints, sync.milestones) : [];
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
            <div class="rd-bands" ref={bandsRef} style={{ "--rd-backlog-w": `${shownWidth}px` }}>
                <div class="rd-bands__head">
                    <h2 class="rd-text-axis rd-bands__col rd-bands__col--backlog">Backlog</h2>
                    <Divider width={shownWidth} min={min} max={max} onChange={(value: number, final: boolean) => onBacklogWidth?.(value, final)} />
                    <h2 class="rd-text-axis rd-bands__col rd-bands__col--goals">Goals</h2>
                </div>
                {state?.ok &&
                    entries.map((entry: BandEntry) =>
                        entry.kind === "milestone" ? (
                            <MilestoneHeader entry={entry} repo={repo} key={`m:${entry.milestone.id}`} />
                        ) : (
                            <Band sprint={entry.sprint} key={`s:${entry.sprint.id}`} />
                        ),
                    )}
                <LiveBacklog
                    source={live}
                    state={state}
                    onRetry={() => setAttempt(attempt + 1)}
                    width={shownWidth}
                    filter={filter}
                    onFilter={setFilter}
                    zone={{}}
                    over={false}
                />
            </div>
        </section>
    );
}
