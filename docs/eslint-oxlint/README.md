---
title: "ESLint & Oxlint — Overview"
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

**21 topics** across 21 sections.

| # | Section | Topics |
|---|---|---|
| 01 | [Linting landscape and tooling decisions](pages/01-linting-landscape-and-tooling-decisions/01-why-choose-and-boundaries.md) | 1 |
| 02 | [Eslint core architecture](pages/02-eslint-core-architecture/01-pipeline-and-legacy-config.md) | 1 |
| 03 | [Eslint flat config](pages/03-eslint-flat-config/01-forms-fields-and-composition.md) | 1 |
| 04 | [Eslint language options globals and parsing](pages/04-eslint-language-options-globals-and-parsing/01-language-options-and-file-targeting.md) | 1 |
| 05 | [Eslint rules system](pages/05-eslint-rules-system/01-severity-core-rules-and-presets.md) | 1 |
| 06 | [Eslint plugin ecosystem](pages/06-eslint-plugin-ecosystem/01-plugins-frontend-node-and-pitfalls.md) | 1 |
| 07 | [Typescript eslint](pages/07-typescript-eslint/01-architecture-type-aware-and-stacks.md) | 1 |
| 08 | [Eslint cli output cache and fixes](pages/08-eslint-cli-output-cache-and-fixes/01-cli-and-programmatic-usage.md) | 1 |
| 09 | [Eslint suppressions ignores and governance](pages/09-eslint-suppressions-ignores-and-governance/01-disables-ignores-and-governance.md) | 1 |
| 10 | [Custom eslint rules and processors](pages/10-custom-eslint-rules-and-processors/01-authoring-testing-and-processors.md) | 1 |
| 11 | [Eslint editor and local workflow](pages/11-eslint-editor-and-local-workflow/01-ide-hooks-and-scripts.md) | 1 |
| 12 | [Oxlint core architecture](pages/12-oxlint-core-architecture/01-what-oxlint-is-and-vs-eslint.md) | 1 |
| 13 | [Oxlint installation cli and config files](pages/13-oxlint-installation-cli-and-config-files/01-install-cli-and-config-schema.md) | 1 |
| 14 | [Oxlint native plugins and rule coverage](pages/14-oxlint-native-plugins-and-rule-coverage/01-plugins-and-categories.md) | 1 |
| 15 | [Oxlint type aware linting and multi file analysis](pages/15-oxlint-type-aware-linting-and-multi-file-analysis/01-type-aware-and-multi-file.md) | 1 |
| 16 | [Oxlint js plugins and extensibility](pages/16-oxlint-js-plugins-and-extensibility/01-js-plugins-and-custom-rules.md) | 1 |
| 17 | [Oxlint fixes ignores and diagnostics](pages/17-oxlint-fixes-ignores-and-diagnostics/01-fixes-ignores-and-diagnostics.md) | 1 |
| 18 | [Coexistence eslint and oxlint](pages/18-coexistence-eslint-and-oxlint/01-dual-run-overlap-and-retirement.md) | 1 |
| 19 | [Migration paths](pages/19-migration-paths/01-legacy-flat-oxlint-and-phased.md) | 1 |
| 20 | [Ci monorepos and performance engineering](pages/20-ci-monorepos-and-performance-engineering/01-ci-monorepos-and-perf.md) | 1 |
| 21 | [Real world workflows and recipes](pages/21-real-world-workflows-and-recipes/01-bootstrap-migration-and-day-to-day.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="eslint-oxlint" compact />
