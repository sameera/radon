# SidebarItem

One entry in the Raiden sidebar (`rd-nav`). Use it to switch between Raiden pages.

## Structure

- `nav.rd-nav` holds, in order: `.rd-nav__brand` (`.rd-nav__word`, `.rd-nav__proj`), `.rd-nav__group` labels, `button.rd-nav-item` entries, `.rd-nav__sep`, and `.rd-nav__foot`.
- `button.rd-nav-item` holds a 16px icon and `.rd-nav-item__label`.

## Collapsed rail

- Add `rd-nav--collapsed` to `nav.rd-nav` to shrink it to a rail of icons. Labels, group names, the project name and the footer are hidden.
- Give each `button.rd-nav-item` an `aria-label` and a `data-label` with its name. The rail shows `data-label` on hover and keyboard focus.
- Put a `button.rd-icon-btn.rd-nav__toggle` first in the nav. Set `aria-expanded` on it, and make its name say what pressing it does.

## States

- Current page: set `aria-current="page"` on exactly one item. It gets the brand ground and brand text.
- Hover and focus follow the system rules in the README.

## Consumer provides

- The label text, the icon, and the click handler. The item changes no address.

## Don't

- Don't mark two items as current.
- Don't use it for actions. Use `rd-btn`.
