---
title: "Frontend Architecture — Overview"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution Imported corpus — not yet validated

These pages were **moved in from the separate `frontend-bible` repo as-is**, on
2026-08-14. They are complete, readable and were written to a four-section
standard: *Under-The-Hood Mechanics → Real-World Scenario → Production-Grade Code
→ Senior Edge Cases*.

They do **not yet** meet this bible's page contract. Still outstanding:

- **no `> Verified:` line** — nothing here has been re-checked against current
  documentation, and some of it targets older major versions
- **no tier badge** — every topic still needs a Master / Understand / Know / When
  Needed judgement
- **no Interview questions section**
- a few cross-technology references were **de-linked** during the move because
  their targets are not part of this import

Treat the content as a strong draft, not as verified reference.

:::

**15 topics** across 15 sections.

| # | Section | Topics |
|---|---|---|
| 01 | [Project structure and organization](pages/01-project-structure-and-organization/01-folder-strategy.md) | 1 |
| 02 | [Component architecture](pages/02-component-architecture/01-composition-patterns.md) | 1 |
| 03 | [State management decision tree](pages/03-state-management-decision-tree/01-choosing-the-right-tool.md) | 1 |
| 04 | [Data layer and api architecture](pages/04-data-layer-and-api-architecture/01-structuring-the-data-boundary.md) | 1 |
| 05 | [Routing and navigation architecture](pages/05-routing-and-navigation-architecture/01-real-world-routing-concerns.md) | 1 |
| 06 | [Styling architecture](pages/06-styling-architecture/01-choosing-and-scaling-a-styling-approach.md) | 1 |
| 07 | [Monorepo and multi app strategy](pages/07-monorepo-and-multi-app-strategy/01-scaling-beyond-one-app.md) | 1 |
| 08 | [Environment and configuration management](pages/08-environment-and-configuration-management/01-config-across-environments.md) | 1 |
| 09 | [Authentication and authorization architecture](pages/09-authentication-and-authorization-architecture/01-real-world-auth-concerns.md) | 1 |
| 10 | [Error handling and resilience](pages/10-error-handling-and-resilience/01-designing-for-failure.md) | 1 |
| 11 | [Observability and monitoring](pages/11-observability-and-monitoring/01-knowing-whats-happening-in-production.md) | 1 |
| 12 | [Ci cd pipeline design](pages/12-ci-cd-pipeline-design/01-shipping-safely.md) | 1 |
| 13 | [Testing strategy](pages/13-testing-strategy/01-the-real-world-testing-pyramid.md) | 1 |
| 14 | [Performance and scalability patterns](pages/14-performance-and-scalability-patterns/01-architecting-for-scale.md) | 1 |
| 15 | [Team and collaboration practices](pages/15-team-and-collaboration-practices/01-process-as-architecture.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="frontend-architecture" compact />
