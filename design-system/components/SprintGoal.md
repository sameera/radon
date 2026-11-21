# SprintGoal

The SprintGoal card states the current iteration's goal in one sentence. It is the most prominent thing Radon puts on a GitHub Projects page.

- The card uses `rd-brand-muted` ground, an `rd-brand` edge, `rd-radius-lg` and `rd-shadow-glow`. Only one glowing element per view, and this is usually it.
- The eyebrow names the iteration as GitHub names it ("Sprint 14 · Goal"), then one status pill: at risk, met, partly met or missed.
- The goal sentence uses the `goal-lg` style in the display face. Write it as an outcome, not a task list, in under 80 characters.
- Meta row: date range and days left, then the edit action.
- `rd-goal--empty` is the state before a goal is set: dashed `rd-border-control` edge, no glow, `rd-fg-muted` text, and the view's one primary button.

**Consumer provides:** iteration name and dates from the GitHub Projects iteration field, the goal text and review status from Radon's store, and edit permission.

**Don't** put issue titles or checklists inside the card. Link to the sprint's stories instead.
