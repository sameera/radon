// Package store wraps DynamoDB access for Radon-only data.
package store

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// TableName returns the table name from RADON_TABLE, default "radon".
func TableName() string {
	if v := os.Getenv("RADON_TABLE"); v != "" {
		return v
	}
	return "radon"
}

// NewClient builds a DynamoDB client from the standard AWS environment.
// Locally, AWS_ENDPOINT_URL, AWS_CA_BUNDLE and the shared credentials file
// (see scripts/emulator.sh env) point it at aws-emulator.
func NewClient(ctx context.Context) (*dynamodb.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	return dynamodb.NewFromConfig(cfg), nil
}
