---
title: "Dependent & Parallel Queries: `enabled` Chaining & `useQueries()`"
sidebar_label: "Dependent & Parallel Queries"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries), [Disabling / Pausing Queries (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/disabling-queries), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Dependent & Parallel Queries: `enabled` Chaining & `useQueries()`

## 1. Under-The-Hood Mechanics

Real applications frequently need multiple queries whose relationship is either **sequential** (one genuinely depends on another's result) or **independent** (both can fire immediately, concurrently) — TanStack Query provides distinct patterns for each, and using the wrong one either introduces an unnecessary waterfall or attempts an impossible-to-satisfy request.

```
Dependent queries (via enabled):
  const { data: user } = useQuery({ queryKey: ['user', id], queryFn: fetchUser });
  const { data: orders } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: () => fetchOrders(user.id),
    enabled: !!user?.id,   ──► WON'T fire until user.id is actually available — a genuine, necessary waterfall
  });

Parallel queries (independent useQuery calls):
  const { data: user } = useQuery({ queryKey: ['user', id], queryFn: fetchUser });
  const { data: settings } = useQuery({ queryKey: ['settings', id], queryFn: fetchSettings });
  ──► BOTH fire immediately, concurrently — NO dependency between them

useQueries() — DYNAMIC, variable-length parallel queries (e.g. one query PER item in a list,
                 where the list's length isn't known until runtime)
```

### Dependent Queries: A Genuine, Necessary Waterfall
Some data truly cannot be fetched until a prior result is known (fetching a user's orders requires knowing the user's ID, which itself comes from an earlier fetch) — `enabled: !!previousResult` expresses this correctly, only firing the dependent query once its actual precondition is satisfied, rather than firing prematurely with an undefined/invalid parameter.

### The rest of this topic
Dynamic fan-out — `useQueries`, the Rules of Hooks and suspense — is
[01b](01b-parallel-queries-and-usequeries.md), and reading the array it hands back is
[01c](01c-combining-usequeries-results.md). What composition costs in round trips, and where the
join belongs, is [01d](01d-what-query-composition-costs.md). Everything else the gate does —
what a disabled query ignores, `skipToken`, and whether a child follows its parent's refetch —
is [01e](01e-the-gate-in-full-skiptoken-and-placeholder-chains.md); `placeholderData` versus
`initialData` in a chain is [01f](01f-placeholder-and-initial-data-in-a-chain.md).

### 🔴 The state a gated query is in: `pending`, with `fetchStatus: 'idle'`

The most expensive misreading of a dependent query is what the *second* hook returns **while it
waits**. There is no `disabled` status and no `isWaiting` boolean. The Dependent Queries guide
prints the exact sequence the `projects` query moves through — before the id exists, once it
does, and after the fetch resolves:

> *"status: 'pending' · isPending: true · fetchStatus: 'idle'"* → *"status: 'pending' ·
> isPending: true · fetchStatus: 'fetching'"* → *"status: 'success' · isPending: false ·
> fetchStatus: 'idle'"*

Disabling Queries states the same thing as a general rule, so it is not a quirk of that example:

> *"If the query does not have cached data, then the query will start in the `status === 'pending'` and `fetchStatus === 'idle'` state."*

Two fields, two questions — this is the sentence to memorise, from the Queries guide:

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*

A gated query has **no data** and **nothing running**. So `isPending` is `true` from first paint,
stays `true` for the entire parent fetch, and stays `true` **permanently** if the parent errors,
resolves to a user with no id, or is itself gated behind something that never arrives. Nothing
retries, nothing logs, no error boundary fires. The screen spins until somebody reloads it.

`isLoading` is the flag the docs point at for exactly this case:

> *"`isLoading` flag instead. It's a derived flag that is computed from: `isPending && isFetching` so it will only be true if the query is currently fetching for the first time."*

`isFetching` is false while the gate is shut, so `isLoading` is false while the gate is shut —
which is precisely what lets you tell *"loading"* apart from *"not started"*.

```tsx
const { data: user, isLoading: userLoading, isError: userFailed } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});

const orders = useQuery({
  queryKey: ['orders', user?.id],
  queryFn: () => fetchOrdersForUser(user!.id),
  enabled: !!user?.id,
});

// ❌ true from first paint, and NEVER false if `user` fails or resolves without an id
if (orders.isPending) return <OrdersSpinner />;

// ✅ every state is distinguishable, and the dead end is reachable
if (userFailed) return <CouldNotLoadUser />;                    // the chain is broken — say so
if (userLoading || orders.isLoading) return <OrdersSpinner />;  // something is genuinely running
if (orders.isPending) return <NothingToShowYet />;              // gate shut, nothing in flight
return <OrderTable rows={orders.data} />;
```

### `enabled` also accepts a callback

> *"The enabled option also accepts a callback that returns a boolean."*

That is all the guide says about the callback form on this page — it does not print the
callback's parameters, so treat the argument list as unspecified and write the predicate as
taking none:

```tsx
enabled: () => !!user?.id && featureFlags.ordersTab,
```

### The dependent key must contain the value it depends on

`enabled` decides *whether* to fetch. The key decides *what the result is filed under*. They are
independent settings, and getting the second one wrong is the failure that survives review,
because it only surfaces once a **second** value flows through the same component. Query Keys is
direct about it:

> *"Since query keys uniquely describe the data they are fetching, they should include any variables you use in your query function that **change**."*

The guide's framing is that *"query keys act as dependencies for your query functions"*, which is
what makes it true that *"queries are cached independently"*.

```tsx
// ❌ gate right, key wrong: EVERY user's orders are filed under the same entry
useQuery({
  queryKey: ['orders'],
  queryFn: () => fetchOrdersForUser(user!.id),
  enabled: !!user?.id,
});
// User A loads. User B mounts. The key is unchanged, so the cache already HAS an entry:
// B is served A's orders instantly, in `success` state, with no fetch and nothing to notice.

// ✅ the value the queryFn closes over is IN the key
useQuery({
  queryKey: ['orders', user?.id],
  queryFn: () => fetchOrdersForUser(user!.id),
  enabled: !!user?.id,
});
```

---

## 2. Real-World Engineering Scenario

**Scenario**: A Support Console Where the Ticket's Customer Is Only Known After the Ticket Has Loaded.
An agent opens `/tickets/:ticketId`. The ticket record carries a `customerId`, and the customer's billing summary lives behind a different service, so the second request genuinely cannot be formed until the first resolves — `enabled: !!ticket?.customerId` is the honest expression of that, and the billing panel sits in `pending` with `fetchStatus: 'idle'` until the id exists. The defect that reached production was not the waterfall: the panel branched on `isPending` to decide whether to show its spinner, so every ticket whose customer record had been deleted — an ordinary, expected state in that system — left an agent watching a spinner that could never resolve, with nothing in the network tab to explain it.

---

## 3. Production-Grade Code Example

```typescript
// Dependent queries — a genuine, necessary waterfall
function useUserOrders(userId: string) {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  const { data: orders } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: () => fetchOrdersForUser(user.id),
    enabled: !!user?.id, // waits for user to actually load — fetching orders needs a REAL user.id
  });

  return { user, orders };
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Creating an Unnecessary Waterfall for Genuinely Independent Data
```typescript
// ❌ WASTEFUL: settings doesn't actually depend on user's result AT ALL — chaining it via
// enabled introduces an UNNECESSARY sequential wait, doubling total load time for no reason
const { data: user } = useQuery({ queryKey: ['user', id], queryFn: fetchUser });
const { data: settings } = useQuery({
  queryKey: ['settings', id],
  queryFn: () => fetchSettings(id), // doesn't need `user` at all — id was already available!
  enabled: !!user, // ❌ unnecessary dependency — settings could have fired IMMEDIATELY
});

// ✅ CORRECT: fire independent queries in parallel, with no artificial enabled gating
const { data: settings } = useQuery({ queryKey: ['settings', id], queryFn: () => fetchSettings(id) });
```

### ⚠️ Pitfall 2: Forgetting `enabled` Guards Against `undefined`/Invalid Parameters, Not Just "Should I Fetch"
```typescript
// ❌ RISKY: without the enabled guard, this query fires IMMEDIATELY with user?.id being
// undefined the first time around — queryFn receives an invalid parameter, likely throwing
// or making a malformed request BEFORE user has actually loaded
const { data: orders } = useQuery({ queryKey: ['orders', user?.id], queryFn: () => fetchOrders(user.id) }); // no enabled guard!

// ✅ CORRECT: enabled prevents the query from firing AT ALL until its actual precondition is met
const { data: orders } = useQuery({ queryKey: ['orders', user?.id], queryFn: () => fetchOrders(user.id), enabled: !!user?.id });
```
---

## Gotchas

**★ 🔴 A dependent query whose gate never opens is `pending` forever, and that is the
forever-spinner.** Branching on `isPending` (or on `status === 'pending'`) is the natural thing
to write and it is wrong for any gated query: *"If the query does not have cached data, then the
query will start in the `status === 'pending'` and `fetchStatus === 'idle'` state."* If the
parent errors, or resolves to a user with no id, or the tab the parent lives in is never opened,
that state is terminal. There is no timeout and no retry, because nothing ever started. Branch on
`isLoading` — *"computed from: `isPending && isFetching`"* — and handle the parent's own error
state explicitly, as the example above does.

**★ `!!` rejects `0` and `''`, and a numeric id of `0` is a real id.** `enabled: !!user?.id` is
correct only while the dependency can never be legitimately falsy. A numeric primary key that can
be `0`, a page index that starts at `0`, a slug that can be the empty string — `!!` reads every
one of those as "not ready", the gate never opens, and you get the terminal `pending` above with
no error anywhere. Test for what you actually mean:

```tsx
enabled: user?.id !== undefined,   // fires for id === 0 and for id === ''
```

**★ Omitting the dependency from the key serves one user's data to the next.** The gate does not
help here: with `queryKey: ['orders']` the entry is already `success` when the second user
mounts, so there is no fetch, no loading state, and no error — just the wrong rows, rendered
confidently. It survives every manual test that involves one user and fails the moment two
identities pass through the same component (account switcher, admin impersonation, a
`/users/:id` route the user navigates between). Put the id in the key.

**★ Before the dependency arrives, the observer is subscribed to a *different* cache entry.**
While `user?.id` is `undefined` the key is `['orders', undefined]`; when the id lands the key
becomes `['orders', 'u_42']`, and that is a **different query** in the cache, not the same one
becoming enabled. Everything you did to the first key is therefore aimed at an entry that is
about to be abandoned — `setQueryData(['orders', user?.id], seed)` written during the parent's
fetch seeds the placeholder entry, and an `invalidateQueries` with the exact undefined-shaped key
matches nothing useful. Anything you want the child to find must be written under the key it will
have *after* the gate opens.

## Interview questions

**★ A dependent query renders a spinner that never goes away, and no request was ever made. What
happened?**
The component branched on `isPending`, and a gated query is `pending` with `fetchStatus: 'idle'`
— *"If the query does not have cached data, then the query will start in the `status ===
'pending'` and `fetchStatus === 'idle'` state."* `pending` means "we have no data", not "a
request is in flight", so it is true from first paint and stays true for as long as the gate is
shut. If the parent errored, or resolved without the id the gate tests for, the gate never opens
and the state is terminal — no retry, no timeout, no error boundary, because nothing ever
started. The fix is two-part: branch on `isLoading`, which is *"computed from: `isPending &&
isFetching`"* and so is false while the gate is shut, and render the parent's failure explicitly
instead of letting it fall through to the child's spinner.

**★ Explain `status` versus `fetchStatus`, and say which one tells you the gate is shut.**
*"The status gives information about the data: Do we have any or not? The fetchStatus gives
information about the queryFn: Is it running or not?"* They are orthogonal on purpose, because
every combination is reachable: `success` + `fetching` is a background refetch of data you are
already showing, `pending` + `fetching` is a genuine first load, and `pending` + `idle` is the
one that identifies a gated or paused query — no data, and nothing running to produce any. So
`fetchStatus` is the field that answers "is this waiting on its precondition"; `status` alone
cannot distinguish that from a first load.

**★ What does `enabled: !!userId` actually do, and when is `!!` the wrong test?**
It is the entire dependent-query mechanism: the second query is registered, keyed and observed
from the first render, but its `queryFn` is not invoked until the option evaluates truthy, at
which point the query transitions from `fetchStatus: 'idle'` to `'fetching'` on its own. `!!` is
wrong whenever the dependency has a legitimate falsy value — a numeric id of `0`, an empty-string
slug, an index that starts at zero. Then the gate never opens and the symptom is the terminal
`pending` above, with no error to trace, so the bug reads as "the second request is missing"
rather than as a boolean coercion. `userId !== undefined` says what you meant.

**★ Your dependent query's key is `['orders']` and the gate is correct. What breaks, and when?**
Nothing breaks for the first user, which is why it ships. Every user's orders are filed under one
entry, so when a second identity flows through the same component — an account switcher, admin
impersonation, navigating between two `/users/:id` routes — the cache already holds `success`
data for that key and serves it with no fetch, no loading state and no error. The rule the docs
give exists for this: *"Since query keys uniquely describe the data they are fetching, they
should include any variables you use in your query function that change."* The key is the
identity of the cached value; if two different values can share a key, one of them will be shown
in place of the other.

**★ Which cache entry is a dependent query attached to *before* its dependency arrives?**
The one its key spells out at that moment — `['orders', undefined]` — not the one it will have
later. When the parent resolves, the key becomes `['orders', 'u_42']`, and from the cache's point
of view that is a different query, with its own data, its own staleness and its own garbage
collection. This matters whenever you try to help the child along: seeding it with `setQueryData`
during the parent's fetch writes to the placeholder entry, and an exact-key invalidation aimed at
the pre-arrival key matches something that is about to be abandoned. Write to the key the query
will have once the gate opens, or seed the parent instead.

---

← [Infinite cache & refetch](../07-pagination-and-infinite-queries/01d-infinite-cache-refetch-and-manual-updates.md) · [Topic index](../README.md) · Next → [Parallel queries & `useQueries`](./01b-parallel-queries-and-usequeries.md)
