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
