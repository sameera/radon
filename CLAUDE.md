# Radon

Radon is a self-hostable Chrome extension that adds agile views to GitHub Projects: sprint goals and a hierarchical timeline. It is optimized for teams using the Nexus pipeline. Product context: [docs/product/context.md](docs/product/context.md).

## Status

Early code. Chrome MV3 content script in `src/`, manifest in `extension/`.

- `pnpm install` — install
- `pnpm build` — bundle to `dist/` (load unpacked in `chrome://extensions`)
- `pnpm typecheck`, `pnpm test` — tsc, vitest (jsdom)

## Technical Patterns and Standards

- [docs/system/stack.md](docs/system/stack.md) — technology stack
- [docs/system/standards/standards.md](docs/system/standards/standards.md) — project decisions and prohibitions
- [design-system/README.md](design-system/README.md) — design system: tokens, components, usage rules. Style UI only through its `rd-` tokens and classes.

## In-flight decision stubs

When you make a non-obvious implementation choice — you picked between viable approaches — append a stub to your per-user scratch inside the epic's queue entry, at the moment of choosing, not later:

    .nexus/queue/epic-<epic-issue-number>/<your-username>/decisions-<branch>.md

- `<epic-issue-number>` — the GitHub issue number of the epic your story belongs to.
- `<your-username>` — your GitHub login (`gh api user --jq .login`; fall back to a slug of `git config user.name`).
- `<branch>` — current branch with `/` → `-`. Append-only; one file per branch.

      ## <date> — <short decision title>
      - **Choice:** <what was chosen>
      - **Why:** <one sentence>
      - **Refuted alternative:** <the viable option not taken, or "none">

**Resolving `<epic-issue-number>`** (do this silently — a stub in the wrong folder is worse than none): find your story issue (the number in the branch name, or the issue the open PR closes), `gh` its **parent epic issue**, and take that number; else **write nothing**. Resolution is issue-only — never look for a queue entry, an `epic.md`, or a matching directory name: the entry is born at close, at this same `epic-<epic-issue-number>` directory.

This scratch is committed — ordinary commits carry it through the PR. It is a pre-checkpoint hint the lead-run stages (hld, analyze, close) mine and verify against the diff, never load-bearing; the distiller deletes the whole entry post-merge, so never link these paths. Working notes go beside it as `notes-<branch>.md`. Obvious choices get no stub.
