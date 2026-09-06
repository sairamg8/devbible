---
title: "`createSelector`: Memoized Derived State"
sidebar_label: "`createSelector`: Memoized Derived State"
sidebar_position: 1
---

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reaching for a Selector Factory for a Reason That Stopped Being True
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

### ⚠️ Pitfall 2: Input Selectors That Return a Fresh Reference Every Call
```typescript
// ❌ WRONG: this "input selector" itself creates a new array every call — never memoizes
const selectActiveProducts = (state: RootState) => state.products.items.filter((p) => p.active);

createSelector([selectActiveProducts], (active) => active.length); // recomputes every single call!

// ✅ CORRECT: keep input selectors to raw, stable state reads; do filtering in the result function
createSelector([selectAllProducts], (products) => products.filter((p) => p.active).length);
```

### ⚠️ Pitfall 3: Wrapping `useSelector` Calls in `createSelector` Unnecessarily
Not every derived value needs `createSelector` — a selector that returns a primitive (`state => state.cart.items.length`) is already cheap to recompute and cheap to compare via `useSelector`'s default reference-equality bailout. Reserve `createSelector` memoization for genuinely expensive derivations (filtering/sorting/aggregating collections), not for trivial reads — the memoization bookkeeping itself has a (small) cost.
