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


- **Language**: TypeScript (Node.js)
- **Authentication**: GitHub App (user-to-server tokens for user actions, installation tokens for background work)
- **External API**: GitHub Projects V2 (GraphQL) and GitHub REST

## Database

- **Primary**: SQLite — holds only Radon-specific data GitHub Projects cannot store (e.g. sprint objectives, timeline hierarchy metadata)

## Infrastructure

- **Hosting**: AWS
- **CI/CD**: GitHub Actions

## Development

- **Package Manager**: pnpm
