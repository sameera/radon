---
standard: Radon Project Standards
category: architecture
applies_to: ["typescript", "go", "github-app", "dynamodb", "pnpm"]
description: Stack-level decisions made before any code exists
---

# Radon Project Standards

## Overview

Radon has no code yet. These are the decisions already made. Add exemplar paths as the first code lands.

## Decisions

### TypeScript only

**Decision**: Extension source is TypeScript with explicit type annotations. No JavaScript source files. The backend (`backend/`) is Go.

**Rationale**: Project-wide choice; keeps GitHub API payload types checked end to end.

### GitHub App for authentication

**Decision**: Authenticate through a GitHub App. User actions use user-to-server tokens; background sync uses installation tokens.

**Rationale**: Fine-grained permissions and webhooks; actions on GitHub stay attributable to the user.

### DynamoDB for Radon-only data

**Decision**: DynamoDB stores only data GitHub Projects cannot hold. GitHub remains the source of truth for issues, project items, fields and iterations.

**Rationale**: Users keep working in GitHub directly; a second copy of GitHub data would drift.

**Exceptions**: Caches of GitHub data are allowed when marked as cache and rebuildable from GitHub.

### pnpm

**Decision**: pnpm is the only package manager.

## Prohibitions

- **Never** write to GitHub issues, project fields or iterations — users edit those in GitHub. Radon writes only its own data (e.g. sprint goals). Request no issue-write permission on the GitHub App.
- **Never** authenticate with personal access tokens or a classic OAuth App — use the GitHub App.
- **Never** treat a DynamoDB copy of GitHub data as authoritative — re-read GitHub or invalidate the cache.
- **Never** commit `package-lock.json` or `yarn.lock` — use `pnpm-lock.yaml`.
- **Never** commit GitHub App private keys or secrets — load them from the environment / AWS secrets.

## Checklist

- [ ] New source files are `.ts` / `.tsx`
- [ ] GitHub calls use App tokens
- [ ] New DynamoDB tables hold Radon-only data or are marked rebuildable cache
- [ ] No secrets in the repo
