---
title: "Reading a `useQueries` result array is where fan-out actually goes wrong — `combine` memoises nothing when it is inline, and every aggregate over an empty array says 'done'"
sidebar_label: "Combining `useQueries` Results"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [`useQueries` reference (v5 path)](https://tanstack.com/query/v5/docs/framework/react/reference/useQueries), [Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries), [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries), [Disabling / Pausing Queries (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/disabling-queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🧮 Reading a `useQueries` Result Array: `combine`, Aggregation and the Fan-Out Cost

## 1. Under-The-Hood Mechanics

Getting `useQueries` to *fire* the right number of requests is the easy half, and
[01b](01b-parallel-queries-and-usequeries.md) covers it. The half that produces production
defects is what you do with the array it hands back: an aggregate over an empty array reports
success, an aggregate that discards failures renders a table with a column missing, and the
`combine` option that exists to make aggregation cheap does nothing at all when it is written
where everyone writes it.

### `combine`: one value out of many results

> *"Use this to combine the results of the queries into a single value. The result will be structurally shared to be as referentially stable as possible."*

The point is that your component then depends on **one** derived value instead of on an array
whose identity changes whenever any member changes. The docs' own example shows both the shape
and the aggregation vocabulary:

```tsx
combine: (postQueries) => {
  return {
    data: postQueries.map((query) => query.data),
    isPending: postQueries.some((query) => query.isPending),
    isError: postQueries.some((query) => query.isError),
  }
}
```

Note which flag it aggregates: `isPending`, not `isLoading`. For a plain always-enabled fan-out
the two mostly coincide, because `isLoading` is *"computed from: `isPending && isFetching`"*.
They diverge the moment any entry is gated or paused — then `isPending` is still `true` (no
data) while `isLoading` is `false` (nothing running), and a spinner keyed off `isLoading` shows
a "loaded" page with holes in it. Aggregate `isPending` when you want "is anything still
missing", `isLoading` when you want "is anything actually in flight".

### 🔴 Why an inline `combine` is a no-op optimisation

The re-run rule is stated exactly:

> *"The `combine` function only re-runs if it changed referentially, or if any of the query results changed."*

and is immediately followed by the trap:

> *"An inlined `combine` function, as shown in the example below, therefore runs on every render — wrap it in `useCallback`, or extract it to a stable function reference if it doesn't have any dependencies, to avoid that."*

An arrow function written inside the hook call is a **new function object on every render**, so
it satisfies "changed referentially" unconditionally, so the second clause never gets a chance to
skip anything. The derivation you moved into `combine` specifically to avoid recomputing now runs
on every keystroke elsewhere in the component. The docs' example is inline because it is showing
the shape, not the production form.

### What `combine` does not buy you

It does not batch requests, does not aggregate errors on your behalf, and does not change any
query's lifecycle — each entry is still an independent query with its own key, cache entry,
staleness and retries. `combine` is a *projection* of the results, run after the fact. The one
thing it does add beyond convenience is stability of the returned value, and that is worth being
precise about: the returned object may be a fresh literal each run without breaking downstream
memoisation, because the library structurally shares it — the same mechanism Important Defaults
describes for query data, *"Query results by default are structurally shared to detect if data
has actually changed and if not, the data reference remains unchanged."*

### The empty array reads as "done", and that is arithmetic, not a bug

`useQueries({ queries: [] })` observes nothing. `[].some(...)` is `false` and `[].every(...)` is
`true`, so every aggregate you can write reports a finished, successful, empty load. There are
two routine ways to arrive there: a genuinely empty selection, and — far more often — the
dependent form from [01b](01b-parallel-queries-and-usequeries.md), whose `: []` fallback stands
in for an `enabled` that does not exist at the array level. A gated `useQuery` at least sits in
`pending`; an empty `useQueries` does not sit anywhere. Test the input length before you test any
aggregate.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Comparison Table That Rendered Four Columns When the User Asked for Five.
The comparison page aggregated its `useQueries` results with `results.map((r) => r.data).filter(Boolean)`, which reads as ordinary defensive code and is what most reviewers would wave through. One product's detail endpoint began returning 404 for archived SKUs. Every failed product silently disappeared from the array before render: no error boundary, no toast, no console warning, and a table that looked complete because the remaining columns simply closed up. The support tickets described it as "the site keeps forgetting which products I picked", and the fix was not error handling in the query — it was counting `results.filter((r) => r.isError).length` and rendering a partial-load banner, so the page told the truth about what it had.

---

## 3. Production-Grade Code Example

```tsx
// Hoisted OUT of the component: a stable reference, so `combine` re-runs only when a result changes
function combineProducts(results: UseQueryResult<Product>[]) {
  return {
    products: results.map((r) => r.data),          // index-aligned with the INPUT array
    isPending: results.some((r) => r.isPending),   // matches the docs' own aggregation
    failedCount: results.filter((r) => r.isError).length,
    refetchAll: () => results.forEach((r) => r.refetch()),
  };
}

function ProductComparison({ productIds }: { productIds: string[] }) {
  const { products, isPending, failedCount } = useQueries({
    queries: productIds.map((id) => ({ queryKey: ['product', id], queryFn: () => fetchProduct(id) })),
    combine: combineProducts,
  });

  if (productIds.length === 0) return <PickProductsPrompt />;  // [].some() is false — handle it FIRST
  if (isPending) return <Spinner />;
  return (
    <>
      {failedCount > 0 && <PartialLoadWarning count={failedCount} />}
      <ComparisonTable products={products} ids={productIds} />
    </>
  );
}
```

```tsx
// When the combine function DOES close over something, useCallback with real dependencies
function SeriesChart({ metricIds, unit }: { metricIds: string[]; unit: 'ms' | 's' }) {
  const combine = useCallback(
    (results: UseQueryResult<Series>[]) => ({
      series: results.map((r) => (r.data ? convert(r.data, unit) : undefined)),
      isPending: results.some((r) => r.isPending),
    }),
    [unit], // `unit` is the only captured value — omit it and the chart keeps the old units
  );

  const { series, isPending } = useQueries({
    queries: metricIds.map((id) => ({ queryKey: ['metric', id], queryFn: () => fetchMetric(id) })),
    combine,
  });

  return isPending ? <ChartSkeleton /> : <Chart series={series} />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: An Inline `combine` That Cancels Its Own Memoisation
```tsx
// ❌ a NEW function object every render, so combine "changed referentially" every render
const data = useQueries({ queries, combine: (r) => r.map((q) => q.data) });

// ✅ stable identity — hoisted out of the component, or memoised with its real dependencies
const select = useCallback((r: UseQueryResult<Product>[]) => r.map((q) => q.data), []);
const data = useQueries({ queries, combine: select });
```

### ⚠️ Pitfall 2: Aggregating Over an Array You Have Not Checked the Length Of
```tsx
// ❌ productIds is [] while the parent query is still fetching: isPending is false,
// so this renders a comparison table with zero columns and calls it success
const isPending = results.some((r) => r.isPending);
if (isPending) return <Spinner />;
return <ComparisonTable products={results.map((r) => r.data)} />;

// ✅ the "no queries at all" state is its own branch, tested BEFORE any aggregate
if (parentQuery.isPending) return <Spinner />;
if (productIds.length === 0) return <PickProductsPrompt />;
if (results.some((r) => r.isPending)) return <Spinner />;
```

## Gotchas

**★ 🔴 An inline `combine` runs on every render, and the docs say so explicitly.** *"The `combine`
function only re-runs if it changed referentially, or if any of the query results changed"* — and
*"An inlined `combine` function, as shown in the example below, therefore runs on every render."*
An arrow function declared inside the hook call is a new object each time, which satisfies
"changed referentially" unconditionally, so the second clause never gets a chance to skip the
work. Hoist it, or wrap it in `useCallback` with a real dependency array. Cheap for a `map` over
five products; expensive for a sort-and-group over three hundred rows — which is exactly the case
where someone reached for `combine` in the first place.

**★ `combine` returning a fresh object each run does not defeat referential stability.** People
avoid `combine` on the theory that returning an object literal breaks memoisation downstream. It
does not: *"The result will be structurally shared to be as referentially stable as possible."*
The library compares the produced value against the previous one and keeps the old reference
where nothing changed — the same structural-sharing machinery Important Defaults describes for
query data. The instability you have to fix comes from an unstable `combine` **function**, never
from an object-shaped return.

**★ 🔴 `[].some(...)` is `false`, so an empty `queries` array reads as "finished loading".**
`useQueries({ queries: [] })` returns `[]`, every aggregate built with `.some()` is `false`, every
aggregate built with `.every()` is `true`, and the component sails past its loading branch into a
render of nothing. This is not hypothetical: it is exactly the state of the dependent
`useQueries` pattern while its parent is still fetching, because the `: []` fallback is the only
thing standing in for `enabled`. Check the input length **before** the aggregate:

```tsx
if (productIds.length === 0) return <PickProductsPrompt />;
if (isPending) return <Spinner />;
```

**★ `.filter(Boolean)` over the results turns a failure into a missing row.** `results.map((r) =>
r.data).filter(Boolean)` compiles, reads as defensive, and quietly deletes every item that
errored from a list the user selected by name — no error boundary, no toast, and a table with
four columns where five were requested. Count the errors deliberately and say something:

```tsx
const failedCount = results.filter((r) => r.isError).length;
const products = results.map((r) => r.data);   // keep the holes; they are index-aligned
```

**★ Aggregating `isLoading` where you meant `isPending` renders a "loaded" page with holes.**
`isLoading` is *"computed from: `isPending && isFetching`"*, so it is `false` for any entry that
has no data and nothing running — a gated entry, a paused one, an empty array. `isPending` is
`true` for all of those, because it asks about data rather than about the request. The docs' own
`combine` example aggregates `isPending` for this reason. Use `isLoading` only when the question
really is "is a request in flight right now", such as deciding whether to show a subtle refresh
indicator over content you are already displaying.

**★ The identity of the raw results array is not something the docs promise.** The reference
guarantees stability for the *combined* value — *"The result will be structurally shared to be as
referentially stable as possible"* — and says nothing equivalent about the plain array returned
when `combine` is absent. I could not find a statement about the raw array's referential
stability, so do not build a `useMemo` dependency or a `React.memo` boundary on the assumption
that it is stable across renders; derive what the child needs, or use `combine`.

**★ `combine` does not aggregate errors for you, and there is no "one of them failed" state.**
Each entry keeps its own `error`; the hook has no combined error and throws nothing. A fan-out
therefore has *degrees* of failure — none, some, all — and the component has to decide which of
those is renderable. Deciding it implicitly, by mapping over `data` and letting `undefined` fall
through, is how a partial failure becomes an invisible one.

## Interview questions

**★ When does `combine` re-run, and why does writing it inline defeat the point?**
*"The `combine` function only re-runs if it changed referentially, or if any of the query results
changed."* The second clause is the useful one — recompute when the data actually moved. The
first is a correctness escape hatch for a `combine` that closes over changing values, and an
inline arrow function triggers it every single render because it is a new object every time. So
the derivation you extracted into `combine` specifically to avoid recomputing runs on every
unrelated re-render of that component. The docs give both fixes explicitly: `useCallback` when it
has dependencies, or hoist it to a module-level function when it has none.

**★ Your comparison page renders an empty table instead of a spinner. Where do you look first?**
At the length of the `queries` array. `useQueries` over an empty array returns an empty array,
and every `.some()`-based aggregate over an empty array is `false` — so `isPending` is false,
`isLoading` is false, the loading branch is skipped, and the success branch renders zero rows.
The two ways to get there are a genuinely empty selection and, more often, a dependent
`useQueries` whose parent has not resolved, since the array-level fallback is `: []` and there is
no `enabled` at that level. Test the input length, and the parent's own state, before you test
any aggregate — and give the empty selection its own branch rather than letting it share the
success path.

**★ How would you aggregate loading and error state across a `useQueries` list, and what are the
traps?**
Inside a stable `combine`, mirroring the docs' own example: `data` mapped from the results,
`isPending` from `.some((q) => q.isPending)`, `isError` from `.some((q) => q.isError)`. Three
traps, in the order they bite. The empty array, where every `.some()` is false and the page
renders as loaded. Dropping failures with `.filter(Boolean)` on the mapped data, which converts a
failed request into a missing row and removes any chance of telling the user. And aggregating
`isLoading` instead of `isPending`, which reports "not loading" for entries that have no data and
nothing in flight. Counting errors and rendering a partial-load warning keeps the page usable
without lying about what it managed to fetch.

**★ Why is `isPending` the right flag to aggregate, when `isLoading` is the one you would branch
on for a single query?**
Because they answer different questions and a fan-out contains states a single query rarely
reaches. `isLoading` is *"computed from: `isPending && isFetching`"* — it means "this one is
fetching for the first time right now". `isPending` means "this one has no data". In a fan-out
where every entry is enabled and fresh off the mount, those coincide; add one gated entry, one
paused entry, or an empty array and they diverge, with `isLoading` reporting false for a page
that has nothing to render. Aggregate `isPending` to answer "is anything still missing", which is
what a page-level spinner is really asking.

**★ Does returning a new object from `combine` on every run cause unnecessary re-renders
downstream?**
No, and this is the part people get wrong in both directions. The docs promise that *"the result
will be structurally shared to be as referentially stable as possible"*, so a fresh object
literal whose contents are unchanged comes back as the same reference and downstream memoisation
holds. What *is* unstable, and what the docs warn about in the very next breath, is the `combine`
function itself when it is declared inline — that forces the work to happen every render even
though the output may then be shared away. The rule of thumb: stabilise the function, and stop
worrying about the shape of the value it returns.

---

← [Parallel queries & `useQueries`](./01b-parallel-queries-and-usequeries.md) · [Topic index](../README.md) · Next → [What composition costs](./01d-what-query-composition-costs.md)
