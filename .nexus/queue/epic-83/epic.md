---
feature: "Grooming Tab"
feature_issue: "#10"
feature_path: docs/features/grooming-tab
epic: "The lead moves issues between sprints in Grooming"
slug: move-issues-between-sprints
created: 2026-11-28
type: enhancement
complexity: M
complexity_drivers: [sprint assignments are the first per-issue record Raiden stores, every row compares Raiden's sprint with GitHub's on each load]
concepts: ["grooming-undo-save", "grooming-plan", "live-backlog", "grooming-plan-moves"]
link: "#83"
record: "#118"
record_state: closed
---

# Epic: The lead moves issues between sprints in Grooming

## Description

Grooming shows each issue in the band of its sprint in GitHub today. The lead cannot change that sprint from Grooming. This epic lets the lead move an issue to another sprint, by dragging its row onto another band or with the keyboard. Raiden saves the new sprint in its own records. Raiden writes nothing to GitHub.

Raiden's sprint wins over GitHub's iteration. So after a move, an issue can sit in one sprint in Raiden and in another sprint in GitHub. The row then shows a flag that names GitHub's sprint.

The lead can then plan the backlog into sprints from Grooming and see every issue whose sprint disagrees with GitHub. The later write-back epic writes the plan to GitHub. Until then the flag shows the lead what GitHub does not know yet.

## Success Metrics

- Every move the page reports as saved shows the issue in its new band on the next page load.
- Grooming sends no write request to GitHub.
- Every row whose sprint in Raiden differs from its sprint in GitHub carries the unsynced-with-GitHub flag, and no other row does.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Drag a row onto another sprint's band; Raiden's sprint wins and the row shows an unsynced-with-GitHub flag; Move a row with the keyboard inside its band and to the next band

## User Stories

### Story #114: Drag a row onto another sprint's band

- **story_type:** user
- **size:** M

**As a** lead, **I want** to drag an issue's row onto another sprint's band, **so that** I can plan the issue into that sprint without leaving Grooming.

#### Acceptance Criteria

- [ ] **Given** an issue row in one sprint's band, **when** the lead drops it on another sprint's band, **then** the row shows in that band, and it still shows there after the page is reloaded.
- [ ] **Given** an issue row in a sprint's band, **when** the lead drops it on the band for issues with no sprint, **then** Raiden records that the issue has no sprint, and the issue shows in that band after a reload.
- [ ] **Given** the lead moves a row, **when** the move is saved, **then** Grooming sends no write request to GitHub and the issue's sprint in GitHub is unchanged.
- [ ] **Given** a row that has child rows in the same band, **when** the lead drags it to another band, **then** only that issue moves, and each child keeps its own sprint.
- [ ] **Given** the lead drops a row on another band, **when** the save fails, **then** the row returns to the band it came from and the page says the move was not saved.
- [ ] **Given** the design system's usage rules, **then** rule 4 names sprint assignments, beside sprint goals, as Raiden data that gets edit controls, and still says nothing that shows an issue's own data looks editable.

### Story #115: Raiden's sprint wins and the row shows an unsynced-with-GitHub flag

- **story_type:** user
- **size:** S

**As a** lead, **I want** each moved issue to stay in the sprint I chose and to show where GitHub disagrees, **so that** I know which sprints GitHub does not know about yet.

#### Acceptance Criteria

- [ ] **Given** an issue whose sprint in Raiden differs from its sprint in GitHub, **when** Grooming loads, **then** the row shows in Raiden's sprint's band with a flag that names its sprint in GitHub, or says it has none.
- [ ] **Given** a moved issue, **when** its sprint changes in GitHub to a third sprint, **then** on the next load the row stays in Raiden's sprint's band and the flag names the new GitHub sprint.
- [ ] **Given** a flagged issue, **when** its sprint in GitHub becomes the same as its sprint in Raiden, or the lead moves it back to its GitHub sprint, **then** the flag is gone.
- [ ] **Given** an issue Raiden holds no sprint assignment for, **when** Grooming loads, **then** the row shows in its GitHub sprint's band with no flag.

### Story #116: Move a row with the keyboard inside its band and to the next band

- **story_type:** user
- **size:** S

**As a** lead who plans with the keyboard, **I want** to move a focused row to the next or previous band with a key press, **so that** I can plan sprints without a mouse.

#### Acceptance Criteria

- [ ] **Given** a focused row, **when** the lead presses Alt+Shift+Down, **then** the row moves to the top of the band below, it is saved as in a drag, and focus stays on the row.
- [ ] **Given** a focused row, **when** the lead presses Alt+Shift+Up, **then** the row moves to the bottom of the band above, it is saved, and focus stays on the row.
- [ ] **Given** a focused row in the last band, **when** the lead presses Alt+Shift+Down, **then** nothing moves. The same holds for Alt+Shift+Up in the first band.
- [ ] **Given** a focused row, **when** the lead presses Alt+Up or Alt+Down, **then** the row moves up or down inside its band, as it does today, and its sprint does not change.

## Assumptions

- A person whose GitHub role on the repository is maintain or admin can move rows. Others see the bands and the flags and cannot move rows.
- Raiden keeps one sprint per issue for the repository, shared by everyone who opens its Grooming page.
- The order of rows inside a band stays in page memory only, as it does today.
- Moves go only to sprints Grooming already shows. Sprints Raiden makes arrive with #84.

## Out of Scope

- Any write to GitHub, including the iteration field and the milestone, and any GitHub App permission change. These belong to the later write-back epic.
- Creating and editing sprints and milestones in Raiden. These belong to #84.
- Changing the backlog query.
- Moving several rows in one action.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #114 | none |
| #115 | #114 |
| #116 | #114 |
