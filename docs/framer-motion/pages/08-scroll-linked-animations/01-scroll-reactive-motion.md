---
title: "Scroll-Linked Animations: `useScroll`, `whileInView` & Parallax"
sidebar_label: "Scroll-Linked Animations"
sidebar_position: 1
---

# 🎨 Scroll-Linked Animations: `useScroll`, `whileInView` & Parallax

## 1. Under-The-Hood Mechanics

Scroll-linked animation comes in two distinct flavors — triggering a one-time animation when an element **enters** the viewport, and continuously **driving** an animation's progress directly from scroll position — each suited to different effects.

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

### `useScroll` + `useTransform`: Continuous, Scroll-Driven Effects
Unlike `whileInView`'s one-time trigger, combining `useScroll`'s continuously-updating progress value with `useTransform` (mapping that progress into another value's range) produces effects that track scroll **position** directly — a parallax background moving at a different rate than foreground content, or an element's opacity/scale continuously tied to exactly how far scrolled a section is, not just whether it's visible at all.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Marketing Page's Hero Section Needing Both a One-Time Fade-In AND a Continuous Parallax Effect.
A marketing page needed its hero heading to fade in once, the first time it scrolled into view (a discrete "welcome" effect, not something that should replay every time a user scrolls up and back down) — while a separate background image needed continuous parallax motion, moving at a different rate than the foreground content for the entire duration the user scrolled through that section. `whileInView` with `viewport={{ once: true }}` handled the heading's one-time entrance; `useScroll` + `useTransform`, mapping the section's scroll progress into a background Y-offset, handled the continuous parallax — two conceptually different scroll-linked mechanisms, each matched to the effect it was actually designed for.

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

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['-20%', '20%']); // background moves SLOWER than scroll
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

### ⚠️ Pitfall 3: Attaching `useScroll` Without a `target`, Tracking the Wrong Scroll Container
```tsx
// ❌ WRONG: without a target ref, useScroll defaults to tracking the ENTIRE PAGE's scroll —
// for an effect meant to be scoped to ONE specific section's own scroll progress, this
// produces incorrect, page-wide-relative progress values instead of section-relative ones
const { scrollYProgress } = useScroll(); // tracks the WHOLE page, not this specific section

// ✅ CORRECT: pass a target ref scoped to the specific element/section whose scroll
// progress should actually drive the effect
const ref = useRef(null);
const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
```
