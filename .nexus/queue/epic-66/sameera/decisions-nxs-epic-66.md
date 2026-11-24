## 2026-11-24 — Drop-down tests move to the list holder and pick path in #67
- **Choice:** In #67, tests that read the list or picked through the removed drop-down drive `useRepoList` through a small harness and the extracted `pickRepository` pick path; #68 moves the pick tests back onto the repository menu.
- **Why:** The record removes the drop-down in #67 with no interim control (R1), so no UI exists to pick through until #68.
- **Refuted alternative:** Keep a hidden drop-down for tests until #68 — the record forbids keeping it beside the breadcrumb.

## 2026-11-24 — Breadcrumb width cap is a header size token
- **Choice:** Add `rd-header-crumb-max` to tokens.json for the breadcrumb's max width.
- **Why:** G3 requires every size from tokens; the old drop-down used a literal 280px.
- **Refuted alternative:** Keep the literal width in components.css.

## 2026-11-24 — One banner menu open: state lifted to the shell
- **Choice:** The shell holds which banner menu is open ("repo", "account" or none); both menus take `open` and `onOpenChange` props.
- **Why:** One owner of the open state makes G16 hold by construction, with no cross-menu events.
- **Refuted alternative:** A document event each menu fires on open and the other listens for — two sources of truth that can drift.
