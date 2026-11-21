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

## Table

One table, `radon`, with string keys `pk` (hash) and `sk` (range), on-demand billing. Override the name with `RADON_TABLE`.
