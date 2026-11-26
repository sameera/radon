## 2026-11-26 — Live backlog only with a gateway and a signed-in person
- **Choice:** Grooming shows the live backlog when the shell has a GitHub gateway and a signed-in login; with neither, it keeps the sample backlog.
- **Why:** Both hosts always give both, and the load is keyed on the person (G12), so there is nothing to read without them.
- **Refuted alternative:** Remove the sample backlog everywhere, which would leave a host with no sign-in showing an empty or failed backlog and drop the drag and menu coverage of the plan rules.

## 2026-11-26 — Backlog load keeps ancestors as a map joined on identity
- **Choice:** The loader returns a flat list of issues with parent identities, and the tree is built from it on render.
- **Why:** Story #75 adds outside parents and batched rounds to the same list without changing the tree code's shape.
- **Refuted alternative:** Build the nested tree while reading pages, which breaks when a parent arrives on a later page.
