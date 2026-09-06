---
title: "RTK Query Cache: Tags, Invalidation, Polling & Prefetching"
sidebar_label: "RTK Query Cache"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [cache behaviour](https://redux-toolkit.js.org/rtk-query/usage/cache-behavior),
> [automated re-fetching](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

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

### Where manual cache work goes instead
Tag invalidation refetches **after** a mutation resolves. When the UI has to reflect a change before
that round-trip completes — a toggle, a like button, a role change — you patch the cache by hand from
`onQueryStarted`. That, and the `upsertQueryData` route for seeding an entry outright, are the subject
of [manual & optimistic cache updates](./02b-optimistic-and-manual-cache-updates.md).


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
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],
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

## Gotchas

### Invalidating only the item tag on a create or delete
**Symptom.** A new row does not appear in the table until a reload; a deleted one lingers.
**Cause.** Creating and deleting change the list's **membership**, not one item's contents. An item tag
matches no cache entry that needs to change — and on a create, the id does not even exist yet when the
tag is computed.
**Fix.** Invalidate the `'LIST'` tag for anything that changes membership.
```typescript
// ❌ WRONG: a new user was created, but no LIST tag is invalidated — the table never shows it
createUser: builder.mutation<User, Partial<User>>({
  query: (body) => ({ url: '/users', method: 'POST', body }),
  invalidatesTags: (result) => (result ? [{ type: 'User', id: result.id }] : []),
}),

// ✅ CORRECT: creation/deletion changes list membership — invalidate 'LIST', not just the item id
invalidatesTags: [{ type: 'User', id: 'LIST' }],
```

### A `providesTags` that returns nothing when the query errors
**Symptom.** After a failed fetch, later mutations stop refreshing that query entirely.
**Cause.** `providesTags` receives `(result, error, arg)` and `result` is `undefined` on failure. A
callback that indexes into `result` without a guard throws or returns `[]`, so the entry ends up
providing no tags and no invalidation can ever match it.
**Fix.** Always handle the undefined-result branch — the `LIST` tag at minimum, as in the `getUsers`
example above.

### Expecting invalidation to refetch an entry nobody is watching
**Symptom.** Tags are correct, the mutation fires, and the query still shows old data when you navigate
back to it.
**Cause.** An invalidated entry is refetched only if it currently has **active subscribers**. With none,
it is simply marked stale.
**Fix.** This is usually right, not a bug — but if a background entry must be warm, keep a subscription
alive, or refetch on mount with `refetchOnMountOrArgChange`.

### `pollingInterval` left running in a background tab
**Symptom.** Network traffic and server load from tabs nobody is looking at; a battery complaint.
**Cause.** Polling is tied to subscription, not visibility. A mounted component in a hidden tab keeps
polling.
**Fix.** RTK Query ships `skipPollingIfUnfocused` for exactly this, and it composes with `skip` for
anything more specific:
```typescript
const { data } = useGetUsersQuery({ page: 1 }, {
  pollingInterval: 15_000,
  skipPollingIfUnfocused: true,
});
```
⚠️ It carries the same dependency as the focus/reconnect options: `skipPollingIfUnfocused` "requires
`setupListeners` to have been called". Set it without that call and polling continues in the background
exactly as before, silently.

### `refetchOnFocus` / `refetchOnReconnect` with no `setupListeners`
**Symptom.** The options are set and nothing ever refetches.
**Cause.** The options declare intent; the browser event listeners are installed separately. The docs
state it outright: "this requires `setupListeners` to have been called".
**Fix.** `setupListeners(store.dispatch)` once, at app init.

### Prefetching on hover without `ifOlderThan`
**Symptom.** A hover-heavy table issues a request per mouse movement across rows.
**Cause.** `usePrefetch`'s returned function fetches unconditionally by default.
**Fix.** Give it a staleness bound so a warm entry is left alone:
```tsx
<tr onMouseEnter={() => prefetchUser(user.id, { ifOlderThan: 30 })}>
```

### Tag granularity that refetches the world
**Symptom.** Editing one row refetches every list in the app.
**Cause.** A tag type used without ids — `invalidatesTags: ['User']` — matches **every** entry
providing that type, which is occasionally what you want and usually not.
**Fix.** Provide both a `'LIST'` pseudo-id and per-item ids, and invalidate the narrowest thing that is
actually stale. Reach for the bare type only when a mutation genuinely can change anything of that type.

## Interview questions

**★ Explain RTK Query's invalidation model.**
It is a declarative graph rather than imperative refetch calls. Query endpoints declare the tags they
**provide**; mutations declare the tags they **invalidate**. When a mutation resolves, RTK Query matches
the invalidated tags against the tags provided by every cached query and refetches the ones that
overlap — provided they still have subscribers. Nothing names another endpoint directly, which is why a
new consumer of a tag needs no changes anywhere else.

**★ Why provide both a `'LIST'` tag and per-item tags?**
Because updates and membership changes are different events. Editing item 3 should refresh anything
showing item 3, not every list in the app; creating or deleting an item changes which items belong in a
list, which no per-item tag can express — and on a create, the new id does not exist when the tag is
computed. Providing both lets an update invalidate `{ type: 'User', id }` and a create invalidate
`{ type: 'User', id: 'LIST' }`.

**★ A mutation succeeds, tags look right, and the list still does not refetch. What is left?**
Subscribers. RTK Query refetches an invalidated entry only while something is subscribed to it; with
none it is marked stale and refetched next time it is used. After that I would check that `providesTags`
did not silently return `[]` on a previous error result, that the tag *types* actually match
(`'User'` vs `'Users'` fails silently), and that both the API reducer and its middleware are installed.

**What is the difference between `refetchOnMountOrArgChange: true` and a number?**
`true` refetches whenever a new subscriber appears, regardless of cached data. A number is a staleness
bound in seconds — refetch only if the cached entry is older than that. The number is almost always the
better default: it keeps navigation instant while bounding how stale the screen can be.

**How do you stop a poll from running in a hidden tab?**
`skipPollingIfUnfocused: true` alongside `pollingInterval`. It is worth knowing this exists because the
obvious assumption — that RTK Query pauses polling on blur by default — is wrong, and the naive fix
people reach for is a hand-rolled Page Visibility listener driving `skip`.

**What does `usePrefetch` change about the loading experience, and what is its cost?**
It warms a cache entry before the component that needs it mounts, turning a network-bound navigation
into an instant render. The cost is requests for data that may never be shown, so it wants a trigger
that correlates with intent — hover or focus on a link — plus `ifOlderThan` so an already-warm entry is
not refetched on every pass of the mouse.

---

← [`queryFn`, transforms & infinite queries](./01b-queryfn-transforms-and-infinite-queries.md) · [Topic index](../README.md) · Next → [Optimistic & manual cache updates](./02b-optimistic-and-manual-cache-updates.md)
