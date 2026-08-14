---
title: "StrictMode double-invocation"
sidebar_label: "05 · StrictMode double-invocation"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`StrictMode`](https://react.dev/reference/react/StrictMode),
> [`useEffect`](https://react.dev/reference/react/useEffect) (Caveats) and
> [`useState`](https://react.dev/reference/react/useState) (Caveats).
> The measured development-vs-production console output for this behaviour lives
> on [Phase 0 · 07](../phase-0-how-react-runs/07-strictmode.md) and is referenced
> rather than repeated. No sandbox script backs this page.

**Two earlier pages have covered what `StrictMode` is
([Phase 0 · 07](../phase-0-how-react-runs/07-strictmode.md), with the measured
output) and how it tests purity
([Phase 2 · 02.03](../phase-2-components/02-purity/03-strictmode-and-the-compiler.md)).
This page is the effects half in detail: exactly what the extra cycle asserts,
and — more usefully — the effect bugs it will *not* catch.**

## The claim being tested

> When Strict Mode is on, React will also run **one extra setup+cleanup cycle in
> development for every Effect.** This may feel surprising, but it helps reveal
> subtle bugs that are hard to catch manually.

So the sequence at mount is **setup → cleanup → setup** where production runs
**setup**. And the assertion is the invariant from
[topic 04](04-cleanup/01-the-cleanup-contract.md): if those two are
indistinguishable to the user, the effect is correct. If they are not, the
cleanup is incomplete.

That is the whole mechanism. It is a single, narrow test — which is why knowing
its edges matters more than knowing it exists.

## 🔴 It only doubles the *mount*

The most useful thing to know about `StrictMode` is where it stops. From the
`useEffect` caveats:

> When Strict Mode is on, React will run one extra development-only
> setup+cleanup cycle **before the first real setup.**

*Before the first real setup* — not before every setup. The extra cycle is
attached to mounting, not to re-running. Phase 0's measurement shows exactly
this shape: two setups and **one** cleanup on mount, not two of each.

The consequence is the part people miss. Consider an effect whose cleanup is
correct for teardown but wrong for a dependency change:

```jsx
useEffect(() => {
  const conn = createConnection(serverUrl, roomId);
  conn.connect();
  activeConnections.push(conn);              // never removed
  return () => conn.disconnect();            // disconnects, but leaves the array entry
}, [serverUrl, roomId]);
```

Mount this under `StrictMode` and it looks fine — the connection is disconnected,
the visible behaviour matches production. Then change `roomId` five times and the
array has six entries. **`StrictMode` never exercised that path**, because the
doubling happens at mount and the bug lives on the dependency-change path.

So: a green `StrictMode` is not a proof of a correct effect. It proves the mount
path is symmetrical. The dependency-change path is tested by changing the
dependency, which only you can do.

## What it double-invokes, and what it does not

The full development-only list:

> - Your components will re-render an extra time to find bugs caused by impure
>   rendering.
> - Your components will re-run Effects an extra time to find bugs caused by
>   missing Effect cleanup.
> - Your components will re-run refs callbacks an extra time to find bugs caused
>   by missing ref cleanup.
> - Your components will be checked for usage of deprecated APIs.

Two of those four are pure-function checks and two are setup/cleanup checks, and
conflating them is the standard confusion:

| Mechanism | What runs twice | What it catches | Fix |
|---|---|---|---|
| **Double render** | component body, `useState`/`set`/`useMemo`/`useReducer` functions | impurity — mutation during render | make it pure |
| **Extra effect cycle** | effect setup + cleanup | missing or asymmetrical cleanup | write the cleanup |
| **Extra ref cycle** | callback ref + its cleanup | missing ref cleanup | return a cleanup from the ref |

They fail differently and they are fixed differently. "React runs my code twice"
is not one problem.

Note what is *excluded* from the pure-function half — react.dev is explicit that
it is

> only top-level logic, so this doesn't include code inside event handlers

which is the mechanical reason the "buying a product" fix from
[topic 04](04-cleanup/03-when-cleanup-is-not-the-answer.md) works. Moving a POST
into a handler does not merely make it feel more correct; it moves it out of the
double-invoked region entirely.

## Callback refs get the same cycle

Less well known, and listed in the reference alongside effects:

> When Strict Mode is on, React will also run **one extra setup+cleanup cycle in
> development for every callback `ref`.**

The documented example makes the sequence visible — add all ten, remove all ten,
add all ten again:

```
✅ Adding animal to the map. Total animals: 10
...
❌ Removing animal from the map. Total animals: 0
...
✅ Adding animal to the map. Total animals: 10
```

A callback ref that registers a node somewhere therefore needs the same symmetry
an effect does. React 19's ref cleanup functions are what make that expressible;
[topic 15](15-effects-and-refs.md) covers them.

The tell for a missing ref cleanup is a count that ends up doubled rather than
correct — the "Total animals: 20" version of the log above.

## Partial `StrictMode` behaves differently

A genuinely subtle rule, and worth knowing before you wrap one subtree to debug
something:

> When `StrictMode` is enabled for a part of the app, React will only enable
> behaviors that are possible in production. For example, if `<StrictMode>` is
> not enabled at the root of the app, it will not re-run Effects an extra time on
> initial mount, since this would cause child effects to double fire without the
> parent effects, which cannot happen in production.

So wrapping a single component in `<StrictMode>` to test one effect **will not
give you the extra effect cycle** on initial mount. If you are relying on the
double-mount as a check, it has to be at the root.

This also rules out the tempting workaround of leaving `StrictMode` at the root
and carving one subtree out of it — the behaviour is not per-subtree opt-out in
the way it looks.

## Why you may see one log where you expected two

The double render is real but its console output is deliberately quietened:

> If you have React DevTools installed, any `console.log` calls during the second
> render call will appear slightly dimmed. React DevTools also offers a setting
> (off by default) to suppress them completely.

So a missing second log is not evidence the component rendered once — it may be
dimmed, or suppressed by a setting someone turned on. **Never use log count as
your measurement of how many times something ran.** Count into a variable and
read the variable, which is what the Phase 0 measurement does.

The same caution applies in reverse to the effect cycle: those logs are *not*
dimmed, so an effect that logs on setup genuinely prints twice, which is the
single most common reason people think `StrictMode` is broken.

## What the extra cycle actually buys you

The bugs it reliably surfaces at mount:

- **Connections and subscriptions with no cleanup** — two live sockets in
  development where production shows one until the user navigates back a few
  times.
- **Listeners and observers never removed** — the count grows instead of staying
  at one.
- **Widget APIs that reject a second call** — `dialog.showModal()` throwing is
  `StrictMode` telling you the cleanup is missing.
- **Impure initializers** — a `useState` initializer with a side effect runs
  twice, and react.dev is explicit that *"the result from one of the calls will
  be ignored."*

And one commonly-listed item that deserves a caveat: **doubled analytics is not
in itself a bug.** react.dev's position is that a duplicate `logVisit` in
development *"is not a problem because you don't want the logs from the
development machines to skew the production metrics"*
([topic 04](04-cleanup/02-cleanup-recipes.md)). What `StrictMode` genuinely
catches in that neighbourhood is a doubled **mutation** — a POST that changes
state, which was an event's job all along.

## Gotchas

**Symptom:** an effect passes under `StrictMode` and still leaks in production.
**Cause:** the leak is on the dependency-change path, and `StrictMode` only
doubles the mount.
**Fix:** change the dependency and watch the resource count. A green
`StrictMode` proves the mount path only.

**Symptom:** wrapping one component in `<StrictMode>` does not produce the double
effect cycle.
**Cause:** partial `StrictMode` enables only behaviours that are possible in
production, and a child-only double mount is not one of them.
**Fix:** enable it at the root, or accept that this check is unavailable for a
subtree.

**Symptom:** the component logs once, so it clearly is not double-rendering.
**Cause:** DevTools dims second-render logs, and can suppress them entirely via a
setting.
**Fix:** increment a counter and read it. Do not count console lines.

**Symptom:** a `ref` callback's registry ends up with double the entries.
**Cause:** callback refs get their own extra setup+cleanup cycle, and this one
has no cleanup.
**Fix:** return a cleanup function from the ref callback (React 19).

**Symptom:** "React runs my code twice" is diagnosed as one problem and fixed one
way.
**Cause:** double *rendering* and the extra *effect cycle* are separate
mechanisms testing separate properties.
**Fix:** identify which. Impurity is fixed by making the function pure; a missing
cleanup is fixed by writing the cleanup.

**Symptom:** the fix under consideration is removing `<StrictMode>`.
**Cause:** treating the detector as the defect.
**Fix:** covered at [Phase 0 · 07](../phase-0-how-react-runs/07-strictmode.md) —
the behaviour it surfaces happens in production too, just later and less
reproducibly.

## Interview questions

**★ What exactly does `StrictMode` do to effects, and what is it asserting?**
It runs one extra setup+cleanup cycle in development before the first real setup,
so mounting goes setup → cleanup → setup where production goes setup. The
assertion is that those two are indistinguishable to the user — which is true
exactly when the cleanup fully undoes the setup. It is a single narrow test of
the mount path.

**★ What effect bug does `StrictMode` fail to catch?**
Anything on the dependency-change path. The extra cycle is attached to the first
setup, not to every setup, so an effect whose cleanup is correct for teardown but
incomplete for a re-run passes cleanly and still leaks — one entry per dependency
change. `StrictMode` being green proves the mount path is symmetrical and nothing
more; testing the re-run path means changing the dependency yourself.

**★ Distinguish the double render from the extra effect cycle.**
Different mechanisms with different targets. The double render calls pure
functions twice — the component body and the functions passed to `useState`,
`set`, `useMemo` and `useReducer` — to surface impurity, and React discards one
result. The extra effect cycle runs setup and cleanup an extra time to surface
missing cleanup. Impurity is fixed by making the function pure; the other is
fixed by writing the cleanup. Event handlers are in neither category.

**Why doesn't wrapping a single component in `<StrictMode>` double its effects?**
Because partial `StrictMode` only enables behaviours that are possible in
production. Double-firing a child's effects without the parent's cannot happen in
production, so React declines to simulate it. The effect check requires
`StrictMode` at the root.

**Your component logs once in development. Has it rendered once?**
Not necessarily. React DevTools dims `console.log` output from the second render
and has a setting to suppress it entirely. Log count is not a measurement —
increment a counter and read the counter. Effect setup logs are not dimmed, which
is why those are the ones people notice.

**Does `StrictMode` catch doubled analytics, and is that a bug?**
It surfaces the doubling, but react.dev's position is that a duplicated
development-only analytics call is not a problem — you do not want development
traffic in production metrics anyway. The real bug in that shape is a doubled
*mutation*: a POST that changes state, which was caused by an interaction and
belonged in an event handler, where the double-invocation does not reach.

---

← Prev: [Cleanup](04-cleanup/README.md) · Index: [Phase 4](README.md) · Next → [You might not need an effect](06-you-might-not-need-an-effect/README.md)
