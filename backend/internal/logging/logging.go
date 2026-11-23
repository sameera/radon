// Package logging configures the backend's process-wide logger.
package logging

import (
	"log/slog"
	"os"
	"strings"
)

// Configure applies RAIDEN_LOG_LEVEL to all backend logs.
func Configure() {
	var level slog.Level
	valid := true
	switch strings.ToLower(strings.TrimSpace(os.Getenv("RAIDEN_LOG_LEVEL"))) {
	case "debug":
		level = slog.LevelDebug
	case "", "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
		valid = false
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})))
	if !valid {
		slog.Warn("invalid RAIDEN_LOG_LEVEL, using info", "valid_levels", "debug, info, warn, error")
	}
}
