#!/usr/bin/env bash
# Start the local DynamoDB emulator and Go backend in a split tmux window.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION=raiden-server

case "${1:-}" in
    --emulator)
        exec "$ROOT/scripts/emulator.sh" start
        ;;
    --backend)
        eval "$("$ROOT/scripts/emulator.sh" env)"
        echo "Waiting for the DynamoDB emulator..."
        ready=false
        for ((attempt = 0; attempt < 120; attempt++)); do
            if aws dynamodb list-tables >/dev/null 2>&1; then
                ready=true
                break
            fi
            sleep 1
        done
        if [[ "$ready" != true ]]; then
            echo "DynamoDB emulator did not become ready within 120 seconds." >&2
            exit 1
        fi

        "$ROOT/scripts/emulator.sh" setup
        if [[ -f "$ROOT/.env.backend.local" ]]; then
            set -a
            # shellcheck disable=SC1091
            . "$ROOT/.env.backend.local"
            set +a
        fi
        exec "$ROOT/scripts/emulator.sh" serve
        ;;
    "")
        command -v tmux >/dev/null || { echo "tmux is required to open split panes." >&2; exit 1; }
        command -v aws-emulator >/dev/null || { echo "aws-emulator is required; see docs/system/local-dev.md" >&2; exit 1; }
        command -v aws >/dev/null || { echo "AWS CLI is required for DynamoDB setup." >&2; exit 1; }
        command -v go >/dev/null || { echo "Go is required to run the backend." >&2; exit 1; }

        printf -v script_path '%q' "$ROOT/run-server.sh"
        if ! tmux has-session -t "$SESSION" 2>/dev/null; then
            tmux new-session -d -s "$SESSION" -n backend -c "$ROOT" "$script_path --emulator"
            tmux set-window-option -t "$SESSION:backend" remain-on-exit on
            tmux split-window -h -t "$SESSION:backend" -c "$ROOT" "$script_path --backend"
        else
            emulator_dead="$(tmux display-message -p -t "$SESSION:backend.0" '#{pane_dead}' 2>/dev/null || true)"
            if [[ "$emulator_dead" == 1 ]]; then
                tmux respawn-pane -t "$SESSION:backend.0"
            fi
            backend_dead="$(tmux display-message -p -t "$SESSION:backend.1" '#{pane_dead}' 2>/dev/null || true)"
            if [[ "$backend_dead" == 1 ]]; then
                tmux respawn-pane -t "$SESSION:backend.1"
            elif [[ -z "$backend_dead" ]]; then
                tmux split-window -h -t "$SESSION:backend.0" -c "$ROOT" "$script_path --backend"
            fi
        fi
        tmux select-pane -t "$SESSION:backend.1"

        if [[ -n "${TMUX:-}" ]]; then
            tmux switch-client -t "$SESSION"
        else
            exec tmux attach-session -t "$SESSION"
        fi
        ;;
    *)
        echo "usage: $0" >&2
        exit 2
        ;;
esac
