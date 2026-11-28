import type { VNode } from "preact";
import { PHOSPHOR_PATHS } from "./phosphorpaths.ts";

export type WorkItemKind = "milestone" | "initiative" | "epic" | "decision" | "story" | "bug" | "task";

const NAMES: Record<string, WorkItemKind> = {
    milestone: "milestone",
    milestones: "milestone",
    initiative: "initiative",
    initiatives: "initiative",
    epic: "epic",
    epics: "epic",
    "decision record": "decision",
    "decision records": "decision",
    decision: "decision",
    story: "story",
    stories: "story",
    bug: "bug",
    bugs: "bug",
    task: "task",
    tasks: "task",
};

function kindOf(name: string): WorkItemKind | null {
    return NAMES[name.trim().toLowerCase().replace(/^type\s*[:/]\s*/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ")] ?? null;
}

// GitHub's issue type is authoritative. Teams that classify with labels can use the same names.
export function workItemKind(issueType: string | null, labels: string[]): WorkItemKind | null {
    if (issueType !== null) {
        const kind = kindOf(issueType);
        if (kind !== null) return kind;
    }
    for (const label of labels) {
        const kind = kindOf(label);
        if (kind !== null) return kind;
    }
    return null;
}

export function WorkItemIcon({ kind }: { kind: WorkItemKind | null }): VNode {
    const paths = kind === "milestone" ? PHOSPHOR_PATHS.FlagPennant
        : kind === "initiative" ? PHOSPHOR_PATHS.Compass
        : kind === "epic" ? PHOSPHOR_PATHS.Stack
        : kind === "decision" ? PHOSPHOR_PATHS.Signature
        : kind === "story" ? PHOSPHOR_PATHS.Blueprint
        : kind === "bug" ? PHOSPHOR_PATHS.BugBeetle
        : kind === "task" ? PHOSPHOR_PATHS.CheckSquareOffset
        : PHOSPHOR_PATHS.File;
    return <svg viewBox="0 0 256 256" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d={paths[0]} opacity="0.2" />
        <path d={paths[1]} />
    </svg>;
}
