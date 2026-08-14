---
title: "Diagnosing Janky, Dropped-Frame Animations in Production"
sidebar_label: "Diagnosing Janky, Dropped-Frame Animations"
sidebar_position: 1
---

# 🎨 Diagnosing Janky, Dropped-Frame Animations in Production

## 1. Under-The-Hood Mechanics

"The animation is janky" has two structurally different root causes, and confusing them wastes real debugging time — this recipe splits them apart before proposing a fix:

```text
Category A: WRONG PROPERTY CHOICE                Category B: TOO MUCH SIMULTANEOUS
(see the performance considerations doc for       LAYOUT-PROP WORK
 the full cost-tier breakdown)                    (a `layout`-specific cost, not a
                                                     property-choice problem)
        │                                                  │
Animating width/top/left/margin instead           Many elements with the `layout` prop
of transform/opacity — forces LAYOUT               ALL changing position simultaneously —
recalculation on every frame                       EACH ONE needs its own FLIP measurement
                                                     (getBoundingClientRect FIRST + LAST),
                                                     which is real main-thread work that
                                                     scales with element COUNT, independent
                                                     of which property is being animated
```

A jank investigation that only checks "is this animating `width` or `transform`" will correctly clear a `layout`-prop-driven grid reflow of dozens of elements (they're all animating via `transform` under the hood, which Category A would call "fine") while completely missing that the FLIP measurement pass itself, done for every one of those dozens of elements on every trigger, is the actual bottleneck.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Filterable Product Grid That Animates Smoothly at 12 Items, Visibly Stutters at 200.
A product grid gives every `<motion.div layout>` card an automatic FLIP-based reflow animation when a filter changes and the grid reorders. At a small catalog size (12 items) it's buttery smooth; the same code applied to a 200-item catalog visibly stutters on every filter change. The instinct to check "are we animating transform or width" finds nothing wrong — every card animates via `transform`, exactly as Category A recommends. Chrome DevTools' Performance panel tells the real story: a long "Recalculate Style" + "Layout" block at the START of the animation, BEFORE any visual movement begins — that's Motion's FLIP measurement pass running `getBoundingClientRect()` across all 200 layout-animated elements synchronously, a cost that scales with element count and has nothing to do with which CSS property each individual card ultimately animates.

---

## 3. Production-Grade Diagnostic Sequence

```text
# Step 1: CONFIRM and MEASURE — don't diagnose from a vague "it feels laggy" impression
1. Chrome DevTools → Performance panel → Record
2. Trigger the janky animation
3. Stop recording
4. Look at the FPS graph at the top: sustained green (near 60fps) vs red/dropped-frame
   regions makes "is this actually janky, and exactly when" objective, not a feeling
```

```text
# Step 2a: CATEGORY A CHECK — during the janky window, what color are the blocks?
Purple blocks ("Recalculate Style", "Layout")   →  a layout-triggering property is animating
Green blocks ("Paint")                             →  a paint-triggering property is animating
                                                        (box-shadow, border-radius, background-color)
Blocks mostly on the Compositor thread, minimal    →  NOT a Category A problem — the animated
main-thread purple/green during the ANIMATION           properties are already cheap; look at
itself (only at the very START, see Step 2b)            Category B instead
```

```tsx
// If Step 2a found purple "Layout" blocks THROUGHOUT the animation (not just at the start):
// ❌ SUSPECT — Category A, a layout-triggering property
<motion.div animate={{ left: isOpen ? 0 : -300 }} />

// ✅ FIX — see the performance considerations doc for the full property-cost-tier breakdown
<motion.div animate={{ x: isOpen ? 0 : -300 }} />
```

```text
# Step 2b: CATEGORY B CHECK — is the expensive work concentrated in ONE block at the START,
# before any visual movement, rather than spread across the whole animation?
That pattern (one large Layout/Recalculate-Style block, THEN smooth compositor-only motion)
is the FLIP measurement pass, not per-frame animation cost — it scales with HOW MANY
elements have the `layout` prop and are changing simultaneously, not with which property
each one ultimately animates
```

```tsx
// ❌ SUSPECT — Category B: 200 simultaneously layout-animated siblings
{products.map((p) => (
  <motion.div key={p.id} layout> {/* EVERY one of 200 cards does its own FLIP measurement */}
    <ProductCard product={p} />
  </motion.div>
))}

// ✅ FIX 1 — narrow `layout` to `layout="position"` if size never actually changes;
// still does a measurement pass, but skips size-comparison work
<motion.div key={p.id} layout="position">

// ✅ FIX 2 — for LARGE lists, consider whether every item genuinely needs its OWN independent
// layout animation, versus animating a shared parent transform (e.g. CSS Grid reflow handling
// position changes natively, with Motion only animating enter/exit via AnimatePresence,
// not every single item's continuous position via `layout`)
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Fixing Category A When the Real Problem Is Category B
Swapping every animated property to `transform`/`opacity` equivalents (the Category A fix) does nothing for a FLIP-measurement-cost problem — the measurement pass happens regardless of which property each element ultimately animates via, because it's about reading CURRENT layout positions, not about the animation's own per-frame cost. Step 2a/2b's distinction (expensive work spread THROUGHOUT the animation vs concentrated in one block at the START) is what tells you which category you're actually facing before spending effort on the wrong fix.

### ⚠️ Pitfall 2: Testing Only on a Fast Development Machine
```text
❌ RISKY: a developer's machine (often a high-end laptop) can absorb jank that's clearly
visible on the actual median user's device — "it looks smooth to me" is not evidence of
no jank, only evidence that YOUR specific hardware has enough headroom to mask it
```
Chrome DevTools' Performance panel has a CPU throttling option (4x/6x slowdown) specifically for this — profiling under throttling simulates a lower-end device's actual headroom, surfacing jank that a fast dev machine would never reveal on its own.

### ⚠️ Pitfall 3: Assuming `will-change`'s Automatic Application Fixes Category B
Motion's automatic `will-change` application (see the performance considerations doc) helps the COMPOSITING stage once an animation is actually running — it does nothing for the FLIP measurement pass that happens BEFORE compositing even begins, since that pass is fundamentally about reading current DOM geometry (`getBoundingClientRect()`), not about GPU layer promotion. A Category B jank problem isn't a `will-change` problem at all.

### ⚠️ Pitfall 4: Not Distinguishing Main-Thread-Busy From Genuinely-Slow-Animation
If DevTools shows the main thread busy with **unrelated** work (a large React re-render, heavy JS execution from something else entirely) during the same window as the animation, the animation itself may be fully GPU-composited and cheap — the jank is competition for frame budget from something else running concurrently, not the animation's own cost. Check what ELSE is on the main thread during the janky window before concluding the animation configuration itself is the problem.
