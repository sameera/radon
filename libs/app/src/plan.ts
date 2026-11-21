import { GOALS, INITIATIVES, STARTING_PLAN, type Goal, type Initiative, type ItemKind, type PlanEntry } from "./sample.ts";

export type { Goal, Initiative, ItemKind, PlanEntry };

// All Grooming data for one visit. Every label, count and rank on the page is derived from it.
// An item has at most one own plan: an entry in `plan`.
export interface SessionState {
    goals: Goal[];
    plan: PlanEntry[];
    collapsed: number[];
    nextId: number;
}

export function initialState(): SessionState {
    return {
        goals: GOALS.map((g: Goal) => ({ ...g })),
        plan: STARTING_PLAN.map((p: PlanEntry) => ({ ...p })),
        collapsed: [],
        nextId: GOALS.length + 1,
    };
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

// Takes the item's own plan out. An epic then falls back to its initiative's goal, if any.
export function unplanItem(state: SessionState, kind: ItemKind, num: number): SessionState {
    return { ...state, plan: state.plan.filter((p: PlanEntry) => !(p.kind === kind && p.num === num)) };
}
