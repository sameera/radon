# Set up the GitHub App for sign-in

Raiden signs users in through a GitHub App that your team registers. Raiden's code asks for no
permission. The permissions come from this registration (D8, G11).

## Register the App

1. In GitHub, go to **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Set these **repository permissions**, and nothing else:
   - **Issues:** Read-only
   - **Projects:** Read-only
   - **Metadata:** Read-only
3. Do **not** grant any write permission. Raiden never writes to issues.
4. Keep **Expire user authorization tokens** turned **on**. Raiden renews tokens itself. A token that never expires is
   worth more to anyone who steals it (R3).
5. Under **Callback URL**, add both return addresses:
   - The web view's return address, for example `https://raiden.your-team.example/`.
   - The extension's return address, `https://<extension-id>.chromiumapp.org/`.
6. Turn **Webhook** off. Raiden does not use it here.
7. Generate a **client secret**. Give it only to the backend (see below). Never put it in a host build.

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

## Give the backend its settings

The backend keeps no tokens. It needs these environment values, or an AWS secret that fills them:

| Name | Value |
|---|---|
| `GITHUB_CLIENT_ID` | The App's client ID |
| `GITHUB_CLIENT_SECRET` | The App's client secret. It stays in the backend only. |
| `RAIDEN_ALLOWED_REDIRECTS` | Comma-separated return addresses from the step above |
| `RAIDEN_ALLOWED_ORIGINS` | Comma-separated origins: the web view's origin and `chrome-extension://<extension-id>` |

For local checks, run `go run ./cmd/local` in `backend/` with these set.

## Build settings for each host

Each team builds its own copy (D10). Set these before `pnpm build`:

| Name | Used by | Value |
|---|---|---|
| `RAIDEN_GITHUB_CLIENT_ID` | extension, web view | The App's client ID |
| `RAIDEN_BACKEND_URL` | extension, web view | The backend's address |
| `RAIDEN_EXTENSION_KEY` | extension | The public key from above |
| `RAIDEN_WEB_RETURN_URL` | web view | The web view's return address |

## Signing out

Raiden has no sign-out button yet. Users sign out by revoking the App in GitHub, or by clearing the browser's storage for
the host.
