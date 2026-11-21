## 2026-11-21 — Raiden host logic lives in libs/shared
- **Choice:** The address check, host element, content hiding and theme resolution are in `libs/shared/src/raiden-page.ts`, behind a `RaidenRuntime` interface. The extension supplies only the app loader.
- **Why:** A later web host and the jsdom tests can use the same logic without the extension.
- **Refuted alternative:** Put it all in `apps/extension/src/content.ts`, which cannot be unit-tested without Chrome.

## 2026-11-21 — R2: #4 stays M
- **Choice:** Keep #4 sized M and follow the story notes: the input and switch go to #5, the popup menu to #7. #4 adds only the sidebar item, icon button and display font.
- **Why:** The issue notes already move those controls, so the sizing question has its answer.
- **Refuted alternative:** Resize #4 to L and add every control in it.

## 2026-11-21 — Session store is one module-level store, outside the mounted page
- **Choice:** `sharedSession()` holds the plan for the whole visit. `mountApp` accepts an injected store for tests.
- **Why:** A remount (R1's fallback) then keeps the plan at no cost.
- **Refuted alternative:** State inside the page component, which a remount would lose.

## 2026-11-21 — Goal fields are read-only inputs until #7
- **Choice:** #5 renders goal name and description as read-only `rd-input` fields; #7 makes them editable.
- **Why:** #5 owns the text input control, and its acceptance criteria only show the values.
- **Refuted alternative:** Plain text now and swap to inputs in #7, which would change the card markup twice.
