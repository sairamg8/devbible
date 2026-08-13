---
title: "State in lists"
sidebar_label: "14 · State in lists"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
> and [Rendering Lists](https://react.dev/learn/rendering-lists). The
> **measured** index-vs-stable-key behaviour is on
> [Phase 1 · Lists and key](../phase-1-jsx/07-lists-and-keys.md), from
> `sandbox/react-p1/ex06`. No sandbox script backs this page; claims are cited.

**A list's keys decide which component instance keeps which state when items
move. Index keys do not remount anything — they leave the state where it was and
attach different data to it, which is why the bug looks like corrupted data
rather than lost state.**

## Position, key, and state

State is preserved by position, and a key becomes part of the position. In a
list, that means the key decides **which rendered item inherits which instance's
state**.

```jsx
{items.map((item, i) => <Row key={i} item={item} />)}        // key = position
{items.map(item => <Row key={item.id} item={item} />)}       // key = identity
```

With `key={i}`, the key of the first row is always `0` — so after any reorder,
the instance at position 0 stays, keeping its state, and simply receives a
different `item`. With `key={item.id}`, React matches instances to items, so
moving an item moves its state with it.

## What actually happens on a reorder

Take three rows, each with a text input the user has typed into, then reverse the
list.

**With `key={item.id}`** — React matches by key, finds every instance still
present, and **moves the DOM nodes**. Each row's typed text travels with its
item, because the instance did.

**With `key={index}`** — React matches key `0` to key `0`. The instance at
position 0 is the same instance it was; only `props.item` changed. So the typed
text **stays with the position** while the data underneath it changes.

That is the part that surprises people, and Phase 1's measurement confirms it:
**index keys do not cause a remount.** No unmount, no state reset, no new DOM
nodes — React keeps the nodes and rewrites their text. The state is not lost; it
is now attached to the wrong item.

The consequences are worse than a reset would be:

- A checked checkbox now belongs to a different row.
- Half-typed text appears under someone else's name.
- An expanded row collapses and a different one opens.
- Nothing errors, and nothing looks obviously broken.

## When index keys are fine

react.dev's guidance is that index keys are acceptable when the list is static.
Concretely, when **all** of these hold:

- Items are never reordered, inserted, or removed from anywhere but the end.
- Items have no state of their own and no uncontrolled DOM state.
- The list is not filtered or sorted.

Static reference tables, a fixed set of tabs, a rendered constant array. If any
of those may change, an index key is a latent bug waiting for the first sort.

There is no performance argument either way worth having — the correctness
argument settles it.

## Choosing a key

**A stable id from the data** is the answer whenever one exists: a database id, a
uuid, a slug.

**Generate the id when the item is created**, not while rendering:

```jsx
{items.map(item => <Row key={crypto.randomUUID()} … />)}   // 🔴 new key every render
```

A fresh key every render means every row unmounts and remounts on every render —
the maximum possible damage, and slower than no keys at all.

```jsx
function addItem(text) {
  setItems([...items, {id: crypto.randomUUID(), text}]);    // ✅ id lives with the item
}
```

**Composite keys** when identity is a combination — `` key={`${row}:${col}`} ``.

**Never `Math.random()`**, for the same reason as above.

**Content as a key** (`key={item.text}`) is workable only if the content is
unique and never edited. Editing the text remounts the row, losing focus
mid-keystroke.

## Keys are scoped to siblings

Keys only need to be unique **among siblings in the same array**, not globally.
Two different lists may both use `key={1}` with no interaction — they are
different parents, so different positions.

This matters when concatenating lists:

```jsx
<>
  {activeItems.map(i => <Row key={i.id} … />)}
  {archivedItems.map(i => <Row key={i.id} … />)}
</>
```

These are two separate arrays, so an id appearing in both is not a conflict —
but moving an item from one list to the other *is* a remount, because it changed
which array it lives in. Where that matters, render one array with a computed
`status` instead of two.

`Children.toArray` handles the collision case for you by rewriting keys with a
nesting-and-position prefix ([Phase 2 · topic 16](../phase-2-components/16-element-manipulation.md)).

## Where the state actually lives matters more

The deeper fix for most list-state bugs is not the key at all: **do not keep
per-item UI state inside the row**.

```jsx
// 🔴 each Row owns whether it is expanded — reorder and it follows the position
function Row({item}) {
  const [expanded, setExpanded] = useState(false);
}

// ✅ the list owns it, keyed by item id
const [expandedId, setExpandedId] = useState(null);
<Row item={item} expanded={expandedId === item.id} onToggle={…} />
```

With the state lifted and keyed by id, reordering cannot corrupt it — there is
no per-position state to attach to the wrong item. This is
[lifting state up](../phase-2-components/05-lifting-state-up/README.md) applied
to lists, and it is why "just fix the keys" is sometimes the shallower answer.

Uncontrolled inputs inside rows are the case where you cannot lift: the DOM owns
the value. There, correct keys are the only defence.

## Gotchas

**Symptom:** after sorting, a checkbox is ticked on the wrong row.
**Cause:** index keys — the state stayed with the position while the data moved.
**Fix:** stable id keys, and preferably lift the state and key it by id.

**Symptom:** typed text jumps to a different row.
**Cause:** the same, with an uncontrolled input.
**Fix:** stable keys. This case cannot be fixed by lifting.

**Symptom:** every row remounts on every render — animations restart, focus is
lost, inputs clear.
**Cause:** a key generated during render, `Math.random()` or an index into a
freshly-mapped array of new objects.
**Fix:** put the id on the item when it is created.

**Symptom:** `Warning: Each child in a list should have a unique "key" prop`,
and it does not appear for every offending list.
**Cause:** React dedupes the warning. Phase 1's measurement found it suppressed
after the first offending list with a given parent tag — **its absence proves
nothing**.
**Fix:** audit lists directly rather than trusting the console.

**Symptom:** duplicate key warning after merging two arrays.
**Cause:** keys are unique among siblings, and merging made them siblings.
**Fix:** namespace them — `` key={`active-${i.id}`} `` — or render one array.

**Symptom:** an item loses its state when moved between two lists.
**Cause:** it changed parent, so it changed position. Keys do not span parents.
**Fix:** one array with a status field, if the state must survive the move.

## Interview questions

**★ What goes wrong with index keys?**
Not what people expect. The rows do not remount — React matches key 0 to key 0,
so the instance and its DOM node stay in place and only the props change. So
per-row state and uncontrolled input values **stay with the position while the
data moves underneath them**: a ticked checkbox ends up on the wrong row, typed
text appears under a different name. Nothing errors, which is why it survives
review.

**★ When are index keys acceptable?**
When the list is genuinely static: never reordered, never filtered or sorted,
items only ever appended at the end, and no per-item state or uncontrolled DOM
state. If any of that could change later, the index key is a latent bug waiting
for the first sort feature.

**★ Why is generating a key during render worse than using an index?**
Because a fresh key every render means React can match nothing — every row
unmounts and remounts on every render. State, focus, scroll and running
animations are destroyed continuously, and it is slower than having no keys at
all. Ids belong on the item, created when the item is created.

**Do keys have to be globally unique?**
No — only among siblings in the same array. Two separate lists can both use the
same ids with no interaction. The corollary is that moving an item between two
arrays is a remount, because it changed parent and therefore changed position.

**What is the deeper fix for per-row state bugs?**
Do not keep per-item UI state in the row. Lift it to the list and key it by item
id — `expandedId === item.id` — so there is no per-position state that can be
attached to the wrong item. Correct keys are still required, but the bug class
disappears. The exception is uncontrolled inputs, where the DOM owns the value
and keys are the only defence.

**Can you trust the missing-key warning?**
Only in one direction. It appears when there is a problem, but Phase 1's
measurement found it deduplicated after the first offending list with a given
parent tag — so its absence is not evidence that the remaining lists are keyed
correctly.

---

← Prev: [The update queue](13-the-update-queue.md) · Index: [Phase 3](README.md) · Next → [Preserving and resetting state](15-preserving-and-resetting.md)
