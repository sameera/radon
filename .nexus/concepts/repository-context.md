---
title: Repository Context
aliases: [current repository, repo context, pick prompt]
touches: [raiden-app-shell, raiden-page-host, raiden-web-view, grooming-github-links, web-repository-picker, repository-menu]
last_updated_by: "#66"
status: active
verification: verified
---

# Repository Context

Every Raiden page reads the repository it works on from one shared place. No parent passes it down. Each host fills that place, and every component on screen shows the new repository when it changes.

## How It Works

The shared place holds an owner, a name and the github.com address, or "none". Any component reads it directly, in either host and at any depth. The pages do not know which host they run in.

The extension fills it from the github.com page being viewed. It sets the repository when the Raiden tab opens. It sets it again whenever GitHub's in-page navigation moves to a different repository while the tab is showing. The extension never sets "none", shows no breadcrumb or menu and stores nothing for this.

The web view starts at "none" and fills it from the person's pick or from the remembered repository.

The shell checks for "none" once, above every page. While the repository is "none", the main area shows a prompt in place of the selected page. The prompt asks the person to pick a repository, or to sign in first when signed out. The sidebar and banner stay.

A host that sets a fixed repository address at mount, such as a test, needs no shared holder of its own.

## Key Invariants

1. A component at any depth reads the current repository's owner and name without a parent passing them.
2. When the repository changes, every component on screen that reads it shows the new one without a page reload.
3. While the repository is "none", no page renders. The main area asks the person to pick a repository, or to sign in when signed out.
4. In the Raiden tab, the repository always equals the repository of the github.com page being viewed.
5. The extension shows no repository breadcrumb or menu and never reads or writes the remembered repository or the kept list.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the shell provides the shared place and shows the pick prompt while it is "none".
- [raiden-page-host](raiden-page-host.md) — the extension host fills it from the github.com page and again after in-page navigation.
- [raiden-web-view](raiden-web-view.md) — the web view fills it from the repository menu and the remembered repository.
- [grooming-github-links](grooming-github-links.md) — the Grooming links read the repository from it when they render.
- [web-repository-picker](web-repository-picker.md) — the picker writes it when the person picks, and clears it when the list shows the repository is gone.
- [repository-menu](repository-menu.md) — a pick from the menu sets it, and the menu marks it as the selected repository.

## Decision Log

### 2026-11-22 — #50 — One shared, changeable repository replaces the address passed down
Both hosts need the same answer, and the web view's answer changes during a visit. A shared value that any component reads meets "no parent passing" and "without a page reload" directly. It also removes a chain of passed-down values that ran four levels deep in Grooming. The shell handles "none" once above every page, so no page can forget it and later pages get it free. The extension rewrites the value whenever the viewed page's repository differs, because GitHub's in-page navigation can keep the host alive across a repository change. Refuted alternative: keep the address as a mount option and remount the shell on each pick. It needs no new holder, but a remount drops the open page, the sidebar state and drag state, and it keeps the passed-down chain. A second refuted alternative: let each page render with "none" and show its own empty state. It allows page-specific hints, but every page would carry the same branch, and a page that forgot it would show broken data.

### 2026-11-24 — #66 — The breadcrumb reads the shared repository, and the extension shows no control
The breadcrumb reads the shared repository directly and not the kept list. A current repository that a stale kept list lacks still shows, and the breadcrumb shows "Pick a repository" while the place is "none". The extension shows no breadcrumb or menu and stores nothing for this, as before. Refuted alternative: none. The same entry records the reciprocal link from repository-menu: the menu marks the shared repository as selected, and a pick from the menu writes it here.
