## 2026-11-24 — Drop-down tests move to the list holder and pick path in #67
- **Choice:** In #67, tests that read the list or picked through the removed drop-down drive `useRepoList` through a small harness and the extracted `pickRepository` pick path; #68 moves the pick tests back onto the repository menu.
- **Why:** The record removes the drop-down in #67 with no interim control (R1), so no UI exists to pick through until #68.
- **Refuted alternative:** Keep a hidden drop-down for tests until #68 — the record forbids keeping it beside the breadcrumb.

## 2026-11-24 — Breadcrumb width cap is a header size token
- **Choice:** Add `rd-header-crumb-max` to tokens.json for the breadcrumb's max width.
- **Why:** G3 requires every size from tokens; the old drop-down used a literal 280px.
- **Refuted alternative:** Keep the literal width in components.css.
