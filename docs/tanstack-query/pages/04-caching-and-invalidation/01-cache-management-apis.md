---
title: "Caching & Invalidation: `invalidateQueries()`, `refetchQueries()` & Direct Cache Access"
sidebar_label: "Caching & Invalidation"
sidebar_position: 1
---

# 🔄 Caching & Invalidation: `invalidateQueries()`, `refetchQueries()` & Direct Cache Access

## 1. Under-The-Hood Mechanics

TanStack Query's cache invalidation APIs each solve a distinct problem — marking data stale vs forcing an immediate refetch vs directly manipulating cache contents synchronously — and picking the wrong one produces either unnecessary network traffic or stale UI that doesn't update when it should.

```
invalidateQueries({ queryKey: ['todos'] })
        │
        ▼
Marks EVERY matching query STALE, AND triggers an immediate refetch for any query
that's CURRENTLY ACTIVE (has a mounted component observing it) — INACTIVE queries
are just marked stale, refetched lazily whenever next observed

refetchQueries({ queryKey: ['todos'] })
        │
        ▼
Forces an IMMEDIATE refetch of matching queries REGARDLESS of staleness — even
data that's still perfectly fresh gets refetched right now

setQueryData(queryKey, updater) / getQueryData(queryKey)
        │
        ▼
SYNCHRONOUS, direct cache read/write — no network request at all — the mechanism
optimistic updates use to apply an assumed-successful change INSTANTLY
```

### Hierarchical Keys Enabling Partial-Match Invalidation
`invalidateQueries({ queryKey: ['todos'] })` matches **every** query whose key starts with `'todos'` — `['todos', 'list', {status: 'active'}]`, `['todos', 'detail', '123']`, all of it — a single, broad invalidation call correctly refreshes every related view without needing to enumerate every specific filtered variant that happens to exist.

### `setQueryData()`: The Foundation of Optimistic Updates
Because `setQueryData()` writes directly and synchronously to the cache (no network round-trip), it's what lets a mutation's `onMutate` callback apply an assumed-successful UI change **instantly** — the actual optimistic-update pattern (covered in depth in the [useMutation doc](../05-usemutation/01-mutation-lifecycle.md)) is built entirely on this one primitive.

---

## 2. Real-World Engineering Scenario

**Scenario**: A "Mark as Read" Action Needing to Update Both a Notification List AND a Badge Count, From One Invalidation Call.
Marking a notification as read needed to refresh both the notification list view (`['notifications', 'list']`) and a separate unread-count badge (`['notifications', 'unreadCount']`) — rather than tracking and invalidating each specific query key individually (fragile, easy to miss one when a new notification-related view is added later), a single `invalidateQueries({ queryKey: ['notifications'] })` call correctly refreshed **every** query under that hierarchical prefix, including both existing views and any future ones added under the same key structure, with zero additional invalidation code needed as the app grew.

---

## 3. Production-Grade Code Example

```typescript
// Broad, hierarchical invalidation — refreshes EVERY related query with one call
async function markNotificationRead(id: string) {
  await api.post(`/notifications/${id}/read`);
  queryClient.invalidateQueries({ queryKey: ['notifications'] }); // refreshes list, unreadCount, detail views, ALL of it
}
```

```typescript
// Narrow invalidation — only refreshing a SPECIFIC query, leaving sibling queries untouched
async function updateTodoStatus(id: string, status: string) {
  await api.patch(`/todos/${id}`, { status });
  queryClient.invalidateQueries({ queryKey: ['todos', 'detail', id] }); // ONLY this specific todo's detail view
  // NOT invalidating ['todos', 'list', ...] here — deliberately, if the list view doesn't need refreshing yet
}
```

```typescript
// refetchQueries() — forcing an immediate refresh regardless of staleness (e.g. a manual "Refresh" button)
function RefreshButton() {
  const queryClient = useQueryClient();
  return (
    <button onClick={() => queryClient.refetchQueries({ queryKey: ['dashboard'] })}>
      Refresh Now {/* forces a refetch even if data is still technically "fresh" per staleTime */}
    </button>
  );
}
```

```typescript
// setQueryData/getQueryData — direct, synchronous cache manipulation for optimistic updates
function useToggleTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/todos/${id}/toggle`),
    onMutate: async (id) => {
      const previous = queryClient.getQueryData(['todos', 'list']); // snapshot BEFORE the optimistic change
      queryClient.setQueryData(['todos', 'list'], (old: Todo[]) =>
        old.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      );
      return { previous }; // returned as context for onError rollback — see the useMutation doc
    },
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `refetchQueries()` Where `invalidateQueries()` Would Suffice
```typescript
// ❌ WASTEFUL: forces an immediate network request even for data that's still fresh and
// doesn't actually need refetching right now — unnecessary server load
queryClient.refetchQueries({ queryKey: ['todos'] }); // ALWAYS refetches, regardless of staleness

// ✅ CORRECT: invalidateQueries respects staleness AND active/inactive query state, only
// forcing an immediate refetch for queries with an ACTIVE observer, deferring the rest
queryClient.invalidateQueries({ queryKey: ['todos'] });
```

### ⚠️ Pitfall 2: Over-Broad Invalidation Causing Unnecessary Refetch Storms
```typescript
// ❌ WASTEFUL: invalidating the ENTIRE cache (no queryKey filter at all) after a small,
// narrowly-scoped mutation forces every single active query in the app to refetch simultaneously
queryClient.invalidateQueries(); // no filter — invalidates EVERYTHING

// ✅ CORRECT: scope invalidation to the SPECIFIC hierarchical prefix actually affected by the mutation
queryClient.invalidateQueries({ queryKey: ['todos'] }); // only todo-related queries, not the whole app
```

### ⚠️ Pitfall 3: Mutating the Object Returned by `getQueryData()` Directly
```typescript
// ❌ WRONG: mutating the returned data DIRECTLY bypasses TanStack Query's own change-detection
// and subscriber-notification mechanism — components observing this query DON'T re-render,
// since the cache was mutated OUTSIDE the sanctioned setQueryData() write path
const data = queryClient.getQueryData(['todos', 'list']);
data.push(newTodo); // ❌ directly mutates the cached array — observers never notified

// ✅ CORRECT: always use setQueryData() with an updater function, which correctly triggers
// subscriber notifications and produces a genuinely NEW reference (respecting immutability)
queryClient.setQueryData(['todos', 'list'], (old) => [...old, newTodo]);
```
