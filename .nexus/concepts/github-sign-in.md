---
title: GitHub Sign-In
aliases: [sign in with github, github sign-in, sign-in flow, signed-in user]
touches: [github-client, raiden-app-shell, raiden-page-host, raiden-web-view, web-repository-picker, web-view-sign-out, backend-settings]
last_updated_by: "#96"
status: active
verification: verified
---

# GitHub Sign-In

A person signs in with GitHub from the Raiden tab in the extension or from the web view. Each host then acts as that person. Each host keeps its own sign-in, so signing in on one does not sign in the other.

## How It Works

Both hosts use the GitHub App web sign-in flow. The host builds GitHub's authorize address with a random state, a one-time verifier and its challenge. The address asks for no scope. The read-only access (Issues, Projects and Metadata, read only) comes from the App's registration.

The code comes back to the host. The host checks the state, then sends the code and verifier to the team backend. The backend adds the App's client secret, asks GitHub for the tokens, and returns them with the username. The backend keeps nothing. It also renews tokens. It answers only the extension's origin and the web view's origin, and it refuses any other origin before it calls GitHub.

The extension signs in through the browser's sign-in window, which a background worker opens. The Raiden tab never navigates. The web view redirects the whole page to GitHub and back. It strips the code from the address before the shell mounts. A cancelled or denied sign-in leaves the person signed out, with a "sign-in did not finish" message.

The extension keeps its record in extension storage, and only the worker reads it. The web view keeps its record in its own local storage, under a strict content security policy. The shell shows a sign-in control. In the extension it shows the username in the sidebar. In the web view it shows the avatar and the menu in the banner, and the menu signs the person out of the web view only. Pages never wait for it.

## Key Invariants

1. The sign-in request asks for no scope and no write permission.
2. The client secret exists only in the backend.
3. A code, verifier or token never appears in an address that stays in history, or in a message shown to the person.
4. In the extension, the token never reaches a github.com tab.
5. A sign-in attempt is used once, then discarded.
6. The backend answers only the two configured origins.

## Integration Points

- [github-client](github-client.md) — the client reads the sign-in record, and asks the backend to renew it.
- [raiden-app-shell](raiden-app-shell.md) — the shell shows the sign-in control, and the username or, in the web view, the avatar and menu, and does not block pages.
- [raiden-page-host](raiden-page-host.md) — the extension host signs in through its worker and keeps the record in extension storage.
- [raiden-web-view](raiden-web-view.md) — the web view signs in by full-page redirect and keeps its record in local storage.
- [web-repository-picker](web-repository-picker.md) — the login from sign-in tags and checks the picker's stored repository and list.
- [web-view-sign-out](web-view-sign-out.md) — sign out ends the web view's sign-in only, and the next sign-in asks for the account chooser.
- [backend-settings](backend-settings.md) — on AWS, the backend's code exchange reads its client secret, client ID, return addresses and origins from two secret stores.

## Decision Log

### 2026-11-22 — #39 — Web sign-in with a backend code exchange, one flow in both hosts
Both hosts use the GitHub App web sign-in flow, and a small stateless backend holds the client secret and exchanges the code. GitHub's token exchange for an App needs the secret even with a verifier, and a browser build cannot hold a secret. GitHub's sign-in endpoints send no CORS headers, so the web view cannot call them directly. The extension signs in through the browser's sign-in window so the code never lands in a github.com address. The web view uses a full-page redirect, because popups misbehave in the installed app window. Refuted alternative: GitHub's device flow. It needs no secret, but the person must copy a code to a second page, the web view still needs a server, and device codes are easy to phish.

### 2026-11-22 — #47 — Require sign-in before the app shows any page
The app was usable while signed out, and GitHub calls then failed without a clear cause. The app now shows only the sign-in screen until a person is signed in. A GitHub call made without a sign-in returns "sign-in needed" and does not reach GitHub. The backend now tells a refused refresh token apart from a GitHub outage, so the app can react to each differently.

### 2026-11-22 — #50 — Reciprocal link from web-repository-picker
The web view repository picker uses this page: the login from sign-in tags and checks the picker's stored repository and list.

### 2026-11-22 — #58 — Sign-out is an optional host step, so the shell stays free of hosts
The sign-in port gains an optional sign-out step, and the shell shows Sign out only when the host supplies it. The web view supplies it and the extension does not, so the extension is exactly as it was. Only the host knows where its sign-in record lives, and the shell must never import from a host. The behaviour of sign out has its own page, web-view-sign-out, which also records the reciprocal link. Refuted alternative: none.

### 2026-11-28 — #96 — Reciprocal link from backend-settings
On AWS, the backend reads the settings its code exchange uses from two secret stores, which backend-settings records.
