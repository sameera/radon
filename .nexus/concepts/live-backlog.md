---
title: Live Backlog
aliases: [live backlog, backlog query, backlog load, sprint values]
touches: [grooming-backlog-view, raiden-app-shell, github-client, repository-context, grooming-sprint-bands, live-backlog-rows]
last_updated_by: "#82"
status: active
verification: verified
---

# Live Backlog

For a signed-in person, the Grooming backlog loads the current repository's open issues from GitHub, with each issue's full chain of parent issues and its sprint values. The backlog shows issues only after the whole load succeeds, and it never changes an issue.

## How It Works

With a gateway and a signed-in person, the live backlog fills the band view's backlog column. The backlog runs the fixed query "is:issue state:open", and Raiden confines it to the current repository. Each answer carries up to 100 issues, each with three levels of parents and its sprint values. Higher parents are read together, one level at a time, until every chain ends.

The tree holds only query issues and the parents above them, joined on GitHub's issue identity. GitHub reports a parent the person cannot read as no parent, so the chain ends below it.

A load shows a loading state until it ends. A failed load names its cause and offers Try again. Above 1,000 issues, the backlog shows 1,000 and says how many it does not show.

## Key Invariants

1. ~~Every issue the query returns appears exactly once, under the chain of parents GitHub records for it.~~ Rewritten and moved with the split to live-backlog-rows.
2. ~~An issue that is neither returned by the query nor above a returned issue never appears.~~ Moved with the split to live-backlog-rows.
3. The backlog shows issues only after every request of the backlog load and of the sprint and milestone sync succeeded. An answer that reports errors is a failed request.
4. An answer for an earlier repository or an earlier signed-in person is never shown.
5. The backlog reads GitHub only through the host's gateway, as the signed-in person, and never changes an issue.
6. Issue titles stay in page memory. They are never stored as a preference or sent to the backend.
7. ~~A live backlog row can be neither dragged, given an item menu, nor labelled with a goal.~~ Moved with the split to live-backlog-rows.

## Integration Points

- [grooming-sprint-bands](grooming-sprint-bands.md) — the live backlog fills the band view's backlog column, split into bands by each issue's iteration value on the sync source.
- [grooming-backlog-view](grooming-backlog-view.md) — the same filter and width apply, and a matching row shows with its descendants under its full chain.
- [raiden-app-shell](raiden-app-shell.md) — the shell gives Grooming the gateway and the signed-in person for the live backlog.
- [github-client](github-client.md) — every backlog request goes through the shared client, whose failure kinds become the backlog's named failure causes.
- [repository-context](repository-context.md) — a new load starts when the current repository changes, and the backlog drops an answer for the previous one.
- [live-backlog-rows](live-backlog-rows.md) — the rows page shows the issues and parent chains this load returns.

## Decision Log

### 2026-11-26 — #73 — Read issues with their parents in one search, and show only complete loads
The backlog reads the query through GitHub's GraphQL search, and each answer also carries every issue's parents to three levels. So a backlog of a few hundred issues loads in a handful of requests, with no new permission and no backend work. Parents above three levels are read in batches, one level at a time, so the number of rounds depends on the tree's height, not on the number of issues. The tree joins on issue identity, so a parent in another repository cannot merge with a local issue that has the same number. The backlog shows nothing until the whole load succeeds, because a partial tree misplaces issues and looks complete. A repository the App cannot read gets its own message, because search would otherwise return an empty result that reads as "no open issues". Above 1,000 issues, the backlog says how many are missing, because search returns no more. A loop of parents is cut at its lowest-numbered issue, so the issues under the loop still show. Refuted alternative: REST issue search plus one parent lookup per issue. It reuses the repository picker's paging, but 300 issues cost 300 or more requests against a search limit of 30 requests a minute.

### 2026-11-28 — #81 — The backlog reads each issue's sprint, and its rows split out
The backlog load now also reads each issue's iteration values, in the same answers it already reads, and the browser matches them to sprints. This keeps invariants 5 and 6: the backlog reads GitHub only through the gateway, and issue titles never reach the backend. Invariant 3 is rewritten as the record states, because a load now includes the sprint and milestone sync. The record's rewrite of invariant 1 put the page over the 400-word cap, so how the loaded issues show as rows moved to the new live-backlog-rows page. Invariants 1, 2 and 7 moved with it and are struck here, so the other numbers keep their meaning. The link to grooming-github-links moved too, because the links sit on rows. Refuted alternative: the backend reads every issue's iteration during the sync and returns each issue's sprint. The browser would do less work, but the backend would page through every project item on each load, and issue data would start reaching the backend.

### 2026-11-28 — #82 — The grooming-plan edge goes with the sample page
The sample Grooming page and its plan counts are deleted, so the live backlog is the only backlog and the shell has no counts to hide. The grooming-plan page is retired, so its edge is dropped. Refuted alternative: none.
