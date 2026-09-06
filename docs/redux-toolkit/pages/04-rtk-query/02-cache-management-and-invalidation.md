---
title: "RTK Query Cache: Tags, Invalidation, Polling & Prefetching"
sidebar_label: "RTK Query Cache"
sidebar_position: 3
---

# 📦 RTK Query Cache: Tags, Invalidation, Polling & Prefetching

## 1. Under-The-Hood Mechanics

RTK Query's cache invalidation is a **declarative graph**, not imperative "refetch this specific query" calls. Each query endpoint declares what tags it **provides**; each mutation declares what tags it **invalidates**. When a mutation resolves, RTK Query diffs invalidated tags against every currently-cached query's provided tags and re-fetches any that match.

```
Query "getPosts" ──provides──► [{ type: 'Post', id: 'LIST' }, { type: 'Post', id: '1' }, { type: 'Post', id: '2' }]
Mutation "updatePost" ──invalidates──► [{ type: 'Post', id: arg.id }]
                                                │
                       arg.id === '1' matches a tag provided by getPosts
                                                │
                                                ▼
                       getPosts automatically re-fetches (if it has active subscribers)
```

### Tag Granularity: List vs Item Tags
The idiomatic pattern provides **both** a `'LIST'` pseudo-id (invalidated by create/delete, which change the list's membership) and per-item ids (invalidated by updates to that one item) — this avoids re-fetching an entire list just because one unrelated item changed elsewhere.

### Lifecycle & Refetch Triggers
Beyond tag invalidation, a cached query entry re-fetches when:
- `pollingInterval` elapses (if set on the hook call).
- `refetchOnMountOrArgChange` — forces a re-fetch even if a cache entry exists, either always (`true`) or if older than N seconds (a number).
- `refetchOnFocus` / `refetchOnReconnect` — window regains focus or network comes back online (requires `setupListeners(store.dispatch)` once at app init).
- `skip: true` — the opposite of a trigger: pauses the hook entirely (no request, no subscription).

### Prefetching
`api.usePrefetch('getPostById')` returns a function that, when called (e.g. on link hover), pre-warms the cache for an argument **before** the component that actually needs it mounts — turning a network-bound navigation into an instant one.

### Optimistic Updates: `onQueryStarted` + `updateQueryData().undo()`
Tag invalidation refetches **after** a mutation resolves — for a mutation the UI should reflect instantly (a toggle, a role change, a like button), that round-trip delay is exactly the latency `onQueryStarted` exists to hide. Inside a mutation's `onQueryStarted(arg, { dispatch, queryFulfilled })`:
1. Call `dispatch(api.util.updateQueryData(endpointName, cacheKeyArg, recipe))` **before** awaiting anything — this synchronously patches the cached query data (via an Immer draft, just like a reducer) and returns a `patchResult` handle.
2. `await queryFulfilled` — a promise that resolves when the mutation's own request succeeds, rejects when it fails.
3. On rejection, call `patchResult.undo()` inside a `catch` — this reverts **exactly** the patch that was applied, not a blind refetch, so it composes correctly even if other patches were applied to the same cache entry in the meantime.

---

## 2. Real-World Engineering Scenario

**Scenario**: Admin Dashboard — Editing a User Instantly Updates Both the Detail Page and the Paginated Table.
An admin edits a user's role from a detail modal. Behind it, a paginated user table is still mounted and subscribed. Without tag-based invalidation, the table would show stale data until a manual page refresh. By having `getUsers` provide `[{ type: 'User', id: 'LIST' }, ...ids]` and `updateUserRole` invalidate `{ type: 'User', id: arg.id }`, the table's row for that one user refetches automatically the instant the mutation succeeds — with zero manual cache-sync code.

---

## 3. Production-Grade Code Example

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
}

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], { page: number }>({
      query: ({ page }) => `/users?page=${page}`,
      // List tag + one tag per returned entity
      providesTags: (result) =>
        result
          ? [{ type: 'User', id: 'LIST' }, ...result.map((u) => ({ type: 'User' as const, id: u.id }))]
          : [{ type: 'User', id: 'LIST' }],
    }),
    getUserById: builder.query<User, string>({
      query: (id) => `/users/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    updateUserRole: builder.mutation<User, { id: string; role: User['role'] }>({
      query: ({ id, role }) => ({ url: `/users/${id}/role`, method: 'PATCH', body: { role } }),
      // Still invalidate on success — this is the source of truth reconciliation;
      // onQueryStarted below only covers the INSTANT before that response arrives
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],
      async onQueryStarted({ id, role }, { dispatch, queryFulfilled }) {
        // Patch the LIST query's cache entry immediately, before the network request resolves
        const patchResult = dispatch(
          usersApi.util.updateQueryData('getUsers', { page: 1 }, (draft) => {
            const user = draft.find((u) => u.id === id);
            if (user) user.role = role; // Immer draft — mutate directly, no spread needed
          })
        );
        try {
          await queryFulfilled; // wait for the actual PATCH request to settle
        } catch {
          patchResult.undo(); // server rejected it — revert the optimistic patch exactly
        }
      },
    }),
    deleteUser: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      // Deleting changes list membership, so invalidate the LIST tag, not just the item
      invalidatesTags: (result, error, id) => [{ type: 'User', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useUpdateUserRoleMutation,
  useDeleteUserMutation,
  usePrefetch,
} = usersApi;
```

```tsx
function UserRow({ user }: { user: User }) {
  const prefetchUser = usersApi.usePrefetch('getUserById');
  return (
    <tr onMouseEnter={() => prefetchUser(user.id, { ifOlderThan: 30 })}>
      <td>{user.name}</td>
      <td>{user.role}</td>
    </tr>
  );
}

// Live-updating dashboard: repoll every 15s only while this hook is mounted
function UserCountBadge() {
  const { data } = useGetUsersQuery({ page: 1 }, { pollingInterval: 15_000 });
  return <span>{data?.length ?? 0} users</span>;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Only Invalidating the Item Tag on Create/Delete
```typescript
// ❌ WRONG: a new user was created, but no LIST tag is invalidated — the table never shows it
createUser: builder.mutation<User, Partial<User>>({
  query: (body) => ({ url: '/users', method: 'POST', body }),
  invalidatesTags: (result) => (result ? [{ type: 'User', id: result.id }] : []),
}),

// ✅ CORRECT: creation/deletion changes list membership — invalidate 'LIST', not just the item id
invalidatesTags: [{ type: 'User', id: 'LIST' }],
```

### ⚠️ Pitfall 2: `pollingInterval` Left Running on Unmounted/Background Tabs
A `pollingInterval` keeps firing network requests for as long as at least one subscriber is mounted — including a component sitting inactive in a background browser tab. Combine with `skip` (e.g. driven by the Page Visibility API) for expensive polls, rather than assuming RTK Query pauses polling on tab blur automatically (it does not, unless `refetchOnFocus`/visibility logic is wired in separately).

### ⚠️ Pitfall 2.5: Forgetting to `catch` and `undo()` the Optimistic Patch
```typescript
// ❌ WRONG: no try/catch — if the PATCH request fails, the optimistic edit stays in the
// cache FOREVER (until the next real refetch), showing the user a role change that never happened
async onQueryStarted({ id, role }, { dispatch, queryFulfilled }) {
  dispatch(usersApi.util.updateQueryData('getUsers', { page: 1 }, (draft) => {
    const user = draft.find((u) => u.id === id);
    if (user) user.role = role;
  }));
  await queryFulfilled; // if this rejects, the function just throws — patch is never undone
}

// ✅ CORRECT: capture patchResult, undo() it in a catch — see the full example above
```

### ⚠️ Pitfall 3: Expecting `transformResponse` to Run on Every Render
`transformResponse(response, meta, arg)` runs once per actual network fetch, not once per render/subscriber — its output is what gets cached. Putting expensive but *non-deterministic* logic there (e.g. `Date.now()`-based fields) bakes a stale timestamp into the cache for the entire `keepUnusedDataFor` window, not a fresh one per read.
