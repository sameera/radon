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
- **UI framework**: Preact, with its React compatibility layer on. The Raiden pages live in a library that does not depend on the extension, and their code loads only when the Raiden tab opens. Decided in [decision record #11](https://github.com/sameera/raiden/issues/11), D2.

## Backend

Self-hosted per team; no multi-tenant SaaS.


- **Language**: Go
- **Runtime**: AWS Lambda (`provided.al2023`), source in `backend/`
- **Authentication**: GitHub App (user-to-server tokens for user actions, installation tokens for background work)
- **External API**: GitHub Projects V2 (GraphQL) and GitHub REST

## Database

- **Primary**: DynamoDB — holds only Raiden-specific data GitHub Projects cannot store (e.g. sprint objectives, timeline hierarchy metadata)
- **Local emulation**: AWS Emulator (DynamoDB only; Lambda cannot be invoked locally). See [local-dev.md](local-dev.md)

## Infrastructure

- **Hosting**: AWS
- **CI/CD**: GitHub Actions

## Development

- **Package Manager**: pnpm
- **Monorepo**: Nx (`apps/`, `libs/`, plus `backend/` as a Go project via `nx:run-commands`)
