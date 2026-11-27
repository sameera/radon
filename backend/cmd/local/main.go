// Command local runs the Lambda handler behind a plain HTTP server for local
// development. It turns each request into an API Gateway HTTP API (v2) event,
// so the handler sees the same input shape as in Lambda. aws-emulator cannot
// invoke Go Lambdas, so this stands in for it. Packaging is not exercised.
package main

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"

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
	h := &handler.Handler{DB: db, Auth: handler.AuthFromEnv(), Store: store.Dynamo{Client: db}}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		body, readErr := io.ReadAll(r.Body)
		if readErr != nil {
			slog.DebugContext(r.Context(), "failed to read local HTTP request body")
		}
		headers := map[string]string{}
		for k, v := range r.Header {
			headers[strings.ToLower(k)] = strings.Join(v, ",")
		}
		query := map[string]string{}
		for k, v := range r.URL.Query() {
			query[k] = strings.Join(v, ",")
		}
		ev := events.APIGatewayV2HTTPRequest{
			Version:               "2.0",
			RawPath:               r.URL.Path,
			RawQueryString:        r.URL.RawQuery,
			Headers:               headers,
			QueryStringParameters: query,
			Body:                  string(body),
		}
		ev.RequestContext.HTTP.Method = r.Method
		ev.RequestContext.HTTP.Path = r.URL.Path

		res, err := h.Handle(r.Context(), ev)
		if err != nil {
			slog.ErrorContext(r.Context(), "local HTTP handler failed")
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		for k, v := range res.Headers {
			w.Header().Set(k, v)
		}
		w.WriteHeader(res.StatusCode)
		if _, err := io.WriteString(w, res.Body); err != nil {
			slog.DebugContext(r.Context(), "failed to write local HTTP response", "status", res.StatusCode)
		}
	})

	addr := os.Getenv("RAIDEN_LOCAL_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	slog.Info("starting local HTTP server", "address", addr, "github_auth_enabled", h.Auth != nil)
	if err := http.ListenAndServe(addr, nil); err != nil {
		slog.Error("local HTTP server stopped", "error", err)
		os.Exit(1)
	}
}
