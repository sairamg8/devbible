---
title: "A directional slide says the user went somewhere and a crossfade says they did not, so the two are not interchangeable — and both fail in the same quiet way, because the wrapper belongs in every page.tsx and never in a layout"
sidebar_label: "05d · Slides and crossfades"
sidebar_position: 152
description: "Tagging navigations with transitionTypes and mapping them to directional animations, why the wrapper cannot live in a layout, anchoring a sticky header, restoring pointer events during a transition, prefers-reduced-motion, and the same-route crossfade that needs a key."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js [Designing view transitions](https://nextjs.org/docs/app/guides/view-transitions) guide (`lastUpdated: 2026-08-25`), the [Link Component](https://nextjs.org/docs/app/api-reference/components/link) reference (`lastUpdated: 2026-08-25`) and the React reference [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition) on `react@19.2`.
> Target: **Next.js 16.3.4** · `transitionTypes` on `<Link>` since **v16.2.0** · React `<ViewTransition>` is **Canary / Experimental** — see [05b](05b-the-native-view-transitions-api.md). Documentation-verified — **no sandbox run**.

**These are the two patterns that describe *movement between places*, and they say opposite things. A directional slide tells the user they travelled — forward into detail, or back out of it. A crossfade tells them they stayed put and the contents changed. Applying a slide to a tab strip claims a journey that did not happen; crossfading a drill-down loses the spatial story entirely. Both patterns also share a failure mode that produces no error and no animation: the `<ViewTransition>` wrapper has to live in every participating `page.tsx`, because layouts persist across navigations and therefore never see anything enter or exit. [05c](05c-view-transition-patterns.md) covers the two patterns that animate inside a page.**

## 3 · Directional slides for navigation

Tag the links, then map the types to animations. Tagging is `transitionTypes` on `<Link>`:

```tsx title="components/photo-grid.tsx"
<Link href={`/photo/${photo.id}`} transitionTypes={['nav-forward']}>
  {/* photo thumbnail */}
</Link>
```

```tsx title="app/photo/[id]/page.tsx"
<Link href="/" transitionTypes={['nav-back']}>
  ← Gallery
</Link>
```

Then the page content maps types to classes:

```tsx title="app/photo/[id]/page.tsx"
<ViewTransition
  enter={{
    'nav-forward': 'nav-forward',
    'nav-back': 'nav-back',
    default: 'none',
  }}
  exit={{
    'nav-forward': 'nav-forward',
    'nav-back': 'nav-back',
    default: 'none',
  }}
  default="none"
>
  {/* page content */}
</ViewTransition>
```

> *"The `enter` and `exit` props accept an object keyed by transition type. When a navigation carries the `nav-forward` type, the exit animation slides old content left and the enter animation slides new content in from the right. The `default: \"none\"` ensures that transitions without a type (browser back/forward, `router.refresh()`, Suspense reveals) produce no directional animation."*

🔴 **The wrapper goes in every participating `page.tsx`, never in the layout:**

> *"Wrap every participating page the same way. For the gallery to slide out on forward navigation and back in on `nav-back`, its page needs the same wrapper. Put the wrapper in each `page.tsx`, not the layout. Layouts persist across navigations, so enter and exit never fire there."*

```css title="app/globals.css"
::view-transition-old(.nav-forward) {
  --slide-offset: -60px;
  animation:
    150ms ease-in both fade reverse,
    400ms ease-in-out both slide reverse;
}
::view-transition-new(.nav-forward) {
  --slide-offset: 60px;
  animation:
    210ms ease-out 150ms both fade,
    400ms ease-in-out both slide;
}

::view-transition-old(.nav-back) {
  --slide-offset: 60px;
  animation:
    150ms ease-in both fade reverse,
    400ms ease-in-out both slide reverse;
}
::view-transition-new(.nav-back) {
  --slide-offset: -60px;
  animation:
    210ms ease-out 150ms both fade,
    400ms ease-in-out both slide;
}

@keyframes slide {
  from {
    translate: var(--slide-offset);
  }
  to {
    translate: 0;
  }
}
```

> *"The 60px offset is enough to communicate direction without making the user track a fast-moving element across the screen."*

### Anchoring the header

> *"During directional slides, the header should not move. A sliding header breaks the user's spatial anchor. They need one fixed reference point to understand that the *content* moved, not the entire viewport."*

```tsx title="components/header.tsx"
<header style={{ viewTransitionName: 'site-header' }}>
  {/* navigation links */}
</header>
```

```css title="app/globals.css"
::view-transition-group(site-header) {
  animation: none;
  z-index: 100;
}
::view-transition-old(site-header) {
  display: none;
}
::view-transition-new(site-header) {
  animation: none;
}
```

> *"The `display: none` on the old snapshot prevents a flash where both old and new headers are briefly visible. The `z-index: 100` ensures the header renders above the sliding content."*

### Keeping the page interactive

> *"While a transition runs, the `::view-transition` overlay captures pointer events, so clicks during the animation are lost."*

```css title="app/globals.css"
::view-transition {
  pointer-events: none;
}
```

> *"This restores interactivity for unnamed content. Hit-testing still skips named participants (like the anchored header) for the transition's duration, so keep transitions short and avoid naming elements the user clicks rapidly."*

### Reduced motion

> *"Directional slides simulate physical movement across the viewport. This is the most common trigger for motion sensitivity. Morphs, reveals, and crossfades carry less risk since they affect smaller areas or rely on opacity rather than position."*

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

> *"Without animation, content swaps instantly, which is the browser's default behavior."*

## 4 · Same-route crossfade

Tabs that change content under the same route shape — `/collection/[slug]` — should not slide, because nothing went anywhere:

```tsx title="app/collection/[slug]/page.tsx"
import { Suspense, ViewTransition } from 'react'

export default async function CollectionPage({ params }) {
  const { slug } = await params

  return (
    <Suspense fallback={<CollectionGridSkeleton />}>
      <ViewTransition
        key={slug}
        name="collection-content"
        share="auto"
        enter="auto"
        default="none"
      >
        <CollectionGrid slug={slug} />
      </ViewTransition>
    </Suspense>
  )
}
```

> *"The `share=\"auto\"` and `enter=\"auto\"` props tell React to use its default crossfade animation. The `name` prop gives the container an identity so React knows what to animate. The navigation triggers the transition; the `key={slug}` change makes React treat the old and new content as an exit/enter pair (activating `share`) instead of an in-place update."*

The `key` is doing real work. Without it React sees a prop change on the same component — an `update`, not an exit/enter pair — and `share` never fires.

The guide also ships an agent skill that teaches these patterns plus its CSS recipes: `npx skills add vercel-labs/agent-skills --skill vercel-react-view-transitions`.

## 4 · Same-route crossfade

Tabs that change content under the same route shape — `/collection/[slug]` — should not slide, because nothing went anywhere:

```tsx title="app/collection/[slug]/page.tsx"
import { Suspense, ViewTransition } from 'react'

export default async function CollectionPage({ params }) {
  const { slug } = await params

  return (
    <Suspense fallback={<CollectionGridSkeleton />}>
      <ViewTransition
        key={slug}
        name="collection-content"
        share="auto"
        enter="auto"
        default="none"
      >
        <CollectionGrid slug={slug} />
      </ViewTransition>
    </Suspense>
  )
}
```

> *"The `share=\"auto\"` and `enter=\"auto\"` props tell React to use its default crossfade animation. The `name` prop gives the container an identity so React knows what to animate. The navigation triggers the transition; the `key={slug}` change makes React treat the old and new content as an exit/enter pair (activating `share`) instead of an in-place update."*

The `key` is doing real work. Without it React sees a prop change on the same component — an `update`, not an exit/enter pair — and `share` never fires.

The guide also ships an agent skill that teaches these patterns plus its CSS recipes and troubleshooting: `npx skills add vercel-labs/agent-skills --skill vercel-react-view-transitions`.

## Gotchas

**★ Symptom: directional slides never fire, and the wrapper looks correct.** Cause: it is in `layout.tsx`. Layouts persist across navigations, so `enter` and `exit` never fire there. Fix: move the wrapper into each participating `page.tsx` — including the page you are navigating *from*, or it will not slide out.

**★ Symptom: only one side of the navigation animates.** Cause: only one page carries the wrapper. Both the departing and arriving pages need it, with the same `enter`/`exit` type maps. Fix: apply the identical wrapper to every participating page.

**★ Symptom: clicks during a transition do nothing.** Cause: the `::view-transition` overlay captures pointer events for the duration. Fix: let them through, and keep transitions short.

```css
::view-transition { pointer-events: none; }
```

**★ Symptom: the sticky header slides with the content and the page feels like it is falling over.** Cause: the header has no `viewTransitionName`, so it is part of the sliding snapshot. Fix: name it and suppress its animation, hiding the old snapshot to avoid a double-header flash.

```css
::view-transition-group(site-header) { animation: none; z-index: 100; }
::view-transition-old(site-header) { display: none; }
::view-transition-new(site-header) { animation: none; }
```

**★ Symptom: the tab crossfade does not animate, even though `share="auto"` is set.** Cause: no `key`. Without a changing `key`, React treats the new slug as a prop update on the same component, which is the `update` trigger, not an exit/enter pair — and `share` requires a pair. Fix: `key={slug}`.

**★ Symptom: content flashes at the start of a slide, with old and new both briefly visible.** Cause: a named participant whose old snapshot is still painted. Fix: `display: none` on the `::view-transition-old(...)` for that name, which is exactly what the header recipe does.

**★ Symptom: the tab crossfade does not animate, even though `share="auto"` is set.** Cause: no `key`. Without a changing `key`, React treats the new slug as a prop update on the same component, which is the `update` trigger, not an exit/enter pair — and `share` requires a pair. Fix: `key={slug}`.

```tsx
<ViewTransition key={slug} name="collection-content" share="auto" enter="auto" default="none">
```

**★ Symptom: content flashes at the start of a slide, with old and new both briefly visible.** Cause: a named participant whose old snapshot is still painted. Fix: `display: none` on the `::view-transition-old(...)` for that name, which is exactly what the header recipe does.

**Symptom: users report the app feels sluggish after adding transitions, and durations are already short.** Cause: too many named participants. Hit-testing skips named participants for the transition's duration, so naming elements a user clicks rapidly makes the app feel unresponsive even when the animation itself is quick. Fix: name only what genuinely needs identity across the navigation.

**Symptom: an accessibility audit flags motion, and you added `prefers-reduced-motion` handling.** Cause: zeroing every duration is the blunt version, and it also removes crossfades and opacity changes that carry no motion risk. Fix: it is a legitimate starting point — the guide calls it *"the simplest approach"* — but the more refined version preserves opacity transitions and removes only positional movement. Directional slides are the pattern that actually needs suppressing.

**Symptom: an accessibility audit flags motion, and you added `prefers-reduced-motion` handling.** Cause: zeroing every duration is the blunt version, and it also removes crossfades and opacity changes that carry no motion risk. Fix: it is a legitimate starting point — the guide calls it *"the simplest approach"* — but the more refined version preserves opacity transitions and removes only positional movement. Directional slides are the pattern that actually needs suppressing.

**Symptom: a Back press plays the "forward" slide.** Cause: the navigation carried a `nav-forward` type, or the `enter`/`exit` maps have no `default` entry so an untyped navigation fell through to an animation. Fix: `default: 'none'` inside both maps, so navigations with no type — browser Back and Forward, `router.refresh()`, Suspense reveals — produce no directional animation at all.

## Interview questions

**★ Which transition do you use for a tab strip, and why not a slide?**
A crossfade, on the same route. A slide communicates "going to a new place", and a tab is the same place with different content — the container persists and only the inner grid changes. The implementation is a `<ViewTransition>` with `share="auto"`, `enter="auto"`, `default="none"` and, critically, `key={slug}`: the key change is what makes React treat old and new as an exit/enter pair and activate `share` rather than performing an in-place update.

**★ Why does the directional-slide wrapper have to be in `page.tsx` and not in the layout?**
Because enter and exit are about insertion and deletion, and a layout is neither — it persists across navigations by design, which is what makes client-side transitions cheap. A `<ViewTransition>` in a layout never sees its subtree enter or exit, so those animations never fire. It also has to be on *both* pages: the departing page needs the exit, the arriving page needs the enter, and a wrapper on only one side produces a half-animation.

**★ What does `default: 'none'` inside the `enter` and `exit` objects protect against?**
Navigations that carry no transition type: browser Back and Forward, `router.refresh()`, and Suspense reveals. Those would otherwise fall through to whatever the default animation is, so a Back press could play a "forward" slide. Setting `default: 'none'` makes untyped navigations produce no directional animation at all, which is the honest outcome — you cannot know the direction, so you should not claim one.

**★ Why are directional slides the pattern that most needs `prefers-reduced-motion` handling?**
Because they simulate physical movement across the viewport, which the guide names as the most common trigger for motion sensitivity. Morphs, reveals and crossfades affect smaller areas or work through opacity rather than position, so they carry less risk. React does not disable anything automatically, so the media query is yours to write; zeroing all durations is the simple version, and the better version keeps opacity transitions while removing positional movement.

**Why do you have to give a sticky header a `viewTransitionName` and then animate it to nothing?**
Because without a name it is part of the general page snapshot and slides with everything else, destroying the user's fixed reference point — the whole reason a slide reads as "the content moved" rather than "the viewport moved". Naming it makes it its own transition group, and setting `animation: none` on the group and new snapshot plus `display: none` on the old one holds it still and prevents the brief double-header flash. The `z-index` keeps it above the sliding content.

**What is the cost of naming a lot of elements?**
Hit-testing skips named participants for the duration of the transition, so every named element is briefly unclickable. On a page where users click rapidly — a dense nav, a list with inline actions — that reads as unresponsiveness even when the animation is short. The guidance follows directly: name only what needs identity across the navigation, and keep transitions short so the dead window is small.

**★ What does `default: 'none'` inside the `enter` and `exit` objects protect against?**
Navigations that carry no transition type: browser Back and Forward, `router.refresh()`, and Suspense reveals. Those would otherwise fall through to whatever the default animation is, so a Back press could play a "forward" slide. Setting `default: 'none'` makes untyped navigations produce no directional animation at all, which is the honest outcome — you cannot know the direction, so you should not claim one.

**★ Why are directional slides the pattern that most needs `prefers-reduced-motion` handling?**
Because they simulate physical movement across the viewport, which the guide names as the most common trigger for motion sensitivity. Morphs, reveals and crossfades affect smaller areas or work through opacity rather than position, so they carry less risk. React does not disable anything automatically, so the media query is yours to write; zeroing all durations is the simple version, and the better version keeps opacity transitions while removing positional movement.

**What is the cost of naming a lot of elements?**
Hit-testing skips named participants for the duration of the transition, so every named element is briefly unclickable. On a page where users click rapidly — a dense nav, a list with inline actions — that reads as unresponsiveness even when the animation is short. The guidance follows directly: name only what needs identity across the navigation, and keep transitions short so the dead window is small.

---

← [05c · Morph and Suspense reveal](05c-view-transition-patterns.md) · [Chapter 2 overview](01-explanation.md) · Next → [06 · 16.3 preview: instant navigations](06-163-preview-instant-navigations-stream-cache-block-and-parti.md)
