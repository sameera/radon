---
feature: "Grooming Tab"
feature_issue: "#10"
feature_path: docs/features/grooming-tab
epic: "Grooming page sidebar, backlog, keyboard planning, save state, and undo"
slug: grooming-page-deferred-interactions
created: 2026-11-21
type: enhancement
complexity: M
complexity_drivers: [4 stories, one S and three M, all inside the existing Grooming page and its fixed sample data]
concepts: ["grooming-plan", "raiden-app-shell", "raiden-page-host"]
link: "#8"
record: "#19"
record_state: closed
---

# Epic: Grooming page sidebar, backlog, keyboard planning, save state, and undo

## Description

Epic #3 built the Grooming page on fixed sample data. Four interactions were left out of it. This epic adds them.

The sidebar can collapse to give the page more room. The backlog can be filtered and resized. A lead can plan an item into a goal from a keyboard menu, without dragging. The page shows whether the plan is saved, and a lead can undo a change.

The value is that the page works for a lead who prefers the keyboard, and for a lead who needs room to read a long backlog. It also shows the save state before real data is connected. All data stays fixed sample data, and no control sends a network request.

## Success Metrics

- A lead can plan an item into a goal using only the keyboard.
- Using every new control sends no network request.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Collapse the sidebar; Filter and resize the backlog; Plan items from the keyboard menu; Save state and undo

## User Stories

### Story #15: Collapse the sidebar

**As a** lead, **I want** to collapse the sidebar, **so that** the Grooming page has more room.

## Acceptance Criteria

- [ ] **Given** the sidebar is open, **when** I collapse it, **then** it shrinks to a narrow rail and the page uses the freed width
- [ ] **Given** the sidebar is collapsed, **when** I expand it, **then** it returns to its full width with its labels
- [ ] **Given** the sidebar is collapsed, **when** I focus or hover a rail item, **then** its name is shown
- [ ] **Given** I collapsed the sidebar, **when** I reload the Raiden page, **then** the sidebar is still collapsed

### Story #16: Filter and resize the backlog

**As a** lead, **I want** to filter the backlog and change its width, **so that** I can find an item and read long titles.

## Acceptance Criteria

- [ ] **Given** the backlog lists initiatives and epics, **when** I type a title or an issue number, **then** only matching items show
- [ ] **Given** a filter matches nothing, **when** the list updates, **then** the page says no items match
- [ ] **Given** the backlog and the goals panel are side by side, **when** I drag the divider between them, **then** the backlog width changes and the goals panel takes the rest
- [ ] **Given** I resize with the keyboard, **when** I press an arrow key on the divider, **then** the width changes in steps
- [ ] **Given** I changed the backlog width, **when** I reload the Raiden page, **then** the backlog has the width I chose, fitted to the space available

- [ ] **Given** focus is in the filter or in a goal name field, **when** I type, **then** GitHub's own keyboard shortcuts do not run (R1 on #19; start with a manual check on github.com)

### Story #17: Plan items from the keyboard menu

**As a** lead who does not use a pointer, **I want** to plan items into goals from a menu, **so that** every drag and drop action also has a keyboard path.

## Acceptance Criteria

- [ ] **Given** focus is on a backlog item or a goal, **when** I open its menu, **then** the menu lists the planning actions that drag and drop offers for it
- [ ] **Given** the menu is open, **when** I choose an action, **then** the plan changes exactly as the same drag and drop would change it
- [ ] **Given** the menu is open, **when** I press Escape, **then** the menu closes and focus returns to where it was

### Story #18: Save state and undo

**As a** lead, **I want** the page to show whether my plan is saved and to let me undo a change, **so that** I can try a plan without fear.

## Acceptance Criteria

- [ ] **Given** I change the plan, **when** the change is made, **then** the page shows that there are unsaved changes
- [ ] **Given** there are unsaved changes, **when** I press Save plan, **then** the page shows that the plan is saved
- [ ] **Given** I made a change, **when** I choose Undo, **then** the plan returns to its state before that change

## Assumptions

- All data stays fixed sample data, and Save plan changes only what the page shows.
- The new controls follow the layout in the reference mockup `.tmp/radon-grooming-tab.html`, except: Undo is a button beside Save plan, not a message that disappears; the sidebar and backlog width are kept in the extension's own storage, not the page's; the All and Not planned switch and the [ shortcut are not built; issue numbers stay plain text, not links.

## Out of Scope

- Reading initiatives and epics from GitHub.
- Storing goals and plans in the Raiden backend.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #15 | none |
| #16 | none |
| #17 | none |
| #18 | none |
