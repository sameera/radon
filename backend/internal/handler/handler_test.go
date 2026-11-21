package handler

import (
	"context"
	"errors"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

type fakeDB struct{ err error }

func (f fakeDB) DescribeTable(context.Context, *dynamodb.DescribeTableInput, ...func(*dynamodb.Options)) (*dynamodb.DescribeTableOutput, error) {
	return &dynamodb.DescribeTableOutput{}, f.err
}

func req(method string, path string) events.APIGatewayV2HTTPRequest {
	r := events.APIGatewayV2HTTPRequest{RawPath: path}
	r.RequestContext.HTTP.Method = method
	return r
}

func TestHandle(t *testing.T) {
	cases := []struct {
		name   string
		db     fakeDB
		method string
		path   string
		want   int
	}{
		{"health ok", fakeDB{}, "GET", "/health", 200},
		{"health db down", fakeDB{err: errors.New("x")}, "GET", "/health", 503},
		{"unknown", fakeDB{}, "GET", "/nope", 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := &Handler{DB: c.db}
			res, err := h.Handle(context.Background(), req(c.method, c.path))
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != c.want {
				t.Fatalf("got %d want %d", res.StatusCode, c.want)
			}
		})
	}
}
