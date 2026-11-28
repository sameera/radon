## 2026-11-27 — Goal write is its own backend route
- **Choice:** `POST /grooming/goal`, beside `POST /grooming/sync`, with the same origin and token checks.
- **Why:** a save must never run a sync (D4), and one route per action keeps each request's writes easy to bound.
- **Refuted alternative:** an optional goal field on the sync request, which would run GitHub's sprint and milestone reads on every save.

## 2026-11-27 — Goal editor role read from GraphQL `viewerPermission`
- **Choice:** the sync's repository query and the goal write's own repository query both ask for `viewerPermission`; ADMIN or MAINTAIN makes a goal editor.
- **Why:** it comes in the read the sync already makes, so the page adds no request (D3 step 1).
- **Refuted alternative:** the REST collaborator-permission endpoint, which needs a second call and may need the App's members permission.

## 2026-11-27 — A goal for an unknown sprint answers 409
- **Choice:** the goal write refuses a sprint with no record with 409 `unknown-sprint`, and an over-long or multi-line goal with 400.
- **Why:** the shared gateway reads 403 and 404 as a permission failure, so the card would wrongly say "not allowed".
- **Refuted alternative:** 404, which reads as a permission failure in the gateway.

## 2026-11-27 — Goal field is a one-row textarea that grows
- **Choice:** a `textarea` with `rd-input rd-input--inline` and CSS `field-sizing: content`; Enter ends the edit instead of adding a line.
- **Why:** the record wants a long goal to wrap in its card, and an `input` cannot wrap.
- **Refuted alternative:** an `input`, which scrolls a long goal sideways.
