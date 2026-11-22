---
feature: "GitHub Authentication"
feature_path: docs/features/github-authentication
feature_issue: "#38"
epic: "Sign in with GitHub"
slug: github-authentication
created: 2026-11-22
type: enhancement
complexity: M
complexity_drivers: [two hosts share one sign-in outcome, backend involvement for the sign-in exchange, three small stories]
concepts: ["raiden-page-host", "raiden-web-view", "raiden-app-shell", "grooming-plan"]
link: "#39"
record: "#44"
record_state: closed
---

# Epic: Sign in with GitHub

## Description

Raiden reads GitHub on the user's behalf. Today neither host can do that, because neither knows who the user is.

This epic lets a person sign in with GitHub from the Raiden tab in the Chrome extension, and from the standalone web view. Each host then calls GitHub's APIs as that person.

Both hosts show the same pages. A person should meet the same sign-in outcome in either one.

## Success Metrics

- A new user reaches a signed-in Raiden page from either host in under one minute.
- Every GitHub call either host makes is made as the signed-in user.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Sign in from the extension tab; Sign in from the standalone web view; Call GitHub APIs as the signed-in user

## User Stories

### Story #40: Sign in from the extension tab

**As an** engineering lead, **I want** to sign in with my GitHub account from the Raiden tab in the extension, **so that** Raiden can read GitHub as me.

#### Acceptance Criteria

- [ ] **Given** I am not signed in, **when** I choose to sign in from the Raiden tab, **then** I am taken through GitHub's sign-in and consent and returned to the Raiden tab signed in
- [ ] **Given** I cancel or deny consent at GitHub, **when** I return to the Raiden tab, **then** I am still signed out and see a message saying sign-in did not finish
- [ ] **Given** I finish signing in, **when** the Raiden tab reloads, **then** I see my GitHub username

#### Notes

The consent screen asks only for the read access Raiden needs. Raiden never asks to write to issues.

### Story #41: Sign in from the standalone web view

**As a** scrum master, **I want** to sign in with my GitHub account from the standalone web view, **so that** Raiden can read GitHub as me outside the extension.

#### Acceptance Criteria

- [ ] **Given** I open the standalone web view and I am not signed in, **when** I choose to sign in, **then** I am taken through GitHub's sign-in and consent and returned to the web view, signed in
- [ ] **Given** I cancel or deny consent at GitHub, **when** I return to the web view, **then** I am still signed out and see a message saying sign-in did not finish
- [ ] **Given** I finish signing in, **when** the page reloads, **then** I see my GitHub username

### Story #42: Call GitHub APIs as the signed-in user

**As an** engineering lead, **I want** every GitHub request Raiden makes in either host to carry my sign-in, **so that** I see only what I may see in GitHub.

#### Acceptance Criteria

- [ ] **Given** I am signed in, **when** a Raiden page in either host asks GitHub for data, **then** GitHub answers as me
- [ ] **Given** I am signed in, **when** a page in the extension and a page in the web view request the same data, **then** both get the same answer
- [ ] **Given** a request to GitHub fails because my sign-in was rejected, **when** the failure is reported, **then** the caller can tell it apart from other failures
- [ ] **Given** I am signed in, **when** either host makes any GitHub request, **then** 100% of those requests carry my sign-in

## Assumptions

- Each host holds its own sign-in. Signing in on one does not sign in the other.
- Sign-in grants read access only, in line with the minimal-scope rule in the product context.

## Out of Scope

- Writing to GitHub issues, fields or iterations.
- Sign-in methods other than GitHub.
- Background work that runs without a signed-in user.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #40 | none |
| #41 | #40 |
| #42 | #40, #41 |
