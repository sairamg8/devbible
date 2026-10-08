---
name: link-map-redux-toolkit-01
description: Link map, Redux Toolkit topics T01–T06 (configureStore, createSlice, slice selectors and creator callback, createAction and matchers, createAsyncThunk, cancellation) — the best explanation per topic, fetched and read 2026-10-05
metadata:
  type: reference
---

# Link map · Redux Toolkit · T01–T06 (sections 01–03)

All 6 topics are ✅ written. Topic numbers follow `docs/redux-toolkit/pages/README.md`.
Official docs are cited at their **canonical** `redux.js.org` address — `redux-toolkit.js.org` now redirects there.
**RTK 2 ✔** = the page's text documents an RTK 2 API (checked against the fetched text, 2026-10-05).

**Read this** = the best single page for the topic as our syllabus frames it · **Also good** = adds something the first
does not · *Checked, not chosen* = a credible alternative I opened, and the objective reason it lost.
Rules and format: [../../CURSOR-LINK-MAP.md](../../CURSOR-LINK-MAP.md).

---

### T01 · `configureStore` — Master · ✅ `docs/redux-toolkit/pages/01-store-setup/01-configure-store.md`
- **Read this:** [configureStore](https://redux.js.org/toolkit/api/configureStore) · redux.js.org · the whole RTK 2 call: `reducer`, the `middleware` callback and `Tuple`, `devTools`, `preloadedState`, `enhancers`, with a basic and a full example · RTK 2 ✔ (`Tuple`) · covers our angle: **partial** — the default stack and the SSR factory sit on two other pages · fetched 2026-10-05
- **Also good:** [getDefaultMiddleware → included default middleware](https://redux.js.org/toolkit/api/getDefaultMiddleware#included-default-middleware) · redux.js.org · what the default stack holds in development vs production, and the array it returns · fetched 2026-10-05
- **Also good:** [Redux Toolkit setup with Next.js](https://redux.js.org/usage/nextjs) · redux.js.org · the per-request store factory (`makeStore`), providing it, loading initial data — the only official page on the SSR store factory I found · fetched 2026-10-05
- *Checked, not chosen:* LogRocket "Using TypeScript with Redux Toolkit" (2023, edited 2024) and two DEV beginner guides (≈1–1.5k words) — none mentions `Tuple`, the RTK 2 typing rule for middleware arrays.

### T02 · `createSlice` — Master · ✅ `docs/redux-toolkit/pages/02-slices-and-actions/01-create-slice.md`
- **Read this:** [createSlice](https://redux.js.org/toolkit/api/createSlice) · redux.js.org · the full reference: `initialState`, `name`, `reducers` (object and creator-callback forms), the `extraReducers` builder, `reducerPath`, `selectors`, worked examples · RTK 2 ✔ (creator callback, `selectors`) · covers our angle: **partial** — the Immer wrapping is a separate page · fetched 2026-10-05
- **Also good:** [Writing Reducers with Immer](https://redux.js.org/toolkit/usage/immer-reducers) · redux.js.org · how RTK wraps case reducers in Immer: mutate-or-return, resetting and replacing state, nested updates, debugging drafts · fetched 2026-10-05
- **Also good:** [Redux Essentials, Part 2 → Redux slices](https://redux.js.org/tutorials/essentials/part-2-app-structure#redux-slices) · redux.js.org · the narrative way in: a running counter app, slice reducers and actions, the rules of reducers and why updates must be immutable · fetched 2026-10-05
- *Checked, not chosen:* two DEV beginner guides (≈1–1.5k words, no RTK 2 markers) — fine first reads, shallower than the three above.

### T03 · Slice selectors and the creator callback — Understand · ✅ `docs/redux-toolkit/pages/02-slices-and-actions/01b-slice-selectors-and-creator-callback.md`
- **Read this (1/2):** [createSlice → the reducers "creator callback" notation](https://redux.js.org/toolkit/api/createSlice#the-reducers-creator-callback-notation) · redux.js.org · `create.reducer`, `create.preparedReducer` and `create.asyncThunk`, and `buildCreateSlice` for putting thunks inside a slice · RTK 2 ✔ · fetched 2026-10-05
- **Read this (2/2):** [createSlice → selectors](https://redux.js.org/toolkit/api/createSlice#selectors) · redux.js.org · the `selectors` field, `slice.selectors`, `selectSlice`, `getSelectors`, `injectInto` · RTK 2 ✔ · covers our angle: full · fetched 2026-10-05
- **Also good:** [Migrating to RTK 2.0 → new features](https://redux.js.org/usage/migrations/migrating-rtk-2#new-features) · redux.js.org · the maintainers' summary of both additions beside everything else RTK 2 changed, plus "future plans" for custom slice reducer creators and selector factories · fetched 2026-10-05
- *Checked, not chosen:* nothing third-party — search returned only GitHub design threads and release notes, which are discussions rather than explanations.

### T04 · `createAction` and the matchers — Understand · ✅ `docs/redux-toolkit/pages/02-slices-and-actions/02-create-action-and-matchers.md`
- **Read this (1/2):** [createAction](https://redux.js.org/toolkit/api/createAction) · redux.js.org · prepare callbacks, `actionCreator.match` as a TypeScript type guard, use with `createReducer` · fetched 2026-10-05
- **Read this (2/2):** [Matching Utilities](https://redux.js.org/toolkit/api/matching-utilities) · redux.js.org · all seven — `isAllOf`, `isAnyOf`, `isAsyncThunkAction`, `isPending`, `isFulfilled`, `isRejected`, `isRejectedWithValue` — plus using them to cut boilerplate and as type guards · covers our angle: full · fetched 2026-10-05
- **Also good:** [createReducer → builder.addMatcher](https://redux.js.org/toolkit/api/createReducer#builderaddmatcher) · redux.js.org · where a matcher plugs into a reducer, beside `addCase`, `addAsyncThunk` and `addDefaultCase` · fetched 2026-10-05
- *Checked, not chosen:* a personal-blog bug story (`isAnyOf` handed `.type`, ≈480 words) — one gotcha, not an explanation.

### T05 · `createAsyncThunk` — Master · ✅ `docs/redux-toolkit/pages/03-async-thunks/01-create-async-thunk.md`
- **Read this:** [createAsyncThunk](https://redux.js.org/toolkit/api/createAsyncThunk) · redux.js.org · the complete reference (≈4.8k words): payload creator and `thunkAPI`, the options incl. `condition`, the pending/fulfilled/rejected lifecycle, `unwrap`, `rejectWithValue`, cancellation · covers our angle: full · fetched 2026-10-05
- **Also good:** [Redux Essentials, Part 5 — async logic and data fetching](https://redux.js.org/tutorials/essentials/part-5-async-logic) · redux.js.org · the narrative walk-through: why async needs middleware, writing thunks, loading-state fields, `createAsyncThunk` with `extraReducers`, dispatching from components and checking the result; ends with the creator-callback form · fetched 2026-10-05
- *Checked, not chosen:* LogRocket "Using Redux Toolkit's createAsyncThunk" (2021, edited 2024, ≈1.7k words) — parameters, dispatch and errors, but no `unwrap`, `condition` or `signal`; Itenium (2025, ≈0.7k words) — a short RTK 2-aware cheat sheet, nothing beyond the official page.

### T06 · Cancellation, `requestId` races and the limits of thunks — Understand · ✅ `docs/redux-toolkit/pages/03-async-thunks/01b-cancellation-races-and-limits.md`
- **Read this:** [createAsyncThunk → cancellation](https://redux.js.org/toolkit/api/createAsyncThunk#cancellation) · redux.js.org · canceling before execution (`condition`), canceling while running (the abort signal), checking cancellation status, telling a cancel from an error · covers our angle: **partial** — no race or stale-response discussion · fetched 2026-10-05
- **Also good:** [RTK Query overview → motivation](https://redux.js.org/toolkit/rtk-query/overview#motivation) · redux.js.org · the maintainers' account of what hand-written thunk fetching leaves to you: loading state, duplicate requests, optimistic updates, cache lifetimes · fetched 2026-10-05
- **Our delta:** the `requestId` stale-response race. The official thunk page uses `requestId` 28 times and never discusses a race or a stale response (0 hits for race, stale, out of order, overwrite) — and the limits-of-thunks argument gathered in one place.
