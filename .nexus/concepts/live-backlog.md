---
title: Live Backlog
aliases: [live backlog, backlog query, open issues hierarchy, outside parent, backlog load]
touches: [grooming-plan, grooming-backlog-view, grooming-github-links, raiden-app-shell, github-client, repository-context]
last_updated_by: "#73"
status: active
verification: verified
---

# Live Backlog

For a signed-in person, the Grooming backlog shows the current repository's open issues from GitHub, each nested under its full chain of parent issues. A parent the query did not return shows grayed out in its place. The backlog shows issues only after the whole load succeeds, and it never changes an issue.

## How It Works

Grooming shows the live backlog when the shell has a GitHub gateway and a signed-in person. Otherwise it keeps the sample backlog. The backlog runs the fixed query "is:issue state:open", and Raiden confines it to the current repository. Each answer carries up to 100 issues, each with three levels of parents. Higher parents are read together, one level at a time, until every chain ends.

The tree holds only query issues and the parents above them, joined on GitHub's issue identity. Rows under one parent are ordered by issue number. A row with children can collapse, and the filter works at every level. A parent the query did not return is grayed and says that it is outside the query and what its state is. A parent in another repository shows its repository name. GitHub reports a parent the person cannot read as no parent, so the chain ends below it.

A load shows a loading state until it ends. A failed load names its cause and offers Try again. Above 1,000 issues, the backlog shows 1,000 and says how many it does not show. Live rows have no drag, menu or goal label.

## Key Invariants

1. Every issue the query returns appears exactly once, under the chain of parents GitHub records for it.
2. An issue that is neither returned by the query nor above a returned issue never appears.
3. The backlog shows issues only after every request of a load succeeded. An answer that reports errors is a failed request.
4. An answer for an earlier repository or an earlier signed-in person is never shown.
5. The backlog reads GitHub only through the host's gateway, as the signed-in person, and never changes an issue.
6. Issue titles stay in page memory. They are never stored as a preference or sent to the backend.
7. A live backlog row can be neither dragged, given an item menu, nor labelled with a goal.

## Integration Points

- [grooming-plan](grooming-plan.md) — the live backlog replaces the sample backlog panel, while the goals and the plan stay on sample data.
- [grooming-backlog-view](grooming-backlog-view.md) — the same filter and width apply, and a matching row shows with its descendants under its full chain.
- [grooming-github-links](grooming-github-links.md) — each row's reference links to the issue's page in the issue's own repository.
- [raiden-app-shell](raiden-app-shell.md) — the shell gives Grooming the gateway and the signed-in person, and hides the plan counts while the live backlog shows.
- [github-client](github-client.md) — every backlog request goes through the shared client, whose failure kinds become the backlog's named failure causes.
- [repository-context](repository-context.md) — a new load starts when the current repository changes, and the backlog drops an answer for the previous one.

## Decision Log

### 2026-11-26 — #73 — Read issues with their parents in one search, and show only complete loads
The backlog reads the query through GitHub's GraphQL search, and each answer also carries every issue's parents to three levels. So a backlog of a few hundred issues loads in a handful of requests, with no new permission and no backend work. Parents above three levels are read in batches, one level at a time, so the number of rounds depends on the tree's height, not on the number of issues. The tree joins on issue identity, so a parent in another repository cannot merge with a local issue that has the same number. The backlog shows nothing until the whole load succeeds, because a partial tree misplaces issues and looks complete. A repository the App cannot read gets its own message, because search would otherwise return an empty result that reads as "no open issues". Above 1,000 issues, the backlog says how many are missing, because search returns no more. A loop of parents is cut at its lowest-numbered issue, so the issues under the loop still show. Refuted alternative: REST issue search plus one parent lookup per issue. It reuses the repository picker's paging, but 300 issues cost 300 or more requests against a search limit of 30 requests a minute.
