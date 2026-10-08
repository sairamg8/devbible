---
name: link-map-redux-toolkit-04
description: Link map, Redux Toolkit topics T16–T21 (TypeScript integration, Redux DevTools, code splitting with combineSlices, testing Redux logic, testing thunks and RTK Query, migrating from classic Redux) — the best explanation per topic, fetched and read 2026-10-05
metadata:
  type: reference
---

# Link map · Redux Toolkit · T16–T21 (sections 09–13)

All 6 topics are ✅ written. Topic numbers follow `docs/redux-toolkit/pages/README.md`. Canonical `redux.js.org` addresses.
Legend and rules: [01-store-slices-thunks.md](01-store-slices-thunks.md) · [../../CURSOR-LINK-MAP.md](../../CURSOR-LINK-MAP.md).
**T20 is the first topic where no good current page exists for part of our angle** — flagged below, and it is ours to own.

---

### T16 · TypeScript integration — Understand · ✅ `docs/redux-toolkit/pages/09-typescript-integration/01-type-inference-patterns.md`
- **Read this:** [Usage with TypeScript](https://redux.js.org/usage/usage-with-typescript) · redux.js.org · the standard RTK project setup (≈3.2k words): defining `RootState` and `AppDispatch`, typed hooks with `.withTypes()` (added in React Redux 9.1.0; kept in their own file to avoid circular imports), typing slices, reducers, middleware and thunks, typing `useSelector`, `useDispatch` and `connect`; notes that importing `RootState` into a slice file is a circular import TypeScript tolerates for types · covers our angle: **partial** — `Tuple` for middleware arrays is on the page below · fetched 2026-10-05
- **Also good:** [Redux Toolkit → Usage with TypeScript](https://redux.js.org/toolkit/usage/usage-with-typescript) · redux.js.org · per-API typing (≈5k words): the `configureStore` state and dispatch types, `Tuple` with `.concat()` / `.prepend()` and without `getDefaultMiddleware`, `createSlice` (`extraReducers`, thunks inside a slice), `createAsyncThunk` (typing `thunkApi`, a pre-typed `createAsyncThunk`), `createEntityAdapter`; plus the note that `thunkApi` types cannot include state or dispatch without becoming circular · fetched 2026-10-05
- *Checked, not chosen:* LogRocket "Using TypeScript with Redux Toolkit" (2023, edited 2024, ≈2.2k words) — no mention of `Tuple`, the RTK 2 rule for typed middleware arrays.

### T17 · Redux DevTools — Know · ✅ `docs/redux-toolkit/pages/10-devtools-and-debugging/01-redux-devtools.md`
- **Read this:** [Debugging Redux → Redux DevTools](https://redux.js.org/usage/debugging#redux-devtools) · redux.js.org · reading the action history; time travel (Jump, Skip, Reset, Revert, Commit) and why it only holds while reducers are pure — a different UI after jumping back means state outside the store or a side effect in a reducer; dispatching by hand; enabling traces and the other options (`trace`, `traceLimit`, `maxAge`, `actionSanitizer`, `stateSanitizer`, allow and deny lists); the RTK Query tab; use without the extension · covers our angle: full · fetched 2026-10-05
- **Also good:** [Redux DevTools extension → API → Arguments](https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Arguments.md) · github.com/reduxjs · the full options reference (≈2k words): `name`, `actionCreators`, `latency`, `maxAge`, `trace`, `traceLimit`, `serialize`, `actionSanitizer`, `stateSanitizer`, `predicate` · fetched 2026-10-05
- *Not opened:* aggregator and course-style pages that search surfaced; the two pages above are the maintainers' own.

### T18 · Code splitting with `combineSlices` — When Needed · ✅ `docs/redux-toolkit/pages/11-code-splitting/01-dynamic-reducer-injection.md`
- **Read this:** [combineSlices](https://redux.js.org/toolkit/api/combineSlices) · redux.js.org · `withLazyLoadedSlices` (declare slices added later so they appear in the inferred state type, with a declaration-merging pattern); `inject`, called on the reducer — `rootReducer.inject(slice)` returns a new reducer, dispatches nothing (so injected state shows only after the next action), and refuses to replace an injected reducer by default; `selector`; slice integration (`injectInto`, `selectors` / `getSelectors`) · covers our angle: full · fetched 2026-10-05
- **Also good:** [Code Splitting](https://redux.js.org/usage/code-splitting) · redux.js.org · the basic principle with `replaceReducer`, then RTK's `combineSlices` and `createDynamicMiddleware` (≈2.1k words) · fetched 2026-10-05
- *Not opened:* a Medium post on `withLazyLoadedSlices` (HTTP 403 — not fetchable, unverified, so not listed).

### T19 · Testing Redux logic — Understand · ✅ `docs/redux-toolkit/pages/12-testing/01-testing-redux-logic.md`
- **Read this:** [Writing Tests](https://redux.js.org/usage/writing-tests) · redux.js.org · what Redux actually recommends (≈6.5k words): guiding principles (test behavior, not implementation details), test runners and the UI and network tools, a reusable `renderWithProviders`, integration tests with components and prepared initial state, Vitest Browser Mode, then unit tests for reducers, selectors, action creators and thunks, and middleware · MSW 2 handler syntax (`http.get`, `HttpResponse`) · covers our angle: full · fetched 2026-10-05
- *Checked, not chosen:* freeCodeCamp "React Unit Test Handbook + Redux Testing Toolkit" (2022-11, ≈8.3k words) — general React unit testing with Jest, not Redux-centred, and no network mocking.

### T20 · Testing thunks and RTK Query endpoints — Understand · ✅ `docs/redux-toolkit/pages/12-testing/01b-testing-thunks-and-rtk-query.md`
- **Read this (1/2) — thunks:** [Writing Tests → action creators and thunks](https://redux.js.org/usage/writing-tests#action-creators--thunks) · redux.js.org · how the official guide tests thunks beside reducers, selectors and middleware · fetched 2026-10-05
- **Read this (2/2) — endpoints:** [Writing Tests → integration testing](https://redux.js.org/usage/writing-tests#integration-testing-connected-components-and-redux-logic) · redux.js.org · mock the network with MSW 2 and render through `renderWithProviders`; the page never names RTK Query, so this is the nearest official guidance · covers our angle: **partial** · fetched 2026-10-05
- **Our delta:** RTK Query endpoint testing specifics (a fresh store per test, resetting API state, base URLs outside the browser) — **no current RTK Query-specific guide found.**
- *Checked, not chosen:* DEV (2022-08, ≈2.3k words) and gustavocd.dev (2023-02, ≈1.3k words) — both test RTK Query with MSW and Testing Library, but both write handlers in MSW 1 syntax (`rest.get`, `res(ctx.json())`), which MSW 2 replaced. GitHub discussion #4915 (2025-04) is a feature request for a mock-endpoint helper, not a guide. The RTK repo's Vitest example from PR #3269 is gone — `examples/query/react/vitest` returns 404. One Medium walkthrough returned HTTP 403 (unverified).

### T21 · Migrating from classic Redux — Know · ✅ `docs/redux-toolkit/pages/13-migration/01-from-classic-redux.md`
- **Read this:** [Migrating to Modern Redux](https://redux.js.org/usage/migrating-to-modern-redux) · redux.js.org · the incremental route, old and new code coexisting (≈6k words): `configureStore`, `createSlice`, RTK Query and `createAsyncThunk` for fetching, `createListenerMiddleware` for reactive logic (the saga replacement), TypeScript for the logic; then `connect` to hooks one component at a time · covers our angle: **partial** — nothing on what RTK does *not* fix · fetched 2026-10-05
- **Also good:** [Redux Fundamentals, Part 8 — Modern Redux with Redux Toolkit](https://redux.js.org/tutorials/fundamentals/part-8-modern-redux) · redux.js.org · the classic todo app rewritten step by step: store setup, slices with Immer, converting the todos reducer, thunks, `createEntityAdapter` (≈6.2k words) · fetched 2026-10-05
- **Our delta:** what RTK does not fix (selectors still hand-written, fetching still dispatched by you with `createAsyncThunk`, folder structure left to you) — the official page touches these only in passing.
- *Checked, not chosen:* CloudSEK (≈860 words), GeeksforGeeks (2024, edited 2025, ≈1.3k words) and a DEV post on sagas with RTK (≈960 words) — all shallower, none mentions RTK 2.
