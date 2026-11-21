// Package handler is the Lambda entry logic, shared by cmd/lambda and cmd/local.
package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/radon/radon/backend/internal/store"
)

// DB is the DynamoDB surface the handler uses.
type DB interface {
	DescribeTable(ctx context.Context, in *dynamodb.DescribeTableInput, opts ...func(*dynamodb.Options)) (*dynamodb.DescribeTableOutput, error)
}

// Handler routes API Gateway HTTP API (v2) events.
type Handler struct {
	DB DB
}

// Handle serves one request.
func (h *Handler) Handle(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	switch req.RequestContext.HTTP.Method + " " + req.RawPath {
	case "GET /health":
		if _, err := h.DB.DescribeTable(ctx, &dynamodb.DescribeTableInput{TableName: aws.String(store.TableName())}); err != nil {
			return respond(http.StatusServiceUnavailable, map[string]string{"status": "db unavailable"}), nil
		}
		return respond(http.StatusOK, map[string]string{"status": "ok"}), nil
	default:
		return respond(http.StatusNotFound, map[string]string{"error": "not found"}), nil
	}
}

func respond(status int, body any) events.APIGatewayV2HTTPResponse {
	b, _ := json.Marshal(body)
	return events.APIGatewayV2HTTPResponse{
		StatusCode: status,
		Headers:    map[string]string{"content-type": "application/json"},
		Body:       string(b),
	}
}
