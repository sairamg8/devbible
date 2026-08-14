---
title: "Redux Toolkit — Overview"
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

**16 topics** across 13 sections.

| # | Section | Topics |
|---|---|---|
| 01 | [Store setup](pages/01-store-setup/01-configure-store.md) | 1 |
| 02 | [Slices and actions](pages/02-slices-and-actions/01-create-slice.md) | 2 |
| 03 | [Async thunks](pages/03-async-thunks/01-create-async-thunk.md) | 1 |
| 04 | [Rtk query](pages/04-rtk-query/01-api-slice-and-endpoints.md) | 2 |
| 05 | [Selectors and normalization](pages/05-selectors-and-normalization/01-create-selector-and-reselect.md) | 2 |
| 06 | [Middleware](pages/06-middleware/01-default-middleware-and-listener-middleware.md) | 1 |
| 07 | [React redux integration](pages/07-react-redux-integration/01-hooks-api.md) | 1 |
| 08 | [Immutability and immer](pages/08-immutability-and-immer/01-immer-internals.md) | 1 |
| 09 | [Typescript integration](pages/09-typescript-integration/01-type-inference-patterns.md) | 1 |
| 10 | [Devtools and debugging](pages/10-devtools-and-debugging/01-redux-devtools.md) | 1 |
| 11 | [Code splitting](pages/11-code-splitting/01-dynamic-reducer-injection.md) | 1 |
| 12 | [Testing](pages/12-testing/01-testing-redux-logic.md) | 1 |
| 13 | [Migration](pages/13-migration/01-from-classic-redux.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="redux-toolkit" compact />
