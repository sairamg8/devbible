---
title: "Redux Toolkit — Explanations"
sidebar_label: "Explanations"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Redux Toolkit, Reselect, Immer and React-Redux documentation for
> **@reduxjs/toolkit 2.12.0**. Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

**The 21 explanation pages, in reading order.** Each one carries its own tier badge, its sources, a
`## Gotchas` section and a `## Interview questions` section. Start at
[`configureStore`](./01-store-setup/01-configure-store.md) and follow the footers; the `Next →` link at
the bottom of every page is the reading order.

See the [track overview](../README.md) for what was corrected during the 2026-09-06 re-validation and
why the RTK 1 / RTK 2 distinction runs through the whole track.

## Chunks

| # | Page | Tier |
|---|---|---|
| 01 | [`configureStore`](./01-store-setup/01-configure-store.md) | Master |
| 02 | [`createSlice`](./02-slices-and-actions/01-create-slice.md) | Master |
| 03 | [Slice selectors & the creator callback](./02-slices-and-actions/01b-slice-selectors-and-creator-callback.md) | Understand |
| 04 | [`createAction` & matchers](./02-slices-and-actions/02-create-action-and-matchers.md) | Understand |
| 05 | [`createAsyncThunk`](./03-async-thunks/01-create-async-thunk.md) | Master |
| 06 | [Cancellation, races & limits](./03-async-thunks/01b-cancellation-races-and-limits.md) | Understand |
| 07 | [RTK Query](./04-rtk-query/01-api-slice-and-endpoints.md) | Master |
| 08 | [`queryFn`, transforms & infinite queries](./04-rtk-query/01b-queryfn-transforms-and-infinite-queries.md) | Understand |
| 09 | [RTK Query cache](./04-rtk-query/02-cache-management-and-invalidation.md) | Understand |
| 10 | [Optimistic & manual cache updates](./04-rtk-query/02b-optimistic-and-manual-cache-updates.md) | Understand |
| 11 | [`createSelector`](./05-selectors-and-normalization/01-create-selector-and-reselect.md) | Understand |
| 12 | [`createEntityAdapter`](./05-selectors-and-normalization/02-create-entity-adapter.md) | Understand |
| 13 | [Middleware & `listenerMiddleware`](./06-middleware/01-default-middleware-and-listener-middleware.md) | Understand |
| 14 | [React-Redux hooks](./07-react-redux-integration/01-hooks-api.md) | Master |
| 15 | [Immer internals](./08-immutability-and-immer/01-immer-internals.md) | Understand |
| 16 | [TypeScript integration](./09-typescript-integration/01-type-inference-patterns.md) | Understand |
| 17 | [Redux DevTools](./10-devtools-and-debugging/01-redux-devtools.md) | Know |
| 18 | [Code splitting](./11-code-splitting/01-dynamic-reducer-injection.md) | When Needed |
| 19 | [Testing Redux logic](./12-testing/01-testing-redux-logic.md) | Understand |
| 20 | [Testing thunks & RTK Query](./12-testing/01b-testing-thunks-and-rtk-query.md) | Understand |
| 21 | [Migrating from classic Redux](./13-migration/01-from-classic-redux.md) | Know |

## Where this connects

- [Track overview](../README.md) — the version spine and the re-validation record
