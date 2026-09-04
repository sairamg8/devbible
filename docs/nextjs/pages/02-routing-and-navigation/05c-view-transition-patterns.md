---
title: "The shared-element morph and the Suspense reveal are the two patterns that animate inside a page, and the morph carries a hidden dependency — it only forms a pair when the destination renders in the same commit, which in practice means when it was prefetched"
sidebar_label: "05c · Morph and Suspense reveal"
sidebar_position: 151
description: "The shared-element morph and why it silently degrades when the destination is not prefetched, customising it with share and default, and the Suspense reveal with the asymmetric timing that makes it read as a handoff rather than a swap."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js [Designing view transitions](https://nextjs.org/docs/app/guides/view-transitions) guide (`lastUpdated: 2026-08-25`) and the React reference [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition) on `react@19.2`.
> Target: **Next.js 16.3.4** · React `<ViewTransition>` is **Canary / Experimental** — see [05b](05b-the-native-view-transitions-api.md). Documentation-verified — **no sandbox run**.

**The guide's own framing is the useful one: each pattern answers a question, and using the wrong animation answers the wrong question. A shared-element morph says *"same thing, going deeper"*. A Suspense reveal says *"data loaded"*. A directional slide says *"going forward"* or *"coming back"*. A same-route crossfade says *"same place, different content"*. Slide between tabs and you have told the user they went somewhere; crossfade a drill-down and you have told them nothing moved. The mechanics are all small; the decision about which one to use is the part that carries the meaning. This page covers the two that animate *within* a page — the morph and the Suspense reveal — and the morph is the one with a hidden dependency, because it only forms a pair when the destination renders in the same commit. The two that animate *between* places are [05d](05d-directional-slides-and-same-route-crossfades.md).**

| Pattern | What it communicates | Where |
| --- | --- | --- |
| Shared element (morph) | "Same thing, going deeper" | this page |
| Suspense reveal | "Data loaded" | this page |
| Directional slide | "Going forward / coming back" | [05d](05d-directional-slides-and-same-route-crossfades.md) |
| Same-route crossfade | "Same place, different content" | [05d](05d-directional-slides-and-same-route-crossfades.md) |

## 1 · Morph a shared element

Wrap both the source and the destination in a `<ViewTransition>` carrying the **same `name`**:

```tsx title="components/photo-grid.tsx"
import { ViewTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'

function PhotoGrid({ photos }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {photos.map((photo) => (
        <Link key={photo.id} href={`/photo/${photo.id}`}>
          <ViewTransition name={`photo-${photo.id}`}>
            <Image src={photo.src} alt={photo.title} />
          </ViewTransition>
        </Link>
      ))}
    </div>
  )
}
```

```tsx title="app/photo/[id]/photo-content.tsx"
import { ViewTransition } from 'react'
import Image from 'next/image'

async function PhotoContent({ id }) {
  const photo = await getPhoto(id)

  return (
    <ViewTransition name={`photo-${photo.id}`}>
      <div style={{ position: 'relative', aspectRatio: '3 / 2' }}>
        <Image src={photo.src} alt={photo.title} fill />
      </div>
    </ViewTransition>
  )
}
```

> *"The `name` prop creates identity. React finds elements with the same name on the old and new pages, then animates between their size and position automatically. No additional props are needed for the morph to work."*

### 🔴 The morph depends on prefetching

> *"The morph plays when the destination content renders in the same commit as the navigation, which is the case with prefetched (cached) pages. If the destination suspends into a fallback first, no pair forms, and the content animates with its enter animation instead when it arrives."*

That is a direct dependency between two subjects that look unrelated. A `share` pair requires the deleted and inserted `<ViewTransition>` boundaries to exist **in the same Transition**; if the destination suspends first, the insertion happens later and there is nothing to pair with. So a dynamic route with no `loading.js`, or a link with `prefetch={false}`, or a slow network, will all degrade a morph into a plain enter animation — and it will look like the morph "works sometimes". See [05 · Prefetching fundamentals](05-prefetching-fundamentals-and-the-native-view-transitions-api.md).

### Customising the morph

```tsx
<ViewTransition name={`photo-${photo.id}`} share="morph" default="none">
  <Image src={photo.src} alt={photo.title} />
</ViewTransition>
```

```css title="app/globals.css"
::view-transition-group(.morph) {
  animation-duration: 400ms;
}
::view-transition-image-pair(.morph) {
  animation-name: via-blur;
}
@keyframes via-blur {
  30% {
    filter: blur(3px);
  }
}
```

> *"The blur hides pixel-level interpolation artifacts during the transition. At 400ms, the morph is slow enough to register but fast enough to feel direct."*

Both props are required together. `default="none"` stops the named image running its own crossfade on every unrelated transition — and *"With `default=\"none\"` and no `share` prop, the pair silently stops morphing."* Apply the same two props to **both** ends of the pair.

## 2 · Animate the Suspense reveal

The fallback gets an exit animation; the content gets an enter animation:

```tsx title="app/photo/[id]/page.tsx"
import { Suspense, ViewTransition } from 'react'

export default async function PhotoPage({ params }) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <ViewTransition exit="slide-down" default="none">
          <PhotoContentSkeleton />
        </ViewTransition>
      }
    >
      <ViewTransition enter="slide-up" default="none">
        <PhotoContent id={id} />
      </ViewTransition>
    </Suspense>
  )
}
```

```css title="app/globals.css"
:root {
  --duration-exit: 150ms;
  --duration-enter: 210ms;
  --duration-move: 400ms;
}

::view-transition-old(.slide-down) {
  animation:
    var(--duration-exit) ease-out both fade reverse,
    var(--duration-exit) ease-out both slide-y reverse;
}
::view-transition-new(.slide-up) {
  animation:
    var(--duration-enter) ease-in var(--duration-exit) both fade,
    var(--duration-move) ease-in both slide-y;
}

@keyframes fade {
  from {
    filter: blur(3px);
    opacity: 0;
  }
  to {
    filter: blur(0);
    opacity: 1;
  }
}
@keyframes slide-y {
  from {
    transform: translateY(10px);
  }
  to {
    transform: translateY(0);
  }
}
```

The asymmetric timing is deliberate and worth copying rather than rounding off:

> *"The asymmetry is deliberate. Old content should leave quickly so it does not compete for attention. New content should arrive more gently so the user has time to register it. The `var(--duration-exit)` delay on the enter fade means the new content waits for the old content to finish leaving before it becomes visible."*

Note also the meaning being encoded: *"vertical direction encodes hierarchy. Content sliding up communicates arrival. Content sliding down communicates departure."*

## Gotchas

**★ Symptom: the shared-element morph works for some photos and not others.** Cause: the pair only forms when the destination renders in the same commit as the navigation — *"which is the case with prefetched (cached) pages"*. A destination that suspends into a fallback first has no partner to pair with, and the content plays its enter animation instead. Fix: make the destination prefetchable — add `loading.js` is *not* the fix here, since a fallback is exactly what breaks the pair. Prefer a route that prefetches in full, and do not set `prefetch={false}` on links you want to morph from.

```tsx
// 🚩 no prefetch, so the destination arrives late and the pair never forms
<Link href={`/photo/${id}`} prefetch={false}>

// ✅ default prefetching gives the morph a chance
<Link href={`/photo/${id}`}>
```

**★ Symptom: the morph stopped working the moment you added `default="none"`.** Cause: `default="none"` turns off every trigger not explicitly listed, and the morph is the `share` trigger. Fix: name it.

```tsx
<ViewTransition name={`photo-${id}`} share="morph" default="none">
```

**★ Symptom: the new content appears before the old content has left, and the two overlap.** Cause: the enter animation has no delay. Fix: delay the enter fade by the exit duration, which is what the documented `var(--duration-exit)` delay is for — old content leaves fast, new content arrives after it.

**Symptom: the morph animates the wrong pair when two photos are on screen with the same id.** Cause: duplicate `name` values mounted simultaneously, which React reports as an error in development. Fix: namespace the name so it is unique across the whole app at any instant, not just within one list.

**★ Symptom: adding `loading.tsx` to the detail route made navigation feel better and killed the morph.** Cause: a route-level `loading.js` is a Suspense fallback, and *"If the destination suspends into a fallback first, no pair forms."* The two improvements are in direct tension: the fallback is what makes the navigation feel immediate, and it is also what prevents the shared element from pairing. Fix: choose per route. For a drill-down where the morph carries the meaning, keep the destination prefetchable and let it render in the same commit; use the Suspense reveal below to animate whatever genuinely does need to stream in *inside* that page.

**★ Symptom: the blur keyframe has no effect on the morph.** Cause: it is targeting the wrong pseudo-element. `::view-transition-group` controls the group's own animation — the timing and movement — while the cross-fade between old and new images is `::view-transition-image-pair`. Fix: put duration on the group and the keyframe name on the image pair, as the documented CSS does.

```css
::view-transition-group(.morph) { animation-duration: 400ms; }
::view-transition-image-pair(.morph) { animation-name: via-blur; }
```

**★ Symptom: the morph works one way and not on the way back.** Cause: the props are on only one end of the pair. Both the grid thumbnail and the detail hero need the same `name`, and if you added `share="morph" default="none"` you have to add them to both — the guide says so explicitly of its own two snippets. Fix: keep the pair symmetrical, ideally by extracting one component used at both ends.

**Symptom: the image distorts mid-flight, stretching before it settles.** Cause: the two ends have different aspect ratios, so the snapshot is being scaled between mismatched boxes. Fix: give the destination a defined aspect ratio, which is why the documented detail component wraps the image in `style={{ position: 'relative', aspectRatio: '3 / 2' }}` rather than letting it size itself.

**Symptom: the Suspense fallback does not animate out.** Cause: the `<ViewTransition>` wraps the component *inside* the fallback rather than being the fallback itself, or there is no `exit` prop on it. Fix: the fallback expression is the `<ViewTransition exit="slide-down" default="none">` wrapper, with the skeleton as its child.

## Interview questions

**★ A shared-element morph works sometimes and degrades to a fade the rest of the time. Diagnose it.**
The pair only forms when the destination content renders in the same commit as the navigation, which is what happens with a prefetched, cached destination. If the destination suspends into a fallback first, the insertion happens in a later commit and there is no deleted/inserted pair for `share` to match, so the content plays its enter animation instead. So the variable is prefetch state — a `prefetch={false}` link, a dynamic route, a slow network. It looks like an animation bug and it is a data-loading question.

**★ Explain the asymmetric timing in the Suspense reveal.**
The exit is fast — 150 ms — so old content leaves without competing for attention. The enter fade is slower at 210 ms *and* delayed by the exit duration, so the new content does not become visible until the old has finished leaving; its slide movement runs longer still, at 400 ms. The effect is a handoff rather than a swap: the placeholder yields, then the real content arrives gently enough to be registered. Symmetric timing produces an overlap that reads as a glitch.

**★ Adding `loading.tsx` to a detail page made it feel snappier and broke the shared-element morph. Explain the trade.**
They are the same mechanism pulling in opposite directions. `loading.js` is a Suspense fallback, and it is what lets a dynamic route commit the navigation immediately instead of waiting on the server. But a `share` pair requires the deleted and inserted boundaries to exist in the same Transition, and a destination that suspends into a fallback first inserts its content in a later commit — so the pair never forms and the content plays its enter animation instead. You pick one per route: the morph, by keeping the destination prefetchable and rendering in one commit, or the immediate fallback, animating what streams in with a Suspense reveal instead.

**★ What is the difference between the `share` trigger and `enter`?**
`share` fires when a *named* `<ViewTransition>` in a deleted subtree has a same-named partner in an inserted subtree within the same Transition — that pairing is what produces a morph between two positions and sizes. `enter` fires when a `<ViewTransition>` is simply the first component inserted in the Transition, with no partner. That is exactly why a failed pairing degrades to a fade rather than to nothing: React still sees an insertion, so `enter` applies.

**Both ends of a morph need the same props. What happens if you only update one?**
The `name` has to match on both or no pair forms at all. The class props are subtler: if you add `default="none"` to one end only, that end stops participating in transitions it is not explicitly opted into, so the pair can form in one direction and not the other — producing a morph on the way in and a plain fade on the way back. The guide's instruction is to add the props to both snippets, and the maintainable version is a single shared component rendered at both ends.

**Why does the documented morph CSS add a blur keyframe rather than just a longer duration?**
Because the artefact it is hiding is interpolation, not speed. The browser cross-fades between two snapshots of different sizes, and at the pixel level that produces visible mismatch during the middle of the flight. A brief blur at 30% masks it. The 400 ms duration is a separate decision, described as slow enough for the movement to register and fast enough to still feel direct — the two settings solve different problems and are not substitutes.

**Why is the enter fade in the Suspense reveal delayed by exactly the exit duration?**
So the two never overlap. The old content leaves over 150 ms; the new content's fade starts at 150 ms and runs for 210 ms, while its slide runs for 400 ms from the beginning. The effect is a handoff — the placeholder yields, then the real content arrives — rather than a dissolve where both are half-visible at once, which reads as a rendering glitch rather than as a transition.

---

← [05b · View Transitions](05b-the-native-view-transitions-api.md) · [Chapter 2 overview](01-explanation.md) · Next → [05d · Directional slides and crossfades](05d-directional-slides-and-same-route-crossfades.md)
