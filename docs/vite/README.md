---
title: "Vite — Overview"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution Validation in progress — 11 of 16 imported topics done

These pages were **moved in from the separate `frontend-bible` repo as-is** on
2026-08-14, written to a four-section standard: *Under-The-Hood Mechanics →
Real-World Scenario → Production-Grade Code → Senior Edge Cases*.

**Topics 01–11 have been re-validated against the Vite 8 documentation** and now
carry a tier badge, a `> Verified:` line, a `> Validated:` stamp, `## Gotchas`
and `## Interview questions`. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.

🔴 **Vite 8 unified on Rolldown.** `vite@8.2.2` depends on `rolldown` and *not*
on Rollup; esbuild is only an optional peer. Anything you read elsewhere about
"esbuild in dev, Rollup in prod" describes Vite 7 and earlier — and the **plugin
API** changed with it: the docs now open with *"Vite plugins extends Rolldown's
plugin interface"*, where through v7 that sentence named Rollup.

**Topics 12–16 are still the unvalidated import.** They have no `> Verified:`
line, no tier badge and no Interview questions section, and some of them target
older major versions. Treat those as a strong draft, not as verified reference.

:::

**17 topics.** ✅ = re-validated against the Vite 8 docs · 🆕 = written new, not imported.

🆕 **Topic 17 answers the questions the rest of the track cannot**, because they are about the
tools *around* Vite: is webpack still relevant, is Babel, what can webpack do that Vite cannot,
and what else does a 2026 frontend project have to choose. Every version in it was fetched from
`registry.npmjs.org` on 2026-09-07.

| # | Section | Topics |
|---|---|---|
| 01 | [Core architecture](pages/01-core-architecture/01-dual-engine-model.md) ✅ | 1 |
| 02 | [Cli and scaffolding](pages/02-cli-and-scaffolding/01-commands-and-templates.md) ✅ | 1 |
| 03 | [Configuration](pages/03-configuration/01-vite-config-file.md) ✅ | 1 |
| 04 | [Dev server mechanics](pages/04-dev-server-mechanics/01-native-esm-and-hmr.md) ✅ | 1 |
| 05 | [Build system rollup](pages/05-build-system-rollup/01-build-options.md) ✅ | 1 |
| 06 | [Asset handling](pages/06-asset-handling/01-static-asset-imports.md) ✅ | 1 |
| 07 | [Env variables and modes](pages/07-env-variables-and-modes/01-environment-system.md) ✅ | 18 |
| 08 | [Plugin system](pages/08-plugin-system/01-plugin-api.md) ✅ | 42 |
| 09 | [Css handling](pages/09-css-handling/01-styling-pipeline.md) ✅ | 10 |
| 10 | [Ssr support](pages/10-ssr-support/01-server-side-rendering-primitives.md) ✅ | 11 |
| 11 | [Optimization and performance](pages/11-optimization-and-performance/01-build-time-performance.md) ✅ | 10 |
| 12 | [Path resolution and aliases](pages/12-path-resolution-and-aliases/01-resolve-options.md) ✅ | 15 |
| 13 | [Worker and wasm support](pages/13-worker-and-wasm-support/01-advanced-runtime-targets.md) ✅ | 5 |
| 14 | [Testing integration](pages/14-testing-integration/01-vitest-relationship.md) ✅ | 10 |
| 15 | [Deployment considerations](pages/15-deployment-considerations/01-shipping-the-build.md) ✅ | 15 |
| 16 | [Migration recipes](pages/16-migration-recipes/01-cra-to-vite-migration.md) ✅ | 15 |
| 17 | [The 2026 toolchain landscape](pages/17-the-2026-toolchain-landscape/01-the-2026-bundler-landscape.md) ✅ 🆕 | 6 |

import Progress from '@site/src/components/Progress';

<Progress lang="vite" compact />
