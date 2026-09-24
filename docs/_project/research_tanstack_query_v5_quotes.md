---
name: research-tanstack-query-v5-quotes
description: Banked verbatim quotes + URLs from the TanStack Query v5 docs, gathered 2026-09-06 validating topics 01-04 and 09. Topics 05-16 must read this BEFORE fetching — it already settles keys, defaults, status/fetchStatus, gcTime, invalidation and the v5 migration.
metadata:
  type: reference
---

# TanStack Query v5 — banked quotes, pin **@tanstack/react-query 5.102.8**

Gathered by the validation pass of 2026-09-06 (10 fetches). 🔴 **Read this before fetching
anything for this track.** Every quote below is verbatim with its URL.

## Prefetching — the deprecation that drove audit item A3
https://tanstack.com/query/latest/docs/framework/react/guides/prefetching
> *"These tips replace the use of the now deprecated `prefetchQuery` and `ensureQueryData` methods."*
> *"those methods will be removed in the next major version of TanStack Query"*
> *"Prefetching a query uses the `query` method."*

## `QueryClient` reference
https://tanstack.com/query/latest/docs/reference/QueryClient
> *"an asynchronous method that can be used to fetch and cache a query. It will either resolve with the data or throw with an error."* (`queryClient.query`)
> *"If the query does not exist, it will be created."* (`setQueryData`)
> *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."*

🔴 **Structural finding: `prefetchQuery`, `fetchQuery` and `ensureQueryData` no longer appear
in this reference at all.** `queryClient.query` and `queryClient.infiniteQuery` do.

## Advanced SSR
https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
> *"Server: always make a new query client"*
> *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*
> *"HydrationBoundary is a Client Component, so hydration will happen there."*

## Queries — status vs fetchStatus
https://tanstack.com/query/latest/docs/framework/react/guides/queries
> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*
> *"Background refetches and stale-while-revalidate logic make all combinations"*

## Migrating to v5
https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5
> *"now we only support the object format"*
> *"`status: loading` has been changed to `status: pending` and `isLoading` has been changed to `isPending`"*
> *"`isInitialLoading` has now been renamed to `isLoading`"*, *"implemented as `isPending && isFetching`"*
> *"Almost everyone gets `cacheTime` wrong…"*, *"`cacheTime` does nothing as long as a query is still in use. It only kicks in as soon as the query becomes unused."*

## Important Defaults
https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*
> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*
> *"By default, 'inactive' queries are garbage collected after 5 minutes."*
> *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."*
> *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"*

⚠️ **This page names `refetchOnMount` / `refetchOnWindowFocus` / `refetchOnReconnect` but does
NOT print their default values.** Teach the *behaviour* quoted above; do not assert a default.

## Query Keys
https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
> *"Query Keys are hashed deterministically!"*
> *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"*
> *"no matter the order of keys in objects, all of the following queries are considered equal"*
> *"Array item order matters!"*

## Query Invalidation
https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
> *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*
> *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*

## 🔴 Open questions — NOT settled by any page read
1. ~~**How often `select` re-runs.**~~ 🟢 **CLOSED 2026-09-08** — `render-optimizations` was
   fetched; see the two sections at the end of this file. It also settled structural sharing and
   tracked properties.
2. **What `invalidateQueries` does to *inactive* matches.** The two halves are quoted separately
   above; the combined statement is *derived*, not quoted.
3. **Per-option defaults.** `…/framework/react/reference/useQuery` returns `{"isNotFound":true}`
   on the current docs site — the reference page for the hook does not exist. Source defaults
   from the guides.

Related: [[devbible-validation-ledger]] · [[cursor-audit]]

---

# Mutations — banked 2026-09-07 (validating topics 05 and 14)

## Mutation side effects — the CALLBACK SIGNATURES
https://tanstack.com/query/v5/docs/framework/react/guides/mutations (the **v5-pinned** path)
> ```
> onMutate: (variables, context) => { ... }
> onError: (error, variables, onMutateResult, context) => { ... }
> onSuccess: (data, variables, onMutateResult, context) => { ... }
> onSettled: (data, error, variables, onMutateResult, context) => { ... }
> ```
> *"Optionally return a result containing data to use when for example rolling back"*

🔴 **The third argument is `onMutateResult`, not `context`.** `context` is now a FOURTH
parameter (`MutationFunctionContext`) carrying `context.client` — the `QueryClient`, reachable
without `useQueryClient`. Confirmed on **both** the `/latest/` and the `/v5/` doc paths, so it is
the pinned 5.102.8 shape and not unreleased v6 — the same check the `pins.js` note demanded for
`queryClient.query()`. Any page naming the third positional argument `context` is describing the
pre-rename API; the code still *runs* (position is unchanged) but the name now means something
else in the reference.

Typed signature (from the useMutation reference, surfaced via search — the reference PAGE itself
still returns `{"isNotFound":true}`, so this is T2-with-a-caveat, not T0):
`onMutateResult: TOnMutateResult | undefined`. 🔴 **It is optional.** If `onMutate` throws before
returning, `onError` receives `undefined` there — an unguarded `onMutateResult.previous` throws
*inside the error handler*.

## Optimistic updates — the docs' own example
https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
> ```tsx
> onMutate: async (newTodo, context) => {
>   await context.client.cancelQueries({ queryKey: ['todos'] })
>   const previousTodos = context.client.getQueryData(['todos'])
>   context.client.setQueryData(['todos'], (old) => [...old, newTodo])
>   return { previousTodos }
> }
> onError: (err, newTodo, onMutateResult, context) => {
>   context.client.setQueryData(['todos'], onMutateResult.previousTodos)
> }
> onSettled: (data, error, variables, onMutateResult, context) =>
>   context.client.invalidateQueries({ queryKey: ['todos'] })
> ```
> *"Cancel any outgoing refetches (so they don't overwrite our optimistic update)"*
> *"make sure to _return_ the Promise from the query invalidation"* — to keep the mutation `pending`

## Retry — the asymmetry with queries
> *"By default, TanStack Query will not retry a mutation on error"* — contrast Important Defaults:
> *"Queries that fail are silently retried 3 times, with exponential backoff"*

## The callbacks passed to `mutate()` itself
> *"those additional callbacks won't run if your component unmounts _before_ the mutation finishes"*

## Mutation scopes
> *"Per default, all mutations run in parallel - even if you invoke `.mutate()` of the same mutation multiple times. Mutations can be given a `scope` with an `id` to avoid that. All mutations with the same `scope.id` will run in serial"*

## mutate vs mutateAsync
> *"Use `mutateAsync` instead of `mutate` to get a promise which will resolve on success or throw on an error"*

## Mutation status
> *"isIdle or status === 'idle'"* · *"isPending or status === 'pending'"* · *"isError or status === 'error'"* · *"isSuccess or status === 'success'"*

⚠️ **Still unsettled after this pass:** the relative ORDER of the hook-level callback and the
`mutate()`-level callback (both fire; which first is not stated on the guide). Do not assert it.

---

# Suspense — banked 2026-09-08 (validating topic 10), 3 fetches
https://tanstack.com/query/latest/docs/framework/react/guides/suspense

🔴 **This section did not exist before 2026-09-08 and topic 10 was written without it.** Do not
re-fetch the suspense guide; everything load-bearing on it is below.

## The three hooks
`useSuspenseQuery` · `useSuspenseInfiniteQuery` · `useSuspenseQueries`. Separate hooks, not a
`suspense: true` option — that is what lets `data` be typed `T` rather than `T | undefined`.

> *"When using suspense mode, `status` states and `error` objects are not needed and are then replaced by usage of the `React.Suspense` component."*

## 🔴 The option surface that DISAPPEARS
> *"On the flip side, you therefore can't conditionally enable / disable the Query."* (no `enabled`)
> *"`placeholderData` also doesn't exist for this Query. To prevent the UI from being replaced by a fallback during an update, wrap your updates that change the QueryKey into [startTransition](https://react.dev/reference/react/Suspense#preventing-unwanted-fallbacks)."*

## 🔴 THE BIG ONE — suspense does NOT throw every error
> *"Not all errors are thrown to the nearest Error Boundary per default - we're only throwing errors if there is no other data to show."*

The printed default:
```ts
throwOnError: (error, query) => typeof query.state.data === 'undefined'
```
So: **cold-load failure reaches the boundary; background-refetch failure is silent** — and suspense
removed the `isError` you would have rendered a banner from. Any page claiming "a query failure
crashes the app without an Error Boundary" is over-broad; it is true only when the cache is empty
for that key.

Manual throw, when you DO want everything at a boundary — *"you have to throw errors manually if you want all errors to be handled by Error Boundaries:"*
```tsx
const { data, error, isFetching } = useSuspenseQuery({ queryKey, queryFn })
if (error && !isFetching) { throw error }
```
🔴 The `!isFetching` guard is load-bearing — without it you throw *during* the retry window and
defeat the default 3-retry backoff. Note this snippet also proves `error` and `isFetching` ARE on
the suspense result; the mode removes the *need* to branch, not the fields.

## Error-boundary reset — why a plain "Try again" does nothing
`resetErrorBoundary()` resets the boundary but NOT the cached query error, so the remount re-throws.
> *"When using the component it will reset any query errors within the boundaries of the component"* (`QueryErrorResetBoundary`, render-prop giving `{ reset }`)
> *"When using the hook it will reset any query errors within the closest QueryErrorResetBoundary."* (`useQueryErrorResetBoundary`)

Wiring both docs examples use: `onReset={reset}` on `ErrorBoundary` + `resetErrorBoundary()` in
`fallbackRender`. ⚠️ *closest*, not global — placement decides which region a "Try again" clears.

## Fetch strategies
Section heading: *"Fetch-on-render vs Render-as-you-fetch"*. Fetch-on-render works out of the box;
render-as-you-fetch needs *"Prefetching on routing callbacks and/or user interactions events to
start loading queries before they are mounted."* A warm key does not suspend — so prefetching is
the **third** fix for the suspense waterfall, alongside `useSuspenseQueries` and separate components.

## Streaming (Next.js) — EXPERIMENTAL
> *"If you are using NextJs, you can use our **experimental** integration for Suspense on the Server: `@tanstack/react-query-next-experimental`"*
> *"Results will then be streamed from the server to the client as SuspenseBoundaries resolve."*

The documented `app/providers.tsx` carries three load-bearing details:
1. `environmentManager.isServer()` — 🔴 **the current spelling**, not `typeof window === 'undefined'`.
   Do not substitute the older idiom from memory.
2. *"Server: always make a new query client"*; browser client memoised in a **module variable, not
   `useState`** — *"React will throw away the client on the initial render if it suspends and there
   is no boundary"*.
3. *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*.

⚠️ **Not on the page at all** — no sentence mentions `retry`, `retryOnMount` or `fetchOnServer`.
Retry behaviour under suspense comes from Important Defaults (3 silent retries, exponential
backoff), quoted higher up this file. Do not assert a suspense-specific retry rule.

---

# v4 → v5 breaking changes — the FULL list, banked 2026-09-08 (1 fetch, session `bc194850`)
https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5

🔴 **The four quotes higher up this file were all this page had. This is the rest of it.**
Do not re-fetch this page; topic 16's `01f` is built on the list below.

## Signature + codemod
> *"now we only support the object format"* — `useQuery`, `useInfiniteQuery`, `useMutation`,
> `useIsFetching`, `useIsMutating` and the `queryClient` methods.
> *"The codemod is a best efforts attempt"* · *"there are edge cases that cannot be found by the code mod"*

It infers the object form where arg 1 is an array literal or an object carrying
`queryKey`/`mutationKey`; where it cannot infer it **leaves a console message rather than a wrong
transform**. 🔴 Those messages are the residual worklist and they scroll away — `tee` the run.

## Removed (loud in TypeScript, SILENT in JavaScript)
> *"`onSuccess`, `onError` and `onSettled` have been removed from Queries"* (mutations keep theirs)
- `keepPreviousData` option **and** the `isPreviousData` flag → `placeholderData` now receives the
  previous data as an argument; the flag is `isPlaceholderData`
- `result.remove()` → `queryClient.removeQueries({ queryKey })` — 💥 this one throws in JS too
- `isDataEqual` → a `structuralSharing` function
- the custom logger — *"Custom loggers were already deprecated in 4 and have been removed in this version"*
- `contextSharing` on `QueryClientProvider`, and the custom `context` prop → pass a distinct client
- `useHydrate` → gone. *"the `Hydrate` component has been renamed to `HydrationBoundary` and the `useHydrate` hook has been removed"*
- manual `pageParams` overwriting via `fetchNextPage`/`fetchPreviousPage`
- the `dehydrateMutations` / `dehydrateQueries` booleans → function equivalents

## Renames (mechanical)
- `cacheTime` → `gcTime` · `useErrorBoundary` → `throwOnError`
- `hashQueryKey` → `hashKey` — *"because it also hashes mutation keys"*
- `refetchPage` → the `maxPages` option

## 🔴 SEMANTIC — compiles, runs, means something else
- `status: 'loading'` → `'pending'`; `isLoading` → `isPending`; `isInitialLoading` → **`isLoading`**
- 🔴 *"`getNextPageParam` or `getPreviousPageParam` now indicates that there is no further page available"*
  when it returns **`null`** — a mapper returning `null` for a missing cursor silently ends the list
- `refetchInterval` as a function now **only gets `query` passed**, not the data — a v4 predicate
  reading `data.x` gets `undefined` and polls forever, or never
- *"`retry` now defaults to `0` instead of `3`"* **on the server**
- *"`queryClient.getQueryDefaults` will now merge together all matching registrations instead of
  returning only the first"*
- *"you now have to pass an explicit `initialPageParam`"* — in JS its absence is silent

## Peer floors
> *"requires React 18.0 or later"* (it uses `useSyncExternalStore`) · TypeScript **4.7** minimum

## ⚠️ Explicitly NOT on the page
- `status: 'idle'` removal is **not** documented there.
- 🔴 **The `prefetchQuery`/`ensureQueryData` deprecation is NOT on this page at all** — it landed
  *inside* the v5 line and lives on the prefetching guide. A team working this guide top to bottom
  finishes the upgrade with every prefetch call site unaudited.

---

# 🟢 OPEN QUESTION 1 CLOSED — how often `select` re-runs (banked 2026-09-08, session `bc194850`)
https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations

The "Open questions" section near the top of this file listed this as **unsettled since
2026-09-06**. It is settled. Strike it there; the source is the render-optimizations guide,
which the 2026-09-06 pass never fetched.

> *"The `select` function will only re-run if: the `select` function itself changed referentially
> [or] `data` changed"*
> *"This means that an inlined `select` function, as shown above, will run on every render."*

🔴 **The consequence is the teaching point:** an inline arrow is a new reference on every render, so
an inlined `select` re-runs every render — the memoisation people reach for `select` to get is
exactly what an inline `select` throws away. Stabilise it with `useCallback`, a module-level
function, or a `queryOptions` factory.

---

# Initial query data — banked 2026-09-08 (1 fetch, writing topic 02 `01e`)
https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data

⚠️ **T1, not T0.** The fetch returned a *summarised* page with quoted fragments rather than raw
text, so these two are quoted as the tool returned them. Re-confirm before leaning hard on the
exact wording.

> *"This function will be executed only once when the query is initialized."* (the `initialData`
> **function** form — it is lazy, and it does not re-run on every render)
> *"will immediately refetch when it mounts"* (the consequence of seeding `initialData` without
> `initialDataUpdatedAt` under a `staleTime` that treats it as already stale)

🔴 **The load-bearing distinction the page is built on** — `initialData` is a **cache write**,
`placeholderData` is **not**. `initialData` is persisted, is served to every observer of that key,
is what `getQueryData` returns, participates in `staleTime`, and *suppresses the fetch entirely if
considered fresh*. `placeholderData` is shown to one observer, sets `isPlaceholderData: true`,
leaves the entry empty, and always fetches.

## ⚠️ Still NOT settled after this fetch — do not assert either
1. **Two observers mounting the same key with DIFFERENT `initialData`.** First-write-wins is a
   *derivation* from *"prepopulate its cache if empty"*, not a quote.
2. **What `dataUpdatedAt` reports while `isPlaceholderData` is `true`.** Nothing in either guide
   settles it and the `useQuery` reference page is a 404. **Do not build cache-age UI on it.**

---

# Render Optimizations — the REST of the page, banked 2026-09-08 (writing topic 04 `01g`)
https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations

The earlier 2026-09-08 entry banked only the two `select` re-run sentences. This is the rest of
the same guide — it settles **structural sharing** and **tracked properties**, neither of which
this corpus had a primary source for.

## Structural sharing
> *"React Query uses a technique called 'structural sharing' to ensure that as many references as
> possible will be kept intact between re-renders."*
> *"If data is fetched over the network, usually, you'll get a completely new reference by json
> parsing the response. However, React Query will keep the original reference if _nothing_ changed
> in the data. If a subset changed, React Query will keep the unchanged parts and only replace the
> changed parts."*
> 🔴 *"This optimization only works if the `queryFn` returns JSON compatible data."*

The option: *"can be disabled via `structuralSharing: false` globally or per-query, or customized
by passing a function to it."* (It replaced `isDataEqual`, **removed** in v5.)

## Tracked properties — the OTHER re-render lever
> *"React Query will only trigger a re-render if one of the properties returned from `useQuery` is
> actually 'used'."*
> *"This avoids a lot of unnecessary re-renders, e.g. because properties like `isFetching` or
> `isStale` might change often, but are not used in the component."*
> *"You can customize this feature by setting `notifyOnChangeProps` manually globally or on a
> per-query basis."* · *"If you want to turn that feature off, you can set `notifyOnChangeProps: 'all'`."*

🔴 **Note the polarity trap:** `notifyOnChangeProps: 'all'` **turns the optimisation OFF**.

## `select` as a subscription narrower
> *"You can use the `select` option to select a subset of the data that your component should
> subscribe to."*
> *"A component using the `useTodoCount` custom hook will only re-render if the length of the todos
> changes. It will **not** re-render if e.g. the name of a todo changed."*

## ⚠️ STILL NOT SETTLED after this fetch — do not assert
1. **Is the RESULT of `select` itself structurally shared?** The guide's only example returns
   `data.length`, a number, so plain value equality explains the behaviour. Open.
2. **The mechanics for a non-JSON value inside the walk** — whether a nested `Date`/`Map`/class
   instance replaces only its sub-tree or poisons siblings. The *precondition* is quoted above;
   the mechanics are not.
3. **Does `setQueryData` go through the same comparison?** Not stated anywhere.
4. **Infinite queries and structural sharing** — the guides never mention them together. Any
   `{ pages, pageParams }` reasoning is a design consequence, not a documented guarantee.
