// The one source of sample data. The data epics replace this module's contents with data read
// from GitHub and the Raiden backend; nothing else changes.
export const PROJECT_NAME: string = "Raiden roadmap";

export interface SprintInfo {
    current: string;
    daysLeft: number;
    next: { name: string; dates: string };
}

export const SPRINT: SprintInfo = {
    current: "Sprint 14",
    daysLeft: 7,
    next: { name: "Sprint 15", dates: "Dec 1 – Dec 12" },
};

export const GROOMING_SPRINT: { name: string; dates: string } = SPRINT.next;

export interface Epic {
    num: number;
    title: string;
}
export interface Initiative {
    num: number;
    title: string;
    epics: Epic[];
}
export interface Goal {
    id: string;
    title: string;
    desc: string;
}
export type ItemKind = "epic" | "init";
export interface PlanEntry {
    kind: ItemKind;
    num: number;
    goal: string;
}

export const INITIATIVES: Initiative[] = [
    {
        num: 12,
        title: "Sprint planning in Projects",
        epics: [
            { num: 31, title: "Sprint goal card" },
            { num: 34, title: "Goal review at sprint end" },
        ],
    },
    {
        num: 13,
        title: "Hierarchical timeline",
        epics: [
            { num: 40, title: "Epic and story bars" },
            { num: 41, title: "Blocked-by lines" },
            { num: 42, title: "Today line and current sprint" },
        ],
    },
    {
        num: 14,
        title: "Self-hosted install",
        epics: [
            { num: 50, title: "Extension packaging" },
            { num: 51, title: "GitHub token setup" },
        ],
    },
    {
        num: 15,
        title: "Nexus pipeline signals",
        epics: [
            { num: 60, title: "needs-design marker on epics" },
            { num: 61, title: "Decision record status on stories" },
        ],
    },
];

export const GOALS: Goal[] = [
    {
        id: "g1",
        title: "Pilot team plans its next sprint from Raiden",
        desc: "One team sets a sprint goal and picks its epics without leaving GitHub.",
    },
    {
        id: "g2",
        title: "Teams install Raiden without help",
        desc: "A new team goes from download to first view in under 10 minutes.",
    },
    {
        id: "g3",
        title: "Nexus status shows in every view",
        desc: "Epics and stories show whether their design is approved.",
    },
];

// Shows a planned epic (31), a planned initiative (14), partly planned initiatives (12, 13, 15),
// an epic planned apart from its initiative (50) and a goal with no items (g3).
export const STARTING_PLAN: PlanEntry[] = [
    { kind: "epic", num: 31, goal: "g1" },
    { kind: "epic", num: 40, goal: "g1" },
    { kind: "epic", num: 50, goal: "g1" },
    { kind: "init", num: 14, goal: "g2" },
    { kind: "epic", num: 60, goal: "g2" },
];
