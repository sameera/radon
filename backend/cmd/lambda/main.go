// Command lambda is the AWS Lambda entry point (provided.al2023, binary named bootstrap).
package main

import (
	"context"
	"log"

	"github.com/aws/aws-lambda-go/lambda"

	"github.com/raiden/raiden/backend/internal/handler"
	"github.com/raiden/raiden/backend/internal/store"
)

func main() {
	db, err := store.NewClient(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	h := &handler.Handler{DB: db, Auth: handler.AuthFromEnv()}
	lambda.Start(h.Handle)
}
