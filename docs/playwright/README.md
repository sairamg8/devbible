---
title: "Playwright — Overview"
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

**16 topics** across 16 sections.

| # | Section | Topics |
|---|---|---|
| 01 | [Core architecture](pages/01-core-architecture/01-browser-automation-model.md) | 1 |
| 02 | [Test runner](pages/02-test-runner/01-playwright-test-fixtures.md) | 1 |
| 03 | [Locators](pages/03-locators/01-locator-api.md) | 1 |
| 04 | [Actions and interactions](pages/04-actions-and-interactions/01-interaction-primitives.md) | 1 |
| 05 | [Auto waiting and assertions](pages/05-auto-waiting-and-assertions/01-web-first-assertions.md) | 1 |
| 06 | [Navigation and network](pages/06-navigation-and-network/01-navigation-and-interception.md) | 1 |
| 07 | [Authentication and state](pages/07-authentication-and-state/01-session-reuse.md) | 1 |
| 08 | [Fixtures and test isolation](pages/08-fixtures-and-test-isolation/01-fixture-system.md) | 1 |
| 09 | [Visual and screenshot testing](pages/09-visual-and-screenshot-testing/01-visual-regression.md) | 1 |
| 10 | [Debugging tools](pages/10-debugging-tools/01-diagnostic-tooling.md) | 1 |
| 11 | [Parallelism and sharding](pages/11-parallelism-and-sharding/01-scaling-test-runs.md) | 1 |
| 12 | [Component testing](pages/12-component-testing/01-experimental-ct-runner.md) | 1 |
| 13 | [Api testing](pages/13-api-testing/01-request-fixture.md) | 1 |
| 14 | [Ci integration](pages/14-ci-integration/01-playwright-config.md) | 1 |
| 15 | [Advanced patterns](pages/15-advanced-patterns/01-scalable-test-architecture.md) | 1 |
| 16 | [Real world workflows and recipes](pages/16-real-world-workflows-and-recipes/01-diagnosing-flaky-ci-tests.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="playwright" compact />
