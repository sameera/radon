package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
)

// AuthConfig holds the GitHub App's secret and the addresses the backend answers. The backend is
// stateless: it exchanges and refreshes tokens and keeps nothing (G2). The secret comes from the
// environment (or the AWS secret store that fills it), never from the repository (G1).
type AuthConfig struct {
	ClientID         string
	ClientSecret     string
	AllowedRedirects []string
	AllowedOrigins   []string
	GitHubURL        string // default https://github.com
	APIURL           string // default https://api.github.com
	HTTP             *http.Client
}

// AuthFromEnv reads the config from the environment. It returns nil when the secret is absent,
// which leaves the sign-in endpoints off.
func AuthFromEnv() *AuthConfig {
	secret := os.Getenv("GITHUB_CLIENT_SECRET")
	if secret == "" {
		return nil
	}
	return &AuthConfig{
		ClientID:         os.Getenv("GITHUB_CLIENT_ID"),
		ClientSecret:     secret,
		AllowedRedirects: splitList(os.Getenv("RAIDEN_ALLOWED_REDIRECTS")),
		AllowedOrigins:   splitList(os.Getenv("RAIDEN_ALLOWED_ORIGINS")),
	}
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func (a *AuthConfig) client() *http.Client {
	if a.HTTP != nil {
		return a.HTTP
	}
	return http.DefaultClient
}

func (a *AuthConfig) githubURL() string {
	if a.GitHubURL != "" {
		return a.GitHubURL
	}
	return "https://github.com"
}

func (a *AuthConfig) apiURL() string {
	if a.APIURL != "" {
		return a.APIURL
	}
	return "https://api.github.com"
}

// corsHeaders answers cross-origin calls only from the configured origins (G10).
func (a *AuthConfig) corsHeaders(origin string) map[string]string {
	if origin == "" || !contains(a.AllowedOrigins, origin) {
		return nil
	}
	return map[string]string{
		"access-control-allow-origin":  origin,
		"access-control-allow-methods": "POST, OPTIONS",
		"access-control-allow-headers": "content-type",
		"vary":                         "origin",
	}
}

func authRespond(status int, body any, cors map[string]string) events.APIGatewayV2HTTPResponse {
	res := respond(status, body)
	for k, v := range cors {
		res.Headers[k] = v
	}
	return res
}

func header(req events.APIGatewayV2HTTPRequest, name string) string {
	for k, v := range req.Headers {
		if strings.EqualFold(k, name) {
			return v
		}
	}
	return ""
}

type exchangeRequest struct {
	Code        string `json:"code"`
	Verifier    string `json:"verifier"`
	RedirectURI string `json:"redirect_uri"`
}

type tokenAnswer struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Error        string `json:"error"`
}

// authGate handles the preflight and the origin check shared by both endpoints. It returns a
// response when the request is finished.
func (h *Handler) authGate(req events.APIGatewayV2HTTPRequest) (map[string]string, *events.APIGatewayV2HTTPResponse) {
	origin := header(req, "origin")
	cors := h.Auth.corsHeaders(origin)
	if req.RequestContext.HTTP.Method == http.MethodOptions {
		res := events.APIGatewayV2HTTPResponse{StatusCode: http.StatusNoContent, Headers: map[string]string{}}
		for k, v := range cors {
			res.Headers[k] = v
		}
		return cors, &res
	}
	if origin != "" && cors == nil {
		res := respond(http.StatusForbidden, map[string]string{"error": "origin not allowed"})
		return cors, &res
	}
	return cors, nil
}

func (h *Handler) exchange(ctx context.Context, req events.APIGatewayV2HTTPRequest) events.APIGatewayV2HTTPResponse {
	cors, done := h.authGate(req)
	if done != nil {
		return *done
	}
	var in exchangeRequest
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil || in.Code == "" || in.Verifier == "" {
		return authRespond(http.StatusBadRequest, map[string]string{"error": "bad request"}, cors)
	}
	if !contains(h.Auth.AllowedRedirects, in.RedirectURI) {
		return authRespond(http.StatusBadRequest, map[string]string{"error": "bad request"}, cors)
	}
	tok, ok := h.Auth.tokens(ctx, url.Values{
		"code":          {in.Code},
		"code_verifier": {in.Verifier},
		"redirect_uri":  {in.RedirectURI},
	})
	if !ok {
		return authRespond(http.StatusBadRequest, map[string]string{"error": "exchange failed"}, cors)
	}
	login, ok := h.Auth.login(ctx, tok.AccessToken)
	if !ok {
		return authRespond(http.StatusBadGateway, map[string]string{"error": "user lookup failed"}, cors)
	}
	return authRespond(http.StatusOK, map[string]any{
		"access_token":  tok.AccessToken,
		"expires_in":    tok.ExpiresIn,
		"refresh_token": tok.RefreshToken,
		"login":         login,
	}, cors)
}

// tokens asks GitHub for tokens, adding the client id and secret. It reports only success or
// failure: nothing GitHub says is passed on, so no code or token can leak into an error (G5).
func (a *AuthConfig) tokens(ctx context.Context, form url.Values) (tokenAnswer, bool) {
	form.Set("client_id", a.ClientID)
	form.Set("client_secret", a.ClientSecret)
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, a.githubURL()+"/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return tokenAnswer{}, false
	}
	r.Header.Set("content-type", "application/x-www-form-urlencoded")
	r.Header.Set("accept", "application/json")
	res, err := a.client().Do(r)
	if err != nil {
		return tokenAnswer{}, false
	}
	defer res.Body.Close()
	var out tokenAnswer
	b, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if json.Unmarshal(b, &out) != nil || out.Error != "" || out.AccessToken == "" {
		return tokenAnswer{}, false
	}
	return out, true
}

func (a *AuthConfig) login(ctx context.Context, accessToken string) (string, bool) {
	r, err := http.NewRequestWithContext(ctx, http.MethodGet, a.apiURL()+"/user", nil)
	if err != nil {
		return "", false
	}
	r.Header.Set("authorization", "Bearer "+accessToken)
	r.Header.Set("accept", "application/vnd.github+json")
	res, err := a.client().Do(r)
	if err != nil {
		return "", false
	}
	defer res.Body.Close()
	var u struct {
		Login string `json:"login"`
	}
	b, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode != http.StatusOK || json.Unmarshal(b, &u) != nil || u.Login == "" {
		return "", false
	}
	return u.Login, true
}
