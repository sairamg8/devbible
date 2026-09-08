---
title: "`enabled` does not delay a fetch — it opts the query out of the automatic machinery entirely, and `skipToken` is the typed version that gives up `refetch` to get narrowing"
sidebar_label: "01b · `enabled` & `skipToken`"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Disabling / Pausing Queries (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/disabling-queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🚦 `enabled` and `skipToken`: the Gate, the State It Leaves Behind, and the Flag That Tells Them Apart

**`enabled: false` reads like "wait a moment before fetching". It is not a delay — it is a query that has stepped out of the automatic system and kept exactly one manual trigger.** It will not fetch on mount, will not refetch in the background, and will ignore `invalidateQueries` and `refetchQueries` outright. Everything that surprises people about disabled queries — the spinner that never stops, the invalidation that does nothing, the intermittent bug that only reproduces for new users — is a consequence of that one sentence, plus the fact that `status` and `fetchStatus` disagree in exactly this case.

## 1. What the gate actually turns off

The Disabling Queries guide states the behaviour as five separate facts, and each one matters:

> *"If the query has cached data, then the query will be initialized in the `status === 'success'` or `isSuccess` state."*
> *"If the query does not have cached data, then the query will start in the `status === 'pending'` and `fetchStatus === 'idle'` state."*
> *"The query will not automatically fetch on mount."*
> *"The query will not automatically refetch in the background."*
> *"The query will ignore query client `invalidateQueries` and `refetchQueries` calls that would normally result in the query refetching."*

and the one escape hatch:

> *"`refetch` returned from `useQuery` can be used to manually trigger the query to fetch. However, it will not work with `skipToken`."*

Read those in order and the design is coherent: the gate suppresses every *automatic* trigger — mount, focus, reconnect, invalidation — and leaves the imperative one alone. It is not "pause this query for a second"; it is "this query is under manual control until further notice".

🔴 **The first line is the one that produces bug reports.** A gated query whose key already has data in the cache initialises in `success`, not `pending`. So the same component renders instantly for a returning user and shows an empty/pending branch for a first-time one. That is why the classic forever-spinner is so often reported as intermittent and unreproducible on the developer's own machine, where the cache is warm from the previous route.

### The state a disabled query sits in

| | `status` | `fetchStatus` | `isPending` | `isFetching` | `isLoading` |
|---|---|---|---|---|---|
| disabled, no cached data | `'pending'` | `'idle'` | `true` | `false` | `false` |
| genuinely loading | `'pending'` | `'fetching'` | `true` | `true` | `true` |
| disabled, cached data present | `'success'` | `'idle'` | `false` | `false` | `false` |

The two axes are independent by design — *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"* A disabled query is the cleanest example of the combination: no data, nothing running. `isLoading` is the flag that separates the two rows, because v5 defines it as *"implemented as `isPending && isFetching`"*.

## 2. `skipToken`: the same gate, typed

`enabled: !!userId` is a runtime guarantee the compiler cannot see. Inside `queryFn` TypeScript still believes `userId` may be `undefined`, so you write `userId!` and rely on nobody ever loosening the `enabled` expression. `skipToken` moves the decision into the `queryFn` slot itself:

```tsx
import { skipToken, useQuery } from '@tanstack/react-query';

function useOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ['orders', userId],
    // return skipToken INSTEAD of a function — the query is disabled, and the narrowing holds
    queryFn: userId ? () => fetchOrdersForUser(userId) : skipToken,
  });
}
```

The trade is stated in one sentence and it is not small:

> *"`refetch` from `useQuery` will not work with `skipToken`. Calling `refetch()` on a query that uses `skipToken` will result in a `Missing queryFn` error because there is no valid query function to execute."*

So the two forms are **not** interchangeable:

- **`skipToken`** — for a genuinely *dependent* query, where fetching without the id is meaningless and you never want a button that forces it.
- **`enabled: false`** — for a *lazy* query: a filter form that must not fire on mount, an export that runs from a button, a search that fires on submit. Here `refetch()` is the entire point of the option.

Topic 08 works through the chain case in full: [the gate in a dependent chain](../08-dependent-and-parallel-queries/01e-the-gate-in-full-skiptoken-and-placeholder-chains.md).

## 3. `enabled` as a lazy trigger — the pattern that works

```tsx
// A report that must NOT run on mount, only when the user asks for it.
function ExportPanel({ filters }: { filters: Filters }) {
  const report = useQuery({
    queryKey: ['report', filters],
    queryFn: () => buildReport(filters),
    enabled: false,          // never automatic — refetch() is the only trigger
    gcTime: 0,               // a one-shot download: do not keep it after unmount
  });

  return (
    <>
      <button onClick={() => report.refetch()} disabled={report.isFetching}>
        {report.isFetching ? 'Building…' : 'Build report'}
      </button>
      {report.data && <DownloadLink href={report.data.url} />}
    </>
  );
}
```

Two details carry the pattern. The button is gated on `isFetching`, not `isPending` — a disabled query is `pending` forever, so `isPending` would disable the button permanently. And `refetch()` works here precisely because this is `enabled: false` and not `skipToken`.

## 4. The dependent form, and what does *not* follow

```tsx
function CustomerPanel({ ticketId }: { ticketId: string }) {
  const ticket = useQuery({ queryKey: ['ticket', ticketId], queryFn: () => fetchTicket(ticketId) });
  const customerId = ticket.data?.customerId;

  const customer = useQuery({
    queryKey: ['customer', customerId],
    queryFn: customerId ? () => fetchCustomer(customerId) : skipToken,
  });

  // ⚠️ gate the RENDER on the precondition, then on the query's own state
  if (!ticket.data) return <TicketSkeleton />;
  if (!customerId) return <NoCustomerOnTicket />;   // gated: pending forever, and correctly so
  if (customer.isLoading) return <CustomerSkeleton />;
  return <CustomerCard data={customer.data} />;
}
```

There is no parent/child link in the cache — only two entries, one of whose keys is derived from the other's data. Refetching the ticket does not refetch the customer. What propagates is a **key change**: if the ticket comes back with a different `customerId`, the second hook is now observing a different entry and will fetch it; if the id is unchanged the key is byte-identical and nothing happens. If the customer record changed server-side, you invalidate the customer key yourself.

## 5. `enabled` and the rest of the option surface

- **`gcTime` still runs.** The gate stops fetching, not garbage collection. A disabled query with cached data is still an entry with observers; when the last observer unmounts, the normal five-minute clock starts.
- **`staleTime` is still evaluated** — it just has no automatic trigger left to act on. Flip `enabled` back to `true` and the query refetches on that render only if it is stale; a fresh entry stays put with no request.
- **`refetchInterval` does not run.** Polling is background refetching, and *"The query will not automatically refetch in the background."*
- **`initialData` is still written to the cache**, gate or no gate — it is a cache write, not a fetch. That is why `initialData: []` on a gated query is a way to write *"this customer has no invoices"* into the cache under a key you have not fetched. See [`01e`](./01e-initialdata-vs-placeholderdata.md).
- **`enabled` is not available at all under suspense.** *"On the flip side, you therefore can't conditionally enable / disable the Query."* A conditional `useSuspenseQuery` is a conditional hook, and there is no option that changes that — see [suspense](../10-suspense-integration/01b-what-suspense-mode-removes.md).

## Gotchas

**★ `enabled: false` does not mean "no query" — it means a query in `pending` that will never
resolve.** The hook still returns a full result object, `status` is `'pending'`, and `data` is
`undefined` indefinitely. What tells the two apart is `fetchStatus`: a disabled query is `'idle'`, a
genuinely loading one is `'fetching'`. That is why `isLoading` — defined in v5 as *"`isPending &&
isFetching`"* — is the flag to gate a spinner on, and `isPending` is not.

**★ Setting `enabled` from a value that starts `undefined` gives you a spinner with nothing behind
it.** `enabled: !!userId` is correct, but a component that renders a spinner on `isPending` will spin
forever while `userId` is still resolving. Gate the render on the precondition first, and only then
on the query's own state.

**★ Symptom: a mutation invalidates a key and the panel showing it never updates.** Cause: the panel's query was disabled at the moment of the invalidation, and *"The query will ignore query client `invalidateQueries` and `refetchQueries` calls"*. The invalidation is not queued for later; it is discarded. Fix: do not rely on invalidation to refresh a gated query. Either drop the gate once the precondition is met (the key change re-drives the fetch), or call `refetch()` explicitly — and if the query uses `skipToken`, `refetch()` is not available either, so the only correct move is to make the gate open.

**★ Symptom: "it works on my machine" — the panel loads instantly for you and spins forever in QA.** Cause: a gated query with cached data initialises in `success` (*"If the query has cached data, then the query will be initialized in the `status === 'success'`… state"*), and your cache is warm from the previous route. A cold browser hits the second rule instead and sits in `pending`/`idle`. Fix: reproduce with a hard reload of the route in isolation, and branch on `isLoading`/the precondition rather than `isPending`.

**★ Symptom: `refetch()` on a `skipToken` query throws `Missing queryFn`.** Cause: `skipToken` occupies the `queryFn` slot, so there is literally no function to call — *"Calling `refetch()` on a query that uses `skipToken` will result in a `Missing queryFn` error"*. Fix: pick the form by intent. If any code path needs to force the fetch, use `enabled` and accept the `!`; `skipToken` is for queries that must never run without their input.

**★ Symptom: a "Search" button stays disabled forever.** Cause: it was wired to `disabled={query.isPending}` on a lazy `enabled: false` query, which is `pending` by definition and never leaves it until a manual `refetch()` succeeds. Fix: gate interactive controls on `isFetching`; gate skeletons on `isLoading`; reserve `isPending` for "there is no data", which is a statement about the cache, not about activity.

**★ Symptom: the gate opens and nothing fetches.** Cause: flipping `enabled` to `true` does not force a request — it re-admits the query to the normal rules, and the normal rules say a *fresh* entry is served from cache. With a long `staleTime` and a warm key, opening the gate is a cache hit. Fix: that is usually what you want; when it is not, invalidate the key or call `refetch()` rather than lowering `staleTime` globally.

**★ Symptom: a polling query silently stops polling for some users.** Cause: `refetchInterval` was combined with an `enabled` expression that goes false for those users (a missing permission, an unset filter). A disabled query does not refetch in the background, and the interval is background refetching. Fix: if the poll must continue, the gate belongs on the *rendering*, not on the query; if it must not, say so explicitly rather than discovering it from a support ticket.

**★ Symptom: TypeScript complains that `enabled` is `boolean | undefined`.** Cause: `enabled: userId` where `userId` is `string | undefined` — a truthy value is not a boolean. Fix: `enabled: !!userId` or `enabled: userId !== undefined`. The lazier `enabled: Boolean(userId)` is identical; what is *not* identical is `enabled: userId?.length > 0`, which is an error on a possibly-undefined value and tempts people into `?? false` chains that hide the real precondition.

**★ Symptom: an "empty state" is rendered for a query that has never run.** Cause: `if (!data) return <EmptyState/>` reached while the query is gated. `data === undefined` means "nothing here", which for a disabled query is not the same as "the server returned nothing". Fix: three branches, not two — precondition unmet, loading, and genuinely empty. A UI that cannot distinguish them will report "no results" for a search the user never submitted.

## Interview questions

**★ A query has `enabled: false`. What does each flag read, and which one should gate the spinner?**
`status` is `'pending'` and `isPending` is `true`, because there is no data. `fetchStatus` is
`'idle'` and `isFetching` is `false`, because nothing is running. `isLoading`, which v5 defines as
`isPending && isFetching`, is therefore `false` — and that is the flag you want, because it is the
only one that distinguishes "no data and working on it" from "no data and not even trying". Gating a
full-page spinner on `isPending` gives you a spinner that never stops on any disabled query.

**★ Name everything a disabled query stops doing, and the one thing it still does.**
It stops fetching on mount, refetching in the background (which includes focus, reconnect and `refetchInterval`), and responding to `invalidateQueries` and `refetchQueries`. It keeps `refetch()`, the manual trigger — unless the gate was expressed as `skipToken`, in which case `refetch()` throws `Missing queryFn` because there is no function to call. Things outside the fetching machinery are unaffected: `gcTime` still collects the entry once unobserved, `initialData` is still written to the cache, and the entry is still readable by `getQueryData` and still writable by `setQueryData`.

**★ When do you choose `skipToken` over `enabled`, and what do you give up?**
`skipToken` when the query is *dependent* — the id it needs may not exist yet, fetching without it is meaningless, and you want TypeScript to know that inside `queryFn` without an assertion. You give up `refetch()`. `enabled: false` when the query is *lazy* — it exists to be triggered by a user action, and the imperative trigger is the whole feature. The question to ask is not "which is more modern" but "is there any code path that should force this to run?"; if yes, `enabled`.

**★ Why is a disabled query's status sometimes `success` rather than `pending`?**
Because status describes the cache, not the gate. *"If the query has cached data, then the query will be initialized in the `status === 'success'` or `isSuccess` state"* — the entry already holds data from an earlier observer, and gating a new observer does not erase it. The practical consequence is that a component's behaviour depends on whether some *other* part of the app has already populated that key, which is why gated-query bugs are so often intermittent.

**★ A dependent query's parent refetched and returned fresh data. Does the child refetch?**
Only if the key changed. There is no parent/child edge in the cache — the child is an ordinary entry whose key happens to be derived from the parent's data. If the derived id is identical, the key hashes identically and nothing happens. If it differs, the child is now observing a different entry, which it will fetch (or serve from cache if that key is present and fresh). Important Defaults lists the automatic triggers — *"New instances of the query mount, The window is refocused, The network is reconnected"* — and "the query I derived my key from refetched" is not among them.

**★ Your colleague gates a query with `enabled` and then calls `invalidateQueries` after a mutation to refresh it. Why does nothing happen, and what should they do?**
Because a disabled query ignores invalidation outright; it is not deferred, it is dropped. The correct move depends on why the gate exists. If the gate is a *dependency* gate, the mutation should be changing the thing the key is derived from, and the refresh happens through the key change. If the gate is a *laziness* gate, the mutation handler should call `refetch()` on that query, or the gate should be opened as part of the same interaction. And if the query uses `skipToken`, neither invalidation nor `refetch()` is available, which is a strong hint that the mutation is trying to refresh something the user has not asked to see yet.

**★ How would you write a lazy "run this report" query so the button state is correct?**
`enabled: false`, trigger with `refetch()`, and drive the button from `isFetching` rather than `isPending`, because `isPending` is permanently true for a query that has never resolved. Add `gcTime: 0` if the result is a one-shot artefact you do not want served from cache on the next visit, and remember that a second click during an in-flight fetch is deduplicated at the query level, so disabling the button is about the UI, not about protecting the server.

---

← [Core options](./01-core-options.md) · [Topic index](../README.md) · Next → [`staleTime` & the `refetchOn*` family](./01c-staletime-and-the-refetchon-family.md)
