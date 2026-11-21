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
