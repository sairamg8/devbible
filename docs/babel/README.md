---
title: "Babel — Overview"
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
| 01 | [Why babel and the compiler landscape](pages/01-why-babel-and-the-compiler-landscape/01-what-babel-is-and-when-it-matters.md) | 1 |
| 02 | [Core compilation pipeline](pages/02-core-compilation-pipeline/01-parse-transform-generate-and-api.md) | 1 |
| 03 | [Configuration system](pages/03-configuration-system/01-config-files-root-env-overrides.md) | 1 |
| 04 | [Presets](pages/04-presets/01-env-react-typescript-and-framework.md) | 1 |
| 05 | [Plugin ecosystem](pages/05-plugin-ecosystem/01-syntax-transform-stage-macros.md) | 1 |
| 06 | [Authoring custom plugins](pages/06-authoring-custom-plugins/01-visitors-paths-types-and-testing.md) | 1 |
| 07 | [Typescript and jsx handling](pages/07-typescript-and-jsx-handling/01-type-stripping-unsupported-and-jsx-runtime.md) | 1 |
| 08 | [Build tool integration](pages/08-build-tool-integration/01-webpack-vite-jest-rollup.md) | 1 |
| 09 | [Linter and type checker interop](pages/09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md) | 1 |
| 10 | [Source maps and debugging](pages/10-source-maps-and-debugging/01-maps-and-inspecting-output.md) | 1 |
| 11 | [Performance and caching](pages/11-performance-and-caching/01-cost-caching-and-surface-reduction.md) | 1 |
| 12 | [Monorepo and multi package strategies](pages/12-monorepo-and-multi-package-strategies/01-shared-root-and-cross-package.md) | 1 |
| 13 | [Cli and programmatic tooling](pages/13-cli-and-programmatic-tooling/01-cli-and-codemods.md) | 1 |
| 14 | [Nodejs backend usage](pages/14-nodejs-backend-usage/01-register-and-esm-cjs.md) | 1 |
| 15 | [Migration and decision recipes](pages/15-migration-and-decision-recipes/01-swc-esbuild-keep-or-audit.md) | 1 |
| 16 | [Real world workflows and recipes](pages/16-real-world-workflows-and-recipes/01-setup-debug-and-migrate.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="babel" compact />
