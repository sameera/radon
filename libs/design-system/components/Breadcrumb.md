# Breadcrumb

The current repository as owner, a slash, then name (`rd-breadcrumb`), set like the breadcrumb GitHub shows in its header. The web view's banner uses it to show and change the repository.

## Structure

- `button.rd-breadcrumb.rd-text-body` holds `span.rd-breadcrumb__owner`, `span.rd-breadcrumb__sep` ("/", `aria-hidden`) and `span.rd-breadcrumb__name`.
- With no repository chosen, it holds `span.rd-breadcrumb__prompt` with the text "Pick a repository" instead.

## Behaviour

- The whole button is one control and one Tab stop. It opens the repository menu. The owner is not a separate link or menu.
- A long owner or name is cut with an ellipsis, so the banner stays on one line.

## Consumer provides

- The current repository, read from the shared repository, not from a list.
- The accessible name `Repository: owner/name`, which carries the full text the ellipsis may hide. With no repository, the prompt is the name.
- `aria-haspopup` and `aria-expanded` for the menu it opens, and the open handler.

## Style

- System sans type (`--font-sans`) at the `rd-text-body` size, like GitHub's header. Owner at weight 400, name at weight 600, slash in `rd-fg-muted`. The text is `rd-fg`; the prompt is `rd-fg-muted`.
- Hover gives the one-step darker ground `rd-canvas-inset`. Focus shows the system focus ring in `rd-accent`.
- Width stops at `rd-header-crumb-max`.
- `rd-fg` and `rd-fg-muted` meet 4.5:1 on `rd-canvas-subtle` and on `rd-canvas-inset` in both themes.
- Use design-system tokens only. Don't set a color or size by value.

## Don't

- Don't set it in the mono `ref` style. Mono is for repo names inside references.
- Don't make the owner a separate link or menu.
- Don't use it outside the banner.
