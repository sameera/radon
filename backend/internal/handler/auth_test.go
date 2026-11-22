package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

const (
	webOrigin = "https://raiden.team.example"
	extOrigin = "chrome-extension://abcdefgh"
	extReturn = "https://abcdefgh.chromiumapp.org/"
	webReturn = "https://raiden.team.example/"
)

// fakeGitHub plays GitHub's token endpoint and user endpoint.
type fakeGitHub struct {
	form  url.Values
	auth  string
	fail  bool
	tests *testing.T
}

func (f *fakeGitHub) server() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		f.form = r.PostForm
		w.Header().Set("content-type", "application/json")
		if f.fail {
			_, _ = w.Write([]byte(`{"error":"bad_verification_code","error_description":"secretcode"}`))
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"at","expires_in":28800,"refresh_token":"rt","token_type":"bearer"}`))
	})
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		f.auth = r.Header.Get("authorization")
		_, _ = w.Write([]byte(`{"login":"octo"}`))
	})
	return httptest.NewServer(mux)
}

func authHandler(gh *httptest.Server) *Handler {
	return &Handler{
		DB: fakeDB{},
		Auth: &AuthConfig{
			ClientID:         "Iv1.x",
			ClientSecret:     "s3cret",
			AllowedRedirects: []string{extReturn, webReturn},
			AllowedOrigins:   []string{webOrigin, extOrigin},
			GitHubURL:        gh.URL,
			APIURL:           gh.URL,
		},
	}
}

func post(path, origin, body string) events.APIGatewayV2HTTPRequest {
	r := req("POST", path)
	r.Headers = map[string]string{"origin": origin, "content-type": "application/json"}
	r.Body = body
	return r
}

func TestExchange(t *testing.T) {
	gf := &fakeGitHub{}
	gh := gf.server()
	defer gh.Close()
	h := authHandler(gh)

	body := `{"code":"c1","verifier":"v1","redirect_uri":"` + extReturn + `"}`
	res, err := h.Handle(context.Background(), post("/auth/exchange", extOrigin, body))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatalf("got %d: %s", res.StatusCode, res.Body)
	}
	var out map[string]any
	_ = json.Unmarshal([]byte(res.Body), &out)
	if out["access_token"] != "at" || out["refresh_token"] != "rt" || out["login"] != "octo" || out["expires_in"].(float64) != 28800 {
		t.Fatalf("unexpected body %s", res.Body)
	}
	// The secret goes to GitHub, never back to the caller (G1).
	if strings.Contains(res.Body, "s3cret") {
		t.Fatal("secret in response")
	}
	if gf.form.Get("client_secret") != "s3cret" || gf.form.Get("client_id") != "Iv1.x" ||
		gf.form.Get("code") != "c1" || gf.form.Get("code_verifier") != "v1" || gf.form.Get("redirect_uri") != extReturn {
		t.Fatalf("bad form sent to GitHub: %v", gf.form)
	}
	if gf.auth != "Bearer at" {
		t.Fatalf("user lookup auth %q", gf.auth)
	}
	if res.Headers["access-control-allow-origin"] != extOrigin {
		t.Fatalf("cors header %q", res.Headers["access-control-allow-origin"])
	}
}

func TestExchangeRefusals(t *testing.T) {
	gf := &fakeGitHub{}
	gh := gf.server()
	defer gh.Close()
	h := authHandler(gh)

	cases := []struct {
		name, origin, body string
		want               int
	}{
		{"unlisted return address", extOrigin, `{"code":"c","verifier":"v","redirect_uri":"https://evil.example/"}`, 400},
		{"unlisted origin", "https://evil.example", `{"code":"c","verifier":"v","redirect_uri":"` + webReturn + `"}`, 403},
		{"missing verifier", webOrigin, `{"code":"c","redirect_uri":"` + webReturn + `"}`, 400},
		{"missing code", webOrigin, `{"verifier":"v","redirect_uri":"` + webReturn + `"}`, 400},
		{"bad json", webOrigin, `{`, 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gf.form = nil
			res, _ := h.Handle(context.Background(), post("/auth/exchange", c.origin, c.body))
			if res.StatusCode != c.want {
				t.Fatalf("got %d want %d: %s", res.StatusCode, c.want, res.Body)
			}
			if gf.form != nil {
				t.Fatal("GitHub was called for a refused request")
			}
			if _, ok := res.Headers["access-control-allow-origin"]; ok && c.origin == "https://evil.example" {
				t.Fatal("cors header for unlisted origin")
			}
		})
	}
}

func TestExchangeGitHubFailureLeaksNothing(t *testing.T) {
	gf := &fakeGitHub{fail: true}
	gh := gf.server()
	defer gh.Close()
	res, _ := authHandler(gh).Handle(context.Background(),
		post("/auth/exchange", webOrigin, `{"code":"secretcode","verifier":"v","redirect_uri":"`+webReturn+`"}`))
	if res.StatusCode != 400 {
		t.Fatalf("got %d", res.StatusCode)
	}
	for _, leak := range []string{"secretcode", "s3cret", "bad_verification_code"} {
		if strings.Contains(res.Body, leak) {
			t.Fatalf("response leaks %q: %s", leak, res.Body)
		}
	}
}

func TestPreflight(t *testing.T) {
	gh := (&fakeGitHub{}).server()
	defer gh.Close()
	h := authHandler(gh)
	r := req("OPTIONS", "/auth/exchange")
	r.Headers = map[string]string{"origin": webOrigin}
	res, _ := h.Handle(context.Background(), r)
	if res.StatusCode != 204 || res.Headers["access-control-allow-origin"] != webOrigin ||
		!strings.Contains(res.Headers["access-control-allow-headers"], "content-type") {
		t.Fatalf("preflight %d %v", res.StatusCode, res.Headers)
	}
	r.Headers = map[string]string{"origin": "https://evil.example"}
	res, _ = h.Handle(context.Background(), r)
	if _, ok := res.Headers["access-control-allow-origin"]; ok {
		t.Fatal("preflight allowed an unlisted origin")
	}
}

func TestExchangeUnconfigured(t *testing.T) {
	res, _ := (&Handler{DB: fakeDB{}}).Handle(context.Background(), post("/auth/exchange", webOrigin, `{}`))
	if res.StatusCode != 404 {
		t.Fatalf("got %d", res.StatusCode)
	}
}

func TestAuthFromEnv(t *testing.T) {
	t.Setenv("GITHUB_CLIENT_ID", "id")
	t.Setenv("GITHUB_CLIENT_SECRET", "sec")
	t.Setenv("RAIDEN_ALLOWED_REDIRECTS", "https://a/, https://b/")
	t.Setenv("RAIDEN_ALLOWED_ORIGINS", "https://a")
	a := AuthFromEnv()
	if a == nil || a.ClientID != "id" || a.ClientSecret != "sec" || len(a.AllowedRedirects) != 2 || a.AllowedRedirects[1] != "https://b/" {
		t.Fatalf("%+v", a)
	}
	os.Unsetenv("GITHUB_CLIENT_SECRET")
	if AuthFromEnv() != nil {
		t.Fatal("expected nil without a secret")
	}
}
