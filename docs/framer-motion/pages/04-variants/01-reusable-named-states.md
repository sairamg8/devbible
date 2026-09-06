---
title: "Variants: Reusable Named States, Orchestration & Propagation"
sidebar_label: "Variants"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Motion docs for **Motion 13.2.0** on **React 19.2.8** —
> [React animation](https://motion.dev/docs/react-animation),
> [Transitions](https://motion.dev/docs/react-transitions),
> [stagger](https://motion.dev/docs/stagger),
> [Motion component](https://motion.dev/docs/react-motion-component),
> [React gestures](https://motion.dev/docs/react-gestures) and
> [AnimatePresence](https://motion.dev/docs/react-animate-presence), read from a 131-page raw
> mirror of motion.dev. React version probed on the installed package; `motion` is **not**
> installed in this checkout, so every Motion claim below is documentation-verified.
> **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Variants: Reusable Named States, Orchestration & Propagation

## 1. Under-The-Hood Mechanics

Variants replace inline style objects with **named, reusable states**, referenced by string — the mechanism that also enables parent-to-child animation propagation and coordinated group timing, neither of which inline `animate={{ ... }}` objects alone can express.

> *"The animate prop works well for single elements, but real interfaces often need coordinated animations across parent and child components. Variants solve this by defining named animation states that propagate through the component tree."* — [React animation](https://motion.dev/docs/react-animation)

```tsx
import { motion } from 'motion/react';

const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

<motion.div variants={variants} initial="hidden" animate="visible" />
//                                        │              │
//                                        └── just STRING KEYS referencing the variants object
```

A label is accepted anywhere a target object is — `initial`, `animate`, `exit`, `whileHover`, `whileTap`, `whileFocus`, `whileDrag`, `whileInView` — and more than one can be applied at once: *"You can also define multiple variants via an array"*, `animate={["visible", "danger"]}`. ⚠️ The docs show the array form but **do not state the merge order** when two active variants set the same value; treat that as unspecified rather than relying on it.

### Orchestration: `delayChildren` (and `stagger`) on a Parent

> *"By default, this children animations will start simultaneously with the parent. But with variants we gain access to new transition props when and delayChildren"* — [React animation](https://motion.dev/docs/react-animation) (grammar as published)

🔴 **The option is `delayChildren`, not `staggerChildren`.** `staggerChildren` appears **zero times across all 131 current motion.dev docs**; the documented spelling for a cascade is `delayChildren` set to a `stagger()` call. The [React upgrade guide](https://motion.dev/docs/react-upgrade-guide) lists no removal of `staggerChildren` for 11.0, 12.0 or 13.0, so this page does **not** claim it throws — it claims it is no longer the documented API, which for a reference is the thing that matters.

```tsx
import { motion } from 'motion/react';
import { stagger } from 'motion';

const container = {
  hidden: {},
  visible: { transition: { delayChildren: stagger(0.1) } }, // orchestration lives on the PARENT
};
const itemVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } }; // children define their OWN two states

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map((entry) => (
    <motion.li key={entry.id} variants={itemVariants} /> /* NO individual timing needed */
  ))}
</motion.ul>
```

> *"With variants, setting delayChildren on a parent will delay child animations by this duration (in seconds)."* … *"Using the stagger function, we can stagger the delay across children."* — [Transitions](https://motion.dev/docs/react-transitions)

> *"stagger works with Motion for React via a variant's delayChildren option."* — [stagger](https://motion.dev/docs/stagger)

So the two forms mean different things, and mixing them up is the commonest cause of "my stagger doesn't stagger":

| Written on the parent variant's `transition` | Effect |
|---|---|
| `delayChildren: 0.5` | **Every** child waits the same 0.5 s, then they all start together |
| `delayChildren: stagger(0.1)` | Child *n* waits `n × 0.1` s — the cascade |

`stagger()` takes a second options argument, all of it documented on the [stagger](https://motion.dev/docs/stagger) page:

| Option | Default | Doc's own words |
|---|---|---|
| `startDelay` | `0` | *"The initial delay from which to calculate subsequent delays."* |
| `from` | `"first"` | *"Specifies which element in the array from which to stagger."* — `"first"`, `"center"`, `"last"` or an index |
| `ease` | `"linear"` | *"By passing an easing function, staggers can be redistributed through the total stagger time."* |

> *"By default, delay will stagger across children from first to last."* — [Transitions](https://motion.dev/docs/react-transitions)

The other orchestration prop is `when`, which sequences the parent against the whole child group:

> *"With variants, describes when an animation should trigger, relative to that of its children."* Default `false`. `"beforeChildren"`: *"Children animations will play after the parent animation finishes."* `"afterChildren"`: *"Parent animations will play after the children animations finish."* — [Transitions](https://motion.dev/docs/react-transitions)

### Propagation: Children Automatically Inherit Parent Variant Changes

When a parent's `animate` prop changes to a new variant name (`animate="visible"` → `animate="exit"`), every child motion component **that defines a variant of that same name** animates to its own corresponding state — without each child needing its own `animate` prop explicitly re-specified.

> *"Variants will flow down through motion components. So in this example when the ul enters the viewport, all of its children with a "visible" variant will also animate in"* — [React animation](https://motion.dev/docs/react-animation)

Note the qualifier the docs put on it — *children with a "visible" variant*. Propagation is a name lookup on each descendant, not a broadcast that forces every child to move. It also survives non-motion elements in between: the gestures doc's own example puts a `motion.path` inside a plain `<svg>` inside a `motion.button` and says *"Variants will flow down through children as normal."* ([React gestures](https://motion.dev/docs/react-gestures)) — the propagation follows the React tree, not the list of direct children.

This propagation is what makes staggered list animations, coordinated multi-element transitions, and nested exit animations all work from a single state change at the top of a tree.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Navigation Menu's Items Cascading Into View, Driven by One Single State Change at the Parent.
A dropdown navigation menu needed its individual menu items to appear in a cascading, staggered sequence when the menu opened — rather than all items appearing simultaneously, or requiring each menu item to be hand-assigned its own specific delay value (fragile, and requiring a code change every time an item was added/removed from the menu). Defining a `container` variant with `delayChildren: stagger(...)` on the parent `<motion.ul>`, and a simple two-state `item` variant on each `<motion.li>`, meant toggling the parent's single `animate` prop between `'hidden'`/`'visible'` automatically cascaded the stagger effect across however many items happened to exist — adding or removing a menu item required zero animation-timing code changes at all.

---

## 3. Production-Grade Code Example

```tsx
// A staggered navigation menu, driven entirely by ONE parent state change
import { motion } from 'motion/react';
import { stagger } from 'motion';

const containerVariants = {
  hidden: {
    opacity: 0,
    // the CLOSE direction needs its own orchestration — see Gotchas
    transition: { when: 'afterChildren', delayChildren: stagger(0.04, { from: 'last' }) },
  },
  visible: {
    opacity: 1,
    transition: { when: 'beforeChildren', delayChildren: stagger(0.08, { startDelay: 0.1 }) },
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
      {items.map((label) => (
        <motion.li key={label} variants={itemVariants}> {/* no individual timing needed at all */}
          {label}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

```tsx
// Propagation crossing a plain, non-motion element — the case the docs' <svg> example proves
const cardVariants = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } };
const badgeVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { delay: 0.2 } } };

function ProductCard({ isVisible }: { isVisible: boolean }) {
  return (
    <motion.div variants={cardVariants} initial="hidden" animate={isVisible ? 'visible' : 'hidden'}>
      <div className="card__body">           {/* plain DOM element, animates nothing itself */}
        <ProductImage />                     {/* not a motion component — never animates */}
        <motion.span variants={badgeVariants}>Sale</motion.span> {/* still inherits 'visible'/'hidden' */}
      </div>
    </motion.div>
  );
}
```

```tsx
// Dynamic variants: one variants object, a different delay per item, resolved from `custom`
const itemVariants = {
  hidden: { opacity: 0 },
  visible: (index: number) => ({ opacity: 1, transition: { delay: index * 0.3 } }),
};

items.map((item, index) => <motion.div key={item.id} custom={index} variants={itemVariants} />);
```

> *"Each variant can be defined as a function that resolves when a variant is made active."* … *"These functions are provided a single argument, which is passed via the custom prop"* — [React animation](https://motion.dev/docs/react-animation)

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Cutting a Child Out of Propagation
```tsx
// The DOCUMENTED opt-out is the `inherit` prop:
//   "Set to false to prevent a component inheriting or propagating changes in a parent variant."
<motion.li variants={itemVariants} inherit={false} animate="visible">Pinned open</motion.li>

// ✅ Normal case: omit `animate` on children that should PROPAGATE — only the
// parent needs `animate`; children just need matching variant keys
<motion.li variants={itemVariants}>Item</motion.li>
```
⚠️ **Whether giving a child its own `animate` prop alone stops it inheriting the parent's changes is not stated in the current motion.dev documentation.** The only documented mechanism for severing inheritance is `inherit={false}`. If you need the guarantee, write `inherit={false}` and do not rely on the side effect.

### ⚠️ Pitfall 2: Mismatched Variant Key Names Between Parent and Child
```tsx
// ❌ The child never animates: the parent resolves 'visible'/'hidden', the child defines
// neither, so the name lookup finds nothing for it — the docs' rule is that
// "all of its children with a 'visible' variant will also animate in"
const parentVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const childVariants = { hide: { opacity: 0 }, shown: { opacity: 1 } }; // MISMATCHED key names

// ✅ CORRECT: use IDENTICAL variant key names across parent and every propagating child
const childVariants2 = { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } };
```
⚠️ The documentation does not state whether Motion warns on an unresolved variant label, so do not promise a reader a console message; the observable behaviour it *does* describe is simply that the child is not part of the group animation.

### ⚠️ Pitfall 3: Putting Orchestration Config on the Wrong Level (Child Instead of Parent)
```tsx
// ❌ WRONG: delayChildren is documented as an option you set "on a parent" to delay
// "child animations" — on a leaf `<motion.li>` with no motion descendants there is
// nothing for it to delay
const itemVariants = { visible: { opacity: 1, transition: { delayChildren: stagger(0.1) } } };

// ✅ CORRECT: delayChildren/when belong on the transition of the PARENT container's variant
const containerVariants = { visible: { transition: { delayChildren: stagger(0.1) } } };
```

### ⚠️ Pitfall 4: Orchestration Written on Only One Direction
```tsx
// ❌ Opens in a cascade, closes all at once — 'hidden' carries no orchestration at all
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: stagger(0.1) } },
};

// ✅ The stagger docs put a delayChildren on BOTH variants, and reverse the origin on close
const containerVariants2 = {
  hidden: { opacity: 0, transition: { delayChildren: stagger(0.01, { from: 'last' }) } },
  visible: { opacity: 1, transition: { delayChildren: stagger(0.1) } },
};
```
Orchestration lives inside the `transition` of **the variant you are animating to**, so it is per-direction. The [stagger](https://motion.dev/docs/stagger) page's own React example defines `delayChildren` separately on its `open` and `close` variants for exactly this reason.

## Gotchas

**★ `staggerChildren` is not in the current documentation — `delayChildren: stagger(n)` is.** Searched across the full 131-page motion.dev doc set, `staggerChildren` appears zero times, in any casing; every current example writes `transition: { delayChildren: stagger(0.1) }`. The upgrade guide's breaking-change lists for 11.0, 12.0 and 13.0 do not mention it, so this is **not** a claim that old code throws — it is a claim that a page teaching `staggerChildren` is teaching an API upstream no longer documents, and that a reader copying it has no doc page to check it against. Write the documented form.

**★ `delayChildren: 0.5` and `delayChildren: stagger(0.5)` are different animations.** A number delays *every* child by the same amount and they then move together; `stagger()` is what turns the single delay into an increasing sequence. Both are legal values of the same key, which is why the mistake is silent — the animation runs, it just is not a cascade.

**★ Orchestration on a leaf variant does nothing.** `delayChildren` is documented as something you set *"on a parent"* to delay *"child animations"*. A `motion.li` at the bottom of the tree has no motion descendants, so the option has nothing to apply to. Nothing fails; the timing you wrote is simply inert.

**★ A child with no `variants` prop is not in the group.** Propagation resolves the parent's label against each descendant's own variants object. A plain `<li>`, or a `motion.li` you forgot to give `variants` to, is skipped — and so is a `motion.li` whose object defines `shown` where the parent said `visible`.

**★ Propagation follows the React tree, not the direct-children list.** The gestures doc's example animates a `motion.path` that sits inside a plain `<svg>` inside a `motion.button`, and states *"Variants will flow down through children as normal."* So wrapping your items in a non-motion layout `<div>` does not break the cascade — but that same wrapper will never animate itself, because only motion components read the label.

**★ `inherit={false}` is the documented way to sever a subtree.** *"Set to false to prevent a component inheriting or propagating changes in a parent variant."* Note the second half — it stops the component **propagating** too, so an `inherit={false}` node also cuts off everything beneath it, not just itself.

**★ The exit direction needs its own orchestration, and usually its own origin.** Orchestration is written inside a variant's `transition`, so it belongs to the state you are animating *to*. A `visible` variant carrying the stagger gives you a cascading open and an instant close. The stagger page's React example sets `delayChildren: stagger(0.01, { from: "last" })` on the closing variant — reversing the origin so the item that arrived last leaves first.

**★ `when: "afterChildren"` is what makes a parent wait for its children.** Default is `false`, meaning parent and children run simultaneously. Fading a container out while its children are still animating out inside it is the standard way to lose the child animation entirely — the children are inside an element that has already reached `opacity: 0`.

**★ For an exit animation, `custom` must go on `AnimatePresence`, not on the leaving child.** *"When a component is removed, there's no longer a chance to update its props (because it's no longer in the React tree). Therefore we can't update its exit animation with the same render that removed the component."* Passing a value through `AnimatePresence`'s `custom` prop is the documented route: *"we can use dynamic variants to change the exit animation."*

**★ `exit` takes a variant label too, so a whole subtree can leave by name.** *"exit can be defined either as an object of values, or as a variant label."* Combined with `when: "afterChildren"` on the exit variant, that is how a modal fades its children out before the shell collapses.

**★ `stagger` is imported from `"motion"`, not from `"motion/react"`, in the docs' own React examples.** The React scramble-text page writes `import { stagger } from "motion"` beside React components. Whether `motion/react` also re-exports `stagger` is **not stated anywhere in the docs** — import it from `"motion"` and you are on documented ground.

**★ `onAnimationComplete` hands you the variant name, not a target object.** *"It's provided a single argument, with the target or variant name of the completed animation."* That makes chaining on a named state easy. ⚠️ The docs do **not** say whether a parent's `onAnimationComplete` waits for propagated child animations, so do not use it as an "everything has finished" signal without checking.

**★ Reduced Motion can silently gut a variant that only moves things.** Setting `reducedMotion="user"` on `MotionConfig` means *"all motion components will automatically disable transform and layout animations"*, *"while preserving the animation of other values like opacity and backgroundColor"* ([Accessibility](https://motion.dev/docs/react-accessibility)). A `hidden`/`visible` pair whose only difference is `x` or `y` therefore becomes a no-op for those users; give the variant an `opacity` component as well so something still reads as a transition.

## Interview questions

**★ Why does orchestration live on the parent instead of on each child?**
Because the stagger is a property of the *group*, not of any member of it. The parent is the only node that knows how many children there are and what order they are in, so it is the only place a delay can be computed as `n × interval` without anybody hardcoding `n`. Push the timing down to the children and you have re-created the fragile thing variants exist to remove: every item carrying a literal delay, and every insertion or removal becoming a code change. The documented mechanism reflects this exactly — `delayChildren` is described as a prop you set *"on a parent"* that delays *"child animations"*.

**★ A list cascades in beautifully and then all items vanish at once. What did you write?**
Orchestration on `visible` only. `delayChildren` sits inside a variant's `transition`, so it applies to the transition *into that variant*. Going back to `hidden` uses `hidden`'s transition, which has none. The fix is a second `delayChildren` on the closing variant — and usually `{ from: "last" }` on the `stagger()` so the exit reverses rather than repeats the entrance order.

**★ How do you stop one subtree inheriting the parent's variant changes?**
`inherit={false}` on the component at the top of that subtree — the documented behaviour is *"Set to false to prevent a component inheriting or propagating changes in a parent variant."* Read the second verb: it also stops that component passing changes further down, so `inherit={false}` fences off the whole subtree, not just the one node. Whether an explicit `animate` prop on a child achieves the same thing on its own is not something the current documentation states, so do not build on it.

**★ What does `delayChildren: stagger(0.1, { from: "center" })` give you that a hand-written per-item delay does not?**
Independence from the item count and the item order. `stagger()` distributes the delay across whatever children exist at the moment the variant activates, and `from` re-bases the distribution — `"first"`, `"center"`, `"last"`, or a specific index — without you recomputing anything. Hand-written delays encode a fixed length and a fixed direction; adding a seventh item to a six-item menu means editing seven numbers, and reversing the animation on close means writing a second set of them.

**★ A modal's backdrop must finish fading in before its content moves. Which prop, and what is the default?**
`when: "beforeChildren"` on the backdrop's variant. The default is `false`, which the docs describe as parent and children starting simultaneously. The mirror-image case — a container that must not collapse until its contents have left — is `when: "afterChildren"`, which is what stops a parent fading out on top of children that are still mid-exit.

**★ Why does a typo in a variant name produce no visible error?**
Because propagation is a name lookup performed per descendant, and a descendant with no matching key is simply not part of that animation. The docs frame it positively — *"all of its children with a "visible" variant will also animate in"* — and the negative case falls straight out of it: no key, no participation. The documentation does not state whether Motion logs a warning for an unresolved label, so the honest debugging advice is to diff the key sets of the parent and the child rather than to go looking in the console.

**★ How do you give every item in a list a different delay computed from its index, without writing a variants object per item?**
Dynamic variants. A variant may be a function — *"Each variant can be defined as a function that resolves when a variant is made active"* — and it receives one argument, supplied by the component's `custom` prop. So one `visible: (index) => ({ opacity: 1, transition: { delay: index * 0.3 } })` covers the whole list, with `custom={index}` on each child. That is the escape hatch for the cases `stagger()`'s linear distribution cannot express — a delay derived from a grid position, a category, or a data value rather than from sequence order.

**★ Why does a dynamic *exit* variant need its `custom` value on `AnimatePresence`?**
Because by the time the exit runs, the child is gone from the React tree and cannot receive a new prop: *"When a component is removed, there's no longer a chance to update its props (because it's no longer in the React tree)."* `AnimatePresence` outlives the child, so it is the component that can still carry the value — which is why the slideshow example passes `direction` through `AnimatePresence custom={direction}` to decide whether the outgoing slide leaves left or right.

**★ Someone hands you a page using `staggerChildren`. Is it wrong?**
It is out of date rather than provably broken, and the distinction is worth stating precisely. `staggerChildren` appears in none of the 131 current motion.dev doc pages, and the upgrade guide's breaking-change lists for 11.0, 12.0 and 13.0 do not mention removing it — so there is no source that says it errors today, and I would not tell a reader their build is broken. What I would say is that the documented API is `transition: { delayChildren: stagger(n) }`, that `stagger()` is where the `from`, `startDelay` and `ease` options live, and that code written against an undocumented option has nowhere to be checked when it next changes.

**★ Can a variant label be used with gestures, or only with `animate`?**
Any of them. The gestures doc states *"All props can be set either as a target of values to animate to, or the name of any variants defined via the variants prop. Variants will flow down through children as normal."* So `whileHover="hover"` on a button drives a `motion.path` inside it to the same named state — which is how you get an icon that reacts to hovering the button rather than hovering the icon, with no state and no event handlers.

---

← [Timing models](../03-transition-types/01-timing-models.md) · [Framer Motion](../README.md) · Next → [Interaction-driven animation](../05-gestures/01-interaction-driven-animation.md)
