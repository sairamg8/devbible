---
title: "Scroll-Linked Animations: `useScroll`, `whileInView` & Parallax"
sidebar_label: "Scroll-Linked Animations"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [React scroll animation](https://motion.dev/docs/react-scroll-animations),
> [useScroll](https://motion.dev/docs/react-use-scroll), [useTransform](https://motion.dev/docs/react-use-transform),
> [useInView](https://motion.dev/docs/react-use-in-view), [useSpring](https://motion.dev/docs/react-use-spring),
> [Motion component](https://motion.dev/docs/react-motion-component) and
> [Motion values overview](https://motion.dev/docs/react-motion-value), read from a
> 131-page raw text mirror of motion.dev. Quotes are verbatim, with the whitespace the
> HTML→text render inserts around inline code normalised.
> Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on **React 19.2.8** —
> React version probed on the installed package; `motion` is not installed in this
> checkout, so every API claim here is documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Scroll-Linked Animations: `useScroll`, `whileInView` & Parallax

## 1. Under-The-Hood Mechanics

Scroll-reactive animation comes in two distinct flavors — triggering a one-time animation when an element **enters** the viewport, and continuously **driving** an animation's progress directly from scroll position — each suited to different effects. Upstream names both, and the names are load-bearing:

> *"Scroll-triggered: An animation is triggered when an element enters or leaves the viewport. Common for fade-in effects and lazy-loading."*
>
> *"Scroll-linked: Animation values are linked directly to scroll position. Used for parallax, progress bars, and interactive storytelling."*

🔴 **"Scroll-linked" is one of the two flavours, not the umbrella term for both** — this topic's directory name uses it as an umbrella and the documentation does not. Say "scroll-triggered" when you mean `whileInView`, or the reviewer reading your PR will assume a `useScroll` subscription that is not there.

The two are not just different APIs, they are different browser primitives:

> *"Motion is the only animation library that runs scroll-linked animations on the browser's native ScrollTimeline where possible, for fully hardware-accelerated animations. Scroll-triggered animations use a pooled IntersectionObserver for minimal overhead."*

```
whileInView={{ opacity: 1 }}
        │
        ▼
Triggers ONCE (or repeatedly, per viewport config) when the element ENTERS the viewport —
a discrete "play this animation now" trigger, not continuous tracking

useScroll()
        │
        ▼
Returns CONTINUOUS motion values (scrollX, scrollY, scrollXProgress, scrollYProgress)
that update in REAL TIME as the user scrolls — tracking the ENTIRE scroll position,
not a one-time trigger

useScroll() + useTransform()
        │
        ▼
Maps the CONTINUOUS scroll progress value into another value's range — e.g.
scroll progress 0→1 mapped to opacity 0→1, or a parallax Y-offset — for
scroll-DRIVEN effects (not just scroll-TRIGGERED ones)
```

### `whileInView`: A Discrete Trigger, With Viewport Tuning
```tsx
<motion.div whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.5 }} />
```
`viewport.once` controls whether the animation replays every time the element re-enters the viewport (scrolling back up and down again) or only ever plays once, the first time. `viewport.amount` controls what fraction of the element must be visible before the trigger fires (`0.5` = at least half visible).

The reference lists four `viewport` options and their defaults, and three of the four are places people get surprised:

> *"once: If true, once element enters the viewport it won't detect subsequent leave/enter events."*
>
> *"root: The ref of an ancestor scrollable element to detect intersections with (instead of window)."*
>
> *"margin: A margin to add to the viewport to change the detection area. Defaults to "0px". Use multiple values to adjust top/right/bottom/left, e.g. "0px -20px 0px 100px"."*
>
> *"amount: The amount of an element that should enter the viewport to be considered "entered". Either "some", "all" or a number between 0 and 1. Defaults to "some"."*

The default is `"some"`, not `0.5` — **one pixel of the element inside the detection area fires the trigger.** The `0.5` in the snippet above is an override, and it is the override most entrance animations actually want.

### `useScroll` + `useTransform`: Continuous, Scroll-Driven Effects
Unlike `whileInView`'s one-time trigger, combining `useScroll`'s continuously-updating progress value with `useTransform` (mapping that progress into another value's range) produces effects that track scroll **position** directly — a parallax background moving at a different rate than foreground content, or an element's opacity/scale continuously tied to exactly how far scrolled a section is, not just whether it's visible at all.

The four returned values are two different units, and mixing them up is the fastest way to a parallax that does nothing:

> *"scrollX/Y: The absolute scroll position, in pixels."*
>
> *"scrollXProgress/YProgress: The scroll position between the defined offsets, as a value between 0 and 1."*

So an input range of `[0, 1]` is correct for `scrollYProgress` and near-meaningless for `scrollY` — on `scrollY`, `[0, 1]` describes the first single pixel of scroll, and with the default `clamp: true` everything past that pixel is pinned to the end of the output range.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Marketing Page's Hero Section Needing Both a One-Time Fade-In AND a Continuous Parallax Effect.
A marketing page needed its hero heading to fade in once, the first time it scrolled into view (a discrete "welcome" effect, not something that should replay every time a user scrolls up and back down) — while a separate background image needed continuous parallax motion, moving at a different rate than the foreground content for the entire duration the user scrolled through that section. `whileInView` with `viewport={{ once: true }}` handled the heading's one-time entrance; `useScroll` + `useTransform`, mapping the section's scroll progress into a background Y-offset, handled the continuous parallax — two conceptually different scroll-linked mechanisms, each matched to the effect it was actually designed for.

Upstream's own FAQ draws the same line, and it is a good sentence to have ready in a design review:

> *"Scroll-triggered animations fire when an element enters or leaves the viewport, think fade-ins and reveal effects. Use whileInView or useInView for these. Scroll-linked animations tie a value directly to scroll position, think parallax and progress bars. Use useScroll for these."*

---

## 3. Production-Grade Code Example

```tsx
// whileInView — a discrete, one-time entrance trigger
import { motion } from 'motion/react';

function HeroHeading() {
  return (
    <motion.h1
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }} // fires ONCE, when at least 50% visible — never replays
    >
      Welcome to Acme
    </motion.h1>
  );
}
```

```tsx
// useScroll + useTransform — continuous, scroll-position-driven parallax
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

function ParallaxSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['-20%', '20%']); // background layer: a deliberately small travel range
  const foregroundOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]); // fades in, then out

  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <motion.div style={{ y: backgroundY }} className="background-image" />
      <motion.div style={{ opacity: foregroundOpacity }} className="foreground-content">
        <h2>Continuously scroll-driven content</h2>
      </motion.div>
    </div>
  );
}
```

**On the `['-20%', '20%']` range.** A unit string is a legal output — *"The output range must be values all of the same type, but can be in any order. It can also be any value type that Motion can animate, like numbers, units, colors and other strings."* What the documentation settles is the **relative** rule between layers, not the absolute rate:

> *"Parallax creates the illusion of depth by moving elements at different speeds. Background layers should move slower than foreground layers"*
>
> *"Combine useScroll with useTransform to move elements at different speeds relative to scroll position. Pass the target ref of a container, then map scrollYProgress to different y ranges per layer: smaller ranges for background, larger for foreground."*

⚠️ **The docs do not state how a percentage translation relates to the distance actually scrolled**, so "this background moves slower than the scroll" is a claim the source will not settle — it depends on the layer's own box. When you need an exact rate rather than a look, upstream's parallax recipe maps `scrollY` (pixels) with `clamp: false` instead:

```tsx
// upstream's own parallax shape: pixels in, pixels out, mapping perpetually
const { foregroundY, backgroundY } = useTransform(
  scrollY,
  [0, 1],
  {
    foregroundY: [0, 2],   // move 2px for every 1 scroll px
    backgroundY: [0, 0.5], // move 0.5px for every 1 scroll px
  },
  { clamp: false }
);
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `whileInView` for an Effect That Should Continuously Track Scroll Position
```tsx
// ❌ WRONG TOOL: whileInView is a DISCRETE trigger — it can't express "opacity should be
// EXACTLY proportional to how far scrolled through this section the user currently is"
<motion.div whileInView={{ opacity: 1 }} /> // fires once, doesn't continuously TRACK scroll position

// ✅ CORRECT: useScroll + useTransform for continuous, position-DRIVEN effects
const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
<motion.div style={{ opacity }} />
```

### ⚠️ Pitfall 2: Forgetting `viewport={{ once: true }}` for an Entrance Animation That Shouldn't Replay
```tsx
// ❌ POTENTIALLY UNWANTED: without once:true, whileInView REPLAYS every single time the
// element re-enters the viewport — scrolling up and back down retriggers the "entrance"
// animation repeatedly, which can feel repetitive/distracting for a one-time welcome effect
<motion.h1 whileInView={{ opacity: 1 }} /> // replays on EVERY re-entry into the viewport

// ✅ CORRECT: explicitly set once:true for genuinely one-time entrance effects
<motion.h1 whileInView={{ opacity: 1 }} viewport={{ once: true }} />
```

This is documented default behaviour, not a bug you are working around:

> *"By default, elements will animate between initial/animate, and whileInView, as the element enters and leaves the viewport. Via the viewport options, set once: true so an animation only plays the first time an element scrolls into view."*

### ⚠️ Pitfall 3: Confusing `target` (what is measured) with `container` (what is scrolling)
`useScroll` has **two** element options and they do different jobs. Omitting `target` does not mean "wrong container" — the container is the viewport either way; it means you are measuring the whole page instead of one section.

> *"By default, useScroll tracks the page scroll."*
>
> *"container: The scrollable container to track the scroll position of. By default, this is the browser viewport. By passing a ref to a scrollable element, that element can be used instead."*
>
> *"useScroll tracks the progress of the target within the container. By default, the target is the scrollable area of the container. It can additionally be set as another element, to track its progress within the container."*

```tsx
// ❌ WRONG: page-wide progress driving an effect that is meant to be section-relative
const { scrollYProgress } = useScroll(); // the WHOLE page's progress, not this section's

// ✅ For a section scrolling through the window: pass target
const ref = useRef(null);
const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

// ✅ For a section inside a scrollable div: target alone is NOT enough — name the container too
const containerRef = useRef(null);
const itemRef = useRef(null);
const { scrollYProgress } = useScroll({ container: containerRef, target: itemRef });
```

🔴 **`target` never changes which element's scrolling is being watched.** If your section lives inside an `overflow: scroll` div and you pass only `target`, Motion measures that element against the *window*, which is not scrolling — the full offset grammar and the rest of the measurement model are in [01b](01b-how-usescroll-measures.md).

---

## Gotchas

**★ `whileInView` with no `initial` has nothing to animate from.** The documented behaviour is that *"elements will animate between initial/animate, and whileInView, as the element enters and leaves the viewport"* — `whileInView` is the *in-view* half of a pair. Both examples in the upstream guide pair it with an `initial` (`initial={{ opacity: 0 }}` / `whileInView={{ opacity: 1 }}`, or the variant-label form `initial="hidden"` / `whileInView="visible"`). A lone `whileInView={{ opacity: 1 }}` on an element that is already `opacity: 1` is a no-op that looks like a broken observer.

**★ `once: true` deletes the exit half of your design, permanently.** The `viewport` reference says it *"won't detect subsequent leave/enter events"*; the `useInView` reference is blunter about the mechanism — *"If true, once an element is in view, useInView will stop observing the element and always return true."* So `once` is not "play the entrance once", it is "stop watching". Any `onViewportLeave`, any leave-state styling, and any later re-entrance are all gone with it. If you want the entrance to be one-time but the element to keep reporting, keep `once: false` and hold the played-once state yourself.

**★ `amount` defaults to `"some"`, which is as little as one pixel.** For a full-height hero this is usually invisible; for a card grid it means the fade starts while the card is still a sliver at the bottom of the screen and is over before the user has read it. `amount: 0.5` or a negative bottom `margin` is what makes the animation land where the eye is.

**★ `amount: "all"` on an element taller than the detection area is a trap the docs will not settle.** Upstream documents only the value set — *"Either "some", "all" or a number between 0 and 1"* — and separately that *"Scroll-triggered animations use a pooled IntersectionObserver for minimal overhead."* An intersection ratio of 1 is unreachable for an element larger than its root, so `"all"` on a `100vh`-plus section looks like it should never fire; **the documentation does not state what Motion does in that case**, and I could not confirm it. Treat `amount: "all"` on tall sections as unverified: use a fractional `amount` you can reason about instead.

**★ `viewport.margin` silently does nothing inside a cross-origin iframe unless you set `root`.** The `useInView` reference carries the warning explicitly — *"For browser security reasons, margin won't take affect within cross-origin iframes unless root is explicitly defined."* (the "take affect" is upstream's). Embedded widgets, Storybook-in-an-iframe and preview panes are exactly where a `margin`-tuned trigger will behave one way in your dev harness and another on the real page.

**★ Motion values do not re-render React, so `.get()` in a render body is a snapshot, not a subscription.** *"Changes to the motion value will update the DOM without triggering a React re-render. Motion values can be updated multiple times but renders will be batched to the next animation frame."* Reading `scrollYProgress.get()` in the component body gives you the value at that render and never updates again. To move a style, pass the motion value (or a `useTransform` of it) to `style`; to move **React state**, subscribe with `useMotionValueEvent`.

**★ `useTransform`'s input range must be monotonic and its output must be one type.** *"The input range must always be a series of increasing or decreasing numbers."* and *"The output range must be values all of the same type."* An input like `[0, 0.5, 0.4]` and an output like `[0, '20%']` are both malformed — and because scroll progress feeds them at 60Hz, a malformed range is not a build error, it is a value that stops making sense somewhere in the middle of the page.

**★ `clamp` defaults to `true`, which is right for progress and wrong for perpetual parallax.** *"If true, will clamp output to within the provided range. If false, will carry on mapping even when the input falls outside the provided range."* A `scrollYProgress`-driven effect wants clamping (progress genuinely ends at 1). A `scrollY`-driven one usually does not: upstream's own parallax and its "for every 100px scrolled, rotate another 360deg" example both pass `{ clamp: false }`.

**★ Wrapping scroll progress in `useSpring` makes it stop being scroll-linked.** *"useSpring creates a motion value that will animate to its latest target with a spring animation."* — the spring *follows* the scroll value, it does not adopt it. That lag is a feature for a progress bar and a defect for anything that must line up with a scroll position, such as a `position: sticky` reveal or a masked wipe, where the element visibly trails the pointer.

**★ A spring on `useScroll` animates on mount when the page loads part-scrolled.** Restored scroll positions and `#anchor` deep links mean `scrollYProgress` is non-zero the first time it is measured, and the spring animates to it from its starting value. Upstream ships the fix as an option: *"When using useSpring to track a value like useScroll, which may change on mount after a DOM measurement, you can jump to this value instantly by setting skipInitialAnimation to true."*

```tsx
const { scrollYProgress } = useScroll();
const smoothProgress = useSpring(scrollYProgress, { skipInitialAnimation: true });

return <motion.div style={{ scaleX: smoothProgress, originX: 0 }} />;
```

**★ A progress bar needs `originX: 0` or it grows from the middle.** CSS `transform-origin` defaults to the centre of the box — that is a CSS default, not a Motion one — so a bar bound to `scrollYProgress` via `scaleX` expands in both directions from its middle. Upstream's progress-bar snippet in the scroll guide is `style={{ scaleX: scrollYProgress, originX: 0 }}` for exactly this reason — note that the shorter snippet on the `useScroll` page omits `originX`, so copying that one gives you the centred version.

**★ `whileInView` needs `root` — not `container` — when the element scrolls inside another element.** The two APIs use different option names for the same idea, which is a genuine memory trap: `whileInView`/`useInView` take `root`, `useScroll` takes `container`. *"By default, animations will trigger based on the window viewport. To set a custom scroll container element, pass the ref of another scrollable element to the root option."*

**★ `useInView` returns `false` before the element has been measured.** *"initial: Default: false. Set an initial value to return until the element has been measured."* On a server-rendered page this means the first paint renders the out-of-view branch for elements that are already on screen. Where that flash matters, set `initial: true` and let the observer correct it.

**★ `amount: "any"` is not a Motion value — it is Motion One's, and it was renamed.** The upgrade guide's **11.0** section (*"Motion 11.11.12 is the version that merged Framer Motion and Motion One"*) lists under `inView`: *"amount: The "any" option is now "some"."* If a snippet you are copying passes `"any"`, it predates the merge and is not a Motion for React snippet at all.

## Interview questions

**★ What is the difference between a scroll-triggered and a scroll-linked animation, and why does the distinction matter beyond vocabulary?**
Scroll-triggered fires on an event — the element entered or left the viewport — and then runs on its own clock; scroll-linked binds a value to the scroll position so the animation's progress *is* the scroll position. The distinction matters because it decides the primitive underneath: upstream states that scroll-triggered animations use *"a pooled IntersectionObserver"* while scroll-linked ones run on *"the browser's native ScrollTimeline where possible"*. That changes what you can express (a trigger cannot be scrubbed backwards by the user), what it costs, and how it fails. It also decides the API: `whileInView`/`useInView` for the first, `useScroll` for the second.

**★ You are asked for a reading-progress bar at the top of an article. Walk through the implementation and the two details that are easy to get wrong.**
`const { scrollYProgress } = useScroll()` with no options — the default is page scroll, which is what a whole-article progress bar wants — then pass it straight to `scaleX` on a fixed-position `motion.div`. The first easy miss is `originX: 0`; without it the bar scales about its centre and grows out of the middle of the screen. The second is smoothing: `useSpring(scrollYProgress)` looks better, but on a page loaded at a restored scroll position the spring animates up from its start value on mount, which is what `skipInitialAnimation: true` exists to suppress. Note that you never convert the value to React state — passing the motion value directly is what keeps the bar off the React render path.

**★ `whileInView` fires on a card that is barely peeking above the fold. Why, and what are the two ways to fix it?**
`viewport.amount` defaults to `"some"`, so any intersection at all counts as entered. Either raise the threshold — `amount: 0.5`, or a number you can justify — or move the detection area with `viewport.margin`, which takes shorthand values and accepts negatives — upstream's own example is `"0px -20px 0px 100px"` — so `"0px 0px -120px 0px"` requires the card to clear the bottom 120 pixels before it counts as entered. `margin` is the better tool when the element is taller than the viewport, because a large `amount` on such an element may never be satisfied. ⚠️ The documentation only shows pixel values for `margin`; it does not state whether percentages are accepted, so do not assume they are.

**★ Why can `whileInView` not implement a section whose opacity is exactly proportional to how far through it you have scrolled?**
Because it is a trigger, not a subscription. It emits a state change at a threshold crossing and Motion then runs a normal transition between the two states on its own timing — nothing in that path is a function of scroll position. To make opacity a function of position you need a motion value that updates continuously, which is `useScroll`, mapped by `useTransform`. The give-away in a code review is a `whileInView` with a long `duration`: someone is trying to approximate scrubbing with a timer.

**★ Someone reads `scrollYProgress.get()` in the component body and logs a constant. Explain.**
Motion values are deliberately outside React's render cycle: *"Changes to the motion value will update the DOM without triggering a React re-render."* `.get()` in the body samples the value once, during that render, and nothing schedules another render when it changes — so the variable is frozen at whatever the value was when the component last rendered for some *other* reason. The correct reads are: pass the value (or a `useTransform` of it) into `style` for a visual effect, or subscribe with `useMotionValueEvent` when you genuinely need React state, accepting that you are now re-rendering on scroll.

**★ When would you reach for `useInView` instead of `whileInView`?**
When the thing that has to change is not a style on a motion component. `useInView` is *"vanilla React state"* — it returns a boolean, re-renders, and can therefore start a video, kick off a fetch, lazy-mount a heavy child, or fire analytics. Upstream frames it as the way to *"set React state when any element (not just a motion component) enters and leaves the viewport"*. The trade is exactly the one you avoided with motion values: `useInView` costs a re-render on every crossing, so it is the wrong tool for anything you could have expressed as a style.

**★ Both `useScroll` and `useInView` can watch a custom scrollable element. Why do they not use the same option name, and what breaks if you mix them up?**
They describe different relationships. `useInView` wraps an IntersectionObserver, whose spec term for the reference box is `root`. `useScroll` measures a scroll position, and the thing that has a scroll position is a `container`. Passing `container` to `viewport` or `root` to `useScroll` is not a type error you will notice at a glance — the option is simply ignored, the default (window) applies, and you get a trigger or a progress value computed against a viewport that is not the one the user is scrolling.

---

← [Shared layout coordination](../07-layout-animations/01c-shared-layout-coordination.md) · [Explanations](../README.md) · Next → [How `useScroll` measures](01b-how-usescroll-measures.md)
