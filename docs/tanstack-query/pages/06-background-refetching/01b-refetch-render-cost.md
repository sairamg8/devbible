---
title: "What a Background Refetch Actually Costs: `isRefetching` vs `isLoading`, Structural Sharing and the Tracked-Properties Proxy"
sidebar_label: "01b · Refetch render cost"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [`no-rest-destructuring`](https://tanstack.com/query/latest/docs/eslint/no-rest-destructuring) — plus the result-field and option TSDoc in [`query-core/src/types.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/types.ts) (`query-core` reads **5.102.8** at that commit). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 What a Background Refetch Costs: Flags, Structural Sharing & Tracked Properties

## 1. Under-The-Hood Mechanics

A background refetch is supposed to be free — the old data stays on screen, the new data replaces it, and nothing flickers. It *is* free, but only because of two optimisations that are on by default and that ordinary-looking React code disables by accident. **The most expensive thing about background refetching is not the request; it is the re-render you did not know you had subscribed to.**

```text
refetch resolves
      │
      ▼
structural sharing ──► new data deep-equal to old?  ──yes──► KEEP the old reference
      │                                              ──no───► new object, unchanged
      │                                                        sub-trees kept by reference
      ▼
observer computes the result object  (ALWAYS a new top-level object)
      │
      ▼
tracked-properties Proxy ──► did the component READ a property that changed?
                              ──no──►  no re-render
                              ──yes─►  re-render
```

### The four fetch-related flags, from the TSDoc

`status` and `fetchStatus` answer different questions — the Queries guide puts it in one sentence:

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*

The convenience booleans are derived from those two, and the definitions are exact:

> *"isPending: Will be `pending` if there's no cached data and no query attempt was finished yet."*
> *"isFetching: … `true` whenever the `queryFn` is executing, which includes initial `pending` as well as background refetch."*
> *"isLoading: Is `true` whenever the first fetch for a query is in-flight. Is the same as `isFetching && isPending`."*
> *"isRefetching: Is `true` whenever a background refetch is in-flight, which _does not_ include initial `pending`. Is the same as `isFetching && !isPending`."*

So there are exactly three useful indicators, and choosing between them is a design decision, not a style one:

| You want | Use | True during first load | True during background refetch |
|---|---|---|---|
| a full-page skeleton | `isPending` (or `isLoading`) | yes | no |
| any activity at all | `isFetching` | yes | yes |
| a subtle "refreshing" bar | `isRefetching` | **no** | yes |

⚠️ `isLoading` changed meaning in v5. The migration guide records both halves of the swap: *"`status: loading` has been changed to `status: pending` and `isLoading` has been changed to `isPending`"*, and *"`isInitialLoading` has now been renamed to `isLoading`"*, *"implemented as `isPending && isFetching`"*. v4 code that used `isLoading` to mean "no data yet" now means "no data yet **and** a request is in flight" — which differ for a disabled query, and for a query paused with no network.

### Structural sharing: why `data` is often the same object after a refetch

> *"React Query uses a technique called 'structural sharing' to ensure that as many references as possible will be kept intact between re-renders. If data is fetched over the network, usually, you'll get a completely new reference by json parsing the response. However, React Query will keep the original reference if _nothing_ changed in the data. If a subset changed, React Query will keep the unchanged parts and only replace the changed parts."*

The option's TSDoc: *"Set this to `false` to disable structural sharing between query results. Set this to a function which accepts the old and new data and returns resolved data of the same type to implement custom structural sharing logic. Defaults to `true`."*

🔴 **It has one hard precondition.** Important Defaults: *"Structural sharing only works with JSON-compatible values, any other value types will always be considered as changed."* A `queryFn` that hands back `Date` objects, a `Map`, a `Set` or class instances gets a brand-new `data` reference on **every** background refetch, whether or not the payload changed.

### Referential identity: `data` is stable, the result object never is

> *"The top level object returned from `useQuery`, `useInfiniteQuery`, `useMutation` and the Array returned from `useQueries` is **not referentially stable**. It will be a new reference on every render. However, the `data` properties returned from these hooks will be as stable as possible."*

That is why `useEffect(() => {...}, [query])` fires on every render and `useEffect(() => {...}, [query.data])` does not.

### Tracked properties: the Proxy that makes `isFetching` free

> *"React Query will only trigger a re-render if one of the properties returned from `useQuery` is actually 'used'. This is done by using [Proxy object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). This avoids a lot of unnecessary re-renders, e.g. because properties like `isFetching` or `isStale` might change often, but are not used in the component."*

And the trap, stated in the same guide:

> *"The get trap of a proxy is invoked by accessing a property, either via destructuring or by accessing it directly. If you use object rest destructuring, you will disable this optimization."*

`const { data, ...rest } = useQuery(...)` reads every key to build `rest`, so the Proxy marks every key tracked, so every `isFetching` flip from every background refetch re-renders the component. `notifyOnChangeProps` is the manual override: *"If set, the component will only re-render if any of the listed properties change… When set to `'all'`, the component will re-render whenever a query is updated. By default, access to properties will be tracked."*

---

## 2. Real-World Engineering Scenario

**Scenario**: A Dashboard That Re-Rendered Its Entire Chart Grid Every Time the User Switched Tabs.
Twelve chart panels each called a `useMetrics(panelId)` hook that returned `{ data: metrics, ...rest }` from `useQuery` — a convenient wrapper, written once, copied eleven times. Every tab switch fired the focus refetch for the stale panels, and every one of those refetches flipped `isFetching` twice; because the rest-spread had read every key, all twelve panels re-rendered on every flip regardless of whether their numbers had changed. The team's first instinct was to wrap the panels in `React.memo`, which did nothing, because the prop they were passing down was the whole query result — a new object on every render by design. Two one-line changes fixed it: return only the fields the panels actually use from the custom hook, and pass `data` down rather than the result object. The requests were never the problem; nobody had noticed that the *subscription* was twelve times wider than the rendering.

---

## 3. Production-Grade Code Example

```tsx
// A refetch indicator that is CORRECT on first load: isRefetching excludes the initial pending fetch
function TicketQueue() {
  const { data, isPending, isRefetching, isError } = useTickets();

  if (isPending) return <QueueSkeleton />;   // no data yet — the hard loading state
  if (isError) return <QueueError />;

  return (
    <section aria-busy={isRefetching}>
      {isRefetching && <SubtleRefreshBar />}  {/* never shown during the first fetch */}
      <TicketList tickets={data} />
    </section>
  );
}
```

```typescript
// A custom hook that does NOT widen the subscription. Returning a rest-spread from a wrapper
// is the most common way tracked properties are lost, because the damage is done inside the hook.
function useMetrics(panelId: string) {
  const { data, isRefetching, isError } = useQuery({
    queryKey: ['metrics', panelId],
    queryFn: () => fetchMetrics(panelId),
    staleTime: 60_000,
  });

  return { metrics: data, isRefetching, isError }; // named fields only — never `...rest`
}
```

```typescript
// Keeping structural sharing working when the payload is not JSON-compatible.
// Option A: parse at the edge, so the cache only ever holds JSON-shaped values.
function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async (): Promise<Order[]> => {
      const raw = await api.get<Order[]>('/orders');
      return raw; // ISO date STRINGS stay strings; convert in the component or in `select`
    },
  });
}

// Option B: supply your own comparison when non-JSON values are unavoidable.
useQuery({
  queryKey: ['positions'],
  queryFn: fetchPositions, // returns objects containing Map instances
  structuralSharing: (oldData, newData) =>
    isDeepEqualIgnoringMaps(oldData, newData) ? (oldData as Position[]) : (newData as Position[]),
});
```

```typescript
// select narrows the subscription to a derived value: this component re-renders only when the
// COUNT changes, not when any todo's title does. The function must be referentially stable.
const selectTodoCount = (todos: Todo[]) => todos.length;

function useTodoCount() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    select: selectTodoCount, // module-level constant, so it does not re-run every render
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming Background Refetches Show a Loading Spinner
```tsx
// ❌ WRONG MENTAL MODEL: a refetchOnWindowFocus-triggered background refetch does NOT reset
// status to 'pending' — the ALREADY-CACHED data stays visible throughout, so `isLoading`
// NEVER becomes true for it. That is correct, intended behaviour, not a missing spinner.
if (isLoading) return <Spinner />; // correctly stays false during a background focus refetch

// ✅ PRECISE: isRefetching is `isFetching && !isPending` — the same indicator, minus the first load
if (isRefetching) return <SubtleRefreshBar />;
```

### ⚠️ Pitfall 2: Object Rest Destructuring Silently Disabling Render Optimisation
```tsx
// ❌ WRONG: rest destructuring reads EVERY property, so the Proxy marks all of them tracked —
// the component now re-renders on every isFetching flip caused by every background refetch
const { data, ...rest } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });

// ✅ CORRECT: destructure only what you render
const { data, isRefetching } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });
```
There is a lint rule for exactly this — `@tanstack/query/no-rest-destructuring`, marked ✅ Recommended: *"Use object rest destructuring on query results automatically subscribes to every field of the query result, which may cause unnecessary re-renders. This makes sure that you only subscribe to the fields that you actually need."*

### ⚠️ Pitfall 3: Passing the Whole Query Result Down as a Prop
```tsx
// ❌ WRONG: the result object is "not referentially stable… a new reference on every render",
// so React.memo can never bail out, and reading `.isFetching` inside the child widens the
// PARENT's subscription — the Proxy trap fired where the object was created, not where it is read
const query = useTodos();
return <TodoPanel query={query} />;

// ✅ CORRECT: pass the stable value, not the container
const { data: todos } = useTodos();
return <TodoPanel todos={todos} />;
```

### ⚠️ Pitfall 4: An Inline `select` That Re-Runs on Every Render
```typescript
// ❌ WASTEFUL: a new function identity each render, so the memoisation never applies —
// "The select function will only re-run if: the select function itself changed referentially,
// [or] data changed"
useQuery({ queryKey: ['todos'], queryFn: fetchTodos, select: (todos) => todos.length });

// ✅ CORRECT: a stable reference — module scope, or useCallback with the real dependencies
const selectTodoCount = (todos: Todo[]) => todos.length;
useQuery({ queryKey: ['todos'], queryFn: fetchTodos, select: selectTodoCount });
```

### ⚠️ Pitfall 5: Throwing From `select` to Validate the Response
```typescript
// ❌ WRONG PLACE: "a select function that returns an error results in `data` being `undefined`
// and `isSuccess` being `true`" — the query looks successful and renders nothing
select: (raw) => (isValid(raw) ? parse(raw) : new Error('bad payload')),

// ✅ CORRECT: validate in the queryFn, where a throw becomes a real query error with retries
queryFn: async () => {
  const raw = await api.get('/orders');
  if (!isValid(raw)) throw new Error('bad payload'); // now status === 'error'
  return parse(raw);
},
```

---

## Gotchas

**★ 🔴 `isLoading` in v5 does not mean "loading".** It is `isFetching && isPending` — the *first* fetch only. v4 code where `isLoading` meant "there is no data" now means something strictly narrower, and the migration guide records the swap: *"`status: loading` has been changed to `status: pending` and `isLoading` has been changed to `isPending`"*, plus *"`isInitialLoading` has now been renamed to `isLoading`"*. The two readings diverge exactly where it hurts: a disabled query has no data and is not fetching, so `isPending` is true and `isLoading` is false, and a v4-shaped `if (isLoading) return <Spinner/>` now falls through to render `undefined` data.

**★ `isRefetching` exists, and it is almost always the flag people hand-roll.** `isFetching && !isPending` written out by hand appears in a great many codebases; the library ships it as `isRefetching`, defined in the TSDoc as *"true whenever a background refetch is in-flight, which _does not_ include initial `pending`"*. Using `isFetching` for a refresh bar puts the bar on screen during the very first load, next to the skeleton, which is where the "why are there two spinners" bug reports come from.

**★ Structural sharing quietly stops working on non-JSON data.** *"Structural sharing only works with JSON-compatible values, any other value types will always be considered as changed."* A `queryFn` that returns `Date` objects, a `Map`, or class instances produces a new `data` reference on every background refetch even when nothing changed — so every `useMemo`, `useEffect` and memoised child keyed on `data` re-runs on every focus event. The symptom is a component that re-renders on tab switches for no visible reason, and the cause is one `new Date(...)` in a response mapper.

**★ The object `useQuery` returns is never referentially stable — only `data` is.** *"The top level object returned from `useQuery`, `useInfiniteQuery`, `useMutation` and the Array returned from `useQueries` is **not referentially stable**. It will be a new reference on every render. However, the `data` properties returned from these hooks will be as stable as possible."* Putting the result object in a `useEffect` dependency array gives you an effect that runs on every render; passing it to a `React.memo` child gives you a memo that never hits.

**★ Tracked properties are opt-out by accident, in three separate ways.** The Proxy only notifies on properties you actually read — *"e.g. because properties like `isFetching` or `isStale` might change often, but are not used in the component"*. Object rest destructuring disables it (*"If you use object rest destructuring, you will disable this optimization"*), `notifyOnChangeProps: 'all'` disables it (*"the component will re-render whenever a query is updated"*), and spreading the result into another object disables it. None of the three produces an error; all three produce a profiler flame graph.

**★ 🔴 The subscription widens where the Proxy is *read*, not where the value is used.** A custom hook that ends `return { todos, ...rest }` has already touched every key inside the hook, so the widening is invisible at every call site and identical for all of them. This is why the defect scales: one convenience wrapper, copied into a dozen components, subscribes a dozen components to `isFetching`. The lint rule flags this case specifically — *"When typed linting is enabled, the rule also flags rest destructuring on custom hooks that return a TanStack Query result."*

**★ `notifyOnChangeProps` is an all-or-nothing hand-off.** Set it and you own the list forever: *"Since you are not using tracked queries, you are responsible for specifying which props should trigger a re-render."* A component later edited to display `isRefetching` will not re-render for it, because the array still says `['data', 'error']` — a bug with no error, no warning, and a stale indicator that simply never updates. The default tracked behaviour has no such failure mode; prefer it unless you have measured a reason.

**★ `select` narrows the subscription, but only if its reference is stable.** *"The `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed."* An inline arrow is a new reference every render, so it runs every render — and because it usually returns a fresh object or array, the derived `data` is also a new reference every render, which defeats the very memoisation you reached for `select` to get. Module scope or `useCallback`, always.

**★ `select` is not a validation layer.** *"`select` operates on successfully cached data and is not the appropriate place to throw errors. The source of truth for errors is the `queryFn`, and a `select` function that returns an error results in `data` being `undefined` and `isSuccess` being `true`."* That combination — success with no data — is one of the hardest states to debug from a screenshot, because every status flag says the query worked.

**★ A custom `structuralSharing` function must return the same type it was given.** The TSDoc: *"Set this to a function which accepts the old and new data and returns resolved data of the same type."* It is called with `unknown` on both sides, so TypeScript will not stop you returning something else, and what you return becomes `data` verbatim. A comparator that accidentally returns a boolean replaces the entire cached payload with `true`.

## Interview questions

**★ `isLoading`, `isPending`, `isFetching`, `isRefetching` — when is each one true?**
`isPending` means there is no data and no completed attempt yet; it is derived from `status`, not from the fetch, so it stays true for a disabled query that has never run. `isFetching` means the `queryFn` is executing right now, *"which includes initial `pending` as well as background refetch"*. `isLoading` is the conjunction `isFetching && isPending` — the first fetch only, which is what a full-page skeleton keys on. `isRefetching` is the complement `isFetching && !isPending` — every background fetch and no initial one, which is what a subtle refresh bar keys on. Choosing wrong produces the two classic bugs: a skeleton that flashes over perfectly good data on every tab switch, and a refresh indicator that appears during the first load when there is nothing yet to refresh.

**★ Why does a background refetch usually not re-render the whole page?**
Two mechanisms, both on by default. Structural sharing compares the incoming response against the cached one and keeps the old reference when nothing changed, so `data` after a refetch is frequently the *same object* — and when only part changed, the unchanged sub-trees keep their references too. Tracked properties then wrap the result in a Proxy and only notify on properties the component actually read, so a component that renders `data` is not woken by `isFetching` flipping true and then false. The interesting part of the answer is how each one is lost: structural sharing needs JSON-compatible values, and tracked properties are defeated by rest destructuring, by `notifyOnChangeProps: 'all'`, and by spreading the result.

**★ A component re-renders on every tab switch even though the data never changes. Walk me through the diagnosis.**
Three candidates, in the order they are worth checking. First, is the component reading a property that genuinely changes? A refetch flips `isFetching` twice, so any component that reads it re-renders twice per refetch by design — including one that reads it only through a rest-spread it never uses. Second, is structural sharing actually applying? If the `queryFn` returns `Date` objects or a `Map`, every response is "changed" by definition and `data` is a new reference each time. Third, is the value being passed down the container rather than the payload? The result object is a new reference every render, so a `React.memo` child receiving it can never bail out. All three look identical in a profiler and have completely different fixes.

**★ Why is `const { data, ...rest } = useQuery(...)` a performance bug rather than a style choice?**
Because building `rest` requires reading every remaining key, and reading a key is exactly what the tracked-properties Proxy uses to record a subscription. The component ends up subscribed to `isFetching`, `isStale`, `failureCount`, `dataUpdatedAt` and everything else, so it re-renders whenever any of them changes — which, for a query with background refetching enabled, is constantly. The library ships a recommended lint rule for it, `@tanstack/query/no-rest-destructuring`, and the rule's own justification is that rest destructuring *"automatically subscribes to every field of the query result"*. The fix is to name the fields you use; the version that hides the bug is doing it inside a custom hook, where every call site inherits it.

**★ When is `notifyOnChangeProps` the right tool, and what does it cost?**
When you have measured a re-render problem that tracked properties cannot solve — most often a component that legitimately reads a frequently-changing property in one branch but does not want to re-render for it. Setting it moves you off tracked queries entirely, and the docs are explicit about the consequence: *"Since you are not using tracked queries, you are responsible for specifying which props should trigger a re-render."* The cost is a list that silently goes stale. Someone adds `isRefetching` to the JSX six months later, the indicator never updates, and nothing anywhere reports an error. Default tracking has no equivalent failure, so it should be the answer unless a profile says otherwise.

**★ Your API returns timestamps as `Date` objects. What breaks?**
Structural sharing, and therefore reference stability for the whole payload. The docs' precondition is *"Structural sharing only works with JSON-compatible values, any other value types will always be considered as changed"*, so every background refetch yields a brand-new `data` reference even for a byte-identical response. Downstream, every `useMemo` and `useEffect` keyed on `data` re-runs, and every memoised child re-renders — on every focus event, every reconnect, every poll tick. Two fixes: keep ISO strings in the cache and convert at the point of display or in `select`, or pass your own `structuralSharing` comparator that knows how to compare the non-JSON parts and returns the old reference when they match.

**★ What does `select` actually optimise, and how do people get it backwards?**
It narrows what the component subscribes to: the docs' example derives `todos.length`, and *"A component using the `useTodoCount` custom hook will only re-render if the length of the todos changes. It will **not** re-render if e.g. the name of a todo changed."* The two ways it is got backwards are both about identity. Inlining the function makes it a new reference every render, so it re-runs every render and the derived value is a new reference too — the opposite of the intended effect. And returning a freshly-built object or array from `select` on every call means the derived value never compares equal, so the narrowing buys nothing. `select` pays off when the derived value is a primitive, or when it is memoised as carefully as the function that produces it.

**★ Why can't you use `select` to reject a malformed response?**
Because the docs say it is the wrong layer, and the resulting state is actively misleading: *"a `select` function that returns an error results in `data` being `undefined` and `isSuccess` being `true`."* You get a query that reports success, has no data, never retries, and shows no error anywhere in the devtools. Validation belongs in the `queryFn`, where throwing produces a genuine `error` status, engages the retry policy, and surfaces in an error boundary — *"We recommend handling errors in the `queryFn` if you wish to have a query fail on incorrect data."*

---

← [Background Refetching](./01-automatic-freshness.md) · [Topic index](../README.md) · Next → [Polling](./01c-polling-and-refetch-interval.md)
