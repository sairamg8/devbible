---
title: "SVG Animations: `pathLength`, Stroke Drawing & Path Morphing"
sidebar_label: "SVG Animations"
sidebar_position: 1
---

# 🎨 SVG Animations: `pathLength`, Stroke Drawing & Path Morphing

## 1. Under-The-Hood Mechanics

Framer Motion extends its animation model to SVG-specific properties, most notably enabling a genuinely distinctive effect — animating a path's stroke as if it's being **drawn** in real time — via properties that don't have a direct equivalent in standard CSS animation.

```
pathLength   ──► a 0-1 value representing how much of the path's stroke is VISIBLE,
                    from its start — animating 0 → 1 produces a "drawing" effect
pathOffset      ──► shifts WHERE along the path the visible portion starts —
                       combined with pathLength, can produce a "traveling dash" effect
pathSpacing        ──► controls dash spacing when combined with pathLength for partial reveals

animate={{ pathLength: 1 }}
initial={{ pathLength: 0 }}
        │
        ▼
The SVG path's stroke animates from COMPLETELY HIDDEN to FULLY DRAWN, over the
configured transition — Motion handles the underlying stroke-dasharray/stroke-dashoffset
CSS trickery this effect actually requires, without needing to hand-calculate it
```

### Why `pathLength` Is More Ergonomic Than Raw CSS
Achieving this same drawing effect with raw CSS requires manually calculating a path's total length (`getTotalLength()`), then animating `stroke-dasharray`/`stroke-dashoffset` using that specific numeric value — brittle, since the calculation needs to be redone if the path itself ever changes shape/size. `pathLength`'s 0-1 normalized range abstracts this away entirely — it works correctly regardless of the path's actual absolute length, with zero manual measurement code needed.

### Morphing Between Path Shapes: A Real Caveat
Animating a path's `d` attribute directly between two different shape definitions ("morphing") works, but **only** produces a sensible, smooth result if both path definitions have a **matching number of points/commands** — morphing between structurally very different paths (a circle into a star, say) often produces visually chaotic, non-intuitive in-between states, since the interpolation happens point-by-point without any awareness of the shapes' actual visual correspondence.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Progress Checkmark That Draws Itself In, Rather Than Simply Fading In.
A "task completed" UI moment needed a checkmark icon to feel satisfying — animating as if being drawn stroke-by-stroke, rather than a generic fade or scale-in, which felt visually flat for a moment meant to feel like a deliberate, earned completion. Using `pathLength` animating from `0` to `1` on the checkmark SVG's path produced exactly this drawing effect, with the stroke visibly tracing the checkmark's shape over the animation's duration — a distinctive effect that a plain opacity/scale animation on the same SVG could not have produced, since those animate the WHOLE shape's visibility/size, not the progressive reveal of the stroke itself.

---

## 3. Production-Grade Code Example

```tsx
// pathLength — a self-drawing checkmark
import { motion } from 'motion/react';

function AnimatedCheckmark() {
  return (
    <svg viewBox="0 0 24 24" width={48} height={48}>
      <motion.path
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="#22c55e"
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </svg>
  );
}
```

```tsx
// pathOffset combined with pathLength — a "traveling" partial-reveal effect, e.g. a loading indicator
<motion.circle
  cx={50} cy={50} r={40}
  fill="none"
  stroke="#3b82f6"
  strokeWidth={4}
  strokeLinecap="round"
  initial={{ pathLength: 0.25, pathOffset: 0 }}
  animate={{ pathOffset: 1 }} // the SAME quarter-arc segment travels continuously around the circle
  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
/>
```

```tsx
// Animating standard SVG-specific attributes via normal motion props
<motion.rect
  animate={{ fill: isActive ? '#3b82f6' : '#e5e7eb', rx: isActive ? 8 : 4 }}
  transition={{ duration: 0.2 }}
/>
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Attempting to Morph Between Structurally Mismatched Paths
```tsx
// ❌ RISKY: animating `d` directly between a circle path and a star path (very different
// point counts/structures) often produces visually chaotic, unintuitive intermediate shapes,
// since the interpolation has no understanding of visual correspondence between the two
<motion.path animate={{ d: isStar ? starPathData : circlePathData }} /> {/* likely looks broken mid-transition */}

// ✅ AWARENESS: for genuinely different shapes, consider a crossfade (two separate paths,
// opacity-animated) instead of a direct `d` morph, OR use a specialized path-morphing tool
// that intelligently matches points, rather than relying on Motion's raw interpolation
```

### ⚠️ Pitfall 2: Forgetting `fill: 'none'` When Using `pathLength` for a Stroke-Drawing Effect
```tsx
// ❌ VISUALLY WRONG: if the path has a FILL, the drawing effect on the STROKE is barely
// noticeable, since the filled shape is already fully visible regardless of stroke progress
<motion.path d="..." fill="#22c55e" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} /> {/* fill hides the effect */}

// ✅ CORRECT: fill: 'none' (or a genuinely transparent fill) is what makes the STROKE
// drawing effect actually visible and prominent
<motion.path d="..." fill="none" stroke="#22c55e" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />
```

### ⚠️ Pitfall 3: Assuming `pathLength` Animates at a Perceptually Uniform Speed Across Complex Paths
A path with highly uneven segment lengths (a long straight line followed by a tiny, tight curve) animates `pathLength` at a uniform RATE relative to total path length — meaning the long straight segment draws relatively slowly (in visual terms) while the short curve whips by very quickly, since both consume proportional, not perceptually-equal, amounts of the 0-1 range. For paths with very uneven segment lengths, this can produce an animation that FEELS uneven even though the underlying `pathLength` progression is mathematically linear.
