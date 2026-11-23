---
title: Web View Sign-Out
aliases: [sign out, sign-out, account menu sign out, signed-out marker]
touches: [github-sign-in, raiden-web-view, raiden-banner, web-repository-picker, github-client, raiden-app-shell]
last_updated_by: "#58"
status: active
verification: verified
---

# Web View Sign-Out

A signed-in person can choose Sign out in the avatar menu of the web view's banner. Sign out ends the session on this browser only. It removes the stored sign-in and the picker's stored values, then reloads the web view on the sign-in screen. The extension has no sign-out.

## How It Works

The shell offers Sign out only when the host supplies a sign-out step. The web view supplies one. The extension does not.

Sign out takes the browser lock that the GitHub client takes around a token renewal, so it waits for a renewal under way. Under that lock it removes the stored sign-in first. It then removes the pending sign-in attempt, the remembered repository and the kept repository list. It keeps the layout choices. It sets a one-time marker in this tab. A storage error does not stop it.

It sends no request to GitHub or to the backend. It does not revoke the token or the App.

The web view then reloads at its own address, which clears the page's memory. The sign-in screen shows at once, before the reload.

While the marker is present, the sign-in screen says this browser may still be signed in to GitHub and links to GitHub's sign-out. The next sign-in asks GitHub for its account chooser. A finished sign-in removes the marker.

## Key Invariants

1. Sign out removes the sign-in, the pending attempt, the remembered repository and the kept list, and keeps the layout choices.
2. A token renewal never writes a sign-in back after a sign-out.
3. Sign out sends no request, and it never revokes the token or the App at GitHub.
4. After sign out, no page content and no repository list shows until the person signs in again.
5. The marker and the reload address hold no token or login.
6. Signing out of the web view never changes the extension's sign-in.

## Integration Points

- [github-sign-in](github-sign-in.md) — sign out ends the web view's sign-in, and the next sign-in asks for the account chooser.
- [raiden-web-view](raiden-web-view.md) — the web view supplies the sign-out step and reloads itself at the end.
- [raiden-banner](raiden-banner.md) — the avatar menu in the banner holds the Sign out item.
- [web-repository-picker](web-repository-picker.md) — sign out removes the remembered repository and the kept list, because they hold private repository names.
- [github-client](github-client.md) — sign out takes the client's refresh lock so a renewal cannot sign the person back in.
- [raiden-app-shell](raiden-app-shell.md) — the shell shows Sign out only when the host supplies the step, and shows the sign-in screen at once.

## Decision Log

### 2026-11-22 — #58 — Sign out is local, takes the refresh lock, removes personal values and ends in a reload
Sign out deletes the tokens from the browser and sends no request, so it works offline and cannot fail half-way. It removes the picker's stored values as well, because the saved list holds private repository names in plain storage and the username tag hides them from the next person but does not remove them from the browser. It keeps the layout choices, which are not personal. It takes the refresh lock and removes the sign-in first, because a renewal in another tab could otherwise write a new token after sign out. A full reload follows, because the page's memory holds the plan session, the repository list and the repository context, and a reload clears all of it at once. The shell shows the sign-in screen at once and restores the page if the host step fails, because no page content may show while the lock is held. After sign out the sign-in screen warns about the GitHub session and the next sign-in asks for the account chooser, because GitHub approves an already-approved App without asking, and would sign in whoever is still signed in to github.com. Refuted alternatives: have the backend revoke the token, which needs a new route and makes sign out depend on the network; keep the saved list, which leaves private repository names on a shared computer; reset the state in place with no reload, where one missed piece shows the last person's data; and change nothing about the GitHub session, where "another person" would fail without any warning.
