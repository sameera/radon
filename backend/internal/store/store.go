// Package store wraps DynamoDB access for Raiden's records: its own data, and the milestones and
// sprints it syncs from GitHub.
package store

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
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

// Item is one record in a repository partition: its sort key and its string attributes.
type Item struct {
	SK    string
	Attrs map[string]string
}

// Records is the partition access the data routes use. A partition holds every record of one
// repository, keyed by GitHub's permanent identity for it (D2).
type Records interface {
	Query(ctx context.Context, pk string) ([]Item, error)
	Put(ctx context.Context, pk string, item Item) error
	Delete(ctx context.Context, pk, sk string) error
}

// Dynamo stores records in the single table, with the partition in "pk" and the record in "sk".
type Dynamo struct {
	Client *dynamodb.Client
}

func (d Dynamo) Query(ctx context.Context, pk string) ([]Item, error) {
	var out []Item
	var start map[string]types.AttributeValue
	for {
		res, err := d.Client.Query(ctx, &dynamodb.QueryInput{
			TableName:                 aws.String(TableName()),
			KeyConditionExpression:    aws.String("pk = :pk"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":pk": &types.AttributeValueMemberS{Value: pk}},
			ExclusiveStartKey:         start,
		})
		if err != nil {
			return nil, err
		}
		for _, raw := range res.Items {
			it := Item{Attrs: map[string]string{}}
			for k, v := range raw {
				s, ok := v.(*types.AttributeValueMemberS)
				if !ok {
					continue
				}
				switch k {
				case "pk":
				case "sk":
					it.SK = s.Value
				default:
					it.Attrs[k] = s.Value
				}
			}
			out = append(out, it)
		}
		if len(res.LastEvaluatedKey) == 0 {
			return out, nil
		}
		start = res.LastEvaluatedKey
	}
}

func (d Dynamo) Put(ctx context.Context, pk string, item Item) error {
	raw := map[string]types.AttributeValue{
		"pk": &types.AttributeValueMemberS{Value: pk},
		"sk": &types.AttributeValueMemberS{Value: item.SK},
	}
	for k, v := range item.Attrs {
		if k != "pk" && k != "sk" {
			raw[k] = &types.AttributeValueMemberS{Value: v}
		}
	}
	_, err := d.Client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(TableName()), Item: raw})
	return err
}

func (d Dynamo) Delete(ctx context.Context, pk, sk string) error {
	_, err := d.Client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(TableName()),
		Key: map[string]types.AttributeValue{
			"pk": &types.AttributeValueMemberS{Value: pk},
			"sk": &types.AttributeValueMemberS{Value: sk},
		},
	})
	return err
}
