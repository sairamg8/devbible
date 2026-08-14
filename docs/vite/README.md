---
title: "Vite — Overview"
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
| 01 | [Core architecture](pages/01-core-architecture/01-dual-engine-model.md) | 1 |
| 02 | [Cli and scaffolding](pages/02-cli-and-scaffolding/01-commands-and-templates.md) | 1 |
| 03 | [Configuration](pages/03-configuration/01-vite-config-file.md) | 1 |
| 04 | [Dev server mechanics](pages/04-dev-server-mechanics/01-native-esm-and-hmr.md) | 1 |
| 05 | [Build system rollup](pages/05-build-system-rollup/01-build-options.md) | 1 |
| 06 | [Asset handling](pages/06-asset-handling/01-static-asset-imports.md) | 1 |
| 07 | [Env variables and modes](pages/07-env-variables-and-modes/01-environment-system.md) | 1 |
| 08 | [Plugin system](pages/08-plugin-system/01-plugin-api.md) | 1 |
| 09 | [Css handling](pages/09-css-handling/01-styling-pipeline.md) | 1 |
| 10 | [Ssr support](pages/10-ssr-support/01-server-side-rendering-primitives.md) | 1 |
| 11 | [Optimization and performance](pages/11-optimization-and-performance/01-build-time-performance.md) | 1 |
| 12 | [Path resolution and aliases](pages/12-path-resolution-and-aliases/01-resolve-options.md) | 1 |
| 13 | [Worker and wasm support](pages/13-worker-and-wasm-support/01-advanced-runtime-targets.md) | 1 |
| 14 | [Testing integration](pages/14-testing-integration/01-vitest-relationship.md) | 1 |
| 15 | [Deployment considerations](pages/15-deployment-considerations/01-shipping-the-build.md) | 1 |
| 16 | [Migration recipes](pages/16-migration-recipes/01-cra-to-vite-migration.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="vite" compact />
