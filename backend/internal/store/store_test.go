package store

import (
	"context"
	"os"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// Runs against aws-emulator. Skipped unless AWS_ENDPOINT_URL is set.
func TestRoundTrip(t *testing.T) {
	if os.Getenv("AWS_ENDPOINT_URL") == "" {
		t.Skip("AWS_ENDPOINT_URL not set; run scripts/emulator.sh start and setup")
	}
	ctx := context.Background()
	c, err := NewClient(ctx)
	if err != nil {
		t.Fatal(err)
	}
	item := map[string]types.AttributeValue{
		"pk": &types.AttributeValueMemberS{Value: "test#1"},
		"sk": &types.AttributeValueMemberS{Value: "goal"},
	}
	if _, err := c.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(TableName()), Item: item}); err != nil {
		t.Fatal(err)
	}
	out, err := c.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(TableName()), Key: item})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Item) == 0 {
		t.Fatal("item not found")
	}
}
