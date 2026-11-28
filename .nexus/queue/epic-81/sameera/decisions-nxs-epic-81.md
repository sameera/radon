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

## 2026-11-27 — Un-ignore .env.frontend.local for Nx via .nxignore
- **Choice:** Add `!.env.frontend.local` to `.nxignore` so the existing `{workspaceRoot}/.env.frontend.local` build input is hashed.
- **Why:** Nx drops gitignored paths from its file map, so the fileset input matched nothing and a cached build baked in stale team settings.
- **Refuted alternative:** A `{ "runtime": "cat .env.frontend.local 2>/dev/null || true" }` input in each build target, which spawns a shell per hash and is not portable to Windows.

## 2026-11-27 — One grid for the goal column and the backlog column
- **Choice:** Every row of the band view (heading row, milestone header, band) is a CSS grid with the same three tracks: goal column, divider gap, backlog column. A band is a card then its rows, in that DOM order at every width.
- **Why:** D15 and G43 need the card before its rows in focus order at every width, and the columns must line up across bands.
- **Refuted alternative:** Flex rows with `order` swaps when stacked, which would split screen order from focus order.

## 2026-11-27 — A reset stores 58% of the view as a pixel width
- **Choice:** Double-click and Enter on the band view's divider set the preferred width to 58% of the view's width at that moment. With no stored width, the shown width is 58% and tracks the view.
- **Why:** The preference store holds one number, and D16 requires one preferred width on both pages.
- **Refuted alternative:** A second stored "use default" flag, which adds stored data D16 says is not needed.

## 2026-11-27 — Room for the goal is card height, not an element
- **Choice:** The sprint card has a minimum height and no placeholder element.
- **Why:** G46 forbids a goal field on the card, and a dashed empty box would read as one.
- **Refuted alternative:** An empty bordered goal area, as the old build had in the goal column.

## 2026-11-27 — Cap the band view's goal column at 25em through the backlog track
- **Choice:** Backlog track is `max(var(--rd-backlog-w), 100% - 25em - divider)`; the goal track stays `1fr`.
- **Why:** The goal column never passes 25em, and the extra width goes to the backlog instead of an empty gap on the right.
- **Refuted alternative:** `minmax(0, 45em)` on the goal track, which leaves unused space when the backlog share is small.

## 2026-11-27 — Band view's goal column defaults to 1/4 of the view (replaces the 25em cap)
- **Choice:** Default backlog width is `75% of the view - divider`; the 25em cap on the goal column is gone. Drag, stored width and the 360px goal minimum still apply.
- **Why:** The lead asked for the goal column at 1/4 of the screen; a fixed 25em cap fights that on wide screens.
- **Refuted alternative:** Fixing the goal track at `25%` in CSS, which would drop the draggable divider and the stored width (D16).

## 2026-11-27 — Rename the stored backlog-width pref to `groomBacklogWidth`
- **Choice:** New pref key, so widths saved under the old layout (backlog on the left, 58% default) are dropped.
- **Why:** An old saved width overrode the new 1/4 default and kept the goal column wider than the backlog.
- **Refuted alternative:** Keep the key and let leads reset with a double click on the divider.

## 2026-11-27 — Band divider spans the whole view
- **Choice:** The divider stays in the header row's DOM but is absolutely positioned against `.rd-bands`, full height, with a muted line at rest.
- **Why:** With panel borders gone, a transparent header-height divider had nothing to show where to grab.
- **Refuted alternative:** A divider cell in every band row, which would split one control into many.

## 2026-11-27 — Dotted sibling rules, one solid rule after a milestone
- **Choice:** `.rd-band` and the issue rows carry a dotted `--rd-border-muted` top rule; `.rd-milestone + .rd-band` keeps a solid `--rd-border` rule.
- **Why:** A dotted rule reads as "same kind, next item", so only the milestone break still reads as a section edge.
- **Refuted alternative:** Dotted rules everywhere, which flattened the milestone break into another band boundary.

## 2026-11-27 — The band divider has no resting line
- **Choice:** Drop the muted `::after` line on the band view's divider; the handle paints only on hover or focus.
- **Why:** The lead asked for no line between the goal and backlog columns, and the 16px hit area still sits between them.
- **Refuted alternative:** Keep the muted line and rely on its low contrast, which still draws a column edge.
