#!/usr/bin/env bash
# Local AWS emulation for the Raiden backend.
#   scripts/emulator.sh start   run aws-emulator in the foreground (port 9297)
#   scripts/emulator.sh setup   create the DynamoDB table (emulator must be running)
#   scripts/emulator.sh serve   run the Go handler behind HTTP on 127.0.0.1:8080 (needs env loaded)
#   scripts/emulator.sh build   build the Lambda zip at .tmp/lambda.zip (linux/arm64, bootstrap, repeatable)
#   scripts/emulator.sh env     print exports; use: eval "$(scripts/emulator.sh env)"
# State is in memory. Restarting the emulator wipes it; rerun "setup".
set -euo pipefail

PORT="${EMULATOR_PORT:-9297}"
DIR="$HOME/.aws/emulator/$PORT"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_env() {
    cat <<ENV
export AWS_ENDPOINT_URL=https://127.0.0.1:$PORT
export AWS_SHARED_CREDENTIALS_FILE=$DIR/emulator_credentials
export AWS_CONFIG_FILE=$DIR/config
export AWS_CA_BUNDLE=$DIR/ca.pem
export AWS_EC2_METADATA_DISABLED=true
export AWS_DISABLE_HOST_PREFIX_INJECTION=true
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export RAIDEN_TABLE=raiden
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE
ENV
}

case "${1:-}" in
    start)
        command -v aws-emulator >/dev/null || { echo "aws-emulator not installed; see docs/system/local-dev.md" >&2; exit 1; }
        exec aws-emulator -p "$PORT"
        ;;
    env)
        print_env
        ;;
    setup)
        eval "$(print_env)"
        aws dynamodb describe-table --table-name raiden >/dev/null 2>&1 \
            || aws dynamodb create-table --cli-input-json "file://$ROOT/backend/local/table.json" >/dev/null
        echo "table raiden ready"
        ;;
    serve)
        eval "$(print_env)"
        cd "$ROOT/backend" && exec go run ./cmd/local
        ;;
    build)
        # Repeatable: the same source gives the same zip, whatever the checkout path, the
        # version-control state or the time, so an unchanged deploy uploads no new code (D8).
        OUT="${RAIDEN_LAMBDA_DIR:-$ROOT/.tmp}"
        mkdir -p "$OUT/lambda"
        (cd "$ROOT/backend" && GOOS=linux GOARCH=arm64 CGO_ENABLED=0 GOFLAGS= \
            go build -trimpath -buildvcs=false -ldflags="-buildid=" -o "$OUT/lambda/bootstrap" ./cmd/lambda)
        chmod 755 "$OUT/lambda/bootstrap"
        touch -t 198001010000 "$OUT/lambda/bootstrap"
        (cd "$OUT/lambda" && rm -f ../lambda.zip && TZ=UTC zip -q -X ../lambda.zip bootstrap)
        echo "$OUT/lambda.zip ready"
        ;;
    *)
        echo "usage: $0 start|setup|serve|build|env" >&2
        exit 2
        ;;
esac
