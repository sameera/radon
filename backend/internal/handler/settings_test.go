package handler

import (
	"context"
	"errors"
	"testing"
)

// fakeSecrets is an in-memory secret store: a missing key is a store with no value yet.
type fakeSecrets struct {
	values map[string]string
	err    error
	reads  []string
}

func (f *fakeSecrets) SecretString(_ context.Context, id string) (string, bool, error) {
	f.reads = append(f.reads, id)
	if f.err != nil {
		return "", false, f.err
	}
	v, ok := f.values[id]
	return v, ok, nil
}

const settingsJSON = `{"clientId":"Iv1.abc","allowedRedirects":["https://d1.cloudfront.net/"],"allowedOrigins":["https://d1.cloudfront.net","chrome-extension://xyz"]}`

func TestAuthFromStoresReadsBothStores(t *testing.T) {
	s := &fakeSecrets{values: map[string]string{"secret-arn": "s3cret", "settings-arn": settingsJSON}}
	a, err := AuthFromStores(context.Background(), s, "secret-arn", "settings-arn")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if a == nil || a.ClientID != "Iv1.abc" || a.ClientSecret != "s3cret" {
		t.Fatalf("got %+v", a)
	}
	if len(a.AllowedRedirects) != 1 || a.AllowedRedirects[0] != "https://d1.cloudfront.net/" {
		t.Fatalf("redirects %v", a.AllowedRedirects)
	}
	if len(a.AllowedOrigins) != 2 || a.AllowedOrigins[1] != "chrome-extension://xyz" {
		t.Fatalf("origins %v", a.AllowedOrigins)
	}
}

// G11: before any settings are given, sign-in is off and the backend still starts.
func TestAuthFromStoresEmptyStoresTurnSignInOff(t *testing.T) {
	for name, values := range map[string]map[string]string{
		"both empty":     {},
		"secret empty":   {"settings-arn": settingsJSON},
		"settings empty": {"secret-arn": "s3cret"},
	} {
		a, err := AuthFromStores(context.Background(), &fakeSecrets{values: values}, "secret-arn", "settings-arn")
		if err != nil || a != nil {
			t.Fatalf("%s: got %+v, %v; want sign-in off", name, a, err)
		}
	}
}

// G11: a store that cannot be read stops the instance, so health fails instead of answering ok.
func TestAuthFromStoresReadErrorFails(t *testing.T) {
	_, err := AuthFromStores(context.Background(), &fakeSecrets{err: errors.New("access denied")}, "secret-arn", "settings-arn")
	if err == nil {
		t.Fatal("want an error when a store cannot be read")
	}
}

func TestAuthFromStoresBadSettingsFails(t *testing.T) {
	s := &fakeSecrets{values: map[string]string{"secret-arn": "s3cret", "settings-arn": "{not json"}}
	if _, err := AuthFromStores(context.Background(), s, "secret-arn", "settings-arn"); err == nil {
		t.Fatal("want an error for unreadable settings")
	}
}

// G7: an error never carries the client secret.
func TestAuthFromStoresErrorNeverCarriesSecret(t *testing.T) {
	s := &fakeSecrets{values: map[string]string{"secret-arn": "s3cret", "settings-arn": `{"clientId": 5}`}}
	_, err := AuthFromStores(context.Background(), s, "secret-arn", "settings-arn")
	if err == nil {
		t.Fatal("want an error")
	}
	if contains([]string{err.Error()}, "s3cret") || len(err.Error()) == 0 {
		t.Fatalf("error leaks or is empty: %q", err)
	}
}

// Local runs keep reading the environment (G31); deployed runs read the stores.
func TestLoadAuthPicksSource(t *testing.T) {
	t.Setenv("GITHUB_CLIENT_SECRET", "env-secret")
	t.Setenv("GITHUB_CLIENT_ID", "env-id")
	t.Setenv(EnvClientSecretID, "")
	t.Setenv(EnvSignInSettingsID, "")
	a, err := LoadAuth(context.Background(), func(context.Context) (SecretReader, error) {
		t.Fatal("local runs must not open the secret store")
		return nil, nil
	})
	if err != nil || a == nil || a.ClientID != "env-id" {
		t.Fatalf("local: got %+v, %v", a, err)
	}

	t.Setenv(EnvClientSecretID, "secret-arn")
	t.Setenv(EnvSignInSettingsID, "settings-arn")
	s := &fakeSecrets{values: map[string]string{"secret-arn": "s3cret", "settings-arn": settingsJSON}}
	a, err = LoadAuth(context.Background(), func(context.Context) (SecretReader, error) { return s, nil })
	if err != nil || a == nil || a.ClientID != "Iv1.abc" || a.ClientSecret != "s3cret" {
		t.Fatalf("deployed: got %+v, %v", a, err)
	}
}
