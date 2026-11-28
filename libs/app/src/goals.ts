// The goal write (story #103, D5, D6, D7). Raiden's backend saves or clears one sprint's goal in
// its own store. Nothing is written to GitHub (G17).
import type { GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "./gateway.ts";
import type { Repo } from "./repo.tsx";

export const GOAL_PATH: string = "/grooming/goal";
// The longest goal Raiden accepts, in characters. The backend enforces it too (G7).
export const GOAL_CAP: number = 200;

export type GoalCause = "not-allowed" | "backend-unavailable" | "other";
export type GoalSave = { ok: true } | { ok: false; cause: GoalCause };

// A goal is one line of plain text: line breaks become spaces, the ends are trimmed, and the text
// stops at the cap.
export function normalizeGoal(text: string): string {
    return Array.from(text.replace(/[\r\n]+/g, " ").trim()).slice(0, GOAL_CAP).join("").trim();
}

function causeOf(result: GitHubResult & { ok: false }): GoalCause {
    switch (result.kind) {
        case "permission":
            return "not-allowed";
        case "network":
            return "backend-unavailable";
        default:
            return "other";
    }
}

// Saves `text` as the sprint's goal, or clears it when the text is empty. The repository and sprint
// are fixed when the write starts, so it lands where it was typed (G12).
export async function saveGoal(gateway: GitHubGateway, repo: Repo, sprint: string, text: string): Promise<GoalSave> {
    let result: GitHubResult;
    try {
        result = await gateway.request({ to: "backend", path: GOAL_PATH, method: "POST", body: { owner: repo.owner, name: repo.name, sprint, text } });
    } catch {
        return { ok: false, cause: "backend-unavailable" };
    }
    return result.ok ? { ok: true } : { ok: false, cause: causeOf(result) };
}

export const CAUSE_TEXT: Record<GoalCause, string> = {
    "not-allowed": "You are not allowed to edit this repository's goals.",
    "backend-unavailable": "Raiden's backend is unavailable.",
    other: "Something went wrong.",
};
