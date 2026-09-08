---
title: "The rollback contract: onMutateResult is optional, the cache updater is handed undefined, and both of those detonate inside the error handler rather than in the happy path"
sidebar_label: "01 · The rollback contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Mutations (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/mutations), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**An optimistic update is a bet that the server will agree with you, and the rollback is the only part of it that ever runs under stress. [`05 · The mutation lifecycle`](../05-usemutation/01-mutation-lifecycle.md) establishes the four callbacks and the shape of the pattern. This page is about the contract underneath it — what the library actually guarantees about the value it hands back to `onError`, and the two type holes that turn a rollback into a second, worse failure: an exception thrown *inside* the error handler, where there is no `onError` left to catch it.**

## The signatures, printed, because three of the four changed name

This is the shape the mutations guide prints, on both the `latest` and the version-pinned `v5` doc paths:

> ```
> onMutate: (variables, context) => { ... }
> onError: (error, variables, onMutateResult, context) => { ... }
> onSuccess: (data, variables, onMutateResult, context) => { ... }
> onSettled: (data, error, variables, onMutateResult, context) => { ... }
> ```

Two things follow that most existing rollback code gets wrong.

**The third positional argument is `onMutateResult`.** `context` is now the *fourth* parameter — a `MutationFunctionContext` whose `client` is the `QueryClient`. Position did not change, so pre-rename code still runs; what changed is that `context.previousTodo` now reads as a plausible access on an object that has never had that property. `05` covers the rename. What `05` does not cover, and what this page is for, is the **generic slot** it corresponds to.

**`onMutate`'s return type is the fourth generic parameter of `useMutation`,** and it is the one nobody writes:

```typescript
// UseMutationOptions<TData, TError, TVariables, TOnMutateResult>
useMutation<Post, Error, string, { previousPost: Post | undefined }>({ /* … */ });
```

Left off, TypeScript infers it from whatever `onMutate` happens to return on the day you wrote it. That inference is real and it is usually right — which is exactly why the failure is late. Add a second `return` branch to `onMutate` (an early bail when there is nothing to snapshot) and the inferred type silently widens to a union; `onError` then accesses a property that exists on only one arm, and depending on your `strict` settings you get either a compile error in a file you did not touch or no error at all.

## Detonation 1 — `onMutateResult` is `TOnMutateResult | undefined`

The guide is deliberately soft about the return value:

> *"Optionally return a result containing data to use when for example rolling back"*

**Optionally.** The surfaced typed signature is `onMutateResult: TOnMutateResult | undefined`. That `undefined` is not defensive typing for the case where you forgot to return something — it is the case where **`onMutate` itself threw**.

`onMutate` is `async`. It awaits `cancelQueries`. It reads the cache. It runs whatever `structuredClone` or serialisation your snapshot needs. Any of those can throw, and if one does, the mutation fails and `onError` fires — with `undefined` in the third slot, because `onMutate` never reached its `return`.

```typescript
// ❌ The rollback becomes the crash. onMutate threw; onMutateResult is undefined;
// this line throws a TypeError while HANDLING an error, so there is no onError above
// it to catch it, no rollback happens, and the stack trace names the wrong file.
onError: (err, postId, onMutateResult) => {
  queryClient.setQueryData(['post', postId], onMutateResult.previousPost);
},

// ✅ Guard first, and return — there is genuinely nothing to roll back to.
onError: (err, postId, onMutateResult) => {
  if (!onMutateResult) return;
  queryClient.setQueryData(['post', postId], onMutateResult.previousPost);
},
```

The `if (!onMutateResult) return` is not a courtesy. When `onMutate` threw before writing anything, the cache was never touched, so *doing nothing is the correct rollback.* When it threw after writing but before returning — a snapshot serialisation failing between `setQueryData` and `return` — you have an optimistic write with no recorded previous value, and no guard can recover it. That is the argument for **snapshotting before writing, and returning immediately after the write with nothing else in between**: keep the window between the optimistic mutation of the cache and the `return` of its undo empty.

```typescript
onMutate: async (postId) => {
  await queryClient.cancelQueries({ queryKey: ['post', postId] });
  const previousPost = queryClient.getQueryData<Post>(['post', postId]); // 1. snapshot
  queryClient.setQueryData<Post>(['post', postId], (old) =>                // 2. write
    old ? { ...old, likes: old.likes + 1, likedByMe: true } : old,
  );
  return { previousPost };                                                 // 3. nothing between 2 and 3
},
```

## Detonation 2 — the updater is handed `undefined`, and every doc example ignores it

The `QueryClient` reference is explicit about `setQueryData`:

> *"If the query does not exist, it will be created."*

So the updater's parameter is `T | undefined`, always. The optimistic-update guide's own example does not guard it:

> ```tsx
> context.client.setQueryData(['todos'], (old) => [...old, newTodo])
> ```

In a guide that is a legible illustration. Inside `onMutate` it is a `TypeError` on the first mutation after a cold start, on a deep link that rendered the detail view without ever rendering the list, and after garbage collection removed an inactive entry — *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected… it defaults to 5 minutes"*, which a modal left open easily outlives.

Three correct forms, and they mean different things:

```typescript
// (a) Bail out — there is no cached entry to patch, so do not invent one.
queryClient.setQueryData<Post>(key, (old) => (old ? { ...old, likes: old.likes + 1 } : old));

// (b) Seed — an append to a list is meaningful even when the list was never fetched.
queryClient.setQueryData<Todo[]>(key, (old) => [...(old ?? []), newTodo]);

// (c) Refuse — the optimistic path only makes sense with data present; skip it and let
// the mutation run non-optimistically. Return nothing, so onError has nothing to undo.
onMutate: async (postId) => {
  await queryClient.cancelQueries({ queryKey: ['post', postId] });
  const previousPost = queryClient.getQueryData<Post>(['post', postId]);
  if (!previousPost) return;              // ← this is the branch that widens the inferred generic
  queryClient.setQueryData<Post>(['post', postId], { ...previousPost, likes: previousPost.likes + 1 });
  return { previousPost };
},
```

Form (b) is the one to be careful with. Seeding creates a query entry that no `queryFn` has ever populated, containing exactly one item. If something renders that key before the invalidation lands, it renders a one-item list as though it were the whole list — the optimistic write has manufactured a plausible, wrong page.

## Why `cancelQueries` is awaited, and awaited *first*

[`12 · AbortSignal integration`](../12-query-cancellation/01-abortsignal-integration.md) settles this with the quote that matters:

> *"you just need to call `queryClient.cancelQueries({ queryKey })`, which will cancel the query and revert it back to its previous state."*

Both halves are load-bearing in `onMutate`. **Cancel** removes the in-flight refetch that would otherwise resolve after your optimistic write and overwrite it with pre-mutation data. **Revert** guarantees that the value `getQueryData` hands you on the next line is a settled one, not a partially-applied fetch result. That is why the order is `cancel → snapshot → write` and not `snapshot → cancel → write`: a snapshot taken before the revert can capture state the revert then discards, and your rollback would restore a value the cache never officially held.

It is `await`ed because `cancelQueries` returns a promise. Skipping the `await` lets `setQueryData` run while the cancellation is still propagating, and a response already in flight can still be delivered afterwards — which reintroduces the exact race the line exists to remove, intermittently, which is the worst way for it to come back.

⚠️ **`cancelQueries` takes query filters, and filters are prefix matches by default** — the same semantics [`04 · Cache management APIs`](../04-caching-and-invalidation/01-cache-management-apis.md) documents for `invalidateQueries`. `cancelQueries({ queryKey: ['posts'] })` inside a single post's mutation cancels every in-flight query under `['posts', …]`, including the paginated list somebody else's component just mounted. Cancel the narrowest key your optimistic write actually touches; reach for `exact: true` when the key you write is a prefix of keys you do not.

## `onSettled` must **return** the invalidation promise

The guide annotates its own example:

> *"make sure to _return_ the Promise from the query invalidation"*

— so that the mutation stays `pending` until the refetch settles.

```typescript
// ❌ Fires and forgets. isPending flips false the moment the write resolves.
onSettled: () => { queryClient.invalidateQueries({ queryKey: ['post', postId] }); },

// ✅ Returned. The mutation stays pending until the refetch that produces the real
// number has landed, so the spinner covers the whole transition.
onSettled: (data, error, postId) =>
  queryClient.invalidateQueries({ queryKey: ['post', postId] }),
```

Without the return, the user sees the value change twice: once to your optimistic guess when the spinner stops, and again a moment later when the invalidation's refetch arrives with the server's number. With the return, the spinner spans both.

**And note `onSettled` runs on the error path too.** That is not redundant with `onError`'s restore — it is the safety net *for* it. `onError` puts back a snapshot that was already stale by the time you took it (someone else's mutation, a websocket push, a concurrent refetch); the invalidation that follows replaces your best guess with the server's actual answer. Invalidation *"is marked as stale. This stale state overrides any `staleTime` configurations"*, so it fires even for a key you configured to be fresh for an hour.

🔴 **The one case where returning the promise hurts is offline.** With no network, the refetch triggered by the invalidation cannot settle, so a returned promise keeps the mutation `pending` and the button disabled with no error to explain it. If your app runs offline-capable writes, that is the trade the return buys and you should make it deliberately, not by copying the snippet.

## Gotchas

**★ 🔴 An unguarded `onMutateResult` turns a failed mutation into an unhandled exception with no rollback.** Its type is `TOnMutateResult | undefined` and the guide calls the return *optional*. When `onMutate` throws — most often on the awaited `cancelQueries`, or in whatever clones the snapshot — `onError` still fires, with `undefined` in that slot. `onMutateResult.previousPost` then throws a `TypeError` inside the error handler. There is no second `onError` wrapping the first, so the mutation's error state is now about the wrong failure, and the optimistic write, if it landed, is permanent. `if (!onMutateResult) return;` is one line and it is the difference.

**★ Leaving the fourth generic off `useMutation` makes the rollback type-safe only by accident.** Inference reads whatever `onMutate` returns today. Add an early `return` for the empty-cache case and the inferred type becomes `{ previousPost: Post } | undefined`; add a second snapshot key later and it becomes a union of two object shapes. `onError` then reads a property that exists on one arm. Declaring `useMutation<TData, TError, TVars, TOnMutateResult>` explicitly makes the mismatch a compile error at the place you changed it, rather than a runtime rollback that quietly writes `undefined`.

**★ Restoring a snapshot that was itself `undefined` is not the same as removing the entry.** If the key had no cached value when `onMutate` ran and your optimistic write *created* it (form (b) above), then rolling back means putting the cache back to having nothing there. ⚠️ **I could not confirm from the documentation what `setQueryData(key, undefined)` does to an existing entry** — the `QueryClient` reference settles that the query is created when absent, but not the effect of writing `undefined` over one that exists. Do not rely on it either way; branch explicitly, and remove what you created:

```typescript
onError: (err, vars, onMutateResult) => {
  if (!onMutateResult) return;
  if (onMutateResult.previousTodos === undefined) {
    queryClient.removeQueries({ queryKey: ['todos'], exact: true });
  } else {
    queryClient.setQueryData(['todos'], onMutateResult.previousTodos);
  }
},
```

**★ `getQueryData` hands back the live object, so a snapshot is only a snapshot if you never mutate through it.** `const previous = getQueryData(key)` is a reference into the cache, not a copy. If any code path — yours or a colleague's `sort()` on `previous.items` — mutates it, the "previous" value and the current value are the same object and the rollback restores the damage. Every optimistic write must produce a **new** reference via the spread form, which is also what makes observers re-render at all. For a deep structure, snapshot with `structuredClone(previous)` and accept that the clone can throw on non-cloneable values — inside `onMutate`, which is precisely how you end up in the `undefined` case above.

**★ Cancelling with a prefix cancels other people's queries.** Filters are prefix matches by default, so `cancelQueries({ queryKey: ['posts'] })` written for one post's optimistic edit aborts the in-flight infinite feed, the search results and the sidebar count. They will refetch — cancelled queries revert and are refetched by their observers — but you have converted one write into a burst of network. Cancel the exact key you are about to write over.

**★ Snapshotting one key and writing two is the commonest silent half-rollback.** A "mark as read" mutation optimistically edits both `['notifications','list']` and `['notifications','unreadCount']`, but `onMutate` returns only the list snapshot because that is the one the tutorial showed. On failure the list is restored and the badge keeps the decremented count until something else invalidates it. The rule: **the shape you return from `onMutate` must have one field per key you wrote**, and the guard in `onError` must restore all of them.

**★ A `setQueryData` write during rollback is silently discarded if the entry has been garbage collected in between.** Not an error — the reference says the query *"will be created"* — but what gets created is an entry with no observers, holding your restored value, which is itself collected after `gcTime`. Harmless, and worth knowing before you spend an afternoon on why the rollback "did nothing": there was nothing rendering that key by then.

**★ `onSettled` invalidating a key you did not write is a no-op that looks like a fix.** Invalidation is also a prefix filter, so people widen it (`['posts']` instead of `['posts', id]`) when a rollback looks wrong, and the symptom goes away because the whole tree refetches. That is not a fix; it is masking a bad snapshot with a full refetch, and it costs every list query on the page. If widening the invalidation "fixes" a rollback, the rollback is wrong.

**★ Optimistic UI plus a `staleTime` of zero means the invalidation refetch is guaranteed, and plus a long `staleTime` it still is.** Invalidation *"overrides any `staleTime` configurations"* and refetches active observers. So a page tuned with a 10-minute `staleTime` for read performance will still hit the network once per mutation, from `onSettled`. That is correct and desirable; just do not be surprised that your carefully tuned freshness policy does not apply to the key you just wrote.

## Interview questions

**★ Your rollback throws a `TypeError` in production. The mutation was a normal failed `POST`. What happened?**
`onMutate` threw before returning, so `onError` received `undefined` as its third argument and the handler dereferenced it. The type is `TOnMutateResult | undefined` precisely because `onMutate` is async and can fail on its own — usually on the awaited `cancelQueries`, or in a `structuredClone` of a snapshot containing something non-cloneable. The failure is nasty because it happens inside the error handler: there is no outer `onError`, the mutation's recorded error is now about the wrong thing, and any optimistic write that did land is permanent. Guard with an early `return`, and keep the window between the optimistic `setQueryData` and the `return` of the snapshot empty so there is no code in it that can throw.

**★ Why does the optimistic recipe `await cancelQueries` before it takes the snapshot, rather than after?**
Because `cancelQueries` *"will cancel the query and revert it back to its previous state"* — it changes the cache. A snapshot taken before the revert can capture a value that the revert then discards, so the rollback would restore something the cache never settled on. Awaiting also matters on its own: the call returns a promise, and writing optimistically while cancellation is still propagating leaves a window where a response already in flight can land on top of your write. Both bugs are intermittent, which is why the ordering is prescriptive rather than stylistic.

**★ The docs' own example writes `(old) => [...old, newTodo]`. Is that safe to copy?**
No, and it is the single most-copied unsafe line in the ecosystem. `setQueryData`'s updater is invoked with `T | undefined` because *"if the query does not exist, it will be created"* — cold start, deep link, or an inactive entry collected after the default five-minute `gcTime`. The guide is illustrating the pattern, not the guard. `(old) => [...(old ?? []), newTodo]` seeds; `(old) => old ? {...} : old` bails. Which one you want depends on whether a list you have never fetched is meaningfully "the empty list" — if it is not, seeding manufactures a one-item page that some component may render as if it were complete.

**★ Why must `onSettled` return the invalidation promise, and when should it not?**
Returning it keeps the mutation `pending` until the refetch settles, so `isPending` — and therefore the spinner and the disabled button — covers the whole transition from optimistic guess to server truth. Without it the mutation resolves as soon as the write returns, and the user watches the number change twice. The exception is offline or long-poll-backed writes: a refetch that cannot settle keeps the mutation pending indefinitely with no error surfaced, so the button never re-enables. That is a deliberate trade, and it is the only reason to omit the return.

**★ `onError` already restores the snapshot. Why invalidate again in `onSettled`?**
Because the snapshot was a guess about the past and the invalidation is a question to the present. Between `onMutate` and `onError` the true value can have moved — another user's write, a websocket push, another mutation on the same key. Restoring the snapshot puts back what *you* saw, which may now be wrong in a second way. The invalidation replaces it with what the server actually holds, and because invalidation *"overrides any `staleTime` configurations"* it fires regardless of how fresh the entry claims to be. `onSettled` running on both paths is the design: one reconciliation point, whichever way the write went.

**★ What does the fourth generic parameter of `useMutation` buy you that inference does not?**
A compile error at the moment the contract changes rather than a runtime surprise during a rollback. Inference derives `TOnMutateResult` from the current body of `onMutate`; the day someone adds an early `return` for the empty-cache case, the type widens to include `undefined` or becomes a union of shapes, and the `onError` that reads `onMutateResult.previousPost` is now reading a property that exists on only one arm. Declaring it explicitly also documents the rollback contract at the top of the hook, where a reviewer sees it, instead of in the middle of an async function.

**★ Where does the snapshot physically live between `onMutate` and `onError`, and why does that matter?**
On the mutation instance held by the library — not in the query cache and not in component state. That is why the pattern survives re-renders and unmounts of the calling component, and why it must be a value rather than a reference into the cache: the cache is about to change, that being the entire point of the optimistic write. It is also why two concurrent mutations each carry their *own* snapshot, taken at different moments, which is the setup for the failure mode covered in [`01b · Concurrent mutations on one key`](01b-concurrent-mutations-on-one-key.md).

**★ A colleague fixes a flickering rollback by widening the `onSettled` invalidation from `['posts', id]` to `['posts']`. What do you say in review?**
That the flicker is gone because the whole subtree now refetches, not because the rollback is right. Invalidation filters are prefix matches, so the widened call pulls the list, the search results and every cached page — real network cost on every mutation, and it hides whatever the actual defect was, usually a snapshot that missed one of the two keys the optimistic write touched. The diagnostic question is which keys `onMutate` wrote and whether the returned result has a field for each of them.

---

← [`useMutation` lifecycle](../05-usemutation/01-mutation-lifecycle.md) · [Topic index](../README.md) · Next → [Concurrent mutations on one key](01b-concurrent-mutations-on-one-key.md)
