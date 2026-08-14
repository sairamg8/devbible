---
title: "Optimistic Updates Patterns: List vs Single-Item Rollback & Race Conditions"
sidebar_label: "Optimistic Updates Patterns"
sidebar_position: 1
---

# 🔄 Optimistic Updates Patterns: List vs Single-Item Rollback & Race Conditions

## 1. Under-The-Hood Mechanics

Building on the [useMutation lifecycle basics](../05-usemutation/01-mutation-lifecycle.md), real-world optimistic updates need to handle two additional layers of complexity: rolling back the **correct shape** of data (a single item vs an item within a list), and races between an optimistic mutation and a concurrent background refetch.

```
Single-item optimistic update:
  snapshot = getQueryData(['post', id])           ──► ONE object
  setQueryData(['post', id], optimisticVersion)
  onError: setQueryData(['post', id], snapshot)      ──► restore the WHOLE object directly

List-based optimistic update:
  snapshot = getQueryData(['posts', 'list'])         ──► an ARRAY
  setQueryData(['posts', 'list'], (old) => old.map(p => p.id === id ? optimisticVersion : p))
  onError: setQueryData(['posts', 'list'], snapshot)    ──► restore the WHOLE array, not just one item's patch
```

### The Race Between an Optimistic Mutation and a Concurrent Background Refetch
If a background refetch (triggered by window focus, or `refetchInterval`) resolves **between** `onMutate`'s optimistic write and the mutation's own actual completion, that refetch's result can silently overwrite the optimistic change with pre-mutation server data — the exact race condition covered briefly in the [useMutation doc](../05-usemutation/01-mutation-lifecycle.md), solved by calling `queryClient.cancelQueries()` for the affected key at the very start of `onMutate`, before applying any optimistic write.

### Typing `onMutate`'s Returned Context for Safe Rollback
```typescript
useMutation<Response, Error, Variables, { previousList: Post[] | undefined }>({
  onMutate: async (variables) => {
    const previousList = queryClient.getQueryData<Post[]>(['posts', 'list']);
    // ...
    return { previousList }; // typed context — onError's `context` parameter is correctly typed too
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['posts', 'list'], context?.previousList); // TYPE-SAFE access to the snapshot
  },
});
```
Explicitly typing the mutation's generic parameters (particularly the fourth, the `context` type) gives full TypeScript safety for the snapshot-and-restore pattern — `context?.previousList` is correctly typed, catching a mismatch (wrong shape, wrong key) at compile time rather than as a runtime surprise during an actual rollback.

---

## 2. Real-World Engineering Scenario

**Scenario**: An Optimistic "Delete" Silently Undone by a Concurrent Background Refetch, Fixed by Cancelling In-Flight Queries First.
A "delete comment" feature optimistically removed a comment from the cached list the instant a user clicked delete — but occasionally, a background refetch (triggered by the user having just switched back to the tab, firing a focus-based refetch at nearly the same moment) resolved with the OLD list (including the comment the user had just "deleted") and overwrote the optimistic removal, making the deleted comment briefly reappear before the actual DELETE request's own completion corrected it again — a confusing flicker. Adding `await queryClient.cancelQueries({ queryKey: ['comments'] })` at the very start of `onMutate` eliminated the race entirely: any in-flight background refetch for that key was cancelled before the optimistic update applied, guaranteeing no stale concurrent response could ever clobber it.

---

## 3. Production-Grade Code Example

```typescript
// List-based optimistic delete, with proper cancellation and TYPED rollback context
interface Comment { id: string; text: string; }

function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previousComments: Comment[] | undefined }>({
    mutationFn: (commentId: string) => api.delete(`/comments/${commentId}`),

    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] }); // eliminate the refetch race FIRST

      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]);

      queryClient.setQueryData<Comment[]>(['comments', postId], (old) =>
        old?.filter((c) => c.id !== commentId)
      );

      return { previousComments }; // TYPED — matches the mutation's declared context type
    },

    onError: (err, commentId, context) => {
      // context is correctly typed as { previousComments: Comment[] | undefined } | undefined
      queryClient.setQueryData(['comments', postId], context?.previousComments);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] }); // reconcile with real server state either way
    },
  });
}
```

```typescript
// Single-item optimistic update — a different shape, same cancellation discipline
function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, Partial<Profile>, { previousProfile: Profile | undefined }>({
    mutationFn: (updates) => api.patch('/profile', updates),

    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] });
      const previousProfile = queryClient.getQueryData<Profile>(['profile']);
      queryClient.setQueryData<Profile>(['profile'], (old) => (old ? { ...old, ...updates } : old));
      return { previousProfile };
    },

    onError: (err, updates, context) => {
      queryClient.setQueryData(['profile'], context?.previousProfile);
    },
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Restoring Only a Partial Patch Instead of the Full Snapshot on Rollback
```typescript
// ❌ WRONG: attempting to "undo" the specific optimistic change rather than restoring the
// FULL previous snapshot can produce incorrect results if OTHER changes happened to the
// cache between the optimistic write and the rollback
onError: (err, commentId) => {
  queryClient.setQueryData(['comments', postId], (current) => [...current, deletedCommentGuess]); // ❌ guessing, not restoring

// ✅ CORRECT: always restore the EXACT snapshot captured in onMutate, not a reconstructed guess
onError: (err, commentId, context) => {
  queryClient.setQueryData(['comments', postId], context?.previousComments);
},
```

### ⚠️ Pitfall 2: Skipping `cancelQueries()`, Reintroducing the Background-Refetch Race
As shown in the scenario above, omitting `cancelQueries()` at the start of `onMutate` leaves a window where a concurrent background refetch can silently clobber the optimistic update — this is easy to miss in initial development (since the race only manifests under specific timing conditions) and often first surfaces as a confusing, hard-to-reproduce flicker bug reported by real users, not something caught in casual manual testing.

### ⚠️ Pitfall 3: Leaving the Mutation's Generic Type Parameters Untyped, Losing Rollback Type Safety
```typescript
// ❌ RISKY: without explicit generics, `context` in onError types as `unknown` (or `any`),
// silently losing compile-time verification that the rollback code accesses the CORRECT shape
useMutation({
  onMutate: async () => { return { previousComments: [...] }; },
  onError: (err, vars, context) => {
    queryClient.setQueryData(['comments'], context.previosComments); // ❌ TYPO — no compile error without proper typing!
  },
});

// ✅ CORRECT: explicit generics catch this typo at COMPILE time, not as a silent runtime rollback failure
useMutation<void, Error, string, { previousComments: Comment[] }>({ /* ... */ });
```
