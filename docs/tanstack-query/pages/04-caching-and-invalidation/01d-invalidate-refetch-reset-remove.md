---
title: "invalidateQueries, refetchQueries, resetQueries and removeQueries are reached for interchangeably and do four different things to your data, your observers and the next frame the user sees"
sidebar_label: "01d · Invalidate vs refetch vs reset vs remove"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# ⚖️ Four Verbs, Four Different Next Frames

**These four methods take the same filter object and read like synonyms at a call site. They are not. The question that separates them is *what does the user see in the next frame* — unchanged data quietly refreshing, unchanged data definitely refreshing, a spinner, or a spinner you did not intend. Picking by feel is why "it refetches too much" and "it flashes a loader" are the two most common complaints in this part of the API.**

🔴 **Provenance note.** `https://tanstack.com/query/latest/docs/reference/QueryClient` returns
`{"isNotFound":true}` on the docs site as of 2026-09-08, so the per-method wording below is
**described from the guides and from behaviour the guides imply — not quoted from a method
reference**, except where a quote is shown. Where a claim rests on the missing page it is marked
⚠️ inline.

## 1. The comparison, on the axes that matter

| | cached `data` after the call | network | what a mounted observer renders next |
|---|---|---|---|
| `invalidateQueries` | **kept** | one request per *active* match, none for inactive | old data, `isFetching: true`, then new data — no loading state |
| `refetchQueries` | **kept** | one request per match, fresh or not, observed or not | same: old data while fetching, then new |
| `resetQueries` | **discarded**, back to initial | active matches refetch | ⚠️ back to `pending` — a loading state, not stale-while-revalidate |
| `removeQueries` | **gone**, entry deleted | none issued by the call itself | ⚠️ the entry it was reading no longer exists |

The first two columns are the whole lesson. `invalidate` and `refetch` are *non-destructive*: they
leave the cache populated, so the stale-while-revalidate render the library is built around keeps
working and the user never sees a spinner. `reset` and `remove` are *destructive*: they take the
data away, and anything mounted on it falls back to whatever your `pending` branch renders.

## 2. `invalidateQueries` — mark stale, refetch what is observed

Two sentences from the invalidation guide define it completely:

> *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*
> *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*

This is the default choice after a mutation, and the reason is economics: it costs one request per
*mounted* observer and zero for everything else, while still guaranteeing that everything else
refetches the moment it is mounted again. It is the only one of the four whose cost scales with
what the user is looking at rather than with what the cache happens to hold.

```ts
// The 95% case.
await api.patch(`/todos/${id}`, patch);
queryClient.invalidateQueries({ queryKey: ['todos'] });
```

⚠️ There is an option — spelled `refetchType` — for invalidating without refetching, and for
forcing inactive matches to refetch too. It lives on the `QueryClient` reference page, which does
not currently resolve, so **I could not re-confirm its name or its accepted values on 2026-09-08;
verify against the version you install.** The documented-behaviour route to the same two outcomes
is the `type` filter: `type: 'inactive'` invalidates only unobserved matches and therefore issues
no request, and `refetchQueries` covers the force case.

## 3. `refetchQueries` — fetch now, regardless

`refetchQueries` issues a request for every match, whether or not the data is stale and whether or
not anything is observing it. There is no staleness check and no active/inactive shortcut.

That makes it right for exactly one shape of requirement: **"now" is the specification.** A manual
Refresh button. A "check for updates" menu item. A websocket message telling you a specific report
was regenerated. In each of those the user has asked for a request, or the server has, and
deferring it to the next mount would be wrong.

```ts
// Correct use: the user pressed a button that means "go and ask again".
<button onClick={() => queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'active' })}>
  Refresh
</button>
```

Note the `type: 'active'` even here — a Refresh button means "refresh what I am looking at", not
"refetch every dashboard variant this session has ever cached".

## 4. `resetQueries` — back to the beginning, with a loading state

`resetQueries` returns matching queries to their pre-fetch state: the cached data is discarded and,
where a query declares `initialData`, that is what is left behind. Active matches then fetch again,
because a mounted observer with no data does what a fresh mount does.

⚠️ The precise post-reset state — in particular whether error state and `dataUpdatedAt` are cleared
alongside `data` — is documented on the `QueryClient` reference page, which does not currently
resolve. **I could not re-confirm it on 2026-09-08.** Treat "the data is gone and the observer
re-enters `pending`" as the safe mental model and verify the rest against the version you install.

The legitimate uses are narrow and they are all *"this data no longer belongs to this session"*:

```ts
// A wizard the user abandoned: throw away the partially-fetched step data and start clean.
queryClient.resetQueries({ queryKey: ['onboarding', wizardId] });

// A filter form's "Reset" that must not show the previous result set even for a frame.
queryClient.resetQueries({ queryKey: ['search'], exact: false });
```

The distinction from `invalidateQueries` is user-visible and not subtle: invalidation keeps the old
rows on screen while the new ones load, reset blanks them. Choose reset only when showing the old
value for another 200ms would be *wrong*, not merely stale — a previous tenant's records, a
previous user's draft, a result set that no longer matches the filters on screen.

## 5. `removeQueries` — delete the entry

`removeQueries` deletes matching entries from the cache outright. It does not fetch anything, and
unlike reset it leaves nothing behind — no data, no error, no `dataUpdatedAt`, no entry at all. The
next `useQuery` for that key is, as far as the cache is concerned, the first one.

It is the right verb for *forgetting*, which is a security and a memory concern rather than a
freshness one:

```ts
// Logout: the next user of this browser must not see the previous user's cached data,
// not even for the frame before a refetch lands.
function onLogout() {
  queryClient.removeQueries({ queryKey: ['me'] });
  queryClient.removeQueries({ queryKey: ['workspace'] });
  // or, for everything:
  queryClient.clear();
}

// Housekeeping: drop archived detail entries so they do not sit in memory until gcTime.
queryClient.removeQueries({ queryKey: ['todos', 'detail'], type: 'inactive' });
```

⚠️ Removing an entry that a mounted component is currently observing is the one case to think
about, and it is the one the missing reference page would settle. The observer has no entry to read
from; the practical consequence is a return to a loading state and a refetch, i.e. exactly the
flash of spinner you were avoiding by using TanStack Query in the first place. **Filter with
`type: 'inactive'` unless you specifically intend to blank the screen.** The v5 migration guide
confirms this is now the only spelling of the operation: *"`result.remove()`"* was removed, and the
replacement is `queryClient.removeQueries({ queryKey })`.

## 6. `cancelQueries` and `clear`, for completeness

`cancelQueries` stops in-flight fetches for matching queries. It is not a freshness operation at
all — it exists so a write does not lose a race with a read. The optimistic-updates guide uses it
in exactly one place and says why in a comment:

> *"Cancel any outgoing refetches (so they don't overwrite our optimistic update)"*

`queryClient.clear()` empties the whole cache. It is the logout hammer; anything narrower should be
a filtered `removeQueries`, because `clear()` also discards queries belonging to parts of the app
that have nothing to do with the user's identity.

## 7. A decision procedure

1. Did the server's data change because of something I just did? → **`invalidateQueries`**.
2. Does the user (or the server) explicitly want a request *right now*? → **`refetchQueries`**,
   usually with `type: 'active'`.
3. Would showing the current cached value for even one more frame be *wrong* rather than stale? →
   **`resetQueries`**.
4. Must this data cease to exist — different user, different tenant, memory pressure? →
   **`removeQueries`**, or `clear()` at logout.
5. Am I about to write to the cache myself? → **`cancelQueries`** first, then
   [`setQueryData`](./01e-direct-cache-access.md).

## Gotchas

**★ `refetchQueries` bypasses the active/inactive distinction that makes invalidation cheap.**
Invalidation costs one network request per *mounted* observer and defers the rest; a forced refetch
does the work now, whether or not the data was fresh and whether or not anything is looking at it.
Reserve it for the cases where "now" is the requirement — a manual Refresh button, a poll you are
driving yourself — and use invalidation everywhere a mutation just changed the server.

**★ Symptom: a Refresh button flashes a full-page loading skeleton.** Cause: it calls
`resetQueries` or `removeQueries`, not `refetchQueries`. Both of those discard the cached data, so
the observer re-enters `pending` and your `isPending` branch renders. Fix: `refetchQueries` keeps
the data and sets `isFetching`, which is what a refresh should look like — old content visible,
a subtle indicator, then new content. If you cannot tell which one a button is using, look at
whether the skeleton appears: a non-destructive verb can never produce one on a warm cache.

**★ Symptom: after logout, the next login briefly shows the previous user's data.** Cause:
invalidation was used where removal was required. Invalidation *keeps* the cached value and merely
schedules a refetch, so the first frame after the new user's screen mounts renders the old user's
rows — a genuine data-leak class bug, not a cosmetic one. Fix: `removeQueries` for the affected
prefixes, or `queryClient.clear()` on logout. Nothing that keeps data is acceptable here.

**★ Symptom: `removeQueries` on a key the current screen is showing blanks the screen.** Cause: the
entry a mounted observer was reading no longer exists, so the observer falls back to its pending
state and fetches again. Fix: add `type: 'inactive'` when the intent is housekeeping rather than
blanking, and reach for `invalidateQueries` when the intent was actually "this is out of date". The
one time you *do* want the destructive form on an active query is when the old value must not be
rendered again under any circumstances.

**★ Symptom: `resetQueries` did not go back to empty — the old data reappeared instantly.** Cause:
that query declares `initialData` (or `placeholderData`), so "the pre-fetch state" is not nothing;
it is whatever you seeded. Fix: this is usually the desired behaviour, but if reset must produce a
truly empty state, the query cannot carry `initialData` — or you want `removeQueries`, which leaves
no entry for the seed to apply to until the hook mounts again.

**★ Symptom: you awaited `invalidateQueries` and the code after it still read old data.** Cause:
two different things. Invalidation is a schedule, not a write, so the cache still holds the old
value at the instant the mark is applied; and the promise it returns settles when the refetches it
*triggered* settle — which for a filter that matched only inactive queries is immediately, because
it triggered none. Fix: if the next step needs the new value, read it from the mutation response,
or await a `refetchQueries` (which always fetches) rather than an invalidation.

**★ Symptom: a mutation's `onSettled` invalidation seems to run before the mutation reports
success.** Cause: the returned promise was not returned. The optimistic-updates guide is explicit
that you should *"make sure to _return_ the Promise from the query invalidation"* so the mutation
stays `pending` until the refetch lands. Fix: `onSettled: () => queryClient.invalidateQueries(…)`
with no braces, or an explicit `return`. Without it the button re-enables while the list is still
loading and the user clicks again.

**★ Symptom: `refetchQueries` with no filter takes the app down under load.** Cause: it matches
everything and fetches everything, simultaneously, with no staleness check and no observer check —
including every paged variant of every infinite list the session has ever scrolled. Fix: there is
almost no legitimate unfiltered `refetchQueries`. Scope it to a prefix and, in a UI-triggered case,
to `type: 'active'`.

**★ Symptom: you cancelled queries and the fetch still overwrote your write.** Cause:
`cancelQueries` returns a promise and you did not await it, so `setQueryData` ran while the request
was still resolving. Fix: `await queryClient.cancelQueries({ queryKey })` before the first write —
the docs' own optimistic example awaits it, and the awaiting is the entire point of the call.

## Interview questions

**★ `invalidateQueries` or `refetchQueries` after a successful mutation — which, and why?**
Invalidation, in almost every case. It marks everything that matched as stale and refetches only what
is currently rendered — *"If the query is currently being rendered via `useQuery` or related hooks, it
will also be refetched in the background"* — so the screens the user is looking at update now and the
ones they are not cost nothing until they are mounted again. A forced refetch does the work
unconditionally: every matched query hits the network whether it was fresh, and whether anyone is
observing it. `refetchQueries` earns its place when "now" is the actual requirement, such as a manual
Refresh control, and not as a stronger-sounding synonym for invalidation.

**★ Walk me through all four verbs and what each does to the next rendered frame.**
`invalidateQueries` keeps the data and flips a stale flag, refetching only active matches — the user
sees the old content with `isFetching` true, then the new content, and never a spinner on a warm
cache. `refetchQueries` also keeps the data but fetches unconditionally, so the visible outcome is
identical and only the request count differs. `resetQueries` discards the data back to the query's
initial state, so a mounted observer re-enters `pending` and the user sees your loading branch.
`removeQueries` deletes the entry entirely and issues nothing, so a mounted observer has nothing to
read and an unmounted one starts from scratch on its next mount. The first two are non-destructive
and interchangeable in appearance; the last two are destructive and are the ones that cause the "why
is it flashing" bug reports.

**★ When is `resetQueries` the right call rather than `invalidateQueries`?**
When showing the currently cached value for another moment would be *incorrect*, not merely out of
date. A tenant switch, a logout, a search form whose filters no longer describe the visible result
set, an abandoned wizard whose partial state must not be resumed. Invalidation's whole benefit —
keeping the old data on screen while the new arrives — is a liability in those cases, because the
old data belongs to a context that no longer applies. Outside them, reset trades a documented
stale-while-revalidate render for a spinner and buys nothing.

**★ You are told to clear cached data on logout. What exactly do you call, and what breaks if you
invalidate instead?**
`queryClient.clear()`, or `removeQueries` on the identity-bearing prefixes if parts of the cache are
genuinely user-independent. Invalidation would leave every cached value in place and only schedule
refetches — so the moment the next user's shell mounts, the first frame renders the previous user's
data from cache before any request resolves. That is a real cross-user disclosure, it reproduces
only on a shared device or a fast re-login, and it survives every test that checks the *second*
frame. `resetQueries` is closer but still leaves entries carrying `initialData`; removal is the only
verb that guarantees nothing is left.

**★ Why does `removeQueries` exist when `gcTime` already cleans up unused queries?**
Because garbage collection is about memory and time, and removal is about correctness and intent.
Important Defaults says *"By default, 'inactive' queries are garbage collected after 5 minutes"* —
which means a logout followed by a re-login inside five minutes finds every one of the previous
user's entries still resident and immediately renderable. `gcTime` also cannot express "this
particular entity is gone from the server, forget it exists". Removal is the explicit,
now-not-later form; garbage collection is the ambient policy that catches everything you did not
think about.

**★ What is the relationship between `cancelQueries` and the other four?**
It is orthogonal, and it is the only one that is not about staleness. The other four decide what the
cache should contain and when it should be re-read; `cancelQueries` stops requests that are already
in flight so they cannot land *after* something else has written. That matters in exactly one
pattern — an optimistic update, where the docs' own example opens with *"Cancel any outgoing
refetches (so they don't overwrite our optimistic update)"*. It has to be awaited, because the goal
is to be certain nothing is still resolving when your `setQueryData` runs.

---

← [Filtering by state](./01c-filtering-by-state-type-stale-predicate.md) · [Topic index](../README.md) · Next → [Direct cache access](./01e-direct-cache-access.md)
