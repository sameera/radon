---
title: Repository Menu
aliases: [repository menu, searchable repository menu, repo menu, repository search]
touches: [raiden-banner, web-repository-picker, repository-context]
last_updated_by: "#66"
status: active
verification: verified
---

# Repository Menu

The repository menu is the searchable list a person opens from the repository breadcrumb in the web view's banner. Typing narrows the list, and picking a repository switches to it.

## How It Works

Selecting the breadcrumb opens the menu with an empty search box that has focus. The menu lists every loaded repository as owner/name, in owner-then-name order. It scrolls within a fixed height and does not page.

Typing filters the loaded list in memory, with no request. An entry matches when its owner/name text contains the typed text, ignoring case and spaces at either end. Matches keep their order, with no ranking. The first match is highlighted after each change.

Up and Down move the highlight. Enter or a click picks an entry. The current repository is marked. Picking it closes the menu and changes nothing. Picking another repository makes it current and remembered, and returns focus to the breadcrumb.

Escape, Tab and a click outside close the menu and leave the repository unchanged. Escape returns focus to the breadcrumb. Opening the menu closes the avatar menu, and the reverse. The search text clears on each open.

When typed text matches nothing, the menu says "No repository matches". While an empty list loads, it says "Loading repositories". When the list is empty and no load runs, it says "No repositories to show".

## Key Invariants

1. Opening the menu and typing send no request to GitHub.
2. Matching is a case-insensitive contains test on owner/name, with no ranking.
3. The search text is never stored.
4. At most one banner menu is open at a time.
5. Keys typed in the search box stay inside Raiden, and Escape closes only this menu.
6. Picking a repository sets the shared current repository, as repository-context requires.
7. The menu takes every color and size from design-system tokens.

## Integration Points

- [raiden-banner](raiden-banner.md) — the breadcrumb opens the menu, and the avatar menu closes when the menu opens.
- [web-repository-picker](web-repository-picker.md) — the menu lists the picker's loaded list, and a pick becomes the remembered repository.
- [repository-context](repository-context.md) — a pick sets the shared current repository, and the menu marks it as selected.

## Decision Log

### 2026-11-24 — #66 — split from web-repository-picker: the searchable menu filters the loaded list in memory
The picker page would pass the 400-word cap if the search rules stayed in it, so the menu's behavior moved here. The menu is a separate control with its own keys, messages and close rules. The list and its storage stay on the picker page. Filtering runs over the loaded list in memory, so typing sends no request, and the picker's completeness rules remain the only rules for the list. Refuted alternative: a text field tied to the browser's own suggestion list. It gives keys and screen-reader support for free, but it cannot promise a contains match on owner/name, cannot show a no-match message, and cannot take the design system's styles.
