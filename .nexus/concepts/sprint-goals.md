---
title: Sprint Goals
aliases: [sprint goal, goal field, goal editor, goal save, may-edit flag, goal cap, not saved]
touches: [grooming-sprint-bands, grooming-sync, github-client, grooming-sprint-assignments]
last_updated_by: "#83"
status: active
verification: verified
---

# Sprint Goals

Each sprint card in Grooming carries at most one sprint goal: one line of plain text that Raiden's backend saves in its own records, never in GitHub. Only a person whose GitHub role on the repository is maintain or admin can edit a goal. Everyone else sees the goals as text.

## How It Works

Goals arrive with the Grooming sync's answer, with a may-edit flag that says whether the caller is a goal editor. An open page shows a teammate's new goal only after a reload. Past, current and future sprint cards each show one goal. Goals follow band order and carry no rank.

A goal editor's card holds a goal field. The goal saves when the lead leaves the field, by Enter or by moving focus. Line breaks become spaces, and the field stops at 200 characters. Unchanged text sends nothing, and empty text deletes the goal. Each card sends one write at a time, and a newer edit waits for it. A write lands on the repository and sprint it was typed for. A failed write leaves the text in the card with "Not saved", a cause and Try again. Unsaved text lives only in the open page.

On each write the backend asks GitHub for the caller's role, with the caller's token. It refuses a role below maintain, an unknown sprint and text over the cap. The last save wins.

## Key Invariants

1. A sprint has at most one goal, and the no-sprint band has none.
2. The backend saves a goal only after GitHub, called with the caller's own token, reports the maintain or admin role on that repository.
3. A goal write changes only that sprint's goal record. It never changes a sprint or milestone record, another goal or another repository's records, and it never runs a sync.
4. The backend refuses a goal for a sprint with no sprint record, and a goal over 200 characters or with a line break.
5. A goal always shows as plain text, and markup in it is never read as markup.
6. A failed save keeps the lead's text in the card and leaves the stored goal unchanged.
7. Writing a goal sends no write request to GitHub and needs no new GitHub App permission.

## Integration Points

- [grooming-sprint-bands](grooming-sprint-bands.md) — each sprint card shows its sprint's goal, so goals come in band order.
- [grooming-sync](grooming-sync.md) — the sync answer carries every goal record and the may-edit flag, and a sync never changes a goal.
- [github-client](github-client.md) — the goal write goes through the shared client to the team's backend, with the same token renewal and failure kinds.
- [grooming-sprint-assignments](grooming-sprint-assignments.md) — the may-edit flag that gives goal fields also gives row drags and Alt+Shift moves.

## Decision Log

### 2026-11-28 — #82 — One saved text goal per sprint, edited by maintain or admin, saved on leaving the field
The lead needs the sprint goal beside the sprint's issues, and GitHub iterations have no goal field, so goals live in Raiden's own records. A goal is a separate record from the sprint, so a sync cannot overwrite or delete it. Only maintain or admin may write, because the backend is reachable from the internet and on a public repository anyone who can sign in could otherwise overwrite the team's goals. The role comes from the repository read the sync already makes, so no new App permission is needed. A goal saves when the lead leaves the field, because a goal that waits for a page Save is invisible to the team until someone clicks. One write at a time per card stops a slow early write from landing last. The cap is 200 characters, because the design system's 80 characters is writing guidance and would cut real goals mid-sentence. A failed save keeps text in the page only, because a stale draft resent later could overwrite a teammate's newer goal. Refuted alternative: goals join a page-wide Save and Undo. It gives one undo model, but the story saves on leaving the field.

### 2026-11-28 — #83 — Reciprocal link from grooming-sprint-assignments
The may-edit flag that gives a goal editor the goal fields now also lets that person move issues between sprints, which grooming-sprint-assignments records.
