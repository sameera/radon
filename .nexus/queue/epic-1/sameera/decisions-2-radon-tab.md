## 2026-11-21 — Clone the Code tab to build the Radon tab
- **Choice:** Copy GitHub's Code `<li>` and rewrite href, icon, label; no Radon CSS.
- **Why:** Reuses GitHub's own classes, so size, spacing, font and light/dark match without tracking selectors.
- **Refuted alternative:** Hand-built markup styled with `rd-` tokens (would drift from GitHub's tab styling).

## 2026-11-21 — Detect repository pages by the "Repository" nav
- **Choice:** Inject only when `nav[aria-label="Repository"]` has a Code tab with an `/owner/repo` href.
- **Why:** Organization and profile pages use other nav labels, so the rule needs no URL blocklist.
- **Refuted alternative:** Match the URL path (breaks on reserved first segments like `/settings/x`).

## 2026-11-21 — Overflow: add a menu item when the More menu opens
- **Choice:** When the More menu is open and the Radon tab is hidden or clipped, clone the last repo entry into the menu.
- **Why:** The menu is rendered by React only while open, and React owns the list, so a one-time injection cannot reach it.
- **Refuted alternative:** Move the tab into the bar's React state (not reachable from a content script).

## 2026-11-21 — Tab href is /owner/repo/radon, page not built
- **Choice:** Link to `/owner/repo/radon`; no placeholder page in this story.
- **Why:** Story acceptance criteria cover the tab only; the page is a later epic.
- **Refuted alternative:** Render a placeholder over GitHub's 404 (extra scope, and the 404 page has no tab bar).
