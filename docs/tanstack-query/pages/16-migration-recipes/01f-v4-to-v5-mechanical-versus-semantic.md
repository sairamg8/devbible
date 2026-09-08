---
title: "The v4 → v5 upgrade sorts into three classes, not two — and which class a given change lands in depends on whether your codebase is TypeScript, because the type checker is the only tool on earth that can find the middle one"
sidebar_label: "01f · Mechanical vs semantic"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) (re-read 2026-09-08 for the full change list), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching). Documentation-validated; **no sandbox run, no timings**. ⚠️ Where a sentence below is not in quotation marks it is a summary of the guide, not the guide's wording — the guide is the authority for any change you are actually applying. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🧭 Three Classes of Change, and the One Nothing Finds

**[`01`](./01-rtk-query-to-tanstack-query.md) split migrations into mechanical and semantic. That is the right first cut, but applying it to the actual v4 → v5 change list produces three piles, not two, and the middle pile is the interesting one: changes where the *identifier is gone* — a removed option, a removed callback — which a TypeScript compiler reports as an error and a JavaScript runtime reports as nothing at all.** So the same upgrade is a routine afternoon in a typed codebase and a genuinely hazardous one in an untyped codebase, with the *same list of changes*. That asymmetry is the single most useful thing to know before you start, because it changes the order of work: in a JS codebase there is no middle pile, every removal is a silent behaviour change, and the greps in §4 are not optional hygiene — they are the whole audit.

## 1. The three classes

| Class | What it is | Who finds it | Honest review comment |
|---|---|---|---|
| **1 · Mechanical** | old name and new name mean the same thing | codemod, `sed`, or the compiler | *"renamed, no behaviour change"* — and it is true |
| **2 · Removed** | the identifier no longer exists | 🔴 **TypeScript only.** JS ignores an unknown option and never calls a removed callback | *"deleted, replaced with X"* — verify X is actually equivalent |
| **3 · Semantic** | it still compiles, still runs, and means something different | 🔴 **nobody** | there is no honest short review comment; you have to check behaviour |

🔴 **Class 2 collapses into class 3 in a JavaScript codebase.** `keepPreviousData: true` passed to `useQuery` in v5 is an object property nothing reads — no warning, no throw, just a paginated table that starts blanking between pages. In TypeScript the same line is a compile error on an object literal. **This is why the first commit of a v4 → v5 upgrade should not touch TanStack Query at all.**

## 2. The order of work, and why the library bump comes third

v5 raises two peer requirements — *"requires React 18.0 or later"* (it uses `useSyncExternalStore`) and TypeScript 4.7 minimum. It is tempting to do all three bumps in one commit. Don't:

1. **React ≥ 18 first, shipped on its own.** It has its own migration (concurrent rendering, `StrictMode` double-invocation, the root API) and none of it is about data fetching. Bundling it means every subsequent bug report is ambiguous.
2. **TypeScript ≥ 4.7 second, and get the codebase type-clean under `strict`.** In a typed codebase this is the step that *buys* you the class-2 audit for free. If the project is JavaScript, this is the moment to decide whether `checkJs` on the data layer alone is worth an afternoon — it usually is, purely for this upgrade.
3. **Then `@tanstack/react-query` v5**, on its own, with a bisectable history.

**The point is not tidiness.** It is that class-3 changes are found by observing behaviour, and behaviour observation is worthless if three unrelated upgrades landed together.

## 3. The change list, sorted

### Class 1 — mechanical

| v4 | v5 | Note |
|---|---|---|
| `useQuery(key, fn, options)` and every other positional overload | object form only — *"now we only support the object format"* | the codemod's whole job; see §3a |
| `cacheTime` | `gcTime` | renamed *because* the old name misled: *"Almost everyone gets `cacheTime` wrong…"*, *"`cacheTime` does nothing as long as a query is still in use. It only kicks in as soon as the query becomes unused."* |
| `useErrorBoundary` | `throwOnError` | renamed to describe what it does |
| `hashQueryKey` | `hashKey` | *"because it also hashes mutation keys"* |
| `Hydrate` component | `HydrationBoundary` | *"the `Hydrate` component has been renamed to `HydrationBoundary` and the `useHydrate` hook has been removed"* |
| `isDataEqual` | a `structuralSharing` function | strictly more expressive |
| `refetchPage` | the `maxPages` option on infinite queries | not a rename — read the option before assuming equivalence |

### Class 2 — removed, and therefore loud *only in TypeScript*

| Removed | Replacement | 🔴 What JavaScript does instead |
|---|---|---|
| `onSuccess`, `onError`, `onSettled` **on queries** — *"`onSuccess`, `onError` and `onSettled` have been removed from Queries"* | derive in render, or `useEffect` on `data` | the callbacks are simply never called. Toasts stop appearing; analytics events stop firing; nothing logs |
| `keepPreviousData` option and the `isPreviousData` flag | `placeholderData: keepPreviousData` (the imported helper), plus `isPlaceholderData` | the option is ignored and the flag is `undefined` — so a paginated table blanks between pages and the "showing stale" affordance silently never renders. See [`01g` of topic 08](../08-dependent-and-parallel-queries/01g-placeholderdata-in-a-chain.md) |
| `result.remove()` | `queryClient.removeQueries({ queryKey })` | 💥 this one *does* throw — `remove is not a function` — so it is loud in both languages |
| the custom `logger` | none; it is gone | *"Custom loggers were already deprecated in 4 and have been removed in this version"* — the option is ignored, and a team that routed query errors into its logger loses that stream silently |
| `contextSharing` on `QueryClientProvider`, and the custom `context` prop | pass a distinct `QueryClient` instance | the prop is ignored, so a micro-frontend that relied on it silently shares — or stops sharing — one client |
| `useHydrate` | `HydrationBoundary` | import error — loud everywhere |
| manual `pageParams` overwriting via `fetchNextPage` / `fetchPreviousPage` | none | the argument is ignored and pagination quietly follows `getNextPageParam` instead |
| the `dehydrateMutations` / `dehydrateQueries` booleans | the function equivalents | ignored; you dehydrate more, or less, than you meant to |

### Class 3 — 🔴 still compiles, means something else

| Change | Why nothing catches it |
|---|---|
| **`status: 'loading'` → `'pending'`** | `status === 'loading'` is a valid string comparison. In TS the narrowed union makes it an error; **in JS it is a branch that can never be true**, so the spinner stops rendering and the next line reads a property of `undefined`. → [`01h`](./01h-the-status-rename-and-the-isloading-trap.md) |
| **`isLoading` → `isPending`, and `isInitialLoading` → `isLoading`** | 🔴 the worst one in the release, because `isLoading` did not disappear — it **moved**. Every `isLoading` in your codebase still compiles, in both languages, and now means *"no data **and** a request is in flight"*. → [`01h`](./01h-the-status-rename-and-the-isloading-trap.md) |
| **`getNextPageParam` returning `null`** now indicates there is no further page | `null` used to be an ordinary value. A cursor API that legitimately returns `null` for "no cursor on this response, ask again" now terminates the list at page one, and the UI just… stops, with no error |
| **`refetchInterval` as a function** now receives only the `query` | a v4 callback written `(data) => data?.done ? false : 5_000` is now handed a `Query` object. `query.done` is `undefined`, so the expression polls forever. The mirrored version polls never. TS flags it; JS does not |
| **`retry` defaults to `0` on the server** — *"`retry` now defaults to `0` instead of `3`"* | nothing to change and nothing to grep for. Your SSR render now fails fast where it used to retry through a transient blip, which is almost certainly what you want — but it is a behaviour change in production only |
| **`getQueryDefaults` merges all matching registrations** — *"`queryClient.getQueryDefaults` will now merge together all matching registrations instead of returning only the first"* | if you registered defaults for `['users']` and `['users','detail']`, the second now inherits the first instead of replacing it. Strictly better, and it will change effective options you never audited. [Global Configuration](../13-global-configuration/01-defaultoptions.md) |
| **`initialPageParam` is now required** — *"you now have to pass an explicit `initialPageParam`"* | TS errors; **JS gets `undefined` as the first page param** and calls your `queryFn` with it, which usually means a request for page `undefined` |
| **`prefetchQuery` / `ensureQueryData` → `queryClient.query()`** | 🔴 **not on the migration guide at all** — the deprecation landed *inside* v5, so it is not a v4→v5 line item and a team working the guide top to bottom will never see it. The rename compiles and converts a swallowed failure into a thrown one. → [`01n`](./01n-prefetchquery-to-queryclient-query.md) |
| **the third mutation callback argument is now named `onMutateResult`** | the *position* did not change, so code keeps working and every doc sentence about `context` now means the fourth parameter. → [`01d`](./01d-rtk-query-mutations-and-rollback.md) |

### 3a. The codemod does class 1, and tells you where it failed

The official codemod handles the signature change. Its documented limits are the useful part:

> *"The codemod is a best efforts attempt"*
> *"there are edge cases that cannot be found by the code mod"*

It infers the object form where the first argument is an array literal or an object with a `queryKey`/`mutationKey`, and where it cannot infer — a key built by a helper, options spread from a variable, a hook wrapped in your own abstraction — **it leaves a console message rather than a wrong transform.**

🔴 **Those console messages are the residual worklist, and they are printed once and lost.** Capture them:

```bash
# Run the codemod with its output tee'd — the console messages ARE the audit list
npx jscodeshift ./src \
  --extensions=ts,tsx --parser=tsx \
  --transform=./node_modules/@tanstack/react-query/build/codemods/v5/remove-overloads/remove-overloads.cjs \
  2>&1 | tee /tmp/tq-codemod.log

grep -c . /tmp/tq-codemod.log     # every line is a call site you must hand-port
```

⚠️ **Check the codemod's path and invocation against the version you install** — the package layout has moved between releases, and this page does not run a sandbox. The guide is the authority.

**Commit the codemod's output on its own, with nothing else in the diff.** It touches hundreds of lines, and a hand-edit hidden inside that diff will never be reviewed.

## 4. The audit greps — the part no tool does

After the codemod and the class-1 renames, this is the actual work. Each row is a grep and a decision, not a replace.

| Grep | Why | Decision at each hit |
|---|---|---|
| `isLoading` | class 3, the rotation | does this site mean *"no data"* → `isPending`, or *"first fetch in flight"* → `isLoading`? → [`01h`](./01h-the-status-rename-and-the-isloading-trap.md) |
| `isInitialLoading` | renamed onto `isLoading` | mechanical **only** if you also verify the site wanted the new meaning |
| `=== 'loading'` / `!== 'loading'` / `case 'loading'` | dead branch in JS | → `'pending'` |
| `onSuccess` / `onError` / `onSettled` | is this on a **query** or a **mutation**? | on a mutation: keep. On a query: gone — rewrite as derived state |
| `keepPreviousData` | option → helper | `placeholderData: keepPreviousData`, and `isPreviousData` → `isPlaceholderData` |
| `cacheTime` | class 1 | `gcTime`. ⚠️ also check **units** if the value came from an RTK Query port — see [`01b`](./01b-rtk-query-the-option-by-option-map.md) |
| `useErrorBoundary` | class 1 | `throwOnError` |
| `refetchInterval:` followed by `(` | class 3, silent | the callback now receives `query`, not `data` |
| `getNextPageParam` / `getPreviousPageParam` | class 3, silent | can it return `null` meaning anything other than "the end"? |
| `initialPageParam` | now required | every `useInfiniteQuery` and every `queryClient.infiniteQuery` must have one |
| `prefetchQuery` / `ensureQueryData` / `fetchQuery` | deprecated, not in the guide | → [`01n`](./01n-prefetchquery-to-queryclient-query.md) — this is the one that changes error handling |
| `logger` near `QueryClient` | removed | where do query errors go now? |

🔴 **Run every one of these even after a clean TypeScript build.** The compiler covers class 2 and about half of class 3; `refetchInterval`, `getNextPageParam` returning `null`, and every `isLoading` site are decisions a type checker cannot make for you.

## Gotchas

**★ Symptom: the upgrade is clean in CI and a paginated table starts flashing empty between pages in production.** Cause: `keepPreviousData: true` is now an unrecognised option. In a JavaScript codebase — or a TypeScript one where the options object is built in a helper and typed loosely — it is silently ignored. Fix: `placeholderData: keepPreviousData` using the imported helper, and change `isPreviousData` to `isPlaceholderData`. The flag matters: it is what dims the table while the new page loads.

**★ Symptom: toasts, analytics events or cache side effects that used to fire on every successful query stop firing, and nothing errors.** Cause: *"`onSuccess`, `onError` and `onSettled` have been removed from Queries"* — the properties are ignored, not rejected. Fix: derive the effect from `data` in render, or a `useEffect` keyed on `data`. Note this is not a straight port: the removed callbacks ran once per fetch, and a `useEffect` on `data` runs when the *value* changes, which is deliberately different and is the reason they were removed.

**★ Symptom: an infinite list stops after one page against an API that was paginating fine yesterday.** Cause: `getNextPageParam` returns `null` for a response with no cursor, and in v5 `null` means "there is no further page." Fix: return the next cursor or `undefined` only when the list is genuinely exhausted, and never let `null` leak out of a response mapper as a stand-in for "missing field."

**★ Symptom: a poll that used to stop when the job finished now runs forever, or never starts.** Cause: the `refetchInterval` callback signature changed to receive only `query`. A v4 callback reading `data.status` gets `undefined` from a `Query` object and falls to whichever branch that produces. Fix: read `query.state.data`, and check the site rather than assuming — polling detail is in [`01c` of topic 06](../06-background-refetching/01c-polling-and-refetch-interval.md).

**★ Symptom: the codemod's diff is enormous and a reviewer approves it in thirty seconds.** Cause: that is what a mechanical diff of every `useQuery` call site looks like, and it is exactly where a hand-written change becomes invisible. Fix: the codemod commit contains only codemod output. Every hand-port from its console log is a separate, small, reviewable commit.

**★ Symptom: some call sites were not transformed and nobody knew.** Cause: *"there are edge cases that cannot be found by the code mod"* — it declines rather than guessing, printing a console message. Console output scrolls away. Fix: `tee` the run to a file and treat the file as the worklist. A wrapped hook (`useUsers()` calling `useQuery` with a spread options object) is the classic uninferrable case, and also the one most likely to be used in fifty places.

**★ Symptom: query errors vanish from your logging pipeline after the upgrade.** Cause: the custom `logger` was removed — *"Custom loggers were already deprecated in 4 and have been removed in this version"* — and passing it is now ignored. Fix: route errors from `QueryCache`'s `onError` when you construct the client, which is also where a global error toast belongs. [Global Configuration](../13-global-configuration/01-defaultoptions.md) covers the client-construction surface.

**★ Symptom: query defaults that used to apply now behave differently for nested keys.** Cause: *"`queryClient.getQueryDefaults` will now merge together all matching registrations instead of returning only the first."* Registering defaults for `['users']` and separately for `['users','detail']` used to give the detail key only its own registration; now it inherits both. Fix: nothing usually — the new behaviour is what people assumed all along — but audit the registrations, because an option you thought you had overridden may now be inherited from a broader key.

**★ Symptom: SSR renders that used to survive a flaky upstream now fail on the first error.** Cause: *"`retry` now defaults to `0` instead of `3`"* on the server. Fix: this is the right default — three retries inside a server render is latency the user waits through — but if you were unknowingly depending on it, set `retry` explicitly on the server client rather than being surprised in an incident. Combine with [`01n`](./01n-prefetchquery-to-queryclient-query.md), because prefetch errors now throw as well.

**★ Symptom: you bumped React, TypeScript and TanStack Query together and cannot attribute any of the resulting bugs.** Cause: two of v5's breaking changes are *peer version floors*, so it feels like one job. Fix: three commits, ideally three deploys. Class-3 changes are detected by observing behaviour, and behaviour observation requires that only one thing changed.

**★ Symptom: a JavaScript codebase's upgrade goes far worse than a colleague's TypeScript one, using the same guide.** Cause: class 2 does not exist in JavaScript. Every removed option is silently ignored and every removed callback silently never runs, so nine changes that would have been compile errors become production behaviour changes. Fix: accept that the greps in §4 *are* the audit, not a supplement to it — and consider turning on `checkJs` for the data-access modules for the duration of the upgrade.

**★ Symptom: `remove is not a function` in production.** Cause: `result.remove()` was removed from the query result. Fix: `queryClient.removeQueries({ queryKey })`. This one is genuinely loud in both languages, which makes it the *easiest* item on the list — worth noticing, because it is the exception that shows how quiet the others are.

## Interview questions

**★ Why is a v4 → v5 upgrade materially more dangerous in a JavaScript codebase than a TypeScript one, given the change list is identical?**
Because roughly a third of the changes are *removals* — `onSuccess`/`onError`/`onSettled` on queries, `keepPreviousData`, `isDataEqual`, the custom logger, `contextSharing`. TypeScript reports every one of those as an error on an object literal. JavaScript ignores an unknown property and never calls a callback nobody reads, so each one becomes a silent behaviour change: toasts stop firing, tables blank between pages, errors stop reaching your logger. The same list is a compile-time worklist in one language and a production-incident generator in the other.

**★ Sort these into mechanical, removed and semantic: `cacheTime` → `gcTime`; `keepPreviousData`; `isLoading`.**
`cacheTime` → `gcTime` is mechanical — same meaning, a `sed` is an honest fix, and the rename happened precisely because the old name misled about *when* it applies. `keepPreviousData` is removed — the option and the `isPreviousData` flag are gone, replaced by `placeholderData` taking the previous data as an argument, so it is a compile error in TS and silence in JS. `isLoading` is semantic and it is the worst kind: the identifier survives, so it compiles everywhere, and its meaning rotated — `isLoading` now means what `isInitialLoading` meant, `isPending` means what `isLoading` meant. Nothing in any toolchain can tell you which meaning a given call site wanted.

**★ What are the codemod's limits, and what should you do with the part it does not do?**
It is explicitly *"a best efforts attempt"* with *"edge cases that cannot be found by the code mod"*. It transforms the positional-to-object signature where it can infer the shape, and where it cannot — a key from a helper, options spread from a variable, `useQuery` wrapped inside your own hook — it declines and prints a console message instead of guessing wrong. That output is the residual worklist and it is ephemeral, so tee it to a file. And the codemod's diff should be its own commit with nothing else in it, because a hundred-file mechanical diff is where a hand-edit goes to hide from review.

**★ Why should the library bump be the third commit rather than the first?**
Because v5 requires React ≥ 18 and TypeScript ≥ 4.7, and both of those have migrations of their own. Landing them together makes every subsequent bug unattributable — and attribution is the *only* tool available for class-3 changes, which are found by noticing behaviour rather than by any compiler. Doing TypeScript first has a second payoff: in a typed codebase the type checker converts every removal into a build error, which is the cheapest audit in the whole upgrade.

**★ Name a v5 change that no tool of any kind will find for you, and say what it does.**
`getNextPageParam` returning `null`. In v5, `null` from `getNextPageParam` or `getPreviousPageParam` means there is no further page. If your response mapper returns `null` for a missing cursor field — a very ordinary thing for a mapper to do — your infinite list terminates after page one. It compiles, it type-checks, it throws nothing, and it renders a plausible-looking single page. The `refetchInterval` callback signature change is the same category: the callback now receives the `Query` rather than the data, so a v4 predicate reading `data.status` silently polls forever or never.

**★ Which v5 change is not in the migration guide at all, and why does that matter?**
The deprecation of `prefetchQuery`, `fetchQuery` and `ensureQueryData` in favour of `queryClient.query()`. It landed *within* the v5 line rather than at the v4 → v5 boundary, so it is documented on the prefetching guide and not the migration guide — meaning a team working the migration guide top to bottom will complete the upgrade and never encounter it. It matters because the replacement has a different error contract: `query()` *"will either resolve with the data or throw with an error"* where `prefetchQuery` swallowed failures.

**Is `getQueryDefaults` merging all matching registrations a breaking change worth auditing?**
It is a change in effective configuration that produces no diff, which is the definition of worth auditing. Registering defaults for `['users']` and again for `['users','detail']` previously gave the detail key only its own registration; now it inherits the broader one too. The new behaviour is what almost everyone assumed, so it usually *fixes* things — but any option you believed you had overridden by registering a narrower key is now inherited instead, and you will find that out from behaviour, not from a build.

---

← [Running both caches at once](./01e-running-both-caches-at-once.md) · [Topic index](../README.md) · Next → [The status rename](./01h-the-status-rename-and-the-isloading-trap.md)
