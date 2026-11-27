## 2026-11-27 — Backend failure causes reach the page as a fixed reason field
- **Choice:** A failed backend request keeps its failure kind and adds an optional `reason`, taken from the backend's `error` field only when it is in a fixed list (`project-unreadable`).
- **Why:** The page must name "cannot read the project that supplies sprints" apart from "cannot read the repository", and a fixed list keeps free backend text out of pages.
- **Refuted alternative:** A new failure kind per backend cause, which every host's result check would have to learn.

## 2026-11-27 — Partition record keys
- **Choice:** Partition `repo#<databaseId>`; sort keys `source`, `sprint#<fieldId>#<iterationId>`, `milestone#<milestoneId>`; a sync touches only `origin=github` records under its own prefixes.
- **Why:** Prefix plus origin marker lets later goal and assignment records (`goal#…`, `assign#…`) live in the same partition without a sync ever matching them.
- **Refuted alternative:** One attribute map per repository, which a sync would rewrite whole.

## 2026-11-27 — Mark the loose sprints with a "No milestone" break
- **Choice:** A separator labelled "No milestone" before the first sprint with no placing milestone, shown only when a milestone header comes before it.
- **Why:** A loose sprint right after the last milestone read as sitting under that milestone; a labelled rule says it does not, and it is not a milestone header, so AC5 still holds.
- **Refuted alternative:** A plain unlabelled gap, which a reader can miss and a screen reader does not announce.

## 2026-11-27 — Below 760px the expanded sidebar overlays the page
- **Choice:** A CSS media query under 760px takes the expanded sidebar out of the flow (absolute, over the page) and keeps a 56px rail-width margin on the main area.
- **Why:** The page then fits a 360px window in both sidebar states, and the user's stored collapse choice and the toggle's `aria-expanded` stay true.
- **Refuted alternative:** Force the sidebar collapsed below 760px; that overrides the stored preference and still lets an expand bring the sideways scroll back.

## 2026-11-27 — Live rows lose drag but keep Alt+Arrow moves
- **Choice:** Remove drag and the grip from live backlog rows; keep Alt+Up and Alt+Down as the way to move an item.
- **Why:** Live-backlog invariant 7 forbids dragging a live row, not keyboard moves, so this is the smallest change that meets it.
- **Refuted alternative:** Remove all reordering of live rows, which drops a working keyboard feature no invariant forbids.
