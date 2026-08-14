---
title: "Variants: Reusable Named States, Orchestration & Propagation"
sidebar_label: "Variants"
sidebar_position: 1
---

# 🎨 Variants: Reusable Named States, Orchestration & Propagation

## 1. Under-The-Hood Mechanics

Variants replace inline style objects with **named, reusable states**, referenced by string — the mechanism that also enables parent-to-child animation propagation and coordinated group timing, neither of which inline `animate={{...}}` objects alone can express.

```typescript
const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

<motion.div variants={variants} initial="hidden" animate="visible" />
//                                        │              │
//                                        └── just STRING KEYS referencing the variants object
```

### Orchestration: `staggerChildren`/`delayChildren` on a Parent
```tsx
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } }, // orchestration lives on the PARENT
};
const item = { hidden: { opacity: 0 }, visible: { opacity: 1 } }; // children just define their OWN two states

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map((item) => <motion.li key={item.id} variants={item} />)} {/* NO individual timing needed */}
</motion.ul>
```
`staggerChildren` on a parent variant automatically delays each child's animation start by an incrementing amount — producing a cascading, sequential-looking effect (a list's items appearing one after another) without any individual child needing its own explicit delay calculated or hardcoded.

### Propagation: Children Automatically Inherit Parent Variant Changes
When a parent's `animate` prop changes to a new variant name (`animate="visible"` → `animate="exit"`), **every** child motion component with matching variant keys automatically animates to its own corresponding state for that same variant name — without each child needing its own `animate` prop explicitly re-specified. This propagation is what makes staggered list animations, coordinated multi-element transitions, and nested exit animations all work from a single state change at the top of a tree.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Navigation Menu's Items Cascading Into View, Driven by One Single State Change at the Parent.
A dropdown navigation menu needed its individual menu items to appear in a cascading, staggered sequence when the menu opened — rather than all items appearing simultaneously, or requiring each menu item to be hand-assigned its own specific delay value (fragile, and requiring a code change every time an item was added/removed from the menu). Defining a `container` variant with `staggerChildren` on the parent `<motion.ul>`, and a simple two-state `item` variant on each `<motion.li>`, meant toggling the parent's single `animate` prop between `'hidden'`/`'visible'` automatically cascaded the stagger effect across however many items happened to exist — adding or removing a menu item required zero animation-timing code changes at all.

---

## 3. Production-Grade Code Example

```tsx
// A staggered navigation menu, driven entirely by ONE parent state change
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }, // orchestration config lives HERE, only
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

function NavMenu({ isOpen, items }: { isOpen: boolean; items: string[] }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate={isOpen ? 'visible' : 'hidden'} // ONE state change cascades through EVERY child automatically
    >
      {items.map((item) => (
        <motion.li key={item} variants={itemVariants}> {/* no individual timing needed at all */}
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

```tsx
// Variant propagation working through multiple nesting levels, not just direct children
const cardVariants = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } };
const badgeVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { delay: 0.2 } } };

function ProductCard({ isVisible }: { isVisible: boolean }) {
  return (
    <motion.div variants={cardVariants} initial="hidden" animate={isVisible ? 'visible' : 'hidden'}>
      <ProductImage />
      <motion.span variants={badgeVariants}>Sale</motion.span> {/* inherits the SAME 'visible'/'hidden' state */}
    </motion.div>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Setting an Explicit `animate` Prop on a Child, Accidentally Breaking Propagation
```tsx
// ❌ WRONG: giving a child its OWN explicit animate prop OVERRIDES inherited propagation from
// the parent — this child no longer responds to the parent's variant state changes at all
<motion.li variants={itemVariants} animate="visible">Item</motion.li> {/* ❌ hardcoded, ignores parent state */}

// ✅ CORRECT: omit animate on children that should PROPAGATE from the parent — only the
// parent needs animate; children just need matching variants
<motion.li variants={itemVariants}>Item</motion.li> {/* inherits from parent's animate prop */}
```

### ⚠️ Pitfall 2: Mismatched Variant Key Names Between Parent and Child
```tsx
// ❌ SILENT FAILURE: if the parent uses 'visible'/'hidden' but a child's variants object uses
// 'shown'/'hide' instead, propagation silently does nothing for that mismatched child —
// no error, the child just never animates in response to the parent's state changes
const parentVariants = { hidden: {...}, visible: {...} };
const childVariants = { hide: {...}, shown: {...} }; // MISMATCHED key names — propagation breaks silently

// ✅ CORRECT: use IDENTICAL variant key names across parent and every propagating child
const childVariants2 = { hidden: {...}, visible: {...} }; // matches the parent's key names exactly
```

### ⚠️ Pitfall 3: Putting Orchestration Config on the Wrong Level (Child Instead of Parent)
```tsx
// ❌ WRONG: staggerChildren only has an effect when set on transition for a PARENT's variant —
// setting it on a CHILD's own variant transition does nothing, since a leaf child has no
// children of its own to stagger
const itemVariants = { visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }, // ❌ no effect here — this IS the leaf

// ✅ CORRECT: staggerChildren/delayChildren belong on the transition of the PARENT container's variant
const containerVariants = { visible: { transition: { staggerChildren: 0.1 } } }, // correct — on the PARENT
```
