# ProgressBar

A ProgressBar shows how a sprint's or an epic's stories split across done, in progress and blocked.

- Segments, left to right: `rd-progress__seg--done` (`rd-success`), `--active` (`rd-brand`), `--blocked` (`rd-danger`). The remaining `rd-canvas-inset` track is not started.
- Widths are percentages of total stories. Segments are separated by a 2px gap so adjacent colors stay distinct.
- Always pair with `.rd-progress__legend`, which gives the counts in words with tabular numerals.

**Consumer provides:** counts per state, and an `aria-label` that says them in a sentence.

**Don't** show a percentage alone. People act on "1 blocked", not "81%".
