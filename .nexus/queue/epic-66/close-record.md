---
title: "Close Record: Repository breadcrumb with searchable repository menu"
epic: "#66"
feature: "Project Context"
date: 2026-11-24
nexus_version: 1.20.0
analyze: ran 2026-11-24 @ 3cc7ddca5b1af9ee35fe9c71461970cd35b055ad
record: "#69"
record_hash: 4385523b575c45fb3ce6a56949ff0d8699595d300eb44dd12828670900dc1179
range:
  - repo: sameera/raiden
    pr: 70
    base: 547db0953ec204aa950507284c745f1076c4aa62
    head: fa9355045ef675254e2ffd587aaeca057204b1f6
story_ranges:
  - story: "#67"
    ranges:
      - { repo: sameera/raiden, pr: 70, base: 547db0953ec204aa950507284c745f1076c4aa62, head: fa9355045ef675254e2ffd587aaeca057204b1f6 }
  - story: "#68"
    ranges:
      - { repo: sameera/raiden, pr: 70, base: 547db0953ec204aa950507284c745f1076c4aa62, head: fa9355045ef675254e2ffd587aaeca057204b1f6 }
landed_check:
  - story: "#67"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 70, result: unchanged }
  - story: "#68"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 70, result: unchanged }
---

# Close Record: Repository breadcrumb with searchable repository menu

## Key Decisions

- **D1 — The breadcrumb is one control styled like GitHub's header breadcrumb (#69).** The breadcrumb is one button: owner, a slash, then name. It uses GitHub's header-breadcrumb type: system sans, owner at regular weight, name semibold, slash in muted text. Hover gives the standard one-step darker ground, and the focus ring is the design system's. The whole button opens the repository menu, and the owner is not a separate link or control. A long name truncates with an ellipsis, and the full "owner/name" stays in the button's accessible name, "Repository: owner/name". **Why:** The success metric asks for GitHub's order and separator. Making the owner a separate target is out of scope. One target keeps the banner simple and keyboard-reachable with one Tab stop. **Refuted alternative:** Set the repository in the design system's mono "ref" style, which the README says is for issue numbers and repo names. It lost because it would not read like GitHub's breadcrumb, which is set in sans. Mono is right for repository names inside issue references, not for the banner's title-like context.
- **D2 — The breadcrumb reads the shared repository and shows a prompt when there is none (#69).** The breadcrumb shows the shared repository's owner and name directly. While there is none, the same button shows "Pick a repository" and still opens the menu. **Why:** The shared repository is the single source of the current repository (repository-context invariants 1 and 2). Reading the list instead would hide a current repository that a stale kept list lacks. One button in both states keeps a path to choose. **Refuted alternative:** none
- **D3 — A searchable list replaces the browser's drop-down (#69).** The repository menu is a search box with a single-choice list, using the combobox-with-listbox pattern. Focus stays in the search box. Up and Down move the highlighted entry, and the list scrolls to keep it in view. Home and End are left to the text field. Enter picks the highlighted entry and a click picks any entry. After each change in the text, the first match is highlighted, so typing then Enter picks the first match. The current repository is marked as selected, and picking it closes the menu and changes nothing. Escape, a click outside, Tab and a pick all close the menu. Escape and a pick return focus to the breadcrumb. Opening the menu closes any other open Raiden menu, per the popup menu guideline. The search text clears on each open. **Why:** Story #68 requires a search box with focus and a filtered list, which the browser's list control cannot do. The combobox pattern is the accessible way to keep typing focus while choosing from a list, and GitHub's own repository and branch pickers use it. **Refuted alternative:** A text field tied to the browser's suggestion list. Like the old drop-down, it brings keyboard and screen-reader support for free. It lost because its matching rule and its look belong to the browser, so it cannot promise the story's case-insensitive contains rule, cannot show a "no repository matches" message, and cannot be styled with the design system's tokens.
- **D4 — The match rule is a case-insensitive contains test on "owner/name" (#69).** An entry matches when its "owner/name" text contains the typed text, ignoring case. Leading and trailing spaces in the typed text are ignored. Empty text shows every entry. Matches keep the loaded list's owner-then-name order, with no ranking. **Why:** This is the story's rule, read on the joined text. A match inside the owner or inside the name counts, and so does pasted "owner/name" text. A stable order is predictable, and with 100 repositories a few typed letters narrow the list to fit without scrolling. **Refuted alternative:** Ranked or fuzzy matching, with name-prefix matches first. It puts the likely target at the top more often. It lost because it breaks the story's "contain the typed text" rule, and it makes the result order hard to predict and to test.
- **D5 — The search runs over the loaded list in memory (#69).** The menu lists and filters the loaded list in memory. Opening the menu and typing send no GitHub request and start no reload. A complete list that arrives while the menu is open replaces the entries, and the current text is re-applied. **Why:** The story's note and assumption say so. The picker's completeness and per-login rules stay the only rules that govern the list (web-repository-picker invariants 1 to 3). **Refuted alternative:** none
- **D6 — Separate messages for "no match", "loading" and "nothing loaded" (#69).** Typed text with no match shows "No repository matches". An empty loaded list with a load in flight shows "Loading repositories". An empty list with no load running shows "No repositories to show". The list holder reports whether a load is in flight. Each message sits in a status region so screen readers announce it. **Why:** The first message is the story's third criterion. Without a loading state, a first-time visitor, who has no kept list, would read "no repositories" for the seconds the first load takes. **Refuted alternative:** One neutral empty message and no new state from the list holder. It is simpler. It lost because it misleads exactly the person on a first visit, who has no kept list.
- **D7 — The breadcrumb's look and the searchable menu go into the design system (#69).** The breadcrumb's look and the searchable menu become design-system parts, each with a guideline page. The menu can open left-aligned under its trigger, because today's popup menu anchors to the right edge. The Banner guideline swaps the drop-down for the breadcrumb in its structure, behaviour and don'ts. The Select guideline drops "The repository drop-down in the banner is its one use today", and its "Don't replace it with a custom list for hundreds of items" becomes "unless the list offers search; then use the searchable menu". Behaviour stays in the app library, as the avatar menu does. **Why:** The banner is a design-system part, and page layout uses tokens only (raiden-app-shell invariants 2 and 3). A searchable single-choice list is the control later pages will need, such as filters on a project, iteration or assignee. **Refuted alternative:** Style both in the app library's own stylesheet, as banner-only parts. It is less work now. It lost because the next page that needs a searchable picker would copy it, which invariant 2 forbids.
- **Add rd-header-crumb-max to tokens.json for the breadcrumb's max width** (a decision stub the verdict on sameera/raiden#70 confirmed). **Why:** G3 requires every size from tokens; the old drop-down used a literal 280px **Refuted alternative:** Keep the literal width in components.css
- **The shell holds which banner menu is open (repo, account or none); both menus take open and onOpenChange props** (a decision stub the verdict on sameera/raiden#70 confirmed). **Why:** One owner of the open state makes G16 hold by construction, with no cross-menu events **Refuted alternative:** A document event each menu fires on open and the other listens for
- **In #67, drop-down tests drive useRepoList through a harness and the extracted pickRepository path; #68 moves pick tests onto the repository menu** (a decision stub the verdict on sameera/raiden#70 confirmed). **Why:** The record removes the drop-down in #67 with no interim control (R1) **Refuted alternative:** Keep a hidden drop-down for tests until #68

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
