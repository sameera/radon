// The Grooming sync (D1, story #85). Raiden's backend reads the repository's milestones and
// sprints from GitHub as the signed-in lead, updates Raiden's records and returns them. The page
// sends only the repository's owner and name: no issue data goes to the backend (G7).
import type { GitHubResult } from "@raiden/shared";
import type { GitHubGateway } from "./gateway.ts";
import type { Repo } from "./repo.tsx";
import { isRecord } from "./backlogload.ts";

export const SYNC_PATH: string = "/grooming/sync";
const NAME_PART: RegExp = /^[A-Za-z0-9_.-]+$/;

// A sprint record. `field` and `iteration` are GitHub's identities for a synced sprint, which the
// backlog matches each issue's iteration value against (D6).
export interface Sprint {
    id: string;
    field: string;
    iteration: string;
    name: string;
    // Calendar dates, "YYYY-MM-DD". `end` is the sprint's last day.
    start: string;
    end: string;
    // Synced from GitHub, or Raiden-owned.
    synced: boolean;
}

export interface Milestone {
    id: string;
    number: number;
    title: string;
    // GitHub's due moment, or null when the milestone has none.
    due: string | null;
    description: string;
    state: string;
    synced: boolean;
}

export interface SyncSource {
    project: string;
    field: string;
}

export type SyncCause = "signed-out" | "cannot-read" | "rate-limit" | "cannot-read-project" | "backend-unavailable" | "other";

export type SyncLoad =
    | { ok: true; source: SyncSource | null; sprints: Sprint[]; milestones: Milestone[] }
    | { ok: false; cause: SyncCause };

function causeOf(result: GitHubResult & { ok: false }): SyncCause {
    switch (result.kind) {
        case "sign-in-needed":
            return "signed-out";
        case "permission":
            return result.reason === "project-unreadable" ? "cannot-read-project" : "cannot-read";
        case "rate-limit":
            return "rate-limit";
        default:
            return "backend-unavailable";
    }
}

const str = (v: unknown): v is string => typeof v === "string";

function readSprint(v: unknown): Sprint | null {
    if (!isRecord(v) || !str(v.id) || !str(v.name) || !str(v.start) || !str(v.end)) {
        return null;
    }
    return {
        id: v.id,
        field: str(v.field) ? v.field : "",
        iteration: str(v.iteration) ? v.iteration : "",
        name: v.name,
        start: v.start,
        end: v.end,
        synced: v.origin === "github",
    };
}

function readMilestone(v: unknown): Milestone | null {
    if (!isRecord(v) || !str(v.id) || typeof v.number !== "number" || !str(v.title) || !str(v.state)) {
        return null;
    }
    if (v.due !== null && v.due !== undefined && v.due !== "" && !str(v.due)) {
        return null;
    }
    return {
        id: v.id,
        number: v.number,
        title: v.title,
        due: str(v.due) && v.due !== "" ? v.due : null,
        description: str(v.description) ? v.description : "",
        state: v.state,
        synced: v.origin === "github",
    };
}

// Runs one Grooming sync for the repository. Any unreadable part of the answer fails the sync.
export async function syncGrooming(gateway: GitHubGateway, repo: Repo): Promise<SyncLoad> {
    if (!NAME_PART.test(repo.owner) || !NAME_PART.test(repo.name)) {
        return { ok: false, cause: "other" };
    }
    let result: GitHubResult;
    try {
        result = await gateway.request({ to: "backend", path: SYNC_PATH, method: "POST", body: { owner: repo.owner, name: repo.name } });
    } catch {
        return { ok: false, cause: "backend-unavailable" };
    }
    if (!result.ok) {
        return { ok: false, cause: causeOf(result) };
    }
    const body: unknown = result.body;
    if (!isRecord(body) || !Array.isArray(body.sprints) || !Array.isArray(body.milestones)) {
        return { ok: false, cause: "other" };
    }
    let source: SyncSource | null = null;
    if (isRecord(body.source)) {
        if (!str(body.source.project) || !str(body.source.field)) {
            return { ok: false, cause: "other" };
        }
        source = { project: body.source.project, field: body.source.field };
    } else if (body.source !== null && body.source !== undefined) {
        return { ok: false, cause: "other" };
    }
    const sprints: (Sprint | null)[] = body.sprints.map(readSprint);
    const milestones: (Milestone | null)[] = body.milestones.map(readMilestone);
    if (sprints.includes(null) || milestones.includes(null)) {
        return { ok: false, cause: "other" };
    }
    return { ok: true, source, sprints: sprints as Sprint[], milestones: milestones as Milestone[] };
}
