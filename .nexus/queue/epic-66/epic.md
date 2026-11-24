---
feature: "Project Context"
feature_issue: "#49"
feature_path: docs/features/project-context
epic: "Repository breadcrumb with searchable repository menu"
slug: repository-breadcrumb-menu
created: 2026-11-23
type: enhancement
complexity: M
complexity_drivers: [banner markup and styling change, new filtering menu behaviour]
concepts: ["raiden-banner", "raiden-web-view", "repository-context", "raiden-app-shell", "web-repository-picker", "raiden-page-host", "github-sign-in"]
link: "#66"
record: "#69"
record_state: closed
---

# Epic: Repository breadcrumb with searchable repository menu

## Description

The banner of the web view shows the current repository in a plain drop-down. This epic replaces it with a breadcrumb that reads like the one GitHub shows above a repository: the owner, a slash, then the repository name.

Selecting the breadcrumb opens a menu of the repositories the signed-in person can reach through Raiden. The person types in the menu to narrow the list, and picks a repository to switch to it.

The change is limited to how the repository is shown and chosen. Which repositories are reachable, and how the choice is remembered, stay as they are.

## Success Metrics

- A person finds and switches to a repository in a list of 100 repositories by typing part of its name and picking it, without scrolling.
- The banner shows the current repository as owner and name in the same order and separator as GitHub's own breadcrumb.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Show the current repository as a breadcrumb; Search the repository menu by typing

## User Stories

### Story #67: Show the current repository as a breadcrumb

**As a** team lead using the web view, **I want** the banner to show the current repository as an owner and repository breadcrumb, **so that** I can see which repository the pages work on in the form I know from GitHub.

#### Acceptance Criteria

- [ ] **Given** a repository is chosen, **when** the banner is shown, **then** it reads as the owner, a slash separator, then the repository name
- [ ] **Given** no repository is chosen, **when** the banner is shown, **then** it shows a prompt to choose a repository in the place of the breadcrumb
- [ ] **Given** the light or the dark theme, **when** the banner is shown, **then** the breadcrumb takes its colors from the theme and is readable in both

#### Notes

The breadcrumb is the control that opens the repository menu in the next story.

### Story #68: Search the repository menu by typing

**As a** team lead with many repositories, **I want** to open a menu from the breadcrumb and type to narrow the list, **so that** I reach the repository I want without scrolling.

#### Acceptance Criteria

- [ ] **Given** the signed-in person can reach repositories, **when** they select the breadcrumb, **then** a menu opens listing those repositories as owner and name and a search box that has focus
- [ ] **Given** the menu is open, **when** they type part of an owner or repository name, **then** the list shows only the repositories whose owner and name, written as owner/name, contain the typed text, ignoring case
- [ ] **Given** the typed text matches no repository, **when** the list is shown, **then** the menu says that no repository matches
- [ ] **Given** the menu is open, **when** they pick a repository, **then** the menu closes and the banner and the pages switch to that repository
- [ ] **Given** the menu is open, **when** they press Escape or select outside it, **then** the menu closes and the repository does not change

#### Notes

The search runs over the list already loaded. It sends no new request to GitHub.

## Assumptions

- "GitHub's own breadcrumb" means the owner / repository trail GitHub shows above a repository page
- The menu lists the repositories already loaded for the picker, so no new GitHub request is needed
- The banner is the web view's banner; the extension takes its repository from the GitHub page

## Out of Scope

- Making the owner segment a menu or a link
- Showing repositories the person cannot reach through Raiden
- Changes to the extension host

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #67 | none |
| #68 | #67 |
