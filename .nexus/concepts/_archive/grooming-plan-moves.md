---
title: Grooming Plan Moves
aliases: [item menu, keyboard planning, drag and drop, take out of plan]
touches: [grooming-plan]
last_updated_by: "#82"
status: deprecated
verification: verified
---

# Grooming Plan Moves

A lead changes the Grooming plan by drag and drop, by an item's menu, or by the Take out of plan button on a goal row. Each way makes the same plan change as the matching drop.

## How It Works

Items and goals move with the browser's own drag and drop. A dragged item is tracked inside the page, and the drag carries only a marker. Drags that started outside Raiden are ignored. An issue link inside a row is not draggable, so a drag that starts on it moves the row. A goal dropped on another goal goes before or after it, by the half the pointer is over. Move up and Move down in the goal menu change the same order.

Each backlog item has a menu that lists the goals its drop would be accepted on, and "Take out of plan" when the backlog would accept it.

Each planned row in a goal has a Take out of plan icon button. Its accessible name names the item and the goal, for example "Take epic #12 out of Goal 2". The button makes the same change as dropping the item on the backlog panel. So an epic whose initiative is planned moves back to the initiative's goal. After the row goes, focus moves to the next row's button, or to the goal's options button when no row follows. An epic planned under its initiative has no row of its own in a goal, so it has no button.

## Key Invariants

1. A drag that started outside Raiden never changes the plan.
2. A menu action changes the plan exactly as the matching drag and drop does.
3. The Take out of plan button changes the plan exactly as dropping the same item on the backlog panel does.
4. After a take-out, keyboard focus is on a control in the same goal card.
5. A drag that starts on an issue link moves the row and carries no link.

## Integration Points

- [grooming-plan](grooming-plan.md) — every move applies its change through the plan's one change path, and the plan's rules decide the result.

## Decision Log

### 2026-11-22 — #12 — Split from grooming-plan, and the take-out button keeps the backlog-drop rule
Split from grooming-plan when epic #12 would have pushed that page past the 400-word cap. A task about how a lead moves items loads this page, and a task about counts and own plans loads the plan page. Epic #12 made the goal-row take-out button an icon button named for the item and the goal, behind the same rule as a drop on the backlog panel. One shared rule means the button and the drop cannot drift apart, and the fallback to the initiative's goal comes with it. Without the focus rule, a keyboard user would lose focus each time a row vanishes. Links inside rows are not draggable, because a browser drags a link's address by default.

### 2026-11-28 — #82 — Retired: planning moves are deleted
Epic #82 deleted the Plan in Goal menu entries, the drops on goals, the Take out of plan button and its drop zone, because story #104 requires that no entry, drop or button plans an item into a goal. Live backlog rows were never dragged or planned, as the live-backlog-rows page states. Refuted alternative: none.
