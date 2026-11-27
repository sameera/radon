---
feature: "Live Backlog"
feature_path: docs/features/live-backlog
feature_issue: "#72"
epic: "Backlog shows the repository's open issues as a hierarchy"
slug: backlog-open-issues-hierarchy
created: 2026-11-26
type: enhancement
complexity: M
complexity_drivers: [issues paged in from a GitHub search, ancestors the search did not return are read one by one, a tree of any depth replaces the two-level sample backlog]
concepts: ["repository-context", "raiden-app-shell", "raiden-page-host", "raiden-web-view", "grooming-github-links", "web-repository-picker"]
link: "#73"
record: "#76"
record_state: closed
---

# Epic: Backlog shows the repository's open issues as a hierarchy

## Description

The Grooming backlog panel shows sample initiatives and epics today. This epic replaces them with the current repository's open issues, read from GitHub as the signed-in lead. The backlog uses one fixed query, "is:issue state:open". A later Settings page will make the query configurable.

Each issue appears once, under its full chain of parent issues. If the query returns I1, E1, S11 and S12, and E1 is the parent of S11 and S12 and I1 is the parent of E1, the backlog shows I1, then E1 under I1, then S11 and S12 under E1. A parent the query did not return, for example a closed E1, still appears in its place in the tree, grayed out, so the hierarchy stays whole.

The lead then sees the real backlog of the repository, in the shape the Nexus pipeline files it: initiatives, epics and stories.

## Success Metrics

- Every issue the query returns appears in the backlog exactly once.
- Every issue appears under the same chain of parents GitHub records for it.
- Every parent that the query did not return, but that an issue in the backlog sits under, appears grayed out.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Show the open issues as a tree; Show parents outside the query grayed out

## User Stories

### Story #74: Show the open issues as a tree

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** the backlog to show the repository's open issues nested under their parents, **so that** I see the real initiative, epic and story structure while I groom.

#### Acceptance Criteria

- [ ] **Given** a repository with open issues, **when** the lead opens Grooming, **then** the backlog lists the issues that the query "is:issue state:open" returns for the current repository
- [ ] **Given** the query returns I1, E1, S11 and S12, with I1 the parent of E1 and E1 the parent of S11 and S12, **when** the backlog shows, **then** E1 is nested under I1, and S11 and S12 are nested under E1
- [ ] **Given** any returned issue, **when** the backlog shows, **then** the issue appears exactly once, under its full chain of parents
- [ ] **Given** a returned issue with no parent, **when** the backlog shows, **then** the issue is a top-level row
- [ ] **Given** the query returns more issues than GitHub sends in one answer, **when** the backlog shows, **then** every returned issue appears, up to the 1,000 issues GitHub search returns; above that, the backlog says how many issues it does not show
- [ ] **Given** the backlog cannot be read in full from GitHub, **when** the backlog shows, **then** it shows no issues, says why, and offers Try again

### Story #75: Show parents outside the query grayed out

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** a parent the query did not return to still appear in its place, grayed out, **so that** the hierarchy above an open issue stays whole.

#### Acceptance Criteria

- [ ] **Given** E1 is closed and the query returns I1, S11 and S12, **when** the backlog shows, **then** E1 appears under I1, grayed out, with S11 and S12 under it
- [ ] **Given** a returned issue whose parent and grandparent were both not returned, **when** the backlog shows, **then** both appear grayed out in their places above it
- [ ] **Given** a parent that was not returned has several returned descendants, **when** the backlog shows, **then** that parent appears once
- [ ] **Given** an issue the query did not return, with no returned descendant, **when** the backlog shows, **then** that issue does not appear

## Assumptions

- The parent of an issue is its parent issue in GitHub's sub-issue relation.
- Rows under the same parent are ordered by issue number, lowest first.
- The sprint goals and the starting plan stay on sample data until their own epic. Until then the header's planned-epics count and the sidebar's not-planned count are hidden, and live backlog rows show no goal label.

## Out of Scope

- Changing the backlog query in the application's Settings page.
- Dragging live backlog rows onto sprint goals, and the item menus on live backlog rows.
- Editing issues from the backlog.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #74 | none |
| #75 | #74 |
