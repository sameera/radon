---
title: Grooming Undo and Save State
aliases: [undo, save plan, unsaved changes, save state]
touches: [grooming-plan]
last_updated_by: "#8"
status: active
verification: verified
---

# Grooming Undo and Save State

The Grooming page shows whether the plan has unsaved changes, and a lead can undo plan changes one at a time. Unsaved means the current plan differs from the saved plan. Save plan and Undo change only what the page shows and send no request.

## How It Works

Every plan change goes through one change path. A change that alters nothing stops there: it adds no undo entry and leaves the save state alone. Any other change puts the earlier plan on the undo list. Typing in one goal's name or description field is one undo entry until focus leaves that field.

Undo is a button beside Save plan. Each press puts back the newest earlier plan, as far back as the plan the page opened with. Undo covers the plan only. It never changes which initiatives are open, the backlog filter, the backlog width or the sidebar. There is no Redo.

The saved plan is the plan at page load or at the last Save plan. Save plan makes the current plan the saved plan at once. Undoing back to the saved plan shows the plan as saved again, and undoing past a save shows unsaved changes. The save state is a status message that screen readers announce. Save plan and Undo stay focusable while they are unavailable, so keyboard focus stays on the page.

The undo list and the saved plan live in the same in-memory session state as the plan.

## Key Invariants

1. The page shows unsaved changes exactly when the plan differs from the saved plan.
2. A plan change that alters nothing adds no undo entry and does not change the save state.
3. Undo never changes the view state: open initiatives, filter, backlog width or sidebar.
4. Save plan and Undo send no network request.
5. The undo list and the saved plan survive a remount and are lost on reload.

## Integration Points

- [grooming-plan](grooming-plan.md) — every plan edit from a drop, a menu, a button or a goal field goes through the change path that records undo and save state.

## Decision Log

### 2026-11-22 — #8 — Multi-step Undo over the plan only, and unsaved means "differs from the saved plan"
Story #18 says "Given I made a change, when I choose Undo", which means any change, not only destructive ones. Undo is therefore a button that goes back many steps over the plan only, because initiative expansion lives in the same session state and must not count as a change. The save state is derived by comparing the current plan with the saved plan, so it stays true after Undo. Save plan is immediate and local, because the backend epic has not yet decided what saving means. Refuted alternative: the mockup's single-step undo in a message that disappears after six seconds, shown only after destructive changes, with an unsaved flag set on any change. It is less UI, but it does not cover a change in general, a timed control is hard for keyboard and screen-reader users, and the flag would still claim unsaved changes after undoing back to the saved plan.
