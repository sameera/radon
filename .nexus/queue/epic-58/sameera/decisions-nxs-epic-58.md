## 2026-11-22 — Sign out item shows in the menu before the host step exists
- **Choice:** In story #59 the menu always shows its Sign out item and the click calls a no-op; story #60 adds the optional host step and shows the item only when the host supplies it.
- **Why:** Story #59's criterion needs the item in the menu, while D4 (the optional step) is delivered by #60.
- **Refuted alternative:** Hide the avatar until the host supplies a sign-out step, which would leave #59 with nothing to show.

## 2026-11-22 — Avatar address on avatars.githubusercontent.com
- **Choice:** The picture loads from `https://avatars.githubusercontent.com/<login>?size=64`, so the content policy adds that one host.
- **Why:** `github.com/<login>.png` redirects to that host, which would need two image hosts in the policy.
- **Refuted alternative:** `https://github.com/<login>.png` with both hosts allowed.

## 2026-11-22 — Sign out shows the sign-in screen at once through controller state
- **Choice:** The controller's signOut sets a busy, signed-out state before the host step runs; a failed step restores the earlier state and re-checks.
- **Why:** G12 forbids any page content between the choice and the reload, and the host step waits on the refresh lock.
- **Refuted alternative:** Wait for the host step to finish before changing the screen, which leaves pages visible while the lock is held.

## 2026-11-22 — A banner host with no sign-out step shows a plain avatar
- **Choice:** Without a sign-out step the avatar is a picture with no button and no menu.
- **Why:** D4 shows the Sign out item only when the host supplies the step, and a menu with no item would be empty.
- **Refuted alternative:** Render an empty menu, or hide the avatar.

## 2026-11-22 — Reload at the configured return address
- **Choice:** Sign out reloads by assigning the web view's return address, not by calling reload.
- **Why:** It drops any query or fragment, so nothing is added to or kept in the address (G21).
- **Refuted alternative:** `location.reload()`, which would keep the current address.
