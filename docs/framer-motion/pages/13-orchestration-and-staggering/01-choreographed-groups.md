---
title: "Orchestration & Staggering: Parent-Child Timing & Custom Per-Child Stagger"
sidebar_label: "Orchestration & Staggering"
sidebar_position: 1
---

# 🎨 Orchestration & Staggering: Parent-Child Timing & Custom Per-Child Stagger

## 1. Under-The-Hood Mechanics

Building on the [variants doc](../04-variants/01-reusable-named-states.md)'s introduction to `staggerChildren`, real-world orchestration often needs more nuance than simple uniform staggering — controlling stagger **direction**, and giving individual children their own **data-driven** stagger delay rather than a uniform increment.

```typescript
const container = {
  visible: {
    transition: {
      staggerChildren: 0.1,      // each child starts 0.1s after the PREVIOUS one
      staggerDirection: 1,          // 1 = forward order (default), -1 = REVERSE order (last child animates FIRST)
      delayChildren: 0.2,             // ALL children wait this long before staggering even begins
    },
  },
};
```

### `custom` Prop: Per-Child Data-Driven Stagger
```tsx
const itemVariants = {
  hidden: { opacity: 0 },
  visible: (custom: number) => ({ opacity: 1, transition: { delay: custom * 0.05 } }), // a VARIANT FUNCTION
};

<motion.li custom={index} variants={itemVariants} /> // `custom` is passed THROUGH to the variant function
```
When a variant is defined as a **function** (rather than a plain object), it receives whatever value was passed via the `custom` prop on that specific motion component — letting each child compute its own individualized delay/style based on genuinely custom, per-item data (its index, its distance from a click point, its priority) rather than being locked into `staggerChildren`'s uniform, purely-sequential increment.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Grid of Items Needing to Animate In Based on Distance From Where the User Clicked, Not Simple List Order.
A grid layout needed its items to animate in with a stagger that radiated outward from wherever the user had just clicked (e.g. clicking a "shuffle" button at a specific grid position) — `staggerChildren`'s simple, uniform sequential increment couldn't express this, since it only staggers in a fixed order (or reverse order), not based on each item's actual spatial relationship to a dynamic trigger point. Using a **variant function** receiving each item's precomputed distance-from-click-point via the `custom` prop let each grid item calculate its own individualized delay proportional to that distance — items closer to the click point animated in first, with those farther away following in a genuinely radiating, distance-based sequence that `staggerChildren` alone had no way to express.

---

## 3. Production-Grade Code Example

```tsx
// staggerDirection: -1 — a reverse-order stagger (last item animates FIRST)
const listVariants = {
  visible: { transition: { staggerChildren: 0.08, staggerDirection: -1 } }, // reverse order
};

function ReversedStaggerList({ items }: { items: string[] }) {
  return (
    <motion.ul variants={listVariants} initial="hidden" animate="visible">
      {items.map((item) => <motion.li key={item} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>{item}</motion.li>)}
    </motion.ul>
  );
}
```

```tsx
// custom prop + variant function — distance-based stagger, not simple list order
const itemVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (distanceFromClick: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: distanceFromClick * 0.03 }, // farther items delay proportionally longer
  }),
};

function RadiatingGrid({ items, clickPoint }: { items: GridItem[]; clickPoint: { x: number; y: number } }) {
  return (
    <div className="grid">
      {items.map((item) => {
        const distance = Math.hypot(item.x - clickPoint.x, item.y - clickPoint.y);
        return (
          <motion.div
            key={item.id}
            custom={distance} // passed THROUGH to the variant function above
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            {item.content}
          </motion.div>
        );
      })}
    </div>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming `staggerChildren` Can Express Non-Sequential Stagger Patterns
```tsx
// ❌ WRONG TOOL: staggerChildren only supports uniform, forward or reverse SEQUENTIAL
// staggering — it cannot express a distance-based, priority-based, or otherwise
// non-sequential stagger pattern
transition: { staggerChildren: 0.1 }, // ONLY sequential order, forward or reversed via staggerDirection

// ✅ CORRECT: use a custom prop + variant function for genuinely data-driven, non-sequential stagger timing
variants={{ visible: (customValue) => ({ transition: { delay: customValue * 0.05 } }) }}
```

### ⚠️ Pitfall 2: Forgetting a Variant Defined as a Function Needs the `custom` Prop Actually Set
```tsx
// ❌ SILENT BUG: a variant function receives `custom` as its argument — if the motion
// component never actually sets the custom prop, the function receives `undefined`,
// producing NaN/broken delay calculations rather than a clear error
const itemVariants = { visible: (custom) => ({ transition: { delay: custom * 0.05 } }) };
<motion.li variants={itemVariants} /> // ❌ missing custom prop — custom is undefined, delay becomes NaN

// ✅ CORRECT: always pass the custom prop when using a variant FUNCTION
<motion.li custom={index} variants={itemVariants} />
```

### ⚠️ Pitfall 3: Excessive Stagger Delay Making a Large List Feel Sluggish to Fully Appear
```tsx
// ❌ RISKY: a stagger delay that seems reasonable for 5 items (0.1s each = 0.5s total)
// becomes a genuinely SLOW, sluggish-feeling entrance for a list of 50 items (5 full seconds
// before the LAST item appears) — the SAME per-item delay doesn't scale well to large lists
transition: { staggerChildren: 0.1 }, // fine for 5 items, feels sluggish for 50

// ✅ CORRECT: scale the stagger delay INVERSELY with list length, or cap the total stagger
// duration regardless of item count, for lists whose size can vary significantly
transition: { staggerChildren: Math.min(0.1, 2 / items.length) }, // caps total stagger time at ~2s regardless of count
```
