package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/aws/aws-lambda-go/events"

	"github.com/raiden/raiden/backend/internal/store"
)

// The move write (story #114, D1, D2). It saves one issue's sprint assignment in the repository's
// partition: a sprint the partition holds, or the no-sprint mark. It reads GitHub once, with the
// caller's token, to learn the repository's identity, the caller's role and the issue's
// repository, and never writes to GitHub (G25, G27, G30).

const (
	assignPrefix = "assign#"
	// The attribute that marks an issue the lead put in the band for issues with no sprint.
	noSprintAttr = "none"
)

var (
	errNotMoveEditor = &syncError{http.StatusForbidden, "not-editor"}
	errUnknownIssue  = &syncError{http.StatusConflict, "unknown-issue"}
)

// assignKey is the sprint assignment record's sort key: GitHub's permanent identity for the issue
// behind the assignment prefix (D1).
func assignKey(issue string) string { return assignPrefix + issue }

const moveCheckQuery = `query MoveCheck($owner: String!, $name: String!, $issue: ID!) {
  repository(owner: $owner, name: $name) { databaseId viewerPermission }
  node(id: $issue) { ... on Issue { repository { databaseId } } }
}`

// groomingMove refuses an unknown or missing origin and a request with no token before it reads
// Raiden's records or calls GitHub (G33).
func (h *Handler) groomingMove(ctx context.Context, req events.APIGatewayV2HTTPRequest) events.APIGatewayV2HTTPResponse {
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
		Owner  string          `json:"owner"`
		Name   string          `json:"name"`
		Issue  string          `json:"issue"`
		Sprint json.RawMessage `json:"sprint"`
	}
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil || !namePart.MatchString(in.Owner) || !namePart.MatchString(in.Name) ||
		in.Name == ".." || in.Owner == ".." || strings.TrimSpace(in.Issue) == "" || len(in.Sprint) == 0 {
		return failWith(errBadRequest, cors)
	}
	// The target is a sprint's identity, or null for the no-sprint mark.
	var sprint *string
	if err := json.Unmarshal(in.Sprint, &sprint); err != nil || (sprint != nil && *sprint == "") {
		return failWith(errBadRequest, cors)
	}
	gh := &graphClient{api: h.Auth.apiURL(), http: h.Auth.client(), token: token}
	if err := saveMove(ctx, gh, h.Store, in.Owner, in.Name, in.Issue, sprint); err != nil {
		slog.InfoContext(ctx, "move write failed", "request_id", req.RequestContext.RequestID, "cause", err.cause)
		return failWith(err, cors)
	}
	return authRespond(http.StatusOK, map[string]any{"issue": in.Issue, "sprint": sprint}, cors)
}

// saveMove checks the caller's role, the issue and the target, then writes that one record. It
// never deletes a record and never runs a sync (D1, D2, G28).
func saveMove(ctx context.Context, gh *graphClient, records store.Records, owner, name, issue string, sprint *string) *syncError {
	var data struct {
		Repository *struct {
			DatabaseID       int64  `json:"databaseId"`
			ViewerPermission string `json:"viewerPermission"`
		} `json:"repository"`
		Node *struct {
			Repository *struct {
				DatabaseID int64 `json:"databaseId"`
			} `json:"repository"`
		} `json:"node"`
	}
	errs, fail := gh.query(ctx, moveCheckQuery, map[string]any{"owner": owner, "name": name, "issue": issue}, &data)
	if fail != nil {
		return fail
	}
	if data.Repository == nil {
		if onlyNotFoundAtAny(errs, "repository", "node") {
			return errCannotRead
		}
		return errGitHub
	}
	if data.Repository.DatabaseID <= 0 || (len(errs) > 0 && !onlyNotFoundAt(errs, "node")) {
		return errGitHub
	}
	if !isGoalEditor(data.Repository.ViewerPermission) {
		return errNotMoveEditor
	}
	// An issue the caller cannot see, or one that is not an issue of this repository (G27).
	if data.Node == nil || data.Node.Repository == nil || data.Node.Repository.DatabaseID != data.Repository.DatabaseID {
		return errUnknownIssue
	}
	pk := "repo#" + strconv.FormatInt(data.Repository.DatabaseID, 10)
	attrs := map[string]string{noSprintAttr: "true"}
	if sprint != nil {
		items, err := records.Query(ctx, pk)
		if err != nil {
			slog.ErrorContext(ctx, "failed to read repository partition")
			return errStore
		}
		known := false
		for _, it := range items {
			if it.SK == sprintPrefix+*sprint {
				known = true
				break
			}
		}
		if !known {
			return errUnknownSprint
		}
		attrs = map[string]string{"sprint": *sprint}
	}
	if err := records.Put(ctx, pk, store.Item{SK: assignKey(issue), Attrs: attrs}); err != nil {
		slog.ErrorContext(ctx, "failed to write sprint assignment record")
		return errStore
	}
	return nil
}

// onlyNotFoundAtAny says every error is GitHub hiding one of the named top-level fields.
func onlyNotFoundAtAny(errs []graphError, fields ...string) bool {
	for _, e := range errs {
		if e.Type != "NOT_FOUND" || len(e.Path) == 0 {
			return false
		}
		hit := false
		for _, f := range fields {
			if e.Path[0] == f {
				hit = true
			}
		}
		if !hit {
			return false
		}
	}
	return true
}

// assignmentsAnswer lists every sprint assignment record of the partition, in key order. A nil
// sprint is the no-sprint mark (D3).
func assignmentsAnswer(keys []string, items map[string]store.Item) []map[string]any {
	out := []map[string]any{}
	for _, sk := range keys {
		if !strings.HasPrefix(sk, assignPrefix) {
			continue
		}
		attrs := items[sk].Attrs
		var sprint any
		if attrs[noSprintAttr] != "true" {
			if attrs["sprint"] == "" {
				continue
			}
			sprint = attrs["sprint"]
		}
		out = append(out, map[string]any{"issue": strings.TrimPrefix(sk, assignPrefix), "sprint": sprint})
	}
	return out
}
