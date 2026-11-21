---
feature: "Grooming Tab"
feature_path: docs/features/grooming-tab
feature_issue: "#10"
epic: "Grooming page layout and interactions on sample data"
slug: grooming-page-layout
created: 2026-11-21
type: enhancement
complexity: L
complexity_drivers: [4 stories, all M, new app shell shared by every Raiden page, two-panel page, drag and drop between both panels]
concepts: []
link: "#3"
record: "#11"
record_state: closed
---

# Epic: Grooming page layout and interactions on sample data

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

The Raiden tab gets its page frame and its first working page, Grooming. The frame is a sidebar that groups the Raiden pages (Sprint goal, Grooming, Timeline, Settings). The Grooming page has two panels. The backlog panel on the left lists initiatives with their epics. The goals panel on the right lists the next sprint's goals in priority order. A lead plans an epic or a whole initiative into a goal by drag and drop, and sets goal priority by reordering goals.

This epic builds the layout and every in-page interaction that the reference mockup `.tmp/radon-grooming-tab.html` shows. All data is fixed sample data. Raiden does not read GitHub and does not call the backend in this epic. The Save plan button changes only what the page shows.

The value is that the team can see, use and review the real Grooming page inside GitHub before any data work starts. The later data epics then connect a page whose layout and behaviour are already agreed.

## Success Metrics

- In review, the Grooming page matches the reference mockup's layout in GitHub light mode and dark mode.
- Using every control on the page sends no network request.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Sidebar navigation between Raiden pages; Grooming page layout; Plan items into goals by drag and drop; Add, reorder and delete goals

## User Stories

### Story #4: Sidebar navigation between Raiden pages

- **story_type:** user
- **size:** M

**As a** scrum master, **I want** a sidebar that lists the Raiden pages, **so that** I can move between sprint and roadmap views inside the Raiden tab.

#### Acceptance Criteria

- [ ] **Given** a repository page, **when** the user selects the Raiden tab, **then** the Raiden page replaces the repository content below the tab bar and the Raiden tab is marked as the current tab.
- [ ] **Given** the Raiden tab is open, **when** the page loads, **then** the sidebar shows the Raiden name, the project name, a Sprint group with Sprint goal and Grooming, a Roadmap group with Timeline, and Settings.
- [ ] **Given** the sidebar, **when** it renders, **then** its foot shows the current sprint, the days until it ends, and the next sprint's name and dates.
- [ ] **Given** any page is showing, **when** the user selects another sidebar item, **then** that page shows and only that item is marked as the current page.
- [ ] **Given** the user opens Sprint goal, Timeline or Settings, **when** the page shows, **then** it shows the page title and a short placeholder text.
- [ ] **Given** GitHub is in light or dark color mode, **when** any Raiden page shows, **then** its colors match that mode.


## Notes

- Design-system controls this story adds: the sidebar nav item and the icon button, plus the display font. The text input, the switch and the popup menu are not part of this story; #5 and #7 add them (decision record #11, D3 and R2).

### Story #5: Grooming page layout

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** the Grooming page to show the backlog beside the sprint goals, **so that** I can see what is planned and what is not in one view.

#### Acceptance Criteria

- [ ] **Given** the Grooming page opens, **when** it renders, **then** the header shows the sprint name and dates, the page title, a one-line instruction, the count of planned epics out of all epics, the save state, and a Save plan button.
- [ ] **Given** the sample backlog, **when** the backlog panel renders, **then** each initiative shows its number and title, its epics are nested under it, and the user can hide or show an initiative's epics.
- [ ] **Given** an epic or initiative is planned, **when** the backlog renders, **then** its row shows the goal it is planned in, and a partly planned initiative shows how many of its epics are planned.
- [ ] **Given** the sample goals, **when** the goals panel renders, **then** each goal shows its rank, name, description, epic count and planned epics and initiatives, and a goal with no items shows a drop hint.
- [ ] **Given** the goals panel, **when** the user turns off Show issues, **then** each goal hides its planned epics and initiatives and shows counts only, and the choice is kept after a reload.

## Notes

- Design-system controls this story adds: the text input and the switch, each with its guideline page and preview entry (decision record #11, D3 and R2).

### Story #6: Plan items into goals by drag and drop

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** to drag epics and initiatives onto goals, **so that** I can plan the sprint by moving work into the goal it serves.

#### Acceptance Criteria

- [ ] **Given** an unplanned epic or initiative, **when** the user drops it on a goal, **then** it appears in that goal's list, and the backlog row and the planned count update.
- [ ] **Given** a planned item, **when** the user drops it on a different goal, **then** it moves to that goal and leaves the first one.
- [ ] **Given** a planned item, **when** the user drops it on the backlog panel, **then** it is no longer planned on its own, and an epic whose initiative is planned stays planned with that initiative.
- [ ] **Given** an epic whose initiative is planned in a goal, **when** the user plans that epic in another goal, **then** the epic is planned on its own in the new goal.
- [ ] **Given** a drag is in progress, **when** the pointer is over a valid drop target, **then** that target is highlighted.

### Story #7: Add, reorder and delete goals

- **story_type:** user
- **size:** M

**As a** scrum master, **I want** to add, name, reorder and delete goals, **so that** the goal list states the sprint's outcomes in priority order.

#### Acceptance Criteria

- [ ] **Given** the goals panel, **when** the user selects Add goal, **then** an empty goal appears last and its name field gets focus.
- [ ] **Given** a goal, **when** the user edits its name or description, **then** the text is kept and the description field grows to fit it.
- [ ] **Given** two or more goals, **when** the user drags a goal by its handle, **then** the goal moves to the drop position and every rank updates.
- [ ] **Given** a goal, **when** the user picks Move up or Move down from its options menu, **then** the goal moves one position.
- [ ] **Given** a goal, **when** the user picks Delete goal, **then** the goal is removed and its items return to the backlog.

## Notes

- Design-system controls this story adds: the popup menu, with its guideline page and preview entry (decision record #11, D3 and R2).

## Assumptions

- All initiatives, epics and goals are fixed sample data in the page.
- The Raiden page shows inside the Raiden tab that epic #1 adds to the repository tab bar.
- The goals belong to the next sprint, and the sprint names and dates are sample values.

## Out of Scope

- Reading initiatives and epics from GitHub.
- Storing goals and plans in the Raiden backend.
- The content of the Sprint goal, Timeline and Settings pages.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #4 | none |
| #5 | #4 |
| #6 | #5 |
| #7 | #5 |
