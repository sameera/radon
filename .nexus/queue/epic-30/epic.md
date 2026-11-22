---
feature: "Standalone Web View"
feature_issue: "#29"
feature_path: docs/features/standalone-web-view
epic: "Standalone web view with a Raiden banner"
slug: standalone-web-view-banner
created: 2026-11-22
type: enhancement
complexity: M
complexity_drivers: [new web host app beside the extension, installable app support, new banner component for both themes]
concepts: ["raiden-page-host", "raiden-app-shell", "grooming-plan"]
link: "#30"
record: "#34"
record_state: closed
---

# Epic: Standalone web view with a Raiden banner

## Description

Today the Raiden pages only show inside github.com, in the Raiden tab of a repository. GitHub's own header and repository tabs sit above them, so the lead always knows where they are. This epic adds a standalone web view: the same Raiden pages, served on their own and installable as an app.

Without GitHub's header above it, the web view has no top edge. A lead opening it sees a sidebar and a page with nothing naming the product. So the web view gets its own banner. The banner follows the layout of GitHub's top header, so it feels familiar, and carries Raiden's name and brand color, so it is clearly Raiden.

The web view is a companion to GitHub, not a replacement. Issues are still edited on github.com.

## Success Metrics

- A lead can open the Raiden pages without first opening github.com.
- A lead can install the web view and launch it in its own window.
- A lead who opens the web view can name the product from the banner alone.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Raiden pages in a standalone web view; Install the web view as an app; Raiden banner across the top of the web view

## User Stories

### Story #31: Raiden pages in a standalone web view

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** to open the Raiden pages at their own web address, **so that** I can plan without opening a GitHub repository first.

#### Acceptance Criteria

- [ ] **Given** the web view address, **when** a lead opens it in a browser, **then** the sidebar and the Grooming page show with the same content and controls as the Raiden tab.
- [ ] **Given** the web view is open, **when** the page loads, **then** no browser extension is needed and no GitHub page appears around the Raiden pages.
- [ ] **Given** the system is set to dark mode, **when** a lead opens the web view, **then** it shows in the dark theme, and in the light theme when the system is set to light mode.
- [ ] **Given** a lead collapsed the sidebar or hid issues, **when** they reload the web view, **then** the sidebar and the issues show as they left them.

#### Notes

The Raiden pages are already host-agnostic, so this story adds a second host beside the extension.

### Story #32: Install the web view as an app

- **story_type:** user
- **size:** S

**As an** engineering lead, **I want** to install the web view as an app, **so that** I can launch Raiden from my dock or start menu.

#### Acceptance Criteria

- [ ] **Given** a browser that supports installable web apps, **when** a lead opens the web view, **then** the browser offers to install it.
- [ ] **Given** the web view is installed, **when** a lead launches it, **then** it opens in its own window with no address bar, under the name Raiden and the Raiden icon.
- [ ] **Given** the web view is installed and the device is offline, **when** a lead launches it, **then** it shows a Raiden message that it needs a connection instead of the browser's error page.

### Story #33: Raiden banner across the top of the web view

- **story_type:** user
- **size:** M

**As an** engineering lead, **I want** a Raiden banner at the top of the web view, **so that** the view has a clear top edge and says which product I am in.

#### Acceptance Criteria

- [ ] **Given** the web view is open, **when** the page shows, **then** a banner spans the full width above the sidebar and the page, with the height and layout of GitHub's top header.
- [ ] **Given** the banner shows, **when** a lead looks at its left end, **then** it carries the Raiden mark and name in Raiden's brand color.
- [ ] **Given** the light or the dark theme, **when** the banner shows, **then** its text meets a 4.5:1 contrast ratio against its ground.
- [ ] **Given** a page longer than the window, **when** a lead scrolls it, **then** the banner stays at the top of the window.

## Assumptions

- The web view shows the same sample data the Raiden tab shows today; live GitHub data is a separate epic.
- The banner's mark is the existing Raiden icon, followed by the word "Raiden" in the display typeface.
- The team serves the web view from its own Raiden host, an S3 bucket behind CloudFront. This epic delivers the web view as static files; setting up that hosting is separate work.

## Out of Scope

- Signing in to GitHub from the web view.
- Search, notifications and an account menu in the banner, as GitHub's header has.
- Any change to the Raiden tab inside github.com.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #31 | none |
| #32 | #31 |
| #33 | #31 |
