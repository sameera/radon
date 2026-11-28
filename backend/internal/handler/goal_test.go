package handler

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"reflect"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	"github.com/raiden/raiden/backend/internal/store"
)

// Story #103: the goal write saves or clears one sprint's goal (D1, D3, D4, D7).

func goalReq(origin, token, body string) events.APIGatewayV2HTTPRequest {
	r := syncReq(origin, token, body)
	r.RawPath = "/grooming/goal"
	return r
}

func goalBody(sprint, text string) string {
	b, _ := json.Marshal(map[string]string{"owner": "acme", "name": "widgets", "sprint": sprint, "text": text})
	return string(b)
}

// seeded is a repository partition with two synced sprints, a milestone and one goal, and a
// second repository's partition, so a test can prove nothing else changed.
func seeded() *memStore {
	s := newMemStore()
	s.parts["repo#7"] = map[string]store.Item{
		"sprint#F#a1":      {SK: "sprint#F#a1", Attrs: map[string]string{"origin": "github", "field": "F", "iteration": "a1", "name": "Sprint 1", "start": "2026-11-02", "end": "2026-11-15"}},
		"sprint#F#a2":      {SK: "sprint#F#a2", Attrs: map[string]string{"origin": "github", "field": "F", "iteration": "a2", "name": "Sprint 2", "start": "2026-11-16", "end": "2026-11-29"}},
		"milestone#M_1":    {SK: "milestone#M_1", Attrs: map[string]string{"origin": "github", "number": "1", "title": "v1", "state": "OPEN"}},
		"goal#sprint#F#a2": {SK: "goal#sprint#F#a2", Attrs: map[string]string{"text": "Other goal"}},
		"source":           {SK: "source", Attrs: map[string]string{"origin": "github", "project": "P", "field": "F"}},
	}
	s.parts["repo#8"] = map[string]store.Item{
		"goal#sprint#F#a1": {SK: "goal#sprint#F#a1", Attrs: map[string]string{"text": "Another repository"}},
	}
	return s
}

func snapshot(s *memStore) map[string]map[string]store.Item {
	out := map[string]map[string]store.Item{}
	for pk, part := range s.parts {
		out[pk] = map[string]store.Item{}
		for sk, it := range part {
			attrs := map[string]string{}
			for k, v := range it.Attrs {
				attrs[k] = v
			}
			out[pk][sk] = store.Item{SK: it.SK, Attrs: attrs}
		}
	}
	return out
}

func goalOf(s *memStore, sprint string) (string, bool) {
	it, ok := s.parts["repo#7"]["goal#sprint#"+sprint]
	return it.Attrs["text"], ok
}

// G24: the goal write refuses an unknown origin, a missing origin or a missing token before it
// reads Raiden's records or calls GitHub.
func TestGoalRefusesBeforeReading(t *testing.T) {
	cases := []struct {
		name, origin, token string
		want                int
	}{
		{"no origin", "", secretToken, 403},
		{"other origin", "https://evil.example", secretToken, 403},
		{"no token", webOrigin, "", 401},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			g := &graphGitHub{databaseID: 7, permission: "ADMIN"}
			s := seeded()
			s.calls = 0
			res, _ := runSync(t, syncHandler(t, g, s), goalReq(c.origin, c.token, goalBody("F#a1", "Ship it")))
			if res.StatusCode != c.want {
				t.Fatalf("status %d, want %d", res.StatusCode, c.want)
			}
			if s.calls != 0 || len(g.queries) != 0 {
				t.Fatalf("store calls %d, GitHub calls %d; want none", s.calls, len(g.queries))
			}
		})
	}
}

func TestGoalPreflightAllowsTokenHeader(t *testing.T) {
	r := goalReq(webOrigin, "", "")
	r.RequestContext.HTTP.Method = "OPTIONS"
	res, _ := runSync(t, syncHandler(t, &graphGitHub{}, newMemStore()), r)
	if res.StatusCode != 204 || res.Headers["access-control-allow-origin"] != webOrigin ||
		!strings.Contains(res.Headers["access-control-allow-headers"], "authorization") {
		t.Fatalf("preflight %d %v", res.StatusCode, res.Headers)
	}
}

func TestGoalIsOffWithoutConfig(t *testing.T) {
	res, _ := runSync(t, &Handler{DB: fakeDB{}}, goalReq(webOrigin, secretToken, goalBody("F#a1", "x")))
	if res.StatusCode != 404 {
		t.Fatalf("status %d, want 404", res.StatusCode)
	}
}

// AC1, AC3, G1, G3, D1: a goal editor's save writes the goal, an edit replaces it, and the sprint
// keeps one goal record.
func TestGoalSaveAndEdit(t *testing.T) {
	for _, role := range []string{"ADMIN", "MAINTAIN"} {
		t.Run(role, func(t *testing.T) {
			g := &graphGitHub{databaseID: 7, permission: role}
			s := seeded()
			h := syncHandler(t, g, s)
			res, _ := runSync(t, h, goalReq(webOrigin, secretToken, goalBody("F#a1", "  Ship the pilot  ")))
			if res.StatusCode != 200 {
				t.Fatalf("status %d body %s", res.StatusCode, res.Body)
			}
			if text, ok := goalOf(s, "F#a1"); !ok || text != "Ship the pilot" {
				t.Fatalf("goal %q %v", text, ok)
			}
			res, _ = runSync(t, h, goalReq(webOrigin, secretToken, goalBody("F#a1", "Ship the pilot to two teams")))
			if res.StatusCode != 200 {
				t.Fatalf("edit status %d", res.StatusCode)
			}
			n := 0
			for sk := range s.parts["repo#7"] {
				if strings.HasPrefix(sk, "goal#sprint#F#a1") {
					n++
				}
			}
			if text, _ := goalOf(s, "F#a1"); n != 1 || text != "Ship the pilot to two teams" {
				t.Fatalf("goal records %d, text %q", n, text)
			}
			if s.parts["repo#7"]["goal#sprint#F#a1"].Attrs["text"] == "" || len(s.parts["repo#7"]["goal#sprint#F#a1"].Attrs) != 1 {
				t.Fatalf("a goal holds only its text: %v", s.parts["repo#7"]["goal#sprint#F#a1"].Attrs)
			}
		})
	}
}

// G5, D1: saving empty text deletes the goal record.
func TestGoalClearDeletesRecord(t *testing.T) {
	g := &graphGitHub{databaseID: 7, permission: "ADMIN"}
	s := seeded()
	res, _ := runSync(t, syncHandler(t, g, s), goalReq(webOrigin, secretToken, goalBody("F#a2", "   ")))
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	if _, ok := goalOf(s, "F#a2"); ok {
		t.Fatal("the cleared goal is still stored")
	}
}

// G13, G14: a caller below maintain, or one GitHub refuses, is refused and nothing is read or
// written in Raiden's store.
func TestGoalRefusesNonEditors(t *testing.T) {
	cases := []struct {
		name string
		g    *graphGitHub
		want int
	}{
		{"write role", &graphGitHub{databaseID: 7, permission: "WRITE"}, 403},
		{"triage role", &graphGitHub{databaseID: 7, permission: "TRIAGE"}, 403},
		{"read role", &graphGitHub{databaseID: 7, permission: "READ"}, 403},
		{"no role", &graphGitHub{databaseID: 7}, 403},
		{"cannot read", &graphGitHub{missingRepo: true}, 403},
		{"rejected token", &graphGitHub{reject: true}, 401},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := seeded()
			before := snapshot(s)
			s.calls = 0
			res, _ := runSync(t, syncHandler(t, c.g, s), goalReq(webOrigin, secretToken, goalBody("F#a1", "Ship it")))
			if res.StatusCode != c.want {
				t.Fatalf("status %d, want %d", res.StatusCode, c.want)
			}
			if s.calls != 0 || !reflect.DeepEqual(before, snapshot(s)) {
				t.Fatalf("store touched: %d calls", s.calls)
			}
		})
	}
}

// G16, D4: a sprint that is not among the repository's sprint records is refused.
func TestGoalRefusesUnknownSprint(t *testing.T) {
	for _, sprint := range []string{"F#zz", "", "M_1"} {
		t.Run(sprint, func(t *testing.T) {
			s := seeded()
			before := snapshot(s)
			res, a := runSync(t, syncHandler(t, &graphGitHub{databaseID: 7, permission: "ADMIN"}, s), goalReq(webOrigin, secretToken, goalBody(sprint, "Ship it")))
			if res.StatusCode != 409 && res.StatusCode != 400 {
				t.Fatalf("status %d", res.StatusCode)
			}
			if sprint == "F#zz" && a.Error != "unknown-sprint" {
				t.Fatalf("error %q", a.Error)
			}
			if !reflect.DeepEqual(before, snapshot(s)) {
				t.Fatal("store changed")
			}
		})
	}
}

// G7, G8, D7: the backend refuses a goal over 200 characters or with a line break, and keeps
// markup as plain text.
func TestGoalCapAndPlainText(t *testing.T) {
	g := &graphGitHub{databaseID: 7, permission: "ADMIN"}
	s := seeded()
	h := syncHandler(t, g, s)
	for _, bad := range []string{strings.Repeat("a", 201), strings.Repeat("é", 201), "two\nlines"} {
		before := snapshot(s)
		res, _ := runSync(t, h, goalReq(webOrigin, secretToken, goalBody("F#a1", bad)))
		if res.StatusCode != 400 || !reflect.DeepEqual(before, snapshot(s)) {
			t.Fatalf("%q: status %d", bad, res.StatusCode)
		}
	}
	full := strings.Repeat("é", 200)
	if res, _ := runSync(t, h, goalReq(webOrigin, secretToken, goalBody("F#a1", full))); res.StatusCode != 200 {
		t.Fatalf("200 characters refused: %d", res.StatusCode)
	}
	markup := `<b>Ship</b> & <script>x()</script>`
	runSync(t, h, goalReq(webOrigin, secretToken, goalBody("F#a1", markup)))
	if text, _ := goalOf(s, "F#a1"); text != markup {
		t.Fatalf("goal %q", text)
	}
}

// G15, G17: a goal save changes only that sprint's goal record, reads GitHub only with the
// caller's token, and never writes to GitHub.
func TestGoalTouchesOneRecord(t *testing.T) {
	var logs bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug})))
	t.Cleanup(func() { slog.SetDefault(prev) })
	g := &graphGitHub{databaseID: 7, permission: "MAINTAIN"}
	s := seeded()
	before := snapshot(s)
	res, _ := runSync(t, syncHandler(t, g, s), goalReq(webOrigin, secretToken, goalBody("F#a1", "Ship it")))
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	after := snapshot(s)
	delete(after["repo#7"], "goal#sprint#F#a1")
	if !reflect.DeepEqual(before, after) {
		t.Fatalf("other records changed:\n%v\n%v", before, after)
	}
	if len(g.queries) == 0 {
		t.Fatal("GitHub was not asked for the caller's role")
	}
	for i, q := range g.queries {
		if !strings.HasPrefix(q, "query ") || strings.Contains(q, "mutation") || g.methods[i] != "POST" || g.paths[i] != "/graphql" || g.auths[i] != "Bearer "+secretToken {
			t.Fatalf("call %d: %s %s %q %q", i, g.methods[i], g.paths[i], g.auths[i], q)
		}
	}
	stored, _ := json.Marshal(s.parts)
	for name, text := range map[string]string{"response": res.Body, "logs": logs.String(), "store": string(stored)} {
		if strings.Contains(text, secretToken) {
			t.Fatalf("token found in %s", name)
		}
	}
}

// AC2, AC4, G2, G4, D2, D3: the sync answer carries the saved goals and says whether the caller
// may edit them.
func TestSyncReturnsGoalsAndMayEdit(t *testing.T) {
	g := &graphGitHub{databaseID: 7, permission: "MAINTAIN", projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if res, _ := runSync(t, h, goalReq(webOrigin, secretToken, `{"owner":"acme","name":"widgets","sprint":"F_first#a1","text":"Ship it"}`)); res.StatusCode != 200 {
		t.Fatalf("save %d %s", res.StatusCode, res.Body)
	}
	_, a := runSync(t, h, syncReq(extOrigin, "another_token", widgets))
	if !a.MayEdit || len(a.Goals) != 1 || a.Goals[0].Sprint != "F_first#a1" || a.Goals[0].Text != "Ship it" {
		t.Fatalf("answer goals %+v mayEdit %v", a.Goals, a.MayEdit)
	}
	g.permission = "WRITE"
	_, b := runSync(t, h, syncReq(webOrigin, "reader_token", widgets))
	if b.MayEdit || len(b.Goals) != 1 || b.Goals[0].Text != "Ship it" {
		t.Fatalf("reader answer goals %+v mayEdit %v", b.Goals, b.MayEdit)
	}
}

// G26: a sync never creates, changes or deletes a goal, even when its sprint goes away.
func TestSyncLeavesGoalsAlone(t *testing.T) {
	g := &graphGitHub{databaseID: 7, permission: "ADMIN", projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	s.parts["repo#7"]["goal#sprint#F_first#a1"] = store.Item{SK: "goal#sprint#F_first#a1", Attrs: map[string]string{"text": "Ship it"}}
	g.projects[2].Fields[1].Completed = nil
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if it, ok := s.parts["repo#7"]["goal#sprint#F_first#a1"]; !ok || it.Attrs["text"] != "Ship it" || len(it.Attrs) != 1 {
		t.Fatalf("goal record %v %v", it, ok)
	}
}
