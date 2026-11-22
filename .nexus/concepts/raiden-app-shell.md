---
title: Raiden App Shell
aliases: [raiden app, sidebar, raiden pages frame, collapsed sidebar, sidebar rail]
touches: [raiden-page-host, grooming-plan, grooming-backlog-view]
last_updated_by: "#8"
status: active
verification: verified
---

# Raiden App Shell

The shell is the frame shared by every Raiden page. It shows a sidebar that groups the pages (Sprint goal, Grooming, Timeline, Settings) and the selected page beside it. It does not depend on any host.

## How It Works

The shell is built with Preact in its own library. The extension host only mounts it, gives it the stylesheet text and gives it a preference store. The shell reads preferences only through that store. It reads the Show issues choice, the sidebar choice and the backlog width in one pass before its first render, so the page does not flash the wrong state.

Switching sidebar pages changes only what the shell shows. Nothing in the address changes. A button at the top of the sidebar collapses it to a rail of icons and expands it again. In the rail, each item keeps its accessible name and shows it on hover and on keyboard focus.

Keys typed in a Raiden text field stop inside Raiden, so GitHub's own keyboard shortcuts do not run while a lead types.

Reusable controls go into the design system, each with its own guideline page: sidebar item, text input, switch, icon button and popup menu. Page-specific layout uses only the design system's tokens and type classes, with no literal colors or sizes. The few icons are copied from the Octicons set. The display font ships with the extension, because GitHub blocks fonts from other hosts. If it does not load, the system font stack is used.

## Key Invariants

1. The shell and its pages never import from an app or host.
2. A control that more than one Raiden page needs lives in the design system, never in a page.
3. Page layout uses design-system tokens only.
4. The shell keeps preferences only through the injected preference store.
5. The shell makes no network request.
6. A key typed in a Raiden text field never reaches GitHub's page.

## Integration Points

- [raiden-page-host](raiden-page-host.md) — the host mounts the shell, supplies the stylesheet text and the preference store, and resolves the theme.
- [grooming-plan](grooming-plan.md) — Grooming is the first page the shell shows, and it is the page that opens on every load.
- [grooming-backlog-view](grooming-backlog-view.md) — the shell reads the preferred backlog width before its first render and keeps it through the preference store.

## Decision Log

### 2026-11-21 — #3 — Preact in a host-independent library, shared controls in the design system
All Raiden pages are built with Preact, with its React compatibility layer on, in a library that does not depend on the extension. Preact is about 4 KB gzipped against about 45 KB for React, and that size loads each time the Raiden tab opens. Controls that Sprint goal, Timeline and Settings also need go into the design system, so no page keeps a copy that drifts. The display font ships in the extension because GitHub blocks web fonts from other hosts. Refuted alternative: React, which matches the project instructions as written, but costs the size.

### 2026-11-22 — #8 — Layout preferences in the preference store, and the collapsed sidebar as a rail of the shared control
The sidebar choice and the backlog width are kept through the injected preference store, the same way as Show issues, and read before the first render. A lead who collapses the sidebar or widens the backlog wants that on every visit, and the mockup's page storage would break the rule that preferences go only through the store. The collapsed rail is a variant of the design system's sidebar control, because every page shares the sidebar. The mockup's bare-letter toggle shortcut is not built, because its keypress also reaches GitHub's page and the toggle button already gives a keyboard path. Keys typed in a Raiden field are stopped inside Raiden, because GitHub's shortcut handler cannot see that a lead is typing inside the shadow root. Refuted alternative: keep both layout choices in memory only, like the current page choice. It adds no storage keys, but the lead would collapse and resize again on every reload.
