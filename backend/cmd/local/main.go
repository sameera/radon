// Command local runs the Lambda handler behind a plain HTTP server for local
// development. It turns each request into an API Gateway HTTP API (v2) event,
// so the handler sees the same input shape as in Lambda. aws-emulator cannot
// invoke Go Lambdas, so this stands in for it. Packaging is not exercised.
package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"

	"github.com/radon/radon/backend/internal/handler"
	"github.com/radon/radon/backend/internal/store"
)

func main() {
	db, err := store.NewClient(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	h := &handler.Handler{DB: db}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
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
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		for k, v := range res.Headers {
			w.Header().Set(k, v)
		}
		w.WriteHeader(res.StatusCode)
		_, _ = io.WriteString(w, res.Body)
	})

	addr := os.Getenv("RADON_LOCAL_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	log.Printf("local harness on http://%s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
