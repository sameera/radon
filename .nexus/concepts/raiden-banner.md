---
title: Raiden Banner
aliases: [banner, banner option, top banner]
touches: [raiden-app-shell, raiden-web-view, web-repository-picker]
last_updated_by: "#50"
status: active
verification: verified
---

# Raiden Banner

The banner is the bar across the top of a host that has no GitHub page around Raiden. It shows the Raiden mark and word. While a person is signed in, it also holds the repository drop-down.

## How It Works

The shell draws the banner above the sidebar and the page only when the host sets the banner option. The option carries the icon, so the shell imports nothing from an app. The extension never sets the option.

The banner is a design-system component with a neutral ground, the brand color on the wordmark, and the height and padding of GitHub's top header. It stays at the top of the window while the document scrolls, and the frame fills the window below it.

Beside the mark and word, the banner holds one control: the repository drop-down. It shows only while a person is signed in. The banner holds no other control.

## Key Invariants

1. The banner shows only when the host sets the banner option.
2. The banner stays at the top of the window while the document scrolls.
3. The only control in the banner is the repository drop-down, and it shows only while signed in.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the shell draws the banner when the host sets the option, and puts the drop-down in it.
- [raiden-web-view](raiden-web-view.md) — the web view is the host that sets the banner option.
- [web-repository-picker](web-repository-picker.md) — the drop-down is the picker's control.

## Decision Log

### 2026-11-22 — #50 — split from raiden-app-shell, and the banner allows one control
The shell page passed the 400-word cap, so the banner moved here. The banner is loaded on its own when work touches the host's top bar, with no need for the rest of the shell. The banner's earlier rule against any control now allows exactly the repository drop-down, as GitHub's own banner holds its repository selector in the same place. Refuted alternative: leave the banner in the shell page and drop other still-true text to fit under the cap.
