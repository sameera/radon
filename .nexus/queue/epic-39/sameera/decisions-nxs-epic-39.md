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
