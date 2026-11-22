## 2026-11-22 — Move the display font to the design system
- **Choice:** `apps/extension/fonts` moved to `libs/design-system/fonts`; both hosts copy it from there.
- **Why:** Apps must not import from each other, and the web host needs the same font file.
- **Refuted alternative:** Copy the binary into `apps/web/`.
