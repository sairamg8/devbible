---
title: "`isLoading` did not disappear in v5, it rotated onto a narrower meaning — which is why every one of its call sites still compiles in both TypeScript and JavaScript, and why no compiler on earth can tell you which of them are now wrong"
sidebar_label: "01h · The status rename"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) (the three rename sentences are quoted verbatim below), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🎭 The Rename That Rotated

**Three names moved in v5 and they moved in a *cycle*, which is categorically different from a rename and much worse than a removal.** `status: 'loading'` became `'pending'`; `isLoading` became `isPending`; and then `isInitialLoading` — a flag most codebases had never used — was renamed onto the now-vacant `isLoading`. So the identifier you have written two hundred times did not vanish. It survived, it still type-checks, it still runs, and it now answers a strictly narrower question. [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) classified this as the release's worst class-3 change and handed it here. This page is the mechanism, the three concrete failure modes with code, and the per-call-site decision rule that no codemod can make for you. **The audit — how to find every site across a real codebase, and where the flags hide from your grep — is [`01j`](./01j-auditing-a-codebase-for-the-rotation.md).**

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
  const { status, data, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoice(id),
  });

  if (status === 'loading') return <Skeleton />;   // 💀 v5 never produces 'loading'
  if (status === 'error') return <ErrorBanner error={error} />;

  return <h1>{data.customer.name}</h1>;            // 💥 data is undefined on the first render
}
```

In **TypeScript** this is a compile error, because `status` is the union `'pending' | 'error' | 'success'` and comparing it to `'loading'` has no overlap — the checker rejects the comparison rather than silently evaluating it false. That is the single most useful thing the type system does in this whole upgrade.

In **JavaScript** it is a string comparison against a string that no longer exists. It is `false` forever. The skeleton stops rendering, control falls to the last line, and `data` is `undefined` on the very first render of every mount — so the symptom is not a missing spinner, it is a `TypeError` on a property of `undefined` at the top of the component. Every `switch (status)` with `case 'loading':` is the same bug wearing a different syntax, and a `switch` with a `default:` arm hides it better.

The fix is textual — `'loading'` → `'pending'` — and it applies to **mutation** status comparisons too. The documented v5 mutation vocabulary is *"isIdle or status === 'idle'"* · *"isPending or status === 'pending'"* · *"isError or status === 'error'"* · *"isSuccess or status === 'success'"*, so `'loading'` is dead on both sides. ⚠️ The one thing to notice at a mutation hit is the extra `'idle'` state, which queries do not have: a branch ported from a query `switch` will not cover it. [`01j`](./01j-auditing-a-codebase-for-the-rotation.md) §3 has the full mutation treatment.

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

  // 💥 userId undefined -> query disabled -> isLoading false, data undefined
  return <h1>{data.name}</h1>;
}
```

With `userId` undefined the query never runs: `status` is `'pending'`, `fetchStatus` is `'idle'`, therefore `isFetching` is false, therefore v5's `isLoading` — *"implemented as `isPending && isFetching`"* — is **false**. Both guards are false and the render reaches `data.name` with `data` still `undefined`. The identical failure occurs with `skipToken`, and it occurs on a fully enabled query when the browser is offline, where `fetchStatus` is `'paused'` rather than `'fetching'`.

```tsx
// ✅ The v5 shape. isPending answers "is there data?"; isLoading answers "is a first fetch running?"
function UserPanel({ userId }: { userId?: string }) {
  const { data, isPending, isLoading, isError } = useQuery({
    queryKey: ['users', 'detail', userId],
    queryFn: () => fetchUser(userId!),
    enabled: !!userId,
  });

  if (isError) return <ErrorBanner />;

  // isPending = no data. isLoading then distinguishes "coming" from "not coming".
  if (isPending) return isLoading ? <Spinner /> : <PickAUserPrompt />;

  return <h1>{data.name}</h1>;       // data is narrowed to defined by isPending being false
}
```

**Note what the correct version buys you beyond not crashing.** The disabled case now renders something honest — *"pick a user"* — instead of a spinner that spins forever waiting for a request nobody is going to make. The v4 code could not distinguish those two states at all without reaching for `fetchStatus`; the rotation exists precisely so that it can.

## 4. Failure mode 3 — `isInitialLoading` read off a v5 result

```tsx
// v4 code that was already doing the RIGHT thing, and is now the thing that silently breaks.
function Orders() {
  const { data, isInitialLoading, isFetching } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  if (isInitialLoading) return <FullPageSkeleton />;   // 💀 the property does not exist in v5
  // ✅ v5:  if (isLoading) return <FullPageSkeleton />;   — same meaning, new name

  return <OrdersTable rows={data} refreshing={isFetching} />;
}
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
  const { data, isPending, isError } = useQuery({
    queryKey: ['orders', customerId],
    queryFn: () => fetchOrders(customerId!),
    enabled: !!customerId,
  });

  if (isError) return <ErrorPage />;
  if (isPending) return <OrdersSkeleton />;

  return <OrdersTable rows={data} />;
}
```

```tsx
// SITE 2 — inline spinner beside a filter control. The filter is part of the query key, so changing it
// makes a NEW key with no data: pending + fetching. That is exactly isLoading, and isLoading is right
// here because the control itself must stay mounted and interactive while the fetch runs.
function StatusFilter({ status }: { status: OrderStatus }) {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', { status }],
    queryFn: () => fetchOrders({ status }),
  });

  return (
    <div className="filter-row">
      <StatusSelect value={status} />
      {isLoading && <InlineSpinner />}
      <ResultCount value={data?.length ?? 0} />
    </div>
  );
}
```

```tsx
// SITE 3 — the subtle top-bar refresh bar. This must light up for BACKGROUND refetches of data already
// on screen — window focus, reconnect, invalidation — so neither isPending nor isLoading works.
// -> isFetching, which is true for every fetch including the first.
function RefreshBar() {
  const isFetching = useIsFetching();          // any query, app-wide
  return isFetching > 0 ? <TopProgressBar /> : null;
}
```

Site 3 is the one people get wrong in the *other* direction: a page that used `isLoading` in v4 for its top bar was showing the bar only on cold loads and never on refreshes, and the v5 rename does not fix that — it is a pre-existing bug the audit is a good moment to notice.

## Gotchas

**★ Symptom: `Cannot read properties of undefined` at the top of a component, on first render, on a route that used to work.** Cause: a `status === 'loading'` guard in a JavaScript codebase. v5 never produces `'loading'`, so the comparison is permanently false and execution falls through to the data access. Fix: `'pending'`. In TypeScript this is a compile error and you will never see the runtime form of it — which is the clearest single argument for typing the data layer before the upgrade.

**★ Symptom: the upgrade is clean everywhere except pages with an optional route parameter, which crash on first paint.** Cause: `enabled: !!param` plus a v4 `isLoading` guard. Disabled means `status: 'pending'`, `fetchStatus: 'idle'`, so v5's `isLoading` — `isPending && isFetching` — is false, both guards fall through, and `data` is `undefined`. Fix: `isPending` for the "no data" guard, and keep `isLoading` only if you additionally want to distinguish "fetching now" from "waiting for input", as in §3.

**★ Symptom: the same crash on a page with no `enabled` option anywhere.** Cause: the user was offline. `fetchStatus` is `'paused'`, not `'fetching'`, so `isLoading` is false while `isPending` is true. Fix: same as above — and note that this one cannot be avoided by "we don't use disabled queries", which is the reasoning that keeps this bug in codebases.

**★ Symptom: a full-page skeleton silently stopped appearing after the upgrade, and nothing errors.** Cause: `isInitialLoading` no longer exists on the result, so in JavaScript it is `undefined` and the branch is dead. Fix: rename to `isLoading` — this one really is a pure rename. The symptom is a page that flashes empty rather than a crash, so it reaches production more often than §2 does.

**★ Symptom: you renamed `isInitialLoading` → `isLoading` first, and now cannot tell which `isLoading` sites you have already reviewed.** Cause: the rotation collides in the middle — the new name and the old name are the same token, so a half-finished audit is indistinguishable from an unstarted one. Fix: do the `isLoading` → `isPending` decision pass **first**, in its own commit, then rename `isInitialLoading` → `isLoading`; or do both in one commit. Never the other order.

**★ Symptom: a spinner spins forever on a screen where the query is intentionally disabled.** Cause: over-correcting — you replaced every `isLoading` with `isPending` mechanically, and `isPending` is true forever for a query that will never run. Fix: this is the *safe* failure and it is fine as an intermediate state, but the finished shape is `if (isPending) return isLoading ? <Spinner /> : <WaitingForInput />`, which distinguishes "coming" from "not coming" — the distinction the rotation was introduced to make possible.

**★ Symptom: a `switch (status)` looks correct in review and is dead.** Cause: `case 'loading':` with a `default:` arm that renders something plausible. The `default` swallows `'pending'` and the reviewer sees a switch that handles everything. Fix: in TypeScript, remove the `default` and let exhaustiveness checking on the narrowed union do the work; in JavaScript, grep the case labels, not the switch.

**★ Symptom: you switched a guard to `isPending` and now the loading UI never renders at all, on a query that definitely fetches.** Cause: the query has `initialData` or `placeholderData`, so there is data in the result from the very first render — `status` is `'success'` immediately and `isPending` is therefore false forever. The v4 `isLoading` had the same property, but people rarely noticed because the placeholder was the point. Fix: for a query with placeholder data the flag you want is `isPlaceholderData` (or `isFetching` for the refresh affordance), not a pending flag — see [`01g` of topic 08](../08-dependent-and-parallel-queries/01g-placeholderdata-in-a-chain.md). Reaching for `isPending` here is the one case where the safe-default advice in §5 gives you a guard that can never fire.

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

**Why did the library make this change at all, given the cost?**
Because the v4 vocabulary conflated two questions the library had always tracked separately. `status` answers *"The status gives information about the data: Do we have any or not?"* and `fetchStatus` answers *"Is it running or not?"* — and v4's `isLoading` was named for the second question while implementing the first, which is precisely why so many codebases showed a spinner on a query that was never going to fetch. The rename makes the names match the axes: `isPending` is the `status` axis, `isFetching` is the `fetchStatus` axis, and `isLoading` is their conjunction. The migration cost is real; the naming afterwards is coherent in a way v4's was not.

---

← [Mechanical vs semantic](./01f-v4-to-v5-mechanical-versus-semantic.md) · [Topic index](../README.md) · Next → [Auditing a codebase for the rotation](./01j-auditing-a-codebase-for-the-rotation.md)
