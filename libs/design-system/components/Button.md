# Button

Buttons trigger Raiden's own actions: setting, editing and reviewing sprint goals. They never act on GitHub issues.

**Variants**

- `rd-btn rd-btn--primary` — `rd-brand` fill, `rd-on-brand` text. One per view, for the action the view exists for ("Set sprint goal"). Hover adds `rd-shadow-glow`.
- `rd-btn` — secondary. `rd-canvas-subtle` ground, `rd-border-control` edge. The default.
- `rd-btn rd-btn--ghost` — no edge; `rd-brand-fg` text. Navigation between Raiden views.
- `rd-btn rd-btn--danger` — `rd-danger` text, fills `rd-danger-muted` on hover. Clearing or deleting Raiden data only.
- Add `rd-btn--sm` (28px) in timeline rows and table cells.

**Consumer provides:** a `<button>` element, a verb-first sentence-case label, `disabled` while a save is in flight.

**Don't** use GitHub's green primary button style; Raiden's primary is teal so people can tell Raiden actions from GitHub's.
