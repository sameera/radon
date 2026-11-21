# IssueRef

An IssueRef names one GitHub issue by its Nexus type glyph, its number and its title, and links to the issue on github.com.

**Glyphs.** The type is carried by shape first, color second, so it reads without color vision:

- `rd-glyph--epic` — diamond, `rd-epic`.
- `rd-glyph--story` — circle, `rd-story`.
- `rd-glyph--decision` — square, `rd-decision`.
- Add `rd-glyph--closed` to draw the glyph as an `rd-done` outline when the issue is closed.

**Structure:** `a.rd-ref` > `.rd-glyph` + `.rd-ref__num` (mono, `rd-fg-muted`) + `.rd-ref__title`. Titles truncate with an ellipsis; give the parent a width.

**Consumer provides:** the issue URL, number, title, type and open/closed state. Indent children 18px under their epic.

**Don't** make the IssueRef editable. Issues are edited in GitHub.
