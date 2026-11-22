# Tooltip

A short text label that appears beside a control (`rd-tooltip`). Use it to name a control that shows only an icon, or to add one short fact to a visible name.

## Structure

- `span.rd-tooltip-wrap` holds the control and one `span.rd-tooltip`.
- Draw the `span.rd-tooltip` only while it shows. It sits beside the control, to its right.

## Behaviour

- It shows when the pointer is over the control, and when the control has keyboard focus.
- It hides when the pointer and the focus have both left the control.
- Escape hides it. It shows again when the pointer or the focus comes back.
- It never takes focus and has no tab stop. It sets `pointer-events: none`, so it never stops a click on what lies under it.

## Consumer provides

- The text. Keep it to a few words.
- The control's accessible name. The tooltip is `aria-hidden="true"`, so a screen reader never reads it. Put anything the tooltip says that a screen reader needs into the control's own name.

## Style

Use design-system tokens only: `rd-fg` ground, `rd-canvas` text, `rd-radius-sm`, `rd-space-*`. Don't set a color, size or radius by value.

## Don't

- Don't put a link, a button or any control inside it.
- Don't use it for text that a lead must read. Put that text on the page.
- Don't show more than one at a time.
