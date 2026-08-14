---
title: "⚠ <ViewTransition>, addTransitionType and gesture transitions"
sidebar_label: "17 · ⚠ ViewTransition"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [React Labs: View Transitions, Activity, and more](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more)
> (*"`<ViewTransition />` and `addTransitionType` are now available in `react@canary`"*,
> the three triggers, and the API-stability note) and MDN
> [`Document: startViewTransition()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition).
> ⚠️ **The `<ViewTransition>` reference page could not be retrieved when this page was
> written**, so nothing here is quoted from it; the claims below come from the React Labs
> post and MDN, and the API surface is described only as far as those state it.
> No sandbox script backs this page; claims are cited, not measured.

**🔴 `<ViewTransition>` and `addTransitionType` are not in stable React 19.2.8. They are
canary/experimental.** This page exists because you will meet them constantly in 2025–26
blog posts, conference talks and tutorials, and the most useful thing to know is that
adopting them means shipping the experimental channel.

## The status, plainly

> **`<ViewTransition />` and `addTransitionType` are now available in `react@canary`.**

> You can try them by upgrading React packages to the most recent experimental version:
> `react@experimental`, `react-dom@experimental`

> These features have been **tested in production and are stable, but the final API may
> still change** as we incorporate feedback.

Read that last sentence carefully — "stable" there means *it works*, not *it is in the
stable release*. The API may still change. On `react@19.2.8` these exports do not exist.

Contrast with the neighbouring feature from the same post:

> **`<Activity />` has shipped in `react@19.2`.**

Same blog post, same feature family, different status. That is exactly why they are
separate topics here: [`<Activity>`](14-activity.md) is usable today and this is not.

## What they are for

> React View Transitions are a new experimental feature that **makes it easier to add
> animations to UI transitions in your app.** Under-the-hood, these animations use the new
> **`startViewTransition`** API available in most modern browsers.

> `addTransitionType` is a function that allows you to **specify the cause of a
> Transition.**

So the value proposition is declarative animation between two UI states, built on a
browser API rather than on JavaScript animation, with `addTransitionType` letting you
style differently depending on *why* the transition happened — a back navigation animating
differently from a forward one.

## How it hooks into everything in this phase

This is the part worth understanding even while the API is out of reach, because it
explains why the feature belongs in Phase 8 at all:

> You can define "when" to animate by using one of these three triggers for a View
> Transition:

```js
// "when" to animate.

// Transitions
startTransition(() => setState(...));

// Deferred Values
const deferred = useDeferredValue(value);

// Suspense
<Suspense fallback={<Fallback />}>
  <div>Loading...</div>
</Suspense>
```

> When the DOM updates due to an animation trigger — like `startTransition`,
> `useDeferredValue`, or a `Suspense` fallback switching to content — React will use
> declarative heuristics to **automatically determine which `<ViewTransition>` components
> to activate** for the animation.

The three triggers are exactly the three mechanisms this phase has been about. That is not
a coincidence: they are the points where React already knows one UI state is being replaced
by another, and an animation needs precisely that information.

It also explains the caveat that appears on `<Activity>`
([topic 14](14-activity.md)): an `<Activity>` inside a `<ViewTransition>` activates the
`enter` animation when it becomes visible via `startTransition`, and the `exit` animation
when it becomes hidden. The integration is documented from the stable side; the other half
is canary.

## What to do today

**The browser API works without React.** `document.startViewTransition` is what React wraps:

> Under-the-hood, these animations use the new `startViewTransition` API available in most
> modern browsers.

Calling it yourself means telling the browser to capture the current state, run your DOM
update, and animate between them. In React that requires the update to be **synchronous**
inside the callback — which is what `flushSync` is for, and why the pairing is the common
workaround today.

⚠️ **State this one as a trade-off, not a recipe.** `flushSync` forces a synchronous
re-render, which is the opposite of everything Phase 8 recommends: it blocks, it cannot be
interrupted, and it forfeits the scheduling that transitions exist to provide. It is a
deliberate escape hatch for a visual effect, and on a heavy tree it will be felt.

**The alternatives that cost nothing:**

- **CSS transitions and animations** for anything within one component's own state changes.
  They are unaffected by all of this and handle the majority of real cases.
- **An animation library.** Established libraries handle enter/exit animation without the
  browser API, and without the experimental channel.
- **Waiting.** For most applications this is the correct answer — the feature is a polish
  improvement, not a capability you lack.

## 🔴 The risk of shipping the experimental channel

The real content of this topic. Adopting `<ViewTransition>` today means running
`react@experimental` and `react-dom@experimental` in production, and that carries costs
that are easy to under-weigh when the demo looks good:

- **The API may still change**, by React's own statement — so the code may need rewriting,
  and there is no deprecation cycle for a channel that makes no stability promise.
- **Every other React feature comes along with it.** You are not adopting one component;
  you are adopting an entire unreleased build of React, including changes unrelated to
  animation.
- **The version is not a version anyone else has.** Bug reports, library compatibility and
  "works on my machine" all get harder, and third-party libraries test against stable.
- **Upgrades stop being routine.** You are pinned to a moving channel rather than a
  semver-stable release.

**The honest recommendation: know what it is, recognise it in an article, and do not put
it in production on 19.2.8.** If a framework you already use ships it internally, that is a
different decision — the framework has taken on the version risk deliberately.

## What this means for the rest of the phase

Nothing in topics 01–16 depends on this. Transitions, Suspense, deferred values and
`<Activity>` are all fully usable on stable 19.2.8 without View Transitions, and none of
their behaviour changes when it eventually ships. This is additive polish on top of
machinery you already have.

## Gotchas

**Symptom:** `import { ViewTransition } from 'react'` fails, or the export is `undefined`.
**Cause:** it is not in stable 19.2.8 — it is in `react@canary` / `react@experimental`.
**Fix:** expected. Do not work around it by switching channels casually.

**Symptom:** a tutorial's View Transitions example does nothing.
**Cause:** the tutorial is running the experimental build and does not say so, or says so
once at the top.
**Fix:** check the installed React version before debugging the code.

**Symptom:** `react` and `react-dom` end up on different channels.
**Cause:** upgrading one to canary and not the other.
**Fix:** they must match. Mismatched versions are also one of the documented causes of the
invalid hook call error
([Phase 7 · 05 · 02](../phase-7-custom-hooks/05-why-the-rules-exist/02-deriving-the-forbidden-places.md)).

**Symptom:** `document.startViewTransition` plus `flushSync` animates correctly and the app
feels slower.
**Cause:** `flushSync` forces a synchronous, uninterruptible render.
**Fix:** that is the trade being made. Reserve it for small trees, or use CSS instead.

**Symptom:** `<Activity>` enter/exit animations do not fire.
**Cause:** those come from `ViewTransition`, which is not present on stable.
**Fix:** `<Activity>` works without them; the animation half needs canary.

## Interview questions

**★ What is `<ViewTransition>` and can you use it?**
A declarative way to animate between two UI states, built on the browser's
`document.startViewTransition`. And no, not on stable — React's own post says
`<ViewTransition />` and `addTransitionType` are available in `react@canary`, tried via
`react@experimental` and `react-dom@experimental`. The same post says `<Activity />` has
shipped in `react@19.2`, which is the contrast worth remembering: same feature family,
different status.

**★ What triggers a View Transition, and why those?**
`startTransition`, `useDeferredValue`, and a Suspense fallback switching to content —
React uses declarative heuristics to decide which `<ViewTransition>` components to
activate. They are the three mechanisms of this whole phase, because they are exactly the
points where React already knows one UI state is replacing another, which is the
information an animation needs.

**★ What is today's answer if you want this effect on stable React?**
CSS transitions for anything within a component's own state changes, or an animation
library for enter/exit. The browser API can be called directly, but doing so in React needs
the DOM update to be synchronous inside the callback — `flushSync` — which forces an
uninterruptible render and forfeits exactly the scheduling the rest of this phase is about.
It is an escape hatch with a real cost, not a recommendation.

**★ What is the risk of adopting it now?**
You ship the experimental channel to production. React states the final API may still
change, so the code may need rewriting with no deprecation cycle; you take on an entire
unreleased build of React rather than one component; third-party libraries test against
stable, so compatibility and bug reports get harder; and you are pinned to a moving channel
instead of a semver-stable release.

**Does any of the rest of Phase 8 depend on it?**
No. Transitions, Suspense, deferred values and `<Activity>` are all fully usable on stable
19.2.8, and none of their behaviour changes when View Transitions ship. It is additive
polish on machinery you already have.

---

← Prev: [Error boundaries and Suspense together](16-error-boundaries-and-suspense.md) ·
Index: [Phase 8](README.md) ·
Next → [⚠ `SuspenseList`](18-suspenselist.md)
