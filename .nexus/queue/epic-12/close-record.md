---
title: "Close Record: Grooming page details from the reference mockup"
epic: "#12"
feature: "Grooming Tab"
date: 2026-11-22
nexus_version: 1.1.0
analyze: ran 2026-11-22 @ 6f9ce762e1c887257ad8f73bd6e2c489e48f560e
record: "#25"
record_hash: 82813e0cd5b95de9c2d1ac3079531d8db3a9201e929d698d304b6d32ed28ae8c
range:
  - repo: sameera/raiden
    pr: 28
    base: 650952fb855f82481647aded4372dc103a092d85
    head: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8
story_ranges:
  - story: "#20"
    ranges:
      - { repo: sameera/raiden, pr: 28, base: 650952fb855f82481647aded4372dc103a092d85, head: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8 }
  - story: "#21"
    ranges:
      - { repo: sameera/raiden, pr: 28, base: 650952fb855f82481647aded4372dc103a092d85, head: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8 }
  - story: "#22"
    ranges:
      - { repo: sameera/raiden, pr: 28, base: 650952fb855f82481647aded4372dc103a092d85, head: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8 }
  - story: "#23"
    ranges:
      - { repo: sameera/raiden, pr: 28, base: 650952fb855f82481647aded4372dc103a092d85, head: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8 }
  - story: "#24"
    ranges:
      - { repo: sameera/raiden, pr: 28, base: 650952fb855f82481647aded4372dc103a092d85, head: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8 }
landed_check:
  - story: "#20"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 28, result: unchanged }
  - story: "#21"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 28, result: unchanged }
  - story: "#22"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 28, result: unchanged }
  - story: "#23"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 28, result: unchanged }
  - story: "#24"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 28, result: unchanged }
---

# Close Record: Grooming page details from the reference mockup

## Key Decisions

- **D1 — Take out of plan button removes the own plan with the backlog-drop rule (#25).** Every row in a goal's item list shows a Take out of plan icon button. Its accessible name names the item and the goal, for example "Take epic #12 out of Goal 2". Selecting it removes the item's own plan with the same rule that dropping on the backlog panel uses. After the row goes, focus moves to the next row's button, or to the goal's options button. **Why:** The story asks for a second way to do what a backlog drop already does. One shared rule means the two ways cannot drift apart, and the fallback to the initiative's goal (story #20, third criterion) comes with it. An epic planned under its initiative has no row of its own in a goal, so it has no button there. Without the focus rule, a keyboard user would lose focus each time a row vanishes. **Refuted alternative:** none
- **D2 — The shell works out the not-planned count from the same session state (#25).** The shell works out the not-planned count from the shared session state, with the same effective-goal rule as the header count. It shows the count as a badge on the Grooming sidebar item and hides the badge at zero. The badge's accessible text is in words, for example "3 epics not planned". The badge becomes a count option of the design-system sidebar item. The tooltip in D5 reads the same value. **Why:** The success metric needs the count to equal the number of unplanned epics at all times. Deriving it from the one state that drives the header makes that true by construction. It also updates with no reload, and stays right while another sidebar page shows. **Refuted alternative:** A general page-badge contract, where each page publishes a badge and the shell shows it without knowing Grooming. It keeps Grooming rules out of the shell, and Sprint goal might later want a badge. It lost because only one page has a badge today, so the contract adds a layer for one user.
- **D3 — Issue references and New initiative are links that open GitHub in a new tab, and the no-network rule narrows to Raiden's own code (#25).** Each initiative and epic issue reference, in the backlog and in goal rows, becomes a link. So does the New initiative in GitHub link at the foot of the backlog panel. Each is a native link that opens in a new tab with no opener handle. The whole issue reference, number and title, is the link, as the design-system guideline and the mockup show. Links are not draggable, so a drag that starts on one drags the row. Nothing prefetches or preloads a linked page. The no-network rule narrows to this: Raiden's code sends no request from any control, and a GitHub page the user opens in a new tab is a browser navigation. **Why:** Stories #22 and #23 need a way to reach GitHub. A native link gives Enter on focus, middle-click, copy link address and the address preview, and a script that opens a window would have to rebuild each. A new tab keeps the Raiden page and its in-memory plan, where navigating in place would discard the plan. No opener handle means the opened page cannot script or redirect the Raiden tab. The narrowed rule keeps what epic #3's metric protected: no API traffic, no backend, no data leaving. The issue is still created in GitHub by the user, so the standards' rule against writing to GitHub holds. **Refuted alternative:** Make only the issue number the link, the literal reading of story #23. A smaller hit area means fewer tabs opened by accident. It lost because it departs from the design-system guideline and the mockup, a screen reader would read a bare "#12" as the link name, and rows have no other click action that a title link would collide with.
- **D4 — The hosting extension gives the page the repository address at start (#25).** The host passes the current repository's web address to the app at start, beside the stylesheet text and the preference store. It takes the address from GitHub's own Code tab on the page. The app builds every GitHub link from it. With no address, issue references are plain text and the New initiative link is hidden. **Why:** The epic's Assumptions put both links in the current repository. The host already knows the repository without a network call. The app library must not depend on a host, so it should not read github.com's address layout itself. Taking the origin from the page also points links at the right server if the extension ever runs on another GitHub. **Refuted alternative:** The app reads the repository from the browser's current address. It needs no new start-up input. It lost because it ties the host-free library to github.com's address layout, and a later web host and the jsdom tests would have to fake a github.com address.
- **D5 — Sidebar tooltips are a design-system tooltip shown on hover and on keyboard focus (#25).** Add a tooltip control to the design system, with its own guideline page, styled only with design-system tokens. It shows beside its control on pointer hover and on keyboard focus. It hides when the pointer or focus leaves, or when Escape is pressed. It never takes focus and never blocks pointer input. Every sidebar item uses it with the page name as text, and the Grooming item adds the count from D2. It is hidden from assistive technology, because the item's accessible name already gives the page name and the count. It shows whether or not the sidebar is collapsed. **Why:** The sidebar is shared by every Raiden page, the mockup uses the same tooltip on the collapse toggle (epic #8), and icon buttons will want it. A shared control belongs in the design system. Escape dismissal meets the usual rule for content that appears on hover or focus. **Refuted alternative:** The browser's native title tooltip. It costs nothing. It lost because it never shows on keyboard focus, which fails the first criterion of story #24, it shows only after a delay, and it cannot be styled to the page.

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
