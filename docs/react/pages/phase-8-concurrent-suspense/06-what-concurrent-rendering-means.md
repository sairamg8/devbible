---
title: "What concurrent rendering means"
sidebar_label: "06 · What concurrent rendering means"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [React v18.0 release post](https://react.dev/blog/2022/03/29/react-v18)
> (*What is Concurrent React?*),
> [`useTransition`](https://react.dev/reference/react/useTransition) (Caveats),
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (Caveats), and
> [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure).
> No sandbox script backs this page; claims are cited, not measured.

**Concurrent rendering is not a feature you turn on. It is a change to what React is
permitted to do with a render — pause it, resume it, or throw it away — and every
transition, every Suspense boundary and every purity rule in the last two phases is a
consequence of that permission.**

## React's own framing

> Concurrency is **not a feature, per se.** It's a new behind-the-scenes mechanism that
> enables React to **prepare multiple versions of your UI at the same time.** You can
> think of concurrency as an **implementation detail** — it's valuable because of the
> features that it unlocks.

> The most important addition in React 18 is something **we hope you never have to think
> about**: concurrency. We think this is largely true for application developers, though
> **the story may be a bit more complicated for library maintainers.**

Worth reading honestly. "You never have to think about it" holds while your code follows
the rules; the moment it does not, concurrency is the reason the bug exists and cannot be
reproduced. This page is here so you can recognise that situation, not so you can
configure anything — there is nothing to configure.

## The property everything follows from

> A key property of Concurrent React is that **rendering is interruptible.** … With
> synchronous rendering, once an update starts rendering, **nothing can interrupt it**
> until the user can see the result on screen.
>
> In a concurrent render, this is not always the case. **React may start rendering an
> update, pause in the middle, then continue later. It may even abandon an in-progress
> render altogether.**

Three permissions, and each one breaks a different assumption people carry from the
synchronous model:

| React may… | The assumption it breaks |
|---|---|
| **Pause** mid-render | "A render runs to completion once started" |
| **Continue later** | "Everything in one render sees one consistent moment in time" |
| **Abandon entirely** | "If a component rendered, its output was shown" |

The third is the one that reframes everything: **a render is not a promise that anything
will appear.** A component can render — running every line of its body, every custom hook,
every helper — for a result that is discarded and never committed.

## The consistency guarantee, and what it does not cover

> React **guarantees that the UI will appear consistent even if a render is interrupted.**
> To do this, it **waits to perform DOM mutations until the end, once the entire tree has
> been evaluated.** With this capability, React can prepare new screens in the background
> **without blocking the main thread.**

This is the deal on offer, and it is a strong one: you never see a half-updated screen,
because the DOM is not touched until the whole tree is evaluated. Commit is atomic even
though render is not.

**But read exactly what is guaranteed: the UI.** React can promise the *output* is
consistent because it controls when the DOM is written. It cannot promise anything about
values your render read from outside itself — a module variable, the DOM, `Date.now()`,
a mutable store — because it does not control those and cannot re-read them for you. Two
components in one commit reading a module variable that changed mid-render will show
different values, and the commit is still "consistent" by React's definition because it
faithfully committed what the components returned.

That gap has a name — **tearing** — and it is [topic 15](15-tearing.md), with
`useSyncExternalStore` as the only correct fix.

## Why the purity rules stopped being style advice

The connection this phase exists to make. From the purity rules:

> Side effects should not run in render, as **React can render components multiple times
> to create the best possible user experience.**

And from transitions:

> A state update marked as a Transition will be **interrupted by other state updates** …
> React will **restart the rendering work** on the chart component after handling the
> input update.

And from Suspense:

> React does not preserve any state for renders that got suspended before they were able
> to mount for the first time. When the component has loaded, React will **retry rendering
> the suspended tree from scratch.**

Three separate documented mechanisms, one consequence: **your component body runs an
unpredictable number of times per visible update, and some of those runs are thrown away.**

Under synchronous rendering, an impure render was untidy — one extra `fetch`, one wrong
counter, in a place you could find. Under concurrent rendering the same code produces:

- **Side effects that fire a variable number of times**, including for renders nobody saw.
- **Bugs that do not reproduce**, because whether the render was interrupted depends on
  what else the user was doing and how fast their device is.
- **Components the Compiler silently skips**, because it can only memoize what it can
  prove pure ([Phase 6 · 09](../phase-6-performance/09-how-the-compiler-bails-out.md)).

This is why [Phase 7](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/README.md)
comes before this phase rather than after it. The rules are the price of admission for
everything Phase 8 describes.

## Reusable state

The other capability worth knowing the name of:

> **Concurrent React can remove sections of the UI from the screen, then add them back
> later while reusing the previous state.** For example, when a user tabs away from a
> screen and back, React should be able to restore the previous screen in the same state
> it was in before.

In 19.2 the API for this is `<Activity>` — [topic 14](14-activity.md) — which hides a
subtree while keeping its state and unmounting its effects. Mentioned here because it
explains why the capability exists at all: preserving state across a removal is only
coherent if React already tracks work that is not currently on screen.

## What you actually do about it

Nothing, mostly, and that is the intended answer:

1. **Follow the Rules of React.** That is the whole contract. Pure render, no side effects,
   no mutation of non-local values, no reading refs or the DOM during render.
2. **Read external stores with `useSyncExternalStore`.** The one case where following the
   rules is not enough on its own, because the mutable value is outside React.
3. **Use transitions for updates that may take a while**, so React has something to
   prioritise against.
4. **Do not try to observe or control the scheduling.** There is no supported way to ask
   whether a render was interrupted, and code that branched on it would be impure by
   construction.

## Gotchas

**Symptom:** a bug that only appears on slow devices or under load, and never on yours.
**Cause:** it depends on a render being interrupted, which depends on timing.
**Fix:** look for impurity rather than for a race in your own logic — that is the class of
bug concurrency exposes.

**Symptom:** a network request or analytics event fires a variable number of times per
interaction.
**Cause:** a side effect in render, multiplied by interruption, restart or Suspense retry.
**Fix:** event handler or effect. Render must only compute.

**Symptom:** two components in one commit display different values for the same source.
**Cause:** tearing — a mutable value outside React changed mid-render.
**Fix:** `useSyncExternalStore`. React's consistency guarantee covers its own output, not
values it did not produce.

**Symptom:** someone tries to detect whether a render was discarded.
**Cause:** treating concurrency as an API.
**Fix:** it is an implementation detail with no supported observation point, and branching
on it would itself break purity.

**Symptom:** "we don't use concurrent features, so this doesn't apply."
**Cause:** assuming interruption only happens inside transitions.
**Fix:** `StrictMode` double-renders regardless, Suspense retries from scratch regardless,
and the Compiler requires purity regardless.

## Interview questions

**★ What is concurrent rendering?**
Not a feature — React's own framing is that it is an implementation detail, a mechanism
that lets React prepare multiple versions of the UI at the same time. The key property is
that rendering is interruptible: React may start rendering an update, pause in the middle,
continue later, or abandon it altogether. Everything in this phase is a consequence of
that permission.

**★ What does React guarantee if a render is interrupted?**
That the UI will appear consistent — it waits to perform DOM mutations until the end, once
the entire tree has been evaluated, so commit is atomic even though render is not. What it
does not guarantee is anything about values your render read from outside itself; a
mutable module variable read at two points in one render can produce two values, and the
commit is still consistent by React's definition. That gap is tearing, and
`useSyncExternalStore` is the fix.

**★ Why did the purity rules become a correctness requirement rather than style advice?**
Because three documented mechanisms — transitions restarting interrupted work, Suspense
retrying a suspended tree from scratch, and React rendering components multiple times —
mean a component body runs an unpredictable number of times per visible update, with some
runs discarded. A side effect in render then fires a variable number of times, including
for renders nobody saw, and the failure depends on device speed and user timing, so it
does not reproduce.

**★ If you use no concurrent features, does any of this apply?**
Yes. `StrictMode` double-renders in development regardless, a suspended tree is retried
from scratch regardless, and the Compiler can only memoize components whose purity it can
prove — so breaking the rules costs you the optimisation silently. Interruption is not
limited to code you explicitly wrapped in a transition.

**What is "reusable state" and why does it exist?**
The capability to remove a section of the UI from the screen and add it back later while
reusing its previous state — tabbing away from a screen and back and finding it as you
left it. In 19.2 the API is `<Activity>`. It is only coherent because React already tracks
work that is not currently on screen, which is the same machinery concurrency is built on.

**What should you actually change in your code because of concurrency?**
Follow the Rules of React, read external mutable stores through `useSyncExternalStore`,
and mark slow updates as transitions so React has something to prioritise against. There
is nothing to configure and no supported way to observe the scheduling — code that
branched on whether a render was interrupted would be impure by construction.

---

← Prev: [Request waterfalls](05-request-waterfalls.md) ·
Index: [Phase 8](README.md) ·
Next → [Urgent vs transition updates](07-urgent-vs-transition.md)
