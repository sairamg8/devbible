---
title: "Optimistic and manual cache updates: patching the cache before the server answers"
sidebar_label: "Optimistic & manual cache updates"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [manual cache updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates),
> [optimistic updates](https://redux-toolkit.js.org/rtk-query/usage/optimistic-updates).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Optimistic & Manual Cache Updates

**Tag invalidation is a round trip.** The mutation goes out, the server answers, the invalidated query
refetches, and only then does the screen change — three network legs before a toggle switch moves. For
anything the user expects to feel instant, you patch the cache yourself and reconcile afterwards. This
is the part of RTK Query people reach for last and get wrong most often.

## 1. Under-The-Hood Mechanics

### `onQueryStarted` — the mutation lifecycle hook

Every endpoint can declare `onQueryStarted(arg, api)`, which runs as the request begins. Its `api`
carries `dispatch`, `getState`, and — the one that matters here — **`queryFulfilled`**, a promise that
resolves when this endpoint's own request succeeds and rejects when it fails.

That gives you a before and an after in one function, which is the whole shape of an optimistic update:

1. `dispatch(api.util.updateQueryData(endpointName, cacheKeyArg, recipe))` **before** awaiting anything.
   This synchronously patches the cached data through an Immer draft — mutate it exactly as you would a
   reducer — and returns a `patchResult` handle.
2. `await queryFulfilled`.
3. On rejection, `patchResult.undo()` inside a `catch`. This reverts **exactly the patch you applied**,
   not a blind refetch, so it composes correctly even if other patches touched the same entry meanwhile.

### `updateQueryData` versus `upsertQueryData`

🔴 **These are not interchangeable, and the difference is the single most common source of "my
optimistic update does nothing".**

| | `updateQueryData` | `upsertQueryData` |
|---|---|---|
| Docs describe it as | "strictly intended to perform *updates* to existing cache entries, not create new entries" | "intended to perform *replacements* to existing cache entries or *creation* of new ones" |
| If the entry is not cached | **does nothing, silently** | creates it |
| Shape of the change | a patch, via an Immer recipe | a full replacement value |
| Undoable | yes — returns `patchResult` with `.undo()` | no patch handle |

`updateQueryData` targets one entry by `(endpointName, cacheKeyArg)`, and the cache key must match
**exactly** — `{ page: 1 }` does not patch the entry for `{ page: 2 }`. That is why an optimistic
update written against a hard-coded argument works during development, when you are always on page one,
and quietly stops working for real users.

### Pessimistic updates — the same hook, after the fact

The same `onQueryStarted` shape covers the opposite strategy: wait for the server, then write its
authoritative response into the cache without a refetch.

```typescript
async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
  const { data: updated } = await queryFulfilled;          // server's version wins
  dispatch(usersApi.util.upsertQueryData('getUserById', id, updated));
}
```
This costs one round trip instead of two — the mutation, then no invalidation refetch — while never
showing the user a value the server has not confirmed.

## 2. Real-World Engineering Scenario

**Scenario**: A Role Dropdown in an Admin Table That Must Not Flicker.
An admin changes a user's role from a detail modal while a paginated table is mounted behind it. With
tag invalidation alone, the dropdown snaps back to the old value for the ~400ms until the PATCH resolves
and `getUsers` refetches — which reads as a bug even though it is correct. The optimistic patch makes the
change appear immediately; `invalidatesTags` still runs afterwards as the reconciliation step, so the
server remains the source of truth. If the PATCH fails, `undo()` puts the old role back precisely, rather
than refetching and hoping nothing else changed in between.

## 3. Production-Grade Code Example

```typescript
updateUserRole: builder.mutation<User, { id: string; role: User['role'] }>({
  query: ({ id, role }) => ({ url: `/users/${id}/role`, method: 'PATCH', body: { role } }),

  // Still invalidate on success — this is the source-of-truth reconciliation;
  // the patch below only covers the INSTANT before that response arrives
  invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],

  async onQueryStarted({ id, role }, { dispatch, queryFulfilled, getState }) {
    // Patch EVERY cached page that happens to contain this user, not a hard-coded page: 1.
    // selectInvalidatedBy tells us which entries actually hold the tag we are about to change.
    const patches = usersApi.util
      .selectInvalidatedBy(getState(), [{ type: 'User', id }])
      .filter((entry) => entry.endpointName === 'getUsers')
      .map((entry) =>
        dispatch(
          usersApi.util.updateQueryData('getUsers', entry.originalArgs, (draft) => {
            const user = draft.find((u) => u.id === id);
            if (user) user.role = role;   // Immer draft — mutate directly, no spread needed
          }),
        ),
      );

    try {
      await queryFulfilled;               // wait for the actual PATCH request to settle
    } catch {
      patches.forEach((p) => p.undo());   // server rejected it — revert every patch exactly
    }
  },
}),
```

## Gotchas

### Patching a cache key that is not cached
**Symptom.** The optimistic update works locally and does nothing in production — or works on page 1
and nowhere else.
**Cause.** `updateQueryData` is documented as updating existing entries only; given an argument with no
cache entry it does nothing and reports nothing.
**Fix.** Never hard-code the cache key. Derive the entries that actually hold the data with
`api.util.selectInvalidatedBy(state, tags)` as above, or use `upsertQueryData` when creating the entry
is the intent.

### No `try`/`catch`, so the patch is never undone
**Symptom.** A failed save leaves the wrong value on screen indefinitely — until something else happens
to refetch that entry.
**Cause.** `await queryFulfilled` rejects on failure. Without a `catch`, the function throws and
`undo()` never runs.
**Fix.**
```typescript
// ❌ WRONG: no try/catch — if the PATCH request fails, the optimistic edit stays in the
// cache FOREVER (until the next real refetch), showing the user a role change that never happened
async onQueryStarted({ id, role }, { dispatch, queryFulfilled }) {
  dispatch(usersApi.util.updateQueryData('getUsers', { page: 1 }, (draft) => { /* … */ }));
  await queryFulfilled; // if this rejects, the function just throws — patch is never undone
}

// ✅ CORRECT: capture the patch handle, undo() it in a catch — see the full example above
```

### `await`-ing something before applying the patch
**Symptom.** A visible flicker, or an update that is not optimistic at all.
**Cause.** Anything awaited before the `dispatch` delays the patch past the point of it being instant —
and if you await `queryFulfilled` first, the patch lands after the response it was meant to precede.
**Fix.** Dispatch the patch on the **first** line of `onQueryStarted`, then await.

### Refetching instead of `undo()` on failure
**Symptom.** A rollback that also discards an unrelated change someone else made in the meantime.
**Cause.** `invalidateTags` or a manual refetch replaces the whole entry with whatever the server has
now, which is not the same as reversing your patch.
**Fix.** `patchResult.undo()` reverses exactly the patch that was applied and leaves other patches to
the same entry intact. That is the entire reason a handle is returned rather than a boolean.

### Dropping `invalidatesTags` because the optimistic patch "already did it"
**Symptom.** The UI drifts from the server over a session — computed fields, server-side timestamps and
derived values stay at whatever the client guessed.
**Cause.** The patch is a guess about what the server will do. It is right about the field you changed
and silent about everything the server changes in response.
**Fix.** Keep both. The patch covers the latency; the invalidation is the reconciliation. Drop the
invalidation only when you deliberately choose the pessimistic shape and write the server's own response
into the cache with `upsertQueryData`.

### Reaching for `upsertQueryData` to make a small edit
**Symptom.** Unrelated fields reset, or a partially-populated entry replaces a complete one.
**Cause.** `upsertQueryData` performs a **replacement**, not a patch. Whatever you pass becomes the
entry.
**Fix.** `updateQueryData` for edits to part of an entry; `upsertQueryData` when you hold the complete,
authoritative value — typically a server response you are seeding into the cache.

## Interview questions

**★ Walk me through an optimistic update in RTK Query.**
Inside the mutation's `onQueryStarted`, dispatch `api.util.updateQueryData(endpoint, cacheKey, recipe)`
as the first statement — it patches the cached data synchronously through an Immer draft and returns a
patch handle. Then `await queryFulfilled`, which resolves when this mutation's request succeeds. In the
`catch`, call `patchResult.undo()`. Keep `invalidatesTags` as well: the patch hides the latency, the
invalidation reconciles with the server.

**★ Why `undo()` rather than just refetching on failure?**
Because `undo()` reverses precisely the patch you applied, leaving any other patches to the same entry
in place, and costs no network. A refetch replaces the entire entry with the server's current state,
which discards concurrent changes and takes a round trip to fix a problem you already know the answer to.

**★ What is the difference between `updateQueryData` and `upsertQueryData`?**
`updateQueryData` patches an entry that already exists and does nothing at all if it does not — the docs
call it "strictly intended to perform updates to existing cache entries". `upsertQueryData` replaces an
existing entry or creates a missing one, taking a whole value rather than a recipe, and gives you no undo
handle. Patch with the first, seed with the second.

**Your optimistic update works in development and not in production. First hypothesis?**
A hard-coded cache key. `updateQueryData('getUsers', { page: 1 }, …)` patches exactly the `{ page: 1 }`
entry; a user on page 3 has no such entry in view, and the call fails silently because updating a
non-existent entry is a documented no-op. The fix is to derive the affected entries — `selectInvalidatedBy`
with the tag you are changing — instead of guessing the argument.

**When would you choose a pessimistic update instead?**
When showing an unconfirmed value is worse than waiting — money, permissions, anything with server-side
validation that can legitimately reject. The shape is the same hook: `await queryFulfilled` first, then
write the server's own response into the cache with `upsertQueryData`. You still save the invalidation
refetch, so it costs one round trip rather than two, while never displaying a value the server has not
agreed to.

---

← [RTK Query Cache](./02-cache-management-and-invalidation.md) · [Topic index](../README.md) · Next → [`createSelector`](../05-selectors-and-normalization/01-create-selector-and-reselect.md)
