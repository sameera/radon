#!/usr/bin/env bash
# Start the DynamoDB emulator in the background if needed, create the table, then run the backend.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

eval "$(./scripts/emulator.sh env)"

if ! aws dynamodb list-tables >/dev/null 2>&1; then
    echo "Starting the DynamoDB emulator..."
    mkdir -p .tmp
    nohup ./scripts/emulator.sh start >.tmp/emulator.log 2>&1 &
    for ((attempt = 0; attempt < 120; attempt++)); do
        aws dynamodb list-tables >/dev/null 2>&1 && break
        sleep 1
    done
    if ! aws dynamodb list-tables >/dev/null 2>&1; then
        echo "DynamoDB emulator did not start within 120 seconds. See .tmp/emulator.log" >&2
        exit 1
    fi
fi

./scripts/emulator.sh setup
set -a; source .env.backend.local; set +a
./scripts/emulator.sh serve
