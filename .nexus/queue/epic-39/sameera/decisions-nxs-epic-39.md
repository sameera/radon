## 2026-11-22 — Token exchange uses PKCE challenge plus the backend secret
- **Choice:** The authorize address carries an S256 code challenge. The backend forwards the verifier and the secret to GitHub.
- **Why:** The record's D1 asks for a state and a one-time verifier, and GitHub Apps accept PKCE next to the secret.
- **Refuted alternative:** state only, with no challenge.

## 2026-11-22 — Worker keeps the pending attempt in memory only
- **Choice:** The pending attempt lives in the sign-in call's closure and is dropped when the call ends.
- **Why:** G8 asks for one use and discard, and a service worker that restarts mid-flow simply ends the attempt as "did not finish".
- **Refuted alternative:** persist the attempt in extension storage.

## 2026-11-22 — Backend answers 403 to a listed-nowhere Origin header, not only omits CORS headers
- **Choice:** A request with an unlisted Origin is refused before any GitHub call.
- **Why:** G10 limits cross-origin answers to the configured origins, and refusing early saves a GitHub call.
- **Refuted alternative:** serve the request and omit the CORS headers.

## 2026-11-22 — Web view finishes the return before the shell mounts, in main.ts
- **Choice:** `finishReturn` runs first, strips the address, then the shell mounts with the result.
- **Why:** G9 needs the code gone from the address and history before pages mount, and D4 needs the page to open on Grooming.
- **Refuted alternative:** finish the return inside the shell after mounting.

## 2026-11-22 — CSP is a meta tag in index.html with a build-time backend placeholder
- **Choice:** A `<meta http-equiv>` policy; the build fills the backend origin.
- **Why:** The web view is static files with no server of its own to send a header.
- **Refuted alternative:** a header file such as `_headers`, which only some hosts read.
