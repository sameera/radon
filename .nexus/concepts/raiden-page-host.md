---
title: Raiden Page Host
aliases: [raiden tab, raiden address, raiden host]
touches: [raiden-app-shell, grooming-plan, raiden-web-view, grooming-github-links, github-sign-in, github-client, repository-context]
last_updated_by: "#66"
status: active
verification: verified
---

# Raiden Page Host

The Raiden tab on a repository page opens the Raiden page in place of GitHub's content. The host decides when the Raiden page shows, where it sits, which colors it uses and where it keeps preferences. The host holds no page logic of its own.

## How It Works

The Raiden tab and its More-menu entry point at the repository main page with a Raiden marker in the address. At that address, GitHub's content below the tab bar is hidden. The Raiden host is placed next to that content, not inside it, so a GitHub re-render of its content does not remove the host. The Raiden tab is marked as the current tab. The host reads the repository's web address from GitHub's Code tab link, with no network request, and writes it into the repository context at mount. It writes it again whenever a sync finds a different repository while the Raiden tab is showing, because GitHub's in-page navigation can keep the host alive across a repository change. The web view fills the context from its own menu instead.

At any other address, the host is removed, GitHub's content is shown again, and the previous current tab is restored.

On github.com, colors follow GitHub's color mode. The web view follows the system preference only. When that mode is "auto", the system preference decides. The result is set on the host and changes live when either setting changes.

The app code loads only when the Raiden address opens, so every other github.com page runs the same small script as before. Switching sidebar pages never changes the address, so a reload always opens Grooming. On github.com, preferences are kept in the extension's own storage, never in github.com's. The web view keeps its own preferences in its own address's storage, apart from the extension's.

## Key Invariants

1. On github.com, the Raiden page shows only at the Raiden address, and GitHub's content shows at every other address. The web view shows the Raiden page at its own address.
2. The host sits next to GitHub's content, never inside it.
3. On github.com, the host's colors always match GitHub's resolved color mode. In the web view, they match the system color preference.
4. Raiden preferences are never written to github.com's own storage.
5. The host logic does not depend on the extension, so a later web host can reuse it.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the host mounts the shell and gives it the preference store and the repository context, which the host fills from the page without a network request.
- [grooming-plan](grooming-plan.md) — the host opens on Grooming, and the Show issues choice is stored through the host's preference store.
- [raiden-web-view](raiden-web-view.md) — the web view is a second host beside this one, with its own theme and preference store.
- [grooming-github-links](grooming-github-links.md) — the Grooming links are built from the repository address this host reads from GitHub's page.
- [github-sign-in](github-sign-in.md) — the extension host signs in through its background worker and keeps the record in extension storage.
- [github-client](github-client.md) — the extension host forwards gateway requests to its worker, which runs the client.
- [repository-context](repository-context.md) — the extension host fills the shared repository from the github.com page and rewrites it when the page's repository changes.

## Decision Log

### 2026-11-21 — #3 — Raiden page replaces the repository main page content
The Raiden page lives on the repository main page and replaces its content below the tab bar. The old target path has no GitHub page, so the repository header and tab bar would not exist there. The host sits next to GitHub's content so it survives a re-render of that content. Colors follow GitHub's resolved color mode, and the system preference when the mode is "auto", because that case is the one most often missed. Host logic sits behind a small runtime interface in a shared library, so a later web host and the jsdom tests reuse it. Preferences live in the extension's own storage, one choice for every repository, so GitHub's scripts cannot read or clear them. Refuted alternative: keep the old path and draw the whole frame, header included, over GitHub's "page not found" page. Raiden would then keep copies of the header and tab bar, and those copies would drift from GitHub's own.

### 2026-11-22 — #30 — Four statements narrow to github.com, and the web view is a second host
The web view is a second thin host that mounts the same shell, so the host contract no longer holds for every host. The Raiden address, GitHub's color mode and the extension's storage are now facts about github.com only. The web view has no GitHub color mode, so it follows the system preference, and it keeps preferences in its own address's storage. Refuted alternative: an in-app light, dark or auto choice for the web view, which no story asked for and which would add a color setting the tab ignores.

### 2026-11-22 — #12 — The host gives the shell the repository address
The epic's assumptions put both GitHub links in the current repository. The host already reads the repository from GitHub's Code tab to build the Raiden address, so it needs no network call. Taking the origin from the page also points links at the right server if the extension ever runs on another GitHub. Refuted alternative: the app reads the repository from the browser's current address. It needs no new start-up input, but it ties the host-free library to github.com's address layout. The new grooming-github-links page names this page as a neighbour, so this page names it back.

### 2026-11-22 — #39 — Reciprocal link from github-sign-in and github-client
The extension host's worker owns the sign-in record and runs the client. Recorded for the two new pages.

### 2026-11-22 — #50 — The host rewrites the repository whenever the page's repository differs
The host used to keep the address it mounted with and never compare it. The Raiden tab must always show the viewed page's repository, and in-page navigation can change that while the host stays. One comparison on each sync makes the guarantee hold in every case. Refuted alternative: none.

### 2026-11-24 — #66 — The web view's context comes from its menu, not a drop-down
The web view has no github.com page to read, so its repository comes from its own repository menu. This entry changes only the wording of that source, because the drop-down it named is gone. Refuted alternative: none.
