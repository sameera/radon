---
title: Backend Sign-In Settings
aliases: [aws settings, settings command, client secret store, sign-in settings store]
touches: [aws-deployment, github-sign-in]
last_updated_by: "#96"
status: active
verification: verified
---

# Backend Sign-In Settings

On AWS, the backend's GitHub App settings live in two secret stores in the team's account. One store holds only the client secret. The other holds the client ID, the allowed return addresses and the allowed origins, and a settings command writes both from the terminal and restarts the backend so the new values apply at once.

## How It Works

The deployment creates both stores with no value and never writes one. A later deploy therefore cannot reset what the lead wrote.

The settings command takes no arguments. It asks for the client ID, the extension ID if the team uses the extension, and the client secret at a hidden prompt. It suggests the allowed origins and return addresses from the web view address and the extension ID. Piped standard input answers the prompts line by line.

After it writes the stores, the command changes one configuration value of the backend function that holds no secret. Lambda then starts fresh instances. The command waits for that update and checks health.

A backend instance reads both stores once when it starts. When a store is empty, sign-in stays off and health answers ok. When a store cannot be read, the instance fails to start, so health fails. A local backend keeps reading its environment and needs no AWS account.

## Key Invariants

1. The client secret appears in no repository file, build output, deployment template, function configuration, command output or log line.
2. The settings command never takes the client secret as an argument and never writes it to disk.
3. The web view update never reads the client secret store.
4. After the settings command reports success, the next backend request uses the new values, with no code rebuilt.
5. An empty store leaves sign-in off with health ok. A store that cannot be read makes health fail.

## Integration Points

- [aws-deployment](aws-deployment.md) — the backend part creates the two empty stores, and the web view update reads the client ID from the sign-in settings store.
- [github-sign-in](github-sign-in.md) — the backend's code exchange uses the client secret, client ID, return addresses and origins these stores hold.

## Decision Log

### 2026-11-28 — #96 — Settings in two secret stores, applied by restarting the backend
A secret passed through the deployment would sit in the generated templates, and an environment value would show in the function's configuration, so the settings live in Secrets Manager entries the deployment creates empty. The client secret has its own store, so the web view update can read the client ID without fetching the secret, and the web view's client ID always matches the backend's. A settings change restarts the backend instead of waiting for a timed re-read, so a lead who fixes a return address sees it work at once. Refuted alternative: SSM Parameter Store, which costs nothing. CloudFormation cannot create its secure values, so the command would create one outside the repository, and a plain parameter's template value would overwrite the lead's setting on a later deploy.
