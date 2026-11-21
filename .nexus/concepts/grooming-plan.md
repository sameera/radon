---
title: Grooming Plan
aliases: [grooming page, sprint goals plan, backlog planning]
touches: [raiden-app-shell, raiden-page-host]
last_updated_by: "#3"
status: active
verification: verified
---

# Grooming Plan

The Grooming page lets a lead plan the next sprint on sample data. A backlog panel lists initiatives with their epics. A goals panel lists the sprint goals in priority order. The lead drags items into goals and reorders goals.

## How It Works

All initiatives, epics, goals, the starting plan and the sprint dates come from one sample-data source. Raiden reads nothing from GitHub in this version. Plan edits stay in one session state kept in memory and reset on reload. Every count, label and rank on the page is derived from that state.

An item has at most one own plan. An epic's own plan overrides its initiative's goal. Every count uses each epic's effective goal, so an epic counts once. Taking an epic's own plan out leaves it in its initiative's goal when that initiative is planned. Dropping an item on the goal it is already in changes nothing. Deleting a goal removes only the own plans in it. Ranks are the goals' positions from 1 to n.

Items and goals move with the browser's own drag and drop. A dragged item is tracked inside the page, and the drag carries only a marker. Drags that started outside Raiden are ignored. A goal dropped on another goal goes before or after it, by the half the pointer is over. Move up and Move down in the goal menu change the same order. Goals can be added, edited and deleted.

## Key Invariants

1. Each epic counts once, under its effective goal.
2. An item has at most one own plan.
3. A drag that started outside Raiden never changes the plan.
4. No control sends a network request, and issue numbers are plain text, not links.
5. The session state survives a remount and is lost on reload.
6. Goal ranks are always the goals' positions, from 1 to n.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the shell shows Grooming as its first page and supplies the preference store that keeps the Show issues choice.
- [raiden-page-host](raiden-page-host.md) — the host opens Grooming on every load of the Raiden address.

## Decision Log

### 2026-11-21 — #3 — Own plans and an effective goal per epic, on sample data
One in-memory session state holds the plan, and an epic's own plan overrides its initiative's goal. The reference mockup counts an epic planned apart from its initiative in both goals, and this decision counts it once. Items move with the browser's own drag and drop. The drag data is only a marker, so text or files dragged in from GitHub cannot change the plan. All data comes from one replaceable sample source, and no control sends a network request. Refuted alternative: add a "left out of the initiative" state so the original wording holds for every epic. Neither the backlog nor the goal card could show "initiative planned except this epic".
