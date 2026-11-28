package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/aws/aws-lambda-go/events"

	"github.com/raiden/raiden/backend/internal/store"
)

// The goal write (story #103, D1, D3, D4, D7). It saves or clears one sprint's goal in the
// repository's partition. It reads GitHub only to learn the repository's identity and the caller's
// role, with the caller's token, and never writes to GitHub (G13, G17).

const (
	goalPrefix = "goal#"
	// GoalCap is the longest goal Raiden accepts, in characters (D7, G7).
	GoalCap = 200
)

var (
	errNotEditor     = &syncError{http.StatusForbidden, "not-goal-editor"}
	errUnknownSprint = &syncError{http.StatusConflict, "unknown-sprint"}
)

// goalKey is the sprint goal record's sort key: the sprint record's key behind the goal prefix.
func goalKey(sprintID string) string { return goalPrefix + sprintPrefix + sprintID }

// isGoalEditor says whether GitHub's viewerPermission makes the caller a goal editor (D3).
func isGoalEditor(permission string) bool {
	return permission == "ADMIN" || permission == "MAINTAIN"
}

const goalRepoQuery = `query GoalRepo($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) { databaseId viewerPermission }
}`

// groomingGoal refuses an unknown or missing origin and a request with no token before it reads
// Raiden's records or calls GitHub (G24).
func (h *Handler) groomingGoal(ctx context.Context, req events.APIGatewayV2HTTPRequest) events.APIGatewayV2HTTPResponse {
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
		Owner  string `json:"owner"`
		Name   string `json:"name"`
		Sprint string `json:"sprint"`
		Text   string `json:"text"`
	}
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil || !namePart.MatchString(in.Owner) || !namePart.MatchString(in.Name) ||
		in.Name == ".." || in.Owner == ".." || in.Sprint == "" {
		return failWith(errBadRequest, cors)
	}
	text := strings.TrimSpace(in.Text)
	if utf8.RuneCountInString(text) > GoalCap || strings.ContainsAny(text, "\r\n") || !utf8.ValidString(text) {
		return failWith(errBadRequest, cors)
	}
	gh := &graphClient{api: h.Auth.apiURL(), http: h.Auth.client(), token: token}
	if err := saveGoal(ctx, gh, h.Store, in.Owner, in.Name, in.Sprint, text); err != nil {
		slog.InfoContext(ctx, "goal write failed", "request_id", req.RequestContext.RequestID, "cause", err.cause)
		return failWith(err, cors)
	}
	return authRespond(http.StatusOK, map[string]string{"sprint": in.Sprint, "text": text}, cors)
}

// saveGoal checks the caller's role and the sprint, then writes or deletes that one goal record.
func saveGoal(ctx context.Context, gh *graphClient, records store.Records, owner, name, sprint, text string) *syncError {
	var repo struct {
		Repository *struct {
			DatabaseID       int64  `json:"databaseId"`
			ViewerPermission string `json:"viewerPermission"`
		} `json:"repository"`
	}
	errs, fail := gh.query(ctx, goalRepoQuery, map[string]any{"owner": owner, "name": name}, &repo)
	if fail != nil {
		return fail
	}
	if repo.Repository == nil {
		if onlyNotFoundAt(errs, "repository") {
			return errCannotRead
		}
		return errGitHub
	}
	if len(errs) > 0 || repo.Repository.DatabaseID <= 0 {
		return errGitHub
	}
	if !isGoalEditor(repo.Repository.ViewerPermission) {
		return errNotEditor
	}
	pk := "repo#" + strconv.FormatInt(repo.Repository.DatabaseID, 10)
	items, err := records.Query(ctx, pk)
	if err != nil {
		slog.ErrorContext(ctx, "failed to read repository partition")
		return errStore
	}
	known := false
	for _, it := range items {
		if it.SK == sprintPrefix+sprint {
			known = true
			break
		}
	}
	if !known {
		return errUnknownSprint
	}
	if text == "" {
		err = records.Delete(ctx, pk, goalKey(sprint))
	} else {
		err = records.Put(ctx, pk, store.Item{SK: goalKey(sprint), Attrs: map[string]string{"text": text}})
	}
	if err != nil {
		slog.ErrorContext(ctx, "failed to write goal record")
		return errStore
	}
	return nil
}
