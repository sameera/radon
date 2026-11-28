---
feature: "AWS Deployment"
feature_path: docs/features/aws-deployment
feature_issue: "#95"
epic: "Deploy Raiden to AWS from the terminal"
slug: deploy-to-aws-from-terminal
created: 2026-11-27
type: enhancement
complexity: L
complexity_drivers: [new AWS infrastructure defined in the repository, two deployables (backend and web view) each with a setup path and an update path, the web view build depends on the deployed backend address, the GitHub App secret must reach the backend without entering the repository]
concepts: ["raiden-web-view", "raiden-sidebar", "grooming-plan", "raiden-app-shell", "raiden-page-host", "raiden-banner", "github-sign-in"]
link: "#96"
record: "#106"
record_state: closed
---

# Epic: Deploy Raiden to AWS from the terminal

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

A team that self-hosts Raiden needs the backend and the web view running in its own AWS account. Today nothing in the repository creates those resources. The Lambda zip is built locally and nothing deploys it, and the web view runs only on a local preview.

This epic lets a lead deploy Raiden from a terminal. The first run creates everything in an empty AWS account: the backend with its storage and HTTPS endpoint, and the web view's hosting. Later runs deploy new backend code and new web view builds into the same account and leave the team's stored data alone.

It replaces issue #35, whose web view hosting criteria are carried into the web view stories below. With this epic done, the team can open Raiden on a real HTTPS address, install it, and sign in without running anything locally.

## Success Metrics

- A lead with an AWS account and a registered GitHub App goes from a fresh checkout to a working sign-in on the hosted web view using only terminal commands and the deployment guide.
- An update deploy of the backend or the web view needs one command each and no step in the AWS console.
- A repeated setup run on an unchanged deployment changes nothing.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

First-time backend setup; Backend settings and secret; Backend update deploy; First-time web view hosting; Web view update deploy; Deployment guide

## User Stories

### Story #97: First-time backend setup

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** one terminal command to create the Raiden backend in my team's AWS account, **so that** the team has a running backend without clicking through the AWS console.

#### Acceptance Criteria

- [ ] **Given** an AWS account with no Raiden resources and terminal credentials for it, **when** the lead runs the setup command, **then** the backend's storage and its HTTPS endpoint exist and the endpoint answers a health request with ok.
- [ ] **Given** setup has finished, **when** the command ends, **then** it prints the backend address, which the extension build needs, and the web view address, which the GitHub App registration needs.
- [ ] **Given** setup has run once, **when** the lead runs it again with nothing changed, **then** it changes no resource and finishes without an error.
- [ ] **Given** the repository, **when** a reviewer reads it, **then** every Raiden AWS resource the setup creates is defined in the repository, and the deployment guide names the deployment tool's one-time bootstrap resources.

#### Notes

- The backend is the existing Go handler in `backend/cmd/lambda` and the table shape in `backend/local/table.json`.
- The hosting decision in #34 (D4) asks that the web view's address can later route the API too, so there is one origin. The decision record for this epic decides whether that happens here.

### Story #98: Backend settings and secret

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** to give the deployed backend its GitHub App settings from the terminal, **so that** people can sign in through the hosted backend while the client secret stays out of the repository.

#### Acceptance Criteria

- [ ] **Given** the App's client ID, client secret, allowed return addresses and allowed origins, **when** the lead supplies them to the deployment, **then** a sign-in through the deployed backend completes.
- [ ] **Given** a deployment with its settings, **when** a reviewer searches the repository and every build output, **then** the client secret appears in none of them.
- [ ] **Given** a changed setting, **when** the lead applies it from the terminal, **then** the backend uses the new value without a new code build.

#### Notes

- The settings are the ones listed in `docs/setup/github-app.md` under "Give the backend its settings".

### Story #99: Backend update deploy

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** one backend update command to deploy changed backend code, **so that** the team runs the latest backend without repeating the setup.

#### Acceptance Criteria

- [ ] **Given** a deployed backend and changed backend code, **when** the lead runs the backend update command, **then** the backend serves requests with the new code.
- [ ] **Given** stored Raiden data such as sprint goals, **when** an update deploy finishes, **then** that data is unchanged.
- [ ] **Given** an update whose build or upload fails, **when** the command stops, **then** the backend keeps serving the previous version.

### Story #100: First-time web view hosting

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** the setup command to also host the web view on an HTTPS address in my team's AWS account, **so that** the team can open, install and sign in to Raiden without a local preview.

#### Acceptance Criteria

- [ ] **Given** the setup command has run after the backend settings were given, **when** a lead opens the web view address in a browser, **then** the Raiden sign-in screen shows over HTTPS, and after sign-in the sidebar and the Grooming page show.
- [ ] **Given** the hosted files, **when** anyone requests them from storage directly instead of through the web view address, **then** the request is refused.
- [ ] **Given** the page is open, **when** the browser loads it, **then** every file, including the font and icons, comes from the same address, and no request goes to another site except the deployed backend, GitHub's API and GitHub's avatar pictures.
- [ ] **Given** the web view address, **when** a lead opens it in Chrome, **then** the install offer shows.
- [ ] **Given** the deployed backend with its settings, **when** a lead signs in on the hosted web view, **then** sign-in completes and the Grooming page shows the repository's issues.

#### Notes

- Hosting is decided in #34 (D4): the static build is stored privately and served through a content delivery network in front of it. The refused alternative was serving the files from the backend function.
- The web view is built against the deployed backend address printed by the backend setup.
- Carries the hosting criteria of #35.

### Story #101: Web view update deploy

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** one web view update command to deploy a new web view build, **so that** the team sees the latest pages without a manual step.

#### Acceptance Criteria

- [ ] **Given** a new build, **when** the deploy runs again, **then** the changed files replace the old ones and the web view address serves them without a manual cache clear.
- [ ] **Given** an update deploy, **when** a browser next loads the web view, **then** it never gets a stale service worker or manifest.
- [ ] **Given** an update deploy of the web view, **when** it finishes, **then** the deployed backend is unchanged.

#### Notes

- Carries the update criterion of #35.

### Story #102: Deployment guide

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** a guide for deploying Raiden from the terminal, **so that** I can set up and update a deployment without reading the code.

#### Acceptance Criteria

- [ ] **Given** a lead with an AWS account and a registered GitHub App, **when** they follow the guide from a fresh checkout, **then** they reach a working sign-in on the hosted web view.
- [ ] **Given** the guide, **when** a lead reads it, **then** it covers the first-time setup and the update deploy for both the backend and the web view.
- [ ] **Given** the guide, **when** a lead prepares terminal credentials, **then** the guide names the AWS permissions those credentials need.

#### Notes

- Link the guide from `docs/setup/github-app.md`, which already describes the backend settings.

## Assumptions

- The lead has an AWS account and terminal credentials allowed to create the resources the setup needs.
- The team has registered the GitHub App as `docs/setup/github-app.md` describes before the first sign-in.
- The web view is hosted in the same AWS account as the backend.
- One deployment lives in one AWS account and region.

## Out of Scope

- Publishing the Chrome extension, because it is not deployed to AWS.
- Deploying from continuous integration.
- Custom domain names and their certificates.
- Any change to the web view's code.
- Removing a deployment from the AWS account.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #97 | none |
| #98 | #97 |
| #99 | #97 |
| #100 | #97, #98 |
| #101 | #100 |
| #102 | #98, #99, #101 |
