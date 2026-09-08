---
title: "What Suspense Mode Takes Away: No `enabled`, No `placeholderData`, and Side-by-Side Queries That Are Not Parallel"
sidebar_label: "01b · What suspense removes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense), [Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries), [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries), [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data) — and the React reference for [`startTransition`](https://react.dev/reference/react/Suspense#preventing-unwanted-fallbacks). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# 🔄 What Suspense Mode Takes Away

**Three capabilities disappear the moment a query becomes a suspense query, and none of them
produce an error when you reach for them.** `enabled` is gone, so a conditional query has to become
a conditional *component*. `placeholderData` is gone, so the flicker-free pagination pattern from
[topic 07](../07-pagination-and-infinite-queries/01-paged-data-patterns.md) needs a different
mechanism — `startTransition`. And side-by-side suspense calls serialise into a waterfall that
looks identical to parallel code in review. This chunk is the one that costs people a sprint.

## 1. `enabled` does not exist — the gate moves up a component

The guide is explicit about the consequence of the guaranteed-defined `data`:

> *"On the flip side, you therefore can't conditionally enable / disable the Query."*

The two facts are the same fact. `data` can only be typed `T` if the query always runs; a query
that might be disabled has no data to guarantee. So `enabled` is not merely unsupported, it is
**incompatible with the mode's entire premise** — which is why the answer is never "find the
suspense equivalent of `enabled`" and always "move the condition to the component boundary".

```tsx
// ❌ There is no way to express this. The gate has nowhere to live inside the hook.
function OrderDetail({ orderId }: { orderId: string | null }) {
  const { data } = useSuspenseQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: orderId !== null,   // not an option on this hook
  });
  return <Detail order={data} />;
}
```

```tsx
// ✅ The gate is the parent. The suspense component only ever mounts when the query is valid,
// so `orderId` is genuinely a string by the time the hook sees it — the null is gone from the
// type, not merely guarded at runtime.
function OrderDetailPane({ orderId }: { orderId: string | null }) {
  if (orderId === null) return <EmptyState />;
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <OrderDetail orderId={orderId} />
    </Suspense>
  );
}

function OrderDetail({ orderId }: { orderId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });
  return <Detail order={data} />;
}
```

🔴 **This is a real design improvement disguised as a limitation.** The `enabled` pattern makes
every consumer of the hook handle a "query never ran" state that the type system cannot see. The
component split makes it structural: one component means "no selection", the other means "a
selection exists", and neither can be rendered in the other's situation.

For a *dependent* chain — where the gate is another query's result rather than a prop —
`skipToken` and the component split solve different halves; the chain mechanics are
[topic 08's](../08-dependent-and-parallel-queries/01e-the-gate-in-full-skiptoken-and-placeholder-chains.md)
and are worth reading before converting a chain to suspense.

## 2. `placeholderData` does not exist — `startTransition` replaces it

> *"`placeholderData` also doesn't exist for this Query. To prevent the UI from being replaced by
> a fallback during an update, wrap your updates that change the QueryKey into `startTransition`."*

The problem `placeholderData` solves in regular queries is that a key change is a *new query* with
no cached data, so the UI blanks. Under suspense it does not blank — it worse than blanks, it
**falls back to the skeleton**, taking the whole boundary's subtree with it. The React-level fix is
to mark the state update that changes the key as a transition, which tells React to keep showing
the previous UI while the new one prepares.

```tsx
// ❌ Clicking "next page" replaces the whole table with the boundary's skeleton on every click.
function OrdersTable() {
  const [page, setPage] = useState(1);
  const { data } = useSuspenseQuery({
    queryKey: ['orders', page],
    queryFn: () => fetchOrders(page),
  });
  return (
    <>
      <Rows rows={data.rows} />
      <button onClick={() => setPage((p) => p + 1)}>Next</button>
    </>
  );
}
```

```tsx
// ✅ The previous page stays on screen while page 2 loads, and `isPending` from the transition
// is the signal for the "loading" affordance — dim the table, disable the button.
import { useState, useTransition } from 'react';

function OrdersTable() {
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const { data } = useSuspenseQuery({
    queryKey: ['orders', page],
    queryFn: () => fetchOrders(page),
  });
  return (
    <>
      <Rows rows={data.rows} dimmed={isPending} />
      <button
        disabled={isPending}
        onClick={() => startTransition(() => setPage((p) => p + 1))}
      >
        Next
      </button>
    </>
  );
}
```

⚠️ **The `isPending` here is React's, not the query's.** It comes from `useTransition` and means
"a transition is in flight"; the suspense hook does not return a pending flag at all. Wiring the
dimming affordance to the wrong `isPending` is the usual first attempt and it silently never fires.

🔴 **`startTransition` must wrap the state update, not the render.** Wrapping the wrong thing —
the `setPage` call is inside it, the hook call is not — is the difference between a working
transition and one that does nothing, and nothing warns you either way.

## 3. Side-by-side suspense queries are a waterfall

This is asserted in [topic 08](../08-dependent-and-parallel-queries/01b-parallel-queries-and-usequeries.md)
and repeated here because it is the regression a suspense migration actually ships:

> *"When using React Query in suspense mode, this pattern of parallelism does not work, since the
> first query would throw a promise internally and would suspend the component before the other
> queries run."*

The mechanism is the same control-flow fact that makes `data` defined. The first hook suspends —
the render unwinds — the second and third hooks are **never called on that render pass**. When the
first resolves, React re-renders, the first hook now returns from cache, and the second suspends.
Three requests, three sequential round trips, code that reads as three independent fetches.

```tsx
// ❌ Serial. Total latency is the SUM of the three requests.
const { data: user } = useSuspenseQuery({ queryKey: ['user'], queryFn: fetchUser });
const { data: teams } = useSuspenseQuery({ queryKey: ['teams'], queryFn: fetchTeams });
const { data: projects } = useSuspenseQuery({ queryKey: ['projects'], queryFn: fetchProjects });
```

```tsx
// ✅ One hook, one suspension, three concurrent requests. Total latency is the MAX.
const [user, teams, projects] = useSuspenseQueries({
  queries: [
    { queryKey: ['user'], queryFn: fetchUser },
    { queryKey: ['teams'], queryFn: fetchTeams },
    { queryKey: ['projects'], queryFn: fetchProjects },
  ],
});
```

The docs name both remedies:

> *"use the `useSuspenseQueries` hook (which is suggested) or orchestrate your own parallelism with
> separate components."*

"Separate components" means each query lives in its own component under its own `Suspense`
boundary, so one suspending does not prevent the others from rendering — which works, and which
also gives you the staggered "popcorn" page from [01](./01-suspense-driven-fetching.md)'s gotchas.
The third remedy the docs do not frame as one is **prefetching**: a query already in cache does not
suspend, so a route loader that warms all three makes the serialisation moot. That is
[01d](./01d-fetch-on-render-and-streaming.md).

---

## Gotchas

**★ 🔴 Symptom: you add `enabled: false` to a `useSuspenseQuery` and TypeScript accepts it in a
JavaScript codebase, but the query runs anyway.** Cause: the option is not part of the hook's
type, and an untyped or loosely-typed options object simply carries a property the hook never
reads. Fix: there is no in-hook fix — split the component as in §1. In TypeScript the excess
property check catches this on an inline object literal but **not** on a variable assigned first,
which is exactly how it reaches production:

```ts
// This compiles. `opts` is checked against a wider type, so `enabled` survives unread.
const opts = { queryKey: ['order', id], queryFn: fetchOrder, enabled: id !== null };
const { data } = useSuspenseQuery(opts);   // fetches unconditionally
```

**★ 🔴 Symptom: pagination under suspense flashes the full-page skeleton on every page change,
even though the previous page's data is right there.** Cause: a new key is a new query with no
data, and no data means suspend; `placeholderData` — the regular-query answer — *"doesn't exist for
this Query"*. Fix: `startTransition` around the state update that changes the key, per §2. Reaching
for `keepPreviousData` here compounds the error: it does not exist in v5 at all, having been
replaced by `placeholderData: keepPreviousData`, which is the option that does not exist in
suspense mode.

**★ Symptom: `startTransition` is in place and the fallback still appears.** Cause: usually one of
three things — the update was not actually inside the transition callback, the update came from an
input the user typed into (React does not defer urgent updates such as controlled input value),
or a **new** `Suspense` boundary mounted, which always shows its fallback because there is no
previous UI to preserve. Fix: keep the boundary mounted above the transitioning content rather
than rendering it conditionally beside it.

**★ 🔴 Symptom: three suspense queries, a network tab showing three sequential requests, and a
code review that approved it as parallel.** Cause: suspension unwinds the render before the later
hooks are called. Fix: `useSuspenseQueries`. This is invisible to every static check — the code
shape is identical to the parallel version, there is no lint rule for it, and the only artefact is
the waterfall in the network panel.

**★ Symptom: converting `useQueries` to `useSuspenseQueries` changed the result shape and the
destructuring broke.** Cause: the suspense variant does not return the `isPending`/`isError` fields
per query — same removal as the single-query hook, applied element-wise. Fix: destructure the
data-bearing results directly, and drop any `.every(q => q.isSuccess)` combination logic; under
suspense the array is only produced once every query has succeeded, so the check is dead code.

**★ Symptom: a dependent chain converted to suspense now fetches with `undefined` in the key.**
Cause: the chain's gate lived in `enabled`, and removing the option left the `queryFn` firing with
the placeholder value. Fix: the gate becomes the component split, exactly as §1 — the child that
holds the dependent query is not rendered until the parent's data exists, so the "not yet" state is
structurally unrepresentable rather than guarded.

**★ Symptom: the suspense migration made a previously-instant filter change slow.** Cause: filters
change the query key, every key change suspends, and the boundary's fallback is a full skeleton.
Fix: `startTransition` for the filter update, and check whether the filtered result is prefetchable
— a small enumerable filter set (status: open/closed/all) is a good candidate for warming on hover
or on mount, which removes the suspension entirely.

---

## Interview questions

**★ Why can `useSuspenseQuery` not support `enabled`?**
Because the mode's guarantee is that `data` is defined, and a disabled query has no data. The two
are the same statement seen from different ends: the type narrowing is only sound if the query
always runs. The docs put it as a direct consequence — *"On the flip side, you therefore can't
conditionally enable / disable the Query."* The replacement is not another option; the condition
moves to whether the component renders at all, which makes the invalid state unrepresentable
instead of merely guarded.

**★ Under suspense, what replaces `placeholderData: keepPreviousData` for pagination?**
`startTransition`, and it works at a different layer. `placeholderData` is a *query-level* answer —
show this value while the real one loads. `startTransition` is a *React-level* answer — keep the
entire previous render on screen while the new one prepares, including the parts that have nothing
to do with this query. The docs point at React's own documentation for it, which is the tell that
suspense mode delegates this concern upward rather than solving it in the cache.

**★ Three `useSuspenseQuery` calls in one component. How many requests are in flight at once?**
One. The first suspends, the render unwinds, and the remaining two hooks are never reached on that
pass. The docs state the mechanism directly — the first query *"would throw a promise internally
and would suspend the component before the other queries run"*. The fixes are `useSuspenseQueries`,
separate components under separate boundaries, or prefetching the keys so nothing suspends. It is
worth knowing this cold, because it is a performance regression that no test and no type check
will surface.

**★ You are asked to add a "show archived" toggle to a suspense-driven list. Walk through what
changes.**
The toggle changes the query key, so every flip suspends the boundary and flashes the skeleton.
Wrap the toggle's `setState` in `startTransition` and use the transition's `isPending` to dim the
list and disable the control. If the archived variant is cheap and enumerable, additionally
prefetch it — with both keys warm the toggle never suspends at all, and the transition becomes
belt and braces. What you do **not** do is reach for `placeholderData`; it is not an option on this
hook.

**★ Is the suspense waterfall a bug in TanStack Query?**
No — it is React's rendering model doing exactly what it is specified to do, surfaced by a data
library that participates in it. Any suspending data source has the same property; `use()` and
promise-throwing frameworks show it too. That is why the remedy is a *hook that suspends once for
many queries* rather than a fix inside the single-query hook: there is nothing to fix at that
level, because by the time the first hook suspends, the second call site does not exist yet.

---

← [Suspense-driven fetching](./01-suspense-driven-fetching.md) · [Topic index](../README.md) · Next → [Errors, boundaries and reset](./01c-errors-boundaries-and-reset.md)
