## 2026-11-26 — Live backlog only with a gateway and a signed-in person
- **Choice:** Grooming shows the live backlog when the shell has a GitHub gateway and a signed-in login; with neither, it keeps the sample backlog.
- **Why:** Both hosts always give both, and the load is keyed on the person (G12), so there is nothing to read without them.
- **Refuted alternative:** Remove the sample backlog everywhere, which would leave a host with no sign-in showing an empty or failed backlog and drop the drag and menu coverage of the plan rules.

## 2026-11-26 — Backlog load keeps ancestors as a map joined on identity
- **Choice:** The loader returns a flat list of issues with parent identities, and the tree is built from it on render.
- **Why:** Story #75 adds outside parents and batched rounds to the same list without changing the tree code's shape.
- **Refuted alternative:** Build the nested tree while reading pages, which breaks when a parent arrives on a later page.

## 2026-11-26 — A loop of parents is cut at its lowest-numbered issue
- **Choice:** When GitHub reports a loop of parents, the tree drops the parent link of the loop's lowest-numbered issue, which then shows at the top.
- **Why:** Every issue in a loop otherwise has a parent, so none is reachable from the top and the query issues under it would vanish (G4).
- **Refuted alternative:** Fail the whole load on a loop, which leaves the lead with no backlog for a data error they cannot fix from Raiden.

## 2026-11-26 — R2 fallback built ahead of the real test
- **Choice:** A FORBIDDEN or NOT_FOUND error at a parent field, or at one node of an ancestor round, ends that chain at a grayed "Parent not visible" row; any other error still fails the load.
- **Why:** The record's R2 names this as the outcome if GitHub errors for that parent only, and it cannot be tested against real GitHub from this checkout.
- **Refuted alternative:** Treat every error as a failed load, which would blank the backlog for any repository with one private parent elsewhere.

## 2026-11-26 — R2 settled on real GitHub: an unreadable parent is no parent
- **Choice:** The loader accepts no GraphQL error at all; an unreadable parent arrives as `parent: null` with no error, so its child heads the chain at the top.
- **Why:** On real GitHub, elastic/kibana#307949 and slashbin-io/slashbin-ai-foreman#419 match `has:parent-issue` in search, yet GraphQL answers `parent: null` with no error and REST answers 404 "No parent issue found", so the record's error-only fallback never applies.
- **Refuted alternative:** Keep tolerating FORBIDDEN or NOT_FOUND at a parent path, which accepts an answer GitHub does not give and lets a real error pass in breach of G13.
