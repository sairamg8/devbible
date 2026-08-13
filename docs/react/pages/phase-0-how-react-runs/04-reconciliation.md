---
title: "Reconciliation"
sidebar_label: "04 · Reconciliation"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**, production
> build. The log is printed by `sandbox/react-p0/ex04-reconciliation.mjs`.

**Reconciliation is how React decides which components keep their state and
which are destroyed and rebuilt. It compares the new element tree with the
previous one, position by position, using two rules.**

State loss that looks random is almost always this working exactly as designed.

## The two rules

React's diff would be O(n³) in general — the classic tree-edit-distance problem.
React makes it O(n) by assuming two things:

1. **Different element types produce different trees.** If `type` changes at a
   position, React does not try to match anything inside; it unmounts the whole
   subtree and builds the new one from scratch.
2. **`key` identifies a child across renders.** Among siblings, `key` — not
   order — says "this is the same item as before".

Everything else follows. The unit of comparison is **(position in the tree,
element type, key)**. Match all three and the component instance survives, with
its state, its refs and its effects. Change any one and it is a different
instance.

## Measuring it

The probe renders a `Counter` that keeps a value nobody re-sets, and logs every
mount and unmount. If the value survives, the instance survived.

```jsx
let mounts = 0;
function Counter({label}) {
  const [n, setN] = useState(0);
  const id = useRef(null);
  if (id.current === null) id.current = ++mounts;
  useEffect(() => {
    console.log('Counter MOUNTED   instance #' + id.current);
    return () => console.log('Counter UNMOUNTED instance #' + id.current);
  }, []);
  return <b>{n}</b>;
}
```

```console
$ node ex04-reconciliation.mjs
=== reconciliation — does the component keep its state? ===
       Counter MOUNTED   instance #1 (X)
  set count to 5:
     value now = 5

  A) re-render, same element type <div><Counter/>:
     value survived? value = 5

  B) change the PARENT element type div -> span:
       Counter UNMOUNTED instance #1 (X)
       Counter MOUNTED   instance #2 (X)
     value now = 0

  C) back to div, count to 3, then wrap in <section> (same types, new depth):
       Counter UNMOUNTED instance #2 (X)
       Counter MOUNTED   instance #3 (X)
     value before move = 3
       Counter UNMOUNTED instance #3 (X)
       Counter MOUNTED   instance #4 (X)
     value after move  = 0

  D) same type and position, only the KEY changes:
       Counter UNMOUNTED instance #4 (X)
       Counter MOUNTED   instance #5 (X)
     value with key k1 = 7
       Counter UNMOUNTED instance #5 (X)
       Counter MOUNTED   instance #6 (X)
     value with key k2 = 0

  total Counter instances created: 6
```

Four results, each one a rule:

| Case | Change | State |
|---|---|---|
| **A** | Nothing structural — just a re-render | **Survives** (5) |
| **B** | Parent `<div>` → `<span>` | **Destroyed** (0) |
| **C** | Same types, wrapped in a new `<section>` | **Destroyed** (0) |
| **D** | Same type and position, `key` changed | **Destroyed** (0) |

Case **B** is the one people get wrong: nothing about `Counter` changed. Its
*parent's* type changed, and that discards the entire subtree beneath it.

Case **C** shows position is structural, not visual. Wrapping a component in a
new element moves it to a different depth, which is a different position.

## Using the rules deliberately

### Reset state on purpose with `key`

Case D is a feature. When the identity of the thing being edited changes, you
usually want a clean slate:

```jsx
// Editing a different user should not keep the previous user's draft.
<ProfileEditor key={userId} userId={userId} />
```

Without the `key`, `ProfileEditor` is the same instance and its internal draft
state persists across users — a data-leak-shaped bug. With it, React unmounts
and remounts.

### Do not change types by accident

```jsx
// ✗ Two different types at the same position — state dies on every toggle
{isEditing ? <div><Input /></div> : <span><Input /></span>}

// ✓ One type, different attributes
<div className={isEditing ? 'editing' : 'reading'}><Input /></div>
```

### Do not define components inside components

```jsx
// ✗ New function identity every render => new `type` => remount every time
function Page() {
  function Row({item}) { return <li>{item.name}</li>; }   // redefined each render
  return <ul>{items.map(i => <Row key={i.id} item={i} />)}</ul>;
}
```

`Row` is a *different function object* on every render of `Page`, so `type`
differs, so every row unmounts and remounts on every keystroke — losing focus,
scroll position and any internal state. Move `Row` to module scope.

## Keys among siblings

Keys are scoped to their sibling list. They need to be **stable**, **unique
among siblings**, and **derived from the data** — not from the render.

```jsx
{items.map((item, i) => <Row key={item.id} item={item} />)}   // ✓
{items.map((item, i) => <Row key={i} item={item} />)}         // ✗ if order changes
{items.map((item) => <Row key={Math.random()} item={item} />)} // ✗ never
```

`key={i}` says "the item in slot 0 is the same item as before". Prepend to the
list and every element's state shifts by one — a checked box follows the
position, not the row. `key={Math.random()}` remounts every row on every render.

Index keys are fine when the list is never reordered, filtered, or added to
except at the end. That is a real case; it just is not most cases.

Keys are covered again with lists in Phase 1.

## Gotchas

**Symptom:** a form's input clears whenever an unrelated part of the page
updates.
**Cause:** a component defined inside another component, or a conditional that
swaps element types at that position.
**Fix:** hoist the component to module scope; keep one element type and vary
attributes.

**Symptom:** you toggle a wrapper — adding a `<div>` for layout — and every child
loses state.
**Cause:** case C. Extra nesting is a structural change.
**Fix:** keep the wrapper present in both branches, or accept the remount
knowingly.

**Symptom:** checkboxes tick the wrong row after adding an item to the top of a
list.
**Cause:** `key={index}`. React matched by position, so state stayed with the
slot.
**Fix:** key by a stable id from the data.

**Symptom:** state persists when you expected it to reset — editing user B shows
user A's draft.
**Cause:** same type at the same position, so React reused the instance.
**Fix:** add `key={id}` to force a remount.

**Symptom:** everything remounts on every render and the page feels slow.
**Cause:** a `key` derived from `Math.random()` or `Date.now()`, or an inline
component definition.
**Fix:** stable keys from data; components at module scope.

## Interview questions

**★ What is reconciliation?**
The diff React performs between the newly rendered element tree and the previous
one, to decide the minimum set of DOM operations and which component instances
survive. It is O(n) because it assumes different types mean different trees, and
that `key` identifies children across renders.

**★ Why does React need keys?**
To identify children across renders in a list where position is not identity.
Without keys React matches by index, so inserting or reordering shifts state
onto the wrong items.

**★ What is wrong with using the array index as a key?**
It is only correct if the list never reorders, filters, or receives insertions
anywhere but the end. Otherwise state, focus and DOM identity stay with the
position rather than the item.

**★ What happens if a component's element type changes?**
React unmounts the entire subtree and mounts the new one. All state, refs and
effects below that point are destroyed — even for components that did not
themselves change. Measured above: changing a parent `<div>` to `<span>` reset a
grandchild counter from 5 to 0.

**Why does defining a component inside another component break things?**
The inner function is recreated on every render, so its identity — the element's
`type` — changes every time, and React remounts it on every render.

**How do you deliberately reset a component's state?**
Give it a `key` derived from the identity of what it is editing. When the key
changes, React unmounts the old instance and mounts a fresh one.

---

← Prev: [Render, reconcile, commit](03-render-reconcile-commit.md) · Index: [Phase 0](README.md) · Next → [Fiber](05-fiber.md)
