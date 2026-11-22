---
feature: "Grooming Tab"
feature_issue: "#10"
feature_path: docs/features/grooming-tab
epic: "Grooming page details from the reference mockup"
slug: grooming-mockup-details
created: 2026-11-21
type: enhancement
complexity: M
complexity_drivers: [5 stories, all S, one change reverses the no-navigation guarantee of the Grooming page record, the not-planned count feeds the sidebar tooltip]
concepts: ["grooming-plan", "raiden-app-shell", "raiden-page-host"]
link: "#12"
record: "#25"
record_state: closed
---

# Epic: Grooming page details from the reference mockup

## Description

The Grooming page still lacks five small details that the reference mockup `.tmp/radon-grooming-tab.html` shows. Each one is a visible control or hint that a lead expects when planning goals.

A lead can take an item out of a goal from the item's row in the goal. The Grooming item in the sidebar shows how many epics are not planned. A link on the backlog opens GitHub to create a new initiative. Issue numbers open the issue on GitHub. Sidebar items show a tooltip.

The value is that the page matches the mockup the team agreed on. All data stays fixed sample data.

## Success Metrics

- In review, each of the five details looks and behaves as it does in the reference mockup.
- The not-planned count in the sidebar always equals the number of epics that are not planned in any goal.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Take an item out of a goal from its row; Not-planned count on the Grooming sidebar item; New initiative in GitHub link; Issue numbers open the issue on GitHub; Sidebar tooltips

## User Stories

### Story #20: Take an item out of a goal from its row

**As an** engineering lead, **I want** a button on each planned row in a goal that takes that item out of the goal, **so that** I can undo a placement without dragging the item back to the backlog.

## Acceptance Criteria

- [ ] **Given** a goal that holds a planned epic or initiative, **when** I look at its row, **then** the row shows a Take out of plan button.
- [ ] **Given** a planned item in a goal, **when** I select its Take out of plan button, **then** the item is no longer planned on its own in that goal.
- [ ] **Given** an epic whose initiative is planned in a goal, **when** I take the epic out of its own goal, **then** the epic stays planned with its initiative.
- [ ] **Given** an item is taken out of a goal, **when** the page updates, **then** every count and label on the page matches the new plan.

## Notes

Dropping an item on the backlog panel already does the same thing. This story adds the button as a second way.

### Story #21: Not-planned count on the Grooming sidebar item

**As an** engineering lead, **I want** the Grooming item in the sidebar to show how many epics are not planned, **so that** I see what is left to plan without opening the backlog.

## Acceptance Criteria

- [ ] **Given** one or more epics are not planned in any goal, **when** I look at the sidebar, **then** the Grooming item shows that number.
- [ ] **Given** every epic is planned in a goal, **when** I look at the sidebar, **then** the Grooming item shows no count.
- [ ] **Given** I plan an epic or take one out of a goal, **when** the page updates, **then** the sidebar count changes to match, with no reload.

### Story #22: New initiative in GitHub link

**As an** engineering lead, **I want** a New initiative in GitHub link at the foot of the backlog panel, **so that** I can start a new initiative in GitHub without leaving the planning flow.

## Acceptance Criteria

- [ ] **Given** the backlog panel, **when** I look at its foot, **then** it shows a New initiative in GitHub link.
- [ ] **Given** the link, **when** I select it, **then** GitHub's page for creating an issue opens in a new browser tab and the Grooming page stays as it was.

## Notes

Raiden does not edit issues. The link only opens GitHub, where the initiative is created.

### Story #23: Issue numbers open the issue on GitHub

**As an** engineering lead, **I want** each issue number on the page to open that issue on GitHub, **so that** I can read an item's detail while I plan it.

## Acceptance Criteria

- [ ] **Given** an initiative or epic row, **when** I select its issue number, **then** that issue opens on GitHub in a new browser tab.
- [ ] **Given** I select an issue number, **when** the issue opens, **then** the Grooming page and its plan stay as they were.
- [ ] **Given** I use the keyboard, **when** I focus an issue number and press Enter, **then** it opens the issue as a click does.
- [ ] **Given** a row in the backlog or a goal, **when** I drag it by its issue number, **then** the row moves as it does when dragged from anywhere else, and no link is dragged.

## Notes

The decision record of epic #3 says no control sends a network request and that issue numbers are plain text. This story changes both. The record needs a revision before this story is built.

### Story #24: Sidebar tooltips

**As an** engineering lead, **I want** a tooltip on each sidebar item, **so that** I can tell what an item is, and see the not-planned count in words, when I hover over it or focus it.

## Acceptance Criteria

- [ ] **Given** a sidebar item, **when** I hover over it or focus it with the keyboard, **then** a tooltip shows the page name.
- [ ] **Given** epics are not planned, **when** I hover over or focus the Grooming item, **then** its tooltip also states how many are not planned.
- [ ] **Given** I move the pointer or the focus away, **when** the item loses it, **then** the tooltip is gone.

## Assumptions

- Issue numbers in the sample data open the page for that number in the current repository.
- The New initiative in GitHub link opens the create-issue page of the current repository.

## Out of Scope

- Collapsing the sidebar, which epic #8 plans.
- Reading initiatives and epics from GitHub.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #20 | none |
| #21 | none |
| #22 | none |
| #23 | none |
| #24 | #21 |
