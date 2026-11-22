package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRefresh(t *testing.T) {
	gf := &fakeGitHub{}
	gh := gf.server()
	defer gh.Close()
	h := authHandler(gh)
	res, _ := h.Handle(context.Background(), post("/auth/refresh", webOrigin, `{"refresh_token":"rt1"}`))
	if res.StatusCode != 200 {
		t.Fatalf("got %d: %s", res.StatusCode, res.Body)
	}
	var out map[string]any
	_ = json.Unmarshal([]byte(res.Body), &out)
	if out["access_token"] != "at" || out["refresh_token"] != "rt" || out["expires_in"].(float64) != 28800 {
		t.Fatalf("unexpected body %s", res.Body)
	}
	if strings.Contains(res.Body, "s3cret") {
		t.Fatal("secret in response")
	}
	f := gf.form
	if f.Get("grant_type") != "refresh_token" || f.Get("refresh_token") != "rt1" || f.Get("client_secret") != "s3cret" || f.Get("client_id") != "Iv1.x" {
		t.Fatalf("bad form sent to GitHub: %v", f)
	}
	if res.Headers["access-control-allow-origin"] != webOrigin {
		t.Fatalf("cors header %q", res.Headers["access-control-allow-origin"])
	}
	if gf.auth != "" {
		t.Fatal("refresh must not look up the user")
	}
}

func TestRefreshRefusals(t *testing.T) {
	gf := &fakeGitHub{}
	gh := gf.server()
	defer gh.Close()
	h := authHandler(gh)
	cases := []struct {
		name, origin, body string
		want               int
	}{
		{"unlisted origin", "https://evil.example", `{"refresh_token":"r"}`, 403},
		{"missing token", webOrigin, `{}`, 400},
		{"bad json", webOrigin, `{`, 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gf.form = nil
			res, _ := h.Handle(context.Background(), post("/auth/refresh", c.origin, c.body))
			if res.StatusCode != c.want {
				t.Fatalf("got %d want %d", res.StatusCode, c.want)
			}
			if gf.form != nil {
				t.Fatal("GitHub was called for a refused request")
			}
		})
	}
}

func TestRefreshGitHubFailureLeaksNothing(t *testing.T) {
	gf := &fakeGitHub{fail: true}
	gh := gf.server()
	defer gh.Close()
	res, _ := authHandler(gh).Handle(context.Background(), post("/auth/refresh", webOrigin, `{"refresh_token":"secretrefresh"}`))
	if res.StatusCode != 400 {
		t.Fatalf("got %d", res.StatusCode)
	}
	for _, leak := range []string{"secretrefresh", "s3cret", "bad_verification_code"} {
		if strings.Contains(res.Body, leak) {
			t.Fatalf("response leaks %q", leak)
		}
	}
}

func TestRefreshUpstreamUnavailable(t *testing.T) {
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream unavailable", http.StatusServiceUnavailable)
	}))
	defer gh.Close()
	res, _ := authHandler(gh).Handle(context.Background(), post("/auth/refresh", webOrigin, `{"refresh_token":"rt1"}`))
	if res.StatusCode != http.StatusBadGateway {
		t.Fatalf("got %d, want %d", res.StatusCode, http.StatusBadGateway)
	}
}

func TestRefreshPreflight(t *testing.T) {
	gh := (&fakeGitHub{}).server()
	defer gh.Close()
	r := req("OPTIONS", "/auth/refresh")
	r.Headers = map[string]string{"origin": extOrigin}
	res, _ := authHandler(gh).Handle(context.Background(), r)
	if res.StatusCode != 204 || res.Headers["access-control-allow-origin"] != extOrigin {
		t.Fatalf("preflight %d %v", res.StatusCode, res.Headers)
	}
}
