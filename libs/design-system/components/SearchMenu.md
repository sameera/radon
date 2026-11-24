# SearchMenu

A search box over a single-choice list (`rd-search-menu`), opened from a trigger like a [PopupMenu](PopupMenu.md). Use it to pick one item from a long list by typing part of its name. The repository menu under the banner's [Breadcrumb](Breadcrumb.md) is its first use; filters such as project, iteration or assignee are the next.

## Structure

- A wrapper `div.rd-menu-wrap` (position relative) holds the trigger and the menu.
- `div.rd-menu.rd-menu--start.rd-search-menu` opens under the trigger, aligned to its left edge.
- Inside: `input.rd-input.rd-search-menu__input[role="combobox"]` with `aria-controls` naming the list and `aria-activedescendant` naming the highlighted entry, then `ul.rd-search-menu__list[role="listbox"]` of `li.rd-search-menu__option[role="option"]`.
- In place of the list, `p.rd-search-menu__status[role="status"]` holds a message, so screen readers announce it.

## Behaviour

This is the combobox-with-listbox pattern. Focus stays in the search box.

- On open, the search text is empty, the box has focus and the first entry is highlighted.
- Typing filters the list. After each change in the text the first match is highlighted.
- Up and Down move the highlighted entry (`rd-search-menu__option--active`), and the list scrolls to keep it in view. Home and End stay with the text field.
- Enter picks the highlighted entry. A click picks any entry.
- Escape closes the menu and returns focus to the trigger. A pick does the same. A click outside or Tab closes it with no focus move.
- Opening it closes any other open menu. Only one menu is open at a time.
- The list has a fixed height and scrolls. It does not virtualize: several hundred plain rows are cheap.

## States

- The highlighted entry has the `rd-canvas-inset` ground and an `rd-accent` bar at its start.
- The current item is `aria-selected="true"` and set at weight 600.
- Messages: "no match" when text matches nothing; "loading" while an empty list is being loaded; "nothing to show" when the list is empty and no load runs.

## Consumer provides

- The items, already in memory, and the match rule. The repository menu keeps entries whose "owner/name" contains the text, case and outer spaces ignored.
- The trigger's `aria-haspopup="listbox"` and `aria-expanded`, and the open state.
- What a pick does. Behaviour lives in the app library; this part is the look.

## Style

- Width `rd-search-menu-width`; the list stops at `rd-search-menu-height` and scrolls.
- Ground `rd-overlay` with `rd-shadow-overlay`, like the popup menu. Text `rd-fg`; messages `rd-fg-muted`. Both meet 4.5:1 on `rd-overlay`, `rd-canvas-subtle` and `rd-canvas-inset` in both themes.
- Use design-system tokens only. Don't set a color or size by value.

## Don't

- Don't fetch while the person types. Filter what is loaded.
- Don't use it for a short list of actions. Use the [PopupMenu](PopupMenu.md).
