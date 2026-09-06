---
title: "A layout animation that does nothing throws no error — the ten documented ways it silently no-ops, distorts, or fires when you never asked"
sidebar_label: "01b · Silent failure modes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Layout animation](https://motion.dev/docs/react-layout-animations)
> (Troubleshooting), [Motion component](https://motion.dev/docs/react-motion-component) and
> [Accessibility](https://motion.dev/docs/react-accessibility), read from a 131-page raw
> mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on
> **React 19.2.8** — React version probed on the installed package; `motion` is not
> installed in this checkout, so every API claim here is documentation-verified.
> **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

**`layout` has no failure mode that raises. It renders, it accepts the prop, and it either does nothing, does something ugly, or does something you never asked for — and in all three cases the console stays empty.** This page is the whole of upstream's own troubleshooting list plus the accessibility interaction, each with the mechanism that causes it, because "why isn't it animating" is not answerable by reading your own code.

## The shape of the problem

Every entry below traces to one of five root causes, and naming them makes the list memorisable rather than a lookup table:

| Root cause | What it looks like | Pitfalls |
|---|---|---|
| **Motion never got a measurement to work from** | nothing happens at all, silently | 1, 2, 3 |
| **Two systems own the same property** | the layout change no longer describes something React committed | 4 |
| **The playback is a `transform`, and `scale` applies to descendants** | stretched children, oval corners, smeared borders | 5, 6, 7 |
| **`layout` animates *every* layout change, including ones you did not cause** | animations nobody asked for — or none, exactly while you are testing | 8, 9 |
| **Motion switched it off on purpose** | an instant, unexplained jump for reduced-motion users | 10 |

## Gotchas

### ⚠️ Pitfall 1: The Element Is `display: inline`, So Nothing Ever Animates
The first entry in upstream's own troubleshooting list, and it produces **no error and no warning** — the layout change simply applies instantly. Motion plays layout animations as transforms, and browsers do not apply `transform` to inline elements. A `motion.span` or a `motion.a` inherits `display: inline` by default, so this is a one-token fix that costs an afternoon to find.

```tsx
// ❌ SILENT NO-OP: a span is display: inline
<motion.span layout>{label}</motion.span>

// ✅ give it a box the browser will transform
<motion.span layout style={{ display: 'inline-block' }}>{label}</motion.span>
```

### ⚠️ Pitfall 2: The Component Never Re-Rendered, So Motion Never Measured
The second entry in that list, and the one people skip because it sounds too obvious. Layout animations are triggered by a React render; a layout change React never committed is a layout change Motion never sees. Three real sources of this:

- a direct DOM write (`el.style.width = ...`) from a third-party widget or a chart library;
- a CSS animation, transition or `:hover` rule changing the box;
- a `ResizeObserver` or media query changing layout without any state update.

```tsx
// ❌ the width changes, React renders nothing, Motion measures nothing
useEffect(() => { ref.current.style.width = '400px' }, [isOpen])

// ✅ commit the change through React so a render happens
<motion.div layout style={{ width: isOpen ? 400 : 200 }} />
```

### ⚠️ Pitfall 3: Trying to Layout-Animate an SVG
> *"SVG components aren't currently supported with layout animations."*

The reason given is structural rather than a missing feature — SVG has no layout system for Motion to measure. The documented alternative is to animate the SVG's own attributes directly:

```tsx
// ❌ unsupported
<motion.circle layout cx={x} cy={y} r={r} />

// ✅ animate the attributes SVG actually has
<motion.circle animate={{ cx: x, cy: y, r }} />
```

⚠️ This one is easy to hit indirectly: an icon component that happens to render an `svg` root, wrapped with `motion.create()` and given `layout`, is in this case even though nothing in your JSX says "SVG".

### ⚠️ Pitfall 4: Driving the Layout Change From `animate` Instead of `style`/`className`
The layout animation docs raise this as a **WARNING**: changes to layout should be made via `style` or `className`, not via animation props like `animate` or `whileHover`, as `layout` will take care of the animation. Putting the layout change *inside* `animate` puts a value animation and a layout animation on the same property, and the FLIP measurement no longer describes a change React committed.

```tsx
// ❌ two systems on one property
<motion.div layout animate={{ width: isOpen ? 400 : 200 }} />

// ✅ commit the layout change; let `layout` animate the consequence
<motion.div layout style={{ width: isOpen ? 400 : 200 }} />
```

The same warning covers gesture props: a `whileHover={{ width: 300 }}` on a `layout` element is the same mistake with a shorter fuse, because it fires on every pointer entry.

### ⚠️ Pitfall 5: Content Looks Stretched or Squashed Mid-Animation
This is the direct, expected consequence of animating size with `scale`, not a bug. Two documented fixes, chosen by what the element *is*:

> *"Often, this can be fixed by providing these elements a layout animation and they'll be scale-corrected."*

```tsx
// ✅ a child that should keep its own proportions: give IT a layout animation too,
//    and Motion counter-scales it
<motion.section layout>
  <motion.img layout />
</motion.section>

// ✅ an element changing ASPECT RATIO (images, re-wrapping text): animate position only
//    and let the size snap — there is no honest scale to interpolate
<motion.img layout="position" src={src} />
```

The distinction is worth being precise about: the first fix corrects the distortion, the second **avoids** it by not animating size at all. Reaching for `layout="position"` on a child that could have been counter-scaled throws away an animation you could have had.

### ⚠️ Pitfall 6: `borderRadius` Set in a Stylesheet Is Not Scale-Corrected
Motion corrects `border-radius` and `box-shadow` distortion automatically, **but only for values it can see** — set on the element via `style` or an animation prop. A radius that lives in a CSS class or a Tailwind utility is invisible to that correction, so a rounded card animating between two sizes develops visibly oval corners.

```tsx
// ❌ correction cannot happen — Motion never sees the value
<motion.div layout className="rounded-2xl" />

// ✅ correction happens
<motion.div layout style={{ borderRadius: 16 }} />
```

🔴 **This is the single most common "layout animations look cheap" report in a Tailwind codebase**, because the utility class is the idiomatic way to write it and the fix looks like a step backwards.

### ⚠️ Pitfall 7: A `border` Looks Stretched, and Moving It to `style` Does Not Help
`border` is treated separately by the docs, with two independent reasons. First, changing `border` triggers layout recalculation, which defeats the performance argument for animating via transform — you may as well animate `width` and `height` classically. Second, a border cannot render thinner than 1px, which caps how far scale correction can go: at a scale factor small enough, the correction has nowhere left to shrink to.

The documented workaround is to stop using `border` and build one out of padding, so the "border" is a real box that scale-corrects like any other:

```tsx
<motion.div layout style={{ borderRadius: 10, padding: 5 }}>
  <motion.div layout style={{ borderRadius: 5 }} />
</motion.div>
```

The outer element is the border colour, the inner one is the content surface, and both are corrected.

### ⚠️ Pitfall 8: The Whole Page Animates When a Scrollbar Appears
A genuinely surprising one, and the docs name it explicitly: a scrollbar appearing or disappearing *is* a layout change, and `layout` animates every layout change without asking why it happened.

> *"Layout changes can affect whether or not a scrollbar is visible. Scrollbars take up visible space, which means layouts are then subsequently affected by the scrollbar. Layout animations will apply to any layout change."*

The fix is CSS, not Motion — reserve the gutter so the layout never changes:

```css
body {
  overflow-y: auto;
  scrollbar-gutter: stable;
}
```

This is the usual explanation for "opening a modal makes the entire page shift with a 300ms animation": the modal locked page scroll, the scrollbar went away, everything got a few pixels wider, and every `layout` element on the page faithfully animated to its new box.

### ⚠️ Pitfall 9: Nothing Animates While the Window Is Being Resized
> *"Layout animations are blocked during horizontal window resize to improve performance and to prevent unnecessary animations."*

This is deliberate, and it is a real trap when you are testing a responsive breakpoint by dragging the window edge: the behaviour you are trying to reproduce is suppressed by the act of reproducing it. Test breakpoint transitions by toggling state, or by resizing and *then* triggering the change — not by dragging.

Note the qualifier: the documentation says **horizontal** resize. It does not state what happens on a purely vertical resize, so treat that as unspecified rather than assuming symmetry.

### ⚠️ Pitfall 10: `reducedMotion: "user"` Turns Layout Animations Off Entirely
The accessibility documentation describes `reducedMotion` set to `"user"` as automatically disabling transform **and layout** animations across all motion components, while preserving the animation of other values like `opacity` and `backgroundColor`. That is the right default — but it means a layout animation is not a place to put information the user needs. If the only cue that an item moved is the movement itself, a reduced-motion user gets an instant, unexplained jump.

```tsx
import { MotionConfig } from 'motion/react';

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

The design consequence, not the code consequence, is the one that matters: any state change you communicate *only* through a layout animation needs a second, non-motion signal.

## Interview questions

**★ A `motion.span` has `layout` and refuses to animate. No error is thrown. What are your first two checks?**
`display`, then renders. Browsers do not apply `transform` to inline elements, and Motion plays layout animations as transforms, so an inline element silently applies the layout change instantly — `display: inline-block` or `block` fixes it. The second check is whether the component actually re-rendered: layout animations are triggered by a React render, so a layout change that bypassed React entirely (a direct DOM write, a CSS transition, a resize handled outside state) is never measured and never animated.

**★ A card grows and the text inside it looks stretched. Give two fixes and say when each is right.**
Give the child its own `layout` prop and Motion counter-scales it, so it renders undistorted — right for a child that should keep its own proportions while its parent resizes. Or use `layout="position"` on elements changing aspect ratio, images especially, so only the position animates and the size snaps — right when there is no honest scale correction to apply, because the element's proportions genuinely differ at both ends. Reaching for the second when the first would work throws away an animation you could have had.

**★ Why does `border-radius` have to be set in `style` rather than a CSS class?**
Because the correction is arithmetic Motion performs per frame, and it can only correct a number it holds. `border-radius` and `box-shadow` are automatically corrected for scale distortion, but only when set via `style` or an animation prop. A radius in a stylesheet or a utility class never enters Motion's model, so the element scales and the corner ovalises. The same reasoning explains why `border` cannot be fixed the same way: it triggers layout recalculation and cannot render below 1px, so the recommended answer is to rebuild it as a padded parent rather than to move the value into `style`.

**★ Your icon is an SVG and `layout` does nothing to it. Is that a bug?**
No — SVG components are not currently supported with layout animations. The reason is that SVG has no layout system for Motion to measure against; there is no box model to diff. The documented alternative is to animate the SVG's own attributes (`cx`, `cy`, `r` and so on) directly, which Motion does support. Worth knowing because it also catches you indirectly, through an icon component whose root element happens to be an `svg`.

**★ Opening a modal makes the entire page shift with a 300ms animation nobody wrote. What happened?**
The modal locked page scroll, the scrollbar disappeared, and that widened the layout of everything on the page. Motion does not distinguish a layout change you meant from one you did not — *"Layout animations will apply to any layout change."* Fix it in CSS with `scrollbar-gutter: stable` so the gutter is reserved whether or not a scrollbar is drawn, and the layout never changes in the first place. Fixing it by removing `layout` props is treating the symptom.

**★ You are dragging the browser window to test a breakpoint and the layout animation never plays. Is it broken?**
No. Layout animations are blocked during horizontal window resize, deliberately, for performance and to avoid animating every intermediate width. The test method is the bug. Trigger the change from state, or resize first and then trigger it. The documentation specifies horizontal resize; it does not say what happens on a purely vertical one, so do not assume that case behaves the same way.

**★ Why is `reducedMotion: "user"` a design constraint and not just an accessibility checkbox?**
Because it switches transform and layout animations off while leaving `opacity` and colour animations on. Anything you communicated *only* through movement — which item was reordered, which card the modal grew from — disappears for that user and is replaced by an instant jump. It forces the honest question: is this animation decoration, or is it the only signal? If it is the only signal, it needs a non-motion counterpart, and that is a design decision, not a config flag.

**★ Someone puts `whileHover={{ width: 320 }}` on an element that also has `layout`. What is wrong with it?**
It violates the documented rule that layout changes should be made through `style` or `className`, not through animation props, because `layout` is what takes care of the animation. You now have a value animation on `width` and a layout animation both claiming the same property, and the layout measurement no longer corresponds to a change React committed. It is worse than the `animate` version of the same mistake only because it fires on every pointer entry rather than on a state change.

---

← [Layout animations](01-automatic-layout-transitions.md) · [Explanations](../README.md) · Next → [Shared layout coordination](01c-shared-layout-coordination.md)
