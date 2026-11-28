// The current sprint and its progress (D10, story #91). Progress counts every issue of the
// repository whose iteration on the sync source is the current sprint, open and closed, read
// through the gateway from the source project's items. The read is complete or fails the load.
import type { GitHubGateway } from "./gateway.ts";
import { graphql, isRecord, LoadFailed, type BacklogCause } from "./backlogload.ts";
import type { Sprint, SyncSource } from "./groomingsync.ts";
import type { Repo } from "./repo.tsx";

export interface Progress {
    sprint: string;
    closed: number;
    total: number;
}

// Today's local calendar date, "YYYY-MM-DD".
export function localToday(now: Date = new Date()): string {
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The sprint whose dates include today. When several do, the earliest start wins.
export function currentSprint(sprints: Sprint[], today: string): Sprint | null {
    const open: Sprint[] = sprints
        .filter((s) => s.start <= today && today <= s.end)
        .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id));
    return open[0] ?? null;
}

const PROGRESS: string = `query Progress($project: ID!, $cursor: String) {
  node(id: $project) {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          content { ... on Issue { state repository { nameWithOwner } } }
          fieldValues(first: 50) {
            pageInfo { hasNextPage }
            nodes { ... on ProjectV2ItemFieldIterationValue { iterationId field { ... on ProjectV2IterationField { id } } } }
          }
        }
      }
    }
  }
}`;
const MAX_PAGES: number = 200;

export type ProgressLoad = { ok: true; progress: Progress } | { ok: false; cause: BacklogCause };

export async function loadProgress(gateway: GitHubGateway, repo: Repo, source: SyncSource, sprint: Sprint): Promise<ProgressLoad> {
    const name: string = `${repo.owner}/${repo.name}`.toLowerCase();
    let closed: number = 0;
    let total: number = 0;
    try {
        let cursor: string | null = null;
        for (let page = 0; ; page++) {
            if (page >= MAX_PAGES) {
                throw new LoadFailed("other");
            }
            const { data } = await graphql(gateway, PROGRESS, { project: source.project, cursor });
            const items: unknown = isRecord(data.node) ? data.node.items : undefined;
            if (!isRecord(items) || !isRecord(items.pageInfo) || !Array.isArray(items.nodes)) {
                throw new LoadFailed(data.node === null ? "cannot-read" : "other");
            }
            for (const item of items.nodes) {
                if (!isRecord(item) || !isRecord(item.fieldValues) || !isRecord(item.fieldValues.pageInfo) || !Array.isArray(item.fieldValues.nodes)) {
                    throw new LoadFailed("other");
                }
                if (item.fieldValues.pageInfo.hasNextPage !== false) {
                    throw new LoadFailed("other");
                }
                const content: unknown = item.content;
                if (!isRecord(content) || !isRecord(content.repository) || typeof content.repository.nameWithOwner !== "string") {
                    continue;
                }
                if (content.repository.nameWithOwner.toLowerCase() !== name) {
                    continue;
                }
                const inSprint: boolean = item.fieldValues.nodes.some(
                    (v: unknown) => isRecord(v) && v.iterationId === sprint.iteration && isRecord(v.field) && v.field.id === source.field,
                );
                if (inSprint) {
                    total++;
                    if (content.state === "CLOSED") {
                        closed++;
                    }
                }
            }
            if (items.pageInfo.hasNextPage !== true) {
                break;
            }
            if (typeof items.pageInfo.endCursor !== "string") {
                throw new LoadFailed("other");
            }
            cursor = items.pageInfo.endCursor;
        }
    } catch (error) {
        return { ok: false, cause: error instanceof LoadFailed ? error.cause : "other" };
    }
    return { ok: true, progress: { sprint: sprint.id, closed, total } };
}
