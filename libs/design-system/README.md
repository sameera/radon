# Raiden design system

The source of truth for Raiden's colors, type, spacing and components. A browsable copy with live previews lives at https://claude.ai/artifact/NoSySPhHMWeFwED4TDypKF; this folder wins if they differ.

## Files

| File | What | Edit? |
|---|---|---|
| `tokens.json` | All tokens: colors per theme, type styles, spacing, radius, shadows. Each has a usage note. | Yes. The only place token values change. |
| `tokens.css` | CSS custom properties and `.rd-text-*` classes. | No. Generated. |
| `tokens.ts` | Typed token references for TypeScript. | No. Generated. |
| `build-tokens.ts` | Regenerates `tokens.css` and `tokens.ts`: `node libs/design-system/build-tokens.ts` (Node 22.18+). | Yes |
| `components.css` | Component classes (`rd-btn`, `rd-pill`, `rd-ref`, `rd-progress`, `rd-goal`, `rd-tl`, `rd-icon-btn`, `rd-nav`, `rd-input`, `rd-switch`). | Yes |
| `components/*.md` | Guidelines per component: structure, variants, what the consumer provides, don'ts. | Yes |
| `preview.html` | All components on one page with a light/dark toggle. Open it in a browser. | Yes |

After editing `tokens.json`, run the build and commit all three files together.

Raiden puts agile views inside GitHub Projects pages. Its UI must sit flush with github.com in light and dark mode, then add a little more color and character so people can tell what Raiden added. Start from GitHub's calm neutrals; spend vibrancy on Raiden's own surfaces.

## Principles

1. **Blend, then mark.** Neutrals (`rd-canvas`, `rd-fg`, `rd-border`) track GitHub's so an injected view looks native. `rd-brand` teal marks every surface Raiden owns: the sprint goal, the current sprint, the today line, primary actions.
2. **Shape before color.** Epics are diamonds, stories are circles, decision records are squares. Every status pill carries a word. Color reinforces; it never carries meaning alone.
3. **One glow per view.** `rd-shadow-glow` is Raiden's signature. Use it on the sprint-goal card or the active-sprint column, never both.
4. **Read-only on GitHub data.** Nothing that shows an issue, iteration or field looks editable. Only Raiden data (sprint goals) gets edit controls.

## Content

- Write in plain, direct sentences. Sentence case everywhere: "Set sprint goal", not "Set Sprint Goal".
- Use GitHub's and Nexus's own words: *iteration* in data, *sprint* in UI copy, *epic*, *story*, *decision record*, *blocked by*.
- Name iterations as the project names them ("Sprint 14"). Dates as "Nov 17 – Nov 28".
- Sprint goals are outcomes in one sentence under 80 characters: "Pilot team plans its next sprint from the epic timeline".
- Counts in words with numbers: "1 blocked", "9 of 16 done". No bare percentages.
- No emoji.

## Color

Two themes, `light` and `dark`, follow GitHub's color mode. Every token is prefixed `rd-` so it never collides with GitHub's own CSS variables.

- **Grounds:** `rd-canvas` for views, `rd-canvas-subtle` for headers and alternate bands, `rd-canvas-inset` for tracks and wells, `rd-overlay` for popovers.
- **Text:** `rd-fg` for content, `rd-fg-muted` for metadata. `rd-fg-subtle` is for icons and placeholders only.
- **Edges:** `rd-border` around cards (decorative), `rd-border-control` around inputs and secondary buttons (meets 3:1), `rd-border-muted` for dividers and timeline grid lines.
- **Brand:** `rd-brand` fills with `rd-on-brand` text. Use `rd-brand-fg` for teal text and `rd-brand-muted` for teal grounds. Brand is not a link color.
- **Accent:** `rd-accent` for links and the focus ring, as on GitHub.
- **Status:** `rd-success` done or met, `rd-attention` at risk or `needs-design`, `rd-danger` blocked or missed, `rd-done` closed or approved. Each has a `-muted` ground for pills; status text on its own muted ground meets 4.5:1 in both themes.
- **Hierarchy:** `rd-epic` magenta, `rd-story` (aliases `rd-accent`), `rd-decision` orange, each with a `-muted` ground for unfilled bar segments.

Compared to GitHub's palette, Raiden's hues are more saturated, and dark-mode neutrals lean slightly blue-black for a cooler, deeper ground.

## Type

- **Body:** GitHub's system stack (`--font-sans`) at 14/20, so Raiden text matches the page. Styles `title`, `body`, `body-strong`, `small`.
- **Display:** Bricolage Grotesque (`--font-display`), only for `goal-lg` (the sprint goal) and `view-title`. Ship the font files inside the extension as web-accessible resources; github.com's CSP blocks Google Fonts.
- **Axis:** `axis` style, 11px uppercase with 0.06em tracking, for timeline ticks and eyebrows.
- **Mono:** `ref` style (`--font-mono`) for issue numbers and repo names.

## Space, radius, elevation

- Spacing is a 4px scale: `rd-space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-6` 24, `-8` 32. Card padding `rd-space-4`; the sprint-goal card `rd-space-6`.
- Radii: `rd-radius-sm` (4) for bars and small glyphs; `rd-radius-md` (6, GitHub's) for buttons, inputs and cards; `rd-radius-lg` (12) for Raiden's hero surfaces and popovers; `rd-radius-full` for pills.
- Shadows: `rd-shadow-sm` at rest, `rd-shadow-overlay` for floating layers, `rd-shadow-glow` per principle 3.

## States and focus

- Focus ring: 2px solid `rd-accent`, 2px offset, on every interactive element (`rd-focusable` adds it to custom controls).
- Hover darkens grounds one step (`rd-canvas-subtle` → `rd-canvas-inset`). The primary button gains the glow instead.
- Disabled: `rd-fg-subtle` text, no shadow.
- Motion: 120ms ease on color and shadow only. Nothing moves when `prefers-reduced-motion` is set.

## Iconography

- Hierarchy glyphs are CSS shapes (`rd-glyph--epic|story|decision`, `rd-glyph--closed` for an outlined closed state). No icon font needed.
- For other icons use GitHub's Octicons (MIT licensed, `@primer/octicons`) at 16px in `rd-fg-muted`, so Raiden's icons match the page. No Octicons are bundled in this system yet.
- No logo yet: set "Raiden" in Bricolage Grotesque 800 where a mark is needed.

## Injecting into github.com

- Mount each injected view in a shadow root. Load `tokens.css` and `components.css` inside it, and wrap the view in `.rd-root`.
- Follow GitHub's color mode: read the resolved theme from GitHub's `<html>` (`data-color-mode` and the active light/dark theme) and set `data-theme="light"` or `"dark"` on the shadow host. `tokens.css` themes both `[data-theme]` elements and `:host([data-theme])`.
- In TypeScript, reference tokens through `tokens.ts` (`color.brand` → `"var(--rd-brand)"`, `textStyle.goalLg` → `"rd-text-goal-lg"`) instead of typing variable names.
