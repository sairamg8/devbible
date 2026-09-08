---
title: "Porting a mutation is easy until the rollback: RTK Query undoes an inverse patch, TanStack Query restores a snapshot, and those two are not the same operation when writes overlap"
sidebar_label: "01d · Mutations & rollback"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations) (v5-pinned path), [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) — and this corpus's validated [RTK optimistic-update page](../../../redux-toolkit/pages/04-rtk-query/02b-optimistic-and-manual-cache-updates.md). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8** · **@reduxjs/toolkit 2.12.0**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# ✍️ Mutations: The Trigger Ports Cleanly, The Rollback Does Not

**`builder.mutation` → `useMutation` is close to a rename. `onQueryStarted` + `queryFulfilled` → `onMutate`/`onError`/`onSettled` is close to a rename. The part that is not a rename is what "undo" means: RTK Query hands you a `patchResult` whose `.undo()` reverses *exactly the patch you applied*, and TanStack Query hands you nothing — you snapshot the previous value yourself and write the whole thing back.** For a single in-flight mutation those are indistinguishable. For two overlapping mutations on the same key they are not, and the failure is a resurrected stale value that no test with one mutation will ever catch.

## 1. The call-site shape

```tsx
// RTK Query — a tuple: [trigger, result]
const [updateUser, { isLoading: isSaving, error }] = useUpdateUserMutation();
await updateUser({ id, role }).unwrap();     // .unwrap() to get a throwing promise
```

```tsx
// TanStack Query — an object, and two ways to call it
const { mutate, mutateAsync, isPending, error } = useMutation({
  mutationFn: (vars: { id: string; role: Role }) =>
    http<User>(`/users/${vars.id}`, { method: 'PATCH', body: JSON.stringify(vars) }),
});

mutate({ id, role });                        // fire-and-forget; errors land in `error`
await mutateAsync({ id, role });             // throwing promise — needs a catch
```

> *"Use `mutateAsync` instead of `mutate` to get a promise which will resolve on success or throw on an error"*

`.unwrap()` and `mutateAsync` are the same idea with the same hazard: both **reject**, so both need a `try`/`catch` or you get an unhandled rejection for an error the hook has already captured in `error`. Reach for `mutate` unless you genuinely need to sequence something after the write.

Two renames worth being deliberate about, because both compile silently either way:

| RTK Query mutation result | TanStack Query v5 |
|---|---|
| `isLoading` | **`isPending`** — `isLoading` does not exist on a mutation result |
| `isUninitialized` | `isIdle` / `status === 'idle'` |
| `reset()` | `reset()` ✅ |
| `originalArgs` | `variables` |
| `fixedCacheKey` (share one mutation's state across components) | no direct equivalent — see the gotcha below |

## 2. `onQueryStarted` becomes three callbacks, and the signatures are load-bearing

RTK Query puts one function on the endpoint and gives it a promise:

```typescript
// RTK Query — one hook, one promise, an inverse patch handle
updateUserRole: builder.mutation<User, { id: string; role: Role }>({
  query: ({ id, role }) => ({ url: `/users/${id}`, method: 'PATCH', body: { role } }),
  async onQueryStarted({ id, role }, { dispatch, queryFulfilled }) {
    const patch = dispatch(
      usersApi.util.updateQueryData('getUserById', id, (draft) => { draft.role = role; }),
    );
    try {
      await queryFulfilled;
    } catch {
      patch.undo();                    // reverses exactly this patch
    }
  },
}),
```

TanStack Query splits the lifecycle into named callbacks. The v5 signatures, verbatim from the mutations guide:

> ```
> onMutate: (variables, context) => { ... }
> onError: (error, variables, onMutateResult, context) => { ... }
> onSuccess: (data, variables, onMutateResult, context) => { ... }
> onSettled: (data, error, variables, onMutateResult, context) => { ... }
> ```
> *"Optionally return a result containing data to use when for example rolling back"*

🔴 **The third positional argument is `onMutateResult`, not `context`.** In v5 `context` is a *fourth* parameter carrying `context.client` — the `QueryClient`, reachable without `useQueryClient`. Older examples name the third argument `context`; the code still runs, because position did not change, but every doc sentence about `context` now means something else. And `onMutateResult` is optional: if `onMutate` throws before returning, `onError` receives `undefined` there, so `onMutateResult.previous` throws *inside your error handler*.

The full port of the RTK block above:

```typescript
const queryClient = useQueryClient();

useMutation({
  mutationFn: ({ id, role }: { id: string; role: Role }) =>
    http<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  onMutate: async ({ id, role }, context) => {
    // 1. "Cancel any outgoing refetches (so they don't overwrite our optimistic update)"
    await context.client.cancelQueries({ queryKey: userKeys.detail(id) });
    // 2. snapshot — this is the replacement for patchResult, and it is a WHOLE VALUE
    const previous = context.client.getQueryData<User>(userKeys.detail(id));
    // 3. write optimistically
    context.client.setQueryData<User>(userKeys.detail(id), (old) =>
      old ? { ...old, role } : old,
    );
    return { previous };                         // becomes onMutateResult
  },

  onError: (_err, { id }, onMutateResult, context) => {
    if (onMutateResult?.previous) {              // ⚠️ optional — onMutate may have thrown
      context.client.setQueryData(userKeys.detail(id), onMutateResult.previous);
    }
  },

  onSettled: (_data, _err, { id }, _onMutateResult, context) =>
    // return the promise so the mutation stays `pending` until the refetch lands
    context.client.invalidateQueries({ queryKey: userKeys.detail(id) }),
});
```

Two documented details in there that people drop:

> *"Cancel any outgoing refetches (so they don't overwrite our optimistic update)"*
> *"make sure to _return_ the Promise from the query invalidation"*

Without the `cancelQueries`, an in-flight GET that started before your optimistic write lands after it and overwrites the optimistic value with pre-mutation data. Without the returned promise, the mutation reports success while the refetch is still running, so a button re-enables and a modal closes over data that has not arrived.

## 3. 🔴 Inverse patch versus snapshot restore

This is the one semantic difference in the whole mutation port.

| | RTK Query | TanStack Query |
|---|---|---|
| What the optimistic write is | an Immer recipe producing forward + inverse patches | any value written with `setQueryData` |
| What rollback does | applies the **inverse patch** — reverses your change only | writes back the **whole snapshotted value** |
| Two overlapping mutations on one key | each `undo()` reverses only its own field | the second rollback restores a snapshot taken *before the first* — the first mutation's success is erased |

Concretely: a row where mutation A sets `role` and mutation B sets `displayName`, both in flight. In RTK Query, B failing undoes B's patch and leaves A's optimistic role in place. In TanStack Query, B's `previous` snapshot was taken *after* A wrote, so restoring it is usually fine — but if B's `onMutate` ran *before* A's write landed, B's rollback restores a value that predates A entirely, and A's optimistic change disappears while A's request is still succeeding.

There is no library feature that fixes this; there are three honest strategies:

```typescript
// (a) Serialise same-entity mutations so they cannot overlap.
//     "All mutations with the same scope.id will run in serial"
useMutation({ mutationFn, scope: { id: `user-${id}` }, /* … */ });

// (b) Roll back a FIELD rather than a snapshot — the closest thing to undo().
onMutate: async ({ id, role }, context) => {
  await context.client.cancelQueries({ queryKey: userKeys.detail(id) });
  const previousRole = context.client.getQueryData<User>(userKeys.detail(id))?.role;
  context.client.setQueryData<User>(userKeys.detail(id), (old) => old && { ...old, role });
  return { previousRole };
},
onError: (_e, { id }, r, context) => {
  if (r?.previousRole !== undefined) {
    context.client.setQueryData<User>(userKeys.detail(id), (old) =>
      old && { ...old, role: r.previousRole },
    );
  }
},

// (c) Do not roll back at all — invalidate in onSettled and let the server decide.
//     Correct by construction, costs one request, and is the right default for
//     anything that is not a latency-critical toggle.
```

> *"Per default, all mutations run in parallel - even if you invoke `.mutate()` of the same mutation multiple times. Mutations can be given a `scope` with an `id` to avoid that. All mutations with the same `scope.id` will run in serial"*

## 4. `selectInvalidatedBy` has no direct counterpart

RTK Query's advanced pattern reads the tag index to find *which cached list entries actually contain the row being changed*, then patches each one. Keys carry no such index, so the equivalent is to enumerate matching entries by filter and patch each:

```typescript
onMutate: async ({ id, role }, context) => {
  await context.client.cancelQueries({ queryKey: userKeys.lists() });
  const snapshots = context.client.getQueriesData<User[]>({ queryKey: userKeys.lists() });
  for (const [key, list] of snapshots) {
    if (!list) continue;
    context.client.setQueryData<User[]>(
      key,
      list.map((u) => (u.id === id ? { ...u, role } : u)),
    );
  }
  return { snapshots };                     // array of [key, previousValue] pairs
},
onError: (_e, _v, r, context) => {
  r?.snapshots.forEach(([key, value]) => context.client.setQueryData(key, value));
},
```

⚠️ There is also `queryClient.setQueriesData(filters, updater)`, which collapses that loop into one call. **I could not re-confirm its documentation on 2026-09-08** — the `QueryClient` reference page has been intermittently returning `{"isNotFound":true}` during this pass. The `getQueriesData` + loop above uses only APIs quoted in this corpus's verified bank; if `setQueriesData` is present in the version you install, prefer it.

## Gotchas

**★ Symptom: two rapid edits to the same row, one fails, and the successful edit's change vanishes from the screen.** Cause: snapshot rollback, not patch rollback. The failing mutation's `onMutate` captured a whole-object snapshot that predates the other mutation's optimistic write, and `onError` writes that entire object back. RTK Query's `patch.undo()` could not do this because it applies an inverse patch scoped to the fields it changed. Fix: `scope: { id }` to serialise, or snapshot the single field you are changing, or drop optimism for that mutation and invalidate in `onSettled`.

**★ Symptom: the optimistic update flickers — the new value appears, then the old one, then the new one again.** Cause: a background refetch that was already in flight when `onMutate` ran resolved after your `setQueryData` and overwrote it, and the post-mutation invalidation then corrected it. Fix: `await context.client.cancelQueries({ queryKey })` as the first line of `onMutate`, exactly as the docs' own example does. It is the line most often dropped when porting, because `onQueryStarted` has no equivalent step.

**★ Symptom: an error inside `onError` — reading a property of `undefined` — masking the real mutation error.** Cause: `onMutateResult` is `TOnMutateResult | undefined`. If `onMutate` throws (a failed `cancelQueries`, a bad `getQueryData` cast) it never returns, and `onError` still runs with `undefined` in that slot. Fix: optional-chain it — `onMutateResult?.previous` — and treat "no snapshot" as "nothing to roll back", not as an impossible state.

**★ Symptom: the save button re-enables and the modal closes before the list has refreshed.** Cause: `onSettled` fired the invalidation without returning it, so the mutation transitioned out of `pending` immediately. The docs are explicit: *"make sure to _return_ the Promise from the query invalidation"*. Fix: `onSettled: (…) => context.client.invalidateQueries(…)` as an expression body, or an explicit `return`. An `async` `onSettled` with an un-awaited call has the same bug.

**★ Symptom: side effects that used to run reliably now skip when the user navigates away mid-request.** Cause: you ported `onQueryStarted` into the callbacks passed to `mutate()` rather than to `useMutation()`. Those are different: *"those additional callbacks won't run if your component unmounts _before_ the mutation finishes"*. `onQueryStarted` lived on the endpoint and had no component lifetime. Fix: cache writes, invalidations and rollbacks go on `useMutation`; only genuinely component-local reactions — closing this modal, focusing that input — go on the `mutate()` call.

**★ Symptom: `mutateAsync` produces an unhandled promise rejection in the console for an error you are already rendering.** Cause: `mutateAsync` rejects on failure — that is its entire difference from `mutate`. The hook captures the error into `error` regardless, so the rejection has no handler. Fix: use `mutate` unless you need to sequence work after the write; when you do need `mutateAsync`, wrap it in `try`/`catch`. Same trap as forgetting `.catch()` after RTK's `.unwrap()`.

**★ Symptom: `fixedCacheKey` has no equivalent, and a second component cannot see the first component's mutation state.** Cause: TanStack mutations are not keyed by argument and are not shared between `useMutation` calls; each call site gets its own observer. Fix: give the mutation a `mutationKey` and read the shared state with `useMutationState({ filters: { mutationKey } })`, or lift the mutation to a shared parent / custom hook. ⚠️ I could not re-confirm the `useMutationState` reference page on 2026-09-08 — verify the exact filter shape against the version you install; the lifting strategy needs no API at all.

**★ Symptom: the mutation's response contains the updated entity and you invalidate anyway, costing an extra round trip.** Cause: a literal port. RTK's `transformResponse` + tags made the refetch feel free. Fix: `onSuccess: (data, { id }, _r, context) => context.client.setQueryData(userKeys.detail(id), data)`, then invalidate only the lists. Write what the server returned, refetch only what you did not receive.

**★ Symptom: a mutation that failed silently retried under RTK now retries under TanStack, or vice versa, and nobody can remember which.** Cause: the defaults are asymmetric in the same direction in both libraries — *"By default, TanStack Query will not retry a mutation on error"* — but TanStack retries **queries** three times while RTK retries nothing without an explicit `retry()` wrapper. Fix: set both `queries.retry` and `mutations.retry` explicitly in `defaultOptions` during the migration so nobody has to remember.

**★ Symptom: an optimistic update writes to a key that does not exist yet and nothing appears.** Cause: in RTK, `updateQueryData` is documented as updating existing entries only, which is why `upsertQueryData` exists. Fix: in TanStack there is one method and it handles both — *"If the query does not exist, it will be created."* — but note the created entry has no `queryFn` attached until something observes that key, so writing to a key nobody renders just parks data in the cache until it is garbage collected.

## Interview questions

**★ RTK Query gives you `patchResult.undo()`. What is the TanStack Query equivalent, and where does the equivalence break?**
There is no equivalent operation; you emulate it by snapshotting the previous value in `onMutate` and writing it back in `onError`. The equivalence breaks under concurrency. `undo()` applies an *inverse patch*, so it reverses only the fields that mutation changed and leaves other in-flight optimistic writes intact. A snapshot restore writes back a whole value, so if a second mutation succeeded between the snapshot and the rollback, the rollback erases it. The mitigations are serialising with `scope: { id }`, snapshotting only the field you changed, or abandoning optimism for that mutation and letting an `onSettled` invalidation fetch the truth.

**★ Why is `await cancelQueries` the first line of `onMutate` in every documented example?**
Because a refetch that was already in flight when the mutation started will resolve *after* your optimistic `setQueryData` and overwrite it with pre-mutation data — the docs' own comment is *"Cancel any outgoing refetches (so they don't overwrite our optimistic update)"*. It is easy to drop when porting because `onQueryStarted` has no analogous step; RTK's ordering problem is the reverse one, where the patch must be dispatched before awaiting `queryFulfilled`.

**★ What is the difference between passing `onSuccess` to `useMutation` and passing it to `mutate()`?**
Lifetime. The callback on `useMutation` belongs to the mutation; the callback passed to `mutate()` belongs to the call, and the docs state that *"those additional callbacks won't run if your component unmounts before the mutation finishes"*. So cache invalidation, cache writes and rollbacks must live on the hook, or a user who navigates away during a slow request leaves the cache inconsistent. Only reactions that are meaningless once the component is gone — closing the dialog, toasting in this view — belong on the call. RTK Query's `onQueryStarted` sits on the endpoint and has no component lifetime at all, so this distinction has to be introduced deliberately during the port.

**★ Why does the third callback argument being renamed to `onMutateResult` matter if the position did not change?**
Because `context` now means something else in the same signature — it is the fourth parameter, a `MutationFunctionContext` carrying `context.client`, which is how the current examples reach the `QueryClient` without `useQueryClient`. Code written against the old naming still runs, but anyone reading the current documentation against that code will misread which parameter is which, and the two have opposite nullability: `context` is always present, `onMutateResult` is `undefined` whenever `onMutate` threw or returned nothing. That asymmetry is precisely where unguarded rollbacks throw inside the error handler.

**★ How do you translate `selectInvalidatedBy` plus a patch loop?**
By enumerating cache entries with `getQueriesData({ queryKey: prefix })`, patching each, and keeping the `[key, previousValue]` pairs as the rollback payload. The difference is that RTK is consulting a response-derived index — "which entries actually contain this row" — and you are consulting a key prefix, so you will patch lists that never contained the row. The patch is a no-op for those, but the snapshot array is larger and the rollback touches more entries. If that matters, the alternative is to stop patching lists optimistically and invalidate them in `onSettled` instead.

**Should the response of a mutation be written into the cache, or should you invalidate?**
Both, usually, and for different keys. If the server returns the updated entity, `setQueryData` it into the detail key in `onSuccess` — you already paid for that data. Then invalidate the list prefix, because you do not know whether the change affects ordering, filtering or pagination, and reconstructing that client-side is how caches drift. Invalidating everything is one wasted request; hand-computing the list is an ongoing correctness liability.

---

← [Endpoints → `queryOptions`](./01c-rtk-query-endpoints-to-query-options.md) · [Topic index](../README.md) · Next → [Running both caches at once](./01e-running-both-caches-at-once.md)
