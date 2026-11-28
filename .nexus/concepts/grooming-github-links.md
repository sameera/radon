---
title: Grooming GitHub Links
aliases: [issue links, issue reference link, new initiative link, open issue on github]
touches: [grooming-plan, raiden-page-host, repository-context, grooming-sprint-bands, live-backlog-rows]
last_updated_by: "#81"
status: active
verification: verified
---

# Grooming GitHub Links

On the Grooming page, each initiative and epic issue reference opens that issue on GitHub in a new tab. A New initiative in GitHub link at the foot of the backlog opens the repository's create-issue page in a new tab. The Grooming page and its plan stay as they were.

## How It Works

The whole reference, number and title, is one native link, in the backlog and in goal rows. Each address is built when the page renders, from the GitHub server of the current repository, read from the repository context, and the issue's own repository and number. The New initiative link opens the create-issue page with no template or label preset. The Grooming page renders only while a repository is current, so a person never sees these links with no repository.

Each link opens in a new tab and gives that tab no handle back to Raiden. A click on a link stops inside Raiden, so GitHub's own page handlers cannot take it over, and the browser still opens the link. Nothing prefetches or preloads a linked page. Links are not draggable, so a drag that starts on one moves its row. Backlog rows are the repository's real issues, and the issue numbers in the sample goals and plan may open an unrelated issue or a "not found" page.

## Key Invariants

1. Raiden's own code sends no request when a link is used. The only network activity is the browser loading the page the user opened.
2. A page opened from a link has no handle back to the Raiden tab.
3. After a link opens, the Raiden page keeps its address, plan, goals, goal order and collapsed initiatives.
4. ~~Issue links and the New initiative link point at the current repository's github.com pages.~~ Replaced by invariant 7.
5. A link is never dragged. A drag that starts on one moves its row.
6. The links need no new extension permission and no new host access.
7. Each issue link points at the github.com page of the issue's own repository, which for every issue the backlog query returns is the current repository. The New initiative link points at the current repository's github.com pages.

## Integration Points

- [grooming-plan](grooming-plan.md) — the links sit in the plan's backlog and goal rows, and opening one leaves the plan unchanged.
- [raiden-page-host](raiden-page-host.md) — the extension host reads the repository's web address from GitHub's page and writes it into the repository context.
- [repository-context](repository-context.md) — each link reads the current repository from the shared context, and the page does not render while it is "none".
- [live-backlog-rows](live-backlog-rows.md) — each live backlog row links to its issue, and a parent in another repository links to that repository's issue page.
- [grooming-sprint-bands](grooming-sprint-bands.md) — each milestone header links to the milestone's edit page in GitHub, in a new tab under the same link rules.

## Decision Log

### 2026-11-22 — #12 — Native links that open GitHub in a new tab
Stories #22 and #23 need a way to reach GitHub. A native link gives Enter on focus, middle-click, copy link address and the address preview, and a script that opens a window would have to rebuild each. A new tab keeps the Raiden page and its in-memory plan, where navigating in place would discard the plan. No handle back means the opened page cannot script or redirect the Raiden tab. The no-network rule narrows to Raiden's own code, which keeps what epic #3 protected: no API traffic, no backend and no data leaving. The user creates the issue in GitHub, so Raiden still writes nothing to GitHub. Refuted alternative: make only the issue number the link, the literal reading of story #23. It lost because it departs from the design-system guideline and the mockup, and a screen reader would read a bare "#12" as the link name.

### 2026-11-22 — #50 — Links read the repository from the shared context
The links no longer take the address from a value passed through the shell and the Grooming page. They read the current repository directly. The shell now shows no page while the repository is "none", so the plain-text and hidden-link fallback for a missing address no longer applies. Refuted alternative: none.

### 2026-11-26 — #73 — An issue link follows the issue's own repository
The live backlog shows the parents GitHub records, and a parent may sit in another repository. Its link now goes to that repository's issue page, on the same GitHub server as the current repository. Invariant 4 is struck and replaced by invariant 7, because links can now point outside the current repository. The rule recorded in #12 held only because the sample data had no parent in another repository. Refuted alternative: end a chain at the repository boundary, so that every link stays inside the current repository. It lost because it breaks the success metric of showing the chain GitHub records, and it hides an initiative a team files in a separate planning repository.

### 2026-11-28 — #81 — Reciprocal link from grooming-sprint-bands
The grooming-sprint-bands page names this page as a neighbour, so this page names it back. The live-backlog link moves to live-backlog-rows, because the rows split out of live-backlog and the links sit on rows.
