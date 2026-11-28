---
title: Grooming Sprint Assignments
aliases: [sprint assignment, move issue to sprint, unsynced with GitHub flag, sprint move, no-sprint mark]
touches: [grooming-sprint-bands, live-backlog-rows, grooming-sync, sprint-goals]
last_updated_by: "#83"
status: active
verification: verified
---

# Grooming Sprint Assignments

A lead with the maintain or admin role moves an issue to another sprint in Grooming, by drag or with Alt+Shift+Down and Alt+Shift+Up. Raiden saves the sprint in its own records, never in GitHub. Raiden's sprint wins, and a row whose two sprints differ shows a flag naming GitHub's sprint.

## How It Works

Raiden keeps at most one sprint assignment per issue for the repository, keyed by GitHub's permanent identity for the issue. It holds a sprint or an explicit no-sprint mark. Every move is stored, also a move back to GitHub's sprint, and nothing deletes an assignment.

Assignments arrive with the Grooming load. A row shows in Raiden's sprint when Raiden holds one, and in its GitHub sprint otherwise. An assignment to a sprint Raiden no longer holds is ignored. The flag is worded text, such as "In GitHub: Sprint 4", and it is not a control.

A drop puts the row at the top of the target band. Alt+Shift+Down goes to the top of the next band, and Alt+Shift+Up to the bottom of the previous one. A move shows at once. Each row sends one save at a time. A failed save puts the row back in its last saved band and announces why. There is no undo.

## Key Invariants

1. Raiden sends no write request to GitHub when an issue is moved or Grooming loads.
2. The backend saves a move only after GitHub, asked with the caller's own token, confirms the maintain or admin role, the issue is in the repository, and the target is the no-sprint mark or a sprint Raiden holds.
3. A move writes only that issue's assignment, and a sprint sync never changes an assignment.
4. A row shows in the band of its usable Raiden sprint, or else of its iteration on the sync source, and carries the flag exactly when the two differ.
5. Only a drag of a Raiden row moves an issue. A drag from outside Raiden, or one carrying text, files or a link, moves nothing, and a drag that starts on an issue link moves the row.
6. A drag moves only the dragged issue. After moves that all succeed, the saved sprint is the row's last band.
7. A move sends only the repository, the issue's identity and the target, never an issue's title.

## Integration Points

- [grooming-sprint-bands](grooming-sprint-bands.md) — the bands place each row in Raiden's sprint when Raiden holds a usable one, and every band accepts a drop.
- [live-backlog-rows](live-backlog-rows.md) — a live row is the thing an editor drags or moves with Alt+Shift, and it carries the flag.
- [grooming-sync](grooming-sync.md) — assignments arrive with the sync's answer, and a sync never changes one.
- [sprint-goals](sprint-goals.md) — the may-edit flag that gives goal fields also gives row drags and Alt+Shift moves, and both save at once with the same role check.

## Decision Log

### 2026-11-28 — #83 — One saved sprint per issue, and Raiden's sprint always wins
Each issue gets one assignment record keyed by its permanent GitHub identity, because an issue number changes when the issue is transferred. A drop on the no-sprint band saves an explicit no-sprint mark, so the issue stays there after a reload even when GitHub gives it a sprint. A move back to GitHub's sprint is stored too, because deleting the record would hand the issue back to GitHub without telling the lead, and a deleted choice cannot be recovered. Each move has its own backend request that checks the caller's role with GitHub every time, because the backend is reachable by scripts as well as browsers. The page merges the two sprints and computes the flag, so the backend does not read every issue's iteration again. A move shows at once and rolls back on failure, so repeated key presses stay fast. The current sprint's progress bar still counts GitHub's sprint until the write-back epic. The rules that only Raiden's own row marker moves an issue and that a drag from a link moves the row come from the retired grooming-plan-moves page, where they guarded the sample plan. Refuted alternative: delete the record when a move matches GitHub's sprint, so Raiden holds only real disagreements. It lost because the issue would silently follow GitHub again.
