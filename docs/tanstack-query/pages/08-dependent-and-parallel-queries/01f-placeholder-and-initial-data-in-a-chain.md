---
title: "`initialData` in a composition chain: a cache write that claims to be fresh"
sidebar_label: "01f · initialData in a chain"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data), [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🎭 `initialData` in a Composition Chain: a Cache Write That Claims to Be Fresh

## 1. Under-The-Hood Mechanics

Both options exist to remove a spinner, and a chain is where you most want to remove one — the
child of a dependent query has a guaranteed empty period while its parent resolves. They are not
alternatives with different ergonomics. **One is a value for this render; the other is a write
into the shared cache.** Choosing the second when you meant the first turns a cosmetic decision
into a data-correctness bug that outlives the component.

### `initialData` is persisted, and the guide says not to guess with it

> *"Provide `initialData` to a query to prepopulate its cache if empty"*

> *"`initialData` is persisted to the cache, so it is not recommended to provide placeholder, partial or incomplete data to this option and instead use `placeholderData`"*

That is about as direct as documentation gets. Everything that reads the cache — another
component observing the same key, a `getQueryData` call, a devtools panel, a later
`invalidateQueries` decision — sees your `initialData` as data that was fetched. In a chain, the
tempting `initialData: []` ("show an empty table rather than a spinner") therefore writes *this
customer has no invoices* into the cache under that customer's key.

### `initialData` is treated as fresh, which is the second half of the trap

> *"`initialData` is treated as totally fresh, as if it were just fetched."*

So `staleTime` is measured from the moment you supplied it, not from when the data was really
produced. With the default `staleTime: 0` that is harmless — the query refetches on mount
anyway. With any non-zero `staleTime` you have told the library your guess is fresh for that
long, and it will not go and check. The option that fixes it is `initialDataUpdatedAt`, which
takes a millisecond timestamp:

> *"This option allows the staleTime to be used for its original purpose, determining how fresh the data needs to be, while also allowing the data to be refetched on mount if the `initialData` is older than the `staleTime`."*

### Seeding one query from another's cache — the legitimate use

`initialData` earns its place when the data is real and you already hold it, which in a chain
usually means a list response that contains the row a detail query is about to fetch:

```tsx
const result = useQuery({
  queryKey: ['todo', todoId],
  queryFn: () => fetch('/todos'),
  initialData: () => {
    return queryClient.getQueryData(['todos'])?.find((d) => d.id === todoId)
  },
})
```

Pair it with `initialDataUpdatedAt` read from `queryClient.getQueryState(['todos'])?.dataUpdatedAt`
so the seeded entry inherits the *list's* age rather than claiming to be brand new. Note the
`?.` on `getQueryData` — the list may not be in the cache at all, and the reference is explicit
that entries are collected when unused: *"If the query is not utilized by a query hook within the
default `gcTime`, the query will be garbage collected."*

## 2. Real-World Engineering Scenario

**Scenario**: An Empty-State That Became a Cached Fact.
A dependent "recent activity" panel showed a spinner for the second or so its parent took to resolve, and a reviewer suggested `initialData: []` to render the empty state immediately instead. It worked, and the page felt faster. Two weeks later a support ticket described a user whose activity feed was permanently empty on one device. The panel had a `staleTime` of five minutes, `initialData` is *"treated as totally fresh, as if it were just fetched"*, and the empty array had been persisted to the cache under that user's key — so for five minutes the library had a fresh, authoritative "no activity" and no reason to fetch. Every other component observing that key read the same thing. The fix was a one-word change to `placeholderData`, which renders the same empty state and writes nothing.

---

## 3. Production-Grade Code Example

```tsx
// ✅ placeholderData for a GUESS: renders instantly, writes nothing, and marks itself
function ActivityPanel({ userId }: { userId?: string }) {
  const activity = useQuery({
    queryKey: ['activity', userId],
    queryFn: userId ? () => fetchActivity(userId) : skipToken,
    placeholderData: (previous) => previous,   // keep the last user's rows while the new ones load
    staleTime: 5 * 60_000,
  });

  if (activity.isPending) return <NothingSelected />;          // gated: no data, nothing running
  return (
    <ActivityList
      rows={activity.data}
      // the ONLY thing distinguishing "these are the right rows" from "these are the last rows"
      provisional={activity.isPlaceholderData}
    />
  );
}
```

```tsx
// ✅ initialData for data you ACTUALLY HAVE: seeded from the list, aged from the list
function TodoDetail({ todoId }: { todoId: string }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => fetchTodo(todoId),
    initialData: () => queryClient.getQueryData<Todo[]>(['todos'])?.find((t) => t.id === todoId),
    // without this, the seeded row claims to be brand new and staleTime starts from now
    initialDataUpdatedAt: () => queryClient.getQueryState(['todos'])?.dataUpdatedAt,
    staleTime: 30_000,
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `initialData` Used as a Placeholder
```tsx
// ❌ writes "this customer has no invoices" into the cache, treated as freshly fetched
useQuery({ queryKey: ['invoices', customerId], queryFn: fetchInvoices, initialData: [], staleTime: 60_000 });

// ✅ same rendered result, nothing persisted, and the query still fetches
useQuery({ queryKey: ['invoices', customerId], queryFn: fetchInvoices, placeholderData: [], staleTime: 60_000 });
```

### ⚠️ Pitfall 2: Seeded Data That Claims to Be New
```tsx
// ❌ the row came from a list fetched twenty minutes ago, but staleTime restarts now
initialData: () => queryClient.getQueryData<Todo[]>(['todos'])?.find((t) => t.id === todoId),

// ✅ inherit the source query's age so staleTime measures the right interval
initialData: () => queryClient.getQueryData<Todo[]>(['todos'])?.find((t) => t.id === todoId),
initialDataUpdatedAt: () => queryClient.getQueryState(['todos'])?.dataUpdatedAt,
```

## Gotchas

**★ 🔴 `initialData` is a cache write; `placeholderData` is not.** The guide states both halves in
one sentence — placeholder data behaves *"similar to the `initialData` option, but **the data is
not persisted to the cache**"* — and then says outright that *"`initialData` is persisted to the
cache, so it is not recommended to provide placeholder, partial or incomplete data to this option
and instead use `placeholderData`."* Anything you are *guessing* belongs in `placeholderData`. The
failure mode of getting it backwards is not visual: your guess becomes the answer that every
other observer of that key reads, and it survives the component that produced it.

**★ 🔴 `initialData` is *"treated as totally fresh, as if it were just fetched"*, so `staleTime`
starts now.** With the default `staleTime: 0` nothing goes wrong, which is why this survives
review. Add a non-zero `staleTime` — the entire reason people configure caching — and you have
declared your seed authoritative for that window, so the query does not fetch and the UI shows
the seed. `initialDataUpdatedAt` exists precisely to fix this: it *"allows the staleTime to be
used for its original purpose … while also allowing the data to be refetched on mount if the
`initialData` is older than the `staleTime`."*
**★ Seeding from another query's cache can silently find nothing.** `queryClient.getQueryData(['todos'])`
returns `undefined` when the list was never fetched or has been collected — *"If the query is not
utilized by a query hook within the default `gcTime`, the query will be garbage collected"*, and
that default is five minutes. So the deep-link path, the reload path and the "left the tab open
over lunch" path all get no seed and a normal fetch. That is the correct outcome; the bug is
writing `getQueryData(['todos']).find(...)` without the `?.` and throwing during render instead.

**★ `initialData` as a static value is shared by every key that uses it.** `initialData: []`
written inline is one array literal per render, but the *decision* applies to whatever key the
query currently has — so a dependent query whose key changes seeds each new entry with the same
guess. The function form (`initialData: () => …`) is what lets the seed depend on the current key,
and it is also what defers the work until it is actually needed.

**★ Neither option makes the query skip its fetch.** Both remove the visible pending state, and
neither cancels the request — except through the freshness route: `initialData` counts as freshly
fetched, so a non-zero `staleTime` genuinely suppresses the mount refetch, while
`placeholderData` never does, because there is nothing in the cache to be fresh. That asymmetry is
the practical reason to reach for `placeholderData` by default: it changes what the user sees and
nothing else.
**★ `placeholderData` is not written to the cache; `initialData` is.** The guide draws the
distinction as the defining difference: placeholder data behaves *"similar to the `initialData`
option, but **the data is not persisted to the cache**"*. So seeding a dependent query with
`initialData: []` to avoid a spinner does not just affect this render — it creates a real cache
entry saying this customer has no invoices, which other observers of that key will read as
fact. Use `placeholderData` for anything you are guessing, and `initialData` only for data you
actually have. (I did not re-verify `initialData`'s interaction with `staleTime` in this pass;
the Initial Query Data guide is the source for that.)

## Interview questions

**★ `placeholderData` or `initialData` — how do you choose?**
By one question: is this data, or a guess? *"`initialData` is persisted to the cache, so it is not
recommended to provide placeholder, partial or incomplete data to this option and instead use
`placeholderData`."* If you genuinely have the value — the row is already in a list you fetched
thirty seconds ago — `initialData` is right, because putting it in the cache is the point: other
observers of that key benefit too. If you are supplying an empty array, a skeleton row or the
previous entity's data to avoid a spinner, it is `placeholderData`, because it stays local to the
render, marks itself through `isPlaceholderData`, and disappears when the real value arrives.

**★ Why is `initialData` with a non-zero `staleTime` a bug waiting to happen?**
Because *"`initialData` is treated as totally fresh, as if it were just fetched"*, so the
staleness clock starts at the moment you supplied it rather than when the data was really
produced. With `staleTime: 0` the query refetches on mount and nobody notices. Set
`staleTime: 60_000` — an entirely ordinary thing to do — and you have promised the library your
seed is good for a minute, so it will not fetch, and the user looks at the seed. If the seed was
an empty array chosen to avoid a spinner, the user looks at an empty page. The fix is
`initialDataUpdatedAt`, which lets you hand over the *real* timestamp so `staleTime` measures the
interval it was meant to measure.

**★ You seed a detail query from a cached list. What are the two things that go wrong?**
The list may not be there, and the seed may claim the wrong age. `queryClient.getQueryData` returns
`undefined` when the list was never fetched or was garbage collected — the default `gcTime` is
five minutes for an unused query — so the deep link, the hard reload and the long-idle tab all
take the unseeded path, and an unguarded `.find(...)` on the result throws during render. The
second is `initialDataUpdatedAt`: without it the seeded row is treated as fetched *now*, so a
twenty-minute-old list can suppress a refetch that any `staleTime` would otherwise have
triggered. Read the source query's `dataUpdatedAt` from `getQueryState` and pass it through.
[01e](01e-the-gate-in-full-skiptoken-and-placeholder-chains.md). The diagnosis order is: check the
key first, then the status flags, then whether anything was gated when the invalidation ran.
Read `isPlaceholderData` to disable the "next" button, dim the table, or show a thin progress bar
— whichever tells the user that what they are reading is one step behind.

**★ `placeholderData` versus `initialData` — which one do you use to smooth a dependent chain?**
`placeholderData`, essentially always. The defining difference is stated as the contrast in the
guide: placeholder data behaves *"similar to the `initialData` option, but the data is not
persisted to the cache"*. Since what you are supplying in a chain is a guess — the previous
entity's data, an empty list, a skeleton row — writing it into the cache under the new key means
every other observer of that key reads your guess as a fetched fact, and it survives until
something overwrites it. `placeholderData` stays local to the render, marks itself through
`isPlaceholderData`, and disappears when the real data lands. `initialData` is for data you
genuinely already have, typically seeded from a list response you just received.

---

← [The gate in full](./01e-the-gate-in-full-skiptoken-and-placeholder-chains.md) · [Topic index](../README.md) · Next → [`placeholderData` in a chain](./01g-placeholderdata-in-a-chain.md)
