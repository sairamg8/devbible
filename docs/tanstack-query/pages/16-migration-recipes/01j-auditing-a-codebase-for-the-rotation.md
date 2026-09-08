---
title: "Auditing a real codebase for the rotation: the type checker finds three of the four failure modes and misses the only dangerous one, and the flags you most need to find are the ones your own wrapper hooks re-export under different names"
sidebar_label: "01j · Auditing for the rotation"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations) (v5-pinned path), [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🔦 Finding Every Site

**[`01h`](./01h-the-status-rename-and-the-isloading-trap.md) established what the rotation is and how to decide any single call site. This page is the part that takes the week: finding them.** The audit has an unusual shape, because the tool you would reach for first — the type checker — catches three of the four failure modes and is structurally incapable of catching the fourth. And the sites that matter most are frequently invisible to a grep for the library's own identifiers, because they come out of a wrapper hook your team wrote. This page is the mutation trap, the state table that makes the disagreement visible, the greps with a decision at each hit, TypeScript's exact limit, and the residue.

## 1. Mutations are a separate trap, and a better one

A mutation result has `isPending`. **It does not have `isLoading` at all.** The mutations guide enumerates the mutation status vocabulary exhaustively — *"isIdle or status === 'idle'"* · *"isPending or status === 'pending'"* · *"isError or status === 'error'"* · *"isSuccess or status === 'success'"* — and `isLoading` is not among them.

```tsx
// ❌ A v4 mutation call site, unchanged. In JS this is the double-submit bug.
function SaveButton({ draft }: { draft: InvoiceDraft }) {
  const { mutate, isLoading } = useMutation({ mutationFn: saveInvoice });

  //                                    isLoading is undefined -> falsy -> never disabled
  return <button onClick={() => mutate(draft)} disabled={isLoading}>Save</button>;
}
```

```tsx
// ✅ v5 — isPending is the only "in flight" flag a mutation has.
function SaveButton({ draft }: { draft: InvoiceDraft }) {
  const { mutate, isPending } = useMutation({ mutationFn: saveInvoice });

  return <button onClick={() => mutate(draft)} disabled={isPending}>Save</button>;
}
```

`disabled={undefined}` is not a React error; it renders an enabled button. So the save button stays clickable for the whole round trip and an impatient user submits the same invoice three times. **This is a data-integrity bug, not a rendering bug**, and it is invisible in any test that awaits the mutation before asserting. In TypeScript the destructure is an error; in JavaScript it ships. [`01d`](./01d-rtk-query-mutations-and-rollback.md) has the full mutation-result rename table, and [Mutation lifecycle](../05-usemutation/01-mutation-lifecycle.md) the surrounding surface.

⚠️ **I could not find a migration-guide sentence that states the absence explicitly** — the absence is inferred from the mutations guide enumerating the four flags above with no `isLoading` among them, plus the guide's own *"`isLoading` has been changed to `isPending`"*. Treat the direction as certain and confirm the exact type surface against the typings you install.

## 2. Why `status` × `fetchStatus` makes the rotation obvious

[Query States](../03-query-states/01-status-flags.md) is the canonical treatment of the two axes and this page does not repeat it. One combination is worth restating here because it *is* the rotation:

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*
> *"Background refetches and stale-while-revalidate logic make all combinations"*

| `status` | `fetchStatus` | `isPending` | `isLoading` (v5) | What it is |
|---|---|---|---|---|
| `'pending'` | `'fetching'` | ✅ | ✅ | the genuine first load — the only cell where the two agree |
| `'pending'` | `'idle'` | ✅ | 🔴 **false** | disabled, `skipToken`, or waiting on a dependency — **the crash lives here** |
| `'pending'` | `'paused'` | ✅ | 🔴 **false** | offline before any data arrived — same crash, on a query you never disabled |
| `'success'` | `'fetching'` | ❌ | ❌ | background refetch — `isFetching` only |

**Two of the four pending cells are false for `isLoading`, and one of them requires no configuration on your part at all.** Any user on a flaky connection can reach the `'paused'` row on a query you thought was always enabled — see [network mode and offline](../06-background-refetching/01d-network-mode-and-offline.md). This is why "our queries are all enabled, the rotation cannot bite us" is wrong. The devtools panel shows both axes side by side ([status/fetchStatus matrix](../11-devtools/01b-status-and-fetchstatus-matrix.md)), which is the fastest way to see a disabled query sitting in the pending/idle cell.

## 3. The audit — three identifiers, one decision each

[`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) §4 lists the greps for the whole release. This is the deep version for these three identifiers, where the grep is not the work — the per-hit decision is.

```bash
# 1. Dead string comparisons. Mechanical, but check query-vs-mutation at each hit.
grep -rn "['\"]loading['\"]" src/ \
  --include=*.ts --include=*.tsx --include=*.js --include=*.jsx

# 2. The pure rename. Same meaning, new name.
grep -rn 'isInitialLoading' src/

# 3. 🔴 The real audit. Every hit is a judgement call from 01h §5.
grep -rn 'isLoading' src/

# 4. Heuristic: hits whose surrounding lines mention useMutation.
#    These become isPending, always — no judgement needed.
grep -rn -B4 'isLoading' src/ | grep 'useMutation'
```

| Hit | Decision |
|---|---|
| `status === 'loading'`, `case 'loading':`, `status !== 'loading'` on a **query** | → `'pending'`. Purely textual |
| `status === 'loading'` on a **mutation** | → `'pending'` as well; the v5 mutation vocabulary is `idle`/`pending`/`error`/`success`. Check the branch also handles `'idle'`, which has no query equivalent |
| `isInitialLoading` | → `isLoading`. Mechanical, but land it in the same commit as the `isLoading` → `isPending` pass ([`01h`](./01h-the-status-rename-and-the-isloading-trap.md) §4) |
| `isLoading` destructured from `useMutation` | → `isPending`, unconditionally. No judgement needed |
| `isLoading` destructured from `useQuery`, and the query has `enabled`, `skipToken`, or is a dependent query | 🔴 → almost certainly `isPending`. This is the crash set |
| `isLoading` destructured from `useQuery` with no gating at all | apply [`01h`](./01h-the-status-rename-and-the-isloading-trap.md) §5: gating a whole-page fallback → `isPending`; gating a spinner beside live content → `isLoading` is probably right and is now *more* correct than it was |
| `isLoading` returned from your own wrapper hook | 🔴 the hardest hit — see §5 |
| `isLoading` inside a test assertion | → whichever flag the component now reads; a test asserting the old flag will pass for the wrong reason |

## 4. TypeScript is the mitigation, and here is its exact limit

| Change | TypeScript | JavaScript |
|---|---|---|
| `status === 'loading'` | ✅ **error** — the union narrowed and the comparison has no overlap | 🔴 silently `false` forever |
| `isInitialLoading` | ✅ **error** — property does not exist on the result type | 🔴 `undefined`, falsy, branch never renders |
| `isLoading` from `useMutation` | ✅ **error** — property does not exist on the mutation result | 🔴 `undefined`, button never disables |
| **`isLoading` from `useQuery`** | 🔴 **clean at every single site** | 🔴 clean at every single site |

🔴 **The type checker finds three of the four, and misses the only one that is dangerous.** `isLoading` exists on the v5 query result with type `boolean`, so every destructure, every `if`, every JSX conditional type-checks perfectly — the compiler has no way to know that this particular boolean answers a different question than it did last week. A green build after a v4 → v5 upgrade is evidence about `status` strings and `isInitialLoading`, and evidence about nothing else.

**In a JavaScript codebase the grep is the entire audit**, for all four rows. Turning on `checkJs` for the data-access modules for the duration of the upgrade buys you the first three rows and is usually worth the afternoon — but it still does not buy you the fourth, so budget the per-call-site pass either way.

## 5. The residue — where the flags hide from your grep

**Your own wrapper hooks.** A `useUsers()` that does `return useQuery({ ... })` re-exports the whole result and every consumer destructures `isLoading` from *your* hook, not from `useQuery`. Grepping `useQuery` finds one file; the meaning changed in fifty. Worse is the wrapper that renames on the way out — `return { loading: isLoading, ...rest }` — because now the identifier your components read does not appear in any of the greps in §3. **Grep for the names your wrappers export, not just the library's.**

**Tests and harnesses.** An assertion written against the old flag can pass for the wrong reason: a test that awaits a spinner keyed on `isPending` passes whether the component means "no data" or "first fetch in flight", because in a test with a live mock both are true. The cases that distinguish them are disabled queries and paused ones, and a default test harness has neither — see [mocking at the network layer](../15-testing-tanstack-query/01b-mocking-at-the-network-layer.md). If you want the rotation covered, the test you need is *a component rendered with its query disabled, asserting it does not crash*.

**`select` does not change any of this.** `select` transforms `data`; it does not touch `status` or `fetchStatus`, so a `select` that returns a default value — `select: (d) => d ?? []` — still leaves `data` as `undefined` while the query is pending, because `select` is not called at all when there is no data. Do not read a "safe" `select` as protection against the crash.

**Suspense removes the branch entirely.** `useSuspenseQuery` suspends until data exists, so the pending branch is unreachable and `data` is typed as `T` rather than `T | undefined` — *"When using suspense mode, `status` states and `error` objects are not needed and are then replaced by usage of the `React.Suspense` component."* Migrating a component to suspense during the same upgrade means the `isLoading` question stops applying to it; doing both at once means you cannot tell which change fixed or broke what. See [what suspense mode removes](../10-suspense-integration/01b-what-suspense-mode-removes.md).

⚠️ **Persisted or dehydrated v4 caches carrying the old `'loading'` status string: I could not confirm the behaviour from the documentation and am not asserting it.** The plausible concern — a persisted cache written by a v4 build being rehydrated by a v5 build — is worth testing directly if you use a persister, but nothing on the migration guide settles what v5 does with it, so treat it as an open question and verify in your own app rather than trusting an assertion here.

**The retry default lengthens every window in this page.** *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."* Four attempts have to fail before `status` becomes `'error'`, and during that whole stretch the query is pending — so a wrongly-chosen flag is on screen for seconds, not milliseconds, which is exactly long enough for a user to click something twice.

## Gotchas

**★ Symptom: users create duplicate records by double-clicking Save.** Cause: `const { isLoading } = useMutation(...)` — mutation results never had an `isLoading` and certainly do not now, so `disabled={undefined}` renders an enabled button for the entire round trip. Fix: `isPending`. Add a test that clicks the button twice without awaiting, because the natural test awaits the mutation and can never observe the window.

**★ Symptom: TypeScript compiles clean and you conclude the flag audit is done.** Cause: `isLoading` exists on the v5 query result as a `boolean`, so every site type-checks; the compiler cannot know the question changed. Fix: treat a green build as covering `status` strings, `isInitialLoading` and mutation `isLoading` only, then run the §3 grep by hand. This is the single most common way the rotation survives an otherwise careful upgrade.

**★ Symptom: a wrapper hook's consumers were never audited because the grep only found one `useQuery`.** Cause: `useUsers()` returns the query result wholesale, or re-exports it under a different name (`{ loading: isLoading }`). Fix: grep for what your wrappers export as well as what the library exports, and fix the meaning at the wrapper boundary once rather than at fifty consumers — a wrapper is the one place where a single edit is genuinely correct for all its callers.

**★ Symptom: tests all pass, and the disabled-query crash still reaches production.** Cause: in a test harness with a working mock, `isPending` and `isLoading` are true simultaneously for the whole loading window, so no assertion can tell them apart. Fix: add a render of the component with its query disabled — no `userId`, `skipToken`, or `enabled: false` — and assert it renders its empty state rather than throwing. That single test is the entire regression guard for this change.

**★ Symptom: the flag audit is finished and a `'loading'` string comparison is still live in the codebase.** Cause: code that inspects the cache directly rather than through a hook — `queryClient.getQueryState(key)` and the `QueryCache` subscription callbacks hand you `status` and `fetchStatus`, never the derived `isLoading`/`isPending` booleans. A grep organised around the flag names skips all of it, and this is exactly where global error reporters, analytics wrappers and devtools-ish internal panels live. Fix: run the `'loading'` string grep from §3 across the whole repo, not just component files, and treat every cache-inspection site as a query hit — the vocabulary changed there identically.

**★ Symptom: `select` returning a default made you confident the crash cannot happen.** Cause: `select` runs on data, and there is no data while the query is pending, so it does not run at all — `data` is `undefined` regardless of what `select` would have returned. Fix: the guard is still required; `select` narrows nothing about availability.

## Interview questions

**★ A team upgrades a large JavaScript codebase, CI is green, and three days later they get reports of duplicate orders. What happened?**
`const { isLoading } = useMutation(...)` on the submit button. Mutation results expose `isPending`, `isError`, `isSuccess` and `isIdle`; `isLoading` is not among them, so the destructure yields `undefined`, `disabled={undefined}` renders an enabled button, and the button stays clickable for the whole request. It took three days because it needs an impatient user on a slow request, and it survived CI because the natural test awaits the mutation before asserting and so never observes the window. In TypeScript this would have been a compile error on day zero — it is the cleanest single example of what typing the data layer buys you during this upgrade.

**★ What exactly does a clean `tsc` run prove after a v4 → v5 upgrade, and what does it not?**
It proves that no code compares `status` to `'loading'` (the union narrowed, so the comparison has no overlap and is an error), that no code reads `isInitialLoading` off a query result, and that no code reads `isLoading` off a mutation result — three of the four failure modes. It proves nothing whatsoever about `isLoading` on query results, because that property exists with type `boolean` at every site and the compiler cannot know its meaning changed. So the type checker eliminates the noisy failures and leaves the quiet one entirely to you, which is the opposite of the usual reassurance a green build provides.

**★ How would you write the one regression test that actually covers this change?**
Render the component with its query disabled — no route parameter, `skipToken`, or `enabled: false` — and assert it renders its empty or waiting state without throwing. That is the only configuration in which v4's and v5's `isLoading` disagree, so it is the only test that can fail for this reason. A conventional loading test with a working mock cannot distinguish the flags, because in that harness `isPending` and `isLoading` are both true for the entire loading window and both false afterwards.

**★ Someone argues the rotation is harmless because their queries are all enabled. Are they right?**
No, for two reasons. First, offline: a paused query has `fetchStatus: 'paused'`, so `isLoading` is false while `isPending` is true, on a query nobody disabled — any flaky connection reproduces the crash. Second, `enabled` has a habit of arriving later: the first time someone adds an optional filter or a dependent query to an existing screen, every `isLoading` in that file quietly changes behaviour, and the diff that introduced it will not mention loading states at all. The rotation is a latent property of the codebase, not a one-time migration event.

**Does `select` protect you from the undefined-data crash?**
No. `select` transforms the data the query resolved; while the query is pending there is no data and `select` is not invoked, so `data` is `undefined` no matter what a defaulting `select` would have returned. It is a common false reassurance because `select: (d) => d ?? []` reads exactly like a null-safety measure. The availability guard is still required, and the flag it should use is `isPending`.

---

← [The status rename](./01h-the-status-rename-and-the-isloading-trap.md) · [Topic index](../README.md) · Next → [`prefetchQuery` → `queryClient.query()`](./01n-prefetchquery-to-queryclient-query.md)
