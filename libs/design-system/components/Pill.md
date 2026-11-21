# Pill

A pill states one item's or one sprint's state in a word, with a dot in the state's color.

| Class | State | Words to use |
|---|---|---|
| `rd-pill--brand` | The current sprint, Raiden-owned data | Current sprint |
| `rd-pill--success` | Done story, met goal | Done, Goal met |
| `rd-pill--attention` | At risk, partly met, `needs-design` | At risk, Partly met |
| `rd-pill--danger` | Blocked, missed | Blocked, Missed |
| `rd-pill--done` | Closed epic, approved decision record | Closed, Approved |
| `rd-pill` (no modifier) | Unplanned, no iteration | Unplanned |

**Consumer provides:** a `<span>` with the state word. The word is required; color alone never carries the state.

**Don't** put more than two pills on one row, or use a pill as a button.
