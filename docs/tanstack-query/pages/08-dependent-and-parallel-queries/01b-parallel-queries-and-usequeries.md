---
title: "Parallel is the default and costs no ceremony; `useQueries` exists for exactly one reason — the Rules of Hooks forbid a variable number of `useQuery` calls"
sidebar_label: "Parallel Queries & `useQueries`"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries), [`useQueries` reference (v5 path)](https://tanstack.com/query/v5/docs/framework/react/reference/useQueries), [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔀 Parallel Queries & `useQueries()`: Dynamic Fan-Out and the Rules of Hooks

## 1. Under-The-Hood Mechanics

Parallelism in TanStack Query is not a feature you switch on — it is what happens when you do
nothing. Two `useQuery` calls side by side both start immediately, because neither waits for the
other's result. `useQueries` is therefore **not** "the parallel hook"; it is the hook you reach
for when the *number* of queries changes from render to render, which is the one case plain
`useQuery` cannot express without breaking React.

### Manual parallel queries need no ceremony at all

> *"When the number of parallel queries does not change, there is **no extra effort** to use parallel queries."*

> *"Just use any number of TanStack Query's `useQuery` and `useInfiniteQuery` hooks side-by-side!"*

That is the whole API. Three hooks in one component fire three requests concurrently, and the
component's wall-clock wait is the slowest of the three rather than their sum. Adding `enabled`
to one of them because it "feels tidier" converts that max back into a sum — the pitfall in
[01](01-query-composition.md) — so the deliberate act here is *not* gating, never gating.

### `useQueries()`: When the Number of Parallel Queries Isn't Fixed
`useQuery` (and calling it multiple times) works when the exact number of parallel queries is known at the component's design time — `useQueries()` handles the case where the **count itself** is dynamic (a query per item in an array whose length varies), something the Rules of Hooks make impossible to express by calling `useQuery` in a loop directly.

The guide gives the constraint as the *reason the hook exists*, not as a style note:

> *"If the number of queries you need to execute is changing from render to render, you cannot use manual querying since that would violate the rules of hooks."*

React identifies hook state by call order, so a component that calls `useQuery` three times on
one render and five on the next has no stable mapping between the two renders. `useQueries` is
**one** hook call whose argument happens to be an array, so the call order never changes no
matter how long the array gets.

### The exact shape, and what you get back

> *"`useQueries` accepts an **options object** with a **queries key** whose value is an **array of query objects**. It returns an **array of query results**."*

The reference adds the two exceptions that catch people copying options across from `useQuery`:

> *"An array with query option objects, mostly identical to `useQuery` — except that `queryClient` and `subscribed` aren't accepted per-query (`subscribed` is a top-level option here instead), and `placeholderData` accepts a QueriesPlaceholderDataFunction."*

and is explicit about ordering, which is the only thing tying a result back to its input:

> *"Without `combine`, this is an array with all the query results, in the same order as the input. When `combine` is provided, this is the value returned by `combine` instead."*

Each entry is an ordinary query result — same `status`, `fetchStatus`, `data`, `error`, and the
same cache entry it would have had from a `useQuery` with that key. `useQueries` adds no
batching, no shared lifecycle and no error aggregation; it is a subscription manager, not a
request planner. Turning the array into one value your component can consume is a separate
option, `combine`, covered in [01c](01c-combining-usequeries-results.md).

### Suspense silently un-parallelises all of this

> *"When using React Query in suspense mode, this pattern of parallelism does not work, since the first query would throw a promise internally and would suspend the component before the other queries run."*

The failure is invisible in code review: three `useSuspenseQuery` calls look exactly like three
parallel requests and behave as a three-step waterfall, because the component never reaches the
second call. The guide names the fix:

> *"use the `useSuspenseQueries` hook (which is suggested) or orchestrate your own parallelism with separate components."*

### A dynamic list that is itself dependent

The two halves of this topic compose. Dependent Queries shows a `useQueries` whose *array* is
derived from a previous query — *"Dynamic parallel query - `useQueries` can depend on a previous
query also"* — and the load-bearing detail is the `: []` fallback, because there is no `enabled`
at the array level:

```tsx
// Get the users ids
const { data: userIds } = useQuery({
  queryKey: ['users'],
  queryFn: getUsersData,
  select: (users) => users.map((user) => user.id),
})

// Then get the users messages
const usersMessages = useQueries({
  queries: userIds
    ? userIds.map((id) => {
        return {
          queryKey: ['messages', id],
          queryFn: () => getMessagesByUsers(id),
        }
      })
    : [],
})
```

An empty array is not a disabled query — it is *no queries at all*, which is a different state
and reads as "finished" to every aggregate you build over it. That trap is the first gotcha in
[01c](01c-combining-usequeries-results.md).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Product Comparison Page Needing One Query Per Selected Product, Where the Selection Count Varies.
A product comparison feature let users select anywhere from 2 to 5 products to compare side-by-side — the number of individual product-detail queries needed depended entirely on how many products the user had currently selected, a genuinely dynamic count that couldn't be expressed with a fixed number of individual `useQuery` calls (which would violate the Rules of Hooks if called conditionally/in a loop). `useQueries()`, given an array of query configs derived from the current selection, correctly fired exactly the right number of parallel queries for whatever the current selection happened to be, recalculating cleanly whenever the user added or removed a product from the comparison.

---

## 3. Production-Grade Code Example

```typescript
// Parallel queries — independent, both fire immediately, no waterfall
function useProfilePage(userId: string) {
  const userQuery = useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
  const activityQuery = useQuery({ queryKey: ['activity', userId], queryFn: () => fetchActivity(userId) });
  // NEITHER depends on the other — both fire CONCURRENTLY, total wait ≈ max(both), not the sum
  return { user: userQuery.data, activity: activityQuery.data };
}
```

```tsx
// useQueries() — a dynamic, variable-length array of parallel queries
function ProductComparison({ productIds }: { productIds: string[] }) {
  const results = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['product', id],
      queryFn: () => fetchProduct(id),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const products = results.map((r) => r.data).filter(Boolean);

  if (isLoading) return <Spinner />;
  return <ComparisonTable products={products} />; // handles 2, 3, 4, or 5 selected products identically
}
```

The second example is the shape everyone writes first. It is correct about the hard part — the
dynamic count — and wrong about two things in how it reads the result array; both are fixed in
[01c](01c-combining-usequeries-results.md), which is where the aggregation belongs.

The alternative that is sometimes better than `useQueries` altogether is one child component per
item, each calling `useQuery` exactly once. The hook count per component is then constant, so the
Rules of Hooks are satisfied without a special hook, and each row gets its own loading and error
boundary instead of an aggregate:

```tsx
function ProductComparison({ productIds }: { productIds: string[] }) {
  // one component per id — each calls useQuery ONCE, so the hook count never varies
  return <ComparisonTable>{productIds.map((id) => <ProductColumn key={id} id={id} />)}</ComparisonTable>;
}

function ProductColumn({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id) });
  if (isLoading) return <ColumnSkeleton />;
  if (isError) return <ColumnError id={id} />;   // this column fails, the others still render
  return <ColumnBody product={data} />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Calling `useQuery` in a Loop Instead of `useQueries()`
```tsx
// ❌ VIOLATES THE RULES OF HOOKS: calling useQuery inside a loop/conditionally is NOT
// allowed — the number of hook calls must be IDENTICAL across every render
function ProductComparison({ productIds }) {
  return productIds.map((id) => {
    const { data } = useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id) }); // ❌ illegal
  });
}

// ✅ CORRECT: useQueries() is SPECIFICALLY designed for this dynamic-count scenario
const results = useQueries({ queries: productIds.map((id) => ({ queryKey: ['product', id], queryFn: () => fetchProduct(id) })) });
```

### ⚠️ Pitfall 2: Three Suspense Queries Side by Side
```tsx
// ❌ reads as parallel, behaves as a three-step waterfall — the component suspends on the first
const user = useSuspenseQuery({ queryKey: ['user'], queryFn: fetchUser });
const teams = useSuspenseQuery({ queryKey: ['teams'], queryFn: fetchTeams });

// ✅ one hook, one suspension point, all of them in flight together
const [user, teams] = useSuspenseQueries({
  queries: [
    { queryKey: ['user'], queryFn: fetchUser },
    { queryKey: ['teams'], queryFn: fetchTeams },
  ],
});
```

## Gotchas

**★ Index is the only join key between input and output.** *"Without `combine`, this is an array
with all the query results, in the same order as the input."* There is no id on a result, so
`results[i]` corresponds to `queries[i]` and nothing else. Two consequences: never sort or filter
the results array before you have paired it with its input, and remember that reordering the
*input* reorders the output — a drag-to-reorder comparison list that re-sorts `productIds` while
one product is still fetching moves the pending slot with it, which is correct but surprising if
you cached indices anywhere.

**★ `queryClient` and `subscribed` are rejected per-query.** *"Mostly identical to `useQuery` —
except that `queryClient` and `subscribed` aren't accepted per-query (`subscribed` is a top-level
option here instead)."* Copying a `queryOptions` object that carries an explicit `queryClient`
into a `useQueries` array is the usual way to hit this, and it matters in tests and in
multi-client setups where the explicit client was the point.

**★ An inline `select` inside `useQueries` is not contextually typed.** The reference flags it:
unlike `useQuery`, an inline `select` cannot be contextually typed from its paired `queryFn`, and
the resolution it names is to use `queryOptions`. The symptom is a parameter that silently widens
and a returned `data` that is not what you annotated, in a hook where the type error you wanted
was the whole point of writing the annotation.

**★ Two identical keys in one array are one query with two observers, not two requests.** The key
*is* the cache entry — *"Query Keys are hashed deterministically!"* — so a `productIds` array
containing a duplicate produces two result slots backed by the same query, one fetch, and two
entries that update in lockstep. That is usually the behaviour you want, but it means the length
of `results` is not the number of network requests, and de-duplicating the input is still worth
doing so the rendered list matches what the user picked.

**★ Options are per entry, not per call.** `staleTime`, `retry`, `gcTime` and the rest live on
each object inside the array, so "make all of these fresh for a minute" means setting it on every
generated entry — which is easy to forget in a `.map()` that was written before the option
existed. Generating the entries from a shared `queryOptions` factory, or registering the defaults
on the client with `setQueryDefaults` for that key prefix, keeps the policy in one place instead
of in a callback.

## Interview questions

**★ Why can't you just call `useQuery` inside a `.map()`?**
Because React identifies hook state by call order within a component, so the number and sequence
of hook calls has to be identical on every render. A list whose length changes changes that
sequence, and React has no way to map the third `useQuery` of the previous render onto the third
of this one. The docs state the constraint as the reason `useQueries` exists: *"If the number of
queries you need to execute is changing from render to render, you cannot use manual querying
since that would violate the rules of hooks."* `useQueries` sidesteps it by being a single hook
call whose argument is an array — the call order is constant however long the array becomes.

**★ What does `useQueries` return, and how do you know which result belongs to which input?**
Without `combine`, *"an array with all the query results, in the same order as the input"* — so
position, and only position. Each entry is a normal query result with its own `status`,
`fetchStatus`, `data` and `error`, backed by its own cache entry under its own key. With
`combine`, you get whatever that function returns instead of the array, which is how you hand the
component one derived value rather than an array whose identity changes whenever any member
does. The practical rule that falls out: pair results with their inputs by index before you sort,
filter or drop anything, because after that the correspondence is gone.

**★ Three `useSuspenseQuery` calls in one component. How many requests are in flight at once?**
One. The first call throws a promise internally, which suspends the component before execution
reaches the second call, so the three requests serialise into a waterfall that looks like
parallelism in the source. The guide is explicit: *"this pattern of parallelism does not work,
since the first query would throw a promise internally and would suspend the component before the
other queries run."* The fixes it names are `useSuspenseQueries`, which is one hook and therefore
one suspension point for all of them, or splitting the queries into separate sibling components
so each suspends independently.

**★ When would you *not* use `useQueries`, even though the count is dynamic?**
When each item deserves its own loading and error boundary. One child component per item, each
calling `useQuery` exactly once, satisfies the Rules of Hooks just as well — the hook count per
component is constant — and gives you per-row skeletons, per-row retry buttons and a failure that
degrades one column instead of forcing an aggregate decision for the whole list. `useQueries`
wins when the component genuinely needs the *set* before it can render anything: a chart that
plots all series together, a total that sums every response, a comparison table whose columns
must line up.

**★ Two components on the same screen both call `useQuery` with the key `['user', 7]`. How many
requests?**
One. The key is the identity of the cache entry, and it is *"hashed deterministically"*, so both
components become observers of the same query and share its data, its status and its refetches.
The same holds inside a single `useQueries` array: a duplicated id gives you two result slots
backed by one query. This is why key design is a first-class concern rather than a naming
convention — two components that accidentally use *different* keys for the same resource get two
requests, two cache entries and two independently stale copies of the same row.

**★ Your `useQueries` list is derived from a previous query. What is it doing while that parent
is still fetching?**
Nothing, and reporting nothing. There is no `enabled` for the array as a whole, so the documented
pattern is a ternary that yields `[]` until the parent's data arrives — which means the hook is
observing zero queries, not "one disabled query per row". That is a genuinely different state
from a gated `useQuery`, which sits in `pending` with `fetchStatus: 'idle'`, and it is why the
loading branch has to test the parent (or the input length) rather than an aggregate over the
empty results array.

---

← [Dependent & Parallel Queries](./01-query-composition.md) · [Topic index](../README.md) · Next → [Combining `useQueries` results](./01c-combining-usequeries-results.md)
