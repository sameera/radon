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

// Story #114: the move write saves one issue's sprint assignment (D1, D2, D3).

func moveReq(origin, token, body string) events.APIGatewayV2HTTPRequest {
	r := syncReq(origin, token, body)
	r.RawPath = "/grooming/move"
	return r
}

// moveBody names the target sprint, or the no-sprint mark when sprint is nil.
func moveBody(issue string, sprint *string) string {
	b, _ := json.Marshal(map[string]any{"owner": "acme", "name": "widgets", "issue": issue, "sprint": sprint})
	return string(b)
}

func sp(id string) *string { return &id }

// moveGitHub is GitHub for repository 7, where I_1 and I_2 live; I_9 lives in repository 8.
func moveGitHub(role string) *graphGitHub {
	return &graphGitHub{databaseID: 7, permission: role, issueRepos: map[string]int{"I_1": 7, "I_2": 7, "I_9": 8}}
}

func assignmentOf(s *memStore, issue string) (store.Item, bool) {
	it, ok := s.parts["repo#7"]["assign#"+issue]
	return it, ok
}

// G33: the move write refuses an unknown origin, a missing origin or a missing token before it
// reads Raiden's records or calls GitHub.
func TestMoveRefusesBeforeReading(t *testing.T) {
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
			g := moveGitHub("ADMIN")
			s := seeded()
			s.calls = 0
			res, _ := runSync(t, syncHandler(t, g, s), moveReq(c.origin, c.token, moveBody("I_1", sp("F#a1"))))
			if res.StatusCode != c.want {
				t.Fatalf("status %d, want %d", res.StatusCode, c.want)
			}
			if s.calls != 0 || len(g.queries) != 0 {
				t.Fatalf("store calls %d, GitHub calls %d; want none", s.calls, len(g.queries))
			}
		})
	}
}

func TestMovePreflightAllowsTokenHeader(t *testing.T) {
	r := moveReq(webOrigin, "", "")
	r.RequestContext.HTTP.Method = "OPTIONS"
	res, _ := runSync(t, syncHandler(t, &graphGitHub{}, newMemStore()), r)
	if res.StatusCode != 204 || res.Headers["access-control-allow-origin"] != webOrigin ||
		!strings.Contains(res.Headers["access-control-allow-headers"], "authorization") {
		t.Fatalf("preflight %d %v", res.StatusCode, res.Headers)
	}
}

func TestMoveIsOffWithoutConfig(t *testing.T) {
	res, _ := runSync(t, &Handler{DB: fakeDB{}}, moveReq(webOrigin, secretToken, moveBody("I_1", sp("F#a1"))))
	if res.StatusCode != 404 {
		t.Fatalf("status %d, want 404", res.StatusCode)
	}
}

// AC1, AC2, G1, G2, D1: an editor's move writes one record per issue, holding the sprint or the
// no-sprint mark, and a later move overwrites it.
func TestMoveSavesOneRecordPerIssue(t *testing.T) {
	for _, role := range []string{"ADMIN", "MAINTAIN"} {
		t.Run(role, func(t *testing.T) {
			s := seeded()
			h := syncHandler(t, moveGitHub(role), s)
			res, _ := runSync(t, h, moveReq(webOrigin, secretToken, moveBody("I_1", sp("F#a1"))))
			if res.StatusCode != 200 {
				t.Fatalf("status %d body %s", res.StatusCode, res.Body)
			}
			if it, ok := assignmentOf(s, "I_1"); !ok || !reflect.DeepEqual(it.Attrs, map[string]string{"sprint": "F#a1"}) {
				t.Fatalf("record %v %v", it, ok)
			}
			if res, _ = runSync(t, h, moveReq(webOrigin, secretToken, moveBody("I_1", nil))); res.StatusCode != 200 {
				t.Fatalf("no-sprint status %d body %s", res.StatusCode, res.Body)
			}
			if it, ok := assignmentOf(s, "I_1"); !ok || !reflect.DeepEqual(it.Attrs, map[string]string{"none": "true"}) {
				t.Fatalf("no-sprint record %v %v", it, ok)
			}
			if res, _ = runSync(t, h, moveReq(webOrigin, secretToken, moveBody("I_1", sp("F#a2")))); res.StatusCode != 200 {
				t.Fatalf("status %d", res.StatusCode)
			}
			n := 0
			for sk := range s.parts["repo#7"] {
				if strings.HasPrefix(sk, "assign#") {
					n++
				}
			}
			if it, _ := assignmentOf(s, "I_1"); n != 1 || it.Attrs["sprint"] != "F#a2" {
				t.Fatalf("records %d, last %v", n, it)
			}
		})
	}
}

// A request without an issue, a sprint field, or a well-formed repository is refused unread.
func TestMoveRefusesBadRequests(t *testing.T) {
	for _, body := range []string{
		`{"owner":"acme","name":"widgets","issue":"I_1"}`,
		`{"owner":"acme","name":"widgets","sprint":"F#a1"}`,
		`{"owner":"acme","name":"widgets","issue":"","sprint":"F#a1"}`,
		`{"owner":"acme","name":"widgets","issue":"I_1","sprint":""}`,
		`{"owner":"..","name":"widgets","issue":"I_1","sprint":"F#a1"}`,
		`not json`,
	} {
		g := moveGitHub("ADMIN")
		s := seeded()
		s.calls = 0
		res, _ := runSync(t, syncHandler(t, g, s), moveReq(webOrigin, secretToken, body))
		if res.StatusCode != 400 || s.calls != 0 || len(g.queries) != 0 {
			t.Fatalf("%s: status %d, store %d, GitHub %d", body, res.StatusCode, s.calls, len(g.queries))
		}
	}
}

// G24, G25, G26: a caller below maintain, or one GitHub refuses, is refused, and Raiden's store
// is neither read nor written.
func TestMoveRefusesNonEditors(t *testing.T) {
	cases := []struct {
		name string
		g    *graphGitHub
		want int
	}{
		{"write role", moveGitHub("WRITE"), 403},
		{"triage role", moveGitHub("TRIAGE"), 403},
		{"read role", moveGitHub("READ"), 403},
		{"no role", moveGitHub(""), 403},
		{"cannot read", &graphGitHub{missingRepo: true}, 403},
		{"rejected token", &graphGitHub{reject: true}, 401},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := seeded()
			before := snapshot(s)
			s.calls = 0
			res, a := runSync(t, syncHandler(t, c.g, s), moveReq(webOrigin, secretToken, moveBody("I_1", sp("F#a1"))))
			if res.StatusCode != c.want {
				t.Fatalf("status %d, want %d", res.StatusCode, c.want)
			}
			if c.name == "write role" && a.Error != "not-editor" {
				t.Fatalf("error %q", a.Error)
			}
			if s.calls != 0 || !reflect.DeepEqual(before, snapshot(s)) {
				t.Fatalf("store touched: %d calls", s.calls)
			}
		})
	}
}

// G27: an issue outside the named repository, or one the caller cannot see, is refused.
func TestMoveRefusesForeignIssue(t *testing.T) {
	for _, issue := range []string{"I_9", "I_404"} {
		t.Run(issue, func(t *testing.T) {
			s := seeded()
			before := snapshot(s)
			res, a := runSync(t, syncHandler(t, moveGitHub("ADMIN"), s), moveReq(webOrigin, secretToken, moveBody(issue, sp("F#a1"))))
			if res.StatusCode != 409 || a.Error != "unknown-issue" {
				t.Fatalf("status %d error %q", res.StatusCode, a.Error)
			}
			if !reflect.DeepEqual(before, snapshot(s)) {
				t.Fatal("store changed")
			}
		})
	}
}

// G27: a target that is neither the no-sprint mark nor a sprint record of the repository is
// refused; a milestone or another repository's sprint is not a sprint here.
func TestMoveRefusesUnknownSprint(t *testing.T) {
	for _, sprint := range []string{"F#zz", "M_1", "milestone#M_1"} {
		t.Run(sprint, func(t *testing.T) {
			s := seeded()
			s.parts["repo#8"]["sprint#F#zz"] = store.Item{SK: "sprint#F#zz", Attrs: map[string]string{"origin": "github"}}
			before := snapshot(s)
			res, a := runSync(t, syncHandler(t, moveGitHub("ADMIN"), s), moveReq(webOrigin, secretToken, moveBody("I_1", sp(sprint))))
			if res.StatusCode != 409 || a.Error != "unknown-sprint" {
				t.Fatalf("status %d error %q", res.StatusCode, a.Error)
			}
			if !reflect.DeepEqual(before, snapshot(s)) {
				t.Fatal("store changed")
			}
		})
	}
}

// G28, G30, G33: a move changes only that issue's record, reads GitHub only with the caller's
// token, never writes to GitHub, and never stores, logs or returns the token.
func TestMoveTouchesOneRecord(t *testing.T) {
	var logs bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug})))
	t.Cleanup(func() { slog.SetDefault(prev) })
	g := moveGitHub("MAINTAIN")
	s := seeded()
	s.parts["repo#7"]["assign#I_2"] = store.Item{SK: "assign#I_2", Attrs: map[string]string{"sprint": "F#a2"}}
	before := snapshot(s)
	res, _ := runSync(t, syncHandler(t, g, s), moveReq(webOrigin, secretToken, moveBody("I_1", sp("F#a1"))))
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	after := snapshot(s)
	delete(after["repo#7"], "assign#I_1")
	if !reflect.DeepEqual(before, after) {
		t.Fatalf("other records changed:\n%v\n%v", before, after)
	}
	if len(g.queries) != 1 {
		t.Fatalf("GitHub calls %d, want one check", len(g.queries))
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

// D3, G8: the sync answer carries every assignment record of the repository, to every reader.
func TestSyncReturnsAssignments(t *testing.T) {
	g := &graphGitHub{databaseID: 7, permission: "MAINTAIN", projects: twoProjects(), issueRepos: map[string]int{"I_1": 7, "I_2": 7}}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if res, _ := runSync(t, h, moveReq(webOrigin, secretToken, `{"owner":"acme","name":"widgets","issue":"I_1","sprint":"F_first#a1"}`)); res.StatusCode != 200 {
		t.Fatalf("move %d %s", res.StatusCode, res.Body)
	}
	if res, _ := runSync(t, h, moveReq(webOrigin, secretToken, `{"owner":"acme","name":"widgets","issue":"I_2","sprint":null}`)); res.StatusCode != 200 {
		t.Fatalf("move %d %s", res.StatusCode, res.Body)
	}
	g.permission = "READ"
	_, a := runSync(t, h, syncReq(extOrigin, "reader_token", widgets))
	if len(a.Assignments) != 2 || a.Assignments[0].Issue != "I_1" || a.Assignments[0].Sprint == nil || *a.Assignments[0].Sprint != "F_first#a1" ||
		a.Assignments[1].Issue != "I_2" || a.Assignments[1].Sprint != nil {
		t.Fatalf("assignments %+v", a.Assignments)
	}
	if a.MayEdit {
		t.Fatal("a reader may not edit")
	}
}

// G31: a sync never creates, changes or deletes an assignment, even when its sprint goes away.
func TestSyncLeavesAssignmentsAlone(t *testing.T) {
	g := &graphGitHub{databaseID: 7, permission: "ADMIN", projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	s.parts["repo#7"]["assign#I_1"] = store.Item{SK: "assign#I_1", Attrs: map[string]string{"sprint": "F_first#a1"}}
	s.parts["repo#7"]["assign#I_2"] = store.Item{SK: "assign#I_2", Attrs: map[string]string{"none": "true"}}
	before := snapshot(s)
	g.projects[2].Fields[1].Completed = nil
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	after := snapshot(s)
	for _, sk := range []string{"assign#I_1", "assign#I_2"} {
		if !reflect.DeepEqual(before["repo#7"][sk], after["repo#7"][sk]) {
			t.Fatalf("%s changed: %v -> %v", sk, before["repo#7"][sk], after["repo#7"][sk])
		}
	}
}
