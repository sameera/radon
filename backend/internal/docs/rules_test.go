// Package docs checks the written rules that the code depends on.
package docs

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

func read(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile("../../../" + path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

const (
	standards = "docs/system/standards/standards.md"
	stack     = "docs/system/stack.md"
	context   = "docs/product/context.md"
)

// Story #87 AC1, D12, G35: the standards state the data Raiden owns and that GitHub is a sync source.
func TestStandardsStateTheDataRule(t *testing.T) {
	doc := read(t, standards)
	for _, want := range []string{
		"Raiden owns its milestone, sprint, sprint goal and sprint assignment records",
		"GitHub is a sync source for milestones and sprints",
		"never stores or logs it, and sends it only to GitHub's API",
	} {
		if !strings.Contains(doc, want) {
			t.Errorf("standards lack %q", want)
		}
	}
}

// Story #87 AC2: no sentence forbids Raiden's own milestone and sprint records or calls them a
// cache only.
func TestNoSentenceForbidsRaidenRecords(t *testing.T) {
	forbidding := regexp.MustCompile(`(?i)(only data GitHub|data GitHub (Projects )?cannot (hold|store)|only what GitHub cannot hold|cache|as authoritative|second copy of GitHub data)`)
	for _, path := range []string{standards, stack, context} {
		for _, line := range strings.Split(read(t, path), "\n") {
			if forbidding.MatchString(line) {
				t.Errorf("%s still says: %s", path, strings.TrimSpace(line))
			}
		}
	}
}

// Story #87 AC3: the ban on writing to GitHub and the "no issue editing" anti-goal stay, and say
// they last until the write-back epic.
func TestWriteBanStaysUntilWriteBack(t *testing.T) {
	std := read(t, standards)
	if !regexp.MustCompile(`\*\*Never\*\* write to GitHub[^\n]*until the write-back epic`).MatchString(std) {
		t.Error("standards lack the write ban lasting until the write-back epic")
	}
	ctx := read(t, context)
	if !regexp.MustCompile(`\*\*No issue editing in Raiden\.\*\*[^\n]*until the write-back epic`).MatchString(ctx) {
		t.Error("product context lacks the no-issue-editing anti-goal lasting until the write-back epic")
	}
	if !regexp.MustCompile(`(?i)never writes? to GitHub[^\n]*until the write-back epic`).MatchString(ctx) {
		t.Error("product context lacks the write ban lasting until the write-back epic")
	}
}
