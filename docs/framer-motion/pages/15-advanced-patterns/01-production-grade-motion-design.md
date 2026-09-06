---
title: "Advanced Patterns: Shared Layout Transitions, Next.js Integration & Reduced Motion"
sidebar_label: "Advanced Patterns"
sidebar_position: 1
---

# 🎨 Advanced Patterns: Shared Layout Transitions, Next.js Integration & Reduced Motion

## 1. Under-The-Hood Mechanics

Production motion design combines several previously-covered primitives into complete, real-world patterns — page transitions spanning route changes, careful client/server boundary management in Next.js, and respecting user accessibility preferences.

```
Shared layout transitions across ROUTES:
  layoutId used across DIFFERENT page/route components ──► the SAME "magic move" effect
  covered in the layout animations doc, but spanning an actual navigation, not just a
  conditional render within one page

Exit-before-enter page transitions:
  <AnimatePresence mode="wait"> wrapping ROUTE-LEVEL components ──► the outgoing page
  fully exits before the incoming page begins entering — avoiding jarring overlap

Next.js App Router integration:
  AnimatePresence/motion components REQUIRE 'use client' — cannot be used directly
  in a Server Component, requiring a deliberate CLIENT BOUNDARY specifically for the
  animated wrapper, while page CONTENT can often remain server-rendered

Reduced-motion accessibility:
  useReducedMotion()  ──► reads the user's OS-level prefers-reduced-motion setting,
                             letting a component conditionally DISABLE or SIMPLIFY its
                             own animations for users who've explicitly requested less motion
```

### Next.js Integration: A Deliberate Client Boundary
Since `AnimatePresence` and gesture-driven `motion` components rely on browser APIs and React state/effects, they cannot exist inside a Server Component (per the constraints covered in the Next.js rendering strategies doc) — the idiomatic pattern is a small, dedicated Client Component specifically wrapping page-transition logic, while the actual page **content** rendered inside it can often still be authored as Server Components, passed through via the composition pattern.

### `useReducedMotion()`: Respecting a Real Accessibility Preference
Some users experience genuine discomfort (vestibular disorders, motion sensitivity) from large-scale motion — `prefers-reduced-motion` is an OS-level setting such users can enable, and `useReducedMotion()` reads it directly, letting components conditionally swap elaborate motion for a simple fade (or no animation at all) when that preference is active.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Next.js App Router Site Needing Page Transitions Without Making Every Page a Client Component.
A marketing site built on Next.js App Router wanted smooth exit/enter transitions between pages — but making every single page component a Client Component (just to use `AnimatePresence`) would have forfeited the App Router's Server Component benefits (zero client JS for static content) across the entire site. The solution: a single, dedicated `<PageTransition>` Client Component wrapping `{children}`, placed once in the root layout — `AnimatePresence`/`motion` logic lived entirely in that one small client boundary, while every actual page's content, passed in as `children`, remained free to be authored as ordinary Server Components, preserving the App Router's server-first benefits everywhere except that one deliberate, narrow animation boundary.

---

## 3. Production-Grade Code Example

```tsx
// app/components/PageTransition.tsx — the ONE deliberate client boundary for page transitions
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname} // route change ⇒ new key ⇒ AnimatePresence detects it as exit-then-enter
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {children} {/* can still be Server Component content, passed through via composition */}
      </motion.div>
    </AnimatePresence>
  );
}
```

```tsx
// app/layout.tsx — a Server Component root layout, using the client boundary ONLY where needed
import { PageTransition } from './components/PageTransition';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PageTransition>{children}</PageTransition> {/* children can be Server Component pages */}
      </body>
    </html>
  );
}
```

```tsx
// useReducedMotion — respecting the user's actual accessibility preference
import { motion, useReducedMotion } from 'motion/react';

function AnimatedHero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.h1
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }} // skip the vertical slide if reduced motion is requested
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.1 : 0.5 }} // much shorter, simpler transition
    >
      Welcome
    </motion.h1>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Marking Entire Pages `'use client'` Just to Enable a Page Transition
```tsx
// ❌ WRONG: forces the ENTIRE page's content into the client bundle, forfeiting Server
// Component benefits across the whole page, purely to enable AnimatePresence
'use client'; // at the TOP of an entire page.tsx — way too broad
export default function ProductPage() { /* ... entire page, now client-rendered ... */ }

// ✅ CORRECT: isolate the client boundary to ONE small wrapper component (as shown above),
// letting page CONTENT remain server-rendered via composition
```

### ⚠️ Pitfall 2: Ignoring `useReducedMotion()` Entirely, Providing No Accommodation
```tsx
// ❌ INCOMPLETE: shipping elaborate, large-scale motion with NO consideration for users
// who've explicitly requested reduced motion at the OS level is a genuine accessibility gap,
// not just a nice-to-have
<motion.div animate={{ x: [0, 200, -200, 0], rotate: 360 }} transition={{ duration: 2, repeat: Infinity }} />

// ✅ CORRECT: check useReducedMotion() and provide a simplified/disabled alternative
const shouldReduceMotion = useReducedMotion();
<motion.div animate={shouldReduceMotion ? { opacity: 1 } : { x: [0, 200, -200, 0], rotate: 360 }} />
```

### ⚠️ Pitfall 3: Forgetting the `key` Prop on Route-Level `AnimatePresence` Children, Breaking Transition Detection
```tsx
// ❌ WRONG: without a key tied to the actual route (pathname), AnimatePresence can't tell
// that a NAVIGATION occurred vs just a normal re-render — page transitions silently don't trigger
<AnimatePresence mode="wait">
  <motion.div exit={{ opacity: 0 }}>{children}</motion.div> {/* no key — navigation isn't detected as a change */}
</AnimatePresence>

// ✅ CORRECT: key by the current pathname (or an equivalent route identifier), so each
// navigation is recognized as a genuinely new element requiring exit/enter treatment
<AnimatePresence mode="wait">
  <motion.div key={pathname} exit={{ opacity: 0 }}>{children}</motion.div>
</AnimatePresence>
```
