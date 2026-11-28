---
stack: Primary Technology Stack
version: 1.0.0
last_updated: 2026-11-13
---

# Technology Stack

Greenfield. Entries below are decided; anything not listed is still open.

## Frontend

- **Form factor**: Chrome extension (Manifest V3) that injects views into github.com Projects pages
- **Language**: TypeScript
- **UI framework**: Preact

## Backend

Self-hosted per team; no multi-tenant SaaS.

- **Language**: Go
- **Runtime**: AWS Lambda (`provided.al2023`), source in `backend/`
- **Authentication**: GitHub App (user-to-server tokens for user actions, installation tokens for background work)
- **External API**: GitHub Projects V2 (GraphQL) and GitHub REST

## Database

- **Primary**: DynamoDB — holds Raiden's own records: milestones and sprints (synced from GitHub or Raiden-owned), sprint goals and sprint assignments, one partition per repository
- **Local emulation**: AWS Emulator (DynamoDB only; Lambda cannot be invoked locally). See [local-dev.md](local-dev.md)

## Infrastructure

- **Hosting**: AWS
- **Infrastructure as code**: AWS CDK in TypeScript (`infra/`), deployed by `pnpm aws:setup`, `pnpm aws:settings`, `pnpm aws:update-backend` and `pnpm aws:update-web`. See [deploy-aws.md](../setup/deploy-aws.md)
- **CI/CD**: GitHub Actions

## Development

- **Package Manager**: pnpm
- **Monorepo**: Nx (`apps/`, `libs/`, plus `backend/` as a Go project via `nx:run-commands`)
