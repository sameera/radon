import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ChevronIcon, GripIcon, MoreIcon, PlusIcon } from "./icons.tsx";
import {
    addGoal,
    canMoveGoal,
    canPlanIn,
    deleteGoal,
    filterBacklog,
    effectiveGoal,
    goalEpicCount,
    goalItems,
    goalRank,
    initiativeEpicsPlanned,
    moveGoalBy,
    moveGoalNextTo,
    ownGoal,
    planItem,
    plannedEpicCount,
    setGoalText,
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
export type Drag = { type: "item"; kind: ItemKind; num: number; from: string | null } | { type: "goal"; id: string };

export type DropTarget = "backlog" | string;
type Side = "before" | "after";

interface DragApi {
    drag: Drag | null;
    over: { target: DropTarget; side: Side } | null;
    start(e: DragEvent, drag: Drag): void;
    end(): void;
    zone(target: DropTarget, accepts: boolean, onDrop: (side: Side) => void): Record<string, unknown>;
}

function isDragged(d: Drag | null, kind: ItemKind, num: number, from: string | null): boolean {
    return d !== null && d.type === "item" && d.kind === kind && d.num === num && d.from === from;
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
    filter: string;
    onFilter: (text: string) => void;
    width: number;
}

function Backlog({ state, session, dnd, filter, onFilter, width }: BacklogProps): VNode {
    const shown: Initiative[] = filterBacklog(INITIATIVES, filter);
    const filtering: boolean = filter.trim() !== "";
    const total: number = totalEpics(INITIATIVES);
    const d: Drag | null = dnd.drag;
    // Only an item dragged out of a goal, with a plan of its own, can be dropped here.
    const accepts: boolean =
        d !== null && d.type === "item" && d.from !== null && ownGoal(state, d.kind, d.num) !== null;
    return (
        <section
            class={`rd-panel rd-backlog${dnd.over?.target === "backlog" ? " is-over" : ""}`}
            style={{ flexBasis: `${width}px` }}
            aria-labelledby="rd-backlog-title"
            {...dnd.zone("backlog", accepts, () => {
                if (d?.type === "item") {
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
                {shown.length === 0 && (
                    <p class="rd-backlog__empty rd-text-small">
                        No initiatives or epics match. Clear the filter to show them all.
                    </p>
                )}
                {shown.map((init: Initiative) => {
                    // While filtering, matches show open. Each initiative's own setting stays.
                    const open: boolean = filtering || !state.collapsed.includes(init.num);
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
                                onDragStart={(e: DragEvent) => dnd.start(e, { type: "item", kind: "init", num: init.num, from: null })}
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
                                            onDragStart={(e: DragEvent) => dnd.start(e, { type: "item", kind: "epic", num: epic.num, from: null })}
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
    menuOpen: boolean;
    onMenu: (open: boolean) => void;
    focus: boolean;
    onFocused: () => void;
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

function GoalCard({ state, session, goal, showIssues, dnd, menuOpen, onMenu, focus, onFocused }: GoalCardProps): VNode {
    const d: Drag | null = dnd.drag;
    const accepts: boolean =
        d !== null &&
        (d.type === "item" ? canPlanIn(INITIATIVES, state, d.kind, d.num, goal.id) : d.id !== goal.id);
    const items: PlanEntry[] = goalItems(state, goal.id);
    const epics: number = goalEpicCount(INITIATIVES, state, goal.id);
    const inits: number = items.filter((i) => i.kind === "init").length;
    const own: number = items.filter((i) => i.kind === "epic").length;
    const titleRef = useRef<HTMLInputElement>(null);
    const descRef = useRef<HTMLTextAreaElement>(null);
    const cardRef = useRef<HTMLElement>(null);
    const over = dnd.over?.target === goal.id ? dnd.over : null;
    const goalDrag: boolean = d?.type === "goal";
    const reorderable: boolean = state.goals.length > 1;

    useEffect(() => {
        if (focus) {
            titleRef.current?.focus();
            onFocused();
        }
    }, [focus]);
    // The description grows to fit its text.
    useEffect(() => {
        const el: HTMLTextAreaElement | null = descRef.current;
        if (el) {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
        }
    }, [goal.desc]);

    const pick = (change: () => void): void => {
        onMenu(false);
        change();
    };
    return (
        <article
            ref={cardRef}
            class={`rd-goal-card${over ? " is-over" : ""}${over && goalDrag ? ` insert-${over.side}` : ""}${d?.type === "goal" && d.id === goal.id ? " is-dragged" : ""}`}
            data-goal={goal.id}
            {...dnd.zone(goal.id, accepts, (side: Side) => {
                if (d?.type === "item") {
                    session.update((s) => planItem(INITIATIVES, s, d.kind, d.num, goal.id));
                } else if (d?.type === "goal") {
                    session.update((s) => moveGoalNextTo(s, d.id, goal.id, side));
                }
            })}
        >
            <div class="rd-goal-card__rail">
                <span class="rd-goal-card__rank rd-text-body-strong">{goalRank(state, goal.id)}</span>
                <span
                    class="rd-goal-card__grip"
                    role="img"
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                    draggable={reorderable}
                    onDragStart={(e: DragEvent) => {
                        if (cardRef.current && e.dataTransfer && typeof e.dataTransfer.setDragImage === "function") {
                            e.dataTransfer.setDragImage(cardRef.current, 0, 0);
                        }
                        dnd.start(e, { type: "goal", id: goal.id });
                    }}
                    onDragEnd={dnd.end}
                >
                    <GripIcon />
                </span>
            </div>
            <div class="rd-goal-card__body">
                <div class="rd-goal-card__top">
                    <input
                        ref={titleRef}
                        class="rd-input rd-input--inline rd-goal-card__title"
                        type="text"
                        aria-label="Goal name"
                        placeholder="Name this goal"
                        value={goal.title}
                        onInput={(e) => {
                            const title: string = (e.currentTarget as HTMLInputElement).value;
                            session.update((s) => setGoalText(s, goal.id, { title }));
                        }}
                    />
                    <span class="rd-goal-card__count rd-text-small">{plural(epics, "epic")}</span>
                    <div class="rd-goal-card__menu-wrap">
                        <button
                            type="button"
                            class="rd-icon-btn"
                            aria-label="Goal options"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={() => onMenu(!menuOpen)}
                        >
                            <MoreIcon />
                        </button>
                        {menuOpen && (
                            <div class="rd-menu" role="menu" aria-label="Goal options">
                                <button
                                    type="button"
                                    role="menuitem"
                                    class="rd-menu__item"
                                    disabled={!canMoveGoal(state, goal.id, -1)}
                                    onClick={() => pick(() => session.update((s) => moveGoalBy(s, goal.id, -1)))}
                                >
                                    Move up
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    class="rd-menu__item"
                                    disabled={!canMoveGoal(state, goal.id, 1)}
                                    onClick={() => pick(() => session.update((s) => moveGoalBy(s, goal.id, 1)))}
                                >
                                    Move down
                                </button>
                                <div class="rd-menu__sep" role="separator" />
                                <button
                                    type="button"
                                    role="menuitem"
                                    class="rd-menu__item rd-menu__item--danger"
                                    onClick={() => pick(() => session.update((s) => deleteGoal(s, goal.id)))}
                                >
                                    Delete goal
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <textarea
                    ref={descRef}
                    class="rd-input rd-input--inline rd-goal-card__desc"
                    aria-label="Goal description"
                    placeholder="Describe the outcome"
                    rows={1}
                    value={goal.desc}
                    onInput={(e) => {
                        const desc: string = (e.currentTarget as HTMLTextAreaElement).value;
                        session.update((s) => setGoalText(s, goal.id, { desc }));
                    }}
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
                                        onDragStart={(e: DragEvent) => dnd.start(e, { type: "item", kind: entry.kind, num: entry.num, from: goal.id })}
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
    backlogWidth?: number;
    onBacklogWidth?: (value: number, final: boolean) => void;
}

export const DEFAULT_BACKLOG_WIDTH: number = 360;
const MIN_BACKLOG: number = 240;
const MIN_GOALS: number = 360;
const DIVIDER_WIDTH: number = 16;
const FALLBACK_MAX: number = 720;
const STEP: number = 16;
const BIG_STEP: number = 64;

// The preferred width is the lead's choice. The shown width is that choice fitted between the
// two panels' minimum widths at the current size.
function limits(space: number): { min: number; max: number } {
    return { min: MIN_BACKLOG, max: space > 0 ? Math.max(MIN_BACKLOG, space - MIN_GOALS - DIVIDER_WIDTH) : FALLBACK_MAX };
}
function fit(preferred: number, space: number): number {
    const { min, max } = limits(space);
    return Math.min(max, Math.max(min, preferred));
}

interface DividerProps {
    width: number;
    min: number;
    max: number;
    onChange: (value: number, final: boolean) => void;
}

function Divider({ width, min, max, onChange }: DividerProps): VNode {
    const drag = useRef<{ x: number; width: number } | null>(null);
    const clamp = (v: number): number => Math.min(max, Math.max(min, v));
    return (
        <div
            class="rd-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize backlog"
            aria-valuenow={width}
            aria-valuemin={min}
            aria-valuemax={max}
            tabIndex={0}
            onPointerDown={(e: PointerEvent) => {
                drag.current = { x: e.clientX, width };
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e: PointerEvent) => {
                if (drag.current) {
                    onChange(clamp(drag.current.width + e.clientX - drag.current.x), false);
                }
            }}
            onPointerUp={(e: PointerEvent) => {
                if (drag.current) {
                    onChange(clamp(drag.current.width + e.clientX - drag.current.x), true);
                    drag.current = null;
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                }
            }}
            onDblClick={() => onChange(clamp(DEFAULT_BACKLOG_WIDTH), true)}
            onKeyDown={(e: KeyboardEvent) => {
                const step: number = e.shiftKey ? BIG_STEP : STEP;
                const next: number | null =
                    e.key === "ArrowLeft"
                        ? width - step
                        : e.key === "ArrowRight"
                          ? width + step
                          : e.key === "Home"
                            ? min
                            : e.key === "End"
                              ? max
                              : e.key === "Enter"
                                ? DEFAULT_BACKLOG_WIDTH
                                : null;
                if (next !== null) {
                    e.preventDefault();
                    onChange(clamp(next), true);
                }
            }}
        />
    );
}

export function GroomingPage({
    session,
    state,
    showIssues,
    onShowIssues,
    backlogWidth = DEFAULT_BACKLOG_WIDTH,
    onBacklogWidth,
}: GroomingProps): VNode {
    const [filter, setFilter] = useState<string>("");
    const panelsRef = useRef<HTMLDivElement>(null);
    const [space, setSpace] = useState<number>(0);
    useEffect(() => {
        const measure = (): void => setSpace(panelsRef.current?.getBoundingClientRect().width ?? 0);
        measure();
        window.addEventListener("resize", measure);
        const observer: ResizeObserver | null =
            typeof ResizeObserver === "function" && panelsRef.current ? new ResizeObserver(measure) : null;
        if (observer && panelsRef.current) {
            observer.observe(panelsRef.current);
        }
        return () => {
            window.removeEventListener("resize", measure);
            observer?.disconnect();
        };
    }, []);
    const shownWidth: number = fit(backlogWidth, space);
    const { min: minWidth, max: maxWidth } = limits(space);
    const planned: number = plannedEpicCount(INITIATIVES, state);
    const dnd: DragApi = useDnd();
    const [menu, setMenu] = useState<string | null>(null);
    const [focusId, setFocusId] = useState<string | null>(null);
    useEffect(() => {
        if (menu === null) {
            return;
        }
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                setMenu(null);
            }
        };
        const onClick = (e: MouseEvent): void => {
            const inside: boolean = e.composedPath().some(
                (n) => n instanceof HTMLElement && n.classList.contains("rd-goal-card__menu-wrap"),
            );
            if (!inside) {
                setMenu(null);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("click", onClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("click", onClick);
        };
    }, [menu]);
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
            <div class="rd-groom__panels" ref={panelsRef}>
                <Backlog
                    state={state}
                    session={session}
                    dnd={dnd}
                    filter={filter}
                    onFilter={setFilter}
                    width={shownWidth}
                />
                <Divider
                    width={shownWidth}
                    min={minWidth}
                    max={maxWidth}
                    onChange={(value: number, final: boolean) => onBacklogWidth?.(value, final)}
                />
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
                            <GoalCard
                                state={state}
                                session={session}
                                goal={goal}
                                showIssues={showIssues}
                                dnd={dnd}
                                menuOpen={menu === goal.id}
                                onMenu={(open: boolean) => setMenu(open ? goal.id : null)}
                                focus={focusId === goal.id}
                                onFocused={() => setFocusId(null)}
                                key={goal.id}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        class="rd-btn rd-btn--ghost rd-goals__add"
                        onClick={() => {
                            setFocusId(`g${state.nextId}`);
                            session.update(addGoal);
                        }}
                    >
                        <PlusIcon />
                        Add goal
                    </button>
                </section>
            </div>
        </section>
    );
}

const DRAG_TYPE: string = "application/x-raiden";

function sideOf(e: DragEvent): Side {
    const rect: DOMRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

// The browser's own drag events. A target accepts a drag only while it can use it: it calls
// preventDefault on dragover only then, and is highlighted only then.
function useDnd(): DragApi {
    const ref = useRef<Drag | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [over, setOver] = useState<DragApi["over"]>(null);
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
                e.dataTransfer.setData(DRAG_TYPE, next.type);
            }
        },
        end: clear,
        zone(target: DropTarget, accepts: boolean, onDrop: (side: Side) => void): Record<string, unknown> {
            return {
                onDragOver(e: DragEvent): void {
                    if (!ref.current || !accepts) {
                        return;
                    }
                    e.preventDefault();
                    if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = "move";
                    }
                    const side: Side = sideOf(e);
                    setOver((current) => (current?.target === target && current.side === side ? current : { target, side }));
                },
                onDragLeave(e: DragEvent): void {
                    const into: Node | null = e.relatedTarget as Node | null;
                    if (!into || !(e.currentTarget as Node).contains(into)) {
                        setOver((current) => (current?.target === target ? null : current));
                    }
                },
                onDrop(e: DragEvent): void {
                    if (!ref.current || !accepts) {
                        return;
                    }
                    e.preventDefault();
                    onDrop(sideOf(e));
                    clear();
                },
            };
        },
    };
}
