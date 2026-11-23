---
feature: "GitHub Authentication"
feature_issue: "#38"
feature_path: docs/features/github-authentication
epic: "Sign out from the banner account menu"
slug: sign-out-account-menu
created: 2026-11-22
type: enhancement
complexity: M
complexity_drivers: [two hosts keep their own sign-in, shell and host change together]
concepts: ["raiden-banner", "raiden-web-view", "raiden-app-shell", "web-repository-picker", "raiden-page-host", "github-sign-in", "github-client"]
link: "#58"
record: "#61"
record_state: closed
---

# Epic: Sign out from the banner account menu

## Description

A signed-in person sees their GitHub avatar in the top right corner of the banner. Clicking the avatar opens a menu. The menu holds a Sign out action.

Today there is no way to sign out in Raiden. The setup guide tells people to revoke the App in GitHub or clear the browser's storage. A person on a shared computer cannot leave Raiden without doing one of those.

The banner is drawn only by the web view, so the menu appears there. The extension does not draw the banner.

## Success Metrics

- A signed-in person can sign out in two clicks from any page in the web view.
- After sign-out, the next screen shown is the sign-in screen, and no page content is visible.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Account menu in the banner; Sign out ends the session

## User Stories

### Story #59: Account menu in the banner

- **story_type:** user
- **size:** S

**As a** signed-in person, **I want** my GitHub avatar in the top right corner of the banner to open a menu when I click it, **so that** I can reach account actions from any page in the web view.

## Acceptance Criteria

- [ ] **Given** I am signed in, **when** the banner shows, **then** my GitHub avatar is at the top right corner of the banner
- [ ] **Given** I am signed in, **when** I click the avatar, **then** a menu opens that holds a Sign out action
- [ ] **Given** the menu is open, **when** I click outside it or press Escape, **then** the menu closes
- [ ] **Given** I am signed out, **when** the sign-in screen shows, **then** no avatar and no menu are shown

### Story #60: Sign out ends the session

- **story_type:** user
- **size:** M

**As a** signed-in person, **I want** the Sign out action to end my Raiden session, **so that** the next person on this computer cannot use my GitHub access through Raiden.

## Acceptance Criteria

- [ ] **Given** the menu is open, **when** I choose Sign out, **then** the sign-in screen replaces the page and the menu is gone
- [ ] **Given** I have signed out, **when** I reload Raiden, **then** I am still signed out and no page content or repository list is shown
- [ ] **Given** I have signed out, **when** I choose Sign in with GitHub, **then** the normal sign-in flow runs, GitHub offers its account chooser, and I can sign in as the same person or another person
- [ ] **Given** I have just signed out, **when** the sign-in screen shows, **then** it tells me this browser may still be signed in to GitHub and links to GitHub's sign-out
- [ ] **Given** I signed out in the web view, **when** I open the extension, **then** the extension's own sign-in is unchanged

## Notes

Sign out ends the session on this host only. It does not revoke the App in GitHub.

## Assumptions

- The avatar comes from the signed-in username, so no new GitHub permission is needed
- The menu holds only Sign out in this epic
- The repository drop-down stays beside the Raiden word, as it is today

## Out of Scope

- Revoking the GitHub App from within Raiden
- A sign-out control in the extension, which draws no banner
- Other menu items such as settings or profile

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #59 | none |
| #60 | #59 |
