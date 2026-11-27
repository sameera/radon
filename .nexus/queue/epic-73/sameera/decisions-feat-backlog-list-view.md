## 2026-11-27 — An outside parent keeps the muted foreground on the header row
- **Choice:** A parent the query did not return uses `rd-fg-muted` with normal weight, a tooltip and a screen-reader label; the header row itself takes `rd-text-small` rather than a literal `x-small`.
- **Why:** D6 names the muted foreground and the design system reserves `rd-fg-subtle` for icons and disabled controls, and styling goes through `rd-` classes only.
- **Refuted alternative:** The subtle foreground the list view first used, which is lighter but reads as a disabled control rather than as an issue that carries information.
