---
title: Raiden Web View
aliases: [web view, standalone web view, web host, raiden banner]
touches: [raiden-app-shell, raiden-page-host, github-sign-in, github-client]
last_updated_by: "#39"
status: active
verification: verified
---

# Raiden Web View

The web view is the Raiden pages on a web page of their own, with no GitHub page around them. It can be installed as an app. It shows a Raiden banner across the top, because no GitHub header sits above it.

## How It Works

The web view is a second, thin host beside the extension. It mounts the same shell, with the same stylesheet text, into a shadow root on its own host element. It holds no page logic and no GitHub logic. No browser extension is needed.

Before the first paint, the host sets the theme from the system light or dark preference, declares the display font on the document, and builds its preference store. It then mounts the shell with the banner option, which carries the Raiden icon. The theme changes live when the system preference changes.

Sidebar collapsed, Show issues and backlog width are kept in the browser's local storage for the web view's own address. A storage error or a value of the wrong kind gives the shell's defaults. These choices are separate from the Raiden tab's choices.

The build is static files with relative addresses, so it works at the root or under a sub-path of any HTTPS origin. The font, the icons and the offline page come from the same address. The team plans to serve it from S3 behind CloudFront; that hosting is separate work.

An app manifest names the app Raiden, opens it in a standalone window and gives it the Raiden icon. An offline worker answers a failed page load with a Raiden page that says the web view needs a connection. Online, every request goes to the network, so the web view never runs an old build.

## Key Invariants

1. The web view uses the same shell and stylesheet as the Raiden tab.
2. The theme follows the system preference only.
3. Preferences are never shared with the extension.
4. The offline worker caches only the offline page and what it needs.
5. The banner stays at the top of the window while the document scrolls.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the web view mounts the shell and sets its banner option.
- [raiden-page-host](raiden-page-host.md) — the page host is the extension's host. The web view is the second host beside it.
- [github-sign-in](github-sign-in.md) — the web view signs in by full-page redirect and keeps its record in its own local storage.
- [github-client](github-client.md) — the web view runs the client in the page.

## Decision Log

### 2026-11-22 — #30 — A thin web host with its own theme, storage and offline page
The web view mounts the same shell in a shadow root, so what renders in the tab renders the same here. The theme follows the system preference, because there is no GitHub color mode to read. Preferences use the web view's own local storage, because GitHub's scripts do not run on that address and the extension's storage cannot be reached without the extension. The offline worker is network-first and caches only the offline page, which fits the "needs a connection" message and avoids stale builds and update prompts. The build is host-independent static files, so Lambda is not needed to serve them. Refuted alternative: mount the shell into the document with ordinary stylesheet links, which is simpler but creates a second styling path that could drift from the tab.

### 2026-11-22 — #39 — Reciprocal link from github-sign-in and github-client
The web view signs in by redirect and runs the client in the page. Recorded for the two new pages.
