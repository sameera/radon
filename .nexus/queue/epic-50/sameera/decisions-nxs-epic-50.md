## 2026-11-22 — Keep the repoUrl mount option beside the new repo store
- **Choice:** mountApp takes a `repo` store; `repoUrl` stays as a shortcut that seeds a store.
- **Why:** Tests and hosts that only know a fixed address need no store of their own.
- **Refuted alternative:** Remove `repoUrl` and make every caller build a store.

## 2026-11-22 — Read installations and repositories with a shared paged reader
- **Choice:** One reader pages any list by its `total_count`, and treats a short or odd answer as incomplete.
- **Why:** The gateway returns no paging headers, so the total is the only proof of completeness (D4, D7).
- **Refuted alternative:** Stop at the first short page, which guesses completeness.

## 2026-11-22 — Signed-out web view resets the context to none
- **Choice:** In a host with a banner, losing the sign-in sets the current repository to "none".
- **Why:** G3 and G13: a signed-out view, or the next person, must not keep the last person's repository.
- **Refuted alternative:** Leave the repository current until reload.
