---
title: Raiden App Shell
aliases: [raiden app, raiden pages frame]
touches: [raiden-banner, raiden-page-host, grooming-plan, grooming-backlog-view, raiden-web-view, raiden-sidebar, github-sign-in, github-client, repository-context, web-view-sign-out]
last_updated_by: "#66"
status: active
verification: verified
---

# Raiden App Shell

The shell is the frame shared by every Raiden page. It shows the sidebar of Raiden pages and the selected page beside it. It does not depend on any host.

## How It Works

The shell is built with Preact in its own library. The extension host only mounts it, gives it the stylesheet text, gives it a preference store and gives it a repository context that the host keeps current. The shell reads preferences only through that store. While the repository context is "none", the main area shows a pick prompt in place of the page. The sidebar and banner stay. It reads the Show issues choice, the sidebar choice and the backlog width in one pass before its first render, so the page does not flash the wrong state.

Switching sidebar pages changes only what the shell shows. Nothing in the address changes.

Keys typed in a Raiden text field stop inside Raiden, so GitHub's own keyboard shortcuts do not run while a lead types.

When the host sets the banner option, the shell draws the banner above the sidebar and the page. The banner has its own page.

Reusable controls go into the design system, each with its own guideline page: sidebar item, text input, switch, icon button, popup menu and tooltip. Page-specific layout uses only the design system's tokens and type classes, with no literal colors or sizes. The few icons are copied from the Octicons set. The display font file lives in the design system, and each host ships its own copy, because GitHub blocks fonts from other hosts. If it does not load, the system font stack is used.

## Key Invariants

1. The shell and its pages never import from an app or host.
2. A control that more than one Raiden page needs lives in the design system, never in a page.
3. Page layout uses design-system tokens only.
4. The shell keeps preferences only through the injected preference store.
5. The shell sends GitHub requests only through the gateway the host supplies.
6. A key typed in a Raiden text field never reaches GitHub's page.

## Integration Points

- [raiden-page-host](raiden-page-host.md) — the host mounts the shell, supplies the stylesheet text, the preference store and the repository context, and resolves the theme.
- [grooming-plan](grooming-plan.md) — Grooming is the first page the shell shows, and it is the page that opens on every load.
- [grooming-backlog-view](grooming-backlog-view.md) — the shell reads the preferred backlog width before its first render and keeps it through the preference store.
- [raiden-web-view](raiden-web-view.md) — the web view mounts the shell with the banner option set.
- [raiden-banner](raiden-banner.md) — the shell draws the banner when the host sets the option, and the banner holds the repository breadcrumb and the avatar.
- [raiden-sidebar](raiden-sidebar.md) — the shell draws the sidebar, keeps its collapsed choice through the preference store, and passes it the not-planned count.
- [github-sign-in](github-sign-in.md) — the shell shows the sign-in control, and the username or, in the web view, the avatar and menu, and does not block pages.
- [github-client](github-client.md) — the shell receives the GitHub gateway from the host and gives it to pages.
- [repository-context](repository-context.md) — the shell provides the shared current repository and shows the pick prompt while it is "none".
- [web-view-sign-out](web-view-sign-out.md) — the shell shows Sign out only when the host supplies the step, and shows the sign-in screen at once.

## Decision Log

### 2026-11-21 — #3 — Preact in a host-independent library, shared controls in the design system
All Raiden pages are built with Preact, with its React compatibility layer on, in a library that does not depend on the extension. Preact is about 4 KB gzipped against about 45 KB for React, and that size loads each time the Raiden tab opens. Controls that Sprint goal, Timeline and Settings also need go into the design system, so no page keeps a copy that drifts. The display font ships in the extension because GitHub blocks web fonts from other hosts. Refuted alternative: React, which matches the project instructions as written, but costs the size.

### 2026-11-22 — #8 — Layout preferences in the preference store, and the collapsed sidebar as a rail of the shared control
The sidebar choice and the backlog width are kept through the injected preference store, the same way as Show issues, and read before the first render. A lead who collapses the sidebar or widens the backlog wants that on every visit, and the mockup's page storage would break the rule that preferences go only through the store. The collapsed rail is a variant of the design system's sidebar control, because every page shares the sidebar. The mockup's bare-letter toggle shortcut is not built, because its keypress also reaches GitHub's page and the toggle button already gives a keyboard path. Keys typed in a Raiden field are stopped inside Raiden, because GitHub's shortcut handler cannot see that a lead is typing inside the shadow root. Refuted alternative: keep both layout choices in memory only, like the current page choice. It adds no storage keys, but the lead would collapse and resize again on every reload.

### 2026-11-22 — #30 — The shell draws a design-system banner only when the host asks
The banner is a design-system component that the shell draws when the host passes the banner option, with the icon. Its height, ground and type come from design-system tokens, and the shell's tests cover it. The ground is neutral and the wordmark uses the existing brand text color, which measures 5.49:1 in light and 10.48:1 in dark. The document stays the scroller, so native scroll and drag auto-scroll in Grooming behave as before. The display font file moved to the design system so neither host imports from the other. Refuted alternative: the web host draws the banner outside the shell, which puts UI in an app and needs a second style scope or a second copy of the tokens.

### 2026-11-22 — #12 — Sidebar split out, and the extension host passes the repository address
This page was past the 400-word cap, so the sidebar's items, collapse, not-planned count and tooltips moved to the raiden-sidebar page, with the sidebar aliases. The extension host now also gives the shell the current repository's web address at start, and the shell builds every GitHub link from it. The library must not depend on a host, so it does not read github.com's address layout itself. The design system gains a tooltip control with its own guideline page. Refuted alternative: the app reads the repository from the browser's current address. It needs no new start-up input, but it ties the host-free library to github.com's address layout, and a later web host and the tests would have to fake a github.com address.

### 2026-11-22 — #39 — Reciprocal link from github-sign-in and github-client
The shell shows the sign-in control, and the host supplies the GitHub gateway. Recorded for the two new pages.

### 2026-11-22 — #50 — The shell reads the repository from a shared context and handles "none" once
The host no longer passes a repository address down through the shell. It supplies a repository context, and the shell shows a pick prompt in place of any page while it is "none". One check above every page means no page can forget it. The invariant that the shell makes no network request is restated, because the shell now loads the repository list in the web view through the gateway. The page passed the 400-word cap, so the banner's drawing, look and invariant moved to the new raiden-banner page, which also holds the drop-down. Refuted alternative: let each page render with "none" and show its own empty state. Every page would carry the same branch, and a page that forgot it would show broken data.
### 2026-11-22 — #58 — The shell shows the account menu from an optional host step
In a banner host the shell shows the avatar and its menu in place of the sidebar username, and shows Sign out only when the host supplies a sign-out step. The shell must never import from a host, as invariant 1 requires, and only the host knows where its record lives. The extension keeps its sidebar username. Refuted alternative: none.

### 2026-11-24 — #66 — The shell holds which banner menu is open, so at most one is open
The shell keeps one value for the open banner menu, repository or account, and gives each menu its open state and a change handler. No menu listens for another menu's event, so at most one is open by construction. Refuted alternative: a document event that each menu fires on open and the other listens for, which needs both menus to agree on event names and still races on a fast double click.
