---
title: Grooming Plan
aliases: [grooming page, sprint goals plan, backlog planning]
touches: [grooming-undo-save, grooming-plan-moves]
last_updated_by: "#82"
status: deprecated
verification: verified
---

# Grooming Plan

The Grooming page lets a lead plan the next sprint. For a signed-in person, the band view shows each sprint as a band, with the goal column on the left and the repository's open issues in the backlog column on the right. Otherwise, a backlog panel lists sample initiatives with their epics, and a goals panel lists the sample sprint goals in priority order, where the lead places items into goals.

## How It Works

On the sample page, the goals, the starting plan, the sprint dates and the sample backlog come from one sample-data source. For a signed-in lead, sprints and milestones come from Raiden's records. The live backlog reads GitHub and changes no plan state. Plan controls send no request. Plan edits stay in one session state kept in memory and reset on reload. Every count, label and rank on the page is derived from that state.

An item has at most one own plan. An epic's own plan overrides its initiative's goal. Every count uses each epic's effective goal, so an epic counts once. Taking an epic's own plan out leaves it in its initiative's goal when that initiative is planned. Dropping an item on the goal it is already in changes nothing. Deleting a goal removes only the own plans in it. Ranks are the goals' positions from 1 to n.

Goals can be added, edited and deleted. Drops, menus, buttons and goal fields all apply their edits through one change path.

## Key Invariants

1. Each epic counts once, under its effective goal.
2. An item has at most one own plan.
3. ~~A drag that started outside Raiden never changes the plan.~~ Moved with the split.
4. ~~No control makes Raiden send a network request. Issue numbers and the New initiative in GitHub link are plain links that open GitHub in a new tab, and the Grooming page and its plan stay as they were.~~ Retired: Try again on the live backlog reads GitHub. Link behaviour is held by grooming-github-links invariants 1 and 3.
5. The session state survives a remount and is lost on reload.
6. Goal ranks are always the goals' positions, from 1 to n.
7. ~~A menu action changes the plan exactly as the matching drag and drop does.~~ Moved with the split.

## Integration Points

- [grooming-undo-save](grooming-undo-save.md) — every plan change goes through the change path, which records the undo list and refreshes the save state.
- [grooming-plan-moves](grooming-plan-moves.md) — drag and drop, the item menus and the Take out of plan button change the plan through its one change path.

## Decision Log

### 2026-11-21 — #3 — Own plans and an effective goal per epic, on sample data
One in-memory session state holds the plan, and an epic's own plan overrides its initiative's goal. The reference mockup counts an epic planned apart from its initiative in both goals, and this decision counts it once. Items move with the browser's own drag and drop. The drag data is only a marker, so text or files dragged in from GitHub cannot change the plan. All data comes from one replaceable sample source, and no control sends a network request. Refuted alternative: add a "left out of the initiative" state so the original wording holds for every epic. Neither the backlog nor the goal card could show "initiative planned except this epic".

### 2026-11-22 — #8 — Menu entries come from the drop rules and use the same plan changes
Story #17 asks that a menu action change the plan exactly as the same drag and drop would. The item menu's entries are computed from the drop rules, and each entry makes the same plan change as the matching drop, so the two cannot drift. A planned row inside a goal card gets a "Take out of plan" button, which makes the same change as dragging the row to the backlog. Move up and Move down reach every goal order one step at a time, through the same goal-move change a goal drop uses. Both Grooming menus share one keyboard behaviour that stays in the page, because only Grooming uses menus today. The design system's popup menu guideline gains the keyboard rules. Refuted alternative: write the menu as its own handlers that call the planning logic directly, as the mockup does. It is quicker to write, but the menu's enabled entries and the drop targets' rules would be two copies that drift.

### 2026-11-22 — #12 — Moves split out, and the no-network rule narrows to Raiden's own code
Epic #12 would have pushed this page past the 400-word cap, so drag and drop, the item menus and the Take out of plan button moved to the grooming-plan-moves page. Invariants 3 and 7 moved with them and are struck here, so the other invariant numbers keep their meaning. Invariant 4 narrows because issue references and the New initiative link now open GitHub in a new tab. Raiden's own code still sends no request, and a page the user opens is a browser action, so no API traffic, no backend and no data leaving still hold. Refuted alternative: keep issue numbers as plain text, as epic #3 decided. Stories #22 and #23 then had no way to reach GitHub. The new grooming-github-links and raiden-sidebar pages name this page as a neighbour, so this page names them back.

### 2026-11-26 — #73 — The backlog goes live while the plan stays on sample data
Grooming shows the live backlog when the shell has a GitHub gateway and a signed-in person, and keeps the sample backlog otherwise. Both hosts always give both, and the backlog load is tied to the person, so there is nothing to read without them. The goals and the starting plan stay on sample data until their own epic. Invariant 4 is struck, because Try again on the live backlog sends a request to GitHub. The page keeps the rest of that rule in How It Works, and grooming-github-links holds the link behaviour. Refuted alternative: remove the sample backlog everywhere. It lost because a host with no sign-in would show an empty or failed backlog, and the plan rules would lose their drag and menu coverage.

### 2026-11-28 — #81 — The band view replaces both panels for a signed-in lead
For a signed-in person with a live GitHub connection, Grooming shows only the band view, and the sample goals panel, its ranking, Undo and Save plan do not show. Story #88 requires two columns, and sample goals beside real sprints would read as real data. A host with no live connection keeps the sample page until #82 removes it, so the plan rules on this page now hold only on the sample page. Refuted alternative: keep the sample goals panel beside the bands until #82. Nothing would be removed before its epic, but it breaks the two-column layout and puts sample goals next to real sprints.

### 2026-11-28 — #82 — Retired: the sample page and its plan are deleted
Epic #82 deleted the sample Grooming page: the sample goals and their ranks, the starting plan and its rules, the sample backlog, and the Show issues switch. Goals now live on the sprint cards and save to Raiden's backend, as the sprint-goals page states. A host with no live GitHub connection shows a sign-in note, as the grooming-sprint-bands page states. Story #104 requires that no sample goal appears, signed in or not, and keeping the plan would mean maintaining a model nobody uses. The edges to active pages are dropped, so only the edges to the two retired plan pages remain. Refuted alternative: keep the sample page, without goals, as a demo for hosts with no connection. It keeps a backlog for tests and screenshots, but it keeps the plan code alive for a path no real host uses.
