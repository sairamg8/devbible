---
title: "Dependent & Parallel Queries: `enabled` Chaining & `useQueries()`"
sidebar_label: "Dependent & Parallel Queries"
sidebar_position: 1
---

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

### `useQueries()`: When the Number of Parallel Queries Isn't Fixed
`useQuery` (and calling it multiple times) works when the exact number of parallel queries is known at the component's design time — `useQueries()` handles the case where the **count itself** is dynamic (a query per item in an array whose length varies), something the Rules of Hooks make impossible to express by calling `useQuery` in a loop directly.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Product Comparison Page Needing One Query Per Selected Product, Where the Selection Count Varies.
A product comparison feature let users select anywhere from 2 to 5 products to compare side-by-side — the number of individual product-detail queries needed depended entirely on how many products the user had currently selected, a genuinely dynamic count that couldn't be expressed with a fixed number of individual `useQuery` calls (which would violate the Rules of Hooks if called conditionally/in a loop). `useQueries()`, given an array of query configs derived from the current selection, correctly fired exactly the right number of parallel queries for whatever the current selection happened to be, recalculating cleanly whenever the user added or removed a product from the comparison.

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

### ⚠️ Pitfall 2: Calling `useQuery` in a Loop Instead of `useQueries()`
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

### ⚠️ Pitfall 3: Forgetting `enabled` Guards Against `undefined`/Invalid Parameters, Not Just "Should I Fetch"
```typescript
// ❌ RISKY: without the enabled guard, this query fires IMMEDIATELY with user?.id being
// undefined the first time around — queryFn receives an invalid parameter, likely throwing
// or making a malformed request BEFORE user has actually loaded
const { data: orders } = useQuery({ queryKey: ['orders', user?.id], queryFn: () => fetchOrders(user.id) }); // no enabled guard!

// ✅ CORRECT: enabled prevents the query from firing AT ALL until its actual precondition is met
const { data: orders } = useQuery({ queryKey: ['orders', user?.id], queryFn: () => fetchOrders(user.id), enabled: !!user?.id });
```
