---
title: "Basic Animation Props: `initial`, `animate`, `exit` & `transition`"
sidebar_label: "Basic Animation Props"
sidebar_position: 1
---

# 🎨 Basic Animation Props: `initial`, `animate`, `exit` & `transition`

## 1. Under-The-Hood Mechanics

Three props form the core state-description model every other Framer Motion feature builds on — each describing a distinct moment in a component's lifecycle.

```
initial={{ opacity: 0 }}     ──► the STARTING style, applied IMMEDIATELY on mount (before any animation runs)
animate={{ opacity: 1 }}       ──► the TARGET style — Motion animates FROM initial TOWARD this, on mount,
                                       and RE-ANIMATES toward it whenever animate's VALUE changes on a re-render
exit={{ opacity: 0 }}             ──► the style to animate TOWARD on UNMOUNT — requires <AnimatePresence>
                                         wrapping the component (see the dedicated AnimatePresence doc)

transition={{ duration: 0.3, ease: 'easeOut' }}  ──► configures the TIMING/EASING of the animate transition —
                                                        can be set globally (one object) or PER-PROPERTY
```

### `initial` vs `animate`: Not Just "Before and After" — A Live Diff on Re-Render
`animate`'s target value is re-evaluated on every render — if a component's `animate` prop changes (e.g. `animate={{ x: isOpen ? 0 : -300 }}` after `isOpen` toggles), Motion automatically animates from the **current** value toward the **new** target, without needing to reset to `initial` first. `initial` only applies once, at mount — it establishes the starting point for the very first animation, not a value re-applied on every state change.

### Per-Property Transition Overrides
```tsx
<motion.div
  animate={{ opacity: 1, x: 0 }}
  transition={{
    opacity: { duration: 0.2 },       // opacity animates over 200ms
    x: { type: 'spring', stiffness: 300 }, // x uses SPRING physics instead, independently configured
  }}
/>
```
Different properties animating with genuinely different timing/easing characteristics (a fade using a simple duration-based tween, alongside a position change using bouncier spring physics) is expressed by nesting per-property transition configs, rather than being forced into one single, compromise timing model for the whole animation.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Slide-Out Panel Correctly Reversing Its Animation Mid-Transition When Rapidly Toggled.
A slide-out settings panel needed to smoothly reverse direction if a user clicked "close" while it was still mid-way through its "open" animation — a naive imperative CSS transition approach can produce a visual "jump" if interrupted mid-flight (snapping to the new target's un-animated starting position before beginning the reverse transition). Because Motion's `animate` prop always animates from the component's **actual current** rendered position (not from `initial`, and not from a hardcoded starting point) toward whatever the new target is, toggling the panel state mid-animation produced a smooth, correctly-reversed transition automatically — no special interruption-handling code needed at all.

---

## 3. Production-Grade Code Example

```tsx
// A settings panel correctly reversible mid-animation
import { motion } from 'motion/react';

function SettingsPanel({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.div
      className="settings-panel"
      initial={{ x: '100%' }} // off-screen to the right, ONLY on first mount
      animate={{ x: isOpen ? 0 : '100%' }} // re-evaluated on EVERY render — reverses correctly if toggled mid-animation
      transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
    >
      <SettingsContent />
    </motion.div>
  );
}
```

```tsx
// Per-property transition overrides — different timing models for different properties
function Modal({ isVisible }: { isVisible: boolean }) {
  return (
    <motion.div
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
      transition={{
        opacity: { duration: 0.15 }, // fast, simple fade
        scale: { type: 'spring', stiffness: 400, damping: 30 }, // bouncier, physics-based scale
      }}
    >
      <ModalContent />
    </motion.div>
  );
}
```

```tsx
// exit — requires AnimatePresence (covered in depth in its own dedicated doc)
import { motion, AnimatePresence } from 'motion/react';

function Notification({ isShowing, message }: { isShowing: boolean; message: string }) {
  return (
    <AnimatePresence>
      {isShowing && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }} // animates OUT before actually being removed from the DOM
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Expecting `exit` to Work Without `<AnimatePresence>`
```tsx
// ❌ WRONG: React unmounts components SYNCHRONOUSLY — without AnimatePresence delaying
// the actual removal, `exit` has NO effect at all; the element just vanishes instantly
{isShowing && <motion.div exit={{ opacity: 0 }}>...</motion.div>} // exit prop is IGNORED without AnimatePresence

// ✅ CORRECT: exit animations REQUIRE AnimatePresence wrapping the conditionally-rendered content
<AnimatePresence>{isShowing && <motion.div exit={{ opacity: 0 }}>...</motion.div>}</AnimatePresence>
```

### ⚠️ Pitfall 2: Setting `initial` to the Same Value as `animate`, Expecting a Re-Trigger on Every Render
```tsx
// ❌ MISUNDERSTANDING: initial ONLY applies on mount — changing a component's props/state
// does NOT re-apply `initial`; only `animate`'s CHANGED target value triggers a new transition
<motion.div initial={{ opacity: 0 }} animate={{ opacity: someValue }} /> // re-mounting is NOT what state changes do

// ✅ AWARENESS: to force a full RESET-and-replay of an entrance animation on a state
// change (not just an animate transition), the component typically needs to actually
// REMOUNT (e.g. via a changed `key` prop), not just receive new animate values
```

### ⚠️ Pitfall 3: Using One Global `transition` When Properties Genuinely Need Different Timing
```tsx
// ❌ SUBOPTIMAL: forcing opacity and a spring-appropriate transform into the SAME
// single transition config often produces a result where NEITHER property's timing
// actually looks right — a spring's bounce and a fade's linear feel work best independently
<motion.div animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300 }} /> // opacity ALSO springs, often looking odd

// ✅ CORRECT: use per-property transition overrides when properties have genuinely
// different ideal timing characteristics
<motion.div animate={{ opacity: 1, scale: 1 }} transition={{ opacity: { duration: 0.2 }, scale: { type: 'spring' } }} />
```
