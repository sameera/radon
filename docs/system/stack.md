---
stack: Primary Technology Stack
version: 1.0.0
last_updated: 2026-11-13
---

# Technology Stack

Greenfield. Entries below are decided; anything not listed is still open (notably the UI framework inside the extension).

## Frontend

- **Form factor**: Chrome extension (Manifest V3) that injects views into github.com Projects pages
- **Language**: TypeScript

## Backend

Self-hosted per team; no multi-tenant SaaS.


- **Language**: Go
- **Runtime**: AWS Lambda (`provided.al2023`), source in `backend/`
- **Authentication**: GitHub App (user-to-server tokens for user actions, installation tokens for background work)
- **External API**: GitHub Projects V2 (GraphQL) and GitHub REST

## Database

- **Primary**: DynamoDB — holds only Radon-specific data GitHub Projects cannot store (e.g. sprint objectives, timeline hierarchy metadata)
- **Local emulation**: AWS Emulator (DynamoDB only; Lambda cannot be invoked locally). See [local-dev.md](local-dev.md)

## Infrastructure

- **Hosting**: AWS
- **CI/CD**: GitHub Actions

## Development

- **Package Manager**: pnpm
