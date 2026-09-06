---
title: "Motion measures boxes, so anything that moves the box without telling it — a scroll offset, a fixed container, a parent animating on a different curve — has to be declared"
sidebar_label: "01d · Scroll, fixed and anchored containers"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Layout animation](https://motion.dev/docs/react-layout-animations),
> [Motion component](https://motion.dev/docs/react-motion-component) and
> [`arc()`](https://motion.dev/docs/arc), read from a 131-page raw mirror of motion.dev.
> Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on **React 19.2.8** —
> React version probed on the installed package; `motion` is not installed in this
> checkout, so every API claim here is documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

**Every layout animation is the difference between two measurements, so the correctness of the animation depends entirely on the coordinate space those measurements were taken in.** Scroll offset, `position: fixed`, and a parent animating on its own curve each move that space out from under the measurement — and Motion, for measured performance reasons, does not go looking for them. It waits to be told. Each of the props below exists because the default is deliberately cheap and occasionally wrong, and the prop is how you buy the correct measurement only where it matters.

## Scroll containers: `layoutScroll`

> *"For layout animations to work correctly within scrollable elements, their scroll offset needs measuring. For performance reasons, Framer Motion doesn't measure the scroll offset of every ancestor. Add the layoutScroll prop to elements that should be measured."*

The trade-off is stated in the middle of that quote and is the whole reason the prop exists: walking every ancestor looking for a scroll offset on every measurement is a cost nobody wants on the common case, where nothing scrolls.

> *"To correctly animate layout within a scrollable container, you must add the layoutScroll prop to the scrollable element. This allows Motion to account for the element's scroll offset."*

```tsx
<motion.div layoutScroll style={{ overflow: 'scroll' }}>
  <motion.div layout />
</motion.div>
```

⚠️ **The reference wording is plural — the prop marks *elements that should be measured*.** The documentation frames this as a per-element opt-in rather than a single root, so a design with a scrolling panel inside a scrolling page has more than one candidate. The docs do not spell out the nested case explicitly; treat each scrollable ancestor whose offset affects the animating element as needing the prop, and verify visually.

## Fixed containers: `layoutRoot`

> *"To correctly animate layout within fixed elements, we need to provide them the layoutRoot prop."*

> *"This lets Motion account for the page's scroll offset when measuring children."*

```tsx
<motion.div layoutRoot style={{ position: 'fixed' }}>
  <motion.div layout />
</motion.div>
```

The mechanism is the mirror image of `layoutScroll`. A fixed element does not move when the page scrolls, but its children's page-relative coordinates do — so without `layoutRoot` the measured delta includes a page scroll that never applied to this element. The symptom is an animation whose error grows the further down the page you are, which is exactly the kind of bug that does not reproduce at the top of a document.

## Parent-relative projection, and `layoutAnchor`

> *"Motion's layout animations look correct when a parent and child animate with different transitions, because it resolves the child's position relative to its parent."*

> *"What this means is if you have a parent and child performing a layout animation with different transitions, unlike the browser's View Transition API, the child will never get "left behind" by its parent."*

This is the behaviour you get for free and never notice — until you change it. `layoutAnchor` chooses the point in that relative calculation, as independent `0`–`1` progress values, defaulting to `{ x: 0, y: 0 }`:

```tsx
// pin the child to the centre of the relative calculation
<motion.ul layout>
  <motion.li layout layoutAnchor={{ x: 0.5, y: 0.5 }} transition={{ delay: 1 }} />
</motion.ul>
```

`0` is top/left, `0.5` is centre, `1` is bottom/right. And there is an off switch:

> *"Setting to false disables relative projection for this element, and elements will animate relative to their page-relative change."*

⚠️ **The two documentation pages disagree about whose top-left the default refers to.** The layout animation guide says *"By default, these calculations use the top left of the child, but you can change this with the layoutAnchor prop."* The motion component reference says *"By default, it does this using the top/left of the parent."* I could not settle which phrasing is authoritative from the documentation alone, and the practical answer is unaffected — the anchor is the top-left corner, and `{ x: 0.5, y: 0.5 }` moves it to the centre. Do not build an argument on the child/parent distinction without checking the behaviour yourself.

## Curved motion: `arc()` on `transition.layout.path`

By default a layout animation travels in a straight line between the old box and the new one.

> *"Pass arc() to transition.layout.path to curve the motion of a layout animation."*

```tsx
import { arc, motion } from 'motion/react';

<motion.div
  layout
  transition={{ layout: { duration: 0.6, path: arc({ strength: 0.6 }) } }}
/>
```

It works for shared transitions too:

```tsx
<motion.div layoutId="bubble" transition={{ layout: { path: arc() } }} />
```

The `arc()` reference documents `strength` (default `0.5`, where `1` peaks at a height equal to the distance between the two points and `0` is no bend), `peak` (default `0.5`, where along the bend the maximum height falls), `direction` (`"cw"`, `"ccw"`, or automatic), and `rotate` (default `false`, rotating the element to follow the tangent). It also notes that with automatic `direction`, creating a single `arc()` instance for all animations on the same component enables improved interruption:

```tsx
const path = useMemo(() => arc({ strength: 1 }), []);
```

## Gotchas

### ⚠️ Pitfall 1: A Reorder Inside a Scrolled Panel Animates From the Wrong Place
**Symptom.** The list animates correctly at scroll position 0 and increasingly wrongly the further you scroll. **Cause.** Motion does not measure the scroll offset of every ancestor, so the "before" box was recorded in a coordinate space the "after" box was not. **Fix.** `layoutScroll` on the scrolling element. 🔴 The bug is invisible in every test that does not scroll first, which is most of them.

### ⚠️ Pitfall 2: Assuming One `layoutScroll` at the Root Covers Nested Scrollers
The prop is documented as marking *"elements that should be measured"* — an opt-in per element, not a global switch. A scrollable panel inside a scrollable page therefore has two candidates. The documentation does not state explicitly how nested scroll containers compose, so this is one to verify visually rather than reason about from the docs.

### ⚠️ Pitfall 3: A `position: fixed` Toolbar Whose Children Drift as the Page Scrolls
**Symptom.** A layout animation inside a fixed header or a fixed modal shell overshoots by roughly the page scroll distance. **Cause.** The children's page-relative coordinates change with page scroll even though the fixed element does not move, so the measured delta carries a scroll that never applied. **Fix.** `layoutRoot` on the fixed element, which lets Motion account for the page's scroll offset when measuring children.

### ⚠️ Pitfall 4: Reaching For `layoutRoot` on Anything That Is Not Fixed
Both the guide and the reference describe `layoutRoot` specifically in terms of `position: fixed` elements — the reference wording is literally about marking an element as fixed. It is not a general-purpose "make this a measurement boundary" prop, and the documentation does not describe behaviour for a non-fixed element carrying it. Treat that case as unspecified.

### ⚠️ Pitfall 5: A Delayed Child Appearing to Detach From Its Parent
**Symptom.** A child with its own slower transition looks like it is sliding out of its parent during the animation. **Cause.** This is the *feature* — relative projection anchors the child to a point on the parent so it is never left behind, and by default that point is the top-left, so a child that should visually hang off the centre or the right edge tracks the wrong corner. **Fix.** `layoutAnchor` with the progress values that match where the child visually belongs, `{ x: 1, y: 0 }` for a right-aligned child, `{ x: 0.5, y: 0.5 }` for a centred one.

### ⚠️ Pitfall 6: Passing `layoutAnchor={false}` Without Realising What It Turns Off
It does not "reset to default" — it disables relative projection for that element entirely, and the element then animates relative to its page-relative change. That is occasionally what you want (an element escaping its parent's animation deliberately), and it is exactly the View Transitions behaviour Motion otherwise avoids: the child can be left behind by its parent.

### ⚠️ Pitfall 7: Passing `arc()` to `transition.path` and Expecting a Layout Animation to Curve
`transition.path` is the entry point for animating between explicit `x`/`y` values. For a **layout** animation the documented key is `transition.layout.path`, because the layout animation is configured under its own `layout` key. Putting the path at the top level configures value animations that may not exist on that element, and the layout animation travels in a straight line as if you had written nothing.

```tsx
// ❌ curves nothing on a layout animation
<motion.div layout transition={{ path: arc() }} />

// ✅
<motion.div layout transition={{ layout: { path: arc() } }} />
```

### ⚠️ Pitfall 8: Creating a New `arc()` Inline on Every Render
The `arc()` docs call out that with automatic `direction`, a single instance shared across all animations on the same component enables improved interruption — the automatic mode picks a stable screen-space side and keeps the bulge there even when the direction of travel flips between calls. A fresh instance per render throws that continuity away. In React, memoise it.

### ⚠️ Pitfall 9: Combining `arc()` With a Spring and Being Surprised by the Overshoot
The `arc()` documentation is explicit that `transition.path` only describes the curve, and the driving transition is whatever you pass alongside it — with a spring, the progress value overshoots `t = 1` and oscillates back, so the element samples past the endpoint and settles with a bouncy arc. That is a design choice to make deliberately, not a bug to debug: if you wanted the curve without the overshoot, the spring is the thing to change.

## Interview questions

**★ Why does Motion need to be told about a scrollable ancestor at all — can it not just find one?**
It could, and the docs say why it does not: measuring the scroll offset of every ancestor on every layout measurement is a cost paid by every layout animation on every page, and almost none of them are inside a scroller that matters. `layoutScroll` moves that cost to the handful of places that need it. The design lesson generalises — the props in this family (`layoutScroll`, `layoutRoot`, `layoutDependency`) are all the same shape: a default that is cheap and occasionally wrong, plus an explicit opt-in for the case where it is wrong.

**★ A drag-to-reorder list animates perfectly at the top of the page and badly once scrolled. Where do you look?**
At the coordinate space, not the animation. Something between the animating element and the viewport is scrolling without Motion accounting for it. If the scroller is an element with `overflow: scroll`, it needs `layoutScroll`; if the animating element lives inside a `position: fixed` shell, that shell needs `layoutRoot`. Both bugs have the same signature — error proportional to scroll distance — which is why "it works on my screen" is such a reliable false negative here.

**★ What does parent-relative projection buy you, and what is the comparison the docs draw?**
It means a child whose transition differs from its parent's is resolved relative to that parent, so it is never left behind when the parent moves. The docs contrast this directly with the browser's View Transitions API, where a nested element with a delay does get left behind as its parent animates away. It is one of the concrete reasons the docs give for layout animations still being worth 12kb once View Transitions ship everywhere.

**★ What is `layoutAnchor` for, and what does `false` do?**
`layoutAnchor` picks the point used for that parent-relative calculation, as independent `0`–`1` progress values for `x` and `y`, defaulting to the top-left. Setting it to `{ x: 0.5, y: 0.5 }` pins the element by its centre, which is what you want when the child should visually stay centred while the parent resizes. Setting it to `false` is different in kind: it disables relative projection for that element altogether, and the element animates relative to its page-relative change instead.

**★ How do you make a shared element travel along a curve instead of a straight line, and what is the most common mistake?**
Pass `arc()` to `transition.layout.path`. The common mistake is passing it to `transition.path`, which is the key for value animations between explicit `x`/`y` targets; a layout animation reads its configuration from the nested `layout` key, so the top-level path is silently ignored and the element travels straight. The second mistake is constructing `arc()` inline each render, which costs the interruption continuity that automatic direction is designed to provide.

**★ You add `arc()` to a spring-driven layout animation and the element visibly sails past its destination before settling. Bug?**
No. `transition.path` describes only the shape of the curve; the driving transition is whatever you supply alongside it. A spring's progress value overshoots `t = 1` and oscillates back, so the element samples positions beyond the endpoint of the arc and settles with a bounce. If that is not the effect you want, change the driver — a tween — rather than the path.

---

← [Shared layout coordination](01c-shared-layout-coordination.md) · [Explanations](../README.md) · Next → [Scroll-reactive motion](../08-scroll-linked-animations/01-scroll-reactive-motion.md)
