---
title: "Close Record: Grooming page sidebar, backlog, keyboard planning, save state, and undo"
epic: "#8"
feature: "Grooming Tab"
date: 2026-11-22
nexus_version: 1.1.0
analyze: ran 2026-11-22 @ cf625bae7e78f5b71740d7158379048cd190d762
record: "#19"
record_hash: 1d6761e61c4e82da31af991a56c5bf28691c07d8eec1d089b405fb2a2eb59638
range:
  - repo: sameera/raiden
    pr: 26
    base: 017ac96e9f45b8cc87355465909433715067ef76
    head: b54146a1e77e582146cc9d48f7bdb891844eee93
story_ranges:
  - story: "#15"
    ranges:
      - { repo: sameera/raiden, pr: 26, base: 017ac96e9f45b8cc87355465909433715067ef76, head: b54146a1e77e582146cc9d48f7bdb891844eee93 }
  - story: "#16"
    ranges:
      - { repo: sameera/raiden, pr: 26, base: 017ac96e9f45b8cc87355465909433715067ef76, head: b54146a1e77e582146cc9d48f7bdb891844eee93 }
  - story: "#17"
    ranges:
      - { repo: sameera/raiden, pr: 26, base: 017ac96e9f45b8cc87355465909433715067ef76, head: b54146a1e77e582146cc9d48f7bdb891844eee93 }
  - story: "#18"
    ranges:
      - { repo: sameera/raiden, pr: 26, base: 017ac96e9f45b8cc87355465909433715067ef76, head: b54146a1e77e582146cc9d48f7bdb891844eee93 }
landed_check:
  - story: "#15"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 26, result: unchanged }
  - story: "#16"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 26, result: unchanged }
  - story: "#17"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 26, result: unchanged }
  - story: "#18"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 26, result: unchanged }
---

# Close Record: Grooming page sidebar, backlog, keyboard planning, save state, and undo

## Key Decisions

- **D1 — Layout preferences persist through the shell's preference store (#19).** The sidebar choice and the preferred backlog width are layout preferences. They stay outside the plan. They are kept through the injected preference store, the same way as Show issues, and read before the first render. The defaults are expanded, and today's backlog width. **Why:** A lead who collapses the sidebar or widens the backlog to read long titles wants that on every visit. Without this, the choice resets on every reload. The store and the read-before-first-render pattern already exist for Show issues, so the cost is two keys. The mockup keeps these values in the page's local storage. That would break the raiden-page-host page's invariant 4 and the raiden-app-shell page's invariant 4, so it is not followed. **Refuted alternative:** Keep both in memory only, like the current page choice. This loses no data and adds no storage keys. It lost because the lead has to collapse and resize again on every reload, which defeats "more room" for the lead who needs it on every visit.
- **D2 — The collapsed sidebar is a rail of the shared sidebar control, with no keyboard shortcut (#19).** A toggle button at the top of the sidebar collapses it to a rail of icons. In the rail, each item keeps its accessible name, and its name shows on pointer hover and on keyboard focus. The brand shortens, and the project name and the sprint footer are hidden. The collapsed styling and the name label are a variant of the design system's sidebar control, not page styling. The mockup's `[` shortcut is not built. **Why:** The sidebar is shared by every page, so its collapsed form belongs in the design system (raiden-app-shell invariants 2 and 3). The toggle button is already a keyboard path, so a shortcut adds no reach. A bare-letter shortcut on a github.com page competes with GitHub's own shortcuts (see R1). The epic's Assumption about the mockup is amended under D7. **Refuted alternative:** Build the mockup's `[` toggle shortcut. It is faster for keyboard users. It lost because its keypress also reaches GitHub's page handlers, and the toggle button already gives a keyboard path.
- **D3 — The divider is an accessible separator over a fitted preferred width (#19).** The divider is a focusable separator that reports the current backlog width and its range. Pointer drag changes the width live. Left and Right change it by a fixed step, Shift gives a larger step, and Home and End go to the minimum and the maximum. Double-click or Enter resets to the default width. The shown width always leaves both panels at or above their minimum widths. It is fitted again when the available width changes, without overwriting the preferred width. **Why:** This meets both resize criteria of #16. The re-fit is needed because collapsing the sidebar (#15) and resizing the window change the space under a stored width. **Refuted alternative:** Let the backlog panel use the browser's built-in resize handle. It needs almost no code. It lost because it has no keyboard path, so it fails the arrow-key criterion, and its grip sits at the panel's corner and not between the panels.
- **D4 — The filter matches title or number and keeps the hierarchy (#19).** The filter matches part of an item's title or its issue number, ignoring letter case, with or without a leading "#". A matching initiative shows with all its epics. A matching epic shows under its initiative, so the parent stays visible. While the filter has text, those initiatives show open, without changing their own setting. When nothing matches, the backlog says that no initiatives or epics match and that clearing the filter shows them all. The filter is view state: it is not saved, not undoable, and cleared when the lead leaves Grooming. The mockup's All and Not planned switch is not built, because no story asks for it. The epic's Assumption about the mockup is amended under D7. **Why:** Leads search by issue number as often as by title. Showing an epic under its initiative keeps "planned with initiative" readable. Forcing matches open avoids a match hidden inside a closed initiative. **Refuted alternative:** Show matching epics as a flat list without their initiatives. It is simpler to render and easier to scan. It lost because the backlog's labels ("Goal 2", "2 of 3 epics planned") depend on the initiative, and an epic covered by its initiative's goal would be unexplained.
- **D5 — Menu actions come from the drop rules and use the same plan changes (#19).** The item menu's entries are computed from the drop rules for that item. Choosing an entry calls the change path with the same plan change and arguments that the matching drop uses. The goal menu keeps Move up and Move down. These reach every order that a goal-on-goal drop reaches, one step at a time, through the same goal-move change. A planned row in a goal card gets the mockup's "Take out of plan" button, which is the same change as dragging it to the backlog. **Why:** Story #17 asks that a menu action change the plan "exactly as the same drag and drop would change it". That holds by construction only when there is one rule set and one set of changes. The plan logic already returns the plan unchanged for no-op edits, so the menu inherits the same edge cases. For example, an epic whose effective goal is a goal is disabled for that goal. **Refuted alternative:** Write the menu as its own handlers that call the planning logic directly, as the mockup does, where its menu and its drop each mark the page changed in their own way. It is quicker to write. It lost because the menu's enabled entries and the drop targets' acceptance would be two copies of the same rules, and they drift. The criterion "exactly as the same drag" would then be something tests chase, not something the structure ensures.
- **D6 — One keyboard menu behaviour, shared by both Grooming menus, kept in the page (#19).** The item menu and the goal menu share one menu behaviour. It opens from a focusable trigger in each backlog row and goal card. On opening, focus moves to the first enabled entry, and Up and Down move between entries. Escape closes the menu and returns focus to its trigger. A click outside, or Tab, also closes it. Only one menu is open at a time. After an action, focus goes to a control that still exists: after an item action, the same item's trigger; after Move up or Move down, the moved goal's trigger; after Delete goal, the next goal's trigger, or "Add goal". This behaviour stays in the Grooming page. The design system's PopupMenu guideline gains these keyboard rules. **Why:** Today the goal menu does not move focus into itself. A second menu with different keyboard rules would make the page behave two ways. Only Grooming uses menus today, and the design system holds no runtime code. The raiden-app-shell page's invariant 2 applies when a second page needs the control. **Refuted alternative:** Move the menu behaviour into the design system now as a runtime component. It would be ready for the Sprint goal and Timeline pages. It lost because the design system is tokens, CSS and guidelines today, and adding its first runtime code for one page is a bigger structural change than this M epic warrants.
- **D7 — Multi-step Undo over the plan only, as a button beside Save plan (#19).** Every plan change that changes the plan adds one undo entry. Typing in one goal field is one entry until focus leaves the field. Undo is a button beside Save plan. It goes back one entry at a time, as far as the plan the page opened with, and is unavailable when the undo list is empty. The undo list covers the plan only. Initiative expansion, the filter, the backlog width and the sidebar are never undone. The list survives a remount and is lost on reload. It has no fixed depth on sample data. There is no Redo and no page-level Undo shortcut. **Why:** Story #18 says "Given I made a change, when I choose Undo". That means any change, not only destructive ones. The mockup's undo is a message that disappears after six seconds and appears only after Take out and Delete goal. That fails the criterion, and a timed control is hard for keyboard and screen-reader users. Initiative expansion lives in the same session state today. If it were part of the snapshot, opening an initiative would count as a change. A page-level Undo shortcut would clash with the browser's own text undo inside goal fields. **Refuted alternative:** The mockup's single-step undo in a timed message, offered only after destructive changes. It is less UI and matches the mockup. It lost because it does not cover "a change" in general, and the control disappears on a timer.
- **D8 — Unsaved means "differs from the saved plan", and Save plan is immediate and local (#19).** The save state is derived by comparing the current plan with the saved plan. Save plan makes the current plan the saved plan at once. There is no request and no simulated "Saving…" delay. Save plan is unavailable when nothing is unsaved. Undoing back to the saved plan shows the plan as saved. Undoing past a save shows unsaved changes again. The save state is a status message that screen readers announce. **Why:** The epic says Save plan "changes only what the page shows". A fake delay would design a backend state before the backend epic decides it. A comparison stays true after Undo. A flag set on every change does not. **Refuted alternative:** The mockup's flag: set on any change, cleared on Save. It is simpler and needs no comparison. It lost because after the lead undoes back to the saved plan, the page would still claim "Unsaved changes", which is false.

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
