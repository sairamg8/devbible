---
title: "Webpack — Overview"
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

**21 topics** across 16 sections.

| # | Section | Topics |
|---|---|---|
| 01 | [Core concepts](pages/01-core-concepts/01-five-core-concepts-and-module-graph.md) | 1 |
| 02 | [Configuration](pages/02-configuration/01-entry-and-output-deep-dive.md) | 1 |
| 03 | [Module resolution](pages/03-module-resolution/01-the-resolve-object.md) | 1 |
| 04 | [Loaders](pages/04-loaders/01-transpilation-and-style-loaders.md) | 2 |
| 05 | [Asset modules](pages/05-asset-modules/01-built-in-asset-types.md) | 1 |
| 06 | [Plugins](pages/06-plugins/01-essential-plugins.md) | 1 |
| 07 | [Code splitting](pages/07-code-splitting/01-splitting-strategies.md) | 1 |
| 08 | [Optimization](pages/08-optimization/01-production-optimizations.md) | 1 |
| 09 | [Dev server and hmr](pages/09-dev-server-and-hmr/01-dev-server-and-hot-module-replacement.md) | 1 |
| 10 | [Caching strategies](pages/10-caching-strategies/01-long-term-caching.md) | 1 |
| 11 | [Module federation](pages/11-module-federation/01-fundamentals-remotes-and-exposes.md) | 5 |
| 12 | [Source maps](pages/12-source-maps/01-devtool-options.md) | 1 |
| 13 | [Multi config and environment](pages/13-multi-config-and-environment/01-config-composition.md) | 1 |
| 14 | [Performance analysis](pages/14-performance-analysis/01-diagnostics-and-bundle-analysis.md) | 1 |
| 15 | [Advanced custom tooling](pages/15-advanced-custom-tooling/01-custom-loaders-and-plugins.md) | 1 |
| 16 | [Real world workflows and recipes](pages/16-real-world-workflows-and-recipes/01-diagnosing-a-bloated-bundle.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="webpack" compact />
