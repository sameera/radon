---
feature: "Grooming Tab"
feature_issue: "#10"
feature_path: docs/features/grooming-tab
epic: "Grooming shows the backlog in sprint bands under milestone headers"
slug: grooming-sprint-bands
created: 2026-11-27
type: enhancement
complexity: L
complexity_drivers: [Raiden stores its first GitHub-sourced records and the backend has no data API yet, two GitHub sync sources (milestones and the linked project's iterations), the band view depends on both syncs and on each issue's sprint, the data-ownership standard changes]
concepts: ["grooming-plan", "live-backlog", "raiden-app-shell", "grooming-backlog-view", "grooming-github-links", "raiden-page-host", "grooming-undo-save", "github-client", "github-sign-in"]
link: "#81"
record: "#93"
record_state: closed
---

# Epic: Grooming shows the backlog in sprint bands under milestone headers

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

The Grooming page shows the live backlog in one list today, beside a list of sample goals. This epic turns Grooming into one two-column view. Each sprint is a horizontal band. The goal column on the left holds the milestone headers and, in each band, the sprint's card: its name, its dates and room for its goal. The backlog column on the right holds only the sprint's issues. Milestones are headers above the sprints whose dates they contain.

Raiden keeps its own records of the repository's milestones and sprints. It syncs them from GitHub: milestones from the repository, and sprints from the iterations of the repository's linked GitHub Project. Raiden writes nothing to GitHub. Writing to GitHub stays prohibited until a later write-back epic.

The lead then sees the real backlog split by the team's own sprints and milestones. The later epics in this initiative add a goal to each sprint, let the lead move issues between sprints, and let the lead create sprints where GitHub has none. Each of them builds on the bands and on the records this epic syncs.

## Success Metrics

- Every issue the backlog query returns appears in exactly one band.
- Each sprint band holds exactly the issues whose sprint in GitHub is that sprint.
- A sprint or milestone changed in GitHub shows the change in Grooming on the next page load.
- Grooming sends no write request to GitHub.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Raiden keeps the repository's sprints synced from GitHub; Raiden keeps the repository's milestones synced from GitHub; Standards and product context state the new data rule; Grooming shows sprint bands under milestone headers; Each issue appears once, in its own sprint's band; Issues with no sprint sit in a last band; The current sprint shows the one glow and a progress bar; Columns stack under 760px

## User Stories

### Story #85: Raiden keeps the repository's sprints synced from GitHub

- **story_type:** system
- **size:** M

**As an** engineering lead, **I want** Raiden to hold the sprints of my repository's linked GitHub Project, **so that** Grooming can show them and later epics can attach goals and issues to them.

## Acceptance Criteria

- [ ] **Given** a repository whose linked GitHub Project has iterations, **when** the lead opens Grooming, **then** Raiden holds one sprint per iteration, with the same name, start date and end date as GitHub.
- [ ] **Given** an iteration was added, renamed, re-dated or removed in GitHub, **when** the lead next opens Grooming, **then** every one of Raiden's synced sprints matches GitHub after that page load.
- [ ] **Given** a repository with no linked project, **when** the lead opens Grooming, **then** Raiden holds no synced sprints and the page shows no error.
- [ ] **Given** a sync runs, **then** Raiden sends zero write requests to GitHub.
- [ ] **Given** a sprint came from GitHub, **then** Raiden marks it as synced from GitHub, so a later epic can keep it read-only.
- [ ] **Given** a team deploys Raiden's backend, **then** the setup instructions name the table, the backend's permission to read and write it, the request header the backend must accept, and the GitHub App's organization-level Projects read-only permission.

### Story #86: Raiden keeps the repository's milestones synced from GitHub

- **story_type:** system
- **size:** M

**As an** engineering lead, **I want** Raiden to hold my repository's GitHub milestones, **so that** Grooming can group sprints under them.

## Acceptance Criteria

- [ ] **Given** a repository with GitHub milestones, **when** the lead opens Grooming, **then** Raiden holds one milestone per GitHub milestone, with the same title, due date and description.
- [ ] **Given** a milestone was added, edited or deleted in GitHub, **when** the lead next opens Grooming, **then** every one of Raiden's synced milestones matches GitHub after that page load.
- [ ] **Given** a repository with no GitHub milestones, **when** the lead opens Grooming, **then** Raiden holds no synced milestones and the page shows no error.
- [ ] **Given** a sync runs, **then** Raiden sends zero write requests to GitHub.

### Story #87: Standards and product context state the new data rule

- **story_type:** system
- **size:** S

**As an** engineer on Raiden, **I want** the project standards and the product context to say which data Raiden owns, **so that** the sync records this epic adds do not contradict a written rule.

## Acceptance Criteria

- [ ] **Given** the project standards, **then** they state that Raiden owns its milestone, sprint, sprint goal and sprint assignment records, and that GitHub is a sync source for milestones and sprints.
- [ ] **Given** the project standards, the technology stack page and the product context, **then** zero sentences remain that forbid Raiden from holding its own records of milestones and sprints, or that call such a record a cache only.
- [ ] **Given** the project standards and the product context, **then** the prohibition on writing to GitHub and the "no issue editing" anti-goal remain in force, and say they last until the write-back epic.

### Story #88: Grooming shows sprint bands under milestone headers

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** Grooming to show each sprint as a band under its milestone, **so that** I see the backlog in the shape of my team's plan.

## Acceptance Criteria

- [ ] **Given** synced sprints, **when** the lead opens Grooming, **then** the page shows two columns, the goal column on the left and the backlog column on the right, and each sprint is one horizontal band, in date order.
- [ ] **Given** a sprint band, **then** the goal column holds the sprint's card with the sprint's name and dates, and the backlog column holds only the band's issue rows.
- [ ] **Given** synced milestones, **then** each sprint sits under the milestone with the earliest due date on or after the sprint's start date, so a sprint that spans two milestones sits under the earlier one.
- [ ] **Given** a milestone header, **then** it sits in the goal column and shows the milestone's title, its due date, and a start date equal to the start date of its first sprint, or no start date when no sprint sits under it.
- [ ] **Given** a milestone header, **then** it shows the milestone's description as read-only text, with a link that opens the milestone for editing in GitHub.
- [ ] **Given** a sprint that starts after every milestone's due date, or a repository with no milestones, **then** the sprint's band appears in date order with no milestone header above it.

## Notes

Until the story that places each issue in its band lands, the bands show no rows, and the backlog column keeps today's single list below the last band.

### Story #89: Each issue appears once, in its own sprint's band

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** each issue shown in the band of its own sprint, **so that** a row's sprint is always the band beside it.

## Acceptance Criteria

- [ ] **Given** an issue whose sprint in GitHub is sprint S, **when** Grooming shows the bands, **then** the issue appears as a row in the band of S and in no other band.
- [ ] **Given** an issue whose parent is in a different band or is not in the backlog, **then** the parent appears above the issue's group as a crumb only, not as a row.
- [ ] **Given** the rows of one band, **then** they keep today's backlog list form: ancestor crumbs above a group, then the rows, indented by depth.

### Story #90: Issues with no sprint sit in a last band

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** issues with no sprint gathered in one band, **so that** every backlog issue stays on the page.

## Acceptance Criteria

- [ ] **Given** an issue with no sprint in GitHub, **when** Grooming shows the bands, **then** the issue appears in a band placed after every sprint band.
- [ ] **Given** a repository with no linked project, **when** the lead opens Grooming, **then** every backlog issue appears in that last band.
- [ ] **Given** the last band, **then** its card in the goal column says that its issues have no sprint.

### Story #91: The current sprint shows the one glow and a progress bar

- **story_type:** user
- **size:** S

**As a** scrum master, **I want** the current sprint marked and its progress shown, **so that** I find this sprint and see how far it has come at a glance.

## Acceptance Criteria

- [ ] **Given** today falls between a sprint's start date and end date, **when** Grooming shows the bands, **then** that sprint's card in the goal column is the only element on the page that carries the glow, and the card shows the sprint's progress bar.
- [ ] **Given** the current sprint has issues in GitHub, open or closed, **then** its progress bar shows the share of them that are closed: 3 closed out of 12 shows 25%.
- [ ] **Given** no sprint contains today's date, **then** no card carries the glow or a progress bar.

### Story #92: Columns stack under 760px

- **story_type:** user
- **size:** S

**As a** developer, **I want** Grooming to stay readable on a narrow window, **so that** I can check a sprint on a small screen.

## Acceptance Criteria

- [ ] **Given** a page narrower than 760 pixels, **when** Grooming shows the bands, **then** the two columns stack, and each sprint's part of the goal column sits above its rows.
- [ ] **Given** a page 760 pixels wide or wider, **then** the two columns sit side by side.
- [ ] **Given** a page 360 pixels wide, **then** the page does not scroll sideways.

## Assumptions

- Raiden syncs milestones and sprints when the lead opens Grooming, as the signed-in lead. There is no background sync in this epic.
- When the repository has several linked projects, Raiden picks the earliest-created linked project with an iteration field, and keeps that pick until the project is unlinked or loses its iteration field.
- An issue's sprint in this epic is its sprint in GitHub. Sprint assignments stored in Raiden arrive with the epic for moving issues between sprints.
- Each sprint's card shows the sprint's name and dates, and leaves room for the sprint's goal until the sprint-goals epic fills it.

## Out of Scope

- Writing and editing sprint goals, and deleting the sample goals, their ranking and the sample page. These belong to #82. From this epic on, the signed-in band view shows no sample goals.
- One search over both columns, and folding past sprints. These belong to #82.
- Moving issues between sprints, and the row flags for disagreement with GitHub. These belong to #83.
- Creating and editing sprints and milestones in Raiden. These belong to #84.
- Any write to GitHub, and any change to the GitHub App's permissions other than adding the organization-level Projects read-only permission.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #85 | none |
| #86 | #85 |
| #87 | none |
| #88 | #85, #86 |
| #89 | #88 |
| #90 | #89 |
| #91 | #88 |
| #92 | #88 |
