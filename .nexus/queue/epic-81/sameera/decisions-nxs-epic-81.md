## 2026-11-27 — Backend failure causes reach the page as a fixed reason field
- **Choice:** A failed backend request keeps its failure kind and adds an optional `reason`, taken from the backend's `error` field only when it is in a fixed list (`project-unreadable`).
- **Why:** The page must name "cannot read the project that supplies sprints" apart from "cannot read the repository", and a fixed list keeps free backend text out of pages.
- **Refuted alternative:** A new failure kind per backend cause, which every host's result check would have to learn.

## 2026-11-27 — Partition record keys
- **Choice:** Partition `repo#<databaseId>`; sort keys `source`, `sprint#<fieldId>#<iterationId>`, `milestone#<milestoneId>`; a sync touches only `origin=github` records under its own prefixes.
- **Why:** Prefix plus origin marker lets later goal and assignment records (`goal#…`, `assign#…`) live in the same partition without a sync ever matching them.
- **Refuted alternative:** One attribute map per repository, which a sync would rewrite whole.
