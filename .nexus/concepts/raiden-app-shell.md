---
title: Raiden App Shell
aliases: [raiden app, sidebar, raiden pages frame, collapsed sidebar, sidebar rail]
touches: [raiden-page-host, grooming-plan, grooming-backlog-view, raiden-web-view]
last_updated_by: "#30"
status: active
verification: verified
---

# Raiden App Shell

The shell is the frame shared by every Raiden page. It shows a sidebar that groups the pages (Sprint goal, Grooming, Timeline, Settings) and the selected page beside it. It does not depend on any host.

## How It Works

The shell is built with Preact in its own library. The extension host only mounts it, gives it the stylesheet text and gives it a preference store. The shell reads preferences only through that store. It reads the Show issues choice, the sidebar choice and the backlog width in one pass before its first render, so the page does not flash the wrong state.

Switching sidebar pages changes only what the shell shows. Nothing in the address changes. A button at the top of the sidebar collapses it to a rail of icons and expands it again. In the rail, each item keeps its accessible name and shows it on hover and on keyboard focus.

Keys typed in a Raiden text field stop inside Raiden, so GitHub's own keyboard shortcuts do not run while a lead types.

When the host sets the banner option, the shell draws a banner above the sidebar and the page. The option carries the icon, so the shell imports nothing from an app. The banner is a design-system component with a neutral ground, the brand color on the wordmark, and the height and padding of GitHub's top header. It stays at the top of the window while the document scrolls, and the frame fills the window below it. The extension never sets the option.

Reusable controls go into the design system, each with its own guideline page: sidebar item, text input, switch, icon button and popup menu. Page-specific layout uses only the design system's tokens and type classes, with no literal colors or sizes. The few icons are copied from the Octicons set. The display font file lives in the design system, and each host ships its own copy, because GitHub blocks fonts from other hosts. If it does not load, the system font stack is used.

## Key Invariants

1. The shell and its pages never import from an app or host.
2. A control that more than one Raiden page needs lives in the design system, never in a page.
3. Page layout uses design-system tokens only.
4. The shell keeps preferences only through the injected preference store.
5. The shell makes no network request.
6. A key typed in a Raiden text field never reaches GitHub's page.
7. The banner shows only when the host sets the banner option.

## Integration Points

- [raiden-page-host](raiden-page-host.md) — the host mounts the shell, supplies the stylesheet text and the preference store, and resolves the theme.
- [grooming-plan](grooming-plan.md) — Grooming is the first page the shell shows, and it is the page that opens on every load.
- [grooming-backlog-view](grooming-backlog-view.md) — the shell reads the preferred backlog width before its first render and keeps it through the preference store.
- [raiden-web-view](raiden-web-view.md) — the web view mounts the shell with the banner option set.

## Decision Log

### 2026-11-21 — #3 — Preact in a host-independent library, shared controls in the design system
All Raiden pages are built with Preact, with its React compatibility layer on, in a library that does not depend on the extension. Preact is about 4 KB gzipped against about 45 KB for React, and that size loads each time the Raiden tab opens. Controls that Sprint goal, Timeline and Settings also need go into the design system, so no page keeps a copy that drifts. The display font ships in the extension because GitHub blocks web fonts from other hosts. Refuted alternative: React, which matches the project instructions as written, but costs the size.

### 2026-11-22 — #8 — Layout preferences in the preference store, and the collapsed sidebar as a rail of the shared control
The sidebar choice and the backlog width are kept through the injected preference store, the same way as Show issues, and read before the first render. A lead who collapses the sidebar or widens the backlog wants that on every visit, and the mockup's page storage would break the rule that preferences go only through the store. The collapsed rail is a variant of the design system's sidebar control, because every page shares the sidebar. The mockup's bare-letter toggle shortcut is not built, because its keypress also reaches GitHub's page and the toggle button already gives a keyboard path. Keys typed in a Raiden field are stopped inside Raiden, because GitHub's shortcut handler cannot see that a lead is typing inside the shadow root. Refuted alternative: keep both layout choices in memory only, like the current page choice. It adds no storage keys, but the lead would collapse and resize again on every reload.

### 2026-11-22 — #30 — The shell draws a design-system banner only when the host asks
The banner is a design-system component that the shell draws when the host passes the banner option, with the icon. Its height, ground and type come from design-system tokens, and the shell's tests cover it. The ground is neutral and the wordmark uses the existing brand text color, which measures 5.49:1 in light and 10.48:1 in dark. The document stays the scroller, so native scroll and drag auto-scroll in Grooming behave as before. The display font file moved to the design system so neither host imports from the other. Refuted alternative: the web host draws the banner outside the shell, which puts UI in an app and needs a second style scope or a second copy of the tokens.
