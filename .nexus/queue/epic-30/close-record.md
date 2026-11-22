---
title: "Close Record: Standalone web view with a Raiden banner"
epic: "#30"
feature: "Standalone Web View"
date: 2026-11-22
nexus_version: 1.2.0
analyze: ran 2026-11-22 @ de4fef62f46b4c304293fc11f0279217b805581b
record: "#34"
record_hash: 61277f1caaaa631397fa058ebee36eb2436e2930ca17268f925dac9f08478e45
range:
  - repo: sameera/raiden
    pr: 36
    base: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8
    head: fe61b8343a65d6ad98cecdfddcbee22fe7ac6f74
story_ranges:
  - story: "#31"
    ranges:
      - { repo: sameera/raiden, pr: 36, base: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8, head: fe61b8343a65d6ad98cecdfddcbee22fe7ac6f74 }
  - story: "#32"
    ranges:
      - { repo: sameera/raiden, pr: 36, base: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8, head: fe61b8343a65d6ad98cecdfddcbee22fe7ac6f74 }
  - story: "#33"
    ranges:
      - { repo: sameera/raiden, pr: 36, base: 2a0cb091f456e0fd34e0ffbf61b44b7e8a7407b8, head: fe61b8343a65d6ad98cecdfddcbee22fe7ac6f74 }
landed_check:
  - story: "#31"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 36, result: unchanged }
  - story: "#32"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 36, result: unchanged }
  - story: "#33"
    result: unchanged
    prs:
      - { repo: sameera/raiden, pr: 36, result: unchanged }
---

# Close Record: Standalone web view with a Raiden banner

## Key Decisions

- **D1 — Add a thin web host that mounts the same shell in a shadow root (#34).** Add a second host app beside the extension. It serves the Raiden pages on a page of their own and mounts the same shell, with the same stylesheet text, into a shadow root on its own host element. It does not use the extension's GitHub tab, content-hiding or tab-marking logic. **Why:** The pages are already host-agnostic: the shell takes a root, stylesheet text and a preference store. A second thin host is the pattern the project instructions and the raiden-page-host page's invariant 5 expect. The shadow root keeps one styling path, so what renders in the tab renders the same in the web view, which is what #31 asks for with "same content and controls". The page is a normal web page, so no extension is needed. **Refuted alternative:** Mount the shell straight into the document with ordinary stylesheet links. There are no GitHub styles to isolate from, so it is simpler. It lost because it creates a second styling path, with document-level rules and a different root for theme selectors, that could drift from the tab. The shadow root costs nothing extra because the shell already supports it.
- **D2 — The web view's theme follows the system preference only (#34).** The theme resolver uses the system light or dark preference. It sets the theme on the host before the shell mounts and updates it when the preference changes. The offline page follows the same preference. **Why:** With no GitHub page there is no GitHub color mode to read, and #31 names the system setting as the source. Setting the theme before the first paint avoids a flash of the wrong theme, matching how the shell reads preferences before rendering. **Refuted alternative:** An in-app light, dark or auto choice, stored in the web preference store, to stand in for GitHub's mode. It would let a lead who forces GitHub to dark get dark here too. It lost because no story asks for it, and it adds a control and a third color setting that the tab ignores.
- **D3 — Web view preferences live in the web view origin's own storage (#34).** The web preference store keeps sidebar collapsed, Show issues and backlog width in local storage on the web view's origin. It reads them synchronously, so the shell gets them before its first render. A storage error, or a value of the wrong kind, falls back to the shell's defaults. It does not share preferences with the extension. **Why:** #31 requires the sidebar and the issues to come back as the lead left them. The extension's storage cannot be reached without the extension, and #31 says no extension is needed. The recorded reason for extension storage was that GitHub's scripts must not read or clear Raiden's preferences. GitHub's scripts do not run on the web view's origin, so plain origin storage is safe there. **Refuted alternative:** Share preferences with the extension through extension messaging when it is installed, and fall back to origin storage when it is not. It would give one set of choices across both views. It lost because it needs two storage paths and a sync rule, widens the extension's host permissions beyond github.com and the Raiden host, and makes the web view behave differently depending on whether the extension is installed.
- **D4 — The web view is a host-independent static build, to be served from S3 behind CloudFront (#34).** The web host builds to static files with relative addresses, so they work at the root or under a sub-path of any HTTPS origin. The display font, the icons and the offline page are part of that build and come from the same origin. The team will serve the build from an S3 bucket behind CloudFront in its own AWS account. This epic delivers the build and a local preview. Provisioning the bucket and the distribution is separate work. **Why:** No hosting or infrastructure code exists today. S3 behind CloudFront serves static files without cold starts, and the future API can later be routed under the same distribution, giving one origin. Keeping provisioning out keeps the epic at size M. Same-origin files keep the security boundary simple and let the offline worker cache what it needs. **Refuted alternative:** Serve the files from the existing Go Lambda behind its API gateway. It would make one origin now, which suits sign-in later. It lost because Lambda would serve static files with cold-start delay and a custom file handler.
- **D5 — Make the web view installable with an app manifest built from the existing Raiden icon (#34).** The build includes an app manifest with the name and short name Raiden, standalone display, a start address and scope set to the web view, and icons at the sizes Chrome requires, made from the existing Raiden icon source. The page links the manifest and registers the offline worker. **Why:** #32 needs the browser's install offer, then a standalone window under the Raiden name and icon. The existing artwork is already the extension's icon, so the installed app and the extension look the same. **Refuted alternative:** none
- **D6 — The offline worker fetches page loads from the network and caches only the offline page (#34).** The offline worker handles page loads only. It tries the network first and returns the cached offline page when the network fails. It caches nothing except what the offline page needs: its font and icon. Every build gets a new cache name, and old caches are deleted when the new worker activates. The offline page is self-contained, uses design-system token values for both themes and makes no request. **Why:** #32 asks for a Raiden message instead of the browser's error page, and nothing more. With network-first and no app caching, the web view never runs an old build, so no update prompt or version handling is needed. It also fits the coming live-data work, which needs a connection anyway. **Refuted alternative:** Cache the whole app so it works fully offline. With sample data and no network calls, that would work today. It lost because it contradicts #32's "needs a connection" message, and it brings stale-build risk and an update flow that would be thrown away once live data makes the network necessary.
- **D7 — The banner is a design-system component the shell draws only when the host sets the banner option (#34).** The banner joins the design system as a component, with its guideline page and a preview. The shell renders it above the sidebar and page only when the host passes the banner option. The web host passes it; the extension does not. With the option set, the shell's frame fills the window below the banner instead of the embedded layout the tab uses. **Why:** The raiden-app-shell page's invariant 3 needs the banner's height, ground and type to come from design-system tokens, and a GitHub-header height is not on the current spacing scale, so it becomes a design-system value. Inside the shell, the banner shares the shell's style scope and theme and is covered by the existing shell tests. The host keeps holding no UI. Leaving the option off in the extension keeps the epic's out-of-scope line about the Raiden tab. **Refuted alternative:** The web host draws the banner itself, outside the shell, which keeps the shell untouched. It lost because it puts UI in an app, against the pattern that apps stay thin and pages live in libraries, and it needs a second style scope or a second copy of the tokens to theme it.
- **D8 — The banner has a neutral ground and the existing brand text color on its mark (#34).** The banner uses the design system's subtle neutral ground with a muted bottom edge, matching GitHub's header. The wordmark uses the existing brand text token. The banner's height and horizontal padding match GitHub's top header and are set as design-system values. It has no search, notifications or account menu. No new color token is added. **Why:** The design system's first principle, "Blend, then mark", puts neutrals on the frame and brand color on what Raiden owns. The brand text token's documented use is brand text on that subtle ground. Measured against the token values, it gives 5.49:1 in light and 10.48:1 in dark, so the 4.5:1 requirement passes with margin. **Refuted alternative:** A banner filled with the brand teal and on-brand text, a common product-bar treatment. It lost because its light-theme text measures 4.87:1, which passes with little margin, and a full-width teal bar breaks "Blend, then mark" and does not look like GitHub's header, which the epic asks the banner to resemble.
- **D9 — The banner is pinned to the top while the document scrolls (#34).** The document stays the scroll container. The banner is pinned to the top of the window, and the sidebar and page scroll under it. **Why:** #33 asks for the banner to stay at the top. Keeping the document as the scroller keeps native scroll, keyboard paging and the browser's auto-scroll during Grooming drags working as they do now. **Refuted alternative:** A fixed, window-high frame with the page area as an inner scroll region, which pins both the banner and the sidebar. It lost because it adds a second scroll container and changes scroll and drag auto-scroll behaviour for Grooming in the web view only, which works against "same content and controls".
- **D10 — The banner's mark is the existing Raiden icon followed by the wordmark (#34).** The banner's left end shows the existing Raiden icon at small size, then the wordmark. The web host passes the icon with the banner option, so the shell imports nothing from an app. The icon file is served from the web view's own origin. **Why:** The lead chose it at the clarification gate. Raiden icon artwork already exists and is the extension's icon and the installed app's icon, so the banner matches what the lead sees in the dock and the browser toolbar. Icon then name mirrors GitHub's logo-then-context header layout. **Refuted alternative:** The wordmark alone, as the epic's assumption and the design system state. It needs no icon passed to the shell. It lost because the icon already exists, and leaving it out would make the banner the only Raiden surface without it.
- **apps/extension/fonts moved to libs/design-system/fonts; both hosts copy it from there** (a decision stub the verdict on sameera/raiden#36 confirmed). **Why:** Apps must not import from each other, and the web host needs the same font file **Refuted alternative:** Copy the binary into apps/web/

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
