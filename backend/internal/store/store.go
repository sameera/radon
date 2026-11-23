// Package store wraps DynamoDB access for Raiden-only data.
package store

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// TableName returns the table name from RAIDEN_TABLE, default "raiden".
func TableName() string {
	if v := os.Getenv("RAIDEN_TABLE"); v != "" {
		return v
	}
	return "raiden"
}

// NewClient builds a DynamoDB client from the standard AWS environment.
// Locally, AWS_ENDPOINT_URL, AWS_CA_BUNDLE and the shared credentials file
// (see scripts/emulator.sh env) point it at aws-emulator.
func NewClient(ctx context.Context) (*dynamodb.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	slog.DebugContext(ctx, "DynamoDB client configured", "region", cfg.Region, "table", TableName())
	return dynamodb.NewFromConfig(cfg), nil
}
