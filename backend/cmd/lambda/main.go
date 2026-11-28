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
	// The deployed function reads its settings stores once, at start. A store that cannot be read
	// stops the instance, so health fails instead of answering ok (D6, D7).
	auth, err := handler.LoadAuth(context.Background(), handler.OpenSecretsManager)
	if err != nil {
		slog.Error("failed to read the sign-in settings", "error", err)
		os.Exit(1)
	}
	h := &handler.Handler{DB: db, Auth: auth, Store: store.Dynamo{Client: db}}
	slog.Info("Lambda handler ready", "github_auth_enabled", h.Auth != nil)
	lambda.Start(h.Handle)
}
