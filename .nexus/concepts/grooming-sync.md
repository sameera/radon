---
title: Grooming Sync
aliases: [sprint sync, milestone sync, raiden records, repository partition, sync source, origin marker]
touches: [grooming-sprint-bands, github-client, github-sign-in]
last_updated_by: "#81"
status: active
verification: verified
---

# Grooming Sync

When Grooming opens, Raiden's backend reads the repository's milestones and sprints from GitHub as the signed-in lead, updates Raiden's own records of them, and returns every record for the repository. Raiden owns these records, and GitHub is the source they are synced from. The sync writes nothing to GitHub.

## How It Works

The browser sends the lead's token and the repository's owner and name to the backend. The backend refuses an unknown origin or a request with no token before it reads anything. It reads GitHub with the token, so it sees only what the lead can see, and it drops the token when the request ends.

Records are held in one partition per repository, keyed by GitHub's permanent identity for the repository. Each milestone and sprint record is marked as synced from GitHub or as Raiden-owned. Milestones are every milestone, open and closed. Sprints are every active and completed iteration of one iteration field on one linked project.

That project and field are the sync source. When none is recorded, the backend picks the earliest-created readable linked project that has an iteration field, and its earliest-created iteration field, and records the pick. A lead who cannot read the recorded project changes nothing and gets a failure that names the project as unreadable. The pick is cleared and made again only when a lead who can read the project finds it unlinked or without the field.

A sync updates renamed or re-dated items in place and deletes items GitHub no longer has. It answers only after every write succeeded.

## Key Invariants

1. The backend never stores, logs or returns the token, and sends it only to GitHub's API.
2. When GitHub refuses the caller for the repository, no record of that repository is read or written.
3. A sync creates, changes or deletes only records marked as synced. It never touches a Raiden-owned record or a record keyed to a sprint or an issue.
4. A repository's records stay reachable after a rename or a transfer.
5. Two leads who load one after the other, with GitHub unchanged, get sprints from the same project.
6. A lead who cannot read the recorded project deletes no sprint and changes no pick.
7. A sync sends no write request to GitHub.

## Integration Points

- [grooming-sprint-bands](grooming-sprint-bands.md) — the band view shows bands only after this sync succeeded, and draws its bands and milestone headers from the returned records.
- [github-client](github-client.md) — the sync request goes through the shared client to the team's configured backend, with the token and the same renewal and failure kinds.
- [github-sign-in](github-sign-in.md) — the backend reads GitHub with the token the sign-in issued, and the App's read-only organization Projects permission lets it read organization projects.

## Decision Log

### 2026-11-28 — #81 — The backend syncs milestones and sprints into Raiden's own records, as the signed-in lead
The records are shared by the whole team, so the backend must read them from GitHub itself, because data a browser posts could be forged. Later epics write goals and assignments, and only a GitHub read with the caller's token confirms who is calling. Records are keyed by the repository's permanent identity so a rename or transfer keeps them. The sync source is picked once and kept, because goals and assignments key on sprint identity and a source that changed between loads or between leads would leave them behind. A removed item is deleted, so Raiden's synced records match GitHub. A failed backend request keeps its failure kind and adds a reason from a fixed list, so an unreadable project is named apart from an unreadable repository. Refuted alternative: the browser reads milestones and iterations itself and posts them to the backend. It keeps the token in the browser, but the backend could not tell real data from forged data, so any browser could overwrite the team's records.
