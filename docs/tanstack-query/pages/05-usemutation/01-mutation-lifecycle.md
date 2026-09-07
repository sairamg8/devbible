---
title: "`useMutation`: Lifecycle Callbacks, Optimistic Updates & `mutate` vs `mutateAsync`"
sidebar_label: "`useMutation`"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Mutations (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/mutations), [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 `useMutation`: Lifecycle Callbacks, Optimistic Updates & `mutate` vs `mutateAsync`

## 1. Under-The-Hood Mechanics

`useMutation` models a write operation's full lifecycle through four distinct callback hooks, each firing at a specific, well-defined moment — understanding this sequence is what makes the optimistic-update pattern (the most common reason to reach for these callbacks at all) correct rather than buggy.

```
mutate(variables)
        │
        ▼
onMutate(variables, context)   ──► fires BEFORE the mutationFn runs — apply the OPTIMISTIC
        │                            cache write here, and SNAPSHOT the previous state.
        │                            WHATEVER IT RETURNS becomes `onMutateResult` below.
        ▼
mutationFn(variables)   ──► the actual async write (the real API call)
        │
        ├── SUCCESS ──► onSuccess(data, variables, onMutateResult, context)
        │
        └── FAILURE ──► onError(error, variables, onMutateResult, context)   ──► ROLL BACK
        │
        ▼
onSettled(data, error, variables, onMutateResult, context)   ──► fires EITHER WAY — final
                                                                  invalidation and cleanup
```

### 🔴 The third argument is `onMutateResult`, not `context`

This is the shape the reference prints, on both the `latest` and the version-pinned `v5` doc paths:

> *"`onMutate: (variables, context) => { ... }`, `onError: (error, variables, onMutateResult, context) => { ... }`, `onSuccess: (data, variables, onMutateResult, context) => { ... }`, `onSettled: (data, error, variables, onMutateResult, context) => { ... }`"*

Older material — and a great deal of blog code — calls the third positional parameter `context`, because that is what it used to be named. **Position has not changed, so that code still runs.** What changed is that `context` now names a *fourth* parameter, a `MutationFunctionContext` whose `client` property is the `QueryClient` itself. That makes the old naming worse than merely dated: `context.previousTodo` reads plausibly and is now reaching into the wrong object.

Of `onMutate`'s return value the guide says only:

> *"Optionally return a result containing data to use when for example rolling back"*

**Optionally** is load-bearing. The typed signature is `onMutateResult: TOnMutateResult | undefined`, so a handler that dereferences it without a guard throws *inside your error handler*.

### The Optimistic Update Pattern, Precisely
1. `onMutate`: cancel in-flight refetches, snapshot the current cache state (via `getQueryData`), then apply the assumed-successful change (via `setQueryData`) — the UI updates **instantly**, before the network request resolves. Return the snapshot.
2. On success: `onSuccess` can sync the real server response into the cache, or simply rely on the optimistic value already being correct.
3. On failure: `onError` restores the snapshot it receives as `onMutateResult`, undoing the change that turned out to be wrong.

### `mutate()` vs `mutateAsync()`: Fire-and-Forget vs Awaitable
`mutate()` triggers the mutation and returns `void` immediately — errors surface through `onError`, not as a catchable rejection. The docs put the alternative plainly: *"Use `mutateAsync` instead of `mutate` to get a promise which will resolve on success or throw on an error"* — which is what you need to **sequence** work after the write, and which also means the rejection is now yours to catch.

---

## 2. Real-World Engineering Scenario

**Scenario**: An Instant-Feeling "Like" Button That Correctly Reverts on a Rare Server Rejection.
A social feed's "like" button needed to feel instantaneous — incrementing the like count the moment a user clicks, not after a network round-trip. Using `onMutate` to optimistically increment the cached count and snapshot the previous value, the button felt instant for the overwhelming majority of successful requests. On the rare occasion the server rejected the like (a race condition, a since-deleted post), `onError` restored the exact snapshotted previous count — the user briefly saw the optimistic increment, then a correct, non-confusing reversion, rather than either a laggy "wait for the server" experience or a permanently-wrong count if the failure case had been left unhandled.

---

## 3. Production-Grade Code Example

```typescript
// The full optimistic update lifecycle, precisely sequenced
function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => api.post(`/posts/${postId}/like`),

    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] }); // avoid a race with an in-flight refetch
      const previousPost = queryClient.getQueryData<Post>(['post', postId]); // SNAPSHOT first

      // the updater is handed `Post | undefined` — the query may not exist yet
      queryClient.setQueryData<Post>(['post', postId], (old) =>
        old ? { ...old, likes: old.likes + 1, likedByMe: true } : old,
      );

      return { previousPost }; // becomes `onMutateResult` in the callbacks below
    },

    onError: (err, postId, onMutateResult) => {
      if (!onMutateResult) return; // onMutate may have thrown before returning
      queryClient.setQueryData(['post', postId], onMutateResult.previousPost);
    },

    // returning the promise keeps the mutation `pending` until the refetch settles
    onSettled: (data, error, postId) =>
      queryClient.invalidateQueries({ queryKey: ['post', postId] }),
  });
}
```

The fourth parameter removes the closure entirely — the docs' own example never calls `useQueryClient`, reaching the client through `context.client` instead:

```typescript
onMutate: async (newTodo, context) => {
  await context.client.cancelQueries({ queryKey: ['todos'] });
  const previousTodos = context.client.getQueryData(['todos']);
  context.client.setQueryData(['todos'], (old) => [...(old ?? []), newTodo]);
  return { previousTodos };
},
```

```tsx
// mutate() — fire-and-forget, error handling via onError, appropriate for the like button
function LikeButton({ postId }: { postId: string }) {
  const { mutate: likePost, isPending } = useLikePost();
  return <button disabled={isPending} onClick={() => likePost(postId)}>❤️ Like</button>;
}
```

```tsx
// mutateAsync() — awaitable, needed when subsequent logic depends on the outcome.
// The rejection is now YOURS: an uncaught one is an unhandled promise rejection.
function CheckoutButton() {
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const navigate = useNavigate();

  async function handleCheckout() {
    try {
      const order = await submitOrder({ items: cartItems }); // MUST await — need the result
      navigate(`/orders/${order.id}/confirmation`);
    } catch (err) {
      showErrorToast('Checkout failed');
    }
  }

  return <button onClick={handleCheckout}>Complete Purchase</button>;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting to Cancel In-Flight Queries Before an Optimistic Update
```typescript
// ❌ RACE CONDITION: a background refetch already in flight when onMutate writes can
// resolve AFTER the optimistic write, silently overwriting it with pre-mutation data
onMutate: async (postId) => {
  const previous = queryClient.getQueryData<Post>(['post', postId]);
  queryClient.setQueryData<Post>(['post', postId], (old) => old && { ...old, likes: old.likes + 1 });
  return { previous };
  // missing cancelQueries — a concurrent background refetch can clobber this write
},

// ✅ CORRECT: cancel in-flight queries for this key FIRST, and AWAIT it
onMutate: async (postId) => {
  await queryClient.cancelQueries({ queryKey: ['post', postId] });
  // ... proceed with the optimistic update safely
},
```
The docs annotate the same line in their own example: *"Cancel any outgoing refetches (so they don't overwrite our optimistic update)"*.

### ⚠️ Pitfall 2: Using `mutate()` When the Calling Code Needs to Await the Result
```typescript
// ❌ WRONG: mutate() returns void immediately — the next line runs before the
// mutation has resolved, regardless of success or failure
mutate(orderData);
navigate('/confirmation'); // ❌ navigates possibly before the order was created

// ✅ CORRECT: mutateAsync() when subsequent logic genuinely depends on the outcome
await mutateAsync(orderData);
navigate('/confirmation'); // only after the mutation has actually resolved
```

### ⚠️ Pitfall 3: An Optimistic `onMutate` With No Rollback
```typescript
// ❌ INCOMPLETE: optimistic write in onMutate, no snapshot returned, no onError —
// a failure leaves the cache PERMANENTLY holding the wrong value
onMutate: async (postId) => {
  queryClient.setQueryData<Post>(['post', postId], (old) => old && { ...old, likes: old.likes + 1 });
  // nothing returned, nothing to roll back to
},

// ✅ CORRECT: return the snapshot, and restore it in onError — guarded, because
// onMutateResult is typed `TOnMutateResult | undefined`
```

### ⚠️ Pitfall 4: Assuming a Failed Mutation Retried Itself
```typescript
// Queries retry 3 times by default. MUTATIONS DO NOT RETRY AT ALL.
useMutation({ mutationFn: submitOrder, retry: 2 }); // opt in explicitly, if it is idempotent
```

---

## Gotchas

**★ 🔴 Mutations are not retried, and queries are.** *"By default, TanStack Query will not retry a mutation on error"* — against Important Defaults for queries: *"Queries that fail are silently retried 3 times, with exponential backoff delay"*. The asymmetry is deliberate and correct: a retried `POST /orders` on a non-idempotent endpoint places two orders. It is still the single most common wrong assumption carried over from query code, and it shows up as "the write fails on flaky wifi and the read never does". Opt in with `retry` only where the endpoint is genuinely idempotent, or where the server takes an idempotency key.

**★ The callbacks you pass to `mutate()` are the ones that vanish.** A mutation has two places to hang side effects: the options object given to `useMutation`, and a second options object given to `mutate(variables, { onSuccess })`. They are not equivalent — *"those additional callbacks won't run if your component unmounts before the mutation finishes"*. So a redirect, a toast, or a cache write placed at the call site silently does not happen when the user navigates away mid-request, which is exactly when a slow mutation is most likely to be in flight. Anything that must happen belongs on the hook; the call site is for effects that are only meaningful while that component is still on screen.

**★ The `setQueryData` updater is handed `T | undefined`.** The reference is explicit that *"If the query does not exist, it will be created"*, so the updater has to survive there being nothing there. `(old) => ({ ...old, likes: old.likes + 1 })` type-checks under a loose annotation, passes every manual test where you visited the list first, and throws on the deep link that skipped it, or after the entry was garbage collected while a dialog stayed open.

**★ `onMutateResult` can be `undefined`, and the failure lands inside your error handler.** Its type is `TOnMutateResult | undefined`, and the guide says the return is *optional*. If `onMutate` throws — a `cancelQueries` rejection, a bad snapshot read — `onError` still fires, now with `undefined` in that slot. An unguarded `onMutateResult.previous` then throws while handling an error, which replaces a clean "mutation failed" path with an unhandled exception and no rollback.

**★ Rolling back to a snapshot you mutated in place restores nothing.** `getQueryData` hands back the live cached object. If your optimistic write mutates it rather than replacing it, `previousPost` and the current cache entry are the same object, so `onError` "restores" the value it was supposed to undo. Every write through `setQueryData` must return a new reference — which also happens to be what makes observers re-render.

**★ Return the promise from `onSettled` or the button stops too early.** The docs say to *"make sure to return the Promise from the query invalidation"*. Without it the mutation reaches `success` as soon as the write resolves, `isPending` flips false, the spinner stops — and the refetch that produces the *correct* number is still in flight. The user watches the value change twice.

**★ `mutateAsync` moves error handling to you.** `mutate` routes failures into `onError` and nothing rejects. `mutateAsync` *"will resolve on success or throw on error"*, so a bare `await mutateAsync(...)` in an event handler with no `try`/`catch` is an unhandled promise rejection. Reach for it when you need to sequence, not because it looks more modern.

**★ Two clicks run two mutations, in parallel, by default.** *"Per default, all mutations run in parallel — even if you invoke `.mutate()` of the same mutation multiple times."* For a like button that is harmless; for "save this document" it interleaves two writes against the same row. The fix in the library is `scope`: *"All mutations with the same `scope.id` will run in serial"*. Disabling the button on `isPending` handles the double-click, but not two components mutating the same resource.

**★ A mutation has no cache entry.** `useMutation` does not read or write the query cache on its own, has no `queryKey`, and nothing dedupes it. `mutationKey` exists for scoping defaults and for `useMutationState`, not for caching. Every piece of shared state a mutation produces gets into the cache because a callback of yours put it there.

---

## Interview questions

**★ Walk me through an optimistic update, and say which line each failure mode comes from.**
Four steps in `onMutate`: await `cancelQueries` on the key, snapshot with `getQueryData`, write the assumed value with `setQueryData`, and return the snapshot. Drop the cancel and an in-flight refetch resolves after your write and reverts it. Drop the return and `onError` has nothing to restore. Mutate the snapshot in place instead of replacing it and the rollback restores the mutated object. Forget `onSettled` and the cache keeps your guess rather than the server's truth. The pattern is small enough that each line maps to exactly one production bug.

**★ Why is `cancelQueries` awaited?**
Because the point is to be certain nothing is still running when `setQueryData` executes. `cancelQueries` returns a promise; not awaiting it means the optimistic write can land while a cancellation is still propagating, and a refetch that was already resolving can still deliver its payload afterwards. That reintroduces the exact race the call exists to remove, and it is intermittent, so it reads in a bug report as "sometimes the like count flickers back".

**★ A mutation fails on a flaky connection. How many times did it retry?**
Zero. *"By default, TanStack Query will not retry a mutation on error."* Queries retry three times with exponential backoff, and the difference catches people who learned the query defaults first. It is the right default, because retrying a non-idempotent write duplicates it — the retry decision belongs to whoever knows whether the endpoint is safe to call twice, which the library cannot know.

**★ A user submits a form and navigates away. The toast never fires. Why?**
Because the callback was passed to `mutate()` rather than to `useMutation`. *"Those additional callbacks won't run if your component unmounts before the mutation finishes."* The mutation itself completed — the write happened, the server has the data — but the component that owned the call-site callbacks was gone by then. Move anything that must run regardless (invalidation, analytics, a global toast) onto the hook's own options; leave only genuinely component-scoped effects at the call site.

**★ What is the third argument to `onError`, and what happens if you name it `context`?**
It is `onMutateResult` — whatever `onMutate` returned. Naming it `context` is the pre-rename convention and still *works*, because the position is unchanged, but `context` is now the fourth parameter: a `MutationFunctionContext` carrying `client`. So the two names now denote different objects, and code written against the old convention reads as though it is using the new API while doing something else. The give-away in a review is `context.previousTodo` — a property that exists on the third argument, never on the fourth.

**★ When do you reach for `mutateAsync` over `mutate`?**
When the calling code must sequence on the result — navigate to an id the server assigned, chain a second dependent write, or drive a wizard step. `mutate` returns `void`, so anything after it runs immediately. The cost is that `mutateAsync` *"will throw on an error"*, so you own the rejection; a bare await with no `try`/`catch` turns a handled mutation failure into an unhandled rejection. If you are not consuming the resolved value, `mutate` is the better default.

**★ Why should the `setQueryData` updater accept `undefined`?**
Because the query may not be in the cache. The reference notes *"If the query does not exist, it will be created"*, so the updater is invoked with `undefined` on a cold start, on a deep link that never rendered the list, and after garbage collection — inactive queries are collected after five minutes by default. `(old) => old ? {...} : old` skips the write when there is nothing to update, `(old = []) => [...]` seeds a list. Either is fine; dereferencing `old` unguarded is the version that ships and then throws on the path nobody clicked through in review.

**★ Two components both mutate the same resource. What does the library do?**
Runs both, concurrently — *"all mutations run in parallel"* — and does not dedupe them, because unlike queries a mutation has no key identifying it as "the same request". Ordering is therefore whatever the network gives you, and last-write-wins against the server. `scope` with a shared `id` is the built-in answer: *"All mutations with the same `scope.id` will run in serial."* Note that disabling the button on `isPending` only fixes the single-component case, which is why the bug survives the obvious fix.

**★ Where does the rollback value actually live between `onMutate` and `onError`?**
In the mutation instance, not in the cache and not in your component. `onMutate` returns it, the library holds it for the life of that mutation, and hands it to `onSuccess`, `onError` and `onSettled` as `onMutateResult`. That is why the pattern survives a re-render, and why the value must be a snapshot rather than a reference into the cache — the cache is going to change underneath it, which is the whole point of the optimistic write.
