---
feature: "Grooming Tab"
feature_issue: "#10"
feature_path: docs/features/grooming-tab
epic: "Each sprint carries a goal the lead writes in Grooming"
slug: sprint-goals
created: 2026-11-27
type: enhancement
complexity: M
complexity_drivers: [sprint goals are the first record the lead writes into Raiden's own store, the sample goals and the plan built on them are removed from the page]
concepts: []
link: "#82"
record: "#107"
record_state: closed
---

# Epic: Each sprint carries a goal the lead writes in Grooming

## Description

After #81, Grooming shows each sprint as a band with a card that has room for a goal. The goal itself is still missing. The page also still carries sample goals that the lead ranks by hand. This epic lets the lead write one goal for each sprint in that card, and Raiden saves it.

Goal priority then follows the order of milestones and sprints. The ranked sample goals go away.

The scrum master can then set a goal for each sprint on the same page as the backlog. Nothing is written to GitHub.

## Success Metrics

- Every sprint band shows at most one goal, and a saved goal shows unchanged after a reload.
- No sample goal and no goal rank number appears in Grooming.
- Grooming sends no write request to GitHub while goals are written or edited.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The lead writes and edits a sprint goal; The sample goals and their ranking are removed

## User Stories

### Story #103: The lead writes and edits a sprint goal

**As a** scrum master, **I want** to write a goal in each sprint's card, **so that** the goal sits beside the sprint's issues instead of in chat or docs.

## Acceptance Criteria

- [ ] **Given** a sprint band with no goal, **when** the lead writes a goal in its card and leaves the field, **then** the card shows that goal.
- [ ] **Given** a sprint with a saved goal, **when** the lead reloads Grooming, **then** the card shows the same goal.
- [ ] **Given** a sprint with a goal, **when** the lead edits the goal and leaves the field, **then** the edited goal replaces the old one, also after a reload.
- [ ] **Given** a goal saved by one person, **when** another signed-in person opens Grooming on the same repository, **then** they see the same goal.
- [ ] **Given** the save of a goal fails, **when** the card is shown, **then** it keeps the lead's text and says the goal is not saved, with a way to try again.

### Story #104: The sample goals and their ranking are removed

**As a** lead, **I want** the sprint goals to be the only goals on the page, ordered by milestone and sprint, **so that** there is one place goals come from and one order they follow.

## Acceptance Criteria

- [ ] **Given** any person opens Grooming, signed in or not, **when** the page shows, **then** no sample goal appears.
- [ ] **Given** Grooming shows goals, **when** the lead reads the goal column, **then** no goal carries a rank number, and the goals follow milestone order and then sprint order.
- [ ] **Given** Grooming, **when** the lead looks for goal controls, **then** each sprint has exactly one goal card, and there is no control to add, delete or reorder a goal.
- [ ] **Given** Grooming, **when** the lead opens an item's menu or drags an item, **then** no entry, drop or button plans the item into a goal, and the Grooming sidebar item shows no count of epics not planned.

## Assumptions

- Any signed-in person whose GitHub role on the repository is maintain or admin can write and edit its sprint goals. Others see the goals and cannot edit them. There is no separate Raiden permission for goals.
- Marking a past sprint's goal met or missed arrives with #105.
- A sprint goal is one short text. It has no separate title and description.
- Removing the sample goals also removes planning items into goals: the Plan in Goal menu entries, the drops on goals, the Take out of plan button, and the Grooming sidebar count of epics not planned. It also removes the sample page, with its sample backlog, Undo, Save plan and Show issues switch; a host with no live GitHub connection shows a note that Grooming needs a GitHub sign-in. Moving issues between sprints arrives with #83.

## Out of Scope

- Moving issues between sprints, and the row flags for disagreement with GitHub. These belong to #83.
- Creating and editing sprints and milestones in Raiden. These belong to #84.
- Any write to GitHub, including writing the goal into a GitHub field.
- Changing the backlog query.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #103 | none |
| #104 | #103 |
