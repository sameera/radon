package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"github.com/raiden/raiden/backend/internal/store"
)

// The Grooming sync (D1-D4). It reads GitHub as the caller, with the caller's token, updates the
// synced records of the repository's partition and returns the whole partition. The token lives
// in this request only: it is never stored, logged or returned (G2).

const (
	originGitHub = "github"
	sourceKey    = "source"
	sprintPrefix = "sprint#"
)

var namePart = regexp.MustCompile(`^[A-Za-z0-9_.-]+$`)

// syncError is a failure with the status and the fixed cause the browser gets.
type syncError struct {
	status int
	cause  string
}

func (e *syncError) Error() string { return e.cause }

var (
	errRejected      = &syncError{http.StatusUnauthorized, "rejected-credentials"}
	errCannotRead    = &syncError{http.StatusForbidden, "cannot-read"}
	errProjectHidden = &syncError{http.StatusForbidden, "project-unreadable"}
	errRateLimit     = &syncError{http.StatusTooManyRequests, "rate-limit"}
	errGitHub        = &syncError{http.StatusBadGateway, "github-unavailable"}
	errStore         = &syncError{http.StatusServiceUnavailable, "store-unavailable"}
	errBadRequest    = &syncError{http.StatusBadRequest, "bad request"}
	errTokenRequired = &syncError{http.StatusUnauthorized, "token required"}
	errOriginRefused = &syncError{http.StatusForbidden, "origin not allowed"}
)

// dataCors answers the data routes only for the configured origins. The token header is allowed,
// because the browser sends the lead's token on each data request (D1, D13).
func (a *AuthConfig) dataCors(origin string) map[string]string {
	if origin == "" || !contains(a.AllowedOrigins, origin) {
		return nil
	}
	return map[string]string{
		"access-control-allow-origin":  origin,
		"access-control-allow-methods": "POST, OPTIONS",
		"access-control-allow-headers": "content-type, authorization",
		"vary":                         "origin",
	}
}

func bearer(req events.APIGatewayV2HTTPRequest) string {
	v := header(req, "authorization")
	if len(v) > 7 && strings.EqualFold(v[:7], "bearer ") {
		return strings.TrimSpace(v[7:])
	}
	return ""
}

func failWith(e *syncError, cors map[string]string) events.APIGatewayV2HTTPResponse {
	return authRespond(e.status, map[string]string{"error": e.cause}, cors)
}

// groomingSync refuses an unknown or missing origin and a request with no token before it reads
// Raiden's records or calls GitHub (G3).
func (h *Handler) groomingSync(ctx context.Context, req events.APIGatewayV2HTTPRequest) events.APIGatewayV2HTTPResponse {
	cors := h.Auth.dataCors(header(req, "origin"))
	if cors == nil {
		slog.DebugContext(ctx, "data request rejected by origin policy", "request_id", req.RequestContext.RequestID)
		return failWith(errOriginRefused, nil)
	}
	if req.RequestContext.HTTP.Method == http.MethodOptions {
		res := events.APIGatewayV2HTTPResponse{StatusCode: http.StatusNoContent, Headers: map[string]string{}}
		for k, v := range cors {
			res.Headers[k] = v
		}
		return res
	}
	token := bearer(req)
	if token == "" {
		return failWith(errTokenRequired, cors)
	}
	var in struct {
		Owner string `json:"owner"`
		Name  string `json:"name"`
	}
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil || !namePart.MatchString(in.Owner) || !namePart.MatchString(in.Name) ||
		in.Name == ".." || in.Owner == ".." {
		return failWith(errBadRequest, cors)
	}
	gh := &graphClient{api: h.Auth.apiURL(), http: h.Auth.client(), token: token}
	answer, err := runGroomingSync(ctx, gh, h.Store, in.Owner, in.Name)
	if err != nil {
		slog.InfoContext(ctx, "grooming sync failed", "request_id", req.RequestContext.RequestID, "cause", err.cause)
		return failWith(err, cors)
	}
	return authRespond(http.StatusOK, answer, cors)
}

// graphClient sends read-only GraphQL queries to GitHub's API with the caller's token.
type graphClient struct {
	api   string
	http  *http.Client
	token string
}

type graphError struct {
	Type string `json:"type"`
	Path []any  `json:"path"`
}

func (g *graphClient) query(ctx context.Context, query string, vars map[string]any, out any) ([]graphError, *syncError) {
	body, _ := json.Marshal(map[string]any{"query": query, "variables": vars})
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, g.api+"/graphql", bytes.NewReader(body))
	if err != nil {
		return nil, errGitHub
	}
	r.Header.Set("authorization", "Bearer "+g.token)
	r.Header.Set("content-type", "application/json")
	r.Header.Set("accept", "application/vnd.github+json")
	res, err := g.http.Do(r)
	if err != nil {
		slog.WarnContext(ctx, "GitHub GraphQL request failed")
		return nil, errGitHub
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return nil, errGitHub
	}
	switch {
	case res.StatusCode == http.StatusUnauthorized:
		return nil, errRejected
	case res.StatusCode == http.StatusTooManyRequests ||
		(res.StatusCode == http.StatusForbidden && (res.Header.Get("x-ratelimit-remaining") == "0" || res.Header.Get("retry-after") != "")):
		return nil, errRateLimit
	case res.StatusCode == http.StatusForbidden || res.StatusCode == http.StatusNotFound:
		return nil, errCannotRead
	case res.StatusCode != http.StatusOK:
		return nil, errGitHub
	}
	var envelope struct {
		Data   json.RawMessage `json:"data"`
		Errors []graphError    `json:"errors"`
	}
	if json.Unmarshal(raw, &envelope) != nil {
		return nil, errGitHub
	}
	for _, e := range envelope.Errors {
		if e.Type == "RATE_LIMITED" {
			return nil, errRateLimit
		}
	}
	if len(envelope.Data) == 0 || string(envelope.Data) == "null" || json.Unmarshal(envelope.Data, out) != nil {
		if len(envelope.Errors) > 0 {
			return envelope.Errors, nil
		}
		return nil, errGitHub
	}
	return envelope.Errors, nil
}

// onlyNotFoundAt says every error is GitHub hiding the named top-level field from the caller.
func onlyNotFoundAt(errs []graphError, field string) bool {
	for _, e := range errs {
		if e.Type != "NOT_FOUND" || len(e.Path) == 0 || e.Path[0] != field {
			return false
		}
	}
	return true
}

const repoQuery = `query Repo($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    databaseId
    projectsV2(first: 100) {
      nodes { id createdAt fields(first: 100) { nodes { ... on ProjectV2IterationField { id createdAt } } } }
    }
  }
}`

const sourceQuery = `query Source($id: ID!) { node(id: $id) { ... on ProjectV2 { id } } }`

const iterationsQuery = `query Iterations($id: ID!) {
  node(id: $id) {
    ... on ProjectV2IterationField {
      id
      configuration {
        iterations { id title startDate duration }
        completedIterations { id title startDate duration }
      }
    }
  }
}`

type linkedProject struct {
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	Fields    struct {
		Nodes []struct {
			ID        string `json:"id"`
			CreatedAt string `json:"createdAt"`
		} `json:"nodes"`
	} `json:"fields"`
}

type iteration struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	StartDate string `json:"startDate"`
	Duration  int    `json:"duration"`
}

// iterationFields lists a project's iteration fields, earliest created first.
func (p linkedProject) iterationFields() []string {
	type f struct{ id, created string }
	var list []f
	for _, n := range p.Fields.Nodes {
		if n.ID != "" {
			list = append(list, f{n.ID, n.CreatedAt})
		}
	}
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].created != list[j].created {
			return list[i].created < list[j].created
		}
		return list[i].id < list[j].id
	})
	out := make([]string, len(list))
	for i, x := range list {
		out[i] = x.id
	}
	return out
}

// syncSource is the project and iteration field that supply sprints (D3).
type syncSource struct {
	Project string `json:"project"`
	Field   string `json:"field"`
}

// pickSource takes the earliest-created linked project the caller can read that has an iteration
// field, and its earliest-created iteration field (D3).
func pickSource(projects []linkedProject) *syncSource {
	sorted := append([]linkedProject(nil), projects...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].CreatedAt != sorted[j].CreatedAt {
			return sorted[i].CreatedAt < sorted[j].CreatedAt
		}
		return sorted[i].ID < sorted[j].ID
	})
	for _, p := range sorted {
		if fields := p.iterationFields(); len(fields) > 0 {
			return &syncSource{Project: p.ID, Field: fields[0]}
		}
	}
	return nil
}

func (s *syncSource) stillLinked(projects []linkedProject) bool {
	for _, p := range projects {
		if p.ID != s.Project {
			continue
		}
		for _, f := range p.iterationFields() {
			if f == s.Field {
				return true
			}
		}
	}
	return false
}

// lastDay is an iteration's last day: its start plus its duration in days, less one.
func lastDay(start string, days int) (string, bool) {
	t, err := time.Parse("2006-01-02", start)
	if err != nil || days < 1 {
		return "", false
	}
	return t.AddDate(0, 0, days-1).Format("2006-01-02"), true
}

// readSprints reads every active and completed iteration of the source field as sprint records.
func readSprints(ctx context.Context, gh *graphClient, src *syncSource) ([]store.Item, *syncError) {
	var data struct {
		Node *struct {
			ID            string `json:"id"`
			Configuration struct {
				Iterations          []iteration `json:"iterations"`
				CompletedIterations []iteration `json:"completedIterations"`
			} `json:"configuration"`
		} `json:"node"`
	}
	errs, fail := gh.query(ctx, iterationsQuery, map[string]any{"id": src.Field}, &data)
	if fail != nil {
		return nil, fail
	}
	if len(errs) > 0 || data.Node == nil || data.Node.ID != src.Field {
		return nil, errGitHub
	}
	var out []store.Item
	all := append(append([]iteration{}, data.Node.Configuration.CompletedIterations...), data.Node.Configuration.Iterations...)
	for _, it := range all {
		end, ok := lastDay(it.StartDate, it.Duration)
		if !ok || it.ID == "" {
			return nil, errGitHub
		}
		out = append(out, store.Item{SK: sprintPrefix + src.Field + "#" + it.ID, Attrs: map[string]string{
			"origin": originGitHub, "field": src.Field, "iteration": it.ID, "name": it.Title, "start": it.StartDate, "end": end,
		}})
	}
	return out, nil
}

// syncPlan is the writes one sync makes. A sync creates, changes or deletes only records marked
// as synced, under the prefixes it owns. It never touches a Raiden-owned record or a record keyed
// to a sprint or an issue (D2, D4, G10, G17).
type syncPlan struct {
	puts    []store.Item
	deletes []string
}

func sameAttrs(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}

func (p *syncPlan) reconcile(existing map[string]store.Item, prefix string, desired []store.Item) {
	want := map[string]bool{}
	for _, it := range desired {
		want[it.SK] = true
		if old, ok := existing[it.SK]; ok && old.Attrs["origin"] != originGitHub {
			continue
		} else if ok && sameAttrs(old.Attrs, it.Attrs) {
			continue
		}
		p.puts = append(p.puts, it)
	}
	keys := make([]string, 0, len(existing))
	for sk := range existing {
		keys = append(keys, sk)
	}
	sort.Strings(keys)
	for _, sk := range keys {
		if strings.HasPrefix(sk, prefix) && existing[sk].Attrs["origin"] == originGitHub && !want[sk] {
			p.deletes = append(p.deletes, sk)
		}
	}
}

func runGroomingSync(ctx context.Context, gh *graphClient, records store.Records, owner, name string) (map[string]any, *syncError) {
	var repo struct {
		Repository *struct {
			DatabaseID int64 `json:"databaseId"`
			ProjectsV2 struct {
				Nodes []linkedProject `json:"nodes"`
			} `json:"projectsV2"`
		} `json:"repository"`
	}
	errs, fail := gh.query(ctx, repoQuery, map[string]any{"owner": owner, "name": name}, &repo)
	if fail != nil {
		return nil, fail
	}
	// GitHub refuses the caller for the repository: no record is read or written (G4).
	if repo.Repository == nil {
		if onlyNotFoundAt(errs, "repository") {
			return nil, errCannotRead
		}
		return nil, errGitHub
	}
	if len(errs) > 0 || repo.Repository.DatabaseID <= 0 {
		return nil, errGitHub
	}
	projects := repo.Repository.ProjectsV2.Nodes
	pk := "repo#" + strconv.FormatInt(repo.Repository.DatabaseID, 10)

	items, err := records.Query(ctx, pk)
	if err != nil {
		slog.ErrorContext(ctx, "failed to read repository partition")
		return nil, errStore
	}
	existing := map[string]store.Item{}
	for _, it := range items {
		existing[it.SK] = it
	}

	// D3: a recorded source is kept. A caller who cannot read it changes nothing (G14). A caller who
	// can read it and finds it unlinked, or without the field, clears the pick and picks again.
	var source *syncSource
	if rec, ok := existing[sourceKey]; ok && rec.Attrs["project"] != "" && rec.Attrs["field"] != "" {
		recorded := &syncSource{Project: rec.Attrs["project"], Field: rec.Attrs["field"]}
		if recorded.stillLinked(projects) {
			source = recorded
		} else {
			var node struct {
				Node *struct {
					ID string `json:"id"`
				} `json:"node"`
			}
			errs, fail := gh.query(ctx, sourceQuery, map[string]any{"id": recorded.Project}, &node)
			if fail != nil {
				return nil, fail
			}
			if node.Node == nil || node.Node.ID != recorded.Project {
				if onlyNotFoundAt(errs, "node") {
					return nil, errProjectHidden
				}
				return nil, errGitHub
			}
			source = pickSource(projects)
		}
	} else {
		source = pickSource(projects)
	}

	var sprints []store.Item
	if source != nil {
		if sprints, fail = readSprints(ctx, gh, source); fail != nil {
			return nil, fail
		}
	}

	plan := &syncPlan{}
	if source == nil {
		if _, ok := existing[sourceKey]; ok {
			plan.deletes = append(plan.deletes, sourceKey)
		}
	} else {
		plan.reconcile(existing, sourceKey, []store.Item{{SK: sourceKey, Attrs: map[string]string{
			"origin": originGitHub, "project": source.Project, "field": source.Field,
		}}})
	}
	plan.reconcile(existing, sprintPrefix, sprints)

	// Answer only after every write succeeded.
	for _, it := range plan.puts {
		if err := records.Put(ctx, pk, it); err != nil {
			slog.ErrorContext(ctx, "failed to write synced record")
			return nil, errStore
		}
		existing[it.SK] = it
	}
	for _, sk := range plan.deletes {
		if err := records.Delete(ctx, pk, sk); err != nil {
			slog.ErrorContext(ctx, "failed to delete synced record")
			return nil, errStore
		}
		delete(existing, sk)
	}
	slog.DebugContext(ctx, "grooming sync done", "writes", len(plan.puts), "deletes", len(plan.deletes))
	return partitionAnswer(repo.Repository.DatabaseID, source, existing), nil
}

func origin(attrs map[string]string) string {
	if attrs["origin"] == originGitHub {
		return originGitHub
	}
	return "raiden"
}

// partitionAnswer is the whole partition the page needs: the sync source and every sprint and
// milestone record, synced or Raiden-owned.
func partitionAnswer(repoID int64, source *syncSource, items map[string]store.Item) map[string]any {
	keys := make([]string, 0, len(items))
	for sk := range items {
		keys = append(keys, sk)
	}
	sort.Strings(keys)
	sprints := []map[string]string{}
	for _, sk := range keys {
		it := items[sk]
		if strings.HasPrefix(sk, sprintPrefix) {
			sprints = append(sprints, map[string]string{
				"id": strings.TrimPrefix(sk, sprintPrefix), "field": it.Attrs["field"], "iteration": it.Attrs["iteration"],
				"name": it.Attrs["name"], "start": it.Attrs["start"], "end": it.Attrs["end"], "origin": origin(it.Attrs),
			})
		}
	}
	answer := map[string]any{"repository": repoID, "source": nil, "sprints": sprints, "milestones": []any{}}
	if source != nil {
		answer["source"] = source
	}
	return answer
}
