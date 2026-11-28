## 2026-11-28 — Move write is `POST /grooming/move` with one combined GitHub check
- **Choice:** a new route beside the goal write; one GraphQL query (`MoveCheck`) reads the repository's identity, `viewerPermission` and the issue node's repository together.
- **Why:** D2 asks for one GitHub query per write, and asking for both in one request keeps the cost at one round trip.
- **Refuted alternative:** reuse the goal write's repository query and then a second `node` query for the issue, which doubles the GitHub reads per move.

## 2026-11-28 — Assignment record is `assign#<issue node id>` holding `sprint` or `none`
- **Choice:** sort key `assign#` + GitHub's node id; attrs `{"sprint": <id>}` for a sprint, `{"none": "true"}` for the no-sprint mark; the request and the sync answer carry the mark as JSON `null`.
- **Why:** the no-sprint mark must differ from "no record" (D1), and `null` cannot collide with any sprint id, including Raiden-made ones of #84.
- **Refuted alternative:** a reserved string such as `"none"` as the sprint value, which could clash with a future sprint id.

## 2026-11-28 — The shown-band merge lands with #114, the flag with #115
- **Choice:** #114 already places each row by Raiden's sprint when Raiden holds a usable one (`shownBands`); #115 adds the flag, the card text and the tests for D4, D5, D7, D12.
- **Why:** #114 AC1 and AC2 need the moved row in its new band after a reload, which needs Raiden's sprint to win on load.
- **Refuted alternative:** keep all of the merge in #115, which would leave #114's reload criteria unmet in its own commit.

## 2026-11-28 — Backend reason `unknown-sprint` passes through the gateway
- **Choice:** add `unknown-sprint` to the shared `BACKEND_REASONS`, so a refused move can say "That sprint no longer exists."
- **Why:** D6 step 6 names "the sprint no longer exists" as its own failure cause; a 409 alone reads as "other".
- **Refuted alternative:** map every 409 to that cause, which would also mislabel an `unknown-issue` refusal.

## 2026-11-28 — The flag is an attention Pill reading "In GitHub: <sprint>"
- **Choice:** the design system's `rd-pill rd-pill--attention` span at the row's end, worded "In GitHub: Sprint 14" or "In GitHub: no sprint"; it compares the row's shown band, moves included, with its GitHub sprint.
- **Why:** the Pill is the design system's worded status with an attention tint, and comparing the shown band flags a fresh move at once.
- **Refuted alternative:** an icon with a tooltip, which carries the state by color and hover alone.
