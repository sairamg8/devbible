---
name: research-redux-toolkit-track
description: Banked primary-source research for the whole devbible redux-toolkit track — every load-bearing claim quoted verbatim with its URL, against @reduxjs/toolkit 2.12.0. Do not re-derive.
metadata:
  type: reference
---

# redux-toolkit — banked research (2026-09-06)

🔴 **DO NOT RE-FETCH.** One pass over the primary sources for the whole 16-page track,
per `.agents/references/verification.md` efficiency rule 1. Every chunk is written from
this file.

**Version spine.** `@reduxjs/toolkit` **2.12.0** · `react-redux` **9.3.0** ·
`reselect` 5.x (ships inside RTK 2) · `immer` 10.x · `redux-thunk` 3.x.
Source: `static/currency.json` → `versions.rtk`, policy `latest`, drift `none`,
checked 2026-09-05. 🔴 **Nothing is installed in this checkout** — `node_modules/@reduxjs`
does not exist, so **T1 probes are unavailable for this track**. Everything below is T0/T2.

🔴 **The track's single systemic defect: every page was written against RTK 1.x.** The
three most-quoted mechanics — default middleware stack, selector memoization, reducer
injection — are each wrong for the pinned version. Fixed 2026-09-06 in commit `40cb06fa`.

---

## configureStore / getDefaultMiddleware
<https://redux-toolkit.js.org/api/getDefaultMiddleware>

Dev build, **in this order**:
1. `actionCreatorInvariant` (dev only)
2. `immutableStateInvariant` (dev only)
3. `thunk`
4. `serializableStateInvariant` (dev only)

Production build: `thunk` **only**.

> *"deeply compares state values for mutations. It can detect mutations in reducers during
> a dispatch, and also mutations that occur between dispatches (such as in a component or
> a selector)."*

🔴 It **compares**, it does not freeze. Immer's `autoFreeze` is the separate mechanism.
`actionCreatorInvariant` *"Identifies when an action creator was mistakenly dispatched
without being called."*

## RTK 2.0 breaking changes
<https://redux-toolkit.js.org/usage/migrating-rtk-2>

- > *"We have removed the 'object' form for both `createReducer` and
  > `createSlice.extraReducers`"* — removed, not deprecated.
- > *"the `middleware` field must be a callback, for the same reasons"* — an array no
  longer type-checks.
- `createStore` *"will continue to work indefinitely, and will not ever be removed"* but
  is shown struck through; `legacy_createStore` is the unmarked alias.
- > *"`createSelector` now uses a new default memoization function called
  > `weakMapMemoize`"*
- `createEntityAdapter` gains an `Id` generic; the `Dictionary` type was **removed** in
  favour of `Record`.
- Standalone `getDefaultMiddleware` and `getType` exports **removed**.
- **New:** `combineSlices` · `slice.selectors` · the `reducers: (create) => …` creator
  callback (`create.asyncThunk()`, `create.preparedReducer()`) · `createDynamicMiddleware`
  · `autoBatchEnhancer` **on by default** in `configureStore`.

## Reselect 5 — the memoizer change
<https://reselect.js.org/api/createSelector/>

> *"Since v5.0.0, `createSelector` uses `weakMapMemoize` as the default for both `memoize`
> and `argsMemoize`."*
> *"`weakMapMemoize` instead provides an effectively **unlimited** cache size keyed on
> argument identity"*
> *"In v4.x the default was `lruMemoize` (previously named `defaultMemoize`) with a cache
> size of **1**"*

🔴 This invalidates all pre-2024 "selector factory per component" advice *as stated*. The
factory is still right for per-component cache lifetime or an explicit `lruMemoize` bound —
but **not** for the cache-size-1 reason everyone repeats.

## combineSlices — injection
<https://redux-toolkit.js.org/api/combineSlices>

> *"inject allows you to add a slice to your set of reducers after initialisation."*
> *"inject adds the slice to the map of reducers in your original reducer, but doesn't
> dispatch an action. This means that the added reducer state will not show up in your
> store until the next action is dispatched."*

- Called on the **reducer**: `const reducerWithUser = rootReducer.inject(userSlice)`.
  🔴 **There is no `store.inject`.**
- Or `counterSlice.injectInto(rootReducer)` — *"Slice instances returned by createSlice
  have an attached injectInto method"*, with an optional config to change `reducerPath`.
- Returns *"an updated version of the reducer with the slice included"* (carries the type).
- 🔴 **No `store.replaceReducer()` is involved.**
- > *"By default, replacing a reducer is not allowed. In development mode, a warning will
  > be logged to console if a new reducer instance is attempted to inject into a
  > `reducerPath` that's already injected. (It won't warn if the same reducer instance is
  > injected into the same place twice.)"* — `overrideExisting: true` to mean it.
- `combineSlices(staticSlice).withLazyLoadedSlices<LazyLoadedSlices>()` is the documented
  way to type lazily-injected state as optional.

## createAsyncThunk
<https://redux-toolkit.js.org/api/createAsyncThunk>

🔴 `abort()` is on the **promise returned by dispatching**, never on the action creator:

```javascript
const promise = dispatch(fetchUserById(props.userId))
return () => { promise.abort() }
```

> *"If `condition()` returns `false`, the default behavior is that no actions will be
> dispatched at all."*
> *"If you still want a 'rejected' action to be dispatched when the thunk was canceled,
> pass in `{condition, dispatchConditionRejection: true}`."*

## Matching utilities
<https://redux-toolkit.js.org/api/matching-utilities>

`isAllOf` · `isAnyOf` · `isAsyncThunkAction` · `isPending` · `isFulfilled` · `isRejected` ·
`isRejectedWithValue`. `isAllOf` is true only if **all** predicates match the same action;
`isAnyOf` if **at least one** does. Both are higher-order functions taking action creators
or type guards, fed to `builder.addMatcher()`.

## createEntityAdapter
<https://redux-toolkit.js.org/api/createEntityAdapter>

> *"if an entity **already exists**: `addOne` and `addMany` will do nothing with the new
> entity"*
> *"If provided, the `state.ids` array will be kept in sorted order based on comparisons of
> the entity objects."* — sorting *"only kicks in when state is changed via one of the CRUD
> functions below (for example, `addOne()`, `updateMany()`)"*
> *"If not provided, the default implementation is `entity => entity.id`."*
> *"Each selector function will be created using the `createSelector` function from
> Reselect, to enable memoizing calculation of the results."*

CRUD, exact names: `addOne` `addMany` `setOne` `setMany` `setAll` `removeOne` `removeMany`
`removeAll` `updateOne` `updateMany` `upsertOne` `upsertMany`.
Selectors: `selectIds` `selectEntities` `selectAll` `selectTotal` `selectById`.

## RTK Query — createApi
<https://redux-toolkit.js.org/rtk-query/api/createApi>

- `keepUnusedDataFor` default **60**, *"this value is in seconds"*, measuring *"how long
  RTK Query will keep your data cached for after the last component unsubscribes."*
- > *"Typically, you should only have one API slice per base URL that your application
  > needs to communicate with."* — because tag invalidation works only **within** one API
  slice, and each middleware instance costs.
- **Three** endpoint builder types: `query`, `mutation`, **`infiniteQuery`**.
- `transformResponse` / `transformErrorResponse` receive (value, meta, arg) and are
  **not applicable when using `queryFn`**.
- `queryFn` is the escape hatch for custom async logic; returns `{ data }` or `{ error }`.

## RTK Query — cache behaviour
<https://redux-toolkit.js.org/rtk-query/usage/cache-behavior>

> *"Subscriptions are reference-counted. Additional subscriptions that ask for the same
> endpoint+params increment the reference count."*
> *"Once the subscription is removed (e.g. when last component subscribed to the data
> unmounts), after an amount of time (default 60 seconds), the data will be removed from
> the cache."*
> `refetchOnMountOrArgChange`: *"Passing `true` for this property will cause the endpoint
> to always refetch when a new subscriber to the query is added"*; a number = refetch if
> that many seconds have elapsed.
> `refetchOnFocus` / `refetchOnReconnect`: *"Note that this requires `setupListeners` to
> have been called."*

## RTK Query — manual cache updates
<https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates>

- `updateQueryData` is *"strictly intended to perform updates to existing cache entries,
  not create new entries"* — 🔴 **it silently does nothing if that exact cache key is not
  already cached.**
- `upsertQueryData` is *"intended to perform replacements to existing cache entries or
  creation of new ones"* — a full replacement, not a patch.
- Optimistic recipe: patch inside `onQueryStarted` **before** awaiting, then
  *"roll it back via the `.undo` property of the object you got back from the earlier
  dispatch"*.

## RTK Query — infinite queries
<https://redux-toolkit.js.org/rtk-query/usage/infinite-queries>

`infiniteQueryOptions` takes `initialPageParam`, required `getNextPageParam`, optional
`getPreviousPageParam`, optional `maxPages`. Generates `use<Name>InfiniteQuery`, returning
`data` as `{ pages, pageParams }` plus `hasNextPage` / `hasPreviousPage` and
`fetchNextPage` / `fetchPreviousPage`. ⚠️ The docs page does **not** state which RTK
version added it — do not assert a version.

## TypeScript
<https://redux-toolkit.js.org/usage/usage-with-typescript>

`RootState = ReturnType<typeof store.getState>`, `AppDispatch = typeof store.dispatch` —
> *"extract it after creating the store. It is recommended to give the type a different
> name like `AppDispatch` to prevent confusion."*

`withTypes` exists on `useDispatch`, `useSelector`, `createAsyncThunk` and `createSelector`:
*"set up those types once, so you don't have to repeat them each time."*
Avoiding `getDefaultMiddleware` means *"you are required to use `Tuple` for type-safe
creation of your `middleware` array."*
`ThunkApiConfig`: `state` (getState return), `dispatch`, `extra`, `rejectValue`
(*"type to be passed into `rejectValue`'s first argument that will end up on
`rejectedAction.payload`"*).

## react-redux hooks
<https://react-redux.js.org/api/hooks>

> *"useSelector() uses strict `===` reference equality checks by default, not shallow
> equality."*
> *"Returning a new object every time will always force a re-render by default."*
> *"The selector will be run whenever the function component renders"* — and also whenever
> an action is dispatched.
> `shallowEqual` usage: *"const selectedData = useSelector(selectorReturningObject,
> shallowEqual)"*

⚠️ **Not settled by the docs:** whether `useSelector` uses `useSyncExternalStore`, and
whether it reads the store from context. The hooks page says only that it *"will also
subscribe to the Redux store"*. 🔴 **Do not assert internals** — the old page's claim that
it "bypasses React Context entirely" is unverifiable at T2 and was softened, not restated.
`batch()` is still listed in the v9 API menu; the page says nothing about deprecation, so
do not claim it was removed.

## Immer
<https://immerjs.github.io/immer/return>

- *"NOT OK: modifying draft and returning a new state"* — the docs mark the pattern but
  ⚠️ **do not print an exact error string**. 🔴 Do not quote a verbatim Immer error
  message; describe the failure instead.
- > *"It is not possible to return `undefined` this way, as it is indistinguishable from
  > not updating the draft!"* — because *"in JavaScript a function that doesn't return
  > anything also returns `undefined`"*.
- > *"To make it clear to Immer that you intentionally want to produce the value
  > `undefined`, you can return the built-in token `nothing`"*.

## Testing — 🔴 the track contradicts official guidance
<https://redux.js.org/usage/writing-tests>

> *"Prefer writing integration tests with everything working together. For a React app
> using Redux, render a `<Provider>` with a real store instance wrapping the components
> being tested."*
> *"If needed, use basic unit tests for pure functions such as particularly complex
> reducers or selectors. However, in many cases, these are just implementation details that
> are covered by integration tests instead."*
> 🔴 *"Do **not** try to mock selector functions or the React-Redux hooks! Mocking imports
> from libraries is fragile, and doesn't give you confidence that your actual app code is
> working."*
> *"the test code should create a separate Redux store instance for every test, rather than
> reusing the same store instance and resetting its state"*
> *"We also recommend using Mock Service Worker (MSW) to mock network requests"* —
> *"mock async requests at the `fetch/xhr` level … none of the thunk logic has to change"*

The documented helper is `renderWithProviders(ui, { preloadedState, store = setupStore(…) })`
returning `{ store, user: userEvent.setup(), ...render(…) }`.

🔴 **Defect this exposes:** `12-testing/01` presented "mocking the generated hooks
(`jest.mock('../api/apiSlice')`)" as one of two valid strategies, and its Pitfall 1 called
testing through a real store "OVERKILL". Both invert the official recommendation.
