import { describe, expect, it } from "vitest";
import {
    effectiveGoal,
    goalEpicCount,
    goalItems,
    goalRank,
    initialState,
    initiativeEpicsPlanned,
    plannedEpicCount,
    toggleCollapsed,
    totalEpics,
} from "./plan.ts";
import { INITIATIVES } from "./sample.ts";

const state = initialState();

describe("starting sample plan", () => {
    it("shows every state the page can be in", () => {
        // a planned epic, a planned initiative, a partly planned initiative,
        // an epic planned apart from its initiative, and a goal with no items
        expect(state.plan).toContainEqual({ kind: "epic", num: 31, goal: "g1" });
        expect(state.plan).toContainEqual({ kind: "init", num: 14, goal: "g2" });
        expect(state.plan).toContainEqual({ kind: "epic", num: 50, goal: "g1" });
        expect(goalItems(state, "g3")).toEqual([]);
        expect(initiativeEpicsPlanned(INITIATIVES, state, INITIATIVES[0]!)).toBe(1);
    });
});

describe("effective goal", () => {
    it("is the epic's own goal, else its initiative's goal, else none", () => {
        expect(effectiveGoal(INITIATIVES, state, 31)).toBe("g1");
        expect(effectiveGoal(INITIATIVES, state, 51)).toBe("g2");
        expect(effectiveGoal(INITIATIVES, state, 34)).toBeNull();
    });
    it("lets an epic's own plan override its initiative's goal", () => {
        expect(effectiveGoal(INITIATIVES, state, 50)).toBe("g1");
    });
});

describe("counts", () => {
    it("count each epic once, in the goal it is actually planned in", () => {
        expect(totalEpics(INITIATIVES)).toBe(9);
        expect(plannedEpicCount(INITIATIVES, state)).toBe(5);
        expect(goalEpicCount(INITIATIVES, state, "g1")).toBe(3);
        expect(goalEpicCount(INITIATIVES, state, "g2")).toBe(2);
        expect(goalEpicCount(INITIATIVES, state, "g3")).toBe(0);
        const sum: number = state.goals.reduce((n, g) => n + goalEpicCount(INITIATIVES, state, g.id), 0);
        expect(sum).toBe(plannedEpicCount(INITIATIVES, state));
    });
    it("counts planned epics of a partly planned initiative", () => {
        const counts: number[] = INITIATIVES.map((i) => initiativeEpicsPlanned(INITIATIVES, state, i));
        expect(counts).toEqual([1, 1, 2, 1]);
    });
});

describe("goals", () => {
    it("rank is the position from 1 to n", () => {
        expect(state.goals.map((g) => goalRank(state, g.id))).toEqual([1, 2, 3]);
    });
    it("lists the items planned on their own, in the order they were planned", () => {
        expect(goalItems(state, "g1").map((i) => `${i.kind}:${i.num}`)).toEqual(["epic:31", "epic:40", "epic:50"]);
    });
});

describe("collapsed initiatives", () => {
    it("toggles", () => {
        const hidden = toggleCollapsed(state, 13);
        expect(hidden.collapsed).toEqual([13]);
        expect(toggleCollapsed(hidden, 13).collapsed).toEqual([]);
        expect(state.collapsed).toEqual([]);
    });
});

import { canTakeOut, planItem, unplanItem } from "./plan.ts";

const eff = (s: ReturnType<typeof initialState>, n: number) => effectiveGoal(INITIATIVES, s, n);

describe("planning an item in a goal", () => {
    it("plans an unplanned epic", () => {
        const s = planItem(INITIATIVES, state, "epic", 34, "g3");
        expect(eff(s, 34)).toBe("g3");
        expect(goalItems(s, "g3").map((i) => i.num)).toEqual([34]);
    });
    it("moves a planned item to a different goal and removes it from the first", () => {
        const s = planItem(INITIATIVES, state, "epic", 31, "g2");
        expect(goalItems(s, "g1").map((i) => i.num)).toEqual([40, 50]);
        expect(goalItems(s, "g2").map((i) => i.num)).toContain(31);
        expect(s.plan.filter((p) => p.kind === "epic" && p.num === 31).length).toBe(1);
    });
    it("plans an epic whose initiative is planned elsewhere on its own, and the initiative stays", () => {
        const s = planItem(INITIATIVES, state, "epic", 51, "g1");
        expect(eff(s, 51)).toBe("g1");
        expect(goalItems(s, "g2").some((i) => i.kind === "init" && i.num === 14)).toBe(true);
    });
    it("changes nothing when the item is already effectively in that goal", () => {
        expect(planItem(INITIATIVES, state, "epic", 51, "g2")).toBe(state);
        expect(planItem(INITIATIVES, state, "epic", 31, "g1")).toBe(state);
        expect(planItem(INITIATIVES, state, "init", 14, "g2")).toBe(state);
    });
    it("drops the epic's own plan when it moves to its initiative's goal", () => {
        const s = planItem(INITIATIVES, state, "epic", 50, "g2");
        expect(eff(s, 50)).toBe("g2");
        expect(s.plan.some((p) => p.kind === "epic" && p.num === 50)).toBe(false);
    });
    it("keeps counting each epic once", () => {
        const s = planItem(INITIATIVES, planItem(INITIATIVES, state, "init", 13, "g3"), "epic", 41, "g1");
        expect(eff(s, 40)).toBe("g1");
        expect(eff(s, 41)).toBe("g1");
        expect(eff(s, 42)).toBe("g3");
        const sum: number = s.goals.reduce((n, g) => n + goalEpicCount(INITIATIVES, s, g.id), 0);
        expect(sum).toBe(plannedEpicCount(INITIATIVES, s));
    });
});

describe("when an item can be taken out of the plan", () => {
    it("holds only for an item with a plan of its own", () => {
        expect(canTakeOut(state, "epic", 31)).toBe(true);
        expect(canTakeOut(state, "init", 14)).toBe(true);
        expect(canTakeOut(state, "epic", 9999)).toBe(false);
        // an epic covered only by its initiative's goal has no plan of its own
        expect(canTakeOut(unplanItem(state, "epic", 31), "epic", 31)).toBe(false);
    });
});

describe("taking an item's own plan out", () => {
    it("leaves an epic unplanned when its initiative is not planned", () => {
        expect(eff(unplanItem(state, "epic", 31), 31)).toBeNull();
    });
    it("leaves an epic in its initiative's goal when that initiative is planned", () => {
        expect(eff(unplanItem(state, "epic", 50), 50)).toBe("g2");
    });
    it("unplans an initiative and leaves epics planned on their own where they are", () => {
        const s = unplanItem(state, "init", 14);
        expect(eff(s, 51)).toBeNull();
        expect(eff(s, 50)).toBe("g1");
    });
});

import { addGoal, canMoveGoal, deleteGoal, moveGoalBy, moveGoalNextTo, setGoalText } from "./plan.ts";

const ids = (s: ReturnType<typeof initialState>): string[] => s.goals.map((g) => g.id);
const ranks = (s: ReturnType<typeof initialState>): number[] => s.goals.map((g) => goalRank(s, g.id));

describe("adding, naming and ordering goals", () => {
    it("adds an empty goal last with a new id", () => {
        const s = addGoal(state);
        expect(s.goals.length).toBe(4);
        const added = s.goals[3]!;
        expect(added).toMatchObject({ title: "", desc: "" });
        expect(new Set(ids(s)).size).toBe(4);
        expect(goalItems(s, added.id)).toEqual([]);
        expect(ranks(s)).toEqual([1, 2, 3, 4]);
        expect(ids(addGoal(addGoal(state)))).toHaveLength(5);
        expect(new Set(ids(addGoal(addGoal(state)))).size).toBe(5);
    });
    it("keeps edited text", () => {
        const s = setGoalText(state, "g2", { title: "New name" });
        expect(s.goals[1]).toMatchObject({ title: "New name", desc: state.goals[1]!.desc });
        expect(setGoalText(s, "g2", { desc: "More" }).goals[1]).toMatchObject({ title: "New name", desc: "More" });
    });
    it("moves a goal one position up or down", () => {
        expect(ids(moveGoalBy(state, "g2", -1))).toEqual(["g2", "g1", "g3"]);
        expect(ids(moveGoalBy(state, "g2", 1))).toEqual(["g1", "g3", "g2"]);
        expect(ranks(moveGoalBy(state, "g2", -1))).toEqual([1, 2, 3]);
    });
    it("cannot move the first goal up or the last goal down", () => {
        expect(canMoveGoal(state, "g1", -1)).toBe(false);
        expect(canMoveGoal(state, "g3", 1)).toBe(false);
        expect(canMoveGoal(state, "g2", -1)).toBe(true);
        expect(moveGoalBy(state, "g1", -1)).toBe(state);
        expect(moveGoalBy(state, "g3", 1)).toBe(state);
    });
    it("places a goal before or after another goal", () => {
        expect(ids(moveGoalNextTo(state, "g3", "g1", "before"))).toEqual(["g3", "g1", "g2"]);
        expect(ids(moveGoalNextTo(state, "g1", "g2", "after"))).toEqual(["g2", "g1", "g3"]);
        expect(ids(moveGoalNextTo(state, "g1", "g3", "after"))).toEqual(["g2", "g3", "g1"]);
        expect(moveGoalNextTo(state, "g2", "g1", "after")).toBe(state);
        expect(moveGoalNextTo(state, "g1", "g1", "before")).toBe(state);
    });
});

describe("deleting a goal", () => {
    it("returns the items planned on their own in it to the backlog", () => {
        const s = deleteGoal(state, "g1");
        expect(ids(s)).toEqual(["g2", "g3"]);
        expect(eff(s, 31)).toBeNull();
        expect(eff(s, 40)).toBeNull();
    });
    it("leaves epics planned on their own in other goals where they are", () => {
        const s = deleteGoal(state, "g2");
        expect(eff(s, 50)).toBe("g1");
        expect(eff(s, 51)).toBeNull();
        expect(eff(s, 60)).toBeNull();
        expect(ranks(s)).toEqual([1, 2]);
    });
    it("leaves no plan entry pointing at a missing goal", () => {
        const s = deleteGoal(state, "g1");
        expect(s.plan.every((p) => ids(s).includes(p.goal))).toBe(true);
    });
});
