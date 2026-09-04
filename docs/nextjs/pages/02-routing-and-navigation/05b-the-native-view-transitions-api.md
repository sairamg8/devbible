---
title: "View transitions work in the App Router with no configuration, but the API doing the work is React's ViewTransition — which react.dev marks as Canary and Experimental only, so what ships without a flag is not a stable React API"
sidebar_label: "05b · View Transitions"
sidebar_position: 150
description: "What React's ViewTransition component is, its exact stability status, what activates it and what does not, the four animation triggers, the View Transition Class props, transitionTypes from Link and useRouter, and the documented browser-support limits."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js [Designing view transitions](https://nextjs.org/docs/app/guides/view-transitions) guide (`lastUpdated: 2026-08-25`), the [Link Component](https://nextjs.org/docs/app/api-reference/components/link) reference (`lastUpdated: 2026-08-25`), [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`lastUpdated: 2026-07-01`), the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and the React reference [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition) on `react@19.2`.
> Target: **Next.js 16.3.4** · `transitionTypes` on `<Link>` since **v16.2.0** · React `<ViewTransition>` is **Canary / Experimental**. Documentation-verified — **no sandbox run**.

**Two sentences from two different primary sources have to be held together, because either one alone misleads. Next.js: *"View transitions work in the App Router with no configuration."* React: *"The `<ViewTransition />` API is currently only available in React's Canary and Experimental channels."* Both are true. The App Router pins a React canary build, so `import { ViewTransition } from 'react'` works in a Next.js app today with no flag and no `react@canary` install — while the same import in a plain React 19.2 app does not. There is no `experimental.viewTransition` config option to point at, which makes this easy to mistake for a stable API. It is stable *in Next.js's dependency choice*, not stable *in React*. Plan for the props to move.**

## The problem it solves

> *"In web apps, route changes replace the entire page at once. One set of elements disappears, another appears, with no visual connection between them. A user selects a photo thumbnail to view it in detail on another page. They are the same image, but nothing on screen communicates that."*

> *"React's `<ViewTransition>` component integrates with the browser's View Transitions API to handle this declaratively. You name the elements that should persist, and the browser animates between their old and new positions."*

The alternative it replaces is worth naming, because it is what the cost comparison is against: *"Apps that need these transitions typically rely on complex animation libraries that manage mount/unmount lifecycles, track element positions across routes, and coordinate timing manually."*

## 🔴 Stability, stated exactly

**React's position**, from the `<ViewTransition>` reference on `react@19.2`:

> *"**Canary** — The `<ViewTransition />` API is currently only available in React's Canary and Experimental channels."*

`addTransitionType`, which `transitionTypes` routes into, carries the same Canary marker.

**Next.js's position**, from the view transitions guide:

> *"View transitions work in the App Router with no configuration. The App Router uses React canary releases, which contain all stable React 19 changes as well as newer features like `ViewTransition`. You do not need to install `react@canary` yourself."*

And the v16 upgrade guide lists View Transitions under its React 19.2 highlights, describing the App Router as using *"the latest React Canary release, which includes the newly released React 19.2 features and other features being incrementally stabilized."*

| Question | Answer |
| --- | --- |
| Is there a Next.js config flag to enable it? | No — nothing in the `next.config.js` reference |
| Is the React API stable? | **No** — Canary and Experimental channels only |
| Does it work in a Next.js app today? | Yes, because the App Router pins a React canary |
| Does the same code work in a standalone React 19.2 app? | No, not without a canary install |
| Should you treat the prop shape as fixed? | No |

That is the honest summary, and it is the one to give in a design review: *"experimental React, shipped by Next.js on purpose, no flag, no guarantee about the props."*

## What activates it — and what does not

> *"`<ViewTransition>` animations are activated by Transitions, `<Suspense>`, and `useDeferredValue`. Regular `setState` calls do not trigger them. In Next.js, route navigations are transitions, so `<ViewTransition>` animations activate automatically during navigation."*

React's own caveat states the negative case first:

> *"By default, `setState` updates immediately and does not activate `<ViewTransition>`, only updates wrapped in a Transition, `<Suspense>`, or `useDeferredValue` activate ViewTransition."*

So the three activation paths that matter in a Next.js app:

| Cause | Activates? |
| --- | --- |
| `<Link>` click / `router.push` / `router.replace` | yes — navigations are transitions |
| A `<Suspense>` boundary resolving | yes |
| `useDeferredValue` producing a new value | yes |
| `startTransition(() => setState(...))` | yes |
| A plain `setState` | **no** |

A component that animates on navigation and refuses to animate when you toggle it with a `useState` is not broken; it is the documented behaviour, and the fix is to wrap the update in `startTransition`.

## The four triggers

React decides which kind of animation applies:

> *"`enter`: If a `ViewTransition` is the first component inserted in this Transition, then this will activate."*
> *"`exit`: If a `ViewTransition` is the first component deleted in this Transition, then this will activate."*
> *"`update`: If a `ViewTransition` has any DOM mutations inside it that React is doing (such as a prop changing) or if the `ViewTransition` boundary itself changes size or position due to an immediate sibling. If there are nested `ViewTransition` then the mutation applies to them and not the parent."*
> *"`share`: If a named `ViewTransition` is inside a deleted subtree and another named `ViewTransition` with the same name is part of an inserted subtree in the same Transition, they form a Shared Element Transition, and it animates from the deleted one to the inserted one."*

> *"By default, `<ViewTransition>` animates with a smooth cross-fade (the browser default view transition)."*

## The View Transition Class props

```tsx
<ViewTransition default="none" enter="slide-up" exit="slide-down" />
```

Five optional props — `enter`, `exit`, `update`, `share`, `default` — each taking `"auto"`, `"none"`, a string, or an object.

| Value | Meaning |
| --- | --- |
| `auto` | the default — uses the browser default animation |
| `none` | disable animations for this type |
| `<classname>` | a custom CSS class name, targeted through `::view-transition-*` pseudo-elements |
| `{[type]: value}` | applies `value` if the animation matches that **Transition Type** |
| `{default: value}` | the value to apply if no Transition Type matched |

and the caveat that changes how you write every one of them:

> *"If `default` is `\"none\"` then all other triggers are turned off unless explicitly listed."*

That is why nearly every documented example carries `default="none"`: without it, *"every named `<ViewTransition>` animates whenever any transition runs on the page."* Naming an element opts it into every unrelated transition until you say otherwise.

There is also a `name` prop, and the reference is prescriptive about when to use it:

> *"optional `name`: A string or object. The name of the View Transition used for shared element transitions. If not provided, React will use a unique name for each View Transition to prevent unexpected animations."*
> *"Only use `name` for shared element transitions. For all other animations, React automatically generates a unique name to prevent unexpected animations."*

## `transitionTypes`, from `<Link>` and from the router

Transition types are how a navigation tells the animation what *kind* of navigation it was. `<Link>` gained the prop in **v16.2.0**:

```tsx title="app/page.tsx"
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/about" transitionTypes={['slide-in']}>
      About
    </Link>
  )
}
```

> *"A list of transition types to apply to the navigation. These types are passed to `React.addTransitionType` inside the navigation transition, enabling `<ViewTransition>` components to apply different animations based on the type of navigation."*

`useRouter`'s `push` and `replace` take the same option: *"The optional `transitionTypes` are passed to `React.addTransitionType` inside the navigation Transition."*

```tsx
router.push('/photo/12', { transitionTypes: ['nav-forward'] })
```

The critical property, and the reason directional animation is a design decision rather than a feature you switch on:

> *"The transition type is not automatic. You decide which links are \"forward\" and which are \"back\" based on your app's navigation hierarchy."*

and its consequence:

> *"Browser-initiated back navigations (the back button or swipe gestures) do not carry a transition type, so the directional slide does not play."*

## How React drives the browser API

You never call `startViewTransition` yourself:

> *"React automatically calls `startViewTransition` itself behind the scenes so you should never do that yourself. In fact, if you have something else on the page running a ViewTransition React will interrupt it. So it's recommended that you use React itself to coordinate these. If you had other ways to trigger ViewTransitions in the past, we recommend that you migrate to the built-in way."*

Naming is applied lazily, not eagerly:

> *"Under the hood, React applies `view-transition-name` to inline styles of the nearest DOM node nested inside the `<ViewTransition>` component. […] React doesn't apply these eagerly but only at the time that boundary should participate in an animation."*

Overlapping updates are queued and collapsed:

> *"If there are other React ViewTransitions already running then React will wait for them to finish before starting the next one. However, importantly if there are multiple updates happening while the first one is running, those will all be batched into one. If you start A->B. Then in the meantime you get an update to go to C and then D. When the first A->B animation finishes the next one will animate from B->D."*

So a user clicking three links quickly gets two animations, not three, and the intermediate state is never drawn. And one hard abort condition:

> *"If a `flushSync` happens to get in the middle of this sequence, then React will skip the Transition since it relies on being able to complete synchronously."*

Effect ordering is also rearranged, deliberately: React invokes `useEffect` after the `startViewTransition` finished promise resolves *"to prevent those from interfering with the performance of the animation"* — with the honest rider that it is *"not a guarantee"*, because a `setState` during the animation forces effects to run earlier to preserve sequencing.

## The documented limits

> *"React's integration uses newer View Transitions API features (transition types and `view-transition-class`), available in Chromium 125+ and recent Safari and Firefox versions. Some animations may behave differently in Safari. Without browser support, your application works normally; the transitions do not animate."*

That last clause is the one that makes this safe to adopt: unsupported browsers get an instant swap, not a broken page.

> *"Currently, `<ViewTransition>` only works in the DOM. We're working on adding support for React Native and other platforms."*

And a modelling limit worth understanding before you design around it:

> *"`<ViewTransition>` creates an image that can be moved around, scaled and cross-faded. Unlike Layout Animations you may have seen in React Native or Motion, this means that not every individual Element inside of it animates its position. This can lead to better performance and a more continuous feeling, smooth animation compared to animating every individual piece. However, it can also lose continuity in things that should be moving by themselves. So you might have to add more `<ViewTransition>` boundaries manually as a result."*

Finally, accessibility is explicitly yours:

> *"Many users may prefer not having animations on the page. React doesn't automatically disable animations for this case. We recommend always using the `@media (prefers-reduced-motion)` media query to disable animations or tone them down based on user preference."*

The four concrete patterns — shared-element morph, Suspense reveal, directional slides and same-route crossfade — with their CSS and their traps, are [05c · Morph and Suspense reveal](05c-view-transition-patterns.md).

## Gotchas

**★ Symptom: you present view transitions as a stable Next.js feature and a reviewer finds the Canary banner.** Cause: two accurate sources read separately. Next.js says no configuration is needed; React says the API exists only in Canary and Experimental channels. Fix: state both. The App Router pins a React canary, so it works today with no flag — and the props may still change, so do not build a design system API on their exact shape.

**★ Symptom: the animation plays on navigation and never plays when you toggle state.** Cause: *"Regular `setState` calls do not trigger them"* — only Transitions, `<Suspense>` and `useDeferredValue` activate a `<ViewTransition>`. Fix: wrap the update in a Transition.

```tsx
import { startTransition } from 'react'

startTransition(() => setSelectedTab(next))
```

**★ Symptom: a named `<ViewTransition>` animates on every unrelated navigation.** Cause: a named boundary participates in every transition unless told otherwise. Fix: `default="none"`, which turns off all triggers not explicitly listed — and then list the ones you want.

```tsx
<ViewTransition name={`photo-${id}`} share="morph" default="none">
  <Image src={src} alt={title} />
</ViewTransition>
```

**★ Symptom: adding `default="none"` silently stopped the shared-element morph.** Cause: with `default="none"` and no `share` prop, the pair has no class to animate under. The guide states it: *"With `default=\"none\"` and no `share` prop, the pair silently stops morphing."* Fix: keep the explicit `share` alongside it, as in the block above.

**★ Symptom: `There are two <ViewTransition name=…> components with the same name mounted at the same time.`** Cause: a shared `name` inside a mapped list, so every item claims the same identity. React detects it in development and logs two errors with both stack traces. Fix: namespace the name with the item id.

```tsx
// 🚩 all items get the same "name"
function Item() {
  return <ViewTransition name="item">{/* ... */}</ViewTransition>
}

// ✅ unique per item
function Item({ id }: { id: string }) {
  return <ViewTransition name={`item-${id}`}>{/* ... */}</ViewTransition>
}
```

**★ Symptom: a `<ViewTransition>` never activates and there is no error.** Cause: it is not the outermost element — *"`<ViewTransition>` only activates if it is placed before any DOM node."* Fix: hoist it above the wrapper.

```tsx
// 🚩
<div><ViewTransition>Hi</ViewTransition></div>

// ✅
<ViewTransition><div>Hi</div></ViewTransition>
```

**★ Symptom: enter and exit animations never fire for a component in a layout.** Cause: layouts persist across navigations, so nothing enters or exits there. The guide is blunt: *"Put the wrapper in each `page.tsx`, not the layout. Layouts persist across navigations, so enter and exit never fire there."* Fix: wrap the page content, in every participating page.

**★ Symptom: the directional slide plays for in-app links and not for the browser Back button.** Cause: *"Browser-initiated back navigations (the back button or swipe gestures) do not carry a transition type"* — and the type is what selects the directional animation. Fix: nothing to fix; make sure `default: 'none'` is set so untyped navigations produce no animation rather than an inconsistent one, and rely on shared-element `name` pairs, which still match.

**★ Symptom: clicking three links quickly produces two animations and skips a page.** Cause: React batches updates that arrive while an animation is running — A→B, then C and D queued, animates B→D. Fix: expected behaviour, and the reason to keep durations short. Do not build UI that assumes every intermediate route was drawn.

**Symptom: an animation you trigger with your own `document.startViewTransition` gets cut off.** Cause: *"if you have something else on the page running a ViewTransition React will interrupt it."* Fix: migrate to `<ViewTransition>` and let React coordinate; the docs recommend exactly this for code that predates the component.

**Symptom: a transition silently does not run in one specific interaction.** Cause: a `flushSync` in the middle of the sequence — React skips the Transition because it relies on completing synchronously. Fix: remove the synchronous flush from that path, or accept the skip.

**Symptom: nothing animates in one browser and everything works in another.** Cause: React's integration uses transition types and `view-transition-class`, available in Chromium 125+ and recent Safari and Firefox, and *"Some animations may behave differently in Safari."* Fix: nothing is broken — *"Without browser support, your application works normally; the transitions do not animate."* Verify the un-animated path is acceptable rather than trying to polyfill.

**Symptom: a user with vestibular sensitivity reports the app is unusable.** Cause: React does not disable animations for `prefers-reduced-motion` — the reference says so explicitly. Fix: disable durations under the media query yourself, at minimum.

```css title="app/globals.css"
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```

**Symptom: elements inside a morphing container do not move independently and the result looks rubbery.** Cause: `<ViewTransition>` snapshots an image that is moved, scaled and cross-faded — not a per-element layout animation. Fix: as the reference suggests, add more `<ViewTransition>` boundaries around the pieces that should carry their own continuity.

## Interview questions

**★ Are view transitions in Next.js stable? Answer carefully.**
They ship without configuration and they are not a stable React API, and both halves matter. The Next.js guide says view transitions work in the App Router with no configuration, because the App Router pins a React canary release that contains `ViewTransition` — so there is no flag to enable and no `react@canary` to install. React's own reference marks the API as available only in its Canary and Experimental channels. The practical reading: safe to use in a Next.js app, unsafe to assume the prop shape is final, and not portable to a standalone React 19.2 project.

**★ What activates a `<ViewTransition>` and what does not?**
Transitions, `<Suspense>` boundaries resolving, and `useDeferredValue`. A plain `setState` does not — the React reference states that updates must be wrapped in one of those three. In Next.js, route navigations are transitions, so navigation animations activate automatically; anything else you want animated has to go through `startTransition` or arrive via Suspense.

**★ Why does almost every documented example carry `default="none"`?**
Because a `<ViewTransition>` participates in *every* transition on the page unless told otherwise, so a named element intended for one specific morph will also animate during unrelated navigations. `default="none"` turns off all triggers not explicitly listed. The catch is that it is easy to over-apply: with `default="none"` and no `share` prop, a named pair silently stops morphing, so the explicit `share` has to stay.

**★ Why is directional navigation animation a design decision rather than a setting?**
Because Next.js cannot know which of your links is "deeper" and which is "back" — the transition type is not automatic, and the guide says so. You tag links with `transitionTypes={['nav-forward']}` or `['nav-back']` according to your own information hierarchy, and the `<ViewTransition>` maps those types to animations. The direct consequence is that browser-initiated Back navigations carry no type at all, so the directional animation does not play for them; only shared-element `name` pairs still match.

**★ Three links are clicked in quick succession. What does the user see?**
Two animations, not three. React waits for a running view transition to finish before starting the next, and batches every update that arrived meanwhile into one — the documented example is A→B, with C and D queued, animating B→D when the first finishes. The intermediate state is never drawn. That is a reason to keep durations short and a reason not to build anything that assumes each route was visibly rendered.

**★ A `<ViewTransition>` produces no animation and no error. What are the two things to check first?**
Whether it is the outermost node — it *"only activates if it is placed before any DOM node"*, so a wrapping `<div>` disables it — and whether the update that should have triggered it was a Transition rather than a bare `setState`. After those, check that the element is not in a layout, since layouts persist across navigations and enter/exit therefore never fire there.

**Why does React apply `view-transition-name` lazily rather than eagerly?**
Because a `view-transition-name` present on every candidate element at all times would make every element a participant in every transition the browser runs, which is both a correctness problem and a performance one. React applies the name to the nearest DOM node inside the boundary only at the moment that boundary should participate, and reverts it once the `startViewTransition` ready promise resolves. It is the same instinct behind auto-generating unique names when you do not supply one: prevent unintended pairing.

**What is the difference between what `<ViewTransition>` animates and what a layout-animation library animates?**
`<ViewTransition>` snapshots an image and moves, scales and cross-fades it, so the contents of a transitioning region do not animate individually. That is cheaper and usually reads as smoother continuity for the region as a whole. A layout-animation system in the style of React Native or Motion animates each element's own position, which preserves independent motion at higher cost. The reference is upfront that the snapshot model can lose continuity for things that should move by themselves, and that the remedy is more `<ViewTransition>` boundaries, not a different library.

---

← [05 · Prefetching fundamentals](05-prefetching-fundamentals-and-the-native-view-transitions-api.md) · [Chapter 2 overview](01-explanation.md) · Next → [05c · Morph and Suspense reveal](05c-view-transition-patterns.md)
