# Banner

The bar across the top of a Raiden host that has no page of its own around Raiden (`rd-banner`). The web view uses it. The Raiden tab inside github.com never does.

## Structure

- `div.rd-frame` holds the banner and the app below it.
- `header.rd-banner` holds `img.rd-banner__mark`, `span.rd-banner__word.rd-text-wordmark`, and, only while someone is signed in, the repository drop-down `select.rd-select.rd-banner__repo` (see [Select](Select.md)) and, at the right end, `div.rd-menu-wrap.rd-banner__account` holding the avatar button `button.rd-banner__avatar` and its [PopupMenu](PopupMenu.md).
- Put the app in `div.rd-app.rd-app--framed`, so it fills the window below the banner.

## Behaviour

- The banner spans the full width and stays pinned to the top of the window. The document scrolls, not the frame.
- It has no search or notifications. It allows two controls: the repository drop-down beside the mark and word, and the avatar menu at the top right, as GitHub's own banner shows them. Both are absent while signed out.
- The avatar button opens a menu with one item, Sign out. The menu closes on a click outside, on Escape (focus returns to the avatar), on Tab and when the item is chosen. If the picture fails to load, the button shows a neutral person mark.

## Consumer provides

- The icon address. The banner holds no image of its own, so a library never imports from an app. Serve the icon from the host's own address.

## Style

- Height is `rd-header-height` and horizontal padding is `rd-header-padding`. Both match GitHub's top header.
- Ground is `rd-canvas-subtle`, with a 1px `rd-border-muted` bottom edge. Only the word is in brand color: `rd-brand-fg`, set in the `rd-text-wordmark` style. That pair measures 5.49:1 in light and 10.48:1 in dark.
- The icon is `rd-header-icon` square, with an empty `alt`: the word beside it names the product.
- Use design-system tokens only. Don't set a color or size by value.

## Don't

- Don't fill the banner with brand color. Neutral frame, brand on the mark: "Blend, then mark".
- Don't show it inside github.com.
- Don't add any other control to it.
- Don't send a referrer with the avatar picture.
