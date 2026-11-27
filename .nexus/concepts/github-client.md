---
title: GitHub Client
aliases: [github gateway, shared github client, github requests]
touches: [github-sign-in, raiden-app-shell, raiden-page-host, raiden-web-view, web-repository-picker, web-view-sign-out, live-backlog]
last_updated_by: "#73"
status: active
verification: verified
---

# GitHub Client

Every GitHub request Raiden makes in either host goes through one shared client. The client sends the request as the signed-in user. Pages never see the token.

## How It Works

Each host gives the shell a GitHub gateway, the same way it gives the preference store. A page asks the gateway for GitHub data. In the web view, the gateway runs the client in the page. In the extension, the gateway passes the request to the background worker, which runs the client. So the token stays out of the github.com tab.

The client accepts only a path on GitHub's API, so it cannot send the token to another address. It adds the token and reads the answer. Before a request, it renews the token when the stored expiry has passed. After a rejected-credentials answer, it renews once and retries once. GitHub refresh tokens work once, so the client first checks whether another request or tab has already renewed. After a failed renewal it reads the storage again before it gives up.

The client never throws. It returns plain data: a success with its status and body, or a failure with a kind. The kinds are sign-in needed, network, rate limit, permission and other. A missing, rejected or unrenewable sign-in is sign-in needed, and the host drops its record. A 403 or 404 reads as permission, because a GitHub App that is not installed answers not found. A 429 or an exhausted rate limit reads as rate limit.

## Key Invariants

1. Every GitHub request in either host carries the signed-in user's token.
2. Only one piece of code sends GitHub requests, so both hosts get the same answer.
3. The token never leaves the client, and the client sends it only to GitHub's API.
4. A failed sign-in is a different failure kind from network, rate-limit, permission and other errors.
5. Requests that fail together share one renewal.

## Integration Points

- [github-sign-in](github-sign-in.md) — the client reads the record the sign-in wrote, and renews it through the backend.
- [raiden-app-shell](raiden-app-shell.md) — the shell receives the gateway from the host and gives it to pages.
- [raiden-page-host](raiden-page-host.md) — the extension host forwards gateway requests to its worker.
- [raiden-web-view](raiden-web-view.md) — the web view runs the client in the page.
- [web-repository-picker](web-repository-picker.md) — the picker's list requests go through the client as the signed-in person.
- [web-view-sign-out](web-view-sign-out.md) — sign out takes the client's refresh lock so a renewal cannot sign the person back in.
- [live-backlog](live-backlog.md) — every live backlog request goes through this client, and its failure kinds become the backlog's named failure causes.

## Decision Log

### 2026-11-22 — #39 — One shared client behind a host-supplied gateway, failures returned as data
One piece of code sends every GitHub request, so "100% carry my sign-in" and "both hosts get the same answer" are checked in one place. Pages stay host-agnostic because the gateway comes from the host. The client returns failures as data, because the extension passes the answer between contexts and a thrown error would lose its kind. The client renews once and retries once, and compares stored and failed tokens first, because refresh tokens work once and two web view tabs share one storage. Refuted alternative: pages import the client and each host gives only a token source. It is simpler, but the token would then live in the github.com tab's content script.

### 2026-11-22 — #47 — Renew sessions early and sign out only on a refused token
Sessions expired silently, and a person was left with a dead token. The client now renews the token shortly before it expires. The app checks the session again on focus and every minute. A failed renewal signs the person out only when GitHub refuses the refresh token. A network error, a rate limit or a GitHub server error keeps the session, because the token may still be good.

### 2026-11-22 — #50 — Reciprocal link from web-repository-picker
The web view repository picker uses this page: the picker's list requests go through the client as the signed-in person.

### 2026-11-22 — #58 — Reciprocal link from web-view-sign-out
Sign out takes the same browser lock that the client takes around a token renewal. Recorded for the new page.

### 2026-11-26 — #73 — Reciprocal link from live-backlog
The live-backlog page names this page as a neighbour, so this page names it back.
