---
title: "Why did this component re-render?"
sidebar_label: "01 · Why did this re-render?"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`memo`](https://react.dev/reference/react/memo) (what memoization does and does
> not cover) and [`useMemo`](https://react.dev/reference/react/useMemo)
> (§ Should you add useMemo everywhere?).
> **What *triggers* a render is
> [Phase 3 · 08](../phase-3-state/08-what-triggers-a-re-render.md)**; this page is
> the diagnostic — telling the causes apart in a real component.
> No sandbox script backs this page.

**Every performance fix in this phase depends on answering one question correctly
first, and the answer is not guessable. Four causes produce identical symptoms and
have four different fixes — three of which are not memoization.**

## The four causes

| # | Cause | Fixed by |
|---|---|---|
| 1 | **Its own state changed** | moving state down ([13](13-moving-state-down.md)) — or nothing, this is the render working |
| 2 | **Its parent re-rendered** | `children` composition ([06](06-the-memoization-trap.md)), or `memo` + stable props |
| 3 | **A context it reads changed** | splitting the context ([Phase 5 · 05](../phase-5-refs-context-reducers/05-context-re-render-problem.md)) — **`memo` cannot help** |
| 4 | **A hook it uses changed** — a store subscription, a custom hook's state | narrowing the subscription |

Note that **`memo` addresses cause 2 only**, and only when props are stable. That
one fact explains most disappointed memoization:

> Even when a component is memoized, it will still re-render when **its own state
> changes.** … Even when a component is memoized, it will still re-render when **a
> context that it's using changes.**

So a component re-rendering for cause 1, 3 or 4 will keep re-rendering with `memo`
wrapped around it, and the wrapper will make it look investigated.

## Telling them apart

**Cause 1 — its own state.** The component appears in the profile as the *root* of
the committed subtree: nothing above it re-rendered. Usually correct behaviour. It
becomes a problem only when the state is higher in the tree than it needs to be,
which makes the *subtree* the cost rather than the component.

**Cause 2 — the parent.** The component appears with its parent, and its parent's
parent, in one commit. In React DevTools' Profiler each committed component shows
"Why did this render?" when *Record why each component rendered* is enabled in the
profiler settings — the fastest way to separate 2 from 1.

**Cause 3 — context.** The component re-renders in commits where its parent did
**not**, and nothing about its props changed. That combination — re-rendered, parent
did not, props identical — is close to a signature for context.

**Cause 4 — a hook.** Same signature as 3, but the culprit is a custom hook or an
external store subscription
([Phase 5 · 15](../phase-5-refs-context-reducers/15-usesyncexternalstore.md)). Read
the hook's source: if it calls `useContext`, it is really cause 3 wearing a
disguise, and that is extremely common — a `useAuth()` deep in a leaf component
subscribes that leaf to the whole auth context.

The tooling itself is [topic 05](05-measure-before-you-optimise.md) and
[Phase 0 · 12](../phase-0-how-react-runs/12-devtools-and-profiler.md).

## Is the re-render even the problem?

Before diagnosing further, the prior question. **A re-render is not automatically a
cost.** React calling a function that returns the same JSX produces a diff that
finds nothing to do — no DOM writes, no layout, no paint.

> If there is **no perceptible lag** when your component re-renders, `memo` is
> unnecessary.

> If your app is like this site, and most interactions are **coarse** (like
> replacing a page or an entire section), memoization is usually unnecessary. On the
> other hand, if your app is more like a **drawing editor**, and most interactions
> are **granular** (like moving shapes), then you might find memoization very
> helpful.

The re-renders that actually cost something have one of these properties: the
component does real work during render (sorting, filtering, formatting thousands of
items), the subtree is large, the component is one of thousands in a list, or the
interaction is granular and repeats at 60fps.

Counting re-renders is not a metric. **Milliseconds are.**

## The cause that is not on the list

react.dev names it directly, and it belongs at the top of any real investigation:

> **Most performance problems in React apps are caused by chains of updates
> originating from Effects** that cause your components to render over and over.

That is not a *cause of one re-render*; it is a cause of a **cascade**. The profile
shows several commits in quick succession for a single interaction, each triggered
by the previous one's state update
([Phase 4 · 06 · 02](../phase-4-effects/06-you-might-not-need-an-effect/02-chains-of-effects.md)).

So the first question in a profile is not "which component is slow" but **"how many
commits did one interaction produce?"** If the answer is more than one, no amount of
`memo` will fix what an effect chain is doing — and deleting the chain often removes
the problem entirely.

## The order to investigate in

1. **How many commits per interaction?** More than one → look for an effect chain
   before anything else.
2. **What is the total time**, in a production build with throttling? No perceptible
   lag → stop, there is nothing to fix.
3. **Which component dominates the flame chart** — and is it wide (a large subtree)
   or tall-and-narrow (one expensive component)?
4. **Which of the four causes** applies to that component?
5. Only now: the smallest correct fix — which is
   [moving state down](13-moving-state-down.md) or
   [accepting `children`](06-the-memoization-trap.md) more often than it is `memo`.

## Gotchas

**Symptom:** `memo` added and the component re-renders exactly as before.
**Cause:** the re-render was cause 1, 3 or 4. `memo` only addresses a re-rendering
parent, and only with stable props.
**Fix:** identify the cause first. The four have four different fixes.

**Symptom:** a leaf component re-renders on every unrelated app change.
**Cause:** a custom hook it calls reads context — cause 3 disguised as cause 4.
**Fix:** read the hook's source. Then split the context or narrow what the hook
subscribes to.

**Symptom:** one click produces four commits in the profile.
**Cause:** an effect chain, each link setting state that wakes the next.
**Fix:** [Phase 4 · 06 · 02](../phase-4-effects/06-you-might-not-need-an-effect/02-chains-of-effects.md).
This is the single highest-value fix available.

**Symptom:** a component re-renders hundreds of times and the app feels fine.
**Cause:** re-renders that produce identical output are cheap.
**Fix:** nothing. Optimise milliseconds, not render counts.

**Symptom:** the profile looks fine locally and users report lag.
**Cause:** a development build, StrictMode double-rendering, and a faster machine.
**Fix:** production build, real device, CPU throttling
([topic 05](05-measure-before-you-optimise.md)).

**Symptom:** the whole page re-renders when one field changes.
**Cause:** the state lives at the top of the tree.
**Fix:** move it down ([topic 13](13-moving-state-down.md)) — the docs' own advice
to prefer local state and not lift it further than necessary.

## Interview questions

**★ What are the causes of a component re-rendering, and which does `memo`
address?**
Its own state changed, its parent re-rendered, a context it reads changed, or a
hook it uses produced a new value. `memo` addresses only the second — and only when
props are shallowly stable. The docs state explicitly that a memoized component
still re-renders on its own state change and on a context change, which is why
wrapping a component in `memo` so often changes nothing while looking like a fix.

**★ How do you tell a context-driven re-render from a parent-driven one?**
By what else re-rendered. If the parent re-rendered in the same commit, it is
parent-driven. If the component re-rendered while its parent did not, and its props
are identical, that is close to a signature for context — or for a custom hook that
reads context internally, which is the same cause in disguise and very common with
things like `useAuth()` in a leaf.

**★ What should you look at first in a profile?**
How many commits one interaction produced. react.dev's own claim is that most React
performance problems come from chains of updates originating from Effects, which
show up as several commits in quick succession for a single interaction. No amount
of memoization fixes that, and deleting the chain often removes the problem
entirely.

**Is a high re-render count a problem?**
Not by itself. A re-render that produces identical output is a function call and a
diff that finds nothing to do — no DOM writes, no paint. What costs is expensive
work during render, a large subtree, thousands of list items, or a granular
interaction repeating many times a second. The metric is milliseconds, not render
counts.

**Why measure in a production build?**
Because a development build is slower, StrictMode renders each component twice, and
your machine is faster than your users'. All three push the numbers in different
directions from what a user experiences. The docs recommend a production build, a
device like your users have, and CPU throttling.

---

Index: [Phase 6](README.md) · Next → [`memo`](02-memo.md)
