## 2026-11-22 — Keep the repoUrl mount option beside the new repo store
- **Choice:** mountApp takes a `repo` store; `repoUrl` stays as a shortcut that seeds a store.
- **Why:** Tests and hosts that only know a fixed address need no store of their own.
- **Refuted alternative:** Remove `repoUrl` and make every caller build a store.
