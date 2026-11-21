import type { VNode } from "preact";
import { ChevronIcon } from "./icons.tsx";
import {
    effectiveGoal,
    goalEpicCount,
    goalItems,
    goalRank,
    initiativeEpicsPlanned,
    ownGoal,
    plannedEpicCount,
    toggleCollapsed,
    totalEpics,
    type Goal,
    type Initiative,
    type PlanEntry,
    type SessionState,
} from "./plan.ts";
import { GROOMING_SPRINT, INITIATIVES } from "./sample.ts";
import type { SessionStore } from "./session.ts";

function plural(n: number, one: string, many: string = `${one}s`): string {
    return `${n} ${n === 1 ? one : many}`;
}

function goalLabel(state: SessionState, goalId: string | null): string {
    return goalId === null ? "" : `Goal ${goalRank(state, goalId)}`;
}

interface BacklogProps {
    state: SessionState;
    session: SessionStore;
}

function Backlog({ state, session }: BacklogProps): VNode {
    const total: number = totalEpics(INITIATIVES);
    return (
        <section class="rd-panel rd-backlog" aria-labelledby="rd-backlog-title">
            <div class="rd-panel__head">
                <h2 class="rd-text-axis" id="rd-backlog-title">
                    Backlog
                </h2>
                <span class="rd-panel__sub">{plural(total, "epic")}</span>
            </div>
            <div class="rd-backlog__list">
                {INITIATIVES.map((init: Initiative) => {
                    const open: boolean = !state.collapsed.includes(init.num);
                    const own: string | null = ownGoal(state, "init", init.num);
                    const planned: number = initiativeEpicsPlanned(INITIATIVES, state, init);
                    const meta: string =
                        own !== null
                            ? goalLabel(state, own)
                            : planned > 0
                              ? `${planned} of ${init.epics.length} epics planned`
                              : "";
                    return (
                        <div class="rd-bl-init" data-num={init.num} key={init.num}>
                            <div class={`rd-bl-row rd-bl-row--init${own !== null ? " is-planned" : ""}`}>
                                <button
                                    type="button"
                                    class="rd-icon-btn rd-bl-chev"
                                    aria-expanded={open}
                                    aria-label={`${open ? "Hide" : "Show"} epics of initiative ${init.num}`}
                                    onClick={() => session.update((s) => toggleCollapsed(s, init.num))}
                                >
                                    <ChevronIcon open={open} />
                                </button>
                                <span class="rd-ref">
                                    <span class="rd-ref__num">#{init.num}</span>
                                    <span class="rd-ref__title">{init.title}</span>
                                </span>
                                <span class="rd-bl-meta">{meta}</span>
                            </div>
                            {open &&
                                init.epics.map((epic) => {
                                    const eff: string | null = effectiveGoal(INITIATIVES, state, epic.num);
                                    return (
                                        <div
                                            class={`rd-bl-row rd-bl-row--epic rd-bl-epic${eff !== null ? " is-planned" : ""}`}
                                            data-num={epic.num}
                                            key={epic.num}
                                        >
                                            <span class="rd-glyph rd-glyph--epic" aria-hidden="true" />
                                            <span class="rd-ref">
                                                <span class="rd-ref__num">#{epic.num}</span>
                                                <span class="rd-ref__title">{epic.title}</span>
                                            </span>
                                            <span class="rd-bl-meta">{goalLabel(state, eff)}</span>
                                        </div>
                                    );
                                })}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

interface GoalCardProps {
    state: SessionState;
    goal: Goal;
    showIssues: boolean;
}

function itemTitle(entry: PlanEntry): { num: number; title: string } {
    for (const init of INITIATIVES) {
        if (entry.kind === "init" && init.num === entry.num) {
            return { num: init.num, title: init.title };
        }
        const epic = init.epics.find((e) => e.num === entry.num);
        if (entry.kind === "epic" && epic) {
            return { num: epic.num, title: epic.title };
        }
    }
    return { num: entry.num, title: "" };
}

function GoalCard({ state, goal, showIssues }: GoalCardProps): VNode {
    const items: PlanEntry[] = goalItems(state, goal.id);
    const epics: number = goalEpicCount(INITIATIVES, state, goal.id);
    const inits: number = items.filter((i) => i.kind === "init").length;
    const own: number = items.filter((i) => i.kind === "epic").length;
    return (
        <article class="rd-goal-card" data-goal={goal.id}>
            <div class="rd-goal-card__rail">
                <span class="rd-goal-card__rank rd-text-body-strong">{goalRank(state, goal.id)}</span>
            </div>
            <div class="rd-goal-card__body">
                <div class="rd-goal-card__top">
                    <input
                        class="rd-input rd-input--inline rd-goal-card__title"
                        type="text"
                        aria-label="Goal name"
                        value={goal.title}
                        readOnly
                    />
                    <span class="rd-goal-card__count rd-text-small">{plural(epics, "epic")}</span>
                </div>
                <textarea
                    class="rd-input rd-input--inline rd-goal-card__desc"
                    aria-label="Goal description"
                    rows={1}
                    value={goal.desc}
                    readOnly
                />
                {items.length > 0 &&
                    (showIssues ? (
                        <ul class="rd-plan-list">
                            {items.map((entry: PlanEntry) => {
                                const { num, title } = itemTitle(entry);
                                return (
                                    <li class="rd-plan-item" data-kind={entry.kind} data-num={entry.num} key={`${entry.kind}${entry.num}`}>
                                        {entry.kind === "epic" && <span class="rd-glyph rd-glyph--epic" aria-hidden="true" />}
                                        <span class="rd-ref">
                                            <span class="rd-ref__num">#{num}</span>
                                            <span class="rd-ref__title">{title}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p class="rd-goal-card__summary rd-text-small">
                            {plural(inits, "initiative")}, {plural(own, "epic")} planned
                        </p>
                    ))}
                {items.length === 0 && (
                    <div class="rd-goal-card__drop rd-text-small">Drop an epic or initiative here to plan it</div>
                )}
            </div>
        </article>
    );
}

interface GroomingProps {
    session: SessionStore;
    state: SessionState;
    showIssues: boolean;
    onShowIssues: (value: boolean) => void;
}

export function GroomingPage({ session, state, showIssues, onShowIssues }: GroomingProps): VNode {
    const planned: number = plannedEpicCount(INITIATIVES, state);
    return (
        <section class="rd-groom" aria-labelledby="rd-groom-title">
            <header class="rd-groom__header">
                <div>
                    <div class="rd-text-axis rd-groom__eyebrow">
                        Grooming · {GROOMING_SPRINT.name} · {GROOMING_SPRINT.dates}
                    </div>
                    <h1 class="rd-text-view-title" id="rd-groom-title">
                        Backlog grooming
                    </h1>
                    <p class="rd-groom__instruction">
                        Drag an epic or an initiative onto a goal to plan it. Drag goals to set their priority.
                    </p>
                </div>
                <div class="rd-groom__actions">
                    <div class="rd-groom__sum">
                        <b class="rd-groom__summary">{`${planned} of ${totalEpics(INITIATIVES)} epics planned`}</b>
                        <span class="rd-groom__save-state">All changes saved</span>
                    </div>
                    <button type="button" class="rd-btn rd-btn--primary">
                        Save plan
                    </button>
                </div>
            </header>
            <div class="rd-groom__panels">
                <Backlog state={state} session={session} />
                <section class="rd-panel rd-goals" aria-labelledby="rd-goals-title">
                    <div class="rd-panel__head">
                        <h2 class="rd-text-axis" id="rd-goals-title">
                            Goals
                        </h2>
                        <div class="rd-goals__tools">
                            <span class="rd-panel__sub">In priority order</span>
                            <label class="rd-switch">
                                <input
                                    class="rd-switch__input"
                                    type="checkbox"
                                    role="switch"
                                    checked={showIssues}
                                    onChange={(e) => onShowIssues((e.currentTarget as HTMLInputElement).checked)}
                                />
                                <span>Show issues</span>
                            </label>
                        </div>
                    </div>
                    <div class="rd-goals__list">
                        {state.goals.map((goal: Goal) => (
                            <GoalCard state={state} goal={goal} showIssues={showIssues} key={goal.id} />
                        ))}
                    </div>
                </section>
            </div>
        </section>
    );
}
