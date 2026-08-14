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
By default, RTK's `createSelector` uses a **cache size of 1** (LRU with 1 entry) — calling it with different arguments back-to-back thrashes the cache. RTK 2.x exposes `createSelector.withTypes()` and configurable memoize functions (e.g. `lruMemoize` with a larger cache size) for selectors called with many distinct arguments, such as per-item selectors in a list.

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

// Parameterized selector factory — one memoized instance PER product id, avoiding cross-item cache thrash
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

### ⚠️ Pitfall 1: Sharing One Parameterized Selector Instance Across Many Components
```typescript
// ❌ WRONG: module-level shared instance — cache size of 1 thrashes as different
// components call it with different productIds, defeating memoization entirely
export const selectProductById = createSelector(
  [selectAllProducts, (_s, id: string) => id],
  (products, id) => products.find((p) => p.id === id)
);

// ✅ CORRECT: a factory function (makeSelectProductById) instantiated per-component via useMemo,
// so each card/row gets its own independent memoization cache.
```

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
