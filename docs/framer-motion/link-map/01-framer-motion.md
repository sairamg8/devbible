---
title: "Link map · Framer Motion · Part 1 (all sections)"
sidebar_label: "01 · framer motion"
sidebar_position: 1
---

# Link map · Framer Motion · Part 1 (all sections)

Covers every topic page of `docs/framer-motion/pages` (sections 01 to 16). This track has no syllabus directory, so topics come from our page tree: each numbered page is one group, and groups with several chunk files are split into 2 blocks by chunk cluster (IDs `T02-01a`, `T02-01b`, and so on). All 22 blocks have a written page of ours.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200, headings or opening checked. Fetches returned condensed text, so *read* means the stated claim was in that text. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

🔴 **Version and naming note.** The library was renamed from Framer Motion to **Motion**; the docs live at motion.dev and the React import path is `motion/react` (`motion/react-client` for React Server Components). The old `framer-motion` package name still appears in older articles, so treat their import lines as outdated. Our pages carry a `> Verified: 2026-09-06` line against the Motion docs (the variants page names Motion 13.2.0, React 19.2.8). Several third-party picks predate the rename; each says so.

---

## Section 01 — Core concepts

### T01-01 · Declarative animation and `motion` components — Topic · ✅ written `docs/framer-motion/pages/01-core-concepts/01-declarative-animation-philosophy.md`
- **Read this:** [Motion component](https://motion.dev/docs/react-motion-component) · motion.dev · drop-in HTML and SVG replacements, animations run outside React's render cycle, `motion.create()` for custom components, import from `motion/react` (*read*) · covers our angle: **full**, except for the philosophy framing · fetched 2026-10-14
- **Also good:** [Animation overview](https://motion.dev/docs/react-animation) · motion.dev · the tour of `initial`, `animate`, `exit`, `transition`, keyframes, variants and controls on one page (*read*) · fetched 2026-10-14
- **Our delta:** why declarative state-to-target beats imperative timelines, and when to leave it.

## Section 02 — Basic animation props

### T02-01a · `initial`, `animate`, `exit`, `transition` — Topic · ✅ written `docs/framer-motion/pages/02-basic-animation-props/01-the-core-prop-triad.md`
- **Read this:** [Animation overview](https://motion.dev/docs/react-animation) · motion.dev · `initial` sets starting values, `animate` the target, `exit` runs on leaving when wrapped in `AnimatePresence`; has an Enter animations section (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Motion component](https://motion.dev/docs/react-motion-component) · motion.dev · the prop reference grouped by animation, gestures, drag, viewport, layout (*headings only*) · fetched 2026-10-14
- **Our delta:** the prop triad as one contract, with the failure modes listed.

### T02-01b · `exit` and `AnimatePresence` — Topic · ✅ written `docs/framer-motion/pages/02-basic-animation-props/01b-exit-and-animatepresence.md`
- **Read this:** [AnimatePresence](https://motion.dev/docs/react-animate-presence) · motion.dev · Usage (exit animations, changing `key`) and a Troubleshooting section headed "Exit animations aren't working" (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** each silent-failure clause of the exit contract, one by one.

### T02-01c · Transition resolution and per-value overrides — Topic · ✅ written `docs/framer-motion/pages/02-basic-animation-props/01c-transition-resolution-and-per-value-overrides.md`
- **Read this:** [Transitions](https://motion.dev/docs/react-transitions) · motion.dev · value-specific transitions, a `default` key, and the rule that a higher-specificity transition replaces a default unless `inherit: true` merges it (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the resolution order worked through and why the per-type defaults often beat hand-written ones.

## Section 03 — Transition types

### T03-01a · Tween and spring — Topic · ✅ written `docs/framer-motion/pages/03-transition-types/01-timing-models.md`
- **Read this:** [Transitions](https://motion.dev/docs/react-transitions) · motion.dev · tween (duration and easing, default 0.3s), physics springs (stiffness, damping, mass) versus duration springs (duration, bounce) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [The physics behind spring animations](https://blog.maximeheckel.com/posts/the-physics-behind-spring-animations/) · Maxime Heckel, 2020-06-23 · derives the spring from Hooke's law, adds damping, then maps mass, stiffness and damping to a button; written for Framer Motion of that era, so the concepts hold but option names may differ · fetched 2026-10-14 (*read*)
- **Our delta:** choosing a model per property rather than one for the whole component.

### T03-01b · Inertia and drag release — Topic · ✅ written `docs/framer-motion/pages/03-transition-types/01b-inertia-and-drag-release.md`
- **Read this:** [Transitions](https://motion.dev/docs/react-transitions) · motion.dev · inertia decelerates from initial velocity, tunable with `power`, `timeConstant`, bounds and `modifyTarget`, and is the default for `dragTransition` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** inertia as what drag release already runs, so you tune it rather than set it.

## Section 04 — Variants

### T04-01 · Variants, orchestration and propagation — Topic · ✅ written `docs/framer-motion/pages/04-variants/01-reusable-named-states.md`
- **Read this:** [Animation overview](https://motion.dev/docs/react-animation) · motion.dev · its Variants section, with Propagation, Orchestration and Dynamic variants sub-headings (*read*) · covers our angle: **partial** — the page has no dedicated variants URL (`react-variants` returns 404) · fetched 2026-10-14
- **Also good:** [Transitions](https://motion.dev/docs/react-transitions) · motion.dev · its Orchestration heading covers parent-child timing options (*headings only*) · fetched 2026-10-14
- **Our delta:** propagation rules and which transition a variant switch actually uses.

## Section 05 — Gestures

### T05-01a · `whileHover`, `whileTap`, `whileFocus`, accessibility and propagation — Topic · ✅ written `docs/framer-motion/pages/05-gestures/01-interaction-driven-animation.md`
- **Read this:** [Gesture animation](https://motion.dev/docs/react-gestures) · motion.dev · hover, tap, focus (same rules as `:focus-visible`), keyboard Enter starting a tap, and the Event propagation section using the `propagate` prop (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Accessibility](https://motion.dev/docs/react-accessibility) · motion.dev · `MotionConfig` with `reducedMotion="user"` disables transform and layout animations while opacity and colour still animate (*read*) · fetched 2026-10-14
- **Our delta:** Reduced Motion deleting a `scale` gesture, treated as a design decision.

### T05-01b · Drag: constraints, momentum and real-DOM traps — Topic · ✅ written `docs/framer-motion/pages/05-gestures/01c-drag-constraints-and-momentum.md`
- **Read this:** [Drag animation](https://motion.dev/docs/react-drag) · motion.dev · constraints by pixels or ref, momentum on by default, `dragTransition`, plus troubleshooting for transformed parents and ghost images (*read*) · covers our angle: **partial** — the fetched text did not cover `touch-action` or click-versus-drag · fetched 2026-10-14
- **Our delta:** default elastic values as opinions, and the four environments where a correct drag still breaks.

## Section 06 — AnimatePresence

### T06-01a · Exit animations and modes — Topic · ✅ written `docs/framer-motion/pages/06-animatepresence/01-exit-animations.md`
- **Read this:** [AnimatePresence](https://motion.dev/docs/react-animate-presence) · motion.dev · `mode` as `sync`, `wait` (one child only) and `popLayout` (absolute positioning, needs a ref-forwarding child), plus `key` changes (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the prerequisites of `popLayout` and why `sync` overlaps.

### T06-01b · Presence state, manual removal, nesting — Topic · ✅ written `docs/framer-motion/pages/06-animatepresence/01c-presence-state-and-manual-removal.md`
- **Read this:** [AnimatePresence](https://motion.dev/docs/react-animate-presence) · motion.dev · `usePresence` returning `[isPresent, safeToRemove]`, `custom`, `initial`, `onExitComplete`, `propagate` for nested instances (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** frozen props on an exiting component and the nested-ownership rule.

## Section 07 — Layout animations

### T07-01a · `layout` prop and silent failures — Topic · ✅ written `docs/framer-motion/pages/07-layout-animations/01-automatic-layout-transitions.md`
- **Read this:** [Layout animation](https://motion.dev/docs/react-layout-animations) · motion.dev · `layout` animates via `transform`, and the Troubleshooting list (not animating, window resize, scrollbar appearing, stretched content, border radius, SVG) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Inside Framer's Magic Motion](https://www.nan.fyi/magic-motion) · nan.fyi, no author or date shown on the page · builds FLIP step by step, then fixes transform origin and child scale distortion; explains the mechanism behind the failures · fetched 2026-10-14 (*read*)
- **Our delta:** the ten no-op cases in one list.

### T07-01b · Shared layout, `LayoutGroup`, scroll and fixed containers — Topic · ✅ written `docs/framer-motion/pages/07-layout-animations/01c-shared-layout-coordination.md`
- **Read this:** [Layout animation](https://motion.dev/docs/react-layout-animations) · motion.dev · `layoutId` crossfade and the rule that the target element's transition wins, `LayoutGroup`, `layoutScroll`, `layoutRoot` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Everything about Framer Motion layout animations](https://blog.maximeheckel.com/posts/framer-motion-layout-animations) · Maxime Heckel, 2022-03-08 (updated 2022-08-06) · layout, shared layout, `LayoutGroup` as namespacing and as grouping, and `AnimatePresence`; written for the `framer-motion` package · fetched 2026-10-14 (*read*)
- **Our delta:** layout as a measurement problem: scroll offsets, fixed ancestors, parents on other curves.

## Section 08 — Scroll-linked animations

### T08-01 · `useScroll`, `whileInView`, parallax — Topic · ✅ written `docs/framer-motion/pages/08-scroll-linked-animations/01-scroll-reactive-motion.md`
- **Read this:** [React scroll animation](https://motion.dev/docs/react-scroll-animations) · motion.dev · scroll-triggered versus scroll-linked, `whileInView` with `viewport`, parallax with `useScroll` and `useTransform` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [useScroll](https://motion.dev/docs/react-use-scroll) · motion.dev · `container`, `target`, `axis`, `offset`, and `trackContentSize` (default `false`) (*read*) · fetched 2026-10-14
- **Our delta:** the four silent stops of a progress value.

## Section 09 — Motion values

### T09-01 · `useMotionValue`, `useTransform`, `useSpring` — Topic · ✅ written `docs/framer-motion/pages/09-motion-values/01-imperative-value-tracking.md`
- **Read this:** [Motion values](https://motion.dev/docs/react-motion-value) · motion.dev · values update styles without re-rendering, track velocity, events, and the get/set/jump API (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [useTransform](https://motion.dev/docs/react-use-transform) · motion.dev · range mapping, function form, `clamp` default true (*read*) · [useSpring](https://motion.dev/docs/react-use-spring) · motion.dev · follow another value, `skipInitialAnimation` (*read*) · fetched 2026-10-14
- **Our delta:** when to reach for a motion value instead of state.

## Section 10 — Animation controls

### T10-01 · `useAnimate` and chained sequences — Topic · ✅ written `docs/framer-motion/pages/10-animation-controls/01-imperative-sequencing.md`
- **Read this:** [useAnimate](https://motion.dev/docs/react-use-animate) · motion.dev · scoped `animate`, selectors limited to the scope, automatic cleanup on unmount, awaiting steps in an exit example (*read*) · covers our angle: **partial** — no playback controls and no legacy `useAnimation` on that page · fetched 2026-10-14
- **Our delta:** sequences and the legacy `useAnimation` controls.

## Section 11 — Keyframes

### T11-01 · Keyframe arrays and `times` — Topic · ✅ written `docs/framer-motion/pages/11-keyframes/01-multi-step-value-animation.md`
- **Read this:** [Transitions](https://motion.dev/docs/react-transitions) · motion.dev · `times` takes 0 to 1 values, one per keyframe, otherwise spread evenly; tween default is 0.8s with several keyframes (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Keyframes tutorial](https://motion.dev/tutorials/react-keyframes) · motion.dev · multi-step scale, rotate and borderRadius example with `times` (*read*) · fetched 2026-10-14
- **Our delta:** wildcard keyframes and the length-match rule.

## Section 12 — SVG animations

### T12-01 · `pathLength`, stroke drawing, morphing — Topic · ✅ written `docs/framer-motion/pages/12-svg-animations/01-vector-graphic-motion.md`
- **Read this:** [SVG animation](https://motion.dev/docs/react-svg-animation) · motion.dev · `pathLength` and `pathOffset` on a 0 to 1 scale, and morphing `d` when both paths have the same structure (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Path drawing tutorial](https://motion.dev/tutorials/react-path-drawing) · motion.dev · staggered line drawing with variants and a custom index (*read*) · fetched 2026-10-14
- **Our delta:** morphing between mismatched paths.

## Section 13 — Orchestration and staggering

### T13-01 · Parent-child timing and per-child stagger — Topic · ✅ written `docs/framer-motion/pages/13-orchestration-and-staggering/01-choreographed-groups.md`
- **Read this:** [stagger](https://motion.dev/docs/stagger) · motion.dev · `from`, `startDelay`, `ease`, grid and negative staggers, and a React section (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Transitions](https://motion.dev/docs/react-transitions) · motion.dev · `delayChildren: stagger(...)` under Orchestration (*read*) · fetched 2026-10-14
- **Our delta:** per-child custom values via `custom` and dynamic variants.

## Section 14 — Performance considerations

### T14-01 · GPU-accelerated properties and `will-change` — Topic · ✅ written `docs/framer-motion/pages/14-performance-considerations/01-animating-efficiently.md`
- **Read this:** [Performance](https://motion.dev/docs/performance) · motion.dev · hardware acceleration as a bonus not a guarantee, `willChange` cost, `x` and `scale` animating CSS variables which are not accelerated (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [How to create high-performance CSS animations](https://web.dev/articles/animations-guide) · web.dev · stick to `transform` and `opacity`, use `will-change` sparingly (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Web Animation Performance Tier List](https://motion.dev/blog/web-animation-performance-tier-list) · Matt Perry, motion.dev, 2025-11-05 · ranks techniques S to F by which render stages they trigger · fetched 2026-10-14 (*read*)
- **Our delta:** which Motion shorthands lose acceleration.

## Section 15 — Advanced patterns

### T15-01 · Shared layout, Next.js integration, Reduced Motion — Topic · ✅ written `docs/framer-motion/pages/15-advanced-patterns/01-production-grade-motion-design.md`
- **Read this:** [Motion component](https://motion.dev/docs/react-motion-component) · motion.dev · names `motion/react-client` for React Server Components such as Next.js (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · Next.js docs, last updated 2026-10-05 · `"use client"` boundaries and wrapping third-party client components (*read*); [Accessibility](https://motion.dev/docs/react-accessibility) · `useReducedMotion` and `MotionConfig` (*read*); [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) · MDN (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Advanced page transitions with Next.js and Framer Motion](https://blog.logrocket.com/advanced-page-transitions-next-js-framer-motion) · Francois Brill, LogRocket, 2023-12-28 · mostly Pages Router, with a later App Router section warning exits are unreliable there; predates Motion 13 · fetched 2026-10-14 (*read*)
- **Our delta:** an App Router page-transition recipe on Next.js 16.

## Section 16 — Real-world workflows and recipes

### T16-01 · Diagnosing janky, dropped-frame animations — Topic · ✅ written `docs/framer-motion/pages/16-real-world-workflows-and-recipes/01-diagnosing-janky-animations.md`
- **Read this:** [Analyze runtime performance](https://developer.chrome.com/docs/devtools/performance) · Chrome DevTools docs · recording a trace, the FPS chart and Frames section, long tasks flagged with a red triangle (*read*) · covers our angle: **partial** — generic, not Motion-specific · fetched 2026-10-14
- **Also good:** [Performance](https://motion.dev/docs/performance) · motion.dev · layout-triggering properties can cost over 100ms per recalculation (*read*) · [How to create high-performance CSS animations](https://web.dev/articles/animations-guide) · web.dev · its Debug slow or glitchy animations section (*headings only*) · fetched 2026-10-14
- **Our delta:** a diagnosis order for Motion code: layout props, measured boxes, React re-renders.
