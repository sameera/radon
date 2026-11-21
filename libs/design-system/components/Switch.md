# Switch

An on or off setting that applies at once (`rd-switch`). Use it for view preferences such as Show issues.

## Structure

`label.rd-switch` holds `input.rd-switch__input` (type checkbox, `role="switch"`) and the label text.

## States

On uses the brand ground. Off uses the inset ground. Focus shows the system focus ring.

## Consumer provides

- The label text, in sentence case, naming what turns on.
- The checked state and its change handler.

## Don't

- Don't use it where a choice needs a Save step. Use a checkbox with `rd-btn`.
