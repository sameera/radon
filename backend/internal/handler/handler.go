// Package handler is the Lambda entry logic, shared by cmd/lambda and cmd/local.
package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/raiden/raiden/backend/internal/store"
)

// DB is the DynamoDB surface the handler uses.
type DB interface {
	DescribeTable(ctx context.Context, in *dynamodb.DescribeTableInput, opts ...func(*dynamodb.Options)) (*dynamodb.DescribeTableOutput, error)
}

// Handler routes API Gateway HTTP API (v2) events.
type Handler struct {
	DB DB
	// Auth turns on the sign-in endpoints. When nil they answer 404.
	Auth *AuthConfig
	// Store holds the repository partitions. The data routes need it and Auth; without either
	// they answer 404.
	Store store.Records
}

// Handle serves one request.
func (h *Handler) Handle(ctx context.Context, req events.APIGatewayV2HTTPRequest) (res events.APIGatewayV2HTTPResponse, err error) {
	start := time.Now()
	route := "unmatched"
	defer func() {
		slog.DebugContext(ctx, "request completed", "route", route, "request_id", req.RequestContext.RequestID,
			"status", res.StatusCode, "duration", time.Since(start))
	}()

	routeKey := req.RequestContext.HTTP.Method + " " + req.RawPath
	switch routeKey {
	case "GET /health":
		route = routeKey
		if _, err := h.DB.DescribeTable(ctx, &dynamodb.DescribeTableInput{TableName: aws.String(store.TableName())}); err != nil {
			slog.ErrorContext(ctx, "DynamoDB health check failed", "request_id", req.RequestContext.RequestID, "error_type", fmt.Sprintf("%T", err))
			return respond(http.StatusServiceUnavailable, map[string]string{"status": "db unavailable"}), nil
		}
		return respond(http.StatusOK, map[string]string{"status": "ok"}), nil
	case "POST /auth/exchange", "OPTIONS /auth/exchange":
		route = routeKey
		if h.Auth != nil {
			return h.exchange(ctx, req), nil
		}
		return respond(http.StatusNotFound, map[string]string{"error": "not found"}), nil
	case "POST /auth/refresh", "OPTIONS /auth/refresh":
		route = routeKey
		if h.Auth != nil {
			return h.refresh(ctx, req), nil
		}
		return respond(http.StatusNotFound, map[string]string{"error": "not found"}), nil
	case "POST /grooming/sync", "OPTIONS /grooming/sync":
		route = routeKey
		if h.Auth != nil && h.Store != nil {
			return h.groomingSync(ctx, req), nil
		}
		return respond(http.StatusNotFound, map[string]string{"error": "not found"}), nil
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
