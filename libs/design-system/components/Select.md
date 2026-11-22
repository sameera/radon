# Select

The browser's own list control (`rd-select`), styled with design-system tokens. Use it to pick one item from a long list where search is not offered. The repository drop-down in the banner is its one use today.

## Structure

`select.rd-select` with one `option` per item. Add a first option with an empty value as the "nothing chosen" prompt.

## Behaviour

- The browser gives type-to-jump on first letters, full keyboard use, screen-reader support and scrolling. Build none of it again.
- The open list uses the browser's look, not Raiden's tokens.

## States

Hover darkens the edge to `rd-border`. Focus shows the system focus ring in `rd-accent`.

## Consumer provides

- An accessible name through `aria-label` or a label.
- The value and its change handler.

## Style

- Edge `rd-border-control`, ground `rd-canvas`, text `rd-fg`, radius `rd-radius-md`.
- Use design-system tokens only. Don't set a color or size by value.

## Don't

- Don't use it for a short list of actions. Use the [PopupMenu](PopupMenu.md).
- Don't replace it with a custom list for hundreds of items.
