# TextInput

A single-line field or a multi-line field (`rd-input`). Use it for Raiden's own data, such as goal names and descriptions.

## Structure

`input.rd-input` or `textarea.rd-input`. Add `rd-input--inline` to make it read as text until hover or focus.

## States

Focus shows the system focus ring. `readonly` uses the subtle ground. Placeholder text uses `rd-fg-subtle`.

## Consumer provides

- An accessible name: a label, or `aria-label`.
- The value and its change handler.

## Don't

- Don't use it for GitHub data. Nothing that shows an issue looks editable (README principle 4).
