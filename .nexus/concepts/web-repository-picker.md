---
title: Web View Repository Picker
aliases: [repository drop-down, repo picker, remembered repository, kept repository list, reachable list]
touches: [raiden-banner, repository-context, raiden-web-view, github-client, github-sign-in]
last_updated_by: "#50"
status: active
verification: verified
---

# Web View Repository Picker

In the web view, a drop-down in the banner lets a signed-in person pick the repository. The web view remembers the last pick and the last repository list, so it opens ready on a repeat visit.

## How It Works

The drop-down is the browser's own list control, styled with the design system. It sits beside the Raiden mark and word, and only while a person is signed in. The extension has none.

The list is every repository the person can reach through the installations of Raiden's GitHub App, including organisation repositories. The web view reads every installation and every page until it reaches the total GitHub reports for that installation. It then sorts by owner and name. All requests go through the shared GitHub client, as the signed-in person.

Picking a repository makes it the current repository and the remembered repository. The remembered repository and the kept list sit in the web view's local storage, each with the login of the person who wrote it. Sign-in resolves first. A value with another person's login is ignored and later overwritten. A value with the same login is used at once: the remembered repository becomes current and the kept list fills the drop-down, before GitHub answers.

Only a complete list counts, meaning every request succeeded. A complete list replaces the kept list. If it lacks the current repository, the current repository becomes "none" and the remembered one is cleared. A failed or partial load changes nothing.

## Key Invariants

1. The drop-down lists every repository reachable through Raiden's GitHub App, including accounts with several hundred.
2. A person never sees, or opens on, another person's kept list or remembered repository.
3. Only a complete list replaces the kept list or clears the remembered repository.
4. The stored values hold only a login and repository owners, names and addresses, never a token or sign-in data.
5. A storage error reads as "nothing stored", and a failed write is dropped without breaking the page.

## Integration Points

- [repository-context](repository-context.md) — a pick sets the shared current repository, and a complete list without it clears the repository.
- [raiden-web-view](raiden-web-view.md) — the picker sits in the web view's banner and uses its preference store.
- [raiden-banner](raiden-banner.md) — the drop-down is the one control the banner holds.
- [github-client](github-client.md) — the list requests go through the shared client as the signed-in person.
- [github-sign-in](github-sign-in.md) — the login from sign-in tags and checks the stored values.

## Decision Log

### 2026-11-22 — #50 — List by App installation, native control, one stored slot tagged with the login
Listing by installation gives exactly the repositories both the person and the App can reach, and each installation's total lets the web view know the list is complete, because the gateway exposes no paging headers. The native list control gives type-to-jump, keyboard and screen-reader support for hundreds of entries without extra work. Values are tagged with the login, so a new person on a shared browser never inherits the previous person's repository. One slot per value keeps storage bounded. Only a complete list may clear anything, because one page refused by a rate limit would make a present repository look missing. The banner page records that the banner now allows this one control. Refuted alternative: list through GitHub's general listing for the signed-in user. It is one call family, but under an App token it is unclear whether it filters to installed repositories, and a bare list leaves completeness to a guess from a short last page. A second refuted alternative: one stored entry per login. People who take turns would each keep their last repository, but the map would keep every past person's private repository names indefinitely and need pruning.
