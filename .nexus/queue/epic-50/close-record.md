---
title: "Close Record: Repository context for every Raiden page"
epic: "#50"
feature: "Project Context"
date: 2026-11-22
nexus_version: 1.2.0
analyze: ran 2026-11-22 @ e93cd8f4f80c45d99a57186867f347de7dc4956d
record: "#55"
record_hash: 2991ab27006cfe587cf73d2e64afd0de69c5b50dc1ee4c4c990c10a4e5602115
range:
  - repo: sameera/raiden
    pr: 56
    base: 078bdbb77911515416f579529efdef3577ef0f5d
    head: 5f2a039e827647d63533398781eed4c6beba9f5d
story_ranges:
  - story: "#51"
    ranges:
      - { repo: sameera/raiden, pr: 56, base: 078bdbb77911515416f579529efdef3577ef0f5d, head: 5f2a039e827647d63533398781eed4c6beba9f5d }
  - story: "#52"
    ranges:
      - { repo: sameera/raiden, pr: 56, base: 078bdbb77911515416f579529efdef3577ef0f5d, head: 5f2a039e827647d63533398781eed4c6beba9f5d }
  - story: "#53"
    ranges:
      - { repo: sameera/raiden, pr: 56, base: 078bdbb77911515416f579529efdef3577ef0f5d, head: 5f2a039e827647d63533398781eed4c6beba9f5d }
  - story: "#54"
    ranges:
      - { repo: sameera/raiden, pr: 56, base: 078bdbb77911515416f579529efdef3577ef0f5d, head: 5f2a039e827647d63533398781eed4c6beba9f5d }
landed_check:
  - story: "#51"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 56, result: unchanged }
  - story: "#52"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 56, result: unchanged }
  - story: "#53"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 56, result: unchanged }
  - story: "#54"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 56, result: unchanged }
---

# Close Record: Repository context for every Raiden page

## Key Decisions

- **D1 — One shared repository context replaces passing the repository address down (#55).** The Raiden pages library holds one repository context. Each host writes it through its repository source, and any component reads it directly and re-renders when it changes. It replaces the repository address now passed from mount to shell to Grooming to each issue link. It follows the pattern of the existing GitHub gateway context, but its value can change during a visit. **Why:** Both hosts need the same answer, and the web view's answer changes during a visit. A changeable shared value meets #51's "no parent passing" and "without a page reload" criteria directly. It also removes the chain of passed-down values that already runs four levels deep in Grooming. **Refuted alternative:** Keep the address as a mount option and have the web view unmount and remount the shell on each pick. It needs no new holder. It lost because a remount drops in-memory page state, such as the open page, the sidebar state and drag state, and it keeps the passed-down chain #51 exists to remove.
- **D2 — The shell handles "none" once, above every page (#55).** When the repository context is "none", the shell's main area shows the pick prompt in place of the selected page. The sidebar and banner stay. In the signed-out web view, the prompt asks the person to sign in first. No page is rendered with "none". **Why:** Every page needs a repository. One check in one place means no page can forget it, and future pages get it without extra work. **Refuted alternative:** Let each page render with "none" and show its own empty state. That allows page-specific hints. It lost because every page would carry the same branch, and a page that forgets it shows broken or empty data for no repository.
- **D3 — The extension rewrites the context whenever the page's repository differs (#55).** The extension writes the repository from the github.com tab bar into the repository context on mount. It writes again whenever a later sync finds a different repository while the Raiden tab is still showing. Today the mounted host keeps the address it was mounted with and never compares it. **Why:** #51's first criterion requires the extension's current repository to equal the viewed page's repository. GitHub's in-page navigation can keep the host alive across a repository change. One comparison makes the guarantee hold in every case. **Refuted alternative:** none
- **D4 — The list is every repository reachable through Raiden's App installations, read in full (#55).** The drop-down lists the repositories GitHub returns for the person's installations of Raiden's GitHub App, including organisation repositories. The web view reads every installation and every page until GitHub's reported total is reached, then sorts by owner and name. Each entry shows as "owner/name". All requests go through the existing gateway as the signed-in person. The lead confirmed this reading of "the person's GitHub account" at the clarification gate. **Why:** The signed-in person's token reaches only repositories that both the person and the App can access. Listing by installation gives exactly that set, which matches the epic's assumption. Each installation's answer carries a total count, so the web view knows the list is complete without paging headers, which the gateway does not expose. Reading every page meets #52's several-hundred-repositories criterion. **Refuted alternative:** List the person's repositories through GitHub's general listing for the signed-in user. It is one call family. It lost because, under an App token, it is unclear whether it filters to installed repositories, and it returns a bare list, so completeness would rest on guessing from a short last page.
- **D5 — The drop-down is the browser's own list control in the banner, signed-in only (#55).** The repository drop-down is the browser's native select control, styled with design-system tokens. It sits in the banner beside the mark and word and appears only while the web view has a signed-in person. A new design-system component page documents it. The banner page's rule against any control is amended to allow this one control. **Why:** With several hundred entries and no search (search is out of scope), the native control gives type-to-jump by first letters, full keyboard and screen-reader support, and correct scrolling without extra work. The existing popup menu is documented for a short list of actions, not for picking among hundreds. Placing the selector in the banner follows GitHub's own banner, which shows the repository selector in the same place. **Refuted alternative:** A custom list built on the popup menu's styles. Its open list would match Raiden's look exactly. It lost because the team would have to build and test type-ahead, scrolling and accessibility for hundreds of entries, which the browser already provides.
- **D6 — The remembered repository and kept list are stored in the web view's preference storage, tagged with the login (#55).** Both values are stored through the web view's existing preference store in local storage, each with a login tag. A value whose tag differs from the signed-in person is ignored and is overwritten at the next write. One slot exists per value, not one per person. The remembered repository becomes current at open, before GitHub answers. Stored values hold only the login and repository owners, names and addresses, never a token or other sign-in data. The extension stores neither value. **Why:** The lead asked for local storage. Reusing the preference store keeps its existing rule that a storage error reads as "not set". The tag meets #54's third criterion. It also stops the previous person's repository from becoming current for a new person, which would show a repository name the new person may not be allowed to see and send requests that fail. A single slot keeps storage bounded. **Refuted alternative:** Keep one entry per login in a map. People who take turns on one browser would each keep their own last repository. It lost because shared browsers are rare for this product, and the map would keep every past person's private repository names in storage indefinitely and need pruning.
- **D7 — Only a complete list can replace the kept list or clear the remembered repository (#55).** A reachable-list load counts only when every installation and every page succeeded. Any failure leaves the kept list in storage and in the drop-down, and leaves the current repository unchanged. **Why:** #53's second criterion resets the current repository when the remembered one is missing from the freshly loaded list. A partial list, for example one page refused by a rate limit, would make a present repository look missing. That would wrongly reset the person's current repository and overwrite a good kept list with a short one. **Refuted alternative:** none
- **Keep repoUrl mount option beside the repo store** (a decision stub the verdict on sameera/raiden#56 confirmed). **Why:** Tests and fixed-address hosts need no store **Refuted alternative:** Remove repoUrl
- **Shared paged reader using total_count** (a decision stub the verdict on sameera/raiden#56 confirmed). **Why:** Gateway has no paging headers **Refuted alternative:** Stop at first short page
- **Signed-out web view resets context to none** (a decision stub the verdict on sameera/raiden#56 confirmed). **Why:** G3 and G13 **Refuted alternative:** Leave repository current until reload

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
