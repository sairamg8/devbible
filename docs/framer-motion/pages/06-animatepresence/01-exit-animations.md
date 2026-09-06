---
title: "`AnimatePresence`: Exit Animations, Removal Detection & Keys"
sidebar_label: "`AnimatePresence`"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Motion docs — [AnimatePresence](https://motion.dev/docs/react-animate-presence),
> read from a 131-page raw mirror of motion.dev. Target: **Motion 13.2.0** (`motion`, formerly
> `framer-motion`) on **React 19.2.8** — the React version was probed on the installed package;
> `motion` is not in this checkout's `node_modules`, so every Motion claim here is
> documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 `AnimatePresence`: Exit Animations, Removal Detection & Keys

## 1. Under-The-Hood Mechanics

React unmounts components **synchronously and immediately** — the instant a conditional render's condition becomes false, the component is gone from the DOM, with no built-in mechanism to delay that removal for an exit animation to play out. `AnimatePresence` exists specifically to intercept this.

```
{isVisible && <motion.div exit={{ opacity: 0 }}>...</motion.div>}
        │
        ▼ WITHOUT AnimatePresence: React removes the element from the DOM INSTANTLY — exit prop is IGNORED
        ▼ WITH <AnimatePresence> wrapping it:
                AnimatePresence intercepts the removal, keeps the element MOUNTED just long
                enough to play its exit animation, THEN actually removes it from the DOM
```

### Keying Children Correctly
`AnimatePresence` detects additions/removals by tracking each child's **`key`** prop — children without a stable, unique key (or all sharing the same key) can't be correctly tracked as distinct "this one is being removed, this one is new" instances, breaking exit-animation detection entirely.

`AnimatePresence` also decides *how* an outgoing and an incoming element share the screen, through
its `mode` prop — that is the whole of
[modes: sync, wait and popLayout](01b-modes-sync-wait-poplayout.md). What it can still tell an
element that has already left the React tree is
[presence state and manual removal](01c-presence-state-and-manual-removal.md).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Tab Switcher Needing the Old Tab's Content to Fully Exit Before the New Tab's Content Enters.
A tabbed interface's content panels needed a clean, sequential transition — the old tab's content fading out completely before the new tab's content faded in — rather than both animations overlapping (which looked visually confusing, like two pieces of unrelated content briefly overlapping on screen). Setting `mode="wait"` on the `AnimatePresence` wrapping the tab content produced exactly this: the exiting panel's `exit` animation ran to completion first, and only then did the newly-selected panel begin its own `initial`-to-`animate` transition — a strictly sequential, non-overlapping handoff between tab contents.

---

## 3. Production-Grade Code Example

```tsx
// mode="wait" — sequential exit-then-enter, appropriate for tab/page-style transitions
import { AnimatePresence, motion } from 'motion/react';

function TabContent({ activeTab }: { activeTab: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab} // the KEY is what tells AnimatePresence "this is a DIFFERENT element now"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        {renderTabContent(activeTab)}
      </motion.div>
    </AnimatePresence>
  );
}
```

The other two modes, and the code for each, are in
[the modes chunk](01b-modes-sync-wait-poplayout.md).

---

## Gotchas

### ⚠️ Pitfall 1: Forgetting a Stable, Unique `key` on Children Inside `AnimatePresence`
```tsx
// ❌ WRONG: without a stable key tied to the item's actual identity (not array index, which
// shifts when items are removed), AnimatePresence cannot correctly distinguish "this exact
// item was removed" from "the list just re-rendered with different content at this position"
{todos.map((todo, index) => <motion.li key={index} exit={{...}}>{todo.text}</motion.li>)} // ❌ index as key

// ✅ CORRECT: use the item's own STABLE, unique identifier as the key
{todos.map((todo) => <motion.li key={todo.id} exit={{...}}>{todo.text}</motion.li>)}
```

### ⚠️ Pitfall 2: Nesting Multiple Conditionally-Rendered Elements Directly Inside One `AnimatePresence` Without Keys
```tsx
// ❌ AMBIGUOUS: AnimatePresence needs to track EACH child's identity via key — multiple
// direct children switching in/out without distinct keys can confuse its add/remove detection
<AnimatePresence>
  {showA && <motion.div exit={{opacity:0}}>A</motion.div>}
  {showB && <motion.div exit={{opacity:0}}>B</motion.div>} {/* no distinguishing key between A/B's divs */}
</AnimatePresence>

// ✅ CORRECT: give each conditionally-rendered element its own distinct, stable key
<AnimatePresence>
  {showA && <motion.div key="a" exit={{opacity:0}}>A</motion.div>}
  {showB && <motion.div key="b" exit={{opacity:0}}>B</motion.div>}
</AnimatePresence>
```

### ⚠️ Pitfall 3: The `AnimatePresence` Is Inside the Conditional, So It Unmounts Too
The "`exit` does nothing, no error, no warning" report — and the first thing to check, because it
is invisible in a diff.

> *"Also make sure AnimatePresence is outside of the code that unmounts the element. If AnimatePresence itself unmounts, then it can't control exit animations!"* — [AnimatePresence → Troubleshooting](https://motion.dev/docs/react-animate-presence)

```tsx
// ❌ WRONG: when isVisible flips to false, React removes AnimatePresence in the SAME commit that
// removes the Modal — the component whose only job is to defer that removal is removed first
{isVisible && (
  <AnimatePresence>
    <Modal />
  </AnimatePresence>
)}

// ✅ CORRECT: the conditional lives INSIDE AnimatePresence, which stays mounted across the flip
<AnimatePresence>
  {isVisible && <Modal key="modal" />}
</AnimatePresence>
```

The same rule, one level up, decides where the wrapper goes in a router: an `AnimatePresence`
rendered *by* a page cannot animate that page out, because the router unmounts the wrapper along
with the page. It has to sit in a layout that survives the navigation — which is exactly why the
[page-transition pattern](../15-advanced-patterns/01-production-grade-motion-design.md) puts it in
the root layout and keys on `pathname`.

### ⚠️ Pitfall 4: A `key` That Is Unique but Not *Stable* Across Renders
Uniqueness is only half the requirement. The troubleshooting section asks for both:

> *"Ensure all immediate children get a unique key prop that remains the same for that component every render."* — [AnimatePresence → Troubleshooting](https://motion.dev/docs/react-animate-presence)

```tsx
// ❌ a fresh key on every render: unique, never stable
<motion.div key={Math.random()} exit={{ opacity: 0 }}>{body}</motion.div>
<motion.div key={`${item.id}-${Date.now()}`} exit={{ opacity: 0 }}>{body}</motion.div>
<motion.div key={JSON.stringify(filters)} exit={{ opacity: 0 }}>{body}</motion.div> // rebuilt object

// ✅ derived from the identity of the thing, and nothing else
<motion.div key={item.id} exit={{ opacity: 0 }}>{body}</motion.div>
```

This one does not look like a keying bug from the outside, because it produces *too much*
animation rather than none: the docs note that *"Changing a key prop makes React create an
entirely new component"*, so every parent render remounts the child and `AnimatePresence` dutifully
runs a full exit-then-enter on content that never changed.

## Interview questions

**★ Why is `exit` ignored unless the component sits inside `AnimatePresence`, and what is `AnimatePresence` actually watching?**
By the time an ordinary component learns it is unmounting, React has already committed to removing
its DOM node — there is no frame left in which to animate. `AnimatePresence` sits *above* the
conditional and watches its own direct children: the docs say it *"works by detecting when its
direct children are removed from the React tree"*. When a child disappears from the tree, the
rendered output is kept alive, `exit` runs, and only then does the node go. It recognises three
triggers — a child mounting/unmounting, a child's `key` changing, and children being added to or
removed from a list. Nearly every broken exit animation is one of those three events not being
visible to it: no key, an unstable key, or the wrapper unmounting alongside the child.

**★ Everyone says "never use the array index as a key". When does it genuinely break `AnimatePresence`, and when is it harmless?**
The docs give the precise reason: *"providing index as a key is bad because if the items reorder then
the index will not be matched to the item"*. So the failure needs a change in position — a removal
from anywhere but the end, an insert, a sort. Index 2 was Buy Milk and is now Walk Dog, so
`AnimatePresence` sees "child 2 is still here, its content changed" instead of "child 2 left"; the
exit never runs and the enter never runs, while the last item in the list vanishes without animating
because it is the index that stopped existing. A list that only ever appends and never reorders will
not expose it, which is exactly why it survives review and then breaks the day someone adds a delete
button.

**★ What does changing a `key` do, and why is that the idiomatic slideshow?**
*"Changing a key prop makes React create an entirely new component."* From `AnimatePresence`'s point
of view, one child left and a different child arrived — which is the exit/enter pair a slideshow
wants, without any `isVisible` state to manage. Keying a single `motion.img` on `image.src` is the
whole implementation. It is also why an unstable key is destructive: the same mechanism that gives
you a slideshow for free gives you a remount on every parent render if the key is recomputed.

**★ Where does `AnimatePresence` belong in an app with route transitions, and why is that not negotiable?**
In a layout that outlives the navigation — never inside the page being navigated away from. If the
router unmounts the subtree containing `AnimatePresence`, the wrapper goes at the same moment as its
child and there is nothing left to hold the exiting page in the DOM: *"If AnimatePresence itself
unmounts, then it can't control exit animations!"* In practice that means one wrapper in the root
layout, `mode="wait"` because exactly one page is on screen at a time, and `key={pathname}` so a
navigation reads as a key change.

---

← [Interaction-driven animation](../05-gestures/01-interaction-driven-animation.md) · [Explanations index](../README.md) · Next → [Modes: sync, wait and popLayout](01b-modes-sync-wait-poplayout.md)
