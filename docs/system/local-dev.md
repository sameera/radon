# Local backend development

Backend: Go Lambda + DynamoDB. Local DynamoDB runs on [AWS Emulator](https://aws.amazon.com/products/developer-tools/emulator/).

## Limits

- **Lambda does not run locally.** The emulator accepts `provided.al2023` at `CreateFunction` but fails at `Invoke` (it runs only Python and Node.js; see [aws-emulator#539](https://github.com/aws/aws-emulator/issues/539), container support in #3). Lambda invocation is deferred. Test handlers as plain Go code against the emulated DynamoDB.
- **State is in memory.** Restarting the emulator wipes all tables. Rerun `setup`.
- One region (`us-east-1`), one account (`000000000000`). Not for IAM policy testing.
- Credentials are regenerated on each start. Load them with `env`.

## Install (Linux)

    # Debian/Ubuntu amd64
    curl -fsSLo aws-emulator.deb https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator_amd64.deb
    sudo apt-get install -y ./aws-emulator.deb
    aws-emulator -v

Other platforms: see the [getting started guide](https://docs.aws.amazon.com/emulator/latest/userguide/getting-started.html). Telemetry is on by default; disable with `export EMULATOR_TELEMETRY=off`.

## Run

For a split terminal window, run `./run-server.sh` from the repo root. It starts the emulator, waits for DynamoDB, creates the table, loads `.env.backend.local` if present, and runs the Go server. It uses a tmux session named `raiden-server`; detach with `Ctrl-b d` and reattach with `tmux attach -t raiden-server`. Ctrl+C in the backend pane stops the backend and leaves the emulator running. The stopped pane stays visible; run `./run-server.sh` again to restart it. To stop both processes, run `tmux kill-session -t raiden-server`.

To run each step manually:

    scripts/emulator.sh start          # terminal 1, foreground, https://127.0.0.1:9297
    scripts/emulator.sh setup          # terminal 2, creates the table from backend/local/table.json
    eval "$(scripts/emulator.sh env)"  # points the AWS CLI and Go SDK at the emulator
    cd backend && go test ./...        # emulator-gated tests run when AWS_ENDPOINT_URL is set

## Run the handler locally

    scripts/emulator.sh serve          # needs the emulator running and setup done
    curl http://127.0.0.1:8080/health  # {"status":"ok"}

`backend/cmd/local` wraps the same handler `cmd/lambda` uses in an HTTP server. Each request becomes an API Gateway HTTP API (v2) event. It stands in for Lambda invocation, which the emulator can't do. It does not test packaging or the Lambda runtime. `scripts/emulator.sh build` makes the deployable zip (`.tmp/lambda.zip`, linux/arm64); it is only exercised in real AWS.

Unit tests (`go test ./...`) use a fake DB and need no emulator.

Change the port with `EMULATOR_PORT`.

## Backend logging

Set `RAIDEN_LOG_LEVEL=debug` in the repo root's `.env.backend.local` to see request timing and upstream activity. The backend accepts `debug`, `info`, `warn`, and `error` as minimum levels and defaults to `info`. Both the local server and Lambda write logs to stderr. Set the same variable in the Lambda environment to change its level.

## GitHub App for local sign-in

Register a GitHub App using the permissions and security settings in the [GitHub App setup guide](../setup/github-app.md). For the local web view, add `http://localhost:4210/` as a **Callback URL** and turn the webhook off. Install the App on the repositories you want to read. Copy its **client ID** and generate a **client secret**.

Create `.env.backend.local` in the repo root with the backend settings:

    GITHUB_CLIENT_ID='<app-client-id>'
    GITHUB_CLIENT_SECRET='<app-client-secret>'
    RAIDEN_ALLOWED_REDIRECTS='http://localhost:4210/'
    RAIDEN_ALLOWED_ORIGINS='http://localhost:4210'

Create `.env.frontend.local` in the repo root with the web build settings:

    RAIDEN_GITHUB_CLIENT_ID='<app-client-id>'
    RAIDEN_BACKEND_URL='http://127.0.0.1:8080'
    RAIDEN_WEB_RETURN_URL='http://localhost:4210/'

Both files are ignored by Git. With the emulator running and its table set up as above, load the backend file and start the handler from the repo root:

    set -a; . ./.env.backend.local; set +a
    scripts/emulator.sh serve

In another shell, load the frontend file and build and serve the web view:

    set -a; . ./.env.frontend.local; set +a
    pnpm exec nx run raiden:dev --skip-nx-cache

Open `http://localhost:4210/` and sign in. The callback URL must match `RAIDEN_WEB_RETURN_URL` and `RAIDEN_ALLOWED_REDIRECTS` exactly, including the trailing slash. `RAIDEN_ALLOWED_ORIGINS` uses the origin only, without that slash. The backend must be running for the code exchange.

To test the unpacked extension too, [create its key](../setup/github-app.md#fix-the-extension-id) and add `RAIDEN_EXTENSION_KEY='<public-key>'` to `.env.frontend.local`. Load that file and run `pnpm exec nx run extension:build --skip-nx-cache`. Load `dist/apps/extension` through `chrome://extensions` and copy its ID. Add `https://<extension-id>.chromiumapp.org/` as another App callback URL. Add that URL to the comma-separated `RAIDEN_ALLOWED_REDIRECTS` and `chrome-extension://<extension-id>` to `RAIDEN_ALLOWED_ORIGINS` in `.env.backend.local`, then reload that file and restart the backend. Use `--skip-nx-cache` when changing build settings so the new values reach the web or extension bundle.

## Table

One table, `raiden`, with string keys `pk` (hash) and `sk` (range), on-demand billing. Override the name with `RAIDEN_TABLE`.
