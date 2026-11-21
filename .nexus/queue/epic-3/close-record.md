---
title: "Close Record: Grooming page layout and interactions on sample data"
epic: "#3"
feature: "Grooming Tab"
date: 2026-11-21
nexus_version: 1.0.0
analyze: ran 2026-11-21 @ a3338eaedd6fc8a105f76ca18b093af5a4a51bda
record: "#11"
record_hash: 4a1df38b06218d6dc27d6f90ce26c86e9021a7ba30b6e6c2ea7e6b3c685808ce
range:
  - repo: sameera/raiden
    pr: 13
    base: 6908787c88f56844c1d48037becf5f52c4b73571
    head: c2f90abcf0d8ca5a0e1038dcb1e64e7f65f4ef87
story_ranges:
  - story: "#4"
    ranges:
      - { repo: sameera/raiden, pr: 13, base: 6908787c88f56844c1d48037becf5f52c4b73571, head: c2f90abcf0d8ca5a0e1038dcb1e64e7f65f4ef87 }
  - story: "#5"
    ranges:
      - { repo: sameera/raiden, pr: 13, base: 6908787c88f56844c1d48037becf5f52c4b73571, head: c2f90abcf0d8ca5a0e1038dcb1e64e7f65f4ef87 }
  - story: "#6"
    ranges:
      - { repo: sameera/raiden, pr: 13, base: 6908787c88f56844c1d48037becf5f52c4b73571, head: c2f90abcf0d8ca5a0e1038dcb1e64e7f65f4ef87 }
  - story: "#7"
    ranges:
      - { repo: sameera/raiden, pr: 13, base: 6908787c88f56844c1d48037becf5f52c4b73571, head: c2f90abcf0d8ca5a0e1038dcb1e64e7f65f4ef87 }
landed_check:
  - story: "#4"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 13, result: unchanged }
  - story: "#5"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 13, result: unchanged }
  - story: "#6"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 13, result: unchanged }
  - story: "#7"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 13, result: unchanged }
---

# Close Record: Grooming page layout and interactions on sample data

## Key Decisions

- **D1 — The Raiden page lives on the repository's main page and replaces its content (#11).** Point the Raiden tab and its More-menu entry at the Raiden address. At that address, hide GitHub's content below the tab bar, show the Raiden host next to it, and mark the Raiden tab as current. At any other address, remove the host and show GitHub's content again. Switching sidebar pages is in-memory only, so the address never changes and a reload opens Grooming. **Why:** The present target path has no GitHub page and probably shows a "page not found" page with no repository header, so "inside the Raiden tab" could not hold. The repository main page always exists, and GitHub always draws the tab bar on it. Placing the host next to GitHub's content, not inside it, keeps the host and the visit's plan alive when GitHub re-renders that content. **Refuted alternative:** Keep the current path and draw the whole frame, header included, over GitHub's "page not found" page. It needs no change to epic #1. It lost because Raiden would have to rebuild the repository header and tab bar, and those copies would drift from GitHub's own.
- **D2 — Preact, in a library that works in any host, loaded only on the Raiden address (#11).** Build the sidebar and all Raiden pages with Preact, with its React compatibility layer turned on, in a new library that does not depend on the extension. The extension only finds where to mount, resolves the theme, supplies the preference store and mounts the app. The app bundle is a separate extension resource loaded on demand when the Raiden address opens. The stack doc records Preact as the UI framework, and the project instructions' "React/TypeScript frontend" is updated to match. **Why:** The backlog, the goals and the header counts all show the same plan, and later pages such as Timeline will be larger. Rendering from state keeps those regions consistent, where rebuilding markup by hand, as the mockup does, loses focus and drag state. Preact gives that model at about a tenth of React's size, so opening the Raiden tab loads less. Its compatibility layer keeps most React libraries and test tools usable. A later web host can reuse the library. Loading on demand keeps the script that runs on every github.com page as small as it is today. **Refuted alternative:** React. It matches the project instructions as written, and it is the default most React-based libraries are built and tested against. It lost on size: about 45 KB gzipped against about 4 KB, which the user waits for each time the Raiden tab opens.
- **D3 — Shared controls go into the design system, and page layout uses only rd- tokens (#11).** New reusable controls go into the design system, each with its own guideline page: the sidebar item, the text input, the switch, the icon button and the popup menu. Grooming-only layout uses only rd- tokens and type classes, with no literal colors or sizes. The few icons are copied from the Octicons set. The display font ships inside the extension and is declared on the GitHub page itself, because font declarations inside the isolated style boundary are ignored. If the font does not load, the system font stack is used. **Why:** The project rule is to style UI only through rd- tokens and classes. Controls that the Sprint goal, Timeline and Settings pages will also need belong in the system, so the pages do not each grow their own copy. GitHub blocks web fonts from other hosts, so the font must ship with the extension. **Refuted alternative:** Put all of the mockup's styles in the Grooming page, built only from tokens. It is quicker for this epic. It lost because every Raiden page needs the sidebar, menu, switch and input, and a page-local copy would drift from the design system.
- **D4 — Colors follow GitHub's resolved color mode, and update live (#11).** Work out light or dark from GitHub's color-mode settings on the page's root element. When GitHub's mode is "auto", use the system's preference. Set the result on the Raiden host, and update it when GitHub's setting or the system preference changes, with no reload. **Why:** #4 asks that colors match GitHub's mode on every Raiden page. The "auto" mode is the case most often missed, and users who follow their system would otherwise get a mismatched page. **Refuted alternative:** none
- **D5 — One session state, with own plans and an effective goal per epic (#11).** The Grooming page keeps one session state, and every display is derived from it. An item has at most one own plan. An epic's own plan overrides its initiative's goal. Every count uses each epic's effective goal. Taking an epic's own plan out leaves the epic in its initiative's goal when that initiative is planned. Dropping an item on the goal it is already effectively in changes nothing. Deleting a goal removes only the own plans in it. Ranks are the goals' positions, from 1 to n. **Why:** #6 allows an epic planned on its own in a different goal from its initiative, and that rule needs a defined effective goal. The mockup counts such an epic in both goals, and this decision counts it once. Making the epic fully unplanned while its initiative stays planned would need a new "left out of the initiative" state that nothing asks for. **Refuted alternative:** Add a "left out of the initiative" state, so the current #6 wording holds for every epic. It lost because neither the backlog nor the goal card can show "initiative planned except this epic", and adding that display adds a design gap to an epic that is already L.
- **D6 — The browser's own drag and drop, inside the Raiden page (#11).** Use the browser's own drag and drop both for moving items between the backlog and goals and for reordering goals by their handle. The dragged item is tracked inside the page, and the drag carries no data that a target outside Raiden could act on. Raiden accepts only drags that started inside Raiden. A goal dropped on another goal goes before or after it, by which half of the card the pointer is over. Targets light up only while they can accept the current drag. Move up and Move down in the goal options menu change the same goal order, and each is disabled at the end of the list. **Why:** The browser's own drag events cover every interaction the epic asks for, and the mockup already shows that they work. Move up and Move down give a non-drag way to reorder goals now. Ignoring outside drags stops text or files from the GitHub page from turning into plan changes. **Refuted alternative:** A drag-and-drop library such as dnd-kit. It offers animated reordering, touch support and a keyboard way to drag. It lost because none of those is asked for, it adds a second new dependency, and it would need tuning for the isolated style boundary and overlay positioning.
- **D7 — Sample data through one replaceable source, and nothing leaves the page (#11).** All initiatives, epics, goals, the starting plan, and the sprint names and dates come from one sample-data source, shaped like what the data epics will supply. Plan edits stay in the session state and reset on reload. The sidebar's "days until it ends" text is fixed sample text. Save plan and the save state show fixed text, and their behaviour is deferred to #8. Issue numbers are plain text, not links. The starting plan shows a planned epic, a planned initiative, a partly planned initiative, an epic planned apart from its initiative, and a goal with no items. **Why:** The success metric is that no control sends a network request, and a link to an issue would be a navigation. One source means the data epics swap that source and nothing else. Fixed dates stay true in review screenshots. A starting plan that shows every state lets a reviewer check every display without setting it up first. **Refuted alternative:** none
- **D8 — The Show issues choice is kept in the extension's own storage (#11).** The app keeps preferences only through the preference store. The extension provides that store from its own local storage, which needs the storage permission. The app reads the stored choice before its first render, so the page does not flash the wrong state. The choice applies to every repository. **Why:** #5 says the choice is kept after a reload. The extension's own storage keeps Raiden data out of github.com's storage, where GitHub's scripts can read or clear it. The same store will hold the sidebar and backlog-width choices in #8. Letting the extension supply the store keeps the library free of extension-only code, so a later web host can supply its own. One choice for every repository is the lead's decision at this record's clarification gate. **Refuted alternative:** github.com's own page storage, as the mockup uses. It is synchronous, so the page never flashes, and it needs no permission. It lost because Raiden data would live where GitHub's scripts can read or clear it, and a later web host would need a second code path.
- **Raiden host logic lives in libs/shared behind a RaidenRuntime interface** (a decision stub the verdict on sameera/raiden#13 confirmed). **Why:** A later web host and jsdom tests can use it without the extension **Refuted alternative:** All logic in content.ts
- **Session store is one module-level store outside the mounted page** (a decision stub the verdict on sameera/raiden#13 confirmed). **Why:** A remount keeps the plan **Refuted alternative:** State inside the page component
- **Dragged item tracked in a ref; dataTransfer carries only a marker** (a decision stub the verdict on sameera/raiden#13 confirmed). **Why:** Outside drags leave the ref empty (G17) **Refuted alternative:** Read the item from dataTransfer

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
