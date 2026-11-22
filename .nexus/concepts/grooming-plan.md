---
title: Grooming Plan
aliases: [grooming page, sprint goals plan, backlog planning, item menu, keyboard planning]
touches: [raiden-app-shell, raiden-page-host, grooming-undo-save, grooming-backlog-view]
last_updated_by: "#8"
status: active
verification: verified
---

# Grooming Plan

The Grooming page lets a lead plan the next sprint on sample data. A backlog panel lists initiatives with their epics. A goals panel lists the sprint goals in priority order. The lead drags items into goals and reorders goals, or does the same from a keyboard menu.

## How It Works

All initiatives, epics, goals, the starting plan and the sprint dates come from one sample-data source. Raiden reads nothing from GitHub in this version. Plan edits stay in one session state kept in memory and reset on reload. Every count, label and rank on the page is derived from that state.

An item has at most one own plan. An epic's own plan overrides its initiative's goal. Every count uses each epic's effective goal, so an epic counts once. Taking an epic's own plan out leaves it in its initiative's goal when that initiative is planned. Dropping an item on the goal it is already in changes nothing. Deleting a goal removes only the own plans in it. Ranks are the goals' positions from 1 to n.

Items and goals move with the browser's own drag and drop. A dragged item is tracked inside the page, and the drag carries only a marker. Drags that started outside Raiden are ignored. A goal dropped on another goal goes before or after it, by the half the pointer is over. Move up and Move down in the goal menu change the same order. Goals can be added, edited and deleted.

Each backlog item has a menu that lists the goals its drop would be accepted on, and "Take out of plan" when the backlog would accept it. Drops, menus, buttons and goal fields all apply their edits through one change path.

## Key Invariants

1. Each epic counts once, under its effective goal.
2. An item has at most one own plan.
3. A drag that started outside Raiden never changes the plan.
4. No control sends a network request, and issue numbers are plain text, not links.
5. The session state survives a remount and is lost on reload.
6. Goal ranks are always the goals' positions, from 1 to n.
7. A menu action changes the plan exactly as the matching drag and drop does.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the shell shows Grooming as its first page and supplies the preference store that keeps the Show issues choice.
- [raiden-page-host](raiden-page-host.md) — the host opens Grooming on every load of the Raiden address.
- [grooming-undo-save](grooming-undo-save.md) — every plan change goes through the change path, which records the undo list and refreshes the save state.
- [grooming-backlog-view](grooming-backlog-view.md) — the backlog filter and width change what the backlog shows, never the plan.

## Decision Log

### 2026-11-21 — #3 — Own plans and an effective goal per epic, on sample data
One in-memory session state holds the plan, and an epic's own plan overrides its initiative's goal. The reference mockup counts an epic planned apart from its initiative in both goals, and this decision counts it once. Items move with the browser's own drag and drop. The drag data is only a marker, so text or files dragged in from GitHub cannot change the plan. All data comes from one replaceable sample source, and no control sends a network request. Refuted alternative: add a "left out of the initiative" state so the original wording holds for every epic. Neither the backlog nor the goal card could show "initiative planned except this epic".

### 2026-11-22 — #8 — Menu entries come from the drop rules and use the same plan changes
Story #17 asks that a menu action change the plan exactly as the same drag and drop would. The item menu's entries are computed from the drop rules, and each entry makes the same plan change as the matching drop, so the two cannot drift. A planned row inside a goal card gets a "Take out of plan" button, which makes the same change as dragging the row to the backlog. Move up and Move down reach every goal order one step at a time, through the same goal-move change a goal drop uses. Both Grooming menus share one keyboard behaviour that stays in the page, because only Grooming uses menus today. The design system's popup menu guideline gains the keyboard rules. Refuted alternative: write the menu as its own handlers that call the planning logic directly, as the mockup does. It is quicker to write, but the menu's enabled entries and the drop targets' rules would be two copies that drift.
