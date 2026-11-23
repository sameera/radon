// Command lambda is the AWS Lambda entry point (provided.al2023, binary named bootstrap).
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-lambda-go/lambda"

	"github.com/raiden/raiden/backend/internal/handler"
	"github.com/raiden/raiden/backend/internal/logging"
	"github.com/raiden/raiden/backend/internal/store"
)

func main() {
	logging.Configure()
	db, err := store.NewClient(context.Background())
	if err != nil {
		slog.Error("failed to initialize DynamoDB client", "error", err)
		os.Exit(1)
	}
	h := &handler.Handler{DB: db, Auth: handler.AuthFromEnv()}
	slog.Info("Lambda handler ready", "github_auth_enabled", h.Auth != nil)
	lambda.Start(h.Handle)
}
