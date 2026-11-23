---
title: "Close Record: Sign out from the banner account menu"
epic: "#58"
feature: "GitHub Authentication"
date: 2026-11-22
nexus_version: 1.9.0
analyze: ran 2026-11-22 @ 4fbf125e862842c01d42731aa4f142dae739282a
record: "#61"
record_hash: c1ae7787093bc4c58463a40cc2727b667a0928c620fa60ac6a9f553948e1d0dd
range:
  - repo: sameera/raiden
    pr: 63
    base: 5f2ec18192e797fd333b3459cd6491e8f7cc9ef3
    head: 151359bf4263d56729cceae9e32e67bb11bd1ce2
story_ranges:
  - story: "#59"
    ranges:
      - { repo: sameera/raiden, pr: 63, base: 5f2ec18192e797fd333b3459cd6491e8f7cc9ef3, head: 151359bf4263d56729cceae9e32e67bb11bd1ce2 }
  - story: "#60"
    ranges:
      - { repo: sameera/raiden, pr: 63, base: 5f2ec18192e797fd333b3459cd6491e8f7cc9ef3, head: 151359bf4263d56729cceae9e32e67bb11bd1ce2 }
landed_check:
  - story: "#59"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 63, result: unchanged }
  - story: "#60"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 63, result: unchanged }
---

# Close Record: Sign out from the banner account menu

## Key Decisions

- **D1 — The menu goes in the banner, so only banner hosts show it (#61).** The shell draws the avatar at the top right corner of the banner, only in a banner host and only while a person is signed in. In a banner host, the avatar takes over from the username that the sidebar shows today. The repository drop-down stays beside the Raiden word. The extension draws no banner, so it keeps its sidebar username and shows no avatar. **Why:** The epic places the menu in the banner. GitHub's own top bar has its repository selector on the left and the avatar on the right, and the banner already copies that bar for the drop-down. Showing the account in two places would confuse people. **Refuted alternative:** Put the menu in the sidebar, where the username already is, so that both hosts get it. This lost on scope. The extension is out of scope, and the epic asks for the banner and for two clicks from any page.
- **D2 — The avatar picture comes from the username, and the content policy allows only GitHub's avatar hosts (#61).** The picture comes from GitHub's public avatar address for the signed-in username, and no referrer is sent. The content policy allows GitHub's avatar hosts for images only. If the picture does not load, the button shows a neutral person mark and stays usable. Its accessible name includes the username. **Why:** The epic assumes the avatar comes from the username and needs no new permission. The content policy allows images only from the web view's own address and inline data today, so without this change the picture is blocked. The picture is not on the sign-in path, so a failure must not hide the menu. **Refuted alternative:** Read the exact avatar address from GitHub's "current user" answer through the shared client. The address would always be exact. But it adds a request on every load, it can fail on its own, and the picture still needs the same content policy change.
- **D3 — The menu uses the design system's popup style and closes itself (#61).** The avatar opens a popup menu in the design system's existing menu style. The menu closes on a click outside it, on Escape, or when its item is chosen. Escape returns focus to the avatar. The button says that it opens a menu and whether the menu is open. The Grooming page's menus are not changed. **Why:** The look already lives in the design system. The Grooming page handles closing for its own menus at page level. The banner sits outside every page, so the menu cannot rely on that. **Refuted alternative:** Move the close behaviour into one shared piece and change Grooming's menus to use it. That gives one copy of the behaviour. But it changes tested Grooming code in an epic about sign-out.
- **D4 — Sign-out is an optional host step, so the shell stays host-free (#61).** The sign-in port gains an optional sign-out step. The shell shows the Sign out item only when the host supplies that step. The web view supplies it. The extension does not. **Why:** Only the host knows where its record lives. The shell must never import from a host, as the raiden-app-shell page's invariant 1 requires. The extension stays exactly as it is. **Refuted alternative:** none
- **D5 — Sign-out removes the sign-in record and the picker's stored values, under the refresh lock (#61).** Sign out removes four things: the sign-in record, the pending attempt, the remembered repository and the saved list. It keeps the layout choices. It removes the record first, while it holds the refresh lock. **Why:** The story exists for shared computers. The saved list holds the person's private repository names in plain storage. The username tag hides them from the next person in Raiden, but it does not remove them from the browser. The layout choices are not personal and carry no access. Without the lock, a renewal in another tab could write a new token after sign-out and sign the person back in. **Refuted alternative:** Keep the remembered repository and the saved list, because the username tag already hides them from other people (the web-repository-picker page's invariant 2). The same person would then open ready on their next sign-in. This lost because the private repository names would stay on the shared computer, which is the leak the epic exists to close.
- **D6 — Sign-out ends with a full reload of the web view (#61).** After the stored data is gone, the web view reloads at its own address. **Why:** The page's memory holds the plan session, the repository list, the repository context and the open menu. A reload removes all of that at once. The start-up path already lands a signed-out person on the sign-in screen, so no new signed-out path is needed. **Refuted alternative:** Reset the state in place, with no reload. There is no flash. But every piece of memory must be found and reset, now and in later epics, and one missed piece shows the last person's data to the next person.
- **D7 — Sign-out is local only and does not revoke the token at GitHub (#61).** Sign out deletes the tokens from the browser only. It sends no request to GitHub or to the team backend. **Why:** The epic note says sign-out ends the session on this host only. Once the tokens are deleted, nobody on this computer holds them. A local-only sign-out works offline and cannot fail half-way. The backend stays stateless. **Refuted alternative:** Have the backend revoke this token at GitHub using the App's secret. This revokes the token, not the App. It protects against a token that was already copied. It lost because it needs a new backend route and its origin checks, and because sign-out would then depend on the network. A copied token would also mean the browser was already compromised.
- **D8 — After sign-out, the sign-in screen warns about the GitHub session, and the next sign-in asks for GitHub's account chooser (#61).** After sign-out, the sign-in screen says that this browser may still be signed in to GitHub, and it links to GitHub's sign-out page. The next sign-in asks GitHub to show its account chooser. Both happen only while the signed-out marker is present. Normal sign-ins are unchanged. **Why:** GitHub approves an App that a person has already approved without asking again. Without this, "Sign in with GitHub" after sign-out signs in whoever is still signed in to github.com, often the person who just left. Acceptance criterion 3 of #60 ("another person") would fail without any warning. Raiden cannot sign a person out of github.com, so the honest fix is to tell them. **Refuted alternative:** Change nothing, and rely on the person to sign out of github.com. It costs nothing. It lost because the story's "so that" fails without any visible sign.
- **Avatar from avatars.githubusercontent.com/<login>?size=64** (a decision stub the verdict on sameera/raiden#63 confirmed). **Why:** github.com/<login>.png redirects and would need two hosts in the policy **Refuted alternative:** github.com/<login>.png with both hosts allowed
- **Controller shows sign-in screen at once, restores on host failure** (a decision stub the verdict on sameera/raiden#63 confirmed). **Why:** G12 forbids page content while the lock is held **Refuted alternative:** Wait for host step before changing the screen
- **Banner host with no sign-out step shows a plain avatar** (a decision stub the verdict on sameera/raiden#63 confirmed). **Why:** D4 shows Sign out only with a host step **Refuted alternative:** Empty menu, or hide the avatar
- **Reload by assigning the return address** (a decision stub the verdict on sameera/raiden#63 confirmed). **Why:** Drops query and fragment (G21) **Refuted alternative:** location.reload()

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
