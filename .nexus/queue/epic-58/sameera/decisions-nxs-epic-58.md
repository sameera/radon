## 2026-11-22 — Sign out item shows in the menu before the host step exists
- **Choice:** In story #59 the menu always shows its Sign out item and the click calls a no-op; story #60 adds the optional host step and shows the item only when the host supplies it.
- **Why:** Story #59's criterion needs the item in the menu, while D4 (the optional step) is delivered by #60.
- **Refuted alternative:** Hide the avatar until the host supplies a sign-out step, which would leave #59 with nothing to show.

## 2026-11-22 — Avatar address on avatars.githubusercontent.com
- **Choice:** The picture loads from `https://avatars.githubusercontent.com/<login>?size=64`, so the content policy adds that one host.
- **Why:** `github.com/<login>.png` redirects to that host, which would need two image hosts in the policy.
- **Refuted alternative:** `https://github.com/<login>.png` with both hosts allowed.
