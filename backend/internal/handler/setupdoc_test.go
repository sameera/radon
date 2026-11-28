package handler

import (
	"os"
	"strings"
	"testing"
)

// Story #85 AC6, D13, D14, G40, story #103: the setup instructions name the table, the backend's permission to
// read and write it, the request header the backend must accept, and the App's one new permission.
func TestSetupDocNamesTheDataPath(t *testing.T) {
	raw, err := os.ReadFile("../../../docs/setup/github-app.md")
	if err != nil {
		t.Fatal(err)
	}
	doc := string(raw)
	for _, want := range []string{
		"RAIDEN_TABLE",
		"`pk`", "`sk`",
		"dynamodb:Query", "dynamodb:PutItem", "dynamodb:DeleteItem",
		"`authorization`",
		"POST /grooming/sync",
		"POST /grooming/goal",
		"**Organization permissions**",
		"**Projects:** Read-only",
	} {
		if !strings.Contains(doc, want) {
			t.Errorf("setup instructions lack %q", want)
		}
	}
	if strings.Contains(strings.ToLower(doc), "read and write") && strings.Contains(doc, "Projects:** Read and write") {
		t.Error("the App must gain no write permission")
	}
}
