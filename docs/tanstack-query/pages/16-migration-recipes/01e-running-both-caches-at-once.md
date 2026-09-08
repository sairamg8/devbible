---
title: "Every real RTK Query migration runs both caches at once for weeks — and the only thing that actually breaks is a resource that lives in both, so the migration order is a partition of your resources, not a list of your screens"
sidebar_label: "01e · Running both caches at once"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) — and, for the RTK side, this corpus's validated [`createApi` page](../../../redux-toolkit/pages/04-rtk-query/01-api-slice-and-endpoints.md) and [cache management page](../../../redux-toolkit/pages/04-rtk-query/02-cache-management-and-invalidation.md). ⚠️ **The coexistence strategy on this page is engineering judgement, not a documented feature** — neither library documents running alongside the other, and no page anywhere will tell you this. The API facts it rests on are quoted; the partition rule is reasoning. Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8** · **@reduxjs/toolkit 2.12.0**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🧬 Two Caches, One App

**Nobody migrates a data layer in one commit. `createApi` in a real product has forty endpoints across a dozen feature slices, and the port of each one is a genuine design decision — so for somewhere between two weeks and two quarters, your app ships with both `@reduxjs/toolkit/query` and `@tanstack/react-query` installed, both holding server data, both refetching on their own schedules.** That is fine. It is the normal shape of this migration and it is not the thing that hurts you. The thing that hurts you is a **single resource cached in both libraries at the same time**, because each cache is authoritative for its own copy, neither knows the other exists, and there is no mechanism anywhere that will reconcile them. This page is about drawing the line so that never happens, and about the two escape hatches for when the codebase will not let you.

## 1. The invariant: partition by resource, never by screen

The intuitive migration plan is "port one screen at a time" — pick the settings page, rewrite its five hooks, ship it, move on. It is the wrong unit, and it fails on the second screen.

Screens do not own resources; they *borrow* them. The settings page reads the current user. So does the header avatar, the comment list, the admin table, and the notification tray. Port the settings page and you have not moved "the user resource" — you have created a second, independent copy of it, living in a cache the header has never heard of.

**The unit that works is the resource.** Take one entity — `notifications`, say — and move *every* read and *every* write of it in the same change, across however many screens that touches. When the change lands, `notifications` exists in exactly one cache. Screens are then free to be half-migrated, and that is harmless: a component can call `useGetUserQuery` on line 3 and `useQuery({ queryKey: notificationKeys.list() })` on line 4 with no interaction whatsoever between them.

```text
❌ PARTITION BY SCREEN                      ✅ PARTITION BY RESOURCE
────────────────────────────────────        ─────────────────────────────────────
SettingsPage  → TanStack ─┐                 notifications → TanStack (all callers)
HeaderAvatar  → RTK ──────┼→ user           billing       → TanStack (all callers)
CommentList   → RTK ──────┘   in BOTH       user          → RTK      (all callers)
                                            orders        → RTK      (all callers)
     one resource, two authorities                one resource, one authority
     no mechanism reconciles them                 nothing to reconcile
```

🔴 **State the invariant on the pull-request template and enforce it in review: a resource is owned by exactly one cache at any moment.** It is the single rule that makes the whole migration boring, and it is cheap to check — grep for the entity name in both the `createApi` file and the key factory, and it must appear in one of them.

## 2. What "two authorities" actually does to you

It is worth being concrete, because the failure is not a crash and does not appear in any log.

**The stale-read.** A user changes their display name on the settings page. That page is migrated, so the write goes through `useMutation` and `queryClient.invalidateQueries({ queryKey: userKeys.detail(id) })`. The TanStack cache is now correct. The RTK Query cache still holds the old name, because `invalidateQueries` matches query keys and RTK's cache is not made of query keys — it is made of tags in a Redux slice. The header avatar keeps rendering the old name.

**And it does not self-correct.** This is the part people get wrong when they estimate the risk. If both caches refetched aggressively, the stale copy would fix itself within a focus event and you would have an ugly flicker rather than a bug. But RTK Query's `refetchOnFocus` and `refetchOnReconnect` are **off unless you both set the option and call `setupListeners`**, and `refetchOnMountOrArgChange` defaults to not refetching over a live cache entry. So the RTK half of your app is the *quiet* half, and it will hold a wrong value until the component unmounts, `keepUnusedDataFor` (60 seconds) elapses, and something mounts it again. On a header that never unmounts, that is "until the next full page load."

**The reverse direction is worse.** A write that still goes through RTK Query invalidates its tags, RTK refetches, RTK is correct — and TanStack's copy is stale but *does* refetch on focus and on mount, because those are on by default. So the value flickers back to correct on the next tab switch, which is exactly the behaviour that makes a bug report unreproducible.

**And the pair is invisible in both devtools.** [React Query Devtools](../11-devtools/01-react-query-devtools.md) shows you a perfectly healthy `['users','detail','7']` entry with fresh data. Redux DevTools shows you a perfectly healthy `api.queries['getUserById("7")']` entry. Neither is wrong about itself. Nothing in either tool draws your attention to the fact that they disagree, because neither tool can see the other.

## 3. The two escape hatches, and why both are scaffolding

Sometimes the partition is not available on the schedule you have. A resource is read in sixty places, three of them in a legacy area nobody wants to touch this quarter, and you still need to ship the new screen. There are two honest answers, and both are **temporary code with a deletion date**, not architecture.

### 3a. Cross-invalidation — make each write tell the other cache

Whichever library performs the write also pokes the other one. It is ugly and it is correct.

```typescript
// Write goes through TanStack; RTK Query still holds a copy of this resource.
// `store` is your configureStore result; importing it here is the smell that
// tells you this block is temporary.
useMutation({
  mutationFn: (vars: UpdateUser) => http<User>(`/users/${vars.id}`, { method: 'PATCH', /* … */ }),
  onSettled: (_data, _err, { id }, _onMutateResult, context) =>
    Promise.all([
      context.client.invalidateQueries({ queryKey: userKeys.detail(id) }),
      // 🔴 THE BRIDGE — and note this is a plain dispatch, not awaited work.
      //    invalidateTags marks RTK entries stale; the refetch is RTK's business.
      Promise.resolve(store.dispatch(usersApi.util.invalidateTags([{ type: 'User', id }]))),
    ]),
});
```

```typescript
// Write still goes through RTK Query; TanStack now holds a copy of this resource.
updateUser: builder.mutation<User, UpdateUser>({
  query: /* … */,
  invalidatesTags: (_r, _e, { id }) => [{ type: 'User', id }],
  async onQueryStarted({ id }, { queryFulfilled }) {
    try {
      await queryFulfilled;
    } finally {
      // 🔴 THE BRIDGE, other direction. queryClient here is the module-level
      //    singleton, not one from useQueryClient — this is outside React.
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
    }
  },
}),
```

Two details in there that decide whether the bridge works:

- **`onSettled` / `finally`, not `onSuccess`.** If the write failed you still want both caches to go refetch the truth, because an optimistic update may have been applied on one side.
- **Bridge on *invalidation*, not on the response value.** It is tempting to `setQueryData` the mutation's response into the other cache directly. Don't — you would be writing RTK's response shape (post-`transformResponse`) into a TanStack entry, or the reverse, and the two shapes drift the moment anyone edits a transform. Marking stale and letting each library fetch its own shape is the version that survives.

⚠️ **Every bridge is a place where the two caches are correct only if somebody remembered.** There is no compiler check and no test that fails when the next mutation forgets one. Which is why:

🔴 **Write the bridge with a `// TODO(migration): delete when <resource> is fully on TanStack` comment carrying a ticket number, and close the ticket by deleting the bridge.** A bridge that outlives the migration is worse than either cache alone, because it makes the coexistence comfortable enough to leave forever.

### 3b. Make one side read-only

Cheaper, safer, and available more often than people notice. If the legacy area only *reads* the resource, you do not need a bridge at all — you need the legacy area to stop caching. Point the remaining RTK Query reads at `keepUnusedDataFor: 0` and `refetchOnMountOrArgChange: true` and the RTK copy becomes a pass-through that refetches on every mount. It costs requests. It cannot go stale.

**This is the right trade whenever the leftover call sites are on rarely-visited screens**, which is usually exactly where the leftover call sites are.

## 4. The seams that are not the cache

Four things exist once per app and now have two implementations. All four are missed in roughly the same order.

**Authentication headers.** `fetchBaseQuery({ prepareHeaders })` attached the token to every RTK request. Your new `queryFn` does not go through it. If you write the header logic twice you will have two token-refresh implementations, and two refreshers racing on a 401 is a real way to log users out. **Extract one `http()` function first, before porting a single endpoint, and have `fetchBaseQuery` use it too via a custom `baseQuery`.** This is the highest-value hour in the entire migration and it is best spent on day zero.

**Logout.** `dispatch(api.util.resetApiState())` clears one cache. `queryClient.clear()` clears the other. During coexistence your logout handler must do both, and the failure mode is the worst one in the list — the next user on a shared machine sees the previous user's data — so it belongs in a test, not in a checklist. See [Testing TanStack Query](../15-testing-tanstack-query/01-isolated-and-integration-testing.md) for the client-per-test setup that makes such a test honest.

**SSR and hydration.** If you server-render, you now have two dehydrated payloads in the HTML — RTK's preloaded store state and TanStack's `HydrationBoundary` state — and a resource in both is *serialised twice*, inflating the document. Worse, they can be internally inconsistent if the two fetches happened at different moments during the render. [Prefetching & SSR](../09-prefetching-and-ssr/01-server-rendered-data-flow.md) covers the TanStack half; the partition rule is what keeps the two payloads disjoint.

**Bundle size.** Both libraries ship for the duration. That is genuinely fine — it is a few kilobytes for a few weeks and it is the correct price for an incremental migration — but say it out loud before someone discovers it in a bundle report and treats it as a regression.

## 5. Knowing you are done — and the trap in "done"

The migration is over when **all four** of these are true, and teams routinely stop after the first:

1. No file imports from `@reduxjs/toolkit/query`.
2. `reducerPath` and `api.middleware` are out of `configureStore`, and `setupListeners` is deleted.
3. Every cross-invalidation bridge from §3a is deleted.
4. `@reduxjs/toolkit` itself is either removed, or deliberately kept for client state — a decision made by looking at what is actually left in the store, not by momentum. [`01`](./01-rtk-query-to-tanstack-query.md) §5 argues that one out.

🔴 **Step 2 is the one that gets skipped, and it is not cosmetic.** A `createApi` slice with no remaining subscribers still keeps its reducer mounted and its middleware in the chain; more to the point, it keeps compiling, so nobody notices when a new feature imports a hook from it out of habit and reintroduces a second authority six months after the migration "finished."

## Gotchas

**★ Symptom: a value updated on a migrated screen stays stale in a header or sidebar that was not migrated.** Cause: the resource lives in both caches, the write invalidated only the TanStack copy, and the RTK copy has no reason to refetch — its focus and reconnect refetching are off unless you called `setupListeners`, and `keepUnusedDataFor` keeps a mounted entry alive indefinitely. Fix: move every reader of that resource in the same change (§1). If you cannot, bridge the invalidation (§3a) and put a deletion ticket on the bridge.

**★ Symptom: the same stale-copy bug, but the value corrects itself on tab-switch and nobody can reproduce it.** Cause: the same duplication with the caches the other way round. TanStack's `refetchOnWindowFocus` and mount refetching are on by default — *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"* — so the TanStack copy heals itself while the RTK copy would not have. Fix: same as above. Do not "fix" it by disabling focus refetching to make the symptom consistent.

**★ Symptom: you migrate screen by screen and the number of duplicated resources goes up every sprint.** Cause: screens borrow resources; they do not own them. Every screen you port drags a handful of shared entities into the second cache. Fix: switch the unit of work to the resource, and accept half-migrated screens — a component holding one RTK hook and one TanStack hook is completely harmless as long as they are about different entities.

**★ Symptom: after logout, the next user sees the previous user's data on some screens but not others.** Cause: only one of the two caches was cleared. `resetApiState()` was already wired into a logout reducer, so the RTK half looks handled and `queryClient.clear()` was never added — or the reverse, if the logout flow was migrated first. Fix: both calls in one logout function, and an integration test that asserts both caches are empty afterwards. This is the highest-severity item on the page and the cheapest to test.

**★ Symptom: two token refreshes fire on a single 401 and the user is logged out.** Cause: `prepareHeaders` and your new `queryFn` each grew their own refresh-on-401 logic. Fix: one `http()` module owning auth, with `fetchBaseQuery` delegating to it through a custom `baseQuery`. Do this before porting any endpoint; retrofitting it after twenty `queryFn`s exist is a much larger change.

**★ Symptom: a bridge `setQueryData`s the mutation response into the other cache and the shape is subtly wrong.** Cause: RTK's cache holds the value *after* `transformResponse`; TanStack's holds whatever `queryFn` returned. Writing one into the other couples two transforms that will drift. Fix: bridge by invalidating, never by copying values. One extra request, no shape coupling.

**★ Symptom: `store.dispatch(...)` inside a TanStack callback and `queryClient` inside an RTK `onQueryStarted` create an import cycle, or a `queryClient` that is `undefined` at module init.** Cause: the bridge necessarily reaches across two module graphs that were designed not to know about each other, and the `QueryClient` singleton is frequently created in the same module tree as the store. Fix: create the `QueryClient` in its own module with no imports, and import *it* from both sides. If the cycle persists, inject the bridge as a callback at store-setup time rather than importing across.

**★ Symptom: the RTK entries look fresh in Redux DevTools and the TanStack entries look fresh in React Query Devtools, and the screen is still wrong.** Cause: each tool is telling the truth about its own cache. Duplication is invisible to both by construction. Fix: diagnose duplication by grepping the entity name across the `createApi` file and the key factory — a resource appearing in both is the bug, and no runtime tool will show it to you.

**★ Symptom: server-rendered HTML grows noticeably during the migration.** Cause: a duplicated resource is serialised into both the preloaded Redux state and the TanStack dehydrated payload. Fix: the partition rule again; the two payloads should be disjoint by construction. Treat a resource appearing in both dehydrated blobs as a build-time assertion worth writing.

**★ Symptom: months after the migration "finished", a new feature imports `useGetThingQuery` and a second authority reappears.** Cause: step 2 of §5 was skipped — the `createApi` slice is still in the tree, still compiling, still exporting hooks. Fix: delete the file and remove the middleware, not just the call sites. If `@reduxjs/toolkit` is being kept for client state, an ESLint `no-restricted-imports` rule on `@reduxjs/toolkit/query` is the durable version of "we finished."

**★ Symptom: the bridge works in the app and every migrated component's test fails.** Cause: the bridge dispatches into a Redux store that the component test does not render a `Provider` for, or reaches a module-level `queryClient` that the test replaced with a fresh one. Fix: keep the bridge in a single injectable module so a test can supply a no-op, and remember that a fresh `QueryClient` per test — the standard advice — is precisely what disconnects it from a module singleton.

## Interview questions

**★ You are migrating a large app from RTK Query to TanStack Query. What is the unit of migration, and why is it not the screen?**
The resource. A screen borrows entities that other screens also read, so porting screen by screen leaves a single entity — the current user, typically — cached in both libraries at once, with each cache authoritative for its own copy and no mechanism to reconcile them. Porting resource by resource means every read and write of that entity moves in one change, so the entity has exactly one authority at every moment. Half-migrated *screens* are then harmless: one component can hold an RTK hook and a TanStack hook side by side as long as they are about different entities.

**★ A migrated settings page updates a user's name. The unmigrated header keeps showing the old one and never corrects. Why never, specifically?**
Because the stale copy is in RTK Query, which is the quiet library by default. `invalidateQueries` matched query keys and RTK's cache is a tag graph in a Redux slice, so RTK was never told. And RTK will not heal itself: `refetchOnFocus` and `refetchOnReconnect` require both the option and a `setupListeners(store.dispatch)` call, and `refetchOnMountOrArgChange` defaults to not refetching over a live entry. On a header that never unmounts, `keepUnusedDataFor` never starts counting. The mirrored bug — write through RTK, stale copy in TanStack — *does* self-correct on the next window focus, because TanStack's focus and mount refetching are on by default, which makes it intermittent and much harder to report.

**★ When a resource genuinely cannot be moved all at once, what do you do, and what makes your answer temporary rather than architectural?**
Bridge the invalidation: whichever library performs the write also invalidates the other, from `onSettled` on the TanStack side or `onQueryStarted`'s `finally` on the RTK side. Invalidate — never copy the response value across, because the two caches hold different shapes once a `transformResponse` exists. It is temporary because nothing enforces it: no compiler error and no failing test when the next mutation forgets a bridge, so its correctness decays with every commit. It ships with a deletion ticket. The cheaper alternative, when the stragglers only read, is to make the leftover side a pass-through — `keepUnusedDataFor: 0` plus refetch-on-mount — which costs requests and cannot go stale.

**★ Which single piece of work should happen before any endpoint is ported, and why that one?**
Extracting one HTTP function that owns base URL, auth headers and token refresh, with `fetchBaseQuery` delegating to it through a custom `baseQuery`. Every `queryFn` you write bypasses `prepareHeaders`, so if you do not do this first you end up with two auth implementations and, on a 401, two refresh flows racing — which logs users out for reasons that look nothing like the migration. It also collapses the per-endpoint port to genuinely mechanical work, because the interesting part is already shared.

**How do you tell, from the outside, that an app is running two caches over one resource?**
Not from either devtool — each shows a healthy entry and neither can see the other. You find it statically: grep the entity name across the `createApi` file and the query-key factory, and if it appears in both, that is the bug. It is worth making that a CI check during the migration, because it is the one class of failure here that is cheap to detect mechanically and expensive to detect any other way.

**What does "the migration is done" mean beyond the call sites being gone?**
Four things: nothing imports `@reduxjs/toolkit/query`; the `reducerPath`, the middleware and `setupListeners` are out of `configureStore`; every cross-invalidation bridge is deleted; and Redux itself is either removed or deliberately kept for client state on the evidence of what is actually left in the store. The one that gets skipped is the middleware, because the slice keeps compiling with no subscribers — which means the hooks are still exported and a new feature will reintroduce a second authority months later. An ESLint `no-restricted-imports` rule on the subpath is the version of "done" that holds.

**Is shipping both libraries a problem?**
Not for the duration of a migration — it is a few kilobytes for a few weeks and it buys you incremental delivery, which is the correct trade. It becomes a problem when it stops being temporary, and the signal for that is bridges outliving their tickets. Name the bundle cost up front so nobody discovers it in a report and escalates it as a regression, and put a date on it so nobody mistakes it for the steady state.

---

← [Mutations and rollback](./01d-rtk-query-mutations-and-rollback.md) · [Topic index](../README.md) · Next → [Mechanical vs semantic](./01f-v4-to-v5-mechanical-versus-semantic.md)
