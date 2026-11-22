# IconButton

A square button that holds one 16px icon (`rd-icon-btn`). Use it for secondary actions in dense rows: hide or show, options.

## Structure

`button.rd-icon-btn` with one `svg` child.

## States

Hover darkens the ground one step. Focus shows the system focus ring. `disabled` uses `rd-fg-subtle`.

## Consumer provides

- An accessible name: `aria-label` or `title`. An icon alone is not a name.
- `aria-expanded` and `aria-haspopup` when it opens something.

## Don't

- Don't use it for the main action of a view. Use `rd-btn--primary`.
- Don't put text in it.
