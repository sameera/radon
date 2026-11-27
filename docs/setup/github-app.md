# Set up the GitHub App for sign-in

Raiden signs users in through a GitHub App that your team registers. Raiden's code asks for no
permission. The permissions come from this registration (D8, G11).

## Register the App

1. In GitHub, go to **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Set these **repository permissions**:
   - **Issues:** Read-only
   - **Projects:** Read-only
   - **Metadata:** Read-only
3. Set this one **Organization permissions** entry, and nothing else:
   - **Projects:** Read-only

   Grooming reads sprints from the iterations of a repository's linked project. The repository-level Projects
   permission does not reach a project that an organization owns, so without this one no organization repository
   gets sprints. A project owned by a person stays unreadable to the App.
4. Do **not** grant any write permission. Raiden never writes to GitHub.
5. Keep **Expire user authorization tokens** turned **on**. Raiden renews tokens itself. A token that never expires is
   worth more to anyone who steals it (R3).
6. Under **Callback URL**, add both return addresses:
   - The web view's return address, for example `https://raiden.your-team.example/`.
   - The extension's return address, `https://<extension-id>.chromiumapp.org/`.
7. Turn **Webhook** off. Raiden does not use it here.
8. Generate a **client secret**. Give it only to the backend (see below). Never put it in a host build.

## Fix the extension ID

An unpacked extension gets an ID that depends on its folder. GitHub then rejects the return address (R1).

1. Make a key pair for the extension and keep the private key out of the repository.
2. Put the public key in `RAIDEN_EXTENSION_KEY` when you build.
3. Read the extension ID from `chrome://extensions`. It is now the same on every machine.
4. Use that ID in the extension's callback URL above.

## Install the App on your repositories

A user token reaches only repositories where the App is **installed**. On any other repository, Raiden gets empty or
"not found" answers. They look like a bug. They are not (R4).

1. Open the App's page and choose **Install App**.
2. Select the organization and the repositories Raiden should read.
3. Users who can see a repository in GitHub then see it in Raiden. Users never see more than GitHub shows them.

When you add the organization Projects permission to an App that is already installed, GitHub asks each
organization's owner to approve the new permission. Sprints do not sync for an organization until its owner approves.

## Give the backend its settings

The backend keeps no tokens. It needs these environment values, or an AWS secret that fills them:

| Name | Value |
|---|---|
| `GITHUB_CLIENT_ID` | The App's client ID |
| `GITHUB_CLIENT_SECRET` | The App's client secret. It stays in the backend only. |
| `RAIDEN_ALLOWED_REDIRECTS` | Comma-separated return addresses from the step above |
| `RAIDEN_ALLOWED_ORIGINS` | Comma-separated origins: the web view's origin and `chrome-extension://<extension-id>` |

For local checks, run `go run ./cmd/local` in `backend/` with these set.

If `/auth/exchange` fails, its `reason` field identifies GitHub's safe error category:

| Reason | Check |
|---|---|
| `incorrect_client_credentials` | Confirm the backend client ID and secret belong to the same GitHub App; rebuild the frontend with that client ID. |
| `redirect_uri_mismatch` | Confirm the exact callback URL is registered in the App and matches `RAIDEN_ALLOWED_REDIRECTS` and the frontend return URL. |
| `bad_verification_code` or `invalid_grant` | Start a fresh sign-in; authorization codes can expire or be used only once. |
| `unverified_user_email` | Verify the primary email address on the GitHub account. |

A 502 without a `reason` means GitHub could not be reached or gave an unrecognized response. The backend never returns GitHub's free-form error description, authorization codes, or secrets.

## Deploy the backend's data path

Grooming sends one data request when it opens: `POST /grooming/sync`. The backend reads the repository's sprints and
milestones from GitHub as the signed-in user, updates Raiden's records, and returns them.

**The table.** The backend keeps Raiden's records in one DynamoDB table. Name it in `RAIDEN_TABLE` (default `raiden`).
It has a string partition key `pk` and a string sort key `sk`, as in `backend/local/table.json`. Each repository's
records share one partition, keyed by GitHub's permanent identity for the repository.

**The backend's permission on the table.** Give the Lambda's role these actions on the table, and no others:

| Action | Why |
|---|---|
| `dynamodb:DescribeTable` | The `/health` check |
| `dynamodb:Query` | Reads a repository's records |
| `dynamodb:PutItem` | Writes a synced sprint or milestone |
| `dynamodb:DeleteItem` | Deletes a sprint or milestone that GitHub no longer has |

**The request header.** The browser sends the signed-in user's GitHub token on the data request, in the
`authorization` header. The backend answers the cross-origin preflight for `/grooming/sync` itself, and allows the
`content-type` and `authorization` headers for the origins in `RAIDEN_ALLOWED_ORIGINS` only. If API Gateway handles
CORS for you instead, allow the `authorization` header there too. The backend never stores, logs or returns the token.

**The App's permission.** The organization-level **Projects** permission, read-only, from the registration steps above.

## Build settings for each host

Each team builds its own copy (D10). Set these before `pnpm build`:

| Name | Used by | Value |
|---|---|---|
| `RAIDEN_GITHUB_CLIENT_ID` | extension, web view | The App's client ID |
| `RAIDEN_BACKEND_URL` | extension, web view | The backend's address |
| `RAIDEN_EXTENSION_KEY` | extension | The public key from above |
| `RAIDEN_WEB_RETURN_URL` | web view | The web view's return address |

## Signing out

In the web view, click your avatar at the top right of the banner and choose Sign out. This ends the session on that
browser only. It does not revoke the App or the token at GitHub. GitHub may still be signed in in the same browser, so the
sign-in screen links to GitHub's sign-out and the next sign-in asks GitHub for its account chooser.

The extension has no sign-out control. Users sign out there by revoking the App in GitHub, or by clearing the browser's
storage for the extension.
