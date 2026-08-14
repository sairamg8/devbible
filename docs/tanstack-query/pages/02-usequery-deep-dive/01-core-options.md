---
title: "`useQuery` Deep Dive: `queryKey`, `staleTime` vs `gcTime`, `enabled` & `select`"
sidebar_label: "`useQuery` Deep Dive"
sidebar_position: 1
---

# 🔄 `useQuery` Deep Dive: `queryKey`, `staleTime` vs `gcTime`, `enabled` & `select`

## 1. Under-The-Hood Mechanics

`useQuery`'s handful of core options each control a genuinely distinct aspect of caching behavior — conflating them (especially `staleTime` and `gcTime`) is the single most common source of "why isn't my data refetching/why did my data disappear" confusion.

```typescript
useQuery({
  queryKey: ['todos', { status: 'active' }],   // the CACHE IDENTITY — must be unique, serializable, hierarchical
  queryFn: () => fetchTodos({ status: 'active' }), // the actual async data-fetching function
  enabled: !!userId,                              // conditionally/lazily trigger — skip entirely if false
  staleTime: 60_000,                                // how long data is considered FRESH (no auto-refetch) after fetching
  gcTime: 5 * 60_000,                                 // how long UNUSED cache entries persist before being GARBAGE COLLECTED
  select: (data) => data.filter((t) => !t.archived),    // TRANSFORM cached data for THIS hook call, cache itself untouched
});
```

### `staleTime` vs `gcTime`: Two Independent Timers, Not One
- **`staleTime`** — how long fetched data is considered "fresh." While fresh, TanStack Query **won't** automatically refetch it (on mount, window focus, reconnect) — it serves the cached data immediately, no network call. Once stale, the data is still shown immediately (never a blocking loading state for already-cached data) but a background refetch is triggered.
- **`gcTime`** (formerly `cacheTime`) — how long a query's cached data persists in memory **after it has no active observers** (no mounted component using that query key) before being garbage collected entirely. This is about **cache retention**, not staleness — a query can be simultaneously "stale" (past its staleTime) yet still fully present in the cache (within its gcTime window).

### `queryKey`: Hierarchical, Serializable Cache Identity
Array-based keys support **partial matching** for cache operations — `invalidateQueries({ queryKey: ['todos'] })` invalidates every query whose key starts with `'todos'`, regardless of what filter/pagination parameters follow it in the array. This hierarchical structure is what makes broad ("invalidate everything todo-related") vs narrow ("invalidate only this specific filtered view") invalidation both possible from the same key structure.

### `select`: Transforming Without Mutating the Cache
`select` runs on every render that consumes the query, deriving a transformed view of the cached data **without** altering what's actually stored in the cache — useful when different components need different projections of the same underlying cached data (one needs the full list, another needs just a count) without each maintaining its own separate cache entry.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Dashboard Widget Refetching Far More Often Than Necessary, Fixed by Correctly Distinguishing `staleTime` From `gcTime`.
A dashboard widget was refetching its data on every single window focus, even though the underlying data only changed a few times per day — the team had left `staleTime` at its default of `0` (meaning data is considered stale immediately after fetching), triggering a background refetch on every focus event even though nothing had actually changed. Setting a `staleTime` of several minutes (matching how often the underlying data genuinely updated) eliminated the unnecessary refetches, while `gcTime` (left at its default) continued to govern how long unused data stayed cached — the two settings addressed two genuinely different concerns, and conflating them had led to tuning the wrong knob entirely at first.

---

## 3. Production-Grade Code Example

```typescript
// Hierarchical query keys enabling both broad and narrow invalidation
function useTodos(filters: { status: string }) {
  return useQuery({
    queryKey: ['todos', 'list', filters], // hierarchical: ['todos'] → ['todos', 'list'] → ['todos', 'list', filters]
    queryFn: () => fetchTodos(filters),
    staleTime: 30_000, // fresh for 30s — no refetch on focus/mount within that window
  });
}

function useTodoDetail(id: string) {
  return useQuery({
    queryKey: ['todos', 'detail', id],
    queryFn: () => fetchTodoById(id),
    enabled: !!id, // skip entirely if id isn't available yet — a genuinely lazy/conditional query
  });
}
```

```typescript
// select — deriving different projections of the SAME cached data, without separate cache entries
function useTodoCount() {
  return useQuery({
    queryKey: ['todos', 'list', {}],
    queryFn: () => fetchTodos({}),
    select: (data) => data.length, // this hook only cares about the COUNT, not the full list
  });
}

function useActiveTodos() {
  return useQuery({
    queryKey: ['todos', 'list', {}], // SAME queryKey — shares the underlying cache entry with useTodoCount
    queryFn: () => fetchTodos({}),
    select: (data) => data.filter((t) => !t.completed),
  });
}
```

```typescript
// staleTime tuned to match how often the underlying data ACTUALLY changes
function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000, // this data updates a few times/day — 5 minutes of freshness avoids over-fetching
    gcTime: 30 * 60 * 1000, // keep it cached for 30 min after last use, even if unmounted temporarily
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Confusing `staleTime` and `gcTime` as the Same Concept
```typescript
// ❌ WRONG MENTAL MODEL: "increasing gcTime will stop it from refetching so often" —
// gcTime controls CACHE RETENTION after unmount, NOT refetch frequency
useQuery({ queryKey: ['data'], queryFn: fetchData, gcTime: 60 * 60 * 1000 }); // doesn't affect refetch-on-focus AT ALL

// ✅ CORRECT: staleTime is what actually controls "how often does this refetch automatically"
useQuery({ queryKey: ['data'], queryFn: fetchData, staleTime: 60 * 1000 });
```

### ⚠️ Pitfall 2: Using an Unserializable or Unstable `queryKey`
```typescript
// ❌ WRONG: a NEW object/function reference on every render produces a DIFFERENT queryKey
// every time (arrays/objects are compared by VALUE for keys, but a function reference inside
// one is compared by REFERENCE) — defeats caching, causing a refetch on every single render
useQuery({ queryKey: ['todos', { onLoad: () => console.log('loaded') }], queryFn: fetchTodos }); // ❌ new function ref every render

// ✅ CORRECT: queryKey should contain ONLY serializable, stable values — actual data parameters,
// never functions/class instances/non-serializable references
useQuery({ queryKey: ['todos', { status: 'active' }], queryFn: fetchTodos });
```

### ⚠️ Pitfall 3: Forgetting `enabled: false` Still Returns a Query Object, Just Without Fetching
```typescript
// ❌ MISUNDERSTANDING: enabled: false doesn't mean "this hook returns nothing" — it still
// returns the FULL query result object (status, data, etc.), just with NO fetch ever triggered
// and status typically remaining 'pending' indefinitely until enabled becomes true
const { data, status } = useQuery({ queryKey: ['user', userId], queryFn: fetchUser, enabled: !!userId });
// if userId is initially undefined, status is 'pending' but NO actual loading is happening —
// don't show a loading SPINNER based on status alone without also checking `enabled`'s condition

// ✅ CORRECT: distinguish "genuinely loading" from "disabled and waiting for a precondition"
if (!userId) return null; // don't render a loading state for a query that isn't even enabled yet
if (status === 'pending') return <Spinner />;
```
