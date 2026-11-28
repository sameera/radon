---
title: Grooming Sprint Bands
aliases: [band view, sprint bands, milestone headers, sprint card, goal column, backlog column, no-sprint band, current sprint, sprint progress]
touches: [live-backlog, grooming-backlog-view, grooming-sync, grooming-github-links, live-backlog-rows, sprint-goals, raiden-app-shell]
last_updated_by: "#82"
status: active
verification: verified
---

# Grooming Sprint Bands

For a signed-in lead, Grooming shows the backlog as one band per sprint, under headers for the milestones that contain the sprints. The goal column on the left holds the milestone headers and the sprint cards, and the backlog column on the right holds the issue rows. Without a live GitHub connection, Grooming shows only a sign-in note.

## How It Works

A Grooming load runs the Grooming sync and the backlog load together, and bands show only after both succeeded. A failure names its cause and offers one Try again for both.

Each issue goes in the band of its iteration on the sync source. An issue with no such iteration, or one matching no sprint, goes in the last band, whose card says so. Sprints sort by date. Each sprint sits under the milestone with the earliest due date on or after its start, comparing calendar dates with the due date read in UTC. Sprints after every due date have no header, and a "No milestone" separator marks where they start. Milestones with no due date come after the last sprint band, before the no-sprint band. A header shows the title, due date, first sprint's start, description and a link to edit the milestone in GitHub.

A sprint card shows the sprint's name, dates and goal. The current sprint is the one whose dates contain today, the earliest start winning. Its card alone carries the glow and a progress bar: the closed share of all its issues in GitHub, open and closed.

Below 760 pixels, each band stacks its card above its rows, and the divider hides.

## Key Invariants

1. Every issue the backlog query returns appears as a row in exactly one band.
2. An issue whose iteration on the sync source is sprint S appears only in the band of S.
3. When GitHub reports that an issue's project values were not all returned, the load fails, so no issue lands in the wrong band.
4. At most one element carries the glow: the current sprint's card.
5. The backlog column holds no sprint name, dates, glow or progress bar.
6. At every width, each band's card comes before its rows in focus and reading order.
7. ~~No card shows a goal field, a sample goal, a met or missed pill, or an invitation to drag.~~ Retired: cards carry the goal.

## Integration Points

- [live-backlog](live-backlog.md) — the band view's backlog column shows the live backlog, split into bands by each issue's iteration value.
- [grooming-backlog-view](grooming-backlog-view.md) — the filter, the divider and the preferred backlog width carry over, with the backlog on the right of the divider.
- [live-backlog-rows](live-backlog-rows.md) — each band's backlog column lists the rows of that band's issues, with parents in other bands shown only as crumbs.
- [grooming-sync](grooming-sync.md) — the bands and milestone headers come from the sprint and milestone records the sync returns.
- [grooming-github-links](grooming-github-links.md) — each milestone header links to the milestone's edit page in GitHub, in a new tab under the same link rules.
- [sprint-goals](sprint-goals.md) — each sprint card holds its sprint's goal, as a goal field for a goal editor and as text for everyone else.
- [raiden-app-shell](raiden-app-shell.md) — the shell shows Grooming first and gives it the gateway, the signed-in person and the backlog width.

## Decision Log

### 2026-11-28 — #81 — Sprints become bands in two columns, with the plan on the left
Story #88 requires two columns, and sample goals beside real sprints would read as real data, so the band view replaces both panels for a signed-in lead. The goal column is on the left because the plan is the page's main surface, and with that order the page reads the same side by side and stacked. A sprint's name, dates, glow and progress sit on its card, so the backlog column stays a plain list that later epics can search and drop onto. Progress counts all of the sprint's issues in GitHub, because the backlog lists open issues only and a share over its rows would always read 0%. Bands show only after a complete load, because a sync failure shown as one band would label issues as having no sprint when they have one. Refuted alternative: the mock's order, with the backlog on the left. It matched the reviewed mock and the existing build, but it put the plan second and made the stacked order differ from the side-by-side order.

### 2026-11-28 — #82 — Sprint cards carry the goal, and the sample page gives way to a sign-in note
Each sprint card now shows its sprint's goal, because the goal belongs beside the sprint's issues. Invariant 7 is struck, because a goal editor's card now holds a goal field. The no-sprint band is not a sprint, so its card has no goal. A host with no live GitHub connection now shows a note that Grooming needs a GitHub sign-in instead of the sample page, because both real hosts already show the sign-in screen to a signed-out person. The grooming-plan page is retired, so its edge is dropped. The sprint-goals and raiden-app-shell pages name this page as a neighbour, so this page names them back. Refuted alternative: keep the sample page, without goals, as a demo for hosts with no connection. It keeps a backlog for tests and screenshots, but it keeps the plan code alive for a path no real host uses.
