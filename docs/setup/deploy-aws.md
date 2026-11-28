# Deploy Raiden to AWS

This guide deploys the Raiden backend and the web view into your team's AWS account from a terminal. You need no step
in the AWS console.

One deployment lives in one AWS account and region. The commands create it on the first run. Later runs update it, and
they never change the team's stored data.

## What you need

- **Node** 24 or later, and **pnpm**. Run `pnpm install` once in a fresh checkout.
- **Go**, to build the backend. Put it on your `PATH` (for example `/usr/local/go/bin`).
- **AWS credentials** in your terminal for the target account and region, with the permissions in
  [AWS permissions](#aws-permissions). Set the region with `AWS_REGION` or your AWS profile.
- **A registered GitHub App**, as [Set up the GitHub App for sign-in](github-app.md) describes. Keep its client ID and
  client secret ready.

You do not need the AWS command-line tool.

## What the deployment creates

The repository defines every Raiden resource in `infra/`, with AWS CDK. AWS CloudFormation keeps the record of what is
deployed, inside your account. So any lead with credentials and a fresh checkout can update the deployment.

There are two stacks:

| Stack | Holds |
|---|---|
| `RaidenBackend` | The `raiden` DynamoDB table, the `raiden-backend` Lambda function, its function URL (the backend address), its role, its log group, and two Secrets Manager stores: `raiden/github-client-secret` and `raiden/signin-settings` |
| `RaidenWeb` | A private S3 bucket for the web view files, and a CloudFront distribution in front of it (the web view address) |

The table keeps its data when its stack changes or is deleted, and its deletion protection is on. A backend update never
touches `RaidenWeb`. A web view update never touches `RaidenBackend`.

## The AWS CDK bootstrap

AWS CDK needs a small set of its own resources, once per account and region. This repository does not define them.
`pnpm aws:setup` reuses an existing bootstrap. If the account has none, it runs the default bootstrap for you.

The default bootstrap creates a CloudFormation stack named `CDKToolkit`, which holds:

- A **staging bucket** (`cdk-hnb659fds-assets-<account>-<region>`). Deploys upload the backend zip and the templates to it.
- An **ECR repository** for container assets. Raiden does not use it.
- A **deploy role**, a **file publishing role**, an **image publishing role** and a **lookup role**
  (`cdk-hnb659fds-*-role-<account>-<region>`). Your credentials assume these roles to deploy.
- A **CloudFormation execution role**. CloudFormation uses it to create the stacks' resources. By default it has the
  `AdministratorAccess` managed policy, so it can create anything in the account. Only principals that can assume the
  deploy role can use it.
- An SSM parameter, `/cdk-bootstrap/hnb659fds/version`.

If your team needs a narrower execution role, bootstrap the account yourself before the first setup, with
`pnpm exec cdk bootstrap --cloudformation-execution-policies <policy-arn>`. Setup then reuses it.

## First deployment

Do these steps in this order.

1. **Create the deployment.** Run `pnpm aws:setup`. It builds the backend, bootstraps the account if needed, deploys
   both stacks and checks that the backend answers a health request with ok. It prints two addresses:
   - **Backend address**: the extension build needs it as `RAIDEN_BACKEND_URL`.
   - **Web view address**: the GitHub App needs it as a callback URL.

   The backend has no settings yet, so sign-in is off and the web view is not uploaded. The command says so.
2. **Register the callback URL.** In the GitHub App's settings, add the web view address, with its trailing slash, as a
   **Callback URL**. If the team also uses the extension, keep its `https://<extension-id>.chromiumapp.org/` callback too.
3. **Give the backend its settings.** Run `pnpm aws:settings`. See [Change the settings](#change-the-settings).
4. **Upload the web view.** Run `pnpm aws:setup` again. Now that the settings exist, it builds the web view against the
   deployed backend address, the web view address and the client ID, and uploads it.
5. **Sign in.** Open the web view address in Chrome. The Raiden sign-in screen shows. Sign in with GitHub. The sidebar and
   the Grooming page then show. Chrome offers to install the web view.

## Change the settings

Run `pnpm aws:settings` for the first settings and for every later change. It asks for:

- the GitHub App's **client ID**;
- the **extension ID**, if the team uses the extension (leave it blank otherwise);
- the **client secret**, at a hidden prompt;
- the **allowed return addresses** and the **allowed origins**. It suggests both from the web view address and the
  extension ID. Press Enter to accept a suggestion.

The command takes no arguments, so the secret never goes in your shell history. It writes nothing to disk. To script
it, pipe the answers to its standard input, one per line, in the order above.

The client secret goes to `raiden/github-client-secret`. Everything else goes to `raiden/signin-settings`. The command then
restarts the backend function, waits for the restart and checks health. The next request uses the new values. No code is
rebuilt.

The restart sets a `RAIDEN_SETTINGS_VERSION` value on the function. A CloudFormation drift report shows it until the
next backend update. That is expected.

If the client ID changed, run `pnpm aws:update-web` afterwards, so the web view uses the same client ID as the backend.

## Update the backend

Run `pnpm aws:update-backend` after the backend code changes.

1. It builds the backend first. A failed build stops the command before anything is uploaded.
2. It deploys only `RaidenBackend`. If the upload or the stack update fails, CloudFormation rolls back and the backend
   keeps serving the previous version. The command exits with an error.
3. It checks health. If the new code deployed but does not answer health with ok, the command exits with an error.

Stored data, such as sprint goals, is never replaced.

**Recovery when the new code fails its health check.** The new code is live, and AWS does not undo it. Check out the
previous commit and run `pnpm aws:update-backend` again. Then fix the code and deploy again.

## Update the web view

Run `pnpm aws:update-web` after the web view code changes.

It deploys only `RaidenWeb`, reads the backend address and the web view address from the stacks and the client ID from
`raiden/signin-settings`, and builds the web view with them. It never reads the client secret. It refuses to build when
no client ID is set.

It uploads only the changed files, the page last, and deletes removed files after the page. Then it clears the
CloudFront cache and waits until that finishes. When the command ends, the web view address serves the new files. Every
file tells the browser to check for a newer copy on each load, so no browser keeps a stale service worker or manifest.

## Repeat runs

`pnpm aws:setup` is safe to run again. On an unchanged deployment, from the same checkout, it changes no AWS resource,
uploads no file and clears no cache. A web view build from another machine uploads the service worker once, because its
cache name differs.

## AWS permissions

The permissions split by phase, so everyday credentials can leave out the broad bootstrap rights.

### Bootstrap, once per account and region

The default bootstrap creates IAM roles, an S3 bucket, an ECR repository, an SSM parameter and the `CDKToolkit` stack.
Use credentials with administrator rights for this one run, or let an account administrator bootstrap the account. See
[The AWS CDK bootstrap](#the-aws-cdk-bootstrap).

### Deploys through AWS CDK

`pnpm aws:setup`, `pnpm aws:update-backend` and `pnpm aws:update-web` deploy through the bootstrap roles. Your
credentials need:

| Action | Resource |
|---|---|
| `sts:AssumeRole` | `arn:aws:iam::<account>:role/cdk-hnb659fds-*` |
| `cloudformation:DescribeStacks` | the `CDKToolkit`, `RaidenBackend` and `RaidenWeb` stacks |
| `ssm:GetParameter` | `/cdk-bootstrap/hnb659fds/version` |

The CloudFormation execution role then creates the resources. Your credentials need no direct right on them.

### Direct calls the commands make

| Command | Action | Resource |
|---|---|---|
| `pnpm aws:settings` | `secretsmanager:PutSecretValue` | `raiden/github-client-secret`, `raiden/signin-settings` |
| `pnpm aws:settings` | `lambda:GetFunctionConfiguration`, `lambda:UpdateFunctionConfiguration` | the `raiden-backend` function |
| `pnpm aws:setup`, `pnpm aws:update-web` | `secretsmanager:GetSecretValue` | `raiden/signin-settings` only |
| `pnpm aws:setup`, `pnpm aws:update-web` | `s3:ListBucket` | the `RaidenWeb` bucket |
| `pnpm aws:setup`, `pnpm aws:update-web` | `s3:PutObject`, `s3:DeleteObject` | the objects in the `RaidenWeb` bucket |
| `pnpm aws:setup`, `pnpm aws:update-web` | `cloudfront:CreateInvalidation`, `cloudfront:GetInvalidation` | the `RaidenWeb` distribution |

Every command also calls `cloudformation:DescribeStacks` to read the stack outputs.

No command needs `secretsmanager:GetSecretValue` on `raiden/github-client-secret`. Only the backend function reads it.

## Build the extension against the deployment

The extension is not deployed to AWS. Build it with the backend address that setup printed:

```sh
RAIDEN_BACKEND_URL=<backend address> RAIDEN_GITHUB_CLIENT_ID=<client ID> pnpm build
```

Add the extension's origin and return address with `pnpm aws:settings`.

## Removing a deployment

Removal is not automated. The table has deletion protection on and is kept when its stack is deleted, so removing it
takes a manual step in DynamoDB.
