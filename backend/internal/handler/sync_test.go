package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	"github.com/raiden/raiden/backend/internal/store"
)

const secretToken = "ghu_lead_token_secret"

// memStore is Raiden's table in memory. It counts every call, so a test can prove the store was
// never reached.
type memStore struct {
	parts map[string]map[string]store.Item
	calls int
	fail  bool
}

func newMemStore() *memStore { return &memStore{parts: map[string]map[string]store.Item{}} }

func (m *memStore) Query(_ context.Context, pk string) ([]store.Item, error) {
	m.calls++
	if m.fail {
		return nil, context.DeadlineExceeded
	}
	var out []store.Item
	for _, it := range m.parts[pk] {
		out = append(out, it)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].SK < out[j].SK })
	return out, nil
}

func (m *memStore) Put(_ context.Context, pk string, it store.Item) error {
	m.calls++
	if m.parts[pk] == nil {
		m.parts[pk] = map[string]store.Item{}
	}
	m.parts[pk][it.SK] = it
	return nil
}

func (m *memStore) Delete(_ context.Context, pk, sk string) error {
	m.calls++
	delete(m.parts[pk], sk)
	return nil
}

type fakeIteration struct {
	ID, Title, Start string
	Duration         int
}

type fakeField struct {
	ID, Created string
	Iterations  []fakeIteration
	Completed   []fakeIteration
}

type fakeProject struct {
	ID, Created string
	Fields      []fakeField
}

type fakeMilestone struct {
	ID, Title, Due, Description, State string
	Number                             int
}

// graphGitHub plays GitHub's GraphQL endpoint for the sync.
type graphGitHub struct {
	databaseID int
	// The caller's role on the repository, as GraphQL's viewerPermission names it.
	permission  string
	missingRepo bool
	reject      bool
	rateLimited bool
	projects    []fakeProject
	// Projects the caller cannot read by identity.
	unreadable map[string]bool
	milestones []fakeMilestone
	// Milestones per page; 0 means all on one page.
	milestonePage int
	queries       []string
	auths         []string
	methods       []string
	paths         []string
}

func iterJSON(list []fakeIteration) []map[string]any {
	out := []map[string]any{}
	for _, it := range list {
		out = append(out, map[string]any{"id": it.ID, "title": it.Title, "startDate": it.Start, "duration": it.Duration})
	}
	return out
}

func (g *graphGitHub) server(t *testing.T) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		g.methods = append(g.methods, r.Method)
		g.paths = append(g.paths, r.URL.Path)
		g.auths = append(g.auths, r.Header.Get("authorization"))
		var in struct {
			Query     string         `json:"query"`
			Variables map[string]any `json:"variables"`
		}
		_ = json.NewDecoder(r.Body).Decode(&in)
		g.queries = append(g.queries, in.Query)
		w.Header().Set("content-type", "application/json")
		if g.reject {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"message":"Bad credentials"}`))
			return
		}
		if g.rateLimited {
			w.Header().Set("x-ratelimit-remaining", "0")
			w.WriteHeader(http.StatusForbidden)
			return
		}
		write := func(v any) { _ = json.NewEncoder(w).Encode(v) }
		switch {
		case strings.HasPrefix(in.Query, "query GoalRepo"):
			if g.missingRepo {
				write(map[string]any{"data": map[string]any{"repository": nil},
					"errors": []any{map[string]any{"type": "NOT_FOUND", "path": []any{"repository"}}}})
				return
			}
			write(map[string]any{"data": map[string]any{"repository": map[string]any{
				"databaseId": g.databaseID, "viewerPermission": g.permission,
			}}})
		case strings.HasPrefix(in.Query, "query Repo"):
			if g.missingRepo {
				write(map[string]any{"data": map[string]any{"repository": nil},
					"errors": []any{map[string]any{"type": "NOT_FOUND", "path": []any{"repository"}}}})
				return
			}
			projects := []any{}
			for _, p := range g.projects {
				fields := []any{}
				for _, f := range p.Fields {
					fields = append(fields, map[string]any{"id": f.ID, "createdAt": f.Created})
				}
				// A non-iteration field comes back as an empty object.
				fields = append(fields, map[string]any{})
				projects = append(projects, map[string]any{"id": p.ID, "createdAt": p.Created, "fields": map[string]any{"nodes": fields}})
			}
			write(map[string]any{"data": map[string]any{"repository": map[string]any{
				"databaseId":       g.databaseID,
				"viewerPermission": g.permission,
				"projectsV2":       map[string]any{"nodes": projects},
			}}})
		case strings.HasPrefix(in.Query, "query Milestones"):
			nodes := []any{}
			start := 0
			if c, ok := in.Variables["cursor"].(string); ok {
				start, _ = strconv.Atoi(c)
			}
			end := len(g.milestones)
			if g.milestonePage > 0 && start+g.milestonePage < end {
				end = start + g.milestonePage
			}
			var next any
			if end < len(g.milestones) {
				next = strconv.Itoa(end)
			}
			for _, m := range g.milestones[start:end] {
				var due any
				if m.Due != "" {
					due = m.Due
				}
				nodes = append(nodes, map[string]any{"id": m.ID, "number": m.Number, "title": m.Title, "dueOn": due,
					"description": m.Description, "state": m.State})
			}
			write(map[string]any{"data": map[string]any{"repository": map[string]any{"milestones": map[string]any{
				"pageInfo": map[string]any{"hasNextPage": next != nil, "endCursor": next}, "nodes": nodes,
			}}}})
		case strings.HasPrefix(in.Query, "query Source"):
			id, _ := in.Variables["id"].(string)
			if g.unreadable[id] {
				write(map[string]any{"data": map[string]any{"node": nil},
					"errors": []any{map[string]any{"type": "NOT_FOUND", "path": []any{"node"}}}})
				return
			}
			write(map[string]any{"data": map[string]any{"node": map[string]any{"id": id}}})
		case strings.HasPrefix(in.Query, "query Iterations"):
			id, _ := in.Variables["id"].(string)
			for _, p := range g.projects {
				for _, f := range p.Fields {
					if f.ID == id {
						write(map[string]any{"data": map[string]any{"node": map[string]any{"id": f.ID, "configuration": map[string]any{
							"iterations": iterJSON(f.Iterations), "completedIterations": iterJSON(f.Completed),
						}}}})
						return
					}
				}
			}
			write(map[string]any{"data": map[string]any{"node": nil}})
		default:
			t.Errorf("unexpected query %q", in.Query)
			w.WriteHeader(http.StatusBadRequest)
		}
	}))
}

func syncHandler(t *testing.T, g *graphGitHub, s *memStore) *Handler {
	srv := g.server(t)
	t.Cleanup(srv.Close)
	return &Handler{
		DB:    fakeDB{},
		Store: s,
		Auth: &AuthConfig{
			AllowedOrigins: []string{webOrigin, extOrigin},
			APIURL:         srv.URL,
			HTTP:           srv.Client(),
		},
	}
}

func syncReq(origin, token, body string) events.APIGatewayV2HTTPRequest {
	r := events.APIGatewayV2HTTPRequest{RawPath: "/grooming/sync", Body: body, Headers: map[string]string{}}
	r.RequestContext.HTTP.Method = "POST"
	if origin != "" {
		r.Headers["origin"] = origin
	}
	if token != "" {
		r.Headers["authorization"] = "Bearer " + token
	}
	return r
}

const widgets = `{"owner":"acme","name":"widgets"}`

type syncAnswer struct {
	Repository int `json:"repository"`
	Source     *struct {
		Project string `json:"project"`
		Field   string `json:"field"`
	} `json:"source"`
	Sprints []struct {
		ID        string `json:"id"`
		Field     string `json:"field"`
		Iteration string `json:"iteration"`
		Name      string `json:"name"`
		Start     string `json:"start"`
		End       string `json:"end"`
		Origin    string `json:"origin"`
	} `json:"sprints"`
	Milestones []struct {
		ID          string `json:"id"`
		Number      int    `json:"number"`
		Title       string `json:"title"`
		Due         string `json:"due"`
		Description string `json:"description"`
		State       string `json:"state"`
		Origin      string `json:"origin"`
	} `json:"milestones"`
	Goals []struct {
		Sprint string `json:"sprint"`
		Text   string `json:"text"`
	} `json:"goals"`
	MayEdit bool   `json:"mayEdit"`
	Error   string `json:"error"`
}

func runSync(t *testing.T, h *Handler, r events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, syncAnswer) {
	t.Helper()
	res, err := h.Handle(context.Background(), r)
	if err != nil {
		t.Fatal(err)
	}
	var a syncAnswer
	_ = json.Unmarshal([]byte(res.Body), &a)
	return res, a
}

func twoProjects() []fakeProject {
	return []fakeProject{
		{ID: "PVT_late", Created: "2025-06-01T00:00:00Z", Fields: []fakeField{{ID: "F_late", Created: "2025-06-01T00:00:00Z",
			Iterations: []fakeIteration{{ID: "x1", Title: "Wrong", Start: "2026-01-01", Duration: 14}}}}},
		{ID: "PVT_none", Created: "2024-01-01T00:00:00Z"},
		{ID: "PVT_early", Created: "2025-01-01T00:00:00Z", Fields: []fakeField{
			{ID: "F_second", Created: "2025-03-01T00:00:00Z", Iterations: []fakeIteration{{ID: "y1", Title: "Wrong too", Start: "2026-01-01", Duration: 7}}},
			{ID: "F_first", Created: "2025-02-01T00:00:00Z",
				Iterations: []fakeIteration{{ID: "a2", Title: "Sprint 2", Start: "2026-11-16", Duration: 14}, {ID: "a3", Title: "Sprint 3", Start: "2026-11-30", Duration: 14}},
				Completed:  []fakeIteration{{ID: "a1", Title: "Sprint 1", Start: "2026-11-02", Duration: 14}}},
		}},
	}
}

// G3: the backend refuses an unknown origin, a missing origin, or a missing token before it reads
// Raiden's records or calls GitHub.
func TestSyncRefusesBeforeReading(t *testing.T) {
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
			g := &graphGitHub{databaseID: 7, projects: twoProjects()}
			s := newMemStore()
			res, _ := runSync(t, syncHandler(t, g, s), syncReq(c.origin, c.token, widgets))
			if res.StatusCode != c.want {
				t.Fatalf("status %d, want %d", res.StatusCode, c.want)
			}
			if s.calls != 0 || len(g.queries) != 0 {
				t.Fatalf("store calls %d, GitHub calls %d; want none", s.calls, len(g.queries))
			}
		})
	}
}

// R3, D13: the preflight from a configured origin allows the token header.
func TestSyncPreflightAllowsTokenHeader(t *testing.T) {
	h := syncHandler(t, &graphGitHub{}, newMemStore())
	r := syncReq(extOrigin, "", "")
	r.RequestContext.HTTP.Method = "OPTIONS"
	res, _ := runSync(t, h, r)
	if res.StatusCode != 204 || res.Headers["access-control-allow-origin"] != extOrigin {
		t.Fatalf("preflight %d %v", res.StatusCode, res.Headers)
	}
	if !strings.Contains(res.Headers["access-control-allow-headers"], "authorization") {
		t.Fatalf("allow-headers %q lacks authorization", res.Headers["access-control-allow-headers"])
	}
}

func TestSyncIsOffWithoutConfig(t *testing.T) {
	h := &Handler{DB: fakeDB{}}
	res, _ := runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 404 {
		t.Fatalf("status %d, want 404", res.StatusCode)
	}
}

func TestSyncRejectsBadRepositoryName(t *testing.T) {
	g := &graphGitHub{databaseID: 7}
	s := newMemStore()
	res, _ := runSync(t, syncHandler(t, g, s), syncReq(webOrigin, secretToken, `{"owner":"acme","name":"../x"}`))
	if res.StatusCode != 400 || s.calls != 0 || len(g.queries) != 0 {
		t.Fatalf("status %d, store %d, GitHub %d", res.StatusCode, s.calls, len(g.queries))
	}
}

// G4: GitHub refuses the caller for the repository, so no record is read or written.
func TestSyncCannotReadRepository(t *testing.T) {
	g := &graphGitHub{missingRepo: true}
	s := newMemStore()
	res, a := runSync(t, syncHandler(t, g, s), syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 403 || a.Error != "cannot-read" || s.calls != 0 {
		t.Fatalf("status %d error %q store calls %d", res.StatusCode, a.Error, s.calls)
	}
}

// G6: rejected credentials come back as 401, so the client renews once and retries once.
func TestSyncRejectedToken(t *testing.T) {
	g := &graphGitHub{reject: true}
	s := newMemStore()
	res, _ := runSync(t, syncHandler(t, g, s), syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 401 || s.calls != 0 {
		t.Fatalf("status %d store calls %d", res.StatusCode, s.calls)
	}
}

func TestSyncRateLimit(t *testing.T) {
	g := &graphGitHub{rateLimited: true}
	res, a := runSync(t, syncHandler(t, g, newMemStore()), syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 429 || a.Error != "rate-limit" {
		t.Fatalf("status %d error %q", res.StatusCode, a.Error)
	}
}

// Story #85 AC1, D3, G8, G10, G13: the earliest-created linked project with an iteration field
// supplies the sprints, active and completed, with GitHub's names and dates, marked as synced.
func TestSyncHoldsOneSprintPerIteration(t *testing.T) {
	g := &graphGitHub{databaseID: 7, projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	res, a := runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 200 {
		t.Fatalf("status %d body %s", res.StatusCode, res.Body)
	}
	if a.Repository != 7 || a.Source == nil || a.Source.Project != "PVT_early" || a.Source.Field != "F_first" {
		t.Fatalf("source %+v repository %d", a.Source, a.Repository)
	}
	got := []string{}
	for _, sp := range a.Sprints {
		got = append(got, sp.Name+" "+sp.Start+".."+sp.End+" "+sp.Origin+" "+sp.Field+"/"+sp.Iteration)
	}
	want := []string{
		"Sprint 1 2026-11-02..2026-11-15 github F_first/a1",
		"Sprint 2 2026-11-16..2026-11-29 github F_first/a2",
		"Sprint 3 2026-11-30..2026-12-13 github F_first/a3",
	}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("sprints\n got %v\nwant %v", got, want)
	}
	if len(s.parts["repo#7"]) != 4 {
		t.Fatalf("partition %v", s.parts["repo#7"])
	}
	// G13: a second lead, GitHub unchanged, gets the same project, and nothing is rewritten.
	before := s.calls
	_, b := runSync(t, h, syncReq(extOrigin, "another_token", widgets))
	if b.Source == nil || b.Source.Project != "PVT_early" || len(b.Sprints) != 3 {
		t.Fatalf("second sync %+v", b)
	}
	if s.calls != before+1 {
		t.Fatalf("an unchanged sync wrote records: %d calls", s.calls-before)
	}
}

// Story #85 AC2, D4, G10, G12, G17: added, renamed, re-dated and removed iterations are matched
// after the next sync, identity is kept, and records the sync does not own are never touched.
func TestSyncFollowsGitHubChanges(t *testing.T) {
	g := &graphGitHub{databaseID: 7, projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	s.parts["repo#7"]["sprint#raiden#1"] = store.Item{SK: "sprint#raiden#1", Attrs: map[string]string{"origin": "raiden", "name": "Own", "start": "2027-01-01", "end": "2027-01-14"}}
	s.parts["repo#7"]["goal#sprint#F_first#a1"] = store.Item{SK: "goal#sprint#F_first#a1", Attrs: map[string]string{"text": "Ship it"}}
	f := &g.projects[2].Fields[1]
	f.Iterations = []fakeIteration{
		{ID: "a2", Title: "Sprint Two", Start: "2026-11-16", Duration: 14},
		{ID: "a3", Title: "Sprint 3", Start: "2026-12-01", Duration: 7},
		{ID: "a4", Title: "Sprint 4", Start: "2026-12-14", Duration: 14},
	}
	f.Completed = nil
	res, a := runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	got := []string{}
	for _, sp := range a.Sprints {
		got = append(got, sp.ID+" "+sp.Name+" "+sp.Start+".."+sp.End+" "+sp.Origin)
	}
	want := []string{
		"F_first#a2 Sprint Two 2026-11-16..2026-11-29 github",
		"F_first#a3 Sprint 3 2026-12-01..2026-12-07 github",
		"F_first#a4 Sprint 4 2026-12-14..2026-12-27 github",
		"raiden#1 Own 2027-01-01..2027-01-14 raiden",
	}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("sprints\n got %v\nwant %v", got, want)
	}
	if _, ok := s.parts["repo#7"]["goal#sprint#F_first#a1"]; !ok {
		t.Fatal("a record keyed to a deleted sprint was deleted")
	}
}

// Story #85 AC3, G15: no linked project means no synced sprints and no error.
func TestSyncNoLinkedProject(t *testing.T) {
	g := &graphGitHub{databaseID: 7}
	res, a := runSync(t, syncHandler(t, g, newMemStore()), syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 200 || a.Source != nil || len(a.Sprints) != 0 || a.Sprints == nil {
		t.Fatalf("status %d answer %+v", res.StatusCode, a)
	}
}

// G14: a lead who cannot read the recorded project deletes nothing, changes no pick, and gets the
// named cause.
func TestSyncCannotReadRecordedProject(t *testing.T) {
	g := &graphGitHub{databaseID: 7, projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	snapshot, _ := json.Marshal(s.parts)
	g.unreadable = map[string]bool{"PVT_early": true}
	g.projects = g.projects[:1]
	res, a := runSync(t, h, syncReq(webOrigin, "outsider", widgets))
	if res.StatusCode != 403 || a.Error != "project-unreadable" {
		t.Fatalf("status %d error %q", res.StatusCode, a.Error)
	}
	after, _ := json.Marshal(s.parts)
	if !bytes.Equal(snapshot, after) {
		t.Fatalf("records changed:\n%s\n%s", snapshot, after)
	}
}

// D3: a reader who finds the recorded project unlinked clears the pick, deletes its synced
// sprints and picks again.
func TestSyncRepicksWhenProjectUnlinked(t *testing.T) {
	g := &graphGitHub{databaseID: 7, projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	g.projects = g.projects[:2]
	_, a := runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if a.Source == nil || a.Source.Project != "PVT_late" || len(a.Sprints) != 1 || a.Sprints[0].Name != "Wrong" {
		t.Fatalf("answer %+v", a)
	}
	for sk := range s.parts["repo#7"] {
		if strings.Contains(sk, "F_first") {
			t.Fatalf("old sprint %s kept", sk)
		}
	}
	// The field is removed from the only project: the pick clears and nothing is held.
	g.projects[0].Fields = nil
	_, b := runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	if b.Source != nil || len(b.Sprints) != 0 {
		t.Fatalf("answer %+v", b)
	}
	if _, ok := s.parts["repo#7"]["source"]; ok {
		t.Fatal("source kept")
	}
}

// G11: records are keyed by GitHub's permanent identity, so a renamed repository finds them.
func TestSyncKeysOnRepositoryIdentity(t *testing.T) {
	g := &graphGitHub{databaseID: 7, projects: twoProjects()}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	s.parts["repo#7"]["sprint#raiden#1"] = store.Item{SK: "sprint#raiden#1", Attrs: map[string]string{"origin": "raiden", "name": "Own"}}
	_, a := runSync(t, h, syncReq(webOrigin, secretToken, `{"owner":"newco","name":"renamed"}`))
	if len(a.Sprints) != 4 || len(s.parts) != 1 {
		t.Fatalf("answer %+v partitions %d", a, len(s.parts))
	}
}

// G2, G5: the token goes only to GitHub's GraphQL endpoint, every call is a read, and the token
// is never returned or logged.
func TestSyncTokenStaysInRequest(t *testing.T) {
	var logs bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug})))
	t.Cleanup(func() { slog.SetDefault(prev) })
	g := &graphGitHub{databaseID: 7, projects: twoProjects(), milestones: []fakeMilestone{{ID: "M_1", Number: 1, Title: "v1", State: "OPEN"}}}
	s := newMemStore()
	res, _ := runSync(t, syncHandler(t, g, s), syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	for i, q := range g.queries {
		if !strings.HasPrefix(q, "query ") || strings.Contains(q, "mutation") {
			t.Fatalf("call %d is not a read: %q", i, q)
		}
		if g.methods[i] != "POST" || g.paths[i] != "/graphql" || g.auths[i] != "Bearer "+secretToken {
			t.Fatalf("call %d: %s %s %q", i, g.methods[i], g.paths[i], g.auths[i])
		}
	}
	stored, _ := json.Marshal(s.parts)
	for name, text := range map[string]string{"response": res.Body, "logs": logs.String(), "store": string(stored)} {
		if strings.Contains(text, secretToken) {
			t.Fatalf("token found in %s", name)
		}
	}
}

// Story #86 AC1, D4, G9: one synced milestone per GitHub milestone, open and closed, with GitHub's
// title, due date and description.
func TestSyncHoldsOneMilestonePerGitHubMilestone(t *testing.T) {
	g := &graphGitHub{databaseID: 7, milestones: []fakeMilestone{
		{ID: "M_2", Number: 2, Title: "Beta", Due: "2026-12-31T08:00:00Z", Description: "Second", State: "OPEN"},
		{ID: "M_1", Number: 1, Title: "Alpha", Due: "2026-10-01T00:00:00Z", Description: "First", State: "CLOSED"},
		{ID: "M_3", Number: 3, Title: "Someday", State: "OPEN"},
	}}
	s := newMemStore()
	res, a := runSync(t, syncHandler(t, g, s), syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 200 {
		t.Fatalf("status %d body %s", res.StatusCode, res.Body)
	}
	got := []string{}
	for _, m := range a.Milestones {
		got = append(got, m.ID+" #"+strconv.Itoa(m.Number)+" "+m.Title+" due="+m.Due+" "+m.Description+" "+m.State+" "+m.Origin)
	}
	want := []string{
		"M_1 #1 Alpha due=2026-10-01T00:00:00Z First CLOSED github",
		"M_2 #2 Beta due=2026-12-31T08:00:00Z Second OPEN github",
		"M_3 #3 Someday due=  OPEN github",
	}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("milestones\n got %v\nwant %v", got, want)
	}
}

// Story #86 AC2, G9, G10, G12: added, edited and deleted milestones are matched after the next
// sync; an edited milestone keeps its record; Raiden-owned milestones are never touched.
func TestSyncFollowsMilestoneChanges(t *testing.T) {
	g := &graphGitHub{databaseID: 7, milestones: []fakeMilestone{
		{ID: "M_1", Number: 1, Title: "Alpha", Due: "2026-10-01T00:00:00Z", State: "OPEN"},
		{ID: "M_2", Number: 2, Title: "Beta", State: "OPEN"},
	}}
	s := newMemStore()
	h := syncHandler(t, g, s)
	runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	s.parts["repo#7"]["milestone#raiden#1"] = store.Item{SK: "milestone#raiden#1", Attrs: map[string]string{"origin": "raiden", "title": "Own", "number": "0", "state": "OPEN"}}
	g.milestones = []fakeMilestone{
		{ID: "M_1", Number: 1, Title: "Alpha 1.0", Due: "2026-10-15T00:00:00Z", Description: "Now described", State: "CLOSED"},
		{ID: "M_4", Number: 4, Title: "Gamma", State: "OPEN"},
	}
	_, a := runSync(t, h, syncReq(webOrigin, secretToken, widgets))
	got := []string{}
	for _, m := range a.Milestones {
		got = append(got, m.ID+" "+m.Title+" "+m.Due+" "+m.Description+" "+m.State+" "+m.Origin)
	}
	want := []string{
		"M_1 Alpha 1.0 2026-10-15T00:00:00Z Now described CLOSED github",
		"M_4 Gamma   OPEN github",
		"raiden#1 Own   OPEN raiden",
	}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("milestones\n got %v\nwant %v", got, want)
	}
}

// Story #86 AC3, G16: no milestones means no synced milestones and no error.
func TestSyncNoMilestones(t *testing.T) {
	g := &graphGitHub{databaseID: 7}
	res, a := runSync(t, syncHandler(t, g, newMemStore()), syncReq(webOrigin, secretToken, widgets))
	if res.StatusCode != 200 || a.Milestones == nil || len(a.Milestones) != 0 {
		t.Fatalf("status %d milestones %v", res.StatusCode, a.Milestones)
	}
}

// Story #86: every milestone page is read, so a repository with more than one page keeps them all.
func TestSyncReadsEveryMilestonePage(t *testing.T) {
	g := &graphGitHub{databaseID: 7, milestonePage: 2}
	for i := 1; i <= 5; i++ {
		g.milestones = append(g.milestones, fakeMilestone{ID: "M_" + strconv.Itoa(i), Number: i, Title: "m", State: "OPEN"})
	}
	_, a := runSync(t, syncHandler(t, g, newMemStore()), syncReq(webOrigin, secretToken, widgets))
	if len(a.Milestones) != 5 {
		t.Fatalf("milestones %d, want 5", len(a.Milestones))
	}
}
