---
title: Grooming Backlog View
aliases: [backlog filter, backlog width, backlog divider, resize backlog]
touches: [grooming-plan, raiden-app-shell, live-backlog, grooming-sprint-bands]
last_updated_by: "#81"
status: active
verification: verified
---

# Grooming Backlog View

A lead can filter the Grooming backlog by title or issue number and change its width with a divider. The filter and the width change only what the backlog shows, never the plan. The chosen width is kept across reloads.

## How It Works

The filter shows the initiatives and epics whose title or issue number contains the typed text. Letter case and a leading "#" are ignored. A matching initiative shows with all its epics. A matching epic shows under its initiative, so its goal labels still make sense. While the filter has text, those initiatives show open, and each initiative keeps its own open or closed setting for when the filter is cleared. When nothing matches, the backlog says so and says that clearing the filter shows everything. The filter is not saved and is cleared when the lead leaves Grooming.

The divider between the backlog and the goals is a focusable separator that reports the backlog width. A pointer drags it. Left and Right move the divider one fixed step in their own direction, and Shift gives a larger step. On the sample page the backlog is left of the divider, so Left narrows it. In the band view the backlog column is right of the divider, so Left widens it. Home and End set the backlog to its minimum and maximum width. Double-click or Enter resets the default width. In the band view the default is the view's width less a quarter for the goal column and less the divider.

The lead keeps one preferred backlog width, through the shell's preference store, for both the sample page and the band view. The shown width is the preferred backlog width fitted so the backlog and the goals both stay at or above their minimum widths, on whichever side the backlog sits. It is fitted again when the space changes, for example when the sidebar collapses, and the preferred width returns when space allows.

## Key Invariants

1. Filtering never changes the plan, the save state or Undo.
2. At 760 pixels and wider, neither column is ever narrower than its minimum width.
3. Fitting the shown width never overwrites the lead's preferred width.

## Integration Points

- [grooming-plan](grooming-plan.md) — the filter and width change only how the backlog of the plan is shown.
- [raiden-app-shell](raiden-app-shell.md) — the shell reads the preferred backlog width before its first render and keeps it through the preference store.
- [grooming-sprint-bands](grooming-sprint-bands.md) — the band view keeps the filter, the divider and the preferred backlog width, with the backlog column right of the divider.
- [live-backlog](live-backlog.md) — the same filter and width apply to the live backlog, where a matching row shows with its descendants under its full chain.

## Decision Log

### 2026-11-22 — #8 — The filter keeps the hierarchy, and the divider is an accessible separator over a fitted width
Leads search by issue number as often as by title, so the filter matches both. A matching epic shows under its initiative, because labels such as "2 of 3 epics planned" depend on the initiative. The divider is a focusable separator so the width has a keyboard path. The shown width is fitted again whenever the space changes, because collapsing the sidebar or resizing the window changes the space under a stored width. Refuted alternative: the browser's built-in resize handle on the backlog panel. It needs almost no code, but it has no keyboard path and its grip sits at the panel's corner, not between the panels.

### 2026-11-26 — #73 — Reciprocal link from live-backlog
The live-backlog page names this page as a neighbour, so this page names it back.

### 2026-11-28 — #81 — The divider moves in the direction of the key, and one backlog width serves both pages
A divider is a visible bar, so a lead who presses Left expects it to move left, and the accessible separator pattern says the same. In the band view the backlog is right of the divider, so Left now widens it, while on the sample page Left still narrows it. One preferred width applies to the backlog wherever it sits. The record chose a 58% default for the band view, and the build gives the backlog the view less a quarter and the divider, which the lead accepted as the new design on #94. The stored width moved to a new preference key, which the lead also accepted on #94, so every lead's saved width is dropped once. Below 760 pixels the columns stack, so the minimum widths apply only at 760 pixels and wider. Refuted alternative: keep Left narrowing the backlog everywhere. The wording and tests stay, but in the band view Left would move the divider right.
