---
title: "Suspense Integration: `useSuspenseQuery` & `throwOnError`"
sidebar_label: "Suspense Integration"
sidebar_position: 1
---

# 🔄 Suspense Integration: `useSuspenseQuery` & `throwOnError`

## 1. Under-The-Hood Mechanics

`useSuspenseQuery` integrates data fetching directly with React's Suspense/Error Boundary mechanisms — trading the manual `isLoading`/`isError` conditional checks of regular `useQuery` for a component that assumes success, letting React's own boundary components handle the loading/error UI instead.

```
useQuery (regular)                          useSuspenseQuery
        │                                            │
        ▼                                            ▼
Returns { data, isLoading, isError, ... }     THROWS a Promise while loading (caught by
  — component MUST check these flags            the nearest <Suspense> boundary, which
  manually before using `data`                    shows its fallback UI instead)
                                                 THROWS the error while failed (caught by
                                                   the nearest Error Boundary)
                                                 `data` is GUARANTEED DEFINED if the
                                                   component's render function ever
                                                   actually executes past this hook call
```

### Why `data` Is Guaranteed Defined
Because `useSuspenseQuery` throws (to Suspense or an Error Boundary) rather than returning a loading/error state, a component using it can safely assume that if its render function is executing at all past that hook call, `data` genuinely exists — eliminating an entire category of `data?.property` optional-chaining defensiveness that regular `useQuery` requires, since the component's code is simply never reached during the loading/error states at all.

### `throwOnError`: The Same Propagation for Regular `useQuery`
For codebases not fully adopting `useSuspenseQuery`, `throwOnError: true` (or a predicate function) on a regular `useQuery` call opts that **specific** query into throwing its error to the nearest Error Boundary instead of returning an `isError`/`error` state — letting error handling be centralized at a boundary level for specific queries, without requiring the full Suspense-for-loading pattern too.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Component Tree Simplified Significantly by Removing Manual Loading/Error Checks at Every Level.
A deeply nested component tree (a page, containing a widget, containing a sub-widget, each independently calling `useQuery`) required loading/error state handling at **every single level** — each component checking `isLoading`/`isError` before rendering its own children, producing repetitive boilerplate and multiple, potentially inconsistent loading indicators nested within each other. Migrating to `useSuspenseQuery`, with a **single** `<Suspense>` boundary wrapping the whole page and a **single** Error Boundary alongside it, meant every individual component's code could simply assume `data` exists — loading and error UI became a concern handled once, at the boundary level, rather than repeated at every component in the tree.

---

## 3. Production-Grade Code Example

```tsx
// Before: regular useQuery, manual loading/error handling at EVERY level
function ProductWidget({ productId }: { productId: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId) });
  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage />;
  return <ProductPricing product={data} />; // finally, the actual logic
}
```

```tsx
// After: useSuspenseQuery — no manual checks needed, data is GUARANTEED defined here
function ProductWidget({ productId }: { productId: string }) {
  const { data } = useSuspenseQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId) });
  return <ProductPricing product={data} />; // data is DEFINITELY defined — no isLoading/isError check needed at all
}
```

```tsx
// ONE Suspense + Error Boundary pair, wrapping an entire tree of Suspense-driven components
function ProductPage({ productId }: { productId: string }) {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Suspense fallback={<FullPageSpinner />}>
        <ProductWidget productId={productId} />
        <RelatedProductsWidget productId={productId} /> {/* also uses useSuspenseQuery internally */}
      </Suspense>
    </ErrorBoundary>
  );
}
```

```typescript
// throwOnError on a REGULAR useQuery — partial adoption, without full Suspense-for-loading
function useCheckoutSummary() {
  return useQuery({
    queryKey: ['checkout', 'summary'],
    queryFn: fetchCheckoutSummary,
    throwOnError: (error) => error.status >= 500, // only genuinely UNEXPECTED server errors propagate to a boundary;
    // 4xx client errors (e.g. "cart is empty") still return a normal isError state, handled inline
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Nesting Multiple Fine-Grained Suspense Boundaries Where One Coarser Boundary Was More Appropriate
```tsx
// ❌ OVER-GRANULAR (sometimes): a SEPARATE Suspense boundary around every single small
// widget can produce a jarring, staggered "popcorn" loading experience — each widget's
// content appearing at a different moment rather than the page settling in together
<Suspense fallback={<Spinner />}><WidgetA /></Suspense>
<Suspense fallback={<Spinner />}><WidgetB /></Suspense>
<Suspense fallback={<Spinner />}><WidgetC /></Suspense>

// ✅ CONSIDER: one shared boundary for widgets that should visually appear TOGETHER,
// reserving separate boundaries specifically for content that's GENUINELY okay loading
// independently/later (as covered in the Next.js advanced patterns doc's streaming section)
```

### ⚠️ Pitfall 2: Forgetting an Error Boundary Alongside a Suspense Boundary
```tsx
// ❌ INCOMPLETE: useSuspenseQuery throws errors too, not just loading Promises — without
// an Error Boundary, a query FAILURE produces an unhandled error crashing the whole app,
// not a Suspense fallback (Suspense only catches thrown PROMISES, not thrown ERRORS)
<Suspense fallback={<Spinner />}>
  <ProductWidget productId={id} /> {/* no ErrorBoundary — a query error crashes uncontrolled */}
</Suspense>

// ✅ CORRECT: ALWAYS pair a Suspense boundary using useSuspenseQuery with an Error Boundary
<ErrorBoundary fallback={<ErrorPage />}>
  <Suspense fallback={<Spinner />}><ProductWidget productId={id} /></Suspense>
</ErrorBoundary>
```

### ⚠️ Pitfall 3: Mixing `useSuspenseQuery` and Regular `useQuery` for the Same Query Key Inconsistently
Using `useSuspenseQuery` for a given query key in one component and regular `useQuery` for the SAME key elsewhere works functionally (they share the same cache), but produces an inconsistent mental model across the codebase about how loading/error states for that data are actually handled — pick one approach per query/feature area deliberately, rather than mixing arbitrarily based on which component happened to be written first.
