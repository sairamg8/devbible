---
title: "Redux Toolkit — Overview"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Redux Toolkit, Reselect, Immer and React-Redux documentation for
> **@reduxjs/toolkit 2.12.0** · **react-redux 9.3.0** · Reselect 5 · Immer 10 · redux-thunk 3.
> Documentation-validated across all 21 pages; **no sandbox run** — `@reduxjs/toolkit` is not installed
> in this checkout, so every claim in this track is a documentation quote rather than a runtime probe.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

**Redux Toolkit is the official, batteries-included way to write Redux, and this track teaches it
against RTK 2.** That version matters more than it usually does: RTK 2.0 changed three of the things
every older tutorial explains — the default middleware stack, selector memoization, and how a reducer is
injected at runtime — so a great deal of still-current-looking advice is describing RTK 1.x.

🔴 **These 21 pages were imported from a separate repository on 2026-08-14 and carried that exact
problem.** A full re-validation on 2026-09-06 corrected ten defects against primary sources — including
a `store.inject()` call that does not exist, a middleware stack listed in the wrong order and missing a
member, a "cache size of 1" claim that Reselect 5 made false, and testing advice that inverted Redux's
own guide. Every page now carries its provenance on the line above its first heading. The full record is
in the commit history and in `research_redux_toolkit_track.md` in the memory store.

## Chunks

| # | Section | Pages | Covers |
|---|---|---:|---|
| 01 | [Store setup](pages/01-store-setup/01-configure-store.md) | 1 | `configureStore`, the default middleware stack **in its real order**, SSR store factories |
| 02 | [Slices and actions](pages/02-slices-and-actions/01-create-slice.md) | 3 | `createSlice` and Immer wrapping · slice selectors and the creator callback · `createAction` and all seven matchers |
| 03 | [Async thunks](pages/03-async-thunks/01-create-async-thunk.md) | 2 | the lifecycle, `thunkAPI`, `condition`, `unwrap` · 🔴 cancellation, `requestId` races and the limits of thunks |
| 04 | [RTK Query](pages/04-rtk-query/01-api-slice-and-endpoints.md) | 4 | `createApi` and the three endpoint types · `queryFn`, transforms, infinite queries · tags and invalidation · optimistic and manual cache updates |
| 05 | [Selectors and normalization](pages/05-selectors-and-normalization/01-create-selector-and-reselect.md) | 2 | 🔴 `weakMapMemoize` and what it retired · `createEntityAdapter` |
| 06 | [Middleware](pages/06-middleware/01-default-middleware-and-listener-middleware.md) | 1 | the chain, `listenerMiddleware` as the saga replacement, `createDynamicMiddleware` |
| 07 | [React-Redux integration](pages/07-react-redux-integration/01-hooks-api.md) | 1 | `useSelector`'s comparison rule, typed hooks, why object literals re-render everything |
| 08 | [Immutability and Immer](pages/08-immutability-and-immer/01-immer-internals.md) | 1 | drafts, structural sharing, mutate-or-return, what Immer will and will not draft |
| 09 | [TypeScript integration](pages/09-typescript-integration/01-type-inference-patterns.md) | 1 | `RootState`/`AppDispatch`, `withTypes`, `Tuple`, the circular-import trap |
| 10 | [DevTools and debugging](pages/10-devtools-and-debugging/01-redux-devtools.md) | 1 | time-travel and what breaks it, sanitizers, trace mode |
| 11 | [Code splitting](pages/11-code-splitting/01-dynamic-reducer-injection.md) | 1 | 🔴 `combineSlices` injection — on the reducer, not the store — and `withLazyLoadedSlices` |
| 12 | [Testing](pages/12-testing/01-testing-redux-logic.md) | 2 | 🔴 what Redux actually recommends · testing thunks and endpoints |
| 13 | [Migration](pages/13-migration/01-from-classic-redux.md) | 1 | incremental conversion, saga coexistence, what RTK does *not* fix |

## Phase gate

You are done with this track when you can stand up a store from scratch with the right middleware for
the app in front of you, decide correctly between `createAsyncThunk` and RTK Query for a given piece of
async work, explain why a component re-renders on an unrelated dispatch and fix it, and read a piece of
Redux advice on the internet and tell whether it was written for RTK 1 or RTK 2.

## Where this connects

- [React](../react/README.md) — the rendering model `useSelector` is optimising against
- [TypeScript](../typescript/README.md) — the inference machinery the typed-hooks pattern relies on
- [TanStack Query](../tanstack-query/README.md) — the other answer to server state; RTK Query is the one that lives in the store
- [Jest & RTL](../jest-rtl/README.md) — the renderer the testing chapter's integration tests run in

import Progress from '@site/src/components/Progress';

<Progress lang="redux-toolkit" compact />
