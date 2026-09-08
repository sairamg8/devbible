---
title: "An infinite query's cache entry is {pages, pageParams}, so the flat-array updater every optimistic recipe shows silently replaces the structure the hook is about to read"
sidebar_label: "01d · Optimistic writes on infinite queries"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries), [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**Every optimistic-update example in the ecosystem writes a flat array: `(old) => [...old, newTodo]`. An infinite query does not store a flat array — it stores `{ pages, pageParams }`, and `setQueryData` does not validate what you hand it. So the same recipe that is merely unguarded on a normal query ([`01`](01-advanced-rollback-strategies.md)) is structurally destructive here: it replaces an object with an array, and the next render calls `data.pages.map` on something that has no `pages`. This chunk is the correct shape, which page to write into, and the pagination consequences an optimistic insert or delete has that a normal list does not.**

## The shape is part of the contract

The infinite-queries guide states it with an exclamation mark:

> *"Make sure to always keep the same data structure of pages and pageParams!"*

and repeats it for the seeding options:

> *"Note: Options `initialData` or `placeholderData` need to conform to the same structure of an object with `data.pages` and `data.pageParams` properties."*

`pageParams` is not decoration. It is what a refetch replays:

> *"When an infinite query becomes `stale` and needs to be refetched, each group is fetched `sequentially`, starting from the first one. This ensures that even if the underlying data is mutated, we're not using stale cursors and potentially getting duplicates or skipping records."*

So an edit that changes `pages` without changing `pageParams` leaves the two arrays out of step, and the next refetch replays cursors that no longer describe the pages they are paired with.

```typescript
// ❌ Structurally destructive. setQueryData does not type-check the value against the
// query it is writing, so this replaces {pages, pageParams} with a bare array.
queryClient.setQueryData(['feed'], (old) => [...old, optimisticPost]);

// ✅ The entry's shape survives; only page 0 changes.
queryClient.setQueryData<InfiniteData<Page>>(['feed'], (old) => {
  if (!old) return old;                       // cold cache — see 01, detonation 2
  const [firstPage, ...rest] = old.pages;
  return {
    ...old,
    pages: [{ ...firstPage, items: [optimisticPost, ...firstPage.items] }, ...rest],
    pageParams: old.pageParams,               // untouched: no page was added or removed
  };
});
```

The `if (!old) return old` matters more here than on a normal query: an infinite feed is exactly the kind of entry a user scrolls away from, and *"if the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected"* — five minutes by default. A composer left open in a modal outlives it easily.

⚠️ **`InfiniteData` is generic over the page type and, in v5, over the page-param type.** Annotating the updater as `InfiniteData<Page>` is enough for this write; if your `pageParams` are not `unknown` and you need them typed, supply the second argument. I am not asserting the exact default for the second type parameter — check the type in your editor rather than copying a signature from a blog.

## Which page do you write into?

There is no general answer, and picking wrong is a bug that only appears at page two.

- **Newest-first feed, optimistic insert** → prepend to `pages[0]`. That is where the item will appear when the server confirms it, so the position does not jump on reconciliation.
- **Oldest-first / append-only log** → push onto the **last** page, `pages[pages.length - 1]`.
- **Edit an existing item** → find it. It can be on any loaded page, so map every page:

```typescript
queryClient.setQueryData<InfiniteData<Page>>(['feed'], (old) =>
  old
    ? {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === edited.id ? { ...item, ...edited } : item,
          ),
        })),
        pageParams: old.pageParams,
      }
    : old,
);
```

- **Delete** → filter every page, and **leave `pageParams` alone**. Removing an item does not remove a page; dropping a param because you dropped an item desynchronises the arrays. `pageParams` changes only when a whole page is added or removed, which the guide's own page-dropping example shows doing to both arrays together.

## The pagination consequence: your optimistic insert will arrive again

This is the part that has no equivalent on a normal list query. You prepended an item to `pages[0]`. The server now also has it. The user scrolls, `fetchNextPage()` runs with the cursor stored in `pageParams`, and what comes back depends on how the API paginates:

- **Offset/limit** — the server's page boundaries shifted by one when the row was inserted. The item at the old boundary now appears at the start of page two as well as at the end of page one: a **duplicate**. Delete an item and the boundary shifts the other way: a record is **skipped**.
- **Cursor-based** — the cursor names a row, not a position, so an insertion elsewhere does not shift the window. This is the reason cursor pagination is the recommendation for anything mutable, and the reason the refetch is sequential in the first place — *"we're not using stale cursors and potentially getting duplicates or skipping records"*.

The library's answer for the already-loaded pages is the sequential refetch, and your `onSettled` invalidation triggers it. **Its cost scales with how far the user has scrolled**, which the migration guide states as the motivation for `maxPages`:

> *"when you have to refetch an infinite query that contains dozens of pages (network usage: all the pages are sequentially fetched)"*
>
> *"Version 5 has a new `maxPages` option for infinite queries, which allows developers to limit the number of pages that are stored in the query data and subsequently refetched."*

So on an infinite query, returning the invalidation promise from `onSettled` — mandatory in [`01`](01-advanced-rollback-strategies.md) — means the mutation stays `pending` until *every loaded page* has been refetched in sequence. On a feed twenty pages deep that is twenty round-trips with the submit button disabled. This is the one place in the topic where the returned promise deserves a second thought: either cap the pages with `maxPages`, or accept a non-returned invalidation and the double-render it causes.

## Rollback on an infinite query

The whole-entry snapshot is cheap and correct-in-isolation:

```typescript
onMutate: async (newPost) => {
  await queryClient.cancelQueries({ queryKey: ['feed'] });
  const previousFeed = queryClient.getQueryData<InfiniteData<Page>>(['feed']);
  queryClient.setQueryData<InfiniteData<Page>>(['feed'], (old) => /* as above */ old);
  return { previousFeed };
},
onError: (err, newPost, onMutateResult) => {
  if (!onMutateResult) return;
  queryClient.setQueryData(['feed'], onMutateResult.previousFeed);
},
```

but it restores **every page as they were**, so it inherits the concurrency defect of [`01b`](01b-concurrent-mutations-on-one-key.md) at a larger blast radius — and one extra failure of its own: if `fetchNextPage()` completed between the snapshot and the rollback, restoring `previousFeed` **deletes the page the user just scrolled to**. The feed jumps back up. The targeted un-apply from [`01b`](01b-concurrent-mutations-on-one-key.md) is not optional here; it is the only rollback that leaves newly-loaded pages in place:

```typescript
onError: (err, newPost, onMutateResult) => {
  if (!onMutateResult) return;
  queryClient.setQueryData<InfiniteData<Page>>(['feed'], (old) =>
    old
      ? {
          ...old,
          // remove only the item we optimistically added, wherever it now is
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((i) => i.id !== onMutateResult.tempId),
          })),
          pageParams: old.pageParams,
        }
      : old,
  );
},
```

which requires the client-generated `tempId` from [`01b`](01b-concurrent-mutations-on-one-key.md) — the server id does not exist yet, and identity is the only thing that survives a page having been added underneath you.

## Gotchas

**★ 🔴 `setQueryData` does not validate the value against the query it writes.** The reference only promises that *"if the query does not exist, it will be created"*. Nothing checks that an infinite query receives `{ pages, pageParams }`. A flat-array updater therefore succeeds, and the failure surfaces on the next render inside `data.pages.map` — in the component, not at the write. The stack trace names the list, so investigation starts three files away from the mutation that caused it.

**★ Editing `pages` and leaving `pageParams` behind is only a bug at refetch time.** The rendered list looks right immediately, because rendering flattens `pages`. The desynchronisation shows up when the sequential refetch replays params that no longer correspond — *"each group is fetched sequentially, starting from the first one"* — producing duplicated or missing records that read as a server bug. Add or remove a page and you must add or remove its param in the same write.

**★ An optimistic insert into an offset-paginated feed duplicates a row at the next page boundary.** The insert shifted every subsequent row by one, and `fetchNextPage` asks for `offset=20` regardless. The record that was previously last on page one is now first on page two, and it renders twice with the same React key. A delete produces the mirror image: one record is skipped entirely and nobody notices until a user asks where something went. Neither is a bug in your optimistic code — it is offset pagination meeting a write, and cursor pagination is the fix.

**★ Restoring a whole-entry snapshot can un-scroll the user.** `previousFeed` was captured when three pages were loaded. By the time the mutation fails, `fetchNextPage()` has loaded a fourth. `setQueryData(key, previousFeed)` removes it, the list shortens under the scroll position, and the browser lands somewhere arbitrary. Roll back by filtering the optimistic item out of whatever `pages` currently holds instead.

**★ `cancelQueries` in `onMutate` will cancel an in-flight `fetchNextPage`.** They are the same query key. A user who scrolls and immediately likes something cancels their own page load; it is reverted and refetched by the observer, so it recovers, but the intervening render shows a shortened list and a re-triggered spinner. There is no way to cancel "only the refetches, not the pagination" — the filter granularity is the key.

**★ Returning the invalidation promise costs one round-trip per loaded page.** Refetching an infinite query refetches *all* its pages, sequentially. On a deep feed that turns a "keep the button disabled until it's consistent" decision into a multi-second disabled button. `maxPages` exists precisely for this — *"only 3 pages will be refetched sequentially"* in the guide's example — and it requires a bi-directional list: *"the infinite list must be bi-directional, which requires both `getNextPageParam` and `getPreviousPageParam` to be defined."*

**★ `select` on an infinite query must preserve the shape too, and must copy before reversing.** The guide's reversal example is `select: (data) => ({ pages: [...data.pages].reverse(), pageParams: [...data.pageParams].reverse() })` — both arrays, both spread first. `Array.prototype.reverse` mutates, so reversing without the copy mutates the cached arrays your optimistic write just produced. ⚠️ The documentation does not state whether `select` may return a shape *other* than `{ pages, pageParams }` on an infinite query; the shape-preserving form is the only one shown and the only one to rely on.

**★ A temporary id in an infinite feed is visible for longer than in a plain list.** The provisional item sits in `pages[0]` until the invalidation's sequential refetch reaches page zero and replaces it. Anything that links to `/posts/${id}` in that window points at an id the server has never heard of. Either disable interaction on items carrying a temp id, or resolve the real id in `onSuccess` and patch it into the cache before the refetch arrives.

**★ Prefetched pages are part of the entry you are about to overwrite.** *"Infinite queries can be prefetched… By default, only the first page gets prefetched. To prefetch multiple pages, use the `pages` option"* — so an entry can hold three pages before the user has scrolled at all. An optimistic write that assumes `pages.length === 1` (writing `old.pages[0]` and dropping the rest, a common shortcut) discards two prefetched pages and makes the prefetching look broken.

## Interview questions

**★ Why does the standard optimistic-append snippet break an infinite query?**
Because the cache entry is `{ pages, pageParams }`, not an array, and `setQueryData` performs no validation — it writes whatever the updater returns. `(old) => [...old, newTodo]` spreads the object into an empty array and stores that, so the entry is now an array with no `pages` property. Nothing fails at the write; the next render throws inside `data.pages.map`, in a component that never mentioned the mutation. The correct write copies the entry, replaces one page's items, and leaves `pageParams` intact — the guide is explicit: *"Make sure to always keep the same data structure of pages and pageParams!"*

**★ You optimistically insert a post at the top of an offset-paginated feed. What does the user see at page two?**
A duplicate. The insert shifted every row down by one on the server, but `fetchNextPage` still asks for the next fixed offset, so the row that ended page one reappears at the start of page two — with the same React key, which is its own class of rendering bug. Deleting produces the inverse: the boundary shifts up and one record is never requested. The library mitigates this on *refetch* by refetching pages sequentially so that *"we're not using stale cursors and potentially getting duplicates or skipping records"*, but that only repairs pages already loaded; the next `fetchNextPage` is a fresh request against a shifted dataset. Cursor pagination is the real fix.

**★ Why is a whole-entry rollback worse on an infinite query than on a normal list?**
Because the entry contains the user's scroll history. A snapshot taken when three pages were loaded, restored after a fourth has been fetched, deletes that fourth page — the list shortens under the user and the scroll position collapses. On a flat list the equivalent mistake loses a concurrent mutation's write, which is bad; here it also loses work the *user* did, which is worse and much more visible. Roll back by filtering the optimistic item out of the current `pages` by a client-generated id.

**★ Should `onSettled` return the invalidation promise for an infinite query?**
It has a real cost here that it does not have elsewhere. Invalidating refetches every loaded page sequentially, so returning the promise keeps the mutation `pending` for as many round-trips as the user has scrolled, and the submit button stays disabled for all of them. The options are to cap the stored pages with `maxPages` — *"which allows developers to limit the number of pages that are stored in the query data and subsequently refetched"*, noting it requires both `getNextPageParam` and `getPreviousPageParam` — or to accept the un-returned invalidation and the brief double-render it causes. It is the one place in this topic where the default advice is worth re-deciding.

**★ When does `pageParams` change, and when must it not?**
It changes when a whole page is added or removed — the guide's own example drops the first page with `pages: data.pages.slice(1), pageParams: data.pageParams.slice(1)`, both together. It must **not** change when you add, edit or remove an *item* within a page, because the pages themselves still exist and their cursors are still correct. Getting this backwards is subtle because the rendered list is identical either way; the damage only appears when a refetch replays the params against pages they no longer describe.

**★ How does `cancelQueries` interact with `fetchNextPage`?**
They are the same query key, so `cancelQueries({ queryKey: ['feed'] })` at the top of `onMutate` cancels an in-flight page load as readily as a background refetch. The query is reverted and the observer refetches, so nothing is permanently lost, but the user who scrolled and immediately tapped "like" sees the incoming page vanish and the loading spinner return. There is no finer-grained filter that separates "the refetch I am racing" from "the page the user asked for" — the key is the unit — which is another argument for keeping the optimistic value out of the cache entirely when the update only needs to be visible in one place ([`01c`](01c-in-flight-state-and-ui-variables.md)).

---

← [In-flight state and UI variables](01c-in-flight-state-and-ui-variables.md) · [Topic index](../README.md) · Next → [Testing TanStack Query](../15-testing-tanstack-query/01-isolated-and-integration-testing.md)
