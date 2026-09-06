---
title: "Performance Considerations: GPU-Accelerated Properties & `will-change`"
sidebar_label: "Performance Considerations"
sidebar_position: 1
---

# 🎨 Performance Considerations: GPU-Accelerated Properties & `will-change`

## 1. Under-The-Hood Mechanics

Not all CSS properties are equally cheap to animate — the browser's rendering pipeline treats different properties very differently, and animating the wrong ones can force expensive work on every single frame, directly threatening smooth 60fps motion.

```
Browser rendering pipeline, per frame:
  Layout (compute element positions/sizes)  ──► expensive, triggered by width/height/top/left/margin changes
        │
        ▼
  Paint (rasterize pixels)                     ──► moderately expensive, triggered by color/background/shadow changes
        │
        ▼
  Composite (combine layers, apply GPU transforms) ──► CHEAP — transform/opacity changes can often skip
                                                            Layout AND Paint entirely, handled purely by the GPU

Animating transform/opacity  ──► can skip Layout+Paint, GPU-composited, smooth even under load
Animating width/top/left/margin ──► triggers Layout on EVERY FRAME — expensive, prone to jank under load
```

### Why `transform`/`opacity` Are Preferred
`transform: translateX()`/`scale()`/`rotate()` and `opacity` can be handled by the browser's **compositor** — a separate, GPU-accelerated stage that doesn't require recomputing the page's layout or repainting pixels on every frame. Animating `width`, `top`, `left`, or `margin` instead forces the browser to recompute layout (and often trigger a full repaint) on every single animation frame — for a 60fps animation, that's potentially 60 expensive layout recalculations per second, a very real performance cost that becomes visible as jank, especially on lower-end devices or when many elements animate simultaneously.

### `will-change`: Motion's Automatic Application, and Its Tradeoffs
Framer Motion automatically applies `will-change` to elements it animates — a hint telling the browser "this property will change soon, consider promoting this element to its own compositor layer in advance." This can improve animation smoothness by avoiding a layer-promotion cost mid-animation, but comes with a genuine tradeoff: promoted layers consume additional **GPU memory**, and applying `will-change` to too many elements simultaneously (a very long list, all midway animated) can itself become a performance/memory problem, ironically working against the smoothness it's meant to help.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Sidebar Slide-In Animation Causing Visible Jank, Fixed by Switching From `left` to `transform`.
A sidebar's open/close animation animated its `left` CSS property from `-300px` to `0` — on lower-end devices, this animation visibly stuttered, especially when other content was simultaneously rendering. Profiling in Chrome DevTools' Performance panel showed the browser recalculating layout on every single animation frame, since `left` is a layout-triggering property. Switching the animation to use `transform: translateX()` instead (`x: [-300, 0]` in Motion's terms, animating the exact same visual movement) let the browser handle the entire animation via GPU compositing, skipping layout recalculation entirely — the exact same visual motion, but now smooth even on the previously-struggling lower-end devices.

---

## 3. Production-Grade Code Example

```tsx
// ❌ Layout-triggering animation — recalculates layout on EVERY frame
import { motion } from 'motion/react';

function SidebarBad({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.div
      style={{ position: 'fixed' }}
      animate={{ left: isOpen ? 0 : -300 }} // triggers LAYOUT recalculation every frame
    >
      <SidebarContent />
    </motion.div>
  );
}
```

```tsx
// ✅ GPU-composited equivalent — the SAME visual movement, via transform instead
function SidebarGood({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.div
      style={{ position: 'fixed' }}
      animate={{ x: isOpen ? 0 : -300 }} // Motion's `x` maps to transform: translateX() — GPU-composited
    >
      <SidebarContent />
    </motion.div>
  );
}
```

```tsx
// Preferring scale over width/height for a size-change animation
// ❌ triggers layout on every frame
<motion.div animate={{ width: isExpanded ? 300 : 100 }} />

// ✅ GPU-composited equivalent (with a caveat: content INSIDE also visually scales, which
// may or may not be the desired effect — sometimes width IS genuinely necessary)
<motion.div animate={{ scale: isExpanded ? 3 : 1 }} style={{ transformOrigin: 'left' }} />
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Animating `width`/`height`/`top`/`left` "Because It's More Intuitive," Ignoring the Performance Cost
```tsx
// ❌ RISKY: intuitive to reach for, but forces layout recalculation on every frame —
// fine for ONE simple element, but compounds badly with multiple simultaneous animations
// or on lower-end devices
animate={{ top: 100, left: 200 }}

// ✅ CORRECT: prefer transform-based equivalents (x/y in Motion's shorthand) whenever
// the visual effect can be achieved that way
animate={{ x: 200, y: 100 }} // maps to transform: translate() — GPU-composited
```

### ⚠️ Pitfall 2: Applying `will-change` Broadly, Across Many Simultaneously-Animating Elements
```
❌ RISKY: Motion applies will-change automatically per-animated-element — animating
DOZENS of elements simultaneously (e.g. every item in a large staggered list) means
dozens of GPU-promoted compositor layers existing at once, which can itself consume
enough GPU memory to hurt performance, ironically undermining the smoothness will-change
is meant to provide

✅ AWARENESS: for very large simultaneously-animating sets, consider whether ALL elements
genuinely need independent layer promotion, or whether the animation could be restructured
(e.g. animating a shared parent transform instead of many individual children)
```

### ⚠️ Pitfall 3: Assuming Every Property Motion Exposes Is Equally Cheap to Animate
```tsx
// ❌ WRONG ASSUMPTION: not every prop Motion lets you pass to `animate` is GPU-composited —
// box-shadow, border-radius changes, and background-color are all real, legitimate
// animatable properties, but they trigger PAINT (not layout, but still not free) on every frame
animate={{ boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }} // triggers repaint, not free

// ✅ AWARENESS: transform/opacity are the CHEAPEST tier; paint-triggering properties
// (shadow, color, border-radius) are more expensive than those but still cheaper than
// layout-triggering ones — choose based on what the specific effect actually requires,
// understanding the real cost tiers rather than assuming everything is equally cheap
```
