---
feature: "Project Context"
feature_issue: "#49"
feature_path: docs/features/project-context
epic: "Repository context for every Raiden page"
slug: repository-context
created: 2026-11-22
type: enhancement
complexity: M
complexity_drivers: [one context shared by both hosts, repository list read from GitHub across several pages, values remembered in the browser]
concepts: []
link: "#50"
record: "#55"
record_state: closed
---

# Epic: Repository context for every Raiden page

## Description

Raiden always works on one repository. Today each page learns which repository only if its parent hands it down, and the standalone web view has no way to choose one at all. This epic gives every Raiden page one shared answer to "which repository am I working on".

In the extension, the answer is the repository the person is viewing on github.com. In the standalone web view, the person picks the repository from a drop-down beside the Raiden mark and word. The drop-down lists the repositories in the person's GitHub account.

The web view remembers the last repository picked, so it opens on that repository next time. It also keeps the last repository list it loaded, so the drop-down is ready before GitHub answers.

## Success Metrics

- A person who has used the web view before reaches a page showing their last repository without picking anything.
- The drop-down lists repositories immediately on a repeat visit, before GitHub responds.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Every page reads the current repository; Pick a repository in the web view; Open the web view on the last repository used; Show the repository list from the last visit

## User Stories

### Story #51: Every page reads the current repository

- **story_type:** system
- **size:** S

**As a** developer of Raiden pages, **I want** any component to read the current repository directly, **so that** no page has to pass it down through every parent.

#### Acceptance Criteria

- [ ] **Given** the extension's Raiden tab on a repository page, **when** a component reads the current repository, **then** it gets that page's repository owner and name.
- [ ] **Given** a component nested three levels below the page root in either host, **when** it reads the current repository, **then** a test passes asserting it gets the owner and name the host supplied, with no parent passing them.
- [ ] **Given** the current repository changes, **when** a component that reads it is on screen, **then** that component shows the new repository without a page reload.
- [ ] **Given** no repository has been chosen, **when** a component reads the current repository, **then** it reads "none" and the page asks the person to pick a repository.

### Story #52: Pick a repository in the web view

- **story_type:** user
- **size:** M

**As an** engineering lead using the web view, **I want** to pick the repository from a drop-down beside the Raiden mark and word, **so that** the pages show that repository's work.

#### Acceptance Criteria

- [ ] **Given** a signed-in person in the web view, **when** they look at the banner, **then** a repository drop-down sits beside the Raiden mark and word.
- [ ] **Given** the drop-down is opened, **when** it lists repositories, **then** it lists every repository the person can reach through Raiden's GitHub App, across all of the App's installations they can see.
- [ ] **Given** the account has several hundred repositories, **when** the list loads, **then** every repository appears in the drop-down.
- [ ] **Given** the drop-down is open, **when** the person picks a repository, **then** the page shows that repository as the current repository.
- [ ] **Given** the person is signed out, **when** the web view shows the banner, **then** no repository drop-down is shown.

### Story #53: Open the web view on the last repository used

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** the web view to open on the repository I last used, **so that** I do not pick it again on every visit.

#### Acceptance Criteria

- [ ] **Given** the person picked a repository in an earlier visit, **when** they open the web view again in the same browser, **then** that repository is the current repository without any pick.
- [ ] **Given** the remembered repository is missing from the person's freshly loaded list, **when** the list arrives, **then** the current repository becomes "none" and the page asks the person to pick one.
- [ ] **Given** a different person signs in on the same browser, **when** the web view opens, **then** the previous person's last repository is not the current repository.

#### Notes

The lead asked for the last repository to be kept in the browser's local storage.

### Story #54: Show the repository list from the last visit

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** the drop-down to show my repositories as soon as the web view opens, **so that** I do not wait for GitHub on every visit.

#### Acceptance Criteria

- [ ] **Given** the list was loaded in an earlier visit in this browser, **when** the web view opens, **then** the drop-down shows that list before GitHub answers.
- [ ] **Given** the kept list is shown, **when** a fresh list arrives from GitHub, **then** the drop-down shows the fresh list and the kept list is replaced by it.
- [ ] **Given** a different person signs in on the same browser, **when** the web view opens, **then** the drop-down never shows the previous person's repositories.

#### Notes

The lead asked for the list to be kept in the browser's local storage.

## Assumptions

- The current repository is one repository at a time.
- The drop-down lists the repositories GitHub returns for the signed-in person through Raiden's sign-in, so a repository Raiden's GitHub App cannot reach does not appear.
- The remembered repository and the kept list belong to one browser and do not follow the person to another device.

## Out of Scope

- Choosing a GitHub Project, rather than a repository, as the context.
- Changing the repository from inside the extension; the extension always follows the page being viewed.
- Searching or filtering inside the drop-down.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #51 | none |
| #52 | #51 |
| #53 | #52 |
| #54 | #52 |
