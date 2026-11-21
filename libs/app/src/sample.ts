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
