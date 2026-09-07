---
title: "A gated query opts out of far more than the first fetch — it ignores invalidation, keeps `refetch`, loses narrowing unless you use `skipToken`, and never follows its parent's refetch"
sidebar_label: "The Gate in Full · `skipToken`"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Disabling / Pausing Queries (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/disabling-queries), [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🚧 The Gate in Full: What a Disabled Query Ignores, `skipToken`, and Whether Children Follow

## 1. Under-The-Hood Mechanics

[01](01-query-composition.md) treats `enabled` as a switch that delays one fetch. That is the
smallest true description of it. The complete one is that a gated query has **opted out of the
automatic machinery entirely** — it does not fetch on mount, does not refetch in the background,
and does not respond to invalidation — while keeping exactly one manual trigger. Every surprise
in this chunk follows from that single fact.

### The complete list, quoted

Disabling Queries prints it as five statements, and each of them is load-bearing:

> *"If the query has cached data, then the query will be initialized in the `status === 'success'` or `isSuccess` state."*
> *"If the query does not have cached data, then the query will start in the `status === 'pending'` and `fetchStatus === 'idle'` state."*
> *"The query will not automatically fetch on mount."*
> *"The query will not automatically refetch in the background."*
> *"The query will ignore query client `invalidateQueries` and `refetchQueries` calls that would normally result in the query refetching."*

and then the exception that makes the whole thing usable:

> *"`refetch` returned from `useQuery` can be used to manually trigger the query to fetch. However, it will not work with `skipToken`."*

Note the first line: a gated query with data in the cache is `success`, not `pending`. So the
same component can render instantly for a returning user and spin forever for a new one, which is
why the forever-spinner in [01](01-query-composition.md) is so often reported as intermittent.

### `skipToken`: the typed gate, and the one thing it takes away

`enabled: !!userId` leaves TypeScript believing `userId` is still possibly `undefined` inside
`queryFn` — the gate is a runtime guarantee the compiler cannot see, so you write `!` and hope
nobody relaxes the gate later. `skipToken` moves the decision into the `queryFn` slot itself:
return it *instead of* a function and the query is disabled, with the narrowing intact and no
assertion.

```tsx
import { skipToken, useQuery } from '@tanstack/react-query';

const userId = user?.id;                       // a const, so the narrowing survives the closure
const orders = useQuery({
  queryKey: ['orders', userId],
  queryFn: userId ? () => fetchOrdersForUser(userId) : skipToken,   // no `!`, no `enabled`
});
```

The trade is stated in one sentence and it is not small:

> *"`refetch` from `useQuery` will not work with `skipToken`. Calling `refetch()` on a query that uses `skipToken` will result in a `Missing queryFn` error because there is no valid query function to execute."*

So the two forms are not interchangeable. `skipToken` for a genuinely dependent query, where you
never want to force a fetch that has no id to fetch with. `enabled: false` for a *lazy* query — a
filter form that must not fire on mount, an export that runs from a button — where `refetch()` is
the entire point.

### Placeholder and initial data get their own chunk

`placeholderData` and `initialData` both make a gated query render as though it already has data,
and in a chain they fail in opposite ways — one is a render-time guess, the other is a cache
write that every other observer reads as a fetched fact. That is
[01f](01f-placeholder-and-initial-data-in-a-chain.md).

### Refetching the parent does not refetch the child

There is no parent/child relationship in the cache — only two independent entries, one of whose
keys happens to be derived from the other's data. Important Defaults lists what actually causes a
refetch:

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

"The query it depends on refetched" is not on that list, and there is no mechanism that would put
it there. What *does* propagate is a **key change**: query keys *"act as dependencies for your
query functions"*, they are *"hashed deterministically"*, and a changed variable means a
different entry. So the rule is mechanical — if the parent refetches and returns the same id, the
child's key is byte-identical and nothing happens; if it returns a different id, the child is now
observing a different cache entry and will fetch it (or serve it from cache if it is already
there and fresh). If you need the child refreshed because the server changed underneath it,
invalidate the child's key yourself.

---

## 2. Real-World Engineering Scenario

**Scenario**: A "Reassign Ticket" Action Whose Customer Panel Kept Showing the Old Customer.
Reassigning a ticket to a different customer updated the ticket query correctly and left the billing panel below it showing the previous customer's balance. Three separate mechanisms were involved and each looked innocent alone. The panel used `placeholderData: (prev) => prev` so the layout would not jump, which meant the stale value rendered in `success` state with no spinner. The panel's `queryKey` did include the customer id, so it *did* eventually correct itself — but only after its own fetch resolved, and nobody had branched on `isPlaceholderData` to mark the interval. And the `invalidateQueries` fired by the reassign mutation had done nothing to the panel during the window when it was still gated, because a disabled query ignores invalidation. The fix was one line — rendering a dimmed state while `isPlaceholderData` was true — plus deleting an invalidation that had never been able to work.

---

## 3. Production-Grade Code Example

```tsx
// A gated query that is honest about every one of its states
function CustomerBillingPanel({ ticketId }: { ticketId: string }) {
  const ticket = useQuery({ queryKey: ['ticket', ticketId], queryFn: () => fetchTicket(ticketId) });
  const customerId = ticket.data?.customerId;

  const billing = useQuery({
    queryKey: ['billing', customerId],
    queryFn: customerId ? () => fetchBilling(customerId) : skipToken,  // typed gate, no `!`
    placeholderData: (previous) => previous,   // keep the last panel while a new id loads
  });

  if (ticket.isError) return <ChainBroken error={ticket.error} />;
  if (ticket.isLoading || billing.isLoading) return <PanelSkeleton />;
  if (billing.isPending) return <NoCustomerOnThisTicket />;  // gated: no data, nothing running

  // `success` here may still be the PREVIOUS customer's data — say so rather than implying freshness
  return <BillingCard data={billing.data} stale={billing.isPlaceholderData} />;
}
```

```tsx
// A LAZY query: enabled:false plus refetch(), which is the case skipToken cannot serve
function ExportButton({ filters }: { filters: ExportFilters }) {
  const { refetch, isFetching } = useQuery({
    queryKey: ['export', filters],
    queryFn: () => buildExport(filters),
    enabled: false,          // must NOT run on mount, or on focus, or on invalidation
    staleTime: Infinity,
  });

  return (
    <button disabled={isFetching} onClick={() => refetch()}>
      {isFetching ? 'Preparing…' : 'Export CSV'}
    </button>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Invalidating a Query That Cannot Hear You
```typescript
// ❌ the child is still gated, so this call is discarded — not queued, discarded
queryClient.invalidateQueries({ queryKey: ['billing', customerId] });

// ✅ invalidate the PARENT, whose id change is what moves the child to a new key;
// or invalidate the child once its gate is open
queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
```

### ⚠️ Pitfall 2: `skipToken` Where You Needed a Manual Trigger
```tsx
// ❌ refetch() throws `Missing queryFn` — there is no function to call
const { refetch } = useQuery({ queryKey: ['export', filters], queryFn: skipToken });

// ✅ a lazy query is enabled:false, which keeps refetch() working
const { refetch } = useQuery({ queryKey: ['export', filters], queryFn: () => buildExport(filters), enabled: false });
```

## Gotchas

**★ A gated query is deaf to `invalidateQueries` and `refetchQueries`.** This is documented behaviour, not a bug: *"The query will ignore query client `invalidateQueries` and `refetchQueries` calls that would normally result in the query refetching."* So a mutation that correctly invalidates `['orders']` does nothing at all to a child that is still waiting on its parent — and, more surprisingly, does nothing to a query you disabled on purpose to build a manual "search" form. The invalidation is not queued for later delivery; it is ignored.

**★ `refetch()` is the escape hatch a gated query still has.** The same list continues: *"`refetch` returned from `useQuery` can be used to manually trigger the query to fetch."* That is what makes `enabled: false` the right tool for a lazy/manual query — a filter form that must not fire on mount, an export that runs on a button — and it is the difference that matters when choosing between `enabled: false` and `skipToken`, which cannot be refetched at all.

**★ `enabled` gates the fetch; it does not narrow the type.** `queryFn: () => fetchOrders(user!.id)`
compiles because you asserted, and the assertion is genuinely safe *only* because `enabled` is
correct. Change the gate later — add a feature flag, relax it during a refactor — and the `!` is
now a live null-dereference that TypeScript already agreed to. `skipToken` is the alternative
that makes the compiler enforce what the gate was promising.

**★ 🔴 `refetch()` on a `skipToken` query throws instead of fetching.** *"Calling `refetch()` on
a query that uses `skipToken` will result in a `Missing queryFn` error because there is no valid
query function to execute."* This is the one asymmetry between the two ways of disabling a query,
and it decides which to use: `skipToken` for a dependent query that has nothing to fetch with,
`enabled: false` for a lazy query whose whole design is a manual trigger. Refactoring one into
the other "for type safety" is how a working Export button starts throwing.

**★ A gated query with cached data is `success`, not `pending`.** *"If the query has cached data,
then the query will be initialized in the `status === 'success'` or `isSuccess` state."* The
practical consequence is that gating bugs are intermittent by nature: a returning user whose
entry is still in the cache renders immediately, and only the cold path spins. It is also why
"works on my machine" is unusually literal here — your cache is warm from the last twenty
reloads.

**★ Refetching the parent does not refetch the child.** The list of automatic refetch triggers is
*"New instances of the query mount, The window is refocused, The network is reconnected"* — and
"its dependency refetched" is not among them, because the cache has no notion of a dependency.
What propagates is a key change: same id, byte-identical key, nothing happens; different id, a
different cache entry and a fetch. Code that refetches the parent expecting the whole chain to
refresh silently updates only the first link.

**★ Re-enabling a gated query does not always fetch.** The gate opening makes the query eligible
for the normal rules, not guaranteed to hit the network. If the key it lands on already has fresh
data in the cache, it renders that instead — which is correct, and is exactly what makes a
composition fast the second time — but it means "I opened the gate and no request went out" is
usually cache behaviour rather than a broken gate. Confirm with the key and its staleness before
you go looking for a bug in `enabled`.

**★ An empty `queries` array is not a disabled query.** There is no `enabled` at the array level,
so the dependent form falls back to `: []`, and `useQueries({ queries: [] })` is a hook that is
observing nothing at all — not pending, not fetching, not erroring. Every aggregate you compute
over it reports "done". This is the single most common way a dependent fan-out renders an empty
page instead of a spinner; the fix and the reasoning are in
[01c](01c-combining-usequeries-results.md).

## Interview questions

**★ You invalidate after a mutation and a disabled query never refetches. Is that a bug?**
No, it is specified: *"The query will ignore query client `invalidateQueries` and
`refetchQueries` calls that would normally result in the query refetching."* A disabled query is
opted out of the automatic machinery entirely — no fetch on mount, no background refetch, and no
response to invalidation. It is not queued either, so the invalidation is not delivered later
when the gate opens; what makes the data correct after the gate opens is that the key changed, so
the query is reading a different cache entry. If you genuinely need a disabled query to run,
`refetch()` still works — that is the documented manual trigger, and it is the reason
`enabled: false` beats `skipToken` for lazy and manual queries.

**★ `enabled: false` or `skipToken` — how do you choose?**
By whether you will ever want to force this query to run. They disable identically as far as the
network is concerned, and `skipToken` is strictly better for types, because returning it from the
`queryFn` slot lets the compiler narrow the id instead of making you assert it. But *"`refetch`
from `useQuery` will not work with `skipToken`"* — the call fails with a `Missing queryFn` error,
since there is genuinely no function to invoke. So: `skipToken` for a dependent query, where
"fetch anyway" is meaningless because there is no id to fetch with; `enabled: false` for a lazy
or manual query, where the button that calls `refetch()` is the entire feature. Getting this
backwards produces a type-safe component with a dead button.

**★ The parent query refetches and returns fresh data. Does the child refetch?**
Only if the value the child's key is built from changed. There is no parent/child link in the
cache — just two entries, one keyed by a field of the other's response. The automatic refetch
triggers are *"New instances of the query mount, The window is refocused, The network is
reconnected"*, and "my dependency refetched" is not one of them. Since keys are *"hashed
deterministically"*, the same id produces the same key and nothing at all happens; a different id
produces a different key, which is a different cache entry, and the child fetches it or serves it
from cache. The practical implication is that refreshing a chain means invalidating each key you
actually care about, or invalidating a shared prefix that covers them.

**★ You open the gate and no network request goes out. Where do you look?**
At the cache entry for the key the query landed on, not at `enabled`. Opening the gate returns
the query to the normal rules, and the normal rules serve fresh cached data without a fetch —
`useQuery` only refetches a *stale* query on mount, and Important Defaults describes exactly that
behaviour. If the entry was populated a moment ago by a sibling component, a prefetch or a
`setQueryData`, the gate opening is invisible in the network panel and completely correct. The
things that would be actual bugs look different: a key you did not expect (check for `undefined`
in it), or a gate that never evaluated truthy at all, which shows up as `pending` with
`fetchStatus: 'idle'` rather than as a missing request.

---

← [What composition costs](./01d-what-query-composition-costs.md) · [Topic index](../README.md) · Next → [`initialData` in a chain](./01f-placeholder-and-initial-data-in-a-chain.md)
