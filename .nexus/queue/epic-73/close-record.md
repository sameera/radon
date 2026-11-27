---
title: "Close Record: Backlog shows the repository's open issues as a hierarchy"
epic: "#73"
feature: "Live Backlog"
date: 2026-11-26
nexus_version: 1.23.0
analyze: ran 2026-11-26 @ 7c064e93fbbf633bd35c451c0f4fe6489a78ebf2
record: "#76"
record_hash: 744b1bc7979acec7fb2246aa8ca182f34ddb3a8baef63f0c0779c74b45c7ebe3
range:
  - repo: sameera/raiden
    pr: 77
    base: 4341d69e9e05d49de787af6d0cc21c958704b993
    head: 8bacc30ca4d50d82f9bdb886bcd28d74d6bf1e1d
story_ranges:
  - story: "#74"
    ranges:
      - { repo: sameera/raiden, pr: 77, base: 4341d69e9e05d49de787af6d0cc21c958704b993, head: 8bacc30ca4d50d82f9bdb886bcd28d74d6bf1e1d }
  - story: "#75"
    ranges:
      - { repo: sameera/raiden, pr: 77, base: 4341d69e9e05d49de787af6d0cc21c958704b993, head: 8bacc30ca4d50d82f9bdb886bcd28d74d6bf1e1d }
landed_check:
  - story: "#74"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 77, result: unchanged }
  - story: "#75"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 77, result: unchanged }
---

# Close Record: Backlog shows the repository's open issues as a hierarchy

## Key Decisions

- **D1 — Read through GitHub's GraphQL search, with each issue's ancestor chain in the same answer (#76).** The backlog reads query issues through GitHub's GraphQL search, scoped to the current repository, 100 per page, following the cursor until the reported total. Each request also asks for every issue's ancestor chain to the inline depth. Every request goes through the host's gateway as the signed-in lead, and GraphQL is used for read queries only. **Why:** Parents arrive with the issues, so a backlog of a few hundred issues loads in a handful of requests. The search form keeps one path open for the later Settings epic, which makes the query text configurable. The gateway already accepts requests to GitHub's GraphQL endpoint, and the App already has read access to issues, so no new permission and no backend work are needed. **Refuted alternative:** REST issue search plus a REST parent lookup for each returned issue. It reuses the paging pattern the repository picker already has. It lost because it costs one extra request per issue, so 300 issues need 300 or more requests, and REST search has a separate limit of 30 requests a minute.
- **D2 — Ancestors past the inline depth are read in batches, one level at a time (#76).** Ancestors still unknown after the search pages are read in batched rounds by issue identity, each to the inline depth, until every chain ends. A visited set ends the rounds on a loop. **Why:** Story #75 needs every outside parent at any height. Batching makes the number of rounds depend on the tree's height, not on how many issues there are. With an inline depth of three, a Nexus backlog usually needs no extra round. **Refuted alternative:** Read each missing ancestor on its own, as the epic's sizing notes describe. It is simpler to write. It lost because a wide tree of closed epics costs one request per epic, and each request adds a round trip before the backlog can show.
- **D3 — One tree joined on issue identity, made only of query issues and their ancestors (#76).** The backlog is a tree of any depth, built only from query issues and the issues in their ancestor chains, joined on issue identity, with siblings ordered by issue number. Every row with children can collapse. The existing filter works at every level: a matching row shows with all its descendants, under its full ancestor chain. An ancestor in another repository shows its repository-qualified reference and links to its own repository's issue page, on the same GitHub server as the current repository. **Why:** Building only from query issues upward makes "appears exactly once" and "an issue with no returned descendant does not appear" hold by construction, with no separate rule. Joining on identity instead of number keeps a parent in another repository from merging with a same-numbered local issue. GitHub allows a parent in another repository, and the success metric asks for the same chain of parents GitHub records. The lead confirmed at the clarification gate that such a parent shows grayed and linked. **Refuted alternative:** End the chain at the repository boundary, so an issue whose parent is in another repository becomes a top-level row. It keeps every link inside the current repository, as grooming-github-links invariant 4 states. It lost because it breaks the success metric and hides the initiative a Nexus team often files in a separate planning repository.
- **D4 — A backlog load is all or nothing, with named loading and failure states (#76).** The backlog shows issues only after a complete backlog load. Before that it shows a loading state. A signed-out lead is asked to sign in, which can happen in the extension. A repository the App cannot read gets a message that Raiden's GitHub App cannot read this repository's issues. A rate-limited request gets a rate-limit message. Any other failure says the backlog could not load. Every failure state offers Try again. A GraphQL answer that carries errors counts as a failed request. A load starts when Grooming opens and again when the repository or the person changes, and an answer for an earlier repository or person is dropped. **Why:** A partial tree misplaces issues: parents arrive late, and a failed later page leaves a tree that looks complete. The repository picker already uses the same complete-only rule. The readability check is needed because search under an App token returns an empty result for a repository the App is not installed on, which would read as "no open issues". Try again matters because a page reload throws away the in-memory plan. **Refuted alternative:** Show issues as each page arrives. The first paint is faster on large repositories. It lost because rows jump as parents arrive, and a failure partway through leaves a wrong tree with no sign that it is wrong.
- **D5 — Live backlog rows are read-only, and the plan counts are hidden while the plan is on sample data (#76).** Live backlog rows have no drag, no item menu and no goal label. The goals panel and the starting plan keep running on the sample initiatives. The header's planned-epics count and the sidebar's not-planned count are hidden until the plan goes live. Dragging a goal row back to the backlog still takes it out of the plan. The backlog's own count becomes the number of query issues, and the New initiative in GitHub link stays. **Why:** The epic places dragging and item menus out of scope. The sample plan refers to sample issue numbers, so a goal label on a live row would appear wherever a real issue's number matched a sample entry, and would be false. The two plan counts would describe the sample plan beside a live backlog, so the lead chose at the clarification gate not to show them for now. **Refuted alternative:** Keep both counts running on the sample plan. It keeps working features in place until the epic that makes the plan live. It lost because the page would show numbers that disagree with the live backlog beside them.
- **D6 — Outside parents are grayed with a text cue, stay links, and are not counted (#76).** An outside parent shows in its place in the design system's muted foreground. It also carries a text cue that assistive technology reads, saying it is not in the backlog query, plus its state, such as "closed". It stays a link to its issue, collapses like any other row, and is not counted in the backlog's issue count. **Why:** Story #75 asks for "grayed out". The design system reserves its subtle foreground for icons and disabled controls, and an outside parent carries information, so it uses the muted foreground, which meets contrast. Color alone must not carry the difference. **Refuted alternative:** none
- **D7 — Beyond the search cap, show the first 1,000 issues and say how many are missing (#76).** When GitHub reports more query issues than the search cap, the backlog shows the 1,000 it can read, with their ancestors. It states how many issues it does not show, and that the query can be narrowed later. **Why:** Search cannot return issues past 1,000, so not every returned issue can appear in that case. A silent cut would break the "every issue" success metric with no sign to the lead. Treating the case as a failure would leave a large repository with no backlog at all. The lead confirmed this at the clarification gate. **Refuted alternative:** Read the repository's open-issue list instead of search. It has no cap, and for this fixed query it returns the same set. It lost because the Settings epic needs search, so that path would be rewritten in the next epic and the cap would come back then.
- **Grooming shows the live backlog only when the shell has a GitHub gateway and a signed-in login; otherwise it keeps the sample backlog** (a decision stub the verdict on sameera/raiden#77 confirmed). **Why:** Both hosts always give both, and the load is keyed on the person (G12) **Refuted alternative:** Remove the sample backlog everywhere
- **The loader returns a flat list of issues with parent identities; the tree is built from it on render** (a decision stub the verdict on sameera/raiden#77 confirmed). **Why:** Outside parents and batched rounds add to the same list without changing the tree code **Refuted alternative:** Build the nested tree while reading pages
- **A loop of parents is cut at its lowest-numbered issue, which shows at the top** (a decision stub the verdict on sameera/raiden#77 confirmed). **Why:** Otherwise no issue in the loop is reachable from the top and query issues under it vanish (G4) **Refuted alternative:** Fail the whole load on a loop
- **The loader accepts no GraphQL error; an unreadable parent arrives as parent: null, so its child heads the chain** (a decision stub the verdict on sameera/raiden#77 confirmed). **Why:** On real GitHub an unreadable parent comes back as parent: null with no error, so R2's error-only fallback never applies **Refuted alternative:** Tolerate FORBIDDEN or NOT_FOUND at a parent path

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
