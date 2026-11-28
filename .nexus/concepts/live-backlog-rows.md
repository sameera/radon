---
title: Live Backlog Rows
aliases: [live backlog rows, outside parent, parent crumb, open issues hierarchy, backlog row order]
touches: [live-backlog, grooming-sprint-bands, grooming-github-links]
last_updated_by: "#81"
status: active
verification: verified
---

# Live Backlog Rows

The live backlog shows each loaded issue once as a row, under a crumb of its parent issues. A parent the query did not return shows grayed out in the crumb. A live row can be moved with the keyboard, but it is never dragged, planned or labelled with a goal.

## How It Works

Rows are a list in issue-number order, each group under a crumb of its parents, and the filter works at every level. A parent the query did not return is grayed and says that it is outside the query and what its state is. A parent in another repository shows its repository name.

In the band view, each band lists only its own issues. A parent in the same band is a row, and its children are indented under it. A parent in another band shows only in the crumb.

Alt+Up and Alt+Down move a row one place. The lead's order stays in page memory, kept with the repository and the person it was made for, and it never plans an item.

## Key Invariants

1. Every issue the query returns appears exactly once as a row, in the band of its sprint, under the chain of parents GitHub records for it. A parent in another band or outside the query shows only as a crumb.
2. An issue that is neither returned by the query nor above a returned issue never appears.
3. A live backlog row can be neither dragged, given an item menu, nor labelled with a goal.

## Integration Points

- [live-backlog](live-backlog.md) — the rows show the issues and parent chains the live backlog load returns, only after that load succeeded.
- [grooming-sprint-bands](grooming-sprint-bands.md) — each band's backlog column lists the rows of that band's issues.
- [grooming-github-links](grooming-github-links.md) — each row's reference links to the issue's page in the issue's own repository.

## Decision Log

### 2026-11-28 — #81 — split from live-backlog
The record's rewrite of live-backlog invariant 1 put that page over the 400-word cap, so how the loaded issues show as rows moved here, and the load stayed on live-backlog. Invariants 1, 2 and 7 of live-backlog are this page's invariants 1, 2 and 3, with invariant 1 in its rewritten form. Band rows keep the list and crumb form, so each issue sits in exactly one band. Live rows lose drag but keep Alt+Up and Alt+Down moves, because the invariant forbids dragging a live row, not moving it. Refuted alternative: remove all reordering of live rows. It is simpler, but it takes away a keyboard move the invariant never forbade.
