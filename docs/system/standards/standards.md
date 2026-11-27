---
standard: Raiden Project Standards
category: architecture
applies_to: ["typescript", "go", "github-app", "dynamodb", "pnpm"]
description: Stack-level decisions made before any code exists
---

# Raiden Project Standards

## Overview

Raiden has no code yet. These are the decisions already made. Add exemplar paths as the first code lands.

## Decisions

### TypeScript only

**Decision**: Extension source is TypeScript with explicit type annotations. No JavaScript source files. The backend (`backend/`) is Go.

**Rationale**: Project-wide choice; keeps GitHub API payload types checked end to end.

### GitHub App for authentication

**Decision**: Authenticate through a GitHub App. User actions use user-to-server tokens; background sync uses installation tokens.

**Rationale**: Fine-grained permissions and webhooks; actions on GitHub stay attributable to the user.

### DynamoDB for Raiden's records

**Decision**: Raiden owns its milestone, sprint, sprint goal and sprint assignment records, and keeps them in DynamoDB, one partition per repository keyed by GitHub's permanent identity for the repository. GitHub is a sync source for milestones and sprints: each milestone and sprint record is marked as synced from GitHub or as Raiden-owned. A sync overwrites and deletes synced records only, and never a Raiden-owned record or a record keyed to a sprint or an issue. GitHub stays the source of truth for issues, project items and fields.

**Rationale**: Later epics attach goals and assignments to sprints and let a lead create sprints GitHub lacks. Those records need sprints and milestones Raiden holds itself. Users keep editing GitHub's own milestones and iterations in GitHub, and the next sync brings each change in.

### The lead's token on a backend request

**Decision**: The backend may receive the signed-in lead's GitHub token on a data request. It never stores or logs it, and sends it only to GitHub's API.

**Rationale**: The backend reads GitHub as the lead, so it reads nothing the lead cannot read, and GitHub confirms who is calling.

### pnpm

**Decision**: pnpm is the only package manager.

## Prohibitions

- **Never** write to GitHub — not issues, milestones, project fields or iterations — until the write-back epic. Users edit those in GitHub. Raiden writes only its own records. Request no write permission on the GitHub App.
- **Never** authenticate with personal access tokens or a classic OAuth App — use the GitHub App.
- **Never** let a sync change a Raiden-owned record — a sync writes only records marked as synced from GitHub.
- **Never** commit `package-lock.json` or `yarn.lock` — use `pnpm-lock.yaml`.
- **Never** commit GitHub App private keys or secrets — load them from the environment / AWS secrets.

## Checklist

- [ ] New source files are `.ts` / `.tsx`
- [ ] GitHub calls use App tokens
- [ ] New DynamoDB records live in the repository partition and carry the synced or Raiden-owned marker where GitHub is a sync source
- [ ] No secrets in the repo
