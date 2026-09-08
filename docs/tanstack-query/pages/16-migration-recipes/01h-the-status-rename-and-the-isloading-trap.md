---
title: "`isLoading` did not disappear in v5, it rotated onto a narrower meaning — which is why every one of its call sites still compiles in both TypeScript and JavaScript, and why no compiler on earth can tell you which of them are now wrong"
sidebar_label: "01h · The status rename"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) (the three rename sentences are quoted verbatim below), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🎭 The Rename That Rotated

**Three names moved in v5 and they moved in a *cycle*, which is categorically different from a rename and much worse than a removal.** `status: 'loading'` became `'pending'`; `isLoading` became `isPending`; and then `isInitialLoading` — a flag most codebases had never used — was renamed onto the now-vacant `isLoading`. So the identifier you have written two hundred times did not vanish. It survived, it still type-checks, it still runs, and it now answers a strictly narrower question. [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) classified this as the release's worst class-3 change and handed it here. This page is the mechanism, the three concrete failure modes with code, the per-call-site decision rule that no codemod can make for you, and the audit.

## 1. The rotation

The guide states the two moves in two sentences, in two different sections, and the danger is entirely in reading them together:

> *"`status: loading` has been changed to `status: pending` and `isLoading` has been changed to `isPending`"*
> *"`isInitialLoading` has now been renamed to `isLoading`"* — now *"implemented as `isPending && isFetching`"*

| v4 | v5 | What the v5 name means |
|---|---|---|
| `status: 'loading'` | `status: 'pending'` | there is no data and no error for this key |
| `isLoading` | `isPending` | `status === 'pending'` — there is no data |
| `isInitialLoading` | **`isLoading`** | `isPending && isFetching` — no data **and** a request is in flight right now |

**A removal is safe. A rotation is not.** If v5 had deleted `isLoading` outright, TypeScript would have flagged every site and JavaScript would have handed you `undefined` — falsy, so the loading branch would have silently stopped rendering, which is bad but at least uniform and greppable by its symptom. Instead the name landed on a *different, narrower, still-plausible* flag. Every site keeps compiling. Every site keeps producing a boolean. And the sites where the old and new meanings coincide — a plain, always-enabled, online query — are the overwhelming majority, so the upgrade looks completely clean in dev and in most of your tests.

🔴 **The two meanings diverge in exactly one situation: `isPending` is true and nothing is fetching.** That is a query with `enabled: false`, a query gated with `skipToken`, a dependent query still waiting on its precondition, or any query paused because the browser is offline. In v4 those all rendered the loading branch. In v5 they fall straight through it.

## 2. Failure mode 1 — `status === 'loading'`, a branch that can never be true

```tsx
// v4 code, unchanged, running on v5.
function Invoice({ id }: { id: string }) {
  const { status, data, error } = useQuery({ queryKey: ['invoice', id], queryFn: () => fetchInvoice(id) });
  if (status === 'loading') return <Skeleton />;   // 💀 v5 never produces 'loading'
  if (status === 'error') return <ErrorBanner error={error} />;
  return <h1>{data.customer.name}</h1>;            // 💥 data is undefined on the first render
}
```

In **TypeScript** this is a compile error, because `status` is the union `'pending' | 'error' | 'success'` and comparing it to `'loading'` has no overlap — the checker rejects the comparison rather than silently evaluating it false. That is the single most useful thing the type system does in this whole upgrade.

In **JavaScript** it is a string comparison against a string that no longer exists. It is `false` forever. The skeleton stops rendering, control falls to the last line, and `data` is `undefined` on the very first render of every mount — so the symptom is not a missing spinner, it is a `TypeError` on a property of `undefined` at the top of the component. Every `switch (status)` with `case 'loading':` is the same bug wearing a different syntax, and a `switch` with a `default:` arm hides it better.

The fix is textual — `'loading'` → `'pending'` — and it applies to **mutation** status comparisons too. The documented v5 mutation vocabulary is *"isIdle or status === 'idle'"* · *"isPending or status === 'pending'"* · *"isError or status === 'error'"* · *"isSuccess or status === 'success'"*, so `'loading'` is dead on both sides. ⚠️ The one thing to notice at a mutation hit is the extra `'idle'` state, which queries do not have: a branch ported from a query `switch` will not cover it.

## 3. Failure mode 2 — `isLoading` survives with the narrower meaning

This is the one that ships.

```tsx
// v4 code, unchanged, running on v5. Compiles. Type-checks. Passes every test that has a network.
function UserPanel({ userId }: { userId?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', 'detail', userId],
    queryFn: () => fetchUser(userId!),
    enabled: !!userId,               // 🔴 the line that makes the rotation matter
  });
  if (isLoading) return <Spinner />;
  if (isError) return <ErrorBanner />;
  return <h1>{data.name}</h1>;       // 💥 userId is undefined -> query disabled -> isLoading is false, data is undefined
}
```

With `userId` undefined the query never runs: `status` is `'pending'`, `fetchStatus` is `'idle'`, therefore `isFetching` is false, therefore v5's `isLoading` — *"implemented as `isPending && isFetching`"* — is **false**. Both guards are false and the render reaches `data.name` with `data` still `undefined`. The identical failure occurs with `skipToken`, and it occurs on a fully enabled query when the browser is offline, where `fetchStatus` is `'paused'` rather than `'fetching'`.

```tsx
// ✅ The v5 shape. isPending answers "is there data?"; isLoading answers "is a first fetch running?"
function UserPanel({ userId }: { userId?: string }) {
  const { data, isPending, isLoading, isError } = useQuery({ queryKey: ['users', 'detail', userId], queryFn: () => fetchUser(userId!), enabled: !!userId });
  if (isError) return <ErrorBanner />;
  if (isPending) return isLoading ? <Spinner /> : <PickAUserPrompt />;
  return <h1>{data.name}</h1>;       // data is narrowed to defined by isPending being false
}
```

**Note what the correct version buys you beyond not crashing.** The disabled case now renders something honest — *"pick a user"* — instead of a spinner that spins forever waiting for a request nobody is going to make. The v4 code could not distinguish those two states at all without reaching for `fetchStatus`; the rotation exists precisely so that it can.

## 4. Failure mode 3 — `isInitialLoading` read off a v5 result

```tsx
// v4 code that was already doing the RIGHT thing, and is now the thing that silently breaks.
const { data, isInitialLoading, isFetching } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });
if (isInitialLoading) return <FullPageSkeleton />;   // 💀 the property does not exist in v5
// ✅ v5:  if (isLoading) return <FullPageSkeleton />;   — same meaning, new name
return <OrdersTable rows={data} refreshing={isFetching} />;
```

In **TypeScript**, destructuring a property that is not on the result type is an error, so this is loud. In **JavaScript**, `isInitialLoading` is `undefined` — falsy — so the full-page skeleton *never renders again*. The failure here is the opposite shape to §2: nothing crashes, the page just flashes empty or renders a zero-row table for the duration of the first fetch, which is easy to mistake for slow data rather than a broken branch.

The fix is a rename to `isLoading`, and it is the one identifier in this whole family that is a genuine mechanical rename — same meaning, new name.

🔴 **The two renames must land in the same commit.** If you change `isInitialLoading` → `isLoading` before changing the old `isLoading` → `isPending`, you now have two different `isLoading` sites in the same file meaning two different things, and you have destroyed the only signal — "which of these did I already look at?" — that makes the audit finishable.

## 5. The decision rule — the part no tool can do

A codemod can rename `isInitialLoading`. It cannot touch `isLoading`, because deciding what a given site *meant* requires knowing what the UI is for. Three questions, in order:

```text
For each `isLoading` site, ask what the surrounding JSX is actually gating:
  "I need a fallback because there is NO DATA to render"
        -> isPending          (v4's isLoading; the safe default when unsure)
  "A FIRST fetch is in flight right now — data is coming, show a spinner"
        -> isLoading          (v5's meaning; excludes disabled/paused/offline)
  "ANY fetch, including a background refresh of data already on screen"
        -> isFetching         (never was isLoading; check you did not mean this all along)
```

**When you cannot tell, choose `isPending`.** It is a superset of `isLoading` — every render where `isLoading` is true, `isPending` is true too — so choosing it can only make you render a fallback in *more* situations, never fewer. Over-rendering a skeleton for a disabled query is a cosmetic bug; under-rendering it is a `TypeError` in production.

### 5a. Three worked call sites

```tsx
// SITE 1 — page-level skeleton. There is nothing else on screen; the question is "do we have data?"
// -> isPending. Using isLoading here reintroduces the §3 crash the moment the route param is missing.
function OrdersPage({ customerId }: { customerId?: string }) {
  const { data, isPending, isError } = useQuery({ queryKey: ['orders', customerId], queryFn: () => fetchOrders(customerId!), enabled: !!customerId });
  if (isError) return <ErrorPage />;
  if (isPending) return <OrdersSkeleton />;
  return <OrdersTable rows={data} />;
}
// SITE 2 — inline spinner beside a filter control. The filter is part of the query key, so changing it makes a
// NEW key with no data: pending + fetching. That is exactly isLoading, and isLoading is right here because the
// control itself must stay mounted and interactive while the fetch runs.
function StatusFilter({ status }: { status: OrderStatus }) {
  const { data, isLoading } = useQuery({ queryKey: ['orders', { status }], queryFn: () => fetchOrders({ status }) });
  return (
    <div className="filter-row">
      <StatusSelect value={status} />
      {isLoading && <InlineSpinner />}
      <ResultCount value={data?.length ?? 0} />
    </div>
  );
}
// SITE 3 — the subtle top-bar refresh bar. This must light up for BACKGROUND refetches of data already on
// screen — window focus, reconnect, invalidation — so neither isPending nor isLoading works. -> isFetching,
// which is true for every fetch including the first.
function RefreshBar() {
  const isFetching = useIsFetching();          // any query, app-wide
  return isFetching > 0 ? <TopProgressBar /> : null;
}
```

Site 3 is the one people get wrong in the *other* direction: a page that used `isLoading` in v4 for its top bar was showing the bar only on cold loads and never on refreshes, and the v5 rename does not fix that — it is a pre-existing bug the audit is a good moment to notice.

## 6. Mutations are a separate trap, and a better one

A mutation result has `isPending`. **It does not have `isLoading` at all.** The mutations guide enumerates the mutation status vocabulary exhaustively — *"isIdle or status === 'idle'"* · *"isPending or status === 'pending'"* · *"isError or status === 'error'"* · *"isSuccess or status === 'success'"* — and `isLoading` is not among them.

```tsx
// ❌ A v4 mutation call site, unchanged. In JS this is the double-submit bug.
const { mutate, isLoading } = useMutation({ mutationFn: saveInvoice });
return <button onClick={() => mutate(draft)} disabled={isLoading}>Save</button>;
//                                                    ^^^^^^^^^ undefined -> falsy -> never disabled
// ✅ v5
const { mutate, isPending } = useMutation({ mutationFn: saveInvoice });
return <button onClick={() => mutate(draft)} disabled={isPending}>Save</button>;
```

`disabled={undefined}` is not a React error; it renders an enabled button. So the save button stays clickable for the whole round trip and an impatient user submits the same invoice three times. **This is a data-integrity bug, not a rendering bug**, and it is invisible in any test that awaits the mutation before asserting. In TypeScript the destructure is an error; in JavaScript it ships. [`01d`](./01d-rtk-query-mutations-and-rollback.md) has the full mutation-result rename table, and [Mutation lifecycle](../05-usemutation/01-mutation-lifecycle.md) the surrounding surface.

⚠️ **I could not find a migration-guide sentence that states the absence explicitly** — the absence is inferred from the mutations guide enumerating the four flags above with no `isLoading` among them, plus the guide's own *"`isLoading` has been changed to `isPending`"*. Treat the direction as certain and confirm the exact type surface against the typings you install.

## 7. Why `status` × `fetchStatus` makes the rotation obvious

[Query States](../03-query-states/01-status-flags.md) is the canonical treatment of the two axes and this page does not repeat it. One combination is worth restating here because it *is* the rotation:

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*
> *"Background refetches and stale-while-revalidate logic make all combinations"*

| `status` | `fetchStatus` | `isPending` | `isLoading` (v5) | What it is |
|---|---|---|---|---|
| `'pending'` | `'fetching'` | ✅ | ✅ | the genuine first load — the only cell where the two agree |
| `'pending'` | `'idle'` | ✅ | 🔴 **false** | disabled, `skipToken`, or waiting on a dependency — **the §3 crash lives here** |
| `'pending'` | `'paused'` | ✅ | 🔴 **false** | offline before any data arrived — same crash, on a query you never disabled |
| `'success'` | `'fetching'` | ❌ | ❌ | background refetch — `isFetching` only |

**Two of the four pending cells are false for `isLoading`, and one of them requires no configuration on your part at all.** Any user on a flaky connection can reach the `'paused'` row on a query you thought was always enabled — see [network mode and offline](../06-background-refetching/01d-network-mode-and-offline.md). This is why "our queries are all enabled, the rotation cannot bite us" is wrong. The devtools panel shows both axes side by side ([status/fetchStatus matrix](../11-devtools/01b-status-and-fetchstatus-matrix.md)), which is the fastest way to see a disabled query sitting in the pending/idle cell.

## 8. The audit — three identifiers, one decision each

[`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) §4 lists the greps for the whole release. This is the deep version for these three identifiers, where the grep is not the work — the per-hit decision is.

```bash
# 1. Dead string comparisons. Mechanical, but check query-vs-mutation at each hit.
grep -rn "['\"]loading['\"]" src/ --include=*.ts --include=*.tsx --include=*.js --include=*.jsx
# 2. The pure rename. Same meaning, new name.
grep -rn 'isInitialLoading' src/
# 3. 🔴 The real audit. Every hit is a judgement call from §5.
grep -rn 'isLoading' src/
# 4. Heuristic: hits whose surrounding lines mention useMutation. These become isPending, always.
grep -rn -B4 'isLoading' src/ | grep 'useMutation'
```

| Hit | Decision |
|---|---|
| `status === 'loading'`, `case 'loading':`, `status !== 'loading'` on a **query** | → `'pending'`. Purely textual |
| `status === 'loading'` on a **mutation** | → `'pending'` as well; the v5 mutation vocabulary is `idle`/`pending`/`error`/`success`. Check the branch also handles `'idle'`, which has no query equivalent |
| `isInitialLoading` | → `isLoading`. Mechanical, but land it in the same commit as the `isLoading` → `isPending` pass (§4) |
| `isLoading` destructured from `useMutation` | → `isPending`, unconditionally. No judgement needed |
| `isLoading` destructured from `useQuery`, and the query has `enabled`, `skipToken`, or is a dependent query | 🔴 → almost certainly `isPending`. This is the crash set |
| `isLoading` destructured from `useQuery` with no gating at all | apply §5: gating a whole-page fallback → `isPending`; gating a spinner beside live content → `isLoading` is probably right and is now *more* correct than it was |
| `isLoading` returned from your own wrapper hook | 🔴 the hardest hit — see §10 |
| `isLoading` inside a test assertion | → whichever flag the component now reads; a test asserting the old flag will pass for the wrong reason |

## 9. TypeScript is the mitigation, and here is its exact limit

| Change | TypeScript | JavaScript |
|---|---|---|
| `status === 'loading'` | ✅ **error** — the union narrowed and the comparison has no overlap | 🔴 silently `false` forever |
| `isInitialLoading` | ✅ **error** — property does not exist on the result type | 🔴 `undefined`, falsy, branch never renders |
| `isLoading` from `useMutation` | ✅ **error** — property does not exist on the mutation result | 🔴 `undefined`, button never disables |
| **`isLoading` from `useQuery`** | 🔴 **clean at every single site** | 🔴 clean at every single site |

🔴 **The type checker finds three of the four, and misses the only one that is dangerous.** `isLoading` exists on the v5 query result with type `boolean`, so every destructure, every `if`, every JSX conditional type-checks perfectly — the compiler has no way to know that this particular boolean answers a different question than it did last week. A green build after a v4 → v5 upgrade is evidence about `status` strings and `isInitialLoading`, and evidence about nothing else.

**In a JavaScript codebase the grep is the entire audit**, for all four rows. Turning on `checkJs` for the data-access modules for the duration of the upgrade buys you the first three rows and is usually worth the afternoon — but it still does not buy you the fourth, so budget the per-call-site pass either way.

## 10. The residue — where the flags hide from your grep

**Your own wrapper hooks.** A `useUsers()` that does `return useQuery({ ... })` re-exports the whole result and every consumer destructures `isLoading` from *your* hook, not from `useQuery`. Grepping `useQuery` finds one file; the meaning changed in fifty. Worse is the wrapper that renames on the way out — `return { loading: isLoading, ...rest }` — because now the identifier your components read does not appear in any of the greps in §8. **Grep for the names your wrappers export, not just the library's.**

**Tests and harnesses.** An assertion written against the old flag can pass for the wrong reason: a test that awaits a spinner keyed on `isPending` passes whether the component means "no data" or "first fetch in flight", because in a test with a live mock both are true. The cases that distinguish them are disabled queries and paused ones, and a default test harness has neither — see [mocking at the network layer](../15-testing-tanstack-query/01b-mocking-at-the-network-layer.md). If you want the rotation covered, the test you need is *a component rendered with its query disabled, asserting it does not crash*.

**`select` does not change any of this.** `select` transforms `data`; it does not touch `status` or `fetchStatus`, so a `select` that returns a default value — `select: (d) => d ?? []` — still leaves `data` as `undefined` while the query is pending, because `select` is not called at all when there is no data. Do not read a "safe" `select` as protection against §3.

**Suspense removes the branch entirely.** `useSuspenseQuery` suspends until data exists, so the pending branch is unreachable and `data` is typed as `T` rather than `T | undefined` — *"When using suspense mode, `status` states and `error` objects are not needed and are then replaced by usage of the `React.Suspense` component."* Migrating a component to suspense during the same upgrade means the `isLoading` question stops applying to it; doing both at once means you cannot tell which change fixed or broke what. See [what suspense mode removes](../10-suspense-integration/01b-what-suspense-mode-removes.md).

⚠️ **Persisted or dehydrated v4 caches carrying the old `'loading'` status string: I could not confirm the behaviour from the documentation and am not asserting it.** The plausible concern — a persisted cache written by a v4 build being rehydrated by a v5 build — is worth testing directly if you use a persister, but nothing on the migration guide settles what v5 does with it, so treat it as an open question and verify in your own app rather than trusting an assertion here.

**The retry default lengthens every window in this page.** *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."* Four attempts have to fail before `status` becomes `'error'`, and during that whole stretch the query is pending — so a wrongly-chosen flag is on screen for seconds, not milliseconds, which is exactly long enough for a user to click something twice.

## Gotchas

**★ Symptom: `Cannot read properties of undefined` at the top of a component, on first render, on a route that used to work.** Cause: a `status === 'loading'` guard in a JavaScript codebase. v5 never produces `'loading'`, so the comparison is permanently false and execution falls through to the data access. Fix: `'pending'`. In TypeScript this is a compile error and you will never see the runtime form of it — which is the clearest single argument for typing the data layer before the upgrade.

**★ Symptom: the upgrade is clean everywhere except pages with an optional route parameter, which crash on first paint.** Cause: `enabled: !!param` plus a v4 `isLoading` guard. Disabled means `status: 'pending'`, `fetchStatus: 'idle'`, so v5's `isLoading` — `isPending && isFetching` — is false, both guards fall through, and `data` is `undefined`. Fix: `isPending` for the "no data" guard, and keep `isLoading` only if you additionally want to distinguish "fetching now" from "waiting for input", as in §3.

**★ Symptom: the same crash on a page with no `enabled` option anywhere.** Cause: the user was offline. `fetchStatus` is `'paused'`, not `'fetching'`, so `isLoading` is false while `isPending` is true. Fix: same as above — and note that this one cannot be avoided by "we don't use disabled queries", which is the reasoning that keeps this bug in codebases.

**★ Symptom: a full-page skeleton silently stopped appearing after the upgrade, and nothing errors.** Cause: `isInitialLoading` no longer exists on the result, so in JavaScript it is `undefined` and the branch is dead. Fix: rename to `isLoading` — this one really is a pure rename. The symptom is a page that flashes empty rather than a crash, so it reaches production more often than §2 does.

**★ Symptom: users create duplicate records by double-clicking Save.** Cause: `const { isLoading } = useMutation(...)` — mutation results never had an `isLoading` and certainly do not now, so `disabled={undefined}` renders an enabled button for the entire round trip. Fix: `isPending`. Add a test that clicks the button twice without awaiting, because the natural test awaits the mutation and can never observe the window.

**★ Symptom: TypeScript compiles clean and you conclude the flag audit is done.** Cause: `isLoading` exists on the v5 query result as a `boolean`, so every site type-checks; the compiler cannot know the question changed. Fix: treat a green build as covering `status` strings, `isInitialLoading` and mutation `isLoading` only, then run the §8 grep by hand. This is the single most common way the rotation survives an otherwise careful upgrade.

**★ Symptom: you renamed `isInitialLoading` → `isLoading` first, and now cannot tell which `isLoading` sites you have already reviewed.** Cause: the rotation collides in the middle — the new name and the old name are the same token, so a half-finished audit is indistinguishable from an unstarted one. Fix: do the `isLoading` → `isPending` decision pass **first**, in its own commit, then rename `isInitialLoading` → `isLoading`; or do both in one commit. Never the other order.

**★ Symptom: a spinner spins forever on a screen where the query is intentionally disabled.** Cause: over-correcting — you replaced every `isLoading` with `isPending` mechanically, and `isPending` is true forever for a query that will never run. Fix: this is the *safe* failure and it is fine as an intermediate state, but the finished shape is `if (isPending) return isLoading ? <Spinner /> : <WaitingForInput />`, which distinguishes "coming" from "not coming" — the distinction the rotation was introduced to make possible.

**★ Symptom: a wrapper hook's consumers were never audited because the grep only found one `useQuery`.** Cause: `useUsers()` returns the query result wholesale, or re-exports it under a different name (`{ loading: isLoading }`). Fix: grep for what your wrappers export as well as what the library exports, and fix the meaning at the wrapper boundary once rather than at fifty consumers — a wrapper is the one place where a single edit is genuinely correct for all its callers.

**★ Symptom: tests all pass, and the disabled-query crash still reaches production.** Cause: in a test harness with a working mock, `isPending` and `isLoading` are true simultaneously for the whole loading window, so no assertion can tell them apart. Fix: add a render of the component with its query disabled — no `userId`, `skipToken`, or `enabled: false` — and assert it renders its empty state rather than throwing. That single test is the entire regression guard for this change.

**★ Symptom: `select` returning a default made you confident the crash cannot happen.** Cause: `select` runs on data, and there is no data while the query is pending, so it does not run at all — `data` is `undefined` regardless of what `select` would have returned. Fix: the guard is still required; `select` narrows nothing about availability.

**★ Symptom: a `switch (status)` looks correct in review and is dead.** Cause: `case 'loading':` with a `default:` arm that renders something plausible. The `default` swallows `'pending'` and the reviewer sees a switch that handles everything. Fix: in TypeScript, remove the `default` and let exhaustiveness checking on the narrowed union do the work; in JavaScript, grep the case labels, not the switch.

**★ Symptom: your top-bar refresh indicator never lights up on a background refetch, before or after the upgrade.** Cause: it was gated on `isLoading`, which never covered background refetches in either version — v4's `isLoading` meant "no data", v5's means "no data and fetching". Fix: `isFetching`, or `useIsFetching()` for an app-wide bar. This is a pre-existing bug the audit surfaces rather than one the upgrade causes, and it is worth fixing while you are in the file.

## Interview questions

**★ Why is a rotation more dangerous than a removal, and which specific rotation shipped in TanStack Query v5?**
A removal breaks loudly in at least one dimension: TypeScript errors on a missing property, and JavaScript yields `undefined`, which is falsy and therefore uniformly disables a branch. A rotation puts a *different* value behind the same name, so the code compiles, runs, and produces a plausible boolean everywhere — there is no dimension in which it is loud. v5 rotated three names: `status: 'loading'` → `'pending'`, `isLoading` → `isPending`, and then `isInitialLoading` → the now-free `isLoading`, *"implemented as `isPending && isFetching`"*. The third move is what turns two renames into a rotation, and it is the reason a green TypeScript build proves nothing about your loading states.

**★ Exactly when do v4's `isLoading` and v5's `isLoading` disagree?**
When `status` is `'pending'` and `fetchStatus` is not `'fetching'` — that is, when there is no data *and* no request is running. Concretely: `enabled: false`, `skipToken`, a dependent query waiting on its precondition, and any query paused because the browser is offline (`fetchStatus: 'paused'`). In every other state they agree, which is why the upgrade looks clean: the common case of an always-enabled query on a working connection goes pending-and-fetching straight to success and both flags follow the same path. The disagreement set is small, entirely composed of edge states, and contains every crash.

**★ You have a `useQuery` site with `isLoading` and cannot tell what the author intended. What do you pick and why?**
`isPending`. It is a strict superset — anywhere `isLoading` is true, `isPending` is true — so the worst outcome of choosing it is rendering a fallback in states where you did not need one, which is cosmetic. Choosing `isLoading` wrongly means the fallback does not render in a state where `data` is `undefined`, which is a `TypeError`. Once the site is safe you can refine it: the finished form for a page-level guard is `if (isPending) return isLoading ? <Spinner /> : <EmptyState />`, which uses both flags for the two different questions they now answer.

**★ Why can no codemod do this change, when the codemod handles the far larger signature migration?**
Because the signature change is syntactic — a positional call has exactly one object-form equivalent, derivable from the source text. The flag change is semantic: `isLoading` at a given site should become `isPending`, stay `isLoading`, or become `isFetching`, and which one is correct depends on what the surrounding JSX is for. A tool would have to know whether that spinner covers the whole page or sits beside live content, and whether the query can ever be disabled. The most a tool can honestly do is list the sites — which is exactly what a grep does, so the grep is the tool.

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

**Why did the library make this change at all, given the cost?**
Because the v4 vocabulary conflated two questions the library had always tracked separately. `status` answers *"The status gives information about the data: Do we have any or not?"* and `fetchStatus` answers *"Is it running or not?"* — and v4's `isLoading` was named for the second question while implementing the first, which is precisely why so many codebases showed a spinner on a query that was never going to fetch. The rename makes the names match the axes: `isPending` is the `status` axis, `isFetching` is the `fetchStatus` axis, and `isLoading` is their conjunction. The migration cost is real; the naming afterwards is coherent in a way v4's was not.

---

← [Mechanical vs semantic](./01f-v4-to-v5-mechanical-versus-semantic.md) · [Topic index](../README.md) · Next → [`prefetchQuery` → `queryClient.query()`](./01n-prefetchquery-to-queryclient-query.md)
