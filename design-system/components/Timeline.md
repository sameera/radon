# Timeline

The Timeline rolls stories up to their epic across GitHub Projects iterations, so a lead sees whether each epic will land.

**Structure**

- `.rd-tl` (scrolls horizontally inside itself) > `.rd-tl__grid` > `.rd-tl__row` per item. Set `--rd-tl-cols` to the number of iterations shown.
- Header row `.rd-tl__head`: one `.rd-tl__tick` per iteration, in the `axis` style. Mark the current iteration with `rd-tl__tick--current` (`rd-brand-muted` ground).
- Each row: `.rd-tl__label` holding an IssueRef, and `.rd-tl__track` holding one `.rd-tl__bar`. Child stories add `rd-tl__row--child` and indent under the epic.
- Bars: `left` and `width` in percent of the track. The inner `<i>` fill shows progress. Epic bars use `rd-tl__bar--epic` (18px, `rd-epic`); stories default to `rd-story`; `--done` and `--blocked` override. Blocked bars also get an `rd-danger` outline.
- Today: one `.rd-tl__today` per track at the same `left`, `rd-brand` with `rd-shadow-glow`.

**Consumer provides:** iterations (from the Projects iteration field), the epic → story tree (from sub-issues), each story's iteration, state and blocked-by links.

**Don't** let people drag bars. Iterations are changed in GitHub; the timeline only reads them.
