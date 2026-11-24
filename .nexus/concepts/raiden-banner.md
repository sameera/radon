---
title: Raiden Banner
aliases: [banner, banner option, top banner]
touches: [raiden-app-shell, raiden-web-view, web-repository-picker, web-view-sign-out, repository-menu]
last_updated_by: "#66"
status: active
verification: verified
---

# Raiden Banner

The banner is the bar across the top of a host that has no GitHub page around Raiden. It shows the Raiden mark and word. While a person is signed in, it also holds the repository breadcrumb and the person's avatar.

## How It Works

The shell draws the banner above the sidebar and the page only when the host sets the banner option. The option carries the icon, so the shell imports nothing from an app. The extension never sets the option.

The banner is a design-system component with a neutral ground, the brand color on the wordmark, and the height and padding of GitHub's top header. It stays at the top of the window while the document scrolls, and the frame fills the window below it.

Beside the mark and word, the banner holds the repository breadcrumb, read as owner, slash, name. It is one control. While no repository is chosen, it reads "Pick a repository". Selecting it opens the repository menu, on its own page. At its top right corner the banner holds the avatar, which opens the menu. Both show only while signed in. The banner holds no other control.

The avatar is a button. Its picture comes from GitHub's public avatar address for the username, and no referrer is sent. The web view's content policy allows images from GitHub's avatar host for this picture and from no other new source. If the picture does not load, the button shows a neutral person mark and stays usable. The button's name includes the username and says whether the menu is open.

Clicking the avatar opens a menu in the design system's popup style. The menu closes on a click outside it, on Escape, or when its item is chosen. Escape returns focus to the avatar. The menu holds Sign out, and only when the host supplies a sign-out step. A banner host with no sign-out step shows the avatar with no menu.

## Key Invariants

1. The banner shows only when the host sets the banner option.
2. The banner stays at the top of the window while the document scrolls.
3. The banner's only controls are the repository breadcrumb and the avatar, and both show only while signed in.
4. The menu shows Sign out only when the host supplies a sign-out step.
5. A failed avatar picture never hides the menu.

## Integration Points

- [raiden-app-shell](raiden-app-shell.md) — the shell draws the banner when the host sets the option, and puts the breadcrumb and the avatar in it.
- [raiden-web-view](raiden-web-view.md) — the web view is the host that sets the banner option.
- [web-repository-picker](web-repository-picker.md) — the breadcrumb opens the menu of the picker's repositories, one of the banner's two controls beside the avatar.
- [web-view-sign-out](web-view-sign-out.md) — the avatar menu holds the Sign out item.
- [repository-menu](repository-menu.md) — the breadcrumb opens the menu, and the avatar menu and the repository menu never open together.

## Decision Log

### 2026-11-22 — #50 — split from raiden-app-shell, and the banner allows one control
The shell page passed the 400-word cap, so the banner moved here. The banner is loaded on its own when work touches the host's top bar, with no need for the rest of the shell. The banner's earlier rule against any control now allows exactly the repository drop-down, as GitHub's own banner holds its repository selector in the same place. Refuted alternative: leave the banner in the shell page and drop other still-true text to fit under the cap.

### 2026-11-22 — #58 — The banner gains an avatar menu, and the web view and the extension show the account in different places
The avatar sits at the top right corner of the banner and takes over from the username that the sidebar shows, only in a banner host. GitHub's own top bar puts its repository selector on the left and the avatar on the right, and showing the account in two places would confuse people. The banner's earlier rule of one control now allows two. The picture comes from the username, with no extra request through the client, so the content policy allows GitHub's avatar host for images only. The menu closes itself and uses the existing popup style, because the banner sits outside every page and cannot rely on a page's close handling. Grooming's menus are unchanged, so for now two copies of the close behaviour exist. The page also records the reciprocal link from web-view-sign-out. Refuted alternatives: a menu in the sidebar, which would reach both hosts but the extension is out of scope and the epic asks for the banner; reading the exact avatar address from the current-user answer, which adds a request on every load and still needs the content policy change; and one shared close behaviour that changes Grooming's menus, which touches tested Grooming code in a sign-out epic.

### 2026-11-24 — #66 — The drop-down becomes a breadcrumb, and its menu moves to its own page
The breadcrumb shows the repository the way GitHub's header does, with the owner, a slash and the name, so the order and separator match what people already know. It stays one control, so the banner keeps one Tab stop, and the owner is not a link. The searchable menu has its own rules, so it lives on the repository-menu page. Refuted alternative: set the repository in the design system's mono ref style. Mono suits repository names inside issue references, but it does not read like GitHub's breadcrumb, which uses sans type. The same entry records the reciprocal link from repository-menu: the breadcrumb opens that menu, and the avatar menu and that menu never open together.
