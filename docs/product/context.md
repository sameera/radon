---
product: Raiden
last_updated: 2026-11-13
---

# Product Context

## Product Overview

Raiden is a self-hostable Chrome extension that injects agile views into GitHub Projects pages: sprint goals and a hierarchical timeline that GitHub Projects lacks. It is built first for teams running the Nexus pipeline, where epics, stories and decision records are GitHub issues linked as parent/sub-issues.

- **Category**: Developer / project-management tool, self-hosted, Chrome extension (Manifest V3)
- **Distribution**: Self-hosted per team <!-- Inferred: "self hostable for any team"; open-source assumed — TODO: verify licence -->

## Vision & Strategy

<!-- TODO: vision statement in your words -->

- **First milestone**: Integrate into GitHub Project views and insert views that display and edit sprint goals.
- **Strategic rule**: Optimized for Nexus conventions. Support for generic GitHub Projects is welcome only when it costs Nexus projects nothing.

## Anti-goals

- **No multi-tenant SaaS.** Each team self-hosts.
- **No standalone app replacing GitHub.** Users stay on github.com.
- **No issue editing in Raiden.** Issues, fields and iterations are edited in GitHub directly. Raiden edits only its own data (e.g. sprint goals).
- **No generic-project feature that degrades the Nexus experience.**

## Personas

### Primary: Engineering lead (Nexus)

Plans epics with `/nxs.epic`, approves decision records, owns delivery across sprints.

- **Jobs to be done**: See whether each epic will land, by rolling stories up to epics on a timeline; spot blocked or unplanned stories.
- **Pain points**: GitHub Projects shows a flat item list; no epic → story roll-up over time; the Nexus hierarchy (epic, stories, decision record, blocked-by) is invisible in board views.

### Primary: Scrum master

Runs sprints on GitHub Projects iterations.

- **Jobs to be done**: Set a sprint goal, keep the team aligned to it during the sprint, review it at sprint end.
- **Pain points**: Iterations have dates but no goal; goals live in chat or docs, away from the board.

### Secondary: Developer

<!-- TODO: verify -->

- **Jobs to be done**: See the current sprint goal and where their story sits in its epic, without leaving the board.

## Domain Context

- Agile delivery on GitHub Projects V2: iterations are a project field; hierarchy comes from sub-issues; dependencies from blocked-by links.
- Nexus adds conventions on top: epic issues with story sub-issues and a decision-record sub-issue; `needs-design` → `in-progress` labels; issue types or labels for classification.
- A Manifest V3 extension depends on github.com's DOM; GitHub UI changes can break injected views without notice.

## Industry Benchmarks

| Metric | Benchmark | Note |
| ------ | --------- | ---- |
| Extension 30-day retention | ~50% or lower is typical | <!-- TODO: verify --> |
| Activation | First sprint goal set in first session | Raiden-defined |

## Regulatory & Compliance

| Area | Requirement | Applies When |
| ---- | ----------- | ------------ |
| GitHub App permissions | Minimal scopes; read access to issues/projects, no issue write | Always |
| Chrome Web Store | Privacy disclosure; host permissions limited to `github.com` and the team's Raiden host | Publishing to the store |
| Data residency | Raiden data stays in the team's own AWS account | Self-hosting; regulated teams apply their own policies |

## Competitive Landscape

| Competitor | Model | Gap Raiden fills |
| ---------- | ----- | --------------- |
| ZenHub | Paid SaaS; browser extension inside GitHub with sprints, epics, roadmaps | Closest analog. Own data model, not self-hosted, unaware of Nexus |
| GitHub Projects (native) | Roadmap layout, iterations | No sprint goals, no hierarchy roll-up |
| Linear, Jira | Separate tools | Require leaving GitHub |

**Table stakes**: sprint goal per iteration, sprint progress, epic roll-up timeline.

## Success Metrics

- **North star**: Share of sprints on Nexus teams with a goal set and reviewed. <!-- TODO: confirm -->
- **Impact thresholds**: High >20% of users, Medium 5–20%, Low <5%.
- **Effort justified**: High = up to 4 weeks, Medium = up to 2 weeks, Low = <1 week.

## Product Principles

1. **Stay inside GitHub.** Never make the user switch tools.
2. **Nexus first.** Generic support never costs Nexus users.
3. **GitHub is the source of truth.** Issues are edited in GitHub; Raiden stores and edits only what GitHub cannot hold.
4. **Team-owned.** Self-hosted; the team owns its data.

## Company Scale

- **Stage**: Pre-launch, no users.
- **Team size**: <!-- TODO -->
