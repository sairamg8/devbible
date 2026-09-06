---
title: "`createSelector`: Memoized Derived State"
sidebar_label: "`createSelector`: Memoized Derived State"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Reselect and Redux Toolkit documentation for
> **@reduxjs/toolkit 2.12.0** (Reselect 5) —
> [`createSelector`](https://reselect.js.org/api/createSelector/),
> [`weakMapMemoize`](https://reselect.js.org/api/weakMapMemoize),
> [RTK 2.0 migration](https://redux-toolkit.js.org/usage/migrating-rtk-2).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 `createSelector`: Memoized Derived State

## 1. Under-The-Hood Mechanics

`createSelector` (re-exported from Reselect) builds a **memoized** selector function out of one or more "input selectors" and a "result function." Its purpose: avoid recomputing expensive derived data (filtering, sorting, aggregating) on every render when the underlying raw state hasn't actually changed.

```
createSelector(
  [inputSelector1, inputSelector2, ...],
  (input1Result, input2Result, ...) => derivedValue
)
```

On each call, the memoized selector:
1. Runs every input selector against the current arguments.
2. Compares each input selector's result to its **previous** result using reference equality (`===`, by default).
3. If **all** inputs are reference-equal to last time, returns the **cached** `derivedValue` without re-running the result function.
4. If any input differs, re-runs the result function and caches the new output.

This is why input selectors matter as much as the result function: if an input selector itself returns a new array/object reference every call (e.g. `state => state.items.filter(...)` used as an *input* selector), memoization never triggers because that input never equals its previous value.

### Selector Composition & `createSelector` Caching Modes

🔴 **This is the one thing that changed between Reselect 4 and Reselect 5, and it inverts most of the
selector advice written before 2024.** Reselect 4 — the version RTK 1.x shipped — defaulted to
`lruMemoize` (then named `defaultMemoize`) with a **cache size of 1**. One selector instance called
with two different arguments in the same render evicted its own result each time, so memoization
did nothing.

Since v5.0.0, which shipped with RTK 2.0, `createSelector` uses **`weakMapMemoize`** as the default
for both `memoize` and `argsMemoize`, giving an effectively **unlimited** cache keyed on argument
identity. The eviction problem is gone by default.

Two things that are easy to conflate with this:

- `lruMemoize` is still exported, and is still what you want when you need a *bounded* cache or
  value comparison rather than reference identity:
  `createSelector(inputs, resultFn, { memoize: lruMemoize, memoizeOptions: { maxSize: 10 } })`.
- `createSelector.withTypes<RootState>()` is a **typing** helper — it pre-binds the state generic so
  input selectors infer without annotation. It has nothing to do with caching.

---

## 2. Real-World Engineering Scenario

**Scenario**: Large Product Catalog With Client-Side Filtering and Sorting.
A product listing page filters 5,000 in-memory products by category and sorts by price, recomputed on every keystroke in a search box that also lives in the same component tree. Without memoization, every unrelated re-render (e.g. a cart badge count updating) would re-run the filter+sort over all 5,000 items. `createSelector` ensures the expensive derivation only re-runs when `state.products.items`, `state.filters.category`, or `state.filters.sortOrder` actually change — not on every render.

---

## 3. Production-Grade Code Example

```typescript
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
}

// Input selectors — each reads one raw, stable slice of state
const selectAllProducts = (state: RootState): Product[] => state.products.items;
const selectCategoryFilter = (state: RootState): string | null => state.filters.category;
const selectSortOrder = (state: RootState): 'asc' | 'desc' => state.filters.sortOrder;

// Memoized derived selector — only recomputes when one of the three inputs changes reference/value
export const selectVisibleProducts = createSelector(
  [selectAllProducts, selectCategoryFilter, selectSortOrder],
  (products, category, sortOrder) => {
    const filtered = category ? products.filter((p) => p.category === category) : products;
    return [...filtered].sort((a, b) =>
      sortOrder === 'asc' ? a.priceCents - b.priceCents : b.priceCents - a.priceCents
    );
  }
);

// Parameterized selector factory — one instance per component. Under Reselect 5 a single shared
// instance would memoize correctly too; the factory is what you want when you need the cache to
// die with the component, or when you deliberately bound it with lruMemoize.
export const makeSelectProductById = () =>
  createSelector(
    [selectAllProducts, (_state: RootState, productId: string) => productId],
    (products, productId) => products.find((p) => p.id === productId)
  );
```

```tsx
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

function ProductCard({ productId }: { productId: string }) {
  // Instantiate the selector once per component instance so each card gets its own memoization cache
  const selectProductById = useMemo(makeSelectProductById, []);
  const product = useSelector((state: RootState) => selectProductById(state, productId));
  return <div>{product?.name}</div>;
}
```

---

## Gotchas

### Reaching for a selector factory for a reason that stopped being true
**Symptom.** A `useMemo(makeSelectX, [])` in every row of a list, defended in review with "otherwise the
cache thrashes".
**Cause.** True under Reselect 4, where the default `lruMemoize` held one entry. Reselect 5 — which
ships inside RTK 2 — defaults to `weakMapMemoize` with an effectively unlimited cache keyed on argument
identity.
**Fix.** Keep the factory when you want the cache to die with the component or you have deliberately
chosen `lruMemoize`; otherwise a single shared instance is correct and cheaper.
```typescript
// ⚠️ THE OLD ADVICE — and you will still meet it in every blog post, Stack Overflow answer and
// code review written against RTK 1.x. Under Reselect 4 this module-level shared instance thrashed:
// a cache of 1 cannot hold results for two productIds at once, so each component evicted the last.
export const selectProductById = createSelector(
  [selectAllProducts, (_s, id: string) => id],
  (products, id) => products.find((p) => p.id === id)
);

// ✅ On the pinned version this is FINE. weakMapMemoize keeps a result per argument identity, so one
// shared instance serves every product id in the list without a single eviction.
```
The factory + `useMemo` pattern in the example above is not wrong, and it is still the right answer
when the cache should be discarded with the component, when you opt into `lruMemoize` for bounded
memory, or when the selector closes over per-component state. But **"cache size of 1" is no longer
the reason to reach for it.** Repeating that justification on RTK 2.x teaches a cargo cult — and it
costs real code, because a factory per row in a long list is a `useMemo` and a closure per row that
the default memoizer no longer needs.

### An input selector that manufactures a new reference every call
**Symptom.** The result function runs on every single dispatch; profiling shows the "memoized" selector
is the hot path.
**Cause.** Memoization compares each input's result to its previous result by reference. An input that
filters, maps, sorts or builds an object literal returns something new every time, so the comparison can
never succeed.
**Fix.** Input selectors read raw state; derivation belongs in the result function.
```typescript
// ❌ WRONG: this "input selector" itself creates a new array every call — never memoizes
const selectActiveProducts = (state: RootState) => state.products.items.filter((p) => p.active);

createSelector([selectActiveProducts], (active) => active.length); // recomputes every single call!

// ✅ CORRECT: keep input selectors to raw, stable state reads; do filtering in the result function
createSelector([selectAllProducts], (products) => products.filter((p) => p.active).length);
```

### Memoizing a value that was already cheap
**Symptom.** A file of forty selectors, most of them one-line property reads.
**Cause.** Treating `createSelector` as the house style for "any selector" rather than a tool for
expensive derivation. Memoization has its own bookkeeping cost, and `useSelector` already bails out of
re-rendering when a primitive is unchanged.
**Fix.** Reserve it for derivations that genuinely cost something — filtering, sorting, aggregating,
joining collections. `state => state.cart.items.length` needs nothing.

### A result function that returns a new object every time it runs
**Symptom.** The selector memoizes correctly but the component still re-renders on unrelated dispatches.
**Cause.** Two different caches. Reselect returns its cached object when inputs are unchanged, but if an
input *did* change for an unrelated reason the result function reruns and produces a fresh reference,
which `useSelector`'s `===` check treats as new.
**Fix.** Narrow the inputs so unrelated changes cannot reach the selector, or compare with `shallowEqual`
at the `useSelector` call. Returning primitives where you can sidesteps the problem entirely.

### Passing component props as a second argument without thinking about identity
**Symptom.** A per-item selector that memoizes for ids and not for objects.
**Cause.** `weakMapMemoize` keys on **argument identity**. A string id is stable by value; an inline
object `{ id, includeArchived }` is a new reference every render and gets a new cache slot each time.
**Fix.** Pass primitives as selector arguments. If you need several, either pass them as separate
arguments or hoist the object so its identity is stable.

### Assuming `createSelector.withTypes()` changes caching
**Symptom.** Someone adds it expecting a performance change and reports that nothing happened.
**Cause.** It is a **typing** helper — it pre-binds the state generic so input selectors infer without
annotation. It has no runtime behaviour.
**Fix.** For caching, pass `memoize`/`memoizeOptions` explicitly:
`createSelector(inputs, resultFn, { memoize: lruMemoize, memoizeOptions: { maxSize: 10 } })`.

### Selectors that hard-code where the slice lives
**Symptom.** Every selector breaks when a slice is mounted somewhere else — a differently-shaped test
store, or a host app during a migration.
**Cause.** `state => state.cart.items` encodes the mount point at every call site.
**Fix.** Declare selectors on the slice and let RTK rebase them — see
[slice selectors](../02-slices-and-actions/01b-slice-selectors-and-creator-callback.md).

## Interview questions

**★ What does `createSelector` actually memoize, and against what?**
Two things, at two levels. It runs each input selector, compares every input's result against its
previous result, and reruns the result function only if at least one differs. Since Reselect 5 both the
argument comparison (`argsMemoize`) and the result caching (`memoize`) default to `weakMapMemoize`, which
keys on argument identity with an effectively unlimited cache. The consequence people miss is that input
selectors matter as much as the result function: one input returning a fresh reference defeats the whole
thing.

**★ What changed in Reselect 5, and why does so much advice about selectors predate it?**
The default memoizer. Reselect 4 used `lruMemoize` — then called `defaultMemoize` — with a cache size of
**1**, so a single selector instance called with two different arguments evicted its own result each
time. That single fact generated the entire "make a selector factory per component with `useMemo`" genre
of advice. Reselect 5 defaults to `weakMapMemoize` with an unlimited cache keyed on argument identity, so
the eviction problem the pattern existed to solve is gone.

**★ When is a selector factory still the right answer?**
Three cases. When you want the memo cache to be collected with the component rather than living as long
as the module. When you deliberately want bounded memory and opt into `lruMemoize` with a `maxSize`. And
when the selector closes over something per-component that is not passed as an argument. What is no
longer a reason is cache thrash between different ids.

**★ Your memoized selector recomputes on every dispatch. Where do you look first?**
The input selectors, not the result function. Any input that filters, maps, sorts or builds an object
literal returns a new reference each call, so the reference comparison never succeeds and the result
function always reruns. Inputs should be raw state reads; all derivation belongs in the result function.

**Does memoizing a selector stop a component re-rendering?**
Not by itself. They are separate caches: Reselect decides whether to rerun the result function,
`useSelector` decides whether to re-render by comparing the returned value with `===`. A selector whose
inputs changed for an unrelated reason reruns and returns a new object, and the component re-renders even
though the derived data is equivalent. Narrow the inputs, return primitives, or pass `shallowEqual`.

**How do arguments interact with memoization?**
They are part of the cache key, and `weakMapMemoize` keys on **identity**. Primitive arguments — a string
id — are stable by value and cache cleanly. An inline object argument is a new reference every render and
gets a fresh cache slot each time, which reintroduces exactly the miss rate people think they left behind
in Reselect 4. Pass primitives, or hoist the object.

**What is `createSelector.withTypes()` for?**
Types only. It pre-binds the `RootState` generic so input selectors infer their parameter without
per-selector annotation. It is easy to mistake for a caching option because it arrived in the same
release as the memoizer change, but it has no runtime effect at all.

---

← [Optimistic & manual cache updates](../04-rtk-query/02b-optimistic-and-manual-cache-updates.md) · [Topic index](../README.md) · Next → [`createEntityAdapter`](./02-create-entity-adapter.md)
