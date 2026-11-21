## 2026-11-21 — Raiden host logic lives in libs/shared
- **Choice:** The address check, host element, content hiding and theme resolution are in `libs/shared/src/raiden-page.ts`, behind a `RaidenRuntime` interface. The extension supplies only the app loader.
- **Why:** A later web host and the jsdom tests can use the same logic without the extension.
- **Refuted alternative:** Put it all in `apps/extension/src/content.ts`, which cannot be unit-tested without Chrome.

## 2026-11-21 — R2: #4 stays M
- **Choice:** Keep #4 sized M and follow the story notes: the input and switch go to #5, the popup menu to #7. #4 adds only the sidebar item, icon button and display font.
- **Why:** The issue notes already move those controls, so the sizing question has its answer.
- **Refuted alternative:** Resize #4 to L and add every control in it.
