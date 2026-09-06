---
title: "A scroll progress value is only as trustworthy as its container, target, axis and offset — how `useScroll` actually measures, and the four ways it silently stops"
sidebar_label: "01b · How `useScroll` measures"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [useScroll](https://motion.dev/docs/react-use-scroll),
> [React scroll animation](https://motion.dev/docs/react-scroll-animations),
> [scroll](https://motion.dev/docs/scroll), [useTransform](https://motion.dev/docs/react-use-transform),
> [useSpring](https://motion.dev/docs/react-use-spring),
> [Accessibility](https://motion.dev/docs/react-accessibility) and
> [usePageInView](https://motion.dev/docs/react-use-page-in-view), read from a 131-page
> raw text mirror of motion.dev. Quotes are verbatim, with the whitespace the HTML→text
> render inserts around inline code normalised.
> Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on **React 19.2.8** —
> React version probed on the installed package; `motion` is not installed in this
> checkout, so every API claim here is documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

**`scrollYProgress` is not a fact about the page — it is the answer to a question with four parameters, and three of them have defaults you probably did not choose.** [01](01-scroll-reactive-motion.md) established that scroll-linked animation means binding a value to scroll position. This chunk is about what that value actually measures: which element is scrolling (`container`), which element is being tracked inside it (`target`), along which axis, and between which two intersections (`offset`). Get any one of them wrong and you do not get an error — you get a number between 0 and 1 that is confidently describing something else.

## The four options, and what each one decides

| Option | Default | Decides |
|---|---|---|
| `container` | the browser viewport | **what is scrolling** — the element whose scroll position is read |
| `target` | the scrollable area of the container | **what is being measured** as it moves through that container |
| `axis` | `"y"` | which axis the `offset` intersections are resolved on |
| `offset` | `["start start", "end end"]` | the two positions that mean progress `0` and progress `1` |

Verbatim, from the reference:

> *"container: The scrollable container to track the scroll position of. By default, this is the browser viewport. By passing a ref to a scrollable element, that element can be used instead."*
>
> *"useScroll tracks the progress of the target within the container. By default, the target is the scrollable area of the container. It can additionally be set as another element, to track its progress within the container."*
>
> *"axis: Default: "y". The tracked axis for the defined offset."*

Read the second one carefully. **`target` is measured *within* `container`; it does not replace it.** The whole-page default is stated separately — *"By default, useScroll tracks the page scroll."* — and again in the guide, in the sentence that explains what changes when you add a target:

> *"By default, useScroll progress values will represent the overall viewport scroll (or element scroll). By passing an element via the target option, scrollYProgress will return its progress through the visible space."*

```tsx
import { useScroll } from 'motion/react';
import { useRef } from 'react';

function CarouselItemProgress() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);

  // The carousel scrolls horizontally; the item is measured inside it.
  const { scrollXProgress } = useScroll({
    container: carouselRef,
    target: itemRef,
    axis: 'x',
    offset: ['start end', 'end start'],
  });

  return { carouselRef, itemRef, scrollXProgress };
}
```

Three of those four lines are things people forget: without `container` the item is measured against a window that is not moving, without `axis: 'x'` the offsets are resolved vertically inside a horizontally-scrolling carousel, and without `offset` you get the default `["start start", "end end"]` rather than the enter-and-leave range the effect probably wants.

## The offset grammar

`offset` is a pair of **intersections** — a point on the target meeting a point on the container:

> *"offset describes intersections, points where the target and container meet."*
>
> *"For example, the intersection "start end" means when the start of the target on the tracked axis meets the end of the container."*
>
> *"So if the target is an element, the container is the window, and we're tracking the vertical axis then "start end" is where the top of the element meets the bottom of the viewport."*

Each half of an intersection can be written four ways, all documented:

> *"Number: A value where 0 represents the start of the axis and 1 represents the end. So to define the top of the target with the middle of the container you could define "0 0.5". Values outside this range are permitted."*
>
> *"Names: "start", "center" and "end" can be used as clear shortcuts for 0, 0.5 and 1 respectively."*
>
> *"Pixels: Pixel values like "100px", "-50px" will be defined as that number of pixels from the start of the target/container."*
>
> *"Percent: Same as raw numbers but expressed as "0%" to "100%"."*
>
> *"Viewport: "vh" and "vw" units are accepted."*

The two ranges upstream spells out cover most real work, and they are worth memorising because they read backwards until you have:

```tsx
// Track an element as it enters from the bottom
const { scrollYProgress } = useScroll({
  target: targetRef,
  offset: ['start end', 'end end'],
});

// Track an element as it moves out the top
const { scrollYProgress } = useScroll({
  target: targetRef,
  offset: ['start start', 'end start'],
});
```

The first says: progress `0` when the **top of the target** reaches the **bottom of the container**, progress `1` when the **bottom of the target** reaches the **bottom of the container** — i.e. the element sliding up into full view. The second: `0` when the top of the target reaches the top of the container, `1` when its bottom does — the element sliding out of the top. The `['start end', 'end start']` used in [01](01-scroll-reactive-motion.md) is the union of both: the entire journey across the viewport.

## What the measurement ignores

🔴 **The target is measured by layout, not by what you can see.**

> *"target is tracked by the element's layout position, so any CSS transform applied to it (or its ancestors) is ignored when measuring progress."*

This is the rule that makes a self-referential parallax stop being self-referential, and it is a *good* rule: an element whose own `y` is being driven by its own scroll progress would otherwise feed its output back into its input and oscillate. But it also means a section moved by a wrapper's transform — a page transition, a `layout` animation on an ancestor, a `translateY` used for sticky-emulation — reports progress from where it *would* have been, not where it is on screen.

## What silently stops it updating

The scrollable area of a page is not constant, and Motion is explicit that it does not watch it by default:

> *"When the size of a page or element's content changes, its scrollable area can change too. But, because browsers don't provide a callback for changes in content size, by default useScroll() will not update until the next "scroll" event."*
>
> *"Content size tracking is disabled by default because most of the time, scrollable area remains stable, and tracking changes to it involves a small overhead."*

```tsx
// Lazy images, an accordion, an infinite list, a font swap — anything that
// changes total scroll height after mount.
const { scrollYProgress } = useScroll({ trackContentSize: true });
```

The symptom is a progress bar that reaches 100% before the page ends (or never gets there), correcting itself the instant the user nudges the wheel. Turn `trackContentSize` on for pages whose height is genuinely dynamic and leave it off elsewhere — upstream's own reason for the default is the overhead.

## The GPU path is conditional, and the condition is the property you animate

> *"Browsers are capable of animating some values, like opacity, transform, clipPath and filter, entirely on the GPU. This improves scroll synchronisation and ensures animations remain smooth even when sites are performing heavy work."*
>
> *"useScroll is also capable of running animations via the GPU. By passing scrollXProgress or scrollYProgress either directly to an opacity style, or via useTransform to one of the above styles, it will create a hardware-accelerated animation."*

```tsx
const { scrollYProgress } = useScroll();
const filter = useTransform(scrollYProgress, [0, 1], ['blur(10px)', 'blur(0px)']);

return <motion.div style={{ opacity: scrollYProgress, filter }} />;
```

Note what is **not** on the list: `top`, `left`, `width`, `height`, `margin`. Driving those from scroll progress is legal and will look identical at rest, but it puts layout on the scroll path. The equivalent effect written as `y`, `scale` or `clipPath` is the one that stays on the compositor.

The engine choice underneath is also conditional — upstream says *"some animations"*, not all:

> *"useScroll is able to run some animations with the browser's ScrollTimeline API for optimal hardware-accelerated performance, removing scroll measurements, improving scroll synchronisation and ensuring animations remain smooth even under heavy CPI usage."*

("CPI" is upstream's typo for CPU.) The JavaScript-driven fallback is documented as the alternative path in the v11 upgrade notes — *"animations will run via the browser's native ScrollTimeline where possible, or via Motion's new render-batched animation loop when not possible"* — so **do not promise a stakeholder that a scroll effect is hardware-accelerated**; promise that it is written so it can be.

## Pinning: use the browser's own mechanism

> *"To use the browser for best performance, pinning should be performed with position: sticky."*

The horizontal-scroll section is the standard application of that, and it is a shape worth knowing by heart: a tall outer container defines the scroll distance, a `position: sticky` inner element does the pinning, and `useScroll` maps the outer container's progress onto an `x` translation.

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const { scrollYProgress } = useScroll({
  target: containerRef,
  offset: ['start start', 'end end'],
});

const x = useTransform(scrollYProgress, [0, 1], ['0%', '-75%']);
```

> *"The container should have a long viewport-relative measurement like 300vh. Increasing this length will make the horizontal scrolling feel slower."*

Two things follow that are easy to miss. The `offset` here is `['start start', 'end end']` — the documented **default** — because the pinned section's progress should run from the moment the container's top hits the container top to the moment its bottom does. And the *feel* of the effect is controlled by the outer height, not by the transition: there is no `duration` anywhere in a scroll-linked effect, because the user is the clock.

## Reduced motion: parallax is named specifically

> *"Parallax animations can be very unpleasant for people pre-disposed to motion sickness."*

Upstream's fix is not to remove the effect but to stop passing the motion value:

```tsx
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

function Parallax() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();

  const y = useTransform(scrollY, [0, 1], [0, -0.2], { clamp: false });

  return <motion.div style={{ y: shouldReduceMotion ? 0 : y }} />;
}
```

⚠️ The accessibility guide's own snippet still imports from `framer-motion` and its prose still names the retired `useViewportScroll`; the code above is the same logic with the current import and hook, per the upgrade guide's *"Then simply swap imports from "framer-motion" to "motion/react""*. The `[0, 1] → [0, -0.2]` with `clamp: false` is upstream's, and it is the pixels-in-pixels-out form: move `0.2px` up for every `1px` scrolled, forever.

## Gotchas

**★ `target` without `container` measures against a window that is not scrolling.** The single most common way a section-scoped effect returns a value that never moves. `container` is the scrollable element; `target` is what you are watching move inside it. Inside an `overflow: scroll` div you need both.

**★ The `offset` default is `["start start", "end end"]`, which is almost never what a reveal wants.** With a `target` and no `offset`, progress `0` is "the top of the target is at the top of the container" — a point that is *already past* for anything entering from below. The enter-from-bottom range is `["start end", "end end"]`; the full-journey range is `["start end", "end start"]`.

**★ `axis` defaults to `"y"` even when you destructure `scrollXProgress`.** The two are independent: `axis` governs how the `offset` intersections are resolved, and the reference defines it as *"The tracked axis for the defined offset."* A horizontal carousel with a `target` and no `axis: 'x'` resolves "start" and "end" vertically, which for a single-row carousel means the offsets barely change across the whole scroll.

**★ A transform on the target — or on any ancestor — is invisible to the measurement.** *"target is tracked by the element's layout position, so any CSS transform applied to it (or its ancestors) is ignored when measuring progress."* If a parent is mid page-transition or running a `layout` animation, progress is computed from the untransformed layout box, so the effect can be visually out of step with an element that is plainly somewhere else on screen.

**★ Content that grows after mount freezes the progress denominator until the next scroll event.** *"by default useScroll() will not update until the next "scroll" event."* Lazy-loaded images, an expanding accordion, a font swap that reflows, or an infinite list all change the scrollable area silently. `trackContentSize: true` is the documented fix, and it is off by default because it costs *"a small overhead."*

**★ Driving `top`/`height` from scroll progress works and quietly costs you the compositor.** Only *"opacity, transform, clipPath and filter"* are named as GPU-animatable, and the hardware-accelerated path is described as passing progress *"either directly to an opacity style, or via useTransform to one of the above styles."* Anything else is a layout or paint on the scroll path.

**★ "Runs on ScrollTimeline" is a *where possible*, not a guarantee.** The reference says *"some animations"*; the upgrade guide names the alternative as Motion's *"render-batched animation loop when not possible."* Neither document enumerates which animations qualify — **the documentation does not state the exact conditions**, and I could not confirm them. Write the effect on GPU-friendly properties and measure in a real profiler rather than assuming the native path.

**★ Pinning by hand instead of with `position: sticky` fights the browser.** Upstream is unambiguous: *"To use the browser for best performance, pinning should be performed with position: sticky."* A JS-driven `position: fixed` swap at a scroll threshold reintroduces exactly the per-frame measurement the ScrollTimeline path exists to remove, and it lands a frame late on every fling.

**★ The speed of a pinned horizontal section is set by the outer container's height, not by any animation option.** *"The container should have a long viewport-relative measurement like 300vh. Increasing this length will make the horizontal scrolling feel slower."* If a designer asks for the horizontal scroll to be "slower", the change is a CSS height, and it changes how much page the section consumes — which is a content decision, not a motion one.

**★ `useReducedMotion` returning true should replace the motion value, not the component.** Upstream's parallax remedy keeps the element and passes a constant — `style={{ y: shouldReduceMotion ? 0 : y }}` — because the hooks must still run in the same order and the layout must not change. Conditionally *skipping* `useScroll` breaks the rules of hooks; conditionally skipping the transform is the supported shape.

**★ Scroll work does not stop when the tab does, unless you stop it.** `usePageInView` exists for this: *"usePageInView returns true when the current page is the user's active tab, and defaults to true on the server and initial client render before a measurement can be made."* It is aimed at *"pausing animations, video playback, or other activity"* — relevant when a scroll-linked effect is driving something expensive such as a canvas or a video scrub.

**★ The accessibility guide is the one page in this area that is still on the old package name.** It imports `useReducedMotion` from `framer-motion` and describes getting `scrollY` from `useViewportScroll`. Both still describe working ideas, but the current spelling is `motion/react` and `useScroll` — treat that page's snippets as pseudocode to be re-imported, not as copy-paste.

## Interview questions

**★ `scrollYProgress` on a section inside a scrollable panel stays at 0. Diagnose it.**
Almost certainly `target` was passed without `container`. `useScroll` measures *"the progress of the target within the container"*, and the container defaults to the browser viewport — which, on a page whose body does not scroll, never moves. The value is not broken; it is answering "how far has this element travelled through the window", and the answer is "it has not". Adding `container: panelRef` re-points the question at the element that is actually scrolling. The same class of bug hits `whileInView`, but there the option is called `root`.

**★ Explain `offset: ["start end", "end start"]` to someone who has just misread it as a range of numbers.**
Each string is one intersection: a point on the target followed by a point on the container. `"start end"` is the start of the target meeting the end of the container — on the vertical axis with the window as container, *"the top of the element meets the bottom of the viewport"*, i.e. the moment it appears from below. `"end start"` is the bottom of the element meeting the top of the viewport: the moment it has completely gone. So the pair means "0 when it appears, 1 when it has fully left", which is the full-journey range you want for parallax. The default, `["start start", "end end"]`, is a different question entirely — it measures the element's own scroll-through, which is what a pinned section wants.

**★ Why does Motion deliberately ignore CSS transforms when measuring a scroll target?**
Because the measurement usually *drives* a transform. If the target's own transform fed back into the measurement, an element whose `y` is bound to its own progress would move, remeasure, move again — a feedback loop with no fixed point. Measuring the layout box breaks the loop and makes the value stable and predictable. The cost is stated in the same sentence: transforms on *ancestors* are ignored too, so if a parent is translated the progress value describes where the element belongs in layout rather than where it appears.

**★ A reading-progress bar hits 100% two screens before the end of an article. What is the mechanism?**
The scrollable height grew after the first measurement — images loading, embeds hydrating, a webfont reflowing the text — and by default *"useScroll() will not update until the next "scroll" event"*, because browsers give no callback for content-size changes. The progress denominator is therefore the old, shorter document. `trackContentSize: true` makes Motion track the change; the reason it is off by default is that content size is usually stable and watching it costs a little overhead.

**★ Two implementations of the same fade: `useTransform(scrollYProgress, [0, 1], [0, 1])` into `opacity`, versus into `height`. Both look right. Which do you ship, and why?**
The opacity one, because `opacity` is on the short list of values browsers can animate *"entirely on the GPU"* alongside `transform`, `clipPath` and `filter`, and because passing progress into `opacity` is exactly the shape Motion documents as producing a hardware-accelerated animation. Driving `height` puts a layout recalculation — for the element, its siblings and its descendants — on every scroll frame. At rest the difference is invisible; under a heavy main thread, which is the condition scroll effects actually run in, it is the difference between smooth and stuttering.

**★ How do you make a pinned horizontal-scroll section feel slower?**
You make the outer container taller. There is no duration to change, because in a scroll-linked animation the user's scroll *is* the timeline: the section is pinned with `position: sticky` inside a container with a tall viewport-relative height, and `scrollYProgress` over that container is mapped to an `x` translation. Upstream states it directly — *"Increasing this length will make the horizontal scrolling feel slower."* The trade is that "slower" means "consumes more page", so it is a content and layout decision, not a motion tweak.

**★ Your design system requires reduced-motion support. What does that mean for a parallax hero specifically, and what is the wrong way to implement it?**
Parallax is the effect the accessibility guide names by hand — *"Parallax animations can be very unpleasant for people pre-disposed to motion sickness."* The right shape is to keep the component and the hooks exactly as they are and swap the value at the point of use: `style={{ y: shouldReduceMotion ? 0 : y }}`. The wrong way is to branch before the hooks — early-returning a different tree, or calling `useScroll` conditionally — which breaks the rules of hooks and, even where it happens to run, changes the layout between the two modes so the two versions of the page no longer match.

---

← [Scroll-reactive motion](01-scroll-reactive-motion.md) · [Explanations](../README.md) · Next → [Motion values](../09-motion-values/01-imperative-value-tracking.md)
