// Places each backlog issue in its sprint's band (D6, D7, story #89).
import type { VNode } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { buildTree, filterTree, type LiveIssue, type TreeNode } from "./backlogload.ts";
import { flattenBand, groupItems, moveItem, orderItems, type ListItem } from "./backloglist.ts";
import { List, type Side } from "./livebacklog.tsx";
import type { Sprint, SyncSource } from "./groomingsync.ts";
import type { Repo } from "./repo.tsx";

// The sprint of an issue: its iteration value on the sync source's field, matched to a sprint by
// identity. No value, a value on another field or project, or one with no sprint gives null.
export function sprintOf(issue: LiveIssue, sprints: Map<string, Sprint>, source: SyncSource | null): Sprint | null {
    if (!source) {
        return null;
    }
    const value = issue.iterations?.find((v) => v.project === source.project && v.field === source.field);
    return value ? (sprints.get(`${value.field}#${value.iteration}`) ?? null) : null;
}

// Each query issue's band key: the sprint's id, or null for no sprint.
export function assignBands(issues: LiveIssue[], sprints: Sprint[], source: SyncSource | null): Map<string, string | null> {
    const bySprint: Map<string, Sprint> = new Map(sprints.filter((s) => s.synced).map((s) => [`${s.field}#${s.iteration}`, s]));
    const out: Map<string, string | null> = new Map();
    for (const issue of issues) {
        if (issue.inQuery) {
            out.set(issue.id, sprintOf(issue, bySprint, source)?.id ?? null);
        }
    }
    return out;
}

// Each query issue's shown band (story #114, D1, D4, D7): Raiden's sprint when Raiden holds one,
// the no-sprint mark included, and otherwise its GitHub sprint. An assignment to a sprint the page
// does not hold is ignored, and the row follows GitHub.
export function shownBands(github: Map<string, string | null>, sprints: Sprint[], assignments: Map<string, string | null>): Map<string, string | null> {
    const known: Set<string> = new Set(sprints.map((s) => s.id));
    const out: Map<string, string | null> = new Map(github);
    for (const id of github.keys()) {
        if (!assignments.has(id)) {
            continue;
        }
        const raiden: string | null = assignments.get(id)!;
        if (raiden === null || known.has(raiden)) {
            out.set(id, raiden);
        }
    }
    return out;
}

interface BandRowsProps {
    issues: LiveIssue[];
    // The band's key in the assignment map.
    band: string | null;
    assigned: Map<string, string | null>;
    filter: string;
    order: string[] | null;
    onOrder: (ids: string[]) => void;
    current: Repo | null;
    // Set for editors: rows can be dragged onto another band (story #114, D8).
    onDragRow?: (id: string | null) => void;
    // The unsynced-with-GitHub flag's words, by issue identity (story #115).
    flags?: Map<string, string>;
    // Set for editors: Alt+Shift moves a row to the neighbouring band (story #116).
    onShift?: (id: string, by: -1 | 1) => void;
}

// The identities of a band's rows in the order they show, without a filter.
export function bandIds(issues: LiveIssue[], assigned: Map<string, string | null>, band: string | null, order: string[] | null): string[] {
    const inBand = (issue: LiveIssue): boolean => issue.inQuery && assigned.get(issue.id) === band;
    const tree: TreeNode[] = buildTree(issues.map((i) => (i.inQuery && !inBand(i) ? { ...i, inQuery: false, elsewhere: true } : i)));
    return orderItems(flattenBand(tree, inBand), order).map((item: ListItem) => item.issue.id);
}

// One band's rows in today's list form, limited to the band's issues (D7, G21, G25).
export function BandRows({ issues, band, assigned, filter, order, onOrder, current, onDragRow, flags, onShift }: BandRowsProps): VNode | null {
    const inBand = (issue: LiveIssue): boolean => issue.inQuery && assigned.get(issue.id) === band;
    const tree: TreeNode[] = useMemo(
        () => buildTree(issues.map((i) => (i.inQuery && !inBand(i) ? { ...i, inQuery: false, elsewhere: true } : i))),
        [issues, assigned, band],
    );
    const all: ListItem[] = useMemo(() => orderItems(flattenBand(tree, inBand), order), [tree, order]);
    const shown: ListItem[] = useMemo(() => orderItems(flattenBand(filterTree(tree, filter), inBand), order), [tree, filter, order]);
    // After a keyboard move, focus returns to the moved row, which may now sit in a new group.
    const ref = useRef<HTMLDivElement>(null);
    const [refocus, setRefocus] = useState<string | null>(null);
    useEffect(() => {
        if (refocus !== null) {
            ref.current?.querySelector<HTMLElement>(`.rd-lb-row[data-id="${CSS.escape(refocus)}"] .rd-ref`)?.focus();
            setRefocus(null);
        }
    }, [refocus, shown]);
    if (shown.length === 0) {
        return null;
    }
    const move = (id: string, target: string, side: Side): void => onOrder(moveItem(all, id, target, side));
    const step = (id: string, by: -1 | 1): void => {
        const at: number = shown.findIndex((i) => i.issue.id === id);
        const target: ListItem | undefined = shown[at + by];
        if (at >= 0 && target) {
            move(id, target.issue.id, by < 0 ? "before" : "after");
            setRefocus(id);
        }
    };
    return (
        <div class="rd-band__list" ref={ref}>
            <List groups={groupItems(shown)} current={current} onStep={step} onDragRow={onDragRow} flags={flags} onShift={onShift} />
        </div>
    );
}
