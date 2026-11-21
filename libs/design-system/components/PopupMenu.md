# PopupMenu

A short list of actions that opens from an icon button (`rd-menu`). Use it for the options of one item, such as a goal.

## Structure

- A wrapper with `position: relative` holds the `rd-icon-btn` trigger and the menu.
- `div.rd-menu[role="menu"]` holds `button.rd-menu__item[role="menuitem"]` entries and optional `.rd-menu__sep[role="separator"]`.
- Put a destructive entry last, after a separator, with `rd-menu__item--danger`.

## States

An unavailable action is `disabled` and uses `rd-fg-subtle`. Hover darkens one step. Focus shows the system focus ring.

## Consumer provides

- The trigger's `aria-haspopup="menu"` and `aria-expanded`.
- Closing: on Escape, on a click outside, and after an entry is picked. Only one menu is open at a time.

## Don't

- Don't use it for navigation. Use `rd-nav-item`.
- Don't hide the only way to do something in it when a visible control would fit.
