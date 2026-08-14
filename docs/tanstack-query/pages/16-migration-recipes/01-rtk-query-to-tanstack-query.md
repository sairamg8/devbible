---
title: "Migration Recipe: RTK Query \u2192 TanStack Query"
sidebar_label: "Migration Recipe"
sidebar_position: 1
---

# 🔄 Migration Recipe: RTK Query → TanStack Query

## 1. Under-The-Hood Mechanics

Both libraries solve the same problem — cache, dedupe, and invalidate server-state fetches — with a structurally different cache-identity model, which is why this migration is a genuine translation, not a rename:

```text
RTK Query                                    TanStack Query
─────────────────────────────────────────────────────────────────────────
Tag GRAPH: providesTags/invalidatesTags   →  Key HIERARCHY: array queryKeys +
  (explicit graph edges between                partial-match invalidateQueries()
   queries and mutations)                      (implicit, via key array prefix matching)
createApi() + endpoints (generates          →  Plain useQuery/useMutation calls
  use*Query/use*Mutation hooks)                 (no codegen step; queryKey/queryFn
                                                  written directly, optionally centralized
                                                  via a queryOptions() factory)
keepUnusedDataFor                          →  gcTime
onQueryStarted (dispatch + queryFulfilled)  →  onMutate / onError / onSettled
REQUIRES a Redux store (reducerPath,        →  Requires NO store — a QueryClient +
  middleware, configureStore wiring)             QueryClientProvider, nothing Redux-related
```

The last row is the migration's biggest structural consequence, not just an implementation detail: RTK Query's cache lives **inside** the Redux store; TanStack Query's cache is **entirely separate** from Redux. Once server-state moves to TanStack Query, whatever's left in the Redux store is only ever genuine client-UI state — which is often a small enough remainder to prompt asking whether the app still needs Redux at all (see Pitfall 4).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Dashboard App Where 90% of the Redux Store Turns Out to Be Server Data.
A team adopted TanStack Query for a NEW feature area, liked its ergonomics (no codegen, simpler optimistic-update lifecycle, built-in devtools) compared to their existing RTK Query setup, and decided to migrate the rest of the app incrementally, endpoint by endpoint — starting with the highest-traffic one (the users list + role-update mutation) to validate the pattern before touching the rest. Auditing the Redux store during the migration reveals that roughly 90% of its slices were RTK Query API state — once fully migrated, the remaining genuine client state (a sidebar-collapsed boolean, a selected-theme string) was small enough to move to `useState`/Context, letting the team drop Redux entirely, not just RTK Query specifically.

---

## 3. Production-Grade Migration Sequence

```typescript
// BEFORE: RTK Query — the usersApi slice from the RTK Query cache-management doc
export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], { page: number }>({
      query: ({ page }) => `/users?page=${page}`,
      providesTags: (result) =>
        result
          ? [{ type: 'User', id: 'LIST' }, ...result.map((u) => ({ type: 'User' as const, id: u.id }))]
          : [{ type: 'User', id: 'LIST' }],
    }),
    updateUserRole: builder.mutation<User, { id: string; role: User['role'] }>({
      query: ({ id, role }) => ({ url: `/users/${id}/role`, method: 'PATCH', body: { role } }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],
      async onQueryStarted({ id, role }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          usersApi.util.updateQueryData('getUsers', { page: 1 }, (draft) => {
            const user = draft.find((u) => u.id === id);
            if (user) user.role = role;
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
});

export const { useGetUsersQuery, useUpdateUserRoleMutation } = usersApi;
```

```typescript
// AFTER: TanStack Query — same two operations, no codegen, no Redux store involved at all
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// The tag GRAPH (providesTags LIST + item ids) becomes a KEY HIERARCHY instead —
// ['users', { page: 1 }] naturally supports invalidateQueries({ queryKey: ['users'] })
// matching EVERY page, the same broad-invalidation behavior the 'LIST' tag provided
function useUsers(page: number) {
  return useQuery({
    queryKey: ['users', { page }],
    queryFn: () => fetch(`/api/users?page=${page}`).then((r) => r.json()) as Promise<User[]>,
  });
}

function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: User['role'] }) =>
      fetch(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

    // onQueryStarted's dispatch+updateQueryData -> onMutate's queryClient.setQueryData,
    // same 3-step shape: cancel in-flight refetches, snapshot, apply optimistically
    onMutate: async ({ id, role }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousUsers = queryClient.getQueryData<User[]>(['users', { page: 1 }]);

      queryClient.setQueryData<User[]>(['users', { page: 1 }], (old) =>
        old?.map((u) => (u.id === id ? { ...u, role } : u))
      );

      return { previousUsers }; // -> onError's `context` parameter, same pattern as RTK's patchResult
    },

    // patchResult.undo() -> restoring the snapshot directly
    onError: (err, variables, context) => {
      queryClient.setQueryData(['users', { page: 1 }], context?.previousUsers);
    },

    // invalidatesTags: [{ type: 'User', id }] -> invalidateQueries with the SAME key prefix
    // used by useUsers above — this is what actually connects the mutation back to the query
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming `providesTags`' `'LIST'` Pseudo-Tag Needs a Direct Equivalent
There's no dedicated "list tag" concept in TanStack Query, and none is needed — a hierarchical `queryKey` like `['users', { page: 1 }]` already lets `invalidateQueries({ queryKey: ['users'] })` match every page/filter variant via simple array-prefix matching. Looking for a literal `'LIST'`-shaped construct during migration is solving a problem TanStack Query's key structure already solves differently.

### ⚠️ Pitfall 2: Forgetting `mutationFn` Doesn't Auto-Parse JSON or Throw on Non-2xx
```typescript
// ❌ WRONG: fetchBaseQuery (RTK Query's default) auto-throws on non-2xx and returns parsed JSON —
// plain fetch() does NEITHER. A 404/500 response resolves normally (no thrown error) unless
// checked explicitly, and .json() is never called
mutationFn: ({ id, role }) => fetch(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

// ✅ CORRECT: replicate fetchBaseQuery's behavior explicitly, since plain fetch() doesn't do it
mutationFn: async ({ id, role }) => {
  const res = await fetch(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`); // onError only fires on a THROWN error
  return res.json();
},
```

### ⚠️ Pitfall 3: Migrating Endpoint-by-Endpoint Without Deciding Where the QueryClient Lives
Unlike RTK Query (whose cache is automatically part of whatever `configureStore` already wires up), TanStack Query needs an explicit `new QueryClient()` + `<QueryClientProvider>` added to the app root BEFORE the first migrated endpoint can work at all — this is a one-time setup step, easy to forget is even necessary when thinking of the migration as "just converting endpoints one by one."

### ⚠️ Pitfall 4: Keeping the Whole Redux Store "Just in Case" After Migrating All Server State
Once every `createApi` endpoint is migrated, audit what's actually LEFT in the Redux store — per the scenario above, it's often almost entirely what RTK Query itself was managing, with only a small slice of genuine client-only UI state remaining. That remainder is frequently simple enough for `useState`/Context/a lightweight store, and keeping Redux configured (store setup, Provider, middleware, the `react-redux` dependency) purely out of inertia for a handful of booleans is unnecessary ongoing complexity the migration was actually an opportunity to remove.
