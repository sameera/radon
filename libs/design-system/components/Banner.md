# Banner

The bar across the top of a Raiden host that has no page of its own around Raiden (`rd-banner`). The web view uses it. The Raiden tab inside github.com never does.

## Structure

- `div.rd-frame` holds the banner and the app below it.
- `header.rd-banner` holds `img.rd-banner__mark` and `span.rd-banner__word.rd-text-wordmark`.
- Put the app in `div.rd-app.rd-app--framed`, so it fills the window below the banner.

## Behaviour

- The banner spans the full width and stays pinned to the top of the window. The document scrolls, not the frame.
- It has no search, notifications or account menu, and no control of any kind.

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
