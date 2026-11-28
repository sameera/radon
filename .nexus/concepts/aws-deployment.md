---
title: AWS Deployment
aliases: [deploy to aws, aws setup, backend update, web view update, raiden deployment]
touches: [web-view-hosting, backend-settings]
last_updated_by: "#96"
status: active
verification: verified
---

# AWS Deployment

A lead deploys the Raiden backend and the web view into the team's own AWS account from a terminal. Four commands do it: setup, settings, backend update and web view update. The repository defines every Raiden resource, and AWS keeps the record of what is deployed inside the account, so any lead with credentials and a fresh checkout can update the deployment.

## How It Works

The deployment has two parts that share no values. The backend part holds the table, the backend function, its public HTTPS address, its role and the two settings stores. The hosting part holds a private file bucket and a CloudFront distribution in front of it.

Setup runs the deployment tool's one-time account bootstrap when the account has none. It deploys both parts and fails unless the backend answers health with ok. It prints the backend address and the web view address. Once settings exist, setup also runs the web view update. A repeat run on an unchanged deployment changes nothing.

The backend update builds first, deploys only the backend part and ends with a health check. A failed deploy rolls back to the previous code. New code that deploys but fails the health check stays live until the lead redeploys the previous commit.

The web view update deploys only the hosting part. It builds the web view with the two addresses and the client ID read from the deployment. It uploads only changed files, then clears the edge cache and waits for that before it reports success.

## Key Invariants

1. An update never deletes, replaces or writes to the table, so stored sprint goals survive every update.
2. The backend address stays the same across every update.
3. A backend update changes nothing in the hosting, and a web view update changes nothing in the backend or its settings.
4. A failed build, upload or deploy leaves the previous backend serving, and the command exits with an error.
5. The repository's build, test and type-check commands need no AWS credentials and never change an AWS account.
6. The backend's role may use only its table, its two settings stores and its own logs.
7. The web view update refuses to build or upload when no client ID is set.

## Integration Points

- [web-view-hosting](web-view-hosting.md) — the web view update builds the web view against the deployment and uploads it to the hosting.
- [backend-settings](backend-settings.md) — the backend part creates the two empty settings stores, and the web view update reads the client ID from one of them.

## Decision Log

### 2026-11-28 — #96 — The deployment is AWS CDK code with two independent stacks
All Raiden resources are AWS CDK code in TypeScript, and CloudFormation keeps the deployment's state in the account, so a second lead needs only credentials to update it. The backend and the hosting are separate stacks that pass no value to each other, so a web view update never deploys the backend function and needs no Go build. The backend build is repeatable, so an unchanged checkout uploads no new code. A backend whose new code fails its health check is recovered by hand, as the lead chose, because the story asked only about failed builds and uploads. Refuted alternative: Terraform or OpenTofu, which needs no bootstrap resources. A local state file is lost with the machine, and a shared remote state needs a bucket created by hand before the first run.
