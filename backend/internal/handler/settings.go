package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager/types"
)

// The deployed function names its two settings stores in these environment values. They hold
// store identifiers, never a setting (D6).
const (
	EnvClientSecretID   = "RAIDEN_CLIENT_SECRET_ID"
	EnvSignInSettingsID = "RAIDEN_SIGNIN_SETTINGS_ID"
)

// SecretReader reads one secret store. found is false when the store has no value yet.
type SecretReader interface {
	SecretString(ctx context.Context, id string) (value string, found bool, err error)
}

// signInSettings is the sign-in settings store's value: everything but the client secret.
type signInSettings struct {
	ClientID         string   `json:"clientId"`
	AllowedRedirects []string `json:"allowedRedirects"`
	AllowedOrigins   []string `json:"allowedOrigins"`
}

// AuthFromStores reads the client secret store and the sign-in settings store once, at start.
// An empty store leaves sign-in off (nil, nil). A store that cannot be read is an error, so the
// instance fails to start and health fails instead of answering ok (D7, G11). Errors never carry
// a store's value (G7).
func AuthFromStores(ctx context.Context, r SecretReader, secretID, settingsID string) (*AuthConfig, error) {
	secret, secretFound, err := r.SecretString(ctx, secretID)
	if err != nil {
		return nil, fmt.Errorf("read client secret store: %w", err)
	}
	raw, settingsFound, err := r.SecretString(ctx, settingsID)
	if err != nil {
		return nil, fmt.Errorf("read sign-in settings store: %w", err)
	}
	if !secretFound || !settingsFound || secret == "" {
		return nil, nil
	}
	var s signInSettings
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		return nil, errors.New("sign-in settings store does not hold valid settings")
	}
	return &AuthConfig{
		ClientID:         s.ClientID,
		ClientSecret:     secret,
		AllowedRedirects: s.AllowedRedirects,
		AllowedOrigins:   s.AllowedOrigins,
	}, nil
}

// LoadAuth reads the deployed settings stores when the function names them, and the environment
// otherwise, so local runs keep working with no AWS account (G31).
func LoadAuth(ctx context.Context, open func(context.Context) (SecretReader, error)) (*AuthConfig, error) {
	secretID, settingsID := os.Getenv(EnvClientSecretID), os.Getenv(EnvSignInSettingsID)
	if secretID == "" && settingsID == "" {
		return AuthFromEnv(), nil
	}
	if secretID == "" || settingsID == "" {
		return nil, fmt.Errorf("%s and %s must both be set", EnvClientSecretID, EnvSignInSettingsID)
	}
	r, err := open(ctx)
	if err != nil {
		return nil, err
	}
	return AuthFromStores(ctx, r, secretID, settingsID)
}

// SecretsManager reads stores from AWS Secrets Manager.
type SecretsManager struct {
	Client *secretsmanager.Client
}

// OpenSecretsManager builds a reader from the standard AWS environment.
func OpenSecretsManager(ctx context.Context) (SecretReader, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	return SecretsManager{Client: secretsmanager.NewFromConfig(cfg)}, nil
}

// SecretString returns found=false for a store created with no value: Secrets Manager answers
// that with ResourceNotFoundException.
func (s SecretsManager) SecretString(ctx context.Context, id string) (string, bool, error) {
	out, err := s.Client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{SecretId: aws.String(id)})
	if err != nil {
		var nf *types.ResourceNotFoundException
		if errors.As(err, &nf) {
			return "", false, nil
		}
		return "", false, err
	}
	return aws.ToString(out.SecretString), true, nil
}
