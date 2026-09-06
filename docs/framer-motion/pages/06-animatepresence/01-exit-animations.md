---
title: "`AnimatePresence`: Exit Animations & Mode Configuration"
sidebar_label: "`AnimatePresence`"
sidebar_position: 1
---

# 🎨 `AnimatePresence`: Exit Animations & Mode Configuration

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

### `mode`: Controlling Overlap Between Outgoing and Incoming Elements
- **`'sync'`** (default) — exiting and entering elements animate **simultaneously**, overlapping in time.
- **`'wait'`** — the exiting element **fully completes** its exit animation before the entering element begins its own enter animation — a strictly sequential, non-overlapping transition (common for page/tab transitions where overlap would look visually confusing).
- **`'popLayout'`** — the exiting element is immediately removed from the **layout flow** (so surrounding elements reflow around it right away) while it continues its own visual exit animation independently, positioned absolutely — useful for list-item removal where you want surrounding items to immediately shift into the vacated space, rather than waiting for the exiting item's animation to finish first.

### Keying Children Correctly
`AnimatePresence` detects additions/removals by tracking each child's **`key`** prop — children without a stable, unique key (or all sharing the same key) can't be correctly tracked as distinct "this one is being removed, this one is new" instances, breaking exit-animation detection entirely.

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

```tsx
// mode="popLayout" — a removed list item exits independently while siblings immediately reflow
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <AnimatePresence mode="popLayout">
      {todos.map((todo) => (
        <motion.li
          key={todo.id} // stable, unique key per item — REQUIRED for correct add/remove detection
          layout // combines with popLayout for smooth reflow of REMAINING items
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          {todo.text}
        </motion.li>
      ))}
    </AnimatePresence>
  );
}
```

```tsx
// mode="sync" (default) — simultaneous, overlapping exit/enter, e.g. a crossfading background image
<AnimatePresence>
  <motion.img key={currentImageUrl} src={currentImageUrl} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
</AnimatePresence>
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

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

### ⚠️ Pitfall 3: Expecting `mode="wait"` for a List, Producing an Awkward One-At-A-Time Removal Feel
```tsx
// ❌ MISMATCHED: mode="wait" makes ANY exit complete before ANY enter begins — applied to a
// LIST (multiple simultaneous items), this can make simultaneous adds/removes feel oddly
// sequential/blocked rather than the natural, independent per-item animation a list usually wants
<AnimatePresence mode="wait">{todos.map((t) => <motion.li key={t.id}>...</motion.li>)}</AnimatePresence>

// ✅ CORRECT: mode="popLayout" (or the default "sync") is typically more appropriate for
// LISTS with multiple independently-animating items; reserve "wait" for singular,
// one-thing-replaces-another transitions (tabs, pages, a single featured image)
```
