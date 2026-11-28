---
title: Raiden Sidebar
aliases: [sidebar, collapsed sidebar, sidebar rail, sidebar tooltip]
touches: [raiden-app-shell]
last_updated_by: "#82"
status: active
verification: verified
---

# Raiden Sidebar

The sidebar lists the Raiden pages in groups: Sprint goal, Grooming, Timeline and Settings. Selecting an item shows its page, and every item shows a tooltip with its name. No item shows a count.

## How It Works

Selecting an item changes only the page the shell shows, never the address. Exactly one item is marked as current. A button at the top of the sidebar collapses it to a rail of icons and expands it again. Below 760 pixels, the expanded sidebar overlays the page.

Each item shows a tooltip with its page name while the pointer is over it or it has keyboard focus, collapsed or not. The tooltip hides when the pointer or focus leaves, or when Escape is pressed. It never takes focus and never catches the pointer. It is hidden from assistive technology, because the item's name already says the same.

The sidebar item and the tooltip are design-system controls, each with its own guideline page.

## Key Invariants

1. Selecting an item never changes the address, and exactly one item is marked as current.
2. ~~The not-planned count plus the header's planned-epics count always equals the total number of epics.~~ Replaced by invariant 7.
3. ~~The Grooming item shows no count when every epic is planned.~~ Retired with the count.
4. ~~The Grooming tooltip's count always equals the badge count.~~ Retired with the count.
5. A tooltip never takes focus and never stops a click on what lies under it.
6. In the collapsed rail, each item keeps its accessible name.
7. ~~While the not-planned count and the header's planned-epics count show, they add up to the total number of epics. While the live backlog shows, neither count shows.~~ Retired with the count.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the shell draws the sidebar, keeps its collapsed choice through the preference store, and tells it which page is current.

## Decision Log

### 2026-11-22 — #12 — Split from raiden-app-shell, with a not-planned count and tooltips
Split from raiden-app-shell, which was past the 400-word cap before epic #12 added to the sidebar. A task about sidebar items loads this page, and a task about mounting, preferences or the banner loads the shell page. The shell works out the not-planned count from the shared session state with the header's rule, so the count equals the number of unplanned epics at all times and updates with no reload. The tooltip is a design-system control, because every Raiden page shares the sidebar and icon buttons will want one. Escape dismissal meets the usual rule for content that appears on hover or focus. Refuted alternatives: a general page-badge contract, which lost because only one page has a badge today; the browser's native title tooltip, which lost because it never shows on keyboard focus.

### 2026-11-26 — #73 — The not-planned count hides while the backlog is live
The plan still runs on sample issue numbers, so beside a live backlog the not-planned count would describe a different set of epics than the backlog shows. The lead chose at the clarification gate to hide the sidebar count and the header's planned-epics count until the plan goes live. Invariant 2 is struck and replaced by invariant 7, which holds only while the counts show. Refuted alternative: keep both counts running on the sample plan. It keeps a working feature until the plan goes live, but the page would show numbers that disagree with the backlog beside them.

### 2026-11-28 — #81 — Below 760 pixels the expanded sidebar overlays the page
Grooming must fit a 360-pixel window with the sidebar in either state. The expanded sidebar now overlays the page below 760 pixels, and the page keeps a margin the width of the collapsed rail, so the lead's stored collapse choice stays true. Refuted alternative: force the sidebar collapsed below 760 pixels. It is simpler, but it overrides the lead's stored choice.

### 2026-11-28 — #82 — The Grooming item's not-planned count is removed
The count described epics planned into sample goals, and the sample goals and the plan are deleted, so nothing is left to count. Invariants 3, 4 and 7 are struck with the count, and the not-planned count alias goes. The grooming-plan page is retired, so its edge is dropped. Refuted alternative: none.
