## 2026-11-27 — Root commands are named aws:*
- **Choice:** The root scripts are `aws:setup`, `aws:settings`, `aws:update-backend` and `aws:update-web`.
- **Why:** pnpm has built-in `setup` and `deploy` commands, so plain names would run pnpm's own command instead of the script.
- **Refuted alternative:** Plain `setup`, which `pnpm setup` shadows.

## 2026-11-27 — Explicit log group and role with no managed policy
- **Choice:** The backend stack creates the function's log group and a role whose only statements name the table and that log group.
- **Why:** The default Lambda role attaches AWSLambdaBasicExecutionRole, which allows logs on every resource, and G12 limits the role to its own logs.
- **Refuted alternative:** The default role from AWS CDK, plus table grants.

## 2026-11-27 — Edge keeps files with a minimum TTL while the browser revalidates
- **Choice:** The distribution uses a cache policy whose minimum TTL is one year, and the files carry `Cache-Control: no-cache`.
- **Why:** CloudFront caches a `no-cache` response for the minimum TTL and passes the header to the browser, so the edge keeps files until the invalidation and the browser still revalidates (D11).
- **Refuted alternative:** The managed CachingOptimized policy, whose minimum TTL of one second would make the edge go to the bucket on almost every request.

## 2026-11-27 — The settings command takes no arguments at all
- **Choice:** `pnpm aws:settings` refuses every argument and asks for each value; piped standard input answers the prompts line by line.
- **Why:** With no arguments the client secret can never reach shell history or the process list (G8), and one prompt path serves both a terminal and a pipe.
- **Refuted alternative:** Flags for the client ID and addresses with only the secret prompted, which needs argument parsing that a secret flag could slip through.

## 2026-11-27 — The CDK app defines the backend stack only when its zip exists
- **Choice:** `infra/src/app.ts` skips the backend stack when `.tmp/lambda.zip` is missing and the deploy targets the web stack.
- **Why:** The web view update deploys only the web stack and must not need a Go build (D2), but CDK synthesizes every stack in the app.
- **Refuted alternative:** Two separate CDK apps, which split one deployment definition across two entry points.

## 2026-11-27 — Changed files are found by comparing each file's MD5 with the S3 ETag
- **Choice:** The upload lists the bucket and compares each stored object's ETag with the local file's MD5.
- **Why:** A single-part upload with S3-managed encryption has its MD5 as its ETag, so no extra metadata or state file is needed.
- **Refuted alternative:** Storing a hash in object metadata, which needs one HEAD request per file.
