---
title: "`select` is a per-observer projection over one shared cache entry — and the memoisation people reach for it to get is exactly what an inline arrow function throws away, because the rule is referential"
sidebar_label: "01f · `select`"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations) (the re-run rule is quoted verbatim below and **closes an open question this corpus carried since 2026-09-06**), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🔬 `select`: One Entry, Many Views

**`select` answers a question the cache cannot: two components need the same server data in different shapes, and you want one request, one cache entry, and each component re-rendering only when *its own* shape changes.** It is a projection applied on the way out of the cache, per observer, never stored. That is the whole idea — and it comes with one rule that decides whether `select` makes your app faster or slower, which is that its re-runs are governed by **referential** identity, not by what the function computes. An inline arrow is a new reference on every render, so an inline `select` runs on every render. This page is the mechanism, that rule stated exactly, and the five ways it goes wrong.

## 1. The projection model

A cache entry is keyed by `queryKey` and holds whatever `queryFn` returned. `select` does not touch it:

```text
                    ONE network request, ONE cache entry
                    ['todos'] -> [ {id:1,…}, {id:2,…}, {id:3,…} ]
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              select: list        select: count       no select
              → filtered array    → 3                 → the raw array
              TodoList            TodoBadge           TodoExport
              re-renders when     re-renders when     re-renders when
              the FILTER result   the COUNT           anything changes
              changes             changes
```

Three observers, one entry, one request. The transform runs on the way out and its result is handed to that observer only. Nothing about `select` participates in cache identity — *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"* describes the key, and `select` is not in it.

**The alternative people reach for instead is a second key** — `['todos', 'count']` — and it is the wrong answer: a second cache entry, a second network request, two independent `staleTime` clocks, and two values that can now disagree with each other on screen.

## 2. 🔴 The re-run rule, stated exactly

This was an open question in this corpus until 2026-09-08. It is settled, and it is not what most people assume:

> *"The `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed"*
> *"This means that an inlined `select` function, as shown above, will run on every render."*

Read those two sentences together, because the second is a *consequence* of the first and it is the one that bites:

| `select` reference | `data` unchanged | `data` changed |
|---|---|---|
| **stable** (module-level, `useCallback`, factory) | ✅ does not re-run | re-runs once |
| **inline arrow** | 🔴 **re-runs on every render** | re-runs on every render |

An inline arrow is constructed fresh on every render, so it *always* "changed referentially". The library has no way to know the new function is identical to the old one — function equality is reference equality, and that is the only check available.

```tsx
// ⛔ Runs on EVERY render of this component, forever.
//    Cheap here; catastrophic in §4's version.
const { data } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  select: (todos) => todos.filter((t) => !t.done),
});
```

```tsx
// ✅ Stable reference, defined once at module scope. Re-runs only when `data` changes.
const selectOpenTodos = (todos: Todo[]) => todos.filter((t) => !t.done);

function OpenTodoList() {
  const { data } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos, select: selectOpenTodos });
  return <List items={data ?? []} />;
}
```

```tsx
// ✅ When the projection depends on a prop, useCallback is the stabiliser — and its
//    dependency array is now load-bearing: get it wrong and you are back to every render.
function TodoList({ ownerId }: { ownerId: string }) {
  const select = useCallback(
    (todos: Todo[]) => todos.filter((t) => t.ownerId === ownerId),
    [ownerId],
  );
  const { data } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos, select });
  return <List items={data ?? []} />;
}
```

⚠️ **Note the irony worth saying out loud.** People adopt `select` *for* render optimisation — to stop a component re-rendering when an irrelevant part of the response changes. Written inline, it does still deliver that (the *output* is compared, so an unchanged projection does not re-render), but it pays for it by running the transform on every render. You get the render saving and lose the compute saving, and if the transform is expensive that is a bad trade you made without noticing.

## 3. The purity constraint, and why it is not optional

`select` must be a **pure function of its input**. The library decides when to call it, its result is not stored anywhere you can inspect, and — per §2 — it may run on every render. So:

- **No side effects.** No `setState`, no analytics, no toasts, no cache writes. A `select` that fires an event fires it an unbounded number of times.
- **No reading anything but the argument.** A `select` that closes over a ref, a context value or `Date.now()` produces results the library believes are stable when they are not.
- **No throwing.** `select` runs outside the fetch, so an exception in it is not a query error — it does not populate `error`, it does not retry, and it is not caught by `throwOnError`. It propagates as a render-time exception into the nearest React error boundary. **Do the defensive work in `queryFn` where a throw becomes a query error you can render.**

```tsx
// ⛔ Every one of these is a bug, and none of them is a type error.
select: (todos) => {
  analytics.track('todos_projected');           // fires on every render
  setVisibleCount(todos.length);                // setState during render
  return todos.filter((t) => t.due < Date.now()); // result depends on the clock, not on data
}
```

## 4. What it costs on a large response

The transform runs against the whole cached value. On a 20,000-row response, a `select` that does `rows.filter(...).map(...).sort(...)` is three passes plus an allocation — and inline, that is three passes **on every render**, including renders caused by something else entirely, like a parent's state change.

**The fix is ordering, not cleverness:**

1. **Stabilise the reference first.** It is one line and it converts "every render" into "when `data` changes", which is usually a several-hundred-fold reduction on its own.
2. **Then ask whether the transform belongs in `queryFn` instead.** If *every* consumer wants the same shape, transform once on the way in and cache the transformed value — that runs once per fetch rather than once per data-change per observer. `select` earns its cost only when consumers genuinely want *different* shapes.
3. **Only then consider memoising inside `select`**, which is usually a sign the answer was actually (2).

That first-versus-second distinction is exactly the `transformResponse`-versus-`select` split the RTK Query migration runs into — see [`01b` of topic 16](../16-migration-recipes/01b-rtk-query-the-option-by-option-map.md), which covers the porting direction.

## 5. `select` and the flags

**`select` transforms `data`. It does not touch `status`, `fetchStatus`, or any flag derived from them.** That has one consequence people get wrong constantly:

```tsx
// ⛔ This does NOT make `data` safe to use.
const { data } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos, select: (d) => d ?? [] });
return <List items={data} />;      // 💥 data is undefined while the query is pending
```

While the query is pending **there is no data, so `select` is not called at all** — the defaulting expression never runs and `data` is `undefined` regardless of what it would have returned. It reads exactly like a null-safety measure and is not one. The availability guard is still required, and the flag it should use is `isPending` — [`01h` of topic 16](../16-migration-recipes/01h-the-status-rename-and-the-isloading-trap.md) is why that is `isPending` and not `isLoading`.

Two further points:

- **The projection's *type* is what `data` is typed as.** `select: (d: Todo[]) => d.length` gives you `data: number | undefined`. That is the intended ergonomics, and it means a `select` returning a narrower type is also documentation.
- ⚠️ **Whether the *result* of `select` is itself structurally shared is a separate question from whether `data` is**, and I could not settle it from the guides available on 2026-09-08. What is quotable is the entry-level behaviour — *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"* — and the §2 rule above. Structural sharing is [`01g` of topic 04](../04-caching-and-invalidation/01g-structural-sharing.md); if the referential stability of a `select` result matters to a `useMemo` or `React.memo` downstream, verify it against the version you install rather than trusting either page.

## Gotchas

**★ `select` gives you a projection, not a second cache entry.** Two hooks on the same key with
different `select` functions still share one entry and one network request; the transform runs on the
way out. The corollary is the constraint: `select` must be a pure function of `data`, because the
library may call it whenever it likes and the result is not stored anywhere you can inspect.

**★ Symptom: you added `select` to reduce re-renders and the component got slower.** Cause: the `select` is inline, so it is a new reference every render and therefore *"will run on every render"*. You kept the render saving and lost the compute saving. Fix: hoist it to module scope, or wrap it in `useCallback` with an honest dependency array. This is one line and it is the single highest-value edit on any page using `select`.

**★ Symptom: a `useCallback`-wrapped `select` still runs on every render.** Cause: something in its dependency array is itself unstable — an object or array literal built in the component body, or a function prop from a parent that is not memoised. The `useCallback` faithfully returns a new function because its deps genuinely changed. Fix: stabilise the dependency, not the `select`. If the dep is a filter object, either hoist it or move it into the `queryKey` where object identity does not matter, because keys are hashed.

**★ Symptom: an analytics event or a toast fires dozens of times for one data change.** Cause: a side effect inside `select`, which the library may call on any render and calls on *every* render when inlined. Fix: `select` is a pure projection; put the effect in a `useEffect` keyed on the projected value. Note this is the same reasoning that removed `onSuccess`/`onError`/`onSettled` from queries in v5 — see [`01f` of topic 16](../16-migration-recipes/01f-v4-to-v5-mechanical-versus-semantic.md).

**★ Symptom: `select: (d) => d ?? []` and the component still crashes on `data.map`.** Cause: `select` is not invoked while the query is pending, because there is no data to project. The default expression never runs. Fix: guard on `isPending` before touching `data`; `select` narrows the shape, never the availability.

**★ Symptom: an error thrown inside `select` crashes the app instead of showing your error UI.** Cause: `select` runs outside the fetch, so a throw is not a query error — `error` stays null, no retry happens, `throwOnError` does not see it, and the exception reaches the nearest React error boundary as a render-time crash. Fix: make `select` total (handle the shapes it can actually receive), and do validation that *should* fail the query inside `queryFn`, where a throw becomes a proper error state.

**★ Symptom: a value derived in `select` is subtly stale or inconsistent between two components.** Cause: `select` read something other than its argument — `Date.now()`, a ref, a context value. Each observer's projection was computed at a different moment from inputs the library does not track, so it has no idea they should be recomputed. Fix: everything the projection depends on is either the argument or lives in the `queryKey`.

**★ Symptom: you reached for a second query key to get a derived value — `['todos', 'count']`.** Cause: treating a projection as a separate resource. Fix: same key, second `select`. A second key buys a second entry, a second request, two `staleTime` clocks, and the possibility of the list and its count disagreeing on screen — which is a bug class that simply cannot occur with one entry.

**★ Symptom: `select` returns a new array every time and a `React.memo` child re-renders anyway.** Cause: a projection like `.filter()` allocates a fresh array on each run, so its referential identity changes even when the contents are identical. Fix: stabilise the `select` reference first — that stops most of the runs. If a stable *result* identity is genuinely required downstream, that depends on whether the projection's output is structurally shared, which is the unresolved point marked in §5; verify it rather than assuming.

**★ Symptom: the transform got expensive and you started memoising inside `select`.** Cause: usually the wrong layer. Fix: ask whether every consumer wants this same shape — if so it belongs in `queryFn`, where it runs once per fetch and the *cache* holds the transformed value. `select` is for when consumers want genuinely different shapes; paying its cost for a shape everyone shares is the mistake.

**★ Symptom: `getQueryData` returns the raw response, not the shape your components see.** Cause: `select` is per-observer and never written back, so the cache holds what `queryFn` returned. Anything reading the cache directly — `getQueryData`, a `setQueryData` updater, devtools — sees the untransformed value. Fix: this is correct and desirable, but it means a `setQueryData` updater must be written against the raw shape. Direct cache access is [`01e` of topic 04](../04-caching-and-invalidation/01e-direct-cache-access.md).

**★ Symptom: two components with different `select` functions each trigger their own fetch.** Cause: their `queryKey`s differ, not their `select`s — almost always because one of them built the key inline with the array elements in a different order. *"Array item order matters!"* Fix: one key factory, and check it before blaming `select`, which cannot cause a second request under any circumstances.

## Interview questions

**★ Two components need the same list — one renders it filtered, the other renders only its length.
How many cache entries, how many requests, and how do you write it?**
One entry and one request, provided both use the same `queryKey`. Give each hook its own `select` —
one returning `data.filter(...)`, the other returning `data.length` — and the transform happens per
consumer while the cached array stays untouched. The mistake to avoid is giving the count its own key
like `['todos', 'count']`, which buys a second entry, a second request and two things that can now
disagree with each other.

**★ When does `select` re-run, exactly?**
*"The `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed."* The referential half is the one that matters in practice, because *"an inlined `select` function… will run on every render"* — an arrow function written in the options object is constructed fresh each render and therefore always counts as changed. So the honest answer is: with a stable reference, only when `data` changes; written inline, on every single render including ones caused by unrelated state elsewhere in the tree.

**★ Someone adds `select` specifically to improve performance and the profiler gets worse. Explain.**
They wrote it inline. `select` delivers two separate savings and they only kept one. The render saving still works — the projection's output is compared, so an unchanged result does not re-render the component. The compute saving is gone, because a new function reference on every render means the transform executes on every render. On a small array nobody notices; on a large response with a `filter().map().sort()` it is three passes per render, triggered by any state change anywhere in the parent tree. Hoisting the function to module scope or wrapping it in `useCallback` restores it.

**★ Why must `select` be pure, and what specifically goes wrong if it is not?**
Because the library controls when it runs and does not tell you. It may run on every render, its result is not persisted anywhere inspectable, and there is no ordering guarantee relative to your effects. A side effect inside it fires an unbounded number of times; reading `Date.now()` or a ref makes the result depend on inputs the library cannot track, so it will happily reuse a stale projection or recompute one you thought was stable; and a `setState` inside it is a state update during render. None of these are type errors, and none of them are visible until the component starts re-rendering for an unrelated reason.

**★ What happens if `select` throws?**
It is not a query error. `select` runs when the data is delivered to the observer, not during the fetch, so `error` stays null, the retry machinery never engages, and `throwOnError` has nothing to act on. The exception surfaces as a render-time crash caught by the nearest React error boundary — which is usually much further up than the component and produces a far worse user experience than the error state you already built. The rule that follows: validation which should *fail the query* belongs in `queryFn`, and `select` should be total over the shapes it can actually receive.

**★ `select: (d) => d ?? []` — is that a safe way to avoid undefined data?**
No, and it is a common false reassurance because it reads exactly like one. While the query is pending there is no data, so `select` is not called at all and the defaulting expression never executes; `data` is `undefined` regardless. `select` changes the *shape* of data, never its *availability*. The guard is still `isPending`, and on TanStack Query v5 specifically it must be `isPending` rather than `isLoading`, because `isLoading` is now `isPending && isFetching` and is false for a disabled or offline query that also has no data.

**★ When should the transform go in `queryFn` instead of `select`?**
When every consumer wants the same shape. `queryFn` runs once per fetch and its result is what gets cached, so the transform cost is paid once and everything reading the cache — including `getQueryData` and any `setQueryData` updater — sees the transformed shape consistently. `select` runs per observer and caches nothing, so paying its cost for a projection everybody shares is pure overhead. `select` earns its keep precisely when consumers want *different* shapes from one entry. This is the same distinction as RTK Query's `transformResponse` versus `selectFromResult`, which is why a literal port of `transformResponse` into `select` is a mistake.

**Does `select` affect what other code sees in the cache?**
No, and that is the point of it. The cache holds whatever `queryFn` returned; `select` is applied on the way out to one observer and is never written back. So `getQueryData` returns the raw shape, a `setQueryData` updater receives the raw shape, and the devtools show the raw shape. This is desirable — it means a projection cannot corrupt the shared entry — but it is a real trap when someone writes a `setQueryData` updater against the shape their component renders rather than the shape the cache actually holds.

**Can two different `select` functions on the same key cause two requests?**
Never. `select` plays no part in cache identity — the key does, and only the key. If you are seeing two requests, the two `queryKey`s differ, and by far the most common reason is that one of them was built inline with its array elements in a different order, since *"Array item order matters!"* while object key order does not. Look at the keys, not at the projections.

---

← [`initialData` vs `placeholderData`](./01e-initialdata-vs-placeholderdata.md) · [Topic index](../README.md) · Next → [`queryOptions` factories](./01g-queryoptions-factories-and-type-inference.md)
