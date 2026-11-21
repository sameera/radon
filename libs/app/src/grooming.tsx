import type { VNode } from "preact";
import { useRef, useState } from "preact/hooks";
import { ChevronIcon } from "./icons.tsx";
import {
    canPlanIn,
    effectiveGoal,
    goalEpicCount,
    goalItems,
    goalRank,
    initiativeEpicsPlanned,
    ownGoal,
    planItem,
    plannedEpicCount,
    toggleCollapsed,
    unplanItem,
    totalEpics,
    type Goal,
    type Initiative,
    type ItemKind,
    type PlanEntry,
    type SessionState,
} from "./plan.ts";
import { GROOMING_SPRINT, INITIATIVES } from "./sample.ts";
import type { SessionStore } from "./session.ts";

// What is being dragged. It is tracked here, never in the drag data, so only drags that started
// inside the Raiden page are accepted. `from` is the goal the item is planned in, or null when
// the drag started in the backlog.
export interface Drag {
    kind: ItemKind;
    num: number;
    from: string | null;
}

export type DropTarget = "backlog" | string;

interface DragApi {
    drag: Drag | null;
    over: DropTarget | null;
    start(e: DragEvent, drag: Drag): void;
    end(): void;
    zone(target: DropTarget, accepts: boolean, onDrop: () => void): Record<string, unknown>;
}

function isDragged(d: Drag | null, kind: ItemKind, num: number, from: string | null): boolean {
    return d !== null && d.kind === kind && d.num === num && d.from === from;
}

function plural(n: number, one: string, many: string = `${one}s`): string {
    return `${n} ${n === 1 ? one : many}`;
}

function goalLabel(state: SessionState, goalId: string | null): string {
    return goalId === null ? "" : `Goal ${goalRank(state, goalId)}`;
}

interface BacklogProps {
    state: SessionState;
    session: SessionStore;
    dnd: DragApi;
}

function Backlog({ state, session, dnd }: BacklogProps): VNode {
    const total: number = totalEpics(INITIATIVES);
    const d: Drag | null = dnd.drag;
    // Only an item dragged out of a goal, with a plan of its own, can be dropped here.
    const accepts: boolean = d !== null && d.from !== null && ownGoal(state, d.kind, d.num) !== null;
    return (
        <section
            class={`rd-panel rd-backlog${dnd.over === "backlog" ? " is-over" : ""}`}
            aria-labelledby="rd-backlog-title"
            {...dnd.zone("backlog", accepts, () => {
                if (d) {
                    session.update((s) => unplanItem(s, d.kind, d.num));
                }
            })}
        >
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
                            <div
                                class={`rd-bl-row rd-bl-row--init${own !== null ? " is-planned" : ""}${isDragged(d, "init", init.num, null) ? " is-dragged" : ""}`}
                                draggable={true}
                                onDragStart={(e: DragEvent) => dnd.start(e, { kind: "init", num: init.num, from: null })}
                                onDragEnd={dnd.end}
                            >
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
                                            class={`rd-bl-row rd-bl-row--epic rd-bl-epic${eff !== null ? " is-planned" : ""}${isDragged(d, "epic", epic.num, null) ? " is-dragged" : ""}`}
                                            data-num={epic.num}
                                            draggable={true}
                                            onDragStart={(e: DragEvent) => dnd.start(e, { kind: "epic", num: epic.num, from: null })}
                                            onDragEnd={dnd.end}
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
    session: SessionStore;
    goal: Goal;
    showIssues: boolean;
    dnd: DragApi;
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

function GoalCard({ state, session, goal, showIssues, dnd }: GoalCardProps): VNode {
    const d: Drag | null = dnd.drag;
    const accepts: boolean = d !== null && canPlanIn(INITIATIVES, state, d.kind, d.num, goal.id);
    const items: PlanEntry[] = goalItems(state, goal.id);
    const epics: number = goalEpicCount(INITIATIVES, state, goal.id);
    const inits: number = items.filter((i) => i.kind === "init").length;
    const own: number = items.filter((i) => i.kind === "epic").length;
    return (
        <article
            class={`rd-goal-card${dnd.over === goal.id ? " is-over" : ""}`}
            data-goal={goal.id}
            {...dnd.zone(goal.id, accepts, () => {
                if (d) {
                    session.update((s) => planItem(INITIATIVES, s, d.kind, d.num, goal.id));
                }
            })}
        >
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
                                    <li
                                        class={`rd-plan-item${isDragged(d, entry.kind, entry.num, goal.id) ? " is-dragged" : ""}`}
                                        data-kind={entry.kind}
                                        data-num={entry.num}
                                        key={`${entry.kind}${entry.num}`}
                                        draggable={true}
                                        onDragStart={(e: DragEvent) => dnd.start(e, { kind: entry.kind, num: entry.num, from: goal.id })}
                                        onDragEnd={dnd.end}
                                    >
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
    const dnd: DragApi = useDnd();
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
                <Backlog state={state} session={session} dnd={dnd} />
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
                            <GoalCard state={state} session={session} goal={goal} showIssues={showIssues} dnd={dnd} key={goal.id} />
                        ))}
                    </div>
                </section>
            </div>
        </section>
    );
}

const DRAG_TYPE: string = "application/x-raiden";

// The browser's own drag events. A target accepts a drag only while it can use it: it calls
// preventDefault on dragover only then, and is highlighted only then.
function useDnd(): DragApi {
    const ref = useRef<Drag | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [over, setOver] = useState<DropTarget | null>(null);
    const clear = (): void => {
        ref.current = null;
        setDrag(null);
        setOver(null);
    };
    return {
        drag,
        over,
        start(e: DragEvent, next: Drag): void {
            e.stopPropagation();
            ref.current = next;
            setDrag(next);
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData(DRAG_TYPE, "item");
            }
        },
        end: clear,
        zone(target: DropTarget, accepts: boolean, onDrop: () => void): Record<string, unknown> {
            return {
                onDragOver(e: DragEvent): void {
                    if (!ref.current || !accepts) {
                        return;
                    }
                    e.preventDefault();
                    if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = "move";
                    }
                    setOver(target);
                },
                onDragLeave(e: DragEvent): void {
                    const into: Node | null = e.relatedTarget as Node | null;
                    if (!into || !(e.currentTarget as Node).contains(into)) {
                        setOver((current) => (current === target ? null : current));
                    }
                },
                onDrop(e: DragEvent): void {
                    if (!ref.current || !accepts) {
                        return;
                    }
                    e.preventDefault();
                    onDrop();
                    clear();
                },
            };
        },
    };
}
