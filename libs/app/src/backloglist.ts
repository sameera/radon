// The live backlog as a flat list. Each issue at the end of a chain is one item. Its ancestors
// show above it on a small header row. Items next to each other with the same parent share one
// header, so the header repeats when the lead moves an item away from its siblings.
import type { LiveIssue, TreeNode } from "./backlogload.ts";

// One item: the issue, and its ancestors from the top of the chain down to its parent.
export interface ListItem {
    issue: LiveIssue;
    chain: LiveIssue[];
    // Rows above it in the same band: a band row under a band row is indented (D7).
    depth?: number;
}

// A band's items (D7): every issue in the band is a row, indented under a band row above it. An
// ancestor outside the band shows only as a crumb in the chain above its group.
export function flattenBand(tree: TreeNode[], inBand: (issue: LiveIssue) => boolean, chain: LiveIssue[] = [], depth: number = 0): ListItem[] {
    const out: ListItem[] = [];
    for (const node of tree) {
        if (inBand(node.issue)) {
            out.push({ issue: node.issue, chain, depth });
            out.push(...flattenBand(node.children, inBand, chain, depth + 1));
        } else {
            out.push(...flattenBand(node.children, inBand, [...chain, node.issue], depth));
        }
    }
    return out;
}

// A run of items with the same parent. `chain` is empty for items at the top.
export interface ListGroup {
    chain: LiveIssue[];
    items: ListItem[];
}

// The items in the lead's order. Items the order does not name keep their tree order, after the
// named ones.
export function orderItems(items: ListItem[], order: string[] | null): ListItem[] {
    if (order === null) {
        return items;
    }
    const at: Map<string, number> = new Map(order.map((id, i) => [id, i]));
    const rank = (item: ListItem): number => at.get(item.issue.id) ?? order.length;
    return items
        .map((item, i) => ({ item, i }))
        .sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i)
        .map((x) => x.item);
}

function parentId(item: ListItem): string | null {
    return item.chain.length > 0 ? item.chain[item.chain.length - 1]!.id : null;
}

// Splits the list into groups. Items at the top never share a group.
export function groupItems(items: ListItem[]): ListGroup[] {
    const out: ListGroup[] = [];
    for (const item of items) {
        const last: ListGroup | undefined = out[out.length - 1];
        const parent: string | null = parentId(item);
        if (last && parent !== null && parentId(last.items[0]!) === parent) {
            last.items.push(item);
        } else {
            out.push({ chain: item.chain, items: [item] });
        }
    }
    return out;
}

// The full order after moving `id` next to `target`. `items` is the full list in its current
// order, so a move made while filtering keeps the hidden items where they were.
export function moveItem(items: ListItem[], id: string, target: string, side: "before" | "after"): string[] {
    const ids: string[] = items.map((i) => i.issue.id).filter((x) => x !== id);
    const at: number = ids.indexOf(target);
    if (at < 0 || id === target) {
        return items.map((i) => i.issue.id);
    }
    ids.splice(side === "before" ? at : at + 1, 0, id);
    return ids;
}
