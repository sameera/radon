---
title: "Close Record: Each sprint carries a goal the lead writes in Grooming"
epic: "#82"
feature: "Grooming Tab"
date: 2026-11-28
nexus_version: 1.23.0
analyze: ran 2026-11-28 @ 7a262b94834ddccf3f38beaab6cd7358e47c366d
record: "#107"
record_hash: 910c50749fe611565d46d25fcbe62980b61129299b0030bf312a9526e1d9dc8f
range:
  - repo: sameera/raiden
    pr: 111
    base: 1affa90a0bfcf210c8f2408e992a96c52ec1d9f4
    head: c1cde6af5ae8bfde02668a639d73d3a357d9a25a
story_ranges:
  - story: "#103"
    ranges:
      - { repo: sameera/raiden, pr: 111, base: 1affa90a0bfcf210c8f2408e992a96c52ec1d9f4, head: c1cde6af5ae8bfde02668a639d73d3a357d9a25a }
  - story: "#104"
    ranges:
      - { repo: sameera/raiden, pr: 111, base: 1affa90a0bfcf210c8f2408e992a96c52ec1d9f4, head: c1cde6af5ae8bfde02668a639d73d3a357d9a25a }
landed_check:
  - story: "#103"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 111, result: unchanged }
  - story: "#104"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 111, result: unchanged }
---

# Close Record: Each sprint carries a goal the lead writes in Grooming

## Key Decisions

- **D1 — One goal record per sprint, text only (#107).** Each sprint has at most one sprint goal record. It holds one short plain-text goal and nothing else: no title, no description, no rank, no met/missed outcome and no author. An edit overwrites it. Saving empty text deletes it. It lives in the repository partition, keyed by sprint identity, separate from the sprint record, as #93 lays out. **Why:** The epic's assumption says "A sprint goal is one short text". A separate record means a sync cannot overwrite or delete a goal. With no rank field, order can only come from sprints (D9). Met/missed belongs to #105's review stories, and adding it there later is a new field, not a migration. **Refuted alternative:** none
- **D2 — Goals arrive with the Grooming sync (#107).** The page reads goals only from the Grooming sync's answer, which already returns the whole partition. There is no separate goal read and no live refresh. Another person's new goal shows on the next load. **Why:** #93 already returns every record in the partition in one query, and bands show only after a complete load. A separate goal read would add a request and a failure path with no benefit. A reload meets the story's "another signed-in person opens Grooming". **Refuted alternative:** none
- **D3 — Only goal editors (maintain or admin) may write a goal (#107).** The backend saves a goal only when GitHub, called with the caller's token for that repository, reports the maintain or admin role. It checks on every goal write. The Grooming sync returns the may-edit flag from the read it already makes. A caller without that role sees goals as plain text, with no goal field. **Why:** The epic's assumption lets any signed-in person who can open Grooming write goals. On a public repository that is anyone on GitHub who can sign in to the team's Raiden. The backend is reachable from the internet, and its origin check stops browsers, not scripts, so that person could overwrite the team's goals. At the clarification gate the lead chose maintain or admin over triage or higher, write or higher, and the epic's rule. The lead gave no further reason. The role arrives in the repository read the sync already makes, so no new App permission is needed (R2). **Refuted alternative:** Triage or higher, which is GitHub's role for people who organise work without pushing code. It would let a scrum master with only the triage role set goals. The lead chose the narrower maintain-or-admin rule.
- **D4 — A goal write touches exactly one record, for a sprint that exists (#107).** The goal write resolves the repository through GitHub as the caller, as the sync does. It refuses a sprint with no sprint record in that partition, which covers synced sprints now and Raiden-made sprints from #84. It refuses text over the goal cap. It then writes or deletes only that sprint's goal record. It never runs a sync and never writes to GitHub. **Why:** A write limited to one record cannot damage sprint, milestone or other goal records, or another repository's data. Checking the sprint keeps the shared partition free of goals for sprints that do not exist, which a hand-made request could otherwise create. **Refuted alternative:** Accept any sprint key without the extra read. That saves one store read per save. It loses because the partition is shared team data, and goals for sprints that do not exist would pile up with no way to see or clean them.
- **D5 — Save when the field is left, one write at a time per card (#107).** A goal saves as soon as the lead leaves the goal field, by Enter or by moving focus. It is never part of a page-level Save or Undo. Unchanged text sends nothing. Text is trimmed and kept to one line. The card shows the new text at once, marked "Saving". Each card has at most one goal write in flight. A newer edit is sent after the current write finishes, so an older text can never land last. A goal write stays tied to the repository and sprint it was typed for. **Why:** The story's criteria say the card shows the goal once the lead "leaves the field", and that it stays "also after a reload". A page-level Save would let a forgotten click lose the goal, and nobody else would see it. Sending one write at a time per card stops a slow early write from overwriting a later one. **Refuted alternative:** Goals join a page-wide Save and Undo, like the sample page's Save plan or the undo and save #83 brings. That gives one undo model across the page. It loses because the story saves on leaving the field, and a goal that waits for Save is invisible to the team.
- **D6 — A failed save keeps the text in the card, in memory only (#107).** When a goal write fails, the card keeps the lead's text and says "Not saved", with a short cause and Try again. The causes are: not allowed to edit this repository's goals; Raiden's backend unavailable; other. A rejected token goes through the one renewal and retry first. Try again, or leaving the field again, resends the text shown. Unsaved text lives only in the open page, and the page gives no warning on leaving. **Why:** This meets the story's criterion that the card "keeps the lead's text and says the goal is not saved, with a way to try again" with the least new machinery. **Refuted alternative:** Keep unsaved drafts in the browser's storage, so they survive a reload. The lead would never lose typed text. It loses because a stale draft resent later could silently overwrite a teammate's newer goal on a shared repository, and it stores repository data in the browser.
- **D7 — One line of plain text, at most 200 characters (#107).** A goal is one line of plain text, at most 200 characters. The goal field stops input at the cap, and the backend refuses longer text. The goal always shows as text, and markup is never read as markup. On the card, a long goal wraps. The lead confirmed the 200-character cap at the clarification gate. **Why:** A goal is shared text that other people's browsers show. Showing it as plain text closes the injection path, and a backend cap keeps the shared partition bounded whatever the client does. 200 characters fits a real one-sentence outcome. The design system's "under 80 characters" is guidance for writing goals, not a limit. **Refuted alternative:** A hard cap at 80 characters, matching the design system's wording exactly. That gives a uniform card height and strict conformance. It loses because it cuts off real goals mid-sentence, and the card can wrap.
- **D8 — Every sprint card carries a goal, past sprints included; the no-sprint band does not (#107).** Past, current and future sprint cards each show one goal, which a goal editor can edit. The no-sprint band's card has no goal. A past sprint's goal stays editable until #105 defines review. The lead confirmed this at the clarification gate. **Why:** The success metric "every sprint band shows at most one goal" and #104's "each sprint has exactly one goal card" apply to sprints, and the no-sprint band is not a sprint. Rules for locking a goal once a sprint is reviewed belong with #105's met/missed review. **Refuted alternative:** Make goals read-only once a sprint has ended, so history cannot be rewritten. It loses because a lead who forgot to write a goal, or who is filling in old sprints, could never fix it, and #105 has not yet defined the review.
- **D9 — Goal order is band order; there is no rank and no goal list controls (#107).** Goals sit only on sprint cards, so they come in band order: milestone order, then sprint order by date, as #93 places the bands. No rank number shows. There is no control to add, delete or reorder a goal. Clearing a goal's text (D1) is the only way to remove one. **Why:** This meets the story's criteria "no goal carries a rank number" and "the goals follow milestone order and then sprint order", with one place goals come from. **Refuted alternative:** none
- **D10 — Delete the whole sample page and the planning-into-goals machinery (#107).** Delete the sample goals and their ranking; the starting plan and the plan rules; the sample backlog of initiatives; Undo and Save plan; the "N of M epics planned" summary and the drag instruction; the Show issues switch; the Plan in Goal menu entries; drops on goals; the Take out of plan button and its drop zone on the live backlog; and the Grooming sidebar count. The Grooming header loses its sample sprint name and dates. A host with no live GitHub connection shows a short note that Grooming needs a GitHub sign-in, instead of a sample page. The sidebar's sample project name and sprint footer stay, because they are not goals and belong to other pages. **Why:** #104's criteria say "signed in or not" and "no entry, drop or button plans the item into a goal". The amended out-of-scope list of #81 gives the deletion of the sample goals, their ranking and the sample page to #82. In both real hosts a signed-out person already gets the sign-in screen, so only a host without sign-in reaches the sample page. Keeping it would mean maintaining a plan model nobody uses. **Refuted alternative:** Keep the sample page, without goals, as a demo for hosts with no connection. Tests and screenshots would keep a backlog to show. It loses because it keeps the sample backlog and plan code alive for a path no real host uses, and #81 assigned its removal here.
- **POST /grooming/goal as its own route beside /grooming/sync, with the same origin and token checks** (a decision stub the verdict on sameera/raiden#111 confirmed). **Why:** a save must never run a sync (D4), and one route per action keeps each request's writes easy to bound **Refuted alternative:** an optional goal field on the sync request
- **the goal editor role is read from GraphQL viewerPermission; ADMIN or MAINTAIN makes a goal editor** (a decision stub the verdict on sameera/raiden#111 confirmed). **Why:** it comes in the read the sync already makes, so the page adds no request **Refuted alternative:** the REST collaborator-permission endpoint
- **a goal for an unknown sprint answers 409 unknown-sprint; an over-long or multi-line goal answers 400** (a decision stub the verdict on sameera/raiden#111 confirmed). **Why:** the shared gateway reads 403 and 404 as a permission failure **Refuted alternative:** 404
- **the goal field is a one-row textarea that grows; Enter ends the edit** (a decision stub the verdict on sameera/raiden#111 confirmed). **Why:** a long goal must wrap in its card, and an input cannot wrap **Refuted alternative:** an input

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
