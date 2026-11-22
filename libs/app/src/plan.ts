import { GOALS, INITIATIVES, STARTING_PLAN, type Goal, type Initiative, type ItemKind, type PlanEntry } from "./sample.ts";

export type { Goal, Initiative, ItemKind, PlanEntry };

// All Grooming data for one visit. Every label, count and rank on the page is derived from it.
// An item has at most one own plan: an entry in `plan`.
export interface Snapshot {
    goals: Goal[];
    plan: PlanEntry[];
}

export interface SessionState {
    goals: Goal[];
    plan: PlanEntry[];
    collapsed: number[];
    nextId: number;
    // The earlier plans, newest last. One entry per plan change that really changed the plan.
    undo: Snapshot[];
    // The plan at page load, or at the last Save plan.
    saved: Snapshot;
    // The goal field being typed in. Typing in it keeps updating one undo entry.
    editing: string | null;
}

export function initialState(): SessionState {
    const goals: Goal[] = GOALS.map((g: Goal) => ({ ...g }));
    const plan: PlanEntry[] = STARTING_PLAN.map((p: PlanEntry) => ({ ...p }));
    return { goals, plan, collapsed: [], nextId: GOALS.length + 1, undo: [], saved: { goals, plan }, editing: null };
}

export function snapshotOf(state: SessionState): Snapshot {
    return { goals: state.goals, plan: state.plan };
}

// The order of plan entries carries no meaning. The order of goals is their rank.
function samePlan(a: Snapshot, b: Snapshot): boolean {
    const key = (p: PlanEntry): string => `${p.kind}${p.num}:${p.goal}`;
    const entries = (x: Snapshot): string => x.plan.map(key).sort().join(",");
    return JSON.stringify(a.goals) === JSON.stringify(b.goals) && entries(a) === entries(b);
}

// Unsaved means the plan differs from the saved plan.
export function hasUnsaved(state: SessionState): boolean {
    return !samePlan(snapshotOf(state), state.saved);
}

// Applies one plan edit. An edit that changes nothing returns the same state: no undo entry and
// no change to the save state. `field` names a text field: typing in it is one undo entry.
export function applyChange(state: SessionState, next: SessionState, field: string | null = null): SessionState {
    if (next.goals === state.goals && next.plan === state.plan) {
        return next === state ? state : { ...next, undo: state.undo, saved: state.saved, editing: state.editing };
    }
    const keep: boolean = field !== null && state.editing === field;
    return {
        ...next,
        undo: keep ? state.undo : [...state.undo, snapshotOf(state)],
        saved: state.saved,
        editing: field,
    };
}

// Puts back the newest earlier plan. The saved plan, the view state and the goal counter stay.
export function undoLast(state: SessionState): SessionState {
    const previous: Snapshot | undefined = state.undo.at(-1);
    return previous ? { ...state, ...previous, undo: state.undo.slice(0, -1), editing: null } : state;
}

export function savePlan(state: SessionState): SessionState {
    return { ...state, saved: snapshotOf(state) };
}

export function ownGoal(state: SessionState, kind: ItemKind, num: number): string | null {
    return state.plan.find((p: PlanEntry) => p.kind === kind && p.num === num)?.goal ?? null;
}

// An epic's own plan overrides its initiative's goal.
export function effectiveGoal(initiatives: Initiative[], state: SessionState, epicNum: number): string | null {
    const own: string | null = ownGoal(state, "epic", epicNum);
    if (own !== null) {
        return own;
    }
    const parent: Initiative | undefined = initiatives.find((i: Initiative) =>
        i.epics.some((e) => e.num === epicNum),
    );
    return parent ? ownGoal(state, "init", parent.num) : null;
}

export function totalEpics(initiatives: Initiative[]): number {
    return initiatives.reduce((n: number, i: Initiative) => n + i.epics.length, 0);
}

export function plannedEpicCount(initiatives: Initiative[], state: SessionState): number {
    return initiatives.reduce(
        (n: number, i: Initiative) =>
            n + i.epics.filter((e) => effectiveGoal(initiatives, state, e.num) !== null).length,
        0,
    );
}

// The epics that are not planned in any goal, with the same rule as the header count.
export function unplannedEpicCount(initiatives: Initiative[], state: SessionState): number {
    return totalEpics(initiatives) - plannedEpicCount(initiatives, state);
}

// Each epic counts once, under its effective goal.
export function goalEpicCount(initiatives: Initiative[], state: SessionState, goalId: string): number {
    return initiatives.reduce(
        (n: number, i: Initiative) =>
            n + i.epics.filter((e) => effectiveGoal(initiatives, state, e.num) === goalId).length,
        0,
    );
}

export function initiativeEpicsPlanned(initiatives: Initiative[], state: SessionState, init: Initiative): number {
    return init.epics.filter((e) => effectiveGoal(initiatives, state, e.num) !== null).length;
}

export function goalItems(state: SessionState, goalId: string): PlanEntry[] {
    return state.plan.filter((p: PlanEntry) => p.goal === goalId);
}

export function goalRank(state: SessionState, goalId: string): number {
    return state.goals.findIndex((g: Goal) => g.id === goalId) + 1;
}

export function toggleCollapsed(state: SessionState, initNum: number): SessionState {
    const collapsed: number[] = state.collapsed.includes(initNum)
        ? state.collapsed.filter((n: number) => n !== initNum)
        : [...state.collapsed, initNum];
    return { ...state, collapsed };
}

function parentOf(initiatives: Initiative[], epicNum: number): Initiative | undefined {
    return initiatives.find((i: Initiative) => i.epics.some((e) => e.num === epicNum));
}

// Whether planning the item in the goal would change anything.
export function canPlanIn(
    initiatives: Initiative[],
    state: SessionState,
    kind: ItemKind,
    num: number,
    goalId: string,
): boolean {
    const current: string | null =
        kind === "epic" ? effectiveGoal(initiatives, state, num) : ownGoal(state, "init", num);
    return current !== goalId;
}

// Planning an item in a goal removes its own plan anywhere else. An epic planned in its
// initiative's goal needs no plan of its own. Returns the same state when nothing changes.
export function planItem(
    initiatives: Initiative[],
    state: SessionState,
    kind: ItemKind,
    num: number,
    goalId: string,
): SessionState {
    if (!canPlanIn(initiatives, state, kind, num, goalId)) {
        return state;
    }
    const rest: PlanEntry[] = state.plan.filter((p: PlanEntry) => !(p.kind === kind && p.num === num));
    const parent: Initiative | undefined = kind === "epic" ? parentOf(initiatives, num) : undefined;
    if (parent && ownGoal(state, "init", parent.num) === goalId) {
        return { ...state, plan: rest };
    }
    return { ...state, plan: [...rest, { kind, num, goal: goalId }] };
}

// Whether the item has a plan of its own to take out. The item menu and the backlog drop both
// use this rule.
export function canTakeOut(state: SessionState, kind: ItemKind, num: number): boolean {
    return ownGoal(state, kind, num) !== null;
}

// Takes the item's own plan out. An epic then falls back to its initiative's goal, if any.
export function unplanItem(state: SessionState, kind: ItemKind, num: number): SessionState {
    return { ...state, plan: state.plan.filter((p: PlanEntry) => !(p.kind === kind && p.num === num)) };
}

export function addGoal(state: SessionState): SessionState {
    const goal: Goal = { id: `g${state.nextId}`, title: "", desc: "" };
    return { ...state, goals: [...state.goals, goal], nextId: state.nextId + 1 };
}

export function setGoalText(state: SessionState, id: string, text: Partial<Pick<Goal, "title" | "desc">>): SessionState {
    return { ...state, goals: state.goals.map((g: Goal) => (g.id === id ? { ...g, ...text } : g)) };
}

export function canMoveGoal(state: SessionState, id: string, delta: -1 | 1): boolean {
    const at: number = state.goals.findIndex((g: Goal) => g.id === id);
    return at >= 0 && at + delta >= 0 && at + delta < state.goals.length;
}

export function moveGoalBy(state: SessionState, id: string, delta: -1 | 1): SessionState {
    if (!canMoveGoal(state, id, delta)) {
        return state;
    }
    const at: number = state.goals.findIndex((g: Goal) => g.id === id);
    return moveGoalNextTo(state, id, state.goals[at + delta]!.id, delta < 0 ? "before" : "after");
}

// Places a goal just before or just after another one. Returns the same state when the order
// would not change.
export function moveGoalNextTo(state: SessionState, id: string, targetId: string, side: "before" | "after"): SessionState {
    if (id === targetId) {
        return state;
    }
    const moved: Goal | undefined = state.goals.find((g: Goal) => g.id === id);
    const rest: Goal[] = state.goals.filter((g: Goal) => g.id !== id);
    const at: number = rest.findIndex((g: Goal) => g.id === targetId);
    if (!moved || at < 0) {
        return state;
    }
    const goals: Goal[] = [...rest.slice(0, side === "before" ? at : at + 1), moved, ...rest.slice(side === "before" ? at : at + 1)];
    return goals.every((g: Goal, i: number) => g.id === state.goals[i]!.id) ? state : { ...state, goals };
}

// Removes the goal and the own plans in it. Items planned on their own in other goals stay.
export function deleteGoal(state: SessionState, id: string): SessionState {
    return {
        ...state,
        goals: state.goals.filter((g: Goal) => g.id !== id),
        plan: state.plan.filter((p: PlanEntry) => p.goal !== id),
    };
}

// The filter matches part of a title or of an issue number, ignoring letter case and a leading
// "#". A matching initiative keeps all its epics. Otherwise only its matching epics stay, so a
// matching epic still shows under its initiative.
export function filterBacklog(initiatives: Initiative[], text: string): Initiative[] {
    const needle: string = text.trim().replace(/^#/, "").toLowerCase();
    if (needle === "") {
        return initiatives;
    }
    const hit = (item: { num: number; title: string }): boolean =>
        item.title.toLowerCase().includes(needle) || String(item.num).includes(needle);
    return initiatives.flatMap((init: Initiative) => {
        if (hit(init)) {
            return [init];
        }
        const epics = init.epics.filter(hit);
        return epics.length > 0 ? [{ ...init, epics }] : [];
    });
}
