---
title: Grooming Backlog View
aliases: [backlog filter, backlog width, backlog divider, resize backlog]
touches: [grooming-plan, raiden-app-shell, live-backlog]
last_updated_by: "#73"
status: active
verification: verified
---

# Grooming Backlog View

A lead can filter the Grooming backlog by title or issue number and change its width with a divider. The filter and the width change only what the backlog shows, never the plan. The chosen width is kept across reloads.

## How It Works

The filter shows the initiatives and epics whose title or issue number contains the typed text. Letter case and a leading "#" are ignored. A matching initiative shows with all its epics. A matching epic shows under its initiative, so its goal labels still make sense. While the filter has text, those initiatives show open, and each initiative keeps its own open or closed setting for when the filter is cleared. When nothing matches, the backlog says so and says that clearing the filter shows everything. The filter is not saved and is cleared when the lead leaves Grooming.

The divider between the backlog and the goals panel is a focusable separator that reports the backlog width. A pointer drags it. Left and Right change the width by a fixed step, Shift gives a larger step, and Home and End go to the minimum and the maximum. Double-click or Enter resets the default width.

The lead's preferred width is kept through the shell's preference store. The shown width is the preferred width fitted so both panels stay at or above their minimum widths. It is fitted again when the space changes, for example when the sidebar collapses, and the preferred width returns when space allows.

## Key Invariants

1. Filtering never changes the plan, the save state or Undo.
2. Neither panel is ever narrower than its minimum width.
3. Fitting the shown width never overwrites the lead's preferred width.

## Integration Points

- [grooming-plan](grooming-plan.md) — the filter and width change only how the backlog of the plan is shown.
- [raiden-app-shell](raiden-app-shell.md) — the shell reads the preferred backlog width before its first render and keeps it through the preference store.
- [live-backlog](live-backlog.md) — the same filter and width apply to the live backlog, where a matching row shows with its descendants under its full chain.

## Decision Log

### 2026-11-22 — #8 — The filter keeps the hierarchy, and the divider is an accessible separator over a fitted width
Leads search by issue number as often as by title, so the filter matches both. A matching epic shows under its initiative, because labels such as "2 of 3 epics planned" depend on the initiative. The divider is a focusable separator so the width has a keyboard path. The shown width is fitted again whenever the space changes, because collapsing the sidebar or resizing the window changes the space under a stored width. Refuted alternative: the browser's built-in resize handle on the backlog panel. It needs almost no code, but it has no keyboard path and its grip sits at the panel's corner, not between the panels.

### 2026-11-26 — #73 — Reciprocal link from live-backlog
The live-backlog page names this page as a neighbour, so this page names it back.
