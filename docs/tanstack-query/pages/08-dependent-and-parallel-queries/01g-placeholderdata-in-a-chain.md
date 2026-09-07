---
title: "`placeholderData` in a composition chain: a render-time guess that moves the status"
sidebar_label: "01g · placeholderData in a chain"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data), [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🎭 `placeholderData` in a Composition Chain: a Render-Time Guess That Moves the Status

**[`01f`](./01f-placeholder-and-initial-data-in-a-chain.md) covers `initialData`, which is a cache write. This page covers its twin, which is not.** The defining difference is one clause in the guide — placeholder data behaves *"similar to the `initialData` option, but **the data is not persisted to the cache**"* — and almost every practical consequence, good and bad, follows from it. In a dependent chain that clause is what makes `placeholderData` the right choice and what makes `(prev) => prev` the wrong one.

## 1. Under-The-Hood Mechanics

### `placeholderData` is a render-time value, and it moves the status

> *"Placeholder data allows a query to behave as if it already has data, similar to the `initialData` option, but **the data is not persisted to the cache**."*

> *"our Query will not be in a `pending` state - it will start out as being in `success` state, because we have `data` to display"*

That status change is the whole reason it removes the spinner, and the whole reason it can lie.
The compensating signal is a flag rather than the status — the result carries *"the
`isPlaceholderData` flag set to `true`"* — so any component that uses `placeholderData` and does
not read `isPlaceholderData` has silently promoted a guess to a fact for the duration of the
fetch.

### The function form, and why a chain is where it bites

> *"`placeholderData` can also be a function, where you can get access to the data and Query meta information of a 'previous' successful Query."*

```tsx
const result = useQuery({
  queryKey: ['todos', id],
  queryFn: () => fetch(`/todos/${id}`),
  placeholderData: (previousData, previousQuery) => previousData,
})
```

This is v5's expression of what v4 called `keepPreviousData`, and for pagination it is exactly
right: page 2 renders page 1's rows while it loads, so the table does not collapse. In a
*dependent* chain the same code keeps the **previous entity's** data on screen when the parent's
id changes — the previous customer's invoices, under the new customer's heading, in `success`
state, with no spinner and no error marking the window. Identical mechanism, opposite
desirability, and the only thing that separates them is whether you branch on
`isPlaceholderData`.

## Gotchas

**★ `placeholderData` puts the query in `success`, so every `isPending` branch is skipped.**
*"Our Query will not be in a `pending` state - it will start out as being in `success` state,
because we have `data` to display."* That is the intended effect and it removes your only
built-in signal that the data is provisional. The replacement signal is *"the `isPlaceholderData`
flag set to `true`"*, and a component that never reads it is rendering a guess with the same
confidence as a fetched value.

**★ 🔴 `placeholderData: (prev) => prev` is correct for pagination and wrong for an identity
switch.** The function form gives you *"access to the data and Query meta information of a
'previous' successful Query"* — page 1's rows while page 2 loads, which is what v4's
`keepPreviousData` did. In a dependent chain the "previous query" is the *previous entity*, so
switching customer, account or tenant renders the old one's data under the new one's heading, in
`success` state, with nothing to mark the window. Same option, same code, opposite correctness;
branch on `isPlaceholderData` or scope the option to the queries where a key change means "next
page" rather than "different thing".

**★ A placeholder does not survive a remount the way a cached value does.** Because it is never
persisted, unmounting and remounting the component puts you back at the placeholder, not at real
data — while an `initialData`-seeded entry is in the cache and will be served. If a panel is
supposed to feel instant on the *second* visit, that is a caching question (`staleTime`, `gcTime`,
or seeding real data with `initialData`), not a placeholder question.

**★ 🔴 `placeholderData: (prev) => prev` in a chain shows the previous entity's data as
`success`.** Placeholder data means *"our Query will not be in a `pending` state - it will start
out as being in `success` state, because we have `data` to display."* For pagination that is the
whole point. For an identity switch — a different customer, a different account, a different
tenant — it renders one user's data under another user's heading with no spinner and no error to
mark the window. The result carries *"the `isPlaceholderData` flag set to `true`"*; branch on it
and dim, disable or label the panel while it is set.

## Interview questions

**★ A dependent panel keeps showing the previous customer's data after the ticket is reassigned.
What are the candidate causes?**
Three, and they can all be present at once. The key may not contain the customer id, in which
case both customers share one cache entry and the panel is not wrong so much as unaware. The
panel may use `placeholderData: (prev) => prev`, which by design keeps the previous key's data on
screen — and since placeholder data means the query *"will start out as being in `success`
state"*, there is no spinner marking the window; the fix is to branch on `isPlaceholderData` and
render it as provisional. Or the correction may be waiting on an invalidation that was fired
while the query was still gated, and therefore ignored — see

**★ Does `placeholderData` stop the query from fetching?**
No, and that is the cleanest way to remember the difference. Placeholder data is not in the cache,
so there is nothing for `staleTime` to consider fresh; the query fetches exactly as it would have,
and the placeholder is simply what `data` resolves to until it lands. `initialData` *can* suppress
the fetch, because it is a cache entry and it is *"treated as totally fresh"* — with any non-zero
`staleTime` the mount refetch is skipped. So `placeholderData` changes what the user sees and
nothing else; `initialData` changes what the library believes.

**★ In a paginated list you keep the previous page's rows while the next page loads. What is the
v5 way to write that, and what did it replace?**
`placeholderData` as a function: *"`placeholderData` can also be a function, where you can get
access to the data and Query meta information of a 'previous' successful Query"* — in practice
`placeholderData: (previousData) => previousData`. It replaces the v4 `keepPreviousData` option,
which no longer exists as a top-level flag. The behaviour is the same and so is the caveat that
matters at review time: the query is in `success` state with the *old* page's rows, so pagination
controls driven off `isPending` will look enabled and correct while showing the previous page.

---

← [`initialData` in a chain](./01f-placeholder-and-initial-data-in-a-chain.md) · [Topic index](../README.md) · Next → [Prefetching & SSR](../09-prefetching-and-ssr/01-server-rendered-data-flow.md)
