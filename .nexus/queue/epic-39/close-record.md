---
title: "Close Record: Sign in with GitHub"
epic: "#39"
feature: "GitHub Authentication"
date: 2026-11-22
nexus_version: 1.2.0
analyze: ran 2026-11-22 @ 529bb24d63487713c51d4588aa490899fe5c2bbf
record: "#44"
record_hash: 8ef090f864f78b75d7f6319b6e07aeee2e7e390857b2d794c810ef03ca22edd5
range:
  - repo: sameera/raiden
    pr: 45
    base: 4ff71065e93e252050ecc37a67b0464352783f8b
    head: d3aa3e23642bda7a2b5efc2274c05777cd6d7cca
story_ranges:
  - story: "#40"
    ranges:
      - { repo: sameera/raiden, pr: 45, base: 4ff71065e93e252050ecc37a67b0464352783f8b, head: d3aa3e23642bda7a2b5efc2274c05777cd6d7cca }
  - story: "#41"
    ranges:
      - { repo: sameera/raiden, pr: 45, base: 4ff71065e93e252050ecc37a67b0464352783f8b, head: d3aa3e23642bda7a2b5efc2274c05777cd6d7cca }
  - story: "#42"
    ranges:
      - { repo: sameera/raiden, pr: 45, base: 4ff71065e93e252050ecc37a67b0464352783f8b, head: d3aa3e23642bda7a2b5efc2274c05777cd6d7cca }
landed_check:
  - story: "#40"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 45, result: unchanged }
  - story: "#41"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 45, result: unchanged }
  - story: "#42"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 45, result: unchanged }
---

# Close Record: Sign in with GitHub

## Key Decisions

- **D1 — GitHub App web sign-in with a backend code exchange, in both hosts (#44).** Both hosts use the GitHub App web sign-in flow with a backend code exchange, a random state and a verifier. **Why:** GitHub's token exchange for an App needs the client secret, even with a verifier, and the secret cannot ship in a browser build. GitHub's sign-in endpoints send no CORS headers, so the web view cannot call them directly. One flow in both hosts puts most of the logic in the sign-in core. The verifier makes a stolen code useless at the public exchange endpoint. **Refuted alternative:** GitHub's device flow. It needs no secret and no backend for the extension. It lost because the user must copy a code into a second page, which works against the one-minute sign-in goal, because the web view still cannot reach the device endpoints without a server, and because device codes are easy to phish.
- **D2 — The backend is a stateless secret holder (#44).** The backend only exchanges and refreshes tokens. It returns the username with the exchange. **Why:** It keeps the backend small and needs no DynamoDB, so it does not touch the Raiden-only data standard. Returning the username with the exchange lets #40 and #41 show it after a reload without a host-side GitHub call. So neither story waits for #42's client. **Refuted alternative:** a backend-for-frontend that keeps tokens behind an HttpOnly session cookie and proxies every GitHub call. It is stronger against script injection in the web view. It lost because every GitHub request would cost a Lambda call, the extension would not need it so the hosts would take different paths, and cross-site cookies would tie the web view and the backend to one site before hosting is decided.
- **D3 — The extension signs in through the browser's sign-in window (#44).** The extension finishes sign-in in the browser's sign-in window, run by a new background worker. The Raiden tab never navigates. **Why:** That window is available only to extension pages and workers, not to content scripts. The code comes back to the extension's own return address, never to a github.com address that GitHub's scripts or history could read. The Raiden tab keeps its state. Closing the window is a clear "did not finish" signal. **Refuted alternative:** send the github.com tab to GitHub's authorize page, and return to a github.com address that the content script watches. It needs no new permission and no worker. It lost because the code would sit in a github.com address, readable by page scripts and kept in history.
- **D4 — The web view signs in by full-page redirect (#44).** The web view uses a full-page redirect back to its own address. The pending attempt is kept in session storage, and the address is cleaned before the shell mounts. **Why:** A redirect works the same in a browser tab and in the installed app window. Session storage outlives the reload but belongs to one tab. Cleaning the address keeps the code out of history. **Refuted alternative:** a popup window that sends a message back to the page. The page would keep its in-memory state. It lost because popups are blocked or behave badly in the installed app window, and the page would need a second return page and checks on which origin sent the message.
- **D5 — Each host keeps its own sign-in record (#44).** In the extension, only the background worker uses the sign-in record, and it keeps it in extension storage. In the web view, the record sits in the web view's own local storage, and the web view adds a strict content security policy. **Why:** This follows the epic's assumption that each host holds its own sign-in, which you confirmed. It matches how each host already keeps its preferences. With the record in the worker, the token never enters the github.com tab. The web view has no third-party scripts, and a tight policy covers the main way local storage gets read. **Refuted alternative:** in the web view, the backend keeps the refresh token in an HttpOnly cookie, and the page holds the access token in memory only. That shrinks what a script injection could steal from about six months of access to about eight hours. It lost because it needs same-site cookies, and so a fixed hosting layout for the web view and the backend, which is not decided.
- **D6 — One shared GitHub client behind a gateway (#44).** One shared GitHub client sends every GitHub request. Hosts give pages a GitHub gateway. In the extension, the gateway passes requests to the background worker, which runs the client. **Why:** One piece of code sends GitHub requests, so "100% carry my sign-in" and "both get the same answer" can be checked in one place. Pages stay host-agnostic, because the gateway is given to the shell like the preference store. The extension keeps its token out of the tab. The worker accepts only GitHub API addresses, so the gateway cannot send the token anywhere else. **Refuted alternative:** pages import the client directly, and each host gives it only a token source. It is simpler, with no message passing. It lost because the token would then live in the github.com tab's content script.
- **D7 — Renew once, retry once, report a failed sign-in as its own kind (#44).** The client renews first when the stored expiry has passed, and renews once more on a rejected-credentials answer. A missing, rejected or unrenewable sign-in becomes sign-in needed, and the host drops its record. **Why:** This gives #42's "tell it apart" a single failure kind, while network, rate-limit, permission and server errors stay separate. GitHub refresh tokens can be used only once, so failed requests that happen together must share one renewal. Two web view tabs share one storage, so a tab must read the storage again before it gives up, in case another tab just renewed. **Refuted alternative:** turn off token expiry on the GitHub App, so there is no renewal path. It is simpler. It lost because a stolen token would never expire.
- **D8 — Read-only access comes from the App registration (#44).** The GitHub App registration asks for Issues read, Projects read and Metadata read, and nothing else. **Why:** GitHub Apps do not ask for scopes at sign-in. The consent screen shows the registered permissions. A user token reaches only what the user can see and what the App is installed on, so "I see only what I may see" holds by construction. This applies the product-context and standards rule. It is not a new rule. **Refuted alternative:** none
- **D9 — Sign-in lives in the shell and does not block pages (#44).** The shell shows a sign-in control, the username and a "sign-in did not finish" message. Pages are not blocked while signed out. **Why:** Both hosts show the same pages, so sign-in in the shell gives the same sign-in outcome in either one. Grooming runs on sample data, so blocking it behind a sign-in screen would remove something that works today. **Refuted alternative:** a full sign-in screen in place of the pages until the user signs in. It makes the path clearer for new users. It lost because nothing in this epic needs GitHub data to render a page.
- **D10 — Team build settings fix the App and server addresses (#44).** The GitHub App client ID, the backend address, the web view's return address and the extension's fixed key are fixed at build time. The backend allows exactly the web view origin and the extension origin. **Why:** The extension must be built per team anyway, because its host permission names the team's backend. A fixed key keeps the extension's return address stable. Build-time settings in both hosts keep them symmetric. **Refuted alternative:** a small runtime settings file served next to the web view, so one web build could serve any team. It lost because the extension cannot use the same approach, and each deployment has one team.
- **D11 — #40 delivers the shared parts, #41 builds on them (#44).** #40 delivers the sign-in core, the backend exchange and the shell sign-in UI. #41 builds on them. #40 is recorded as a blocker of #41 on GitHub. **Why:** If #40 and #41 ran in parallel, both would build the same core and the same exchange. **Refuted alternative:** none
- **Token exchange uses PKCE challenge plus the backend secret: The authorize address carries an S256 code challenge. The backend forwards the verifier and the secret to GitHub.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** The record's D1 asks for a state and a one-time verifier, and GitHub Apps accept PKCE next to the secret. **Refuted alternative:** state only, with no challenge
- **Worker keeps the pending attempt in memory only: The pending attempt lives in the sign-in call's closure and is dropped when the call ends.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** G8 asks for one use and discard, and a restart mid-flow ends the attempt as did not finish. **Refuted alternative:** persist the attempt in extension storage
- **Backend answers 403 to an unlisted Origin: A request with an unlisted Origin is refused before any GitHub call.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** G10 limits cross-origin answers to the configured origins. **Refuted alternative:** serve the request and omit the CORS headers
- **Web view finishes the return before the shell mounts: finishReturn runs first, strips the address, then the shell mounts with the result.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** G9 needs the code gone from the address and history before pages mount. **Refuted alternative:** finish the return inside the shell after mounting
- **CSP is a meta tag with a build-time backend placeholder: A meta http-equiv policy; the build fills the backend origin.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** The web view is static files with no server of its own to send a header. **Refuted alternative:** a header file such as _headers
- **The GitHub client returns results as data and never throws: request resolves to {ok,status,body} or {ok:false,kind}.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** The extension passes the answer between contexts, and plain data keeps the failure kind. **Refuted alternative:** throw a typed error
- **A 404 from GitHub reads as a permission failure: 403 and 404 map to permission; 429 or an exhausted rate limit maps to rate-limit.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** R4 says an App that is not installed answers not found, and the record asks that to read as a permission failure. **Refuted alternative:** keep 404 as other
- **Renewal reads storage first and again on failure: Before refreshing, compare the stored token with the failed one; after a failed refresh, re-read before dropping.** (a decision stub the verdict on sameera/raiden#45 confirmed). **Why:** Refresh tokens work once, so a second tab or request must reuse the first one's result (G20). **Refuted alternative:** a lock shared between tabs

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
