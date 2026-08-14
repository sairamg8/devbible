---
title: "Jest & RTL — Overview"
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
| 01 | [Jest core concepts](pages/01-jest-core-concepts/01-test-structure.md) | 1 |
| 02 | [Assertions and matchers](pages/02-assertions-and-matchers/01-the-expect-api.md) | 1 |
| 03 | [Mocking](pages/03-mocking/01-jest-mock-functions.md) | 1 |
| 04 | [Async testing](pages/04-async-testing/01-handling-asynchrony.md) | 1 |
| 05 | [Snapshot testing](pages/05-snapshot-testing/01-snapshot-mechanics.md) | 1 |
| 06 | [Coverage and configuration](pages/06-coverage-and-configuration/01-jest-config.md) | 1 |
| 07 | [Rtl core philosophy](pages/07-rtl-core-philosophy/01-guiding-principle.md) | 1 |
| 08 | [Rtl queries](pages/08-rtl-queries/01-query-variants-and-priority.md) | 1 |
| 09 | [User interaction](pages/09-user-interaction/01-simulating-input.md) | 1 |
| 10 | [Async utilities](pages/10-async-utilities/01-waiting-for-updates.md) | 1 |
| 11 | [Custom render](pages/11-custom-render/01-provider-wrapping.md) | 1 |
| 12 | [Mocking network requests](pages/12-mocking-network-requests/01-api-level-mocking.md) | 1 |
| 13 | [Testing hooks](pages/13-testing-hooks/01-render-hook.md) | 1 |
| 14 | [Accessibility testing](pages/14-accessibility-testing/01-a11y-assertions.md) | 1 |
| 15 | [Debugging tests](pages/15-debugging-tests/01-diagnostic-tools.md) | 1 |
| 16 | [Real world workflows and recipes](pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="jest-rtl" compact />
