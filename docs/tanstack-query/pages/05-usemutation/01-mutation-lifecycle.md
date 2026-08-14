---
title: "`useMutation`: Lifecycle Callbacks, Optimistic Updates & `mutate` vs `mutateAsync`"
sidebar_label: "`useMutation`"
sidebar_position: 1
---

# 🔄 `useMutation`: Lifecycle Callbacks, Optimistic Updates & `mutate` vs `mutateAsync`

## 1. Under-The-Hood Mechanics

`useMutation` models a write operation's full lifecycle through four distinct callback hooks, each firing at a specific, well-defined moment — understanding this sequence is what makes the optimistic-update pattern (the most common reason to reach for these callbacks at all) correct rather than buggy.

```
mutate(variables)
        │
        ▼
onMutate(variables)   ──► fires BEFORE the actual mutationFn runs — the place to apply an
        │                    OPTIMISTIC cache update, and to SNAPSHOT the previous state for rollback
        ▼
mutationFn(variables)   ──► the actual async write operation (the real API call)
        │
        ├── SUCCESS ──► onSuccess(data, variables, context)   ──► sync REAL server response into cache
        │
        └── FAILURE ──► onError(error, variables, context)      ──► ROLL BACK using the onMutate snapshot
        │
        ▼
onSettled(data, error, variables, context)   ──► fires EITHER WAY (success or failure) — the
                                                    place for cleanup/final invalidation, regardless of outcome
```

### The Optimistic Update Pattern, Precisely
1. `onMutate`: snapshot the current cache state (via `getQueryData`), then apply the assumed-successful change (via `setQueryData`) — the UI updates **instantly**, before the network request even resolves.
2. If the mutation succeeds: `onSuccess` can sync the real server response into the cache (replacing the optimistic guess with actual truth), or simply rely on the optimistic update already being correct.
3. If the mutation fails: `onError` uses the snapshot **returned from `onMutate`** (passed as its third argument, `context`) to restore the cache to its pre-optimistic state — undoing the assumed change that turned out to be wrong.

### `mutate()` vs `mutateAsync()`: Fire-and-Forget vs Awaitable
`mutate()` triggers the mutation and returns `void` immediately — errors are handled via the `onError` callback, not a catchable promise rejection. `mutateAsync()` returns the actual Promise, awaitable and rejectable — necessary when calling code needs to **sequence** logic after the mutation resolves (e.g. `await mutateAsync(...); navigate('/success')`), which `mutate()`'s fire-and-forget style doesn't support directly.

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
      const previousPost = queryClient.getQueryData(['post', postId]); // SNAPSHOT before the optimistic change

      queryClient.setQueryData(['post', postId], (old: Post) => ({
        ...old,
        likes: old.likes + 1,
        likedByMe: true,
      }));

      return { previousPost }; // passed as `context` to onError/onSettled below
    },

    onError: (err, postId, context) => {
      // ROLL BACK using the snapshot — undoing the optimistic guess that turned out wrong
      queryClient.setQueryData(['post', postId], context.previousPost);
    },

    onSettled: (data, error, postId) => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] }); // sync with REAL server state either way
    },
  });
}
```

```tsx
// mutate() — fire-and-forget, error handling via onError, appropriate for the like button
function LikeButton({ postId }: { postId: string }) {
  const { mutate: likePost } = useLikePost();
  return <button onClick={() => likePost(postId)}>❤️ Like</button>; // don't need to await this
}
```

```tsx
// mutateAsync() — awaitable, needed when subsequent logic depends on the mutation's outcome
function CheckoutButton() {
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const navigate = useNavigate();

  async function handleCheckout() {
    try {
      const order = await submitOrder({ items: cartItems }); // MUST await — need the result to navigate correctly
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
// ❌ RACE CONDITION: if a background refetch is ALREADY in flight when onMutate applies
// the optimistic update, that refetch can resolve AFTER the optimistic write, silently
// OVERWRITING the optimistic change with stale pre-mutation data
onMutate: async (postId) => {
  const previous = queryClient.getQueryData(['post', postId]);
  queryClient.setQueryData(['post', postId], (old) => ({ ...old, likes: old.likes + 1 }));
  return { previous };
  // missing cancelQueries — a concurrent background refetch can clobber this optimistic write
},

// ✅ CORRECT: cancel any in-flight query for this key FIRST, avoiding the race entirely
onMutate: async (postId) => {
  await queryClient.cancelQueries({ queryKey: ['post', postId] });
  // ... proceed with the optimistic update safely
},
```

### ⚠️ Pitfall 2: Using `mutate()` When the Calling Code Needs to Await the Result
```typescript
// ❌ WRONG: mutate() returns void immediately — code AFTER this line runs before the
// mutation has actually resolved, regardless of success/failure
mutate(orderData);
navigate('/confirmation'); // ❌ navigates IMMEDIATELY, possibly before the order was even created

// ✅ CORRECT: mutateAsync() when subsequent logic genuinely depends on the mutation's outcome
await mutateAsync(orderData);
navigate('/confirmation'); // only runs AFTER the mutation has actually resolved
```

### ⚠️ Pitfall 3: Forgetting `onError`'s Rollback, Leaving the Cache Permanently Wrong After a Failure
```typescript
// ❌ INCOMPLETE: applies an optimistic update in onMutate, but has NO onError handler at all —
// if the mutation fails, the cache PERMANENTLY reflects the incorrect optimistic guess,
// with no mechanism ever correcting it back to the true, pre-mutation state
onMutate: async (postId) => {
  queryClient.setQueryData(['post', postId], (old) => ({ ...old, likes: old.likes + 1 }));
  // no snapshot returned, no onError defined — a failure leaves the cache PERMANENTLY wrong
},

// ✅ CORRECT: every optimistic onMutate needs a corresponding onError performing the rollback,
// using a snapshot captured BEFORE the optimistic change was applied
```
