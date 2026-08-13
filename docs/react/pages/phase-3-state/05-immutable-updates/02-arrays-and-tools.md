---
title: "Arrays, and the tools"
sidebar_label: "02 · Arrays and tools"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Updating Arrays in State](https://react.dev/learn/updating-arrays-in-state)
> and [Updating Objects in State](https://react.dev/learn/updating-objects-in-state).
> No sandbox script backs this page; claims are cited, not measured. The ES2023
> array methods are cited to MDN and are noted as such.

**Half of JavaScript's array methods mutate and half return a copy, and nothing
in their names tells you which. That is the entire difficulty.**

## The table

react.dev's own, verbatim:

|  | avoid (mutates the array) | prefer (returns a new array) |
|---|---|---|
| adding | `push`, `unshift` | `concat`, `[...arr]` spread syntax |
| removing | `pop`, `shift`, `splice` | `filter`, `slice` |
| replacing | `splice`, `arr[i] = ...` assignment | `map` |
| sorting | `reverse`, `sort` | copy the array first |

Two traps worth naming out of that table:

**`slice` and `splice` are one letter apart and opposite.** `slice` copies;
`splice` mutates. This is worth over-learning.

**`sort` and `reverse` read like queries.** They are the most commonly mutated
props and state in React codebases, because nothing about `items.sort(byName)`
looks like an assignment.

## The four operations

```jsx
setItems([...items, newItem]);                         // add to end
setItems([newItem, ...items]);                         // add to start
setItems([...items.slice(0, i), newItem, ...items.slice(i)]);   // insert at i

setItems(items.filter(item => item.id !== id));        // remove

setItems(items.map(item =>                             // replace one
  item.id === id ? {...item, done: true} : item
));
```

Note the `map` case: it replaces the *item* with a new object too. Writing
`item.done = true` inside the `map` would mutate the original object — the array
would be new and the item would not, which is the shallow-copy trap from
[chunk 01](01-objects-and-nesting.md) in array form.

For sorting, the docs are explicit that you copy first:

> The JavaScript `reverse()` and `sort()` methods are mutating the original
> array, so you can't use them directly. **However, you can copy the array
> first, and then make changes to it.**
>
> ```js
> const nextList = [...list];
> nextList.reverse();
> setList(nextList);
> ```

Which is the local-mutation exception again: `nextList` is yours, so mutating it
is fine.

## Copying an array is shallow too

The warning that catches people who have already learned the object rule:

> However, **even if you copy an array, you can't mutate existing items *inside*
> of it directly.** This is because copying is shallow--the new array will
> contain the same items as the original one. So if you modify an object inside
> the copied array, you are mutating the existing state.

```jsx
const next = [...items];
next[0].done = true;         // 🔴 same object — mutated the original item
setItems(next);
```

The array is new, so React re-renders and the screen looks right. The item
object was mutated, so previous snapshots changed and any memoized row holding
that item will not update. Half-working, which is the worst kind.

`map` returning a new object for the changed item is the fix, and it is why the
`map` idiom above is written the way it is.

## The ES2023 non-mutating methods

JavaScript added copying counterparts for the four mutating methods —
`toSorted`, `toReversed`, `toSpliced` and `with`. Cited to
[MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted);
react.dev's table predates them and still says "copy the array first".

```jsx
setItems(items.toSorted(byName));          // instead of [...items].sort(byName)
setItems(items.toReversed());
setItems(items.with(i, newItem));          // instead of map with an index check
setItems(items.toSpliced(i, 1));           // instead of filter by index
```

They are supported in current browsers and in Node 20+. Two caveats before
adopting them wholesale: check your target browsers if you support older ones,
and remember they are still **shallow** — `toSorted` gives a new array of the
same item objects, which is correct and is exactly what you want.

`with` is the genuinely useful addition, because replacing by index with `map`
requires an index comparison that reads poorly:

```jsx
items.map((item, idx) => idx === i ? newItem : item);   // before
items.with(i, newItem);                                  // after
```

## `structuredClone` is almost never the answer

It deep-clones, which sounds like exactly what an immutable update needs. It is
usually the wrong tool for three reasons:

- **It copies everything**, including the branches you did not change. Every
  memoized child below the change re-renders, because every object identity
  changed. Structural sharing — keeping untouched branches identical — is the
  property that makes React's comparisons cheap, and a deep clone destroys it.
- **It throws on functions**, and on DOM nodes, and on class instances it does
  not know (`DataCloneError`). State holding a callback or a `File` will crash.
- **It costs time proportional to the whole tree**, on every keystroke.

It is reasonable for a one-off "reset to a deep default" or for snapshotting a
value for undo. It is not an update strategy.

## Choosing a tool

| Situation | Reach for |
|---|---|
| Flat-ish state, one or two levels | **Spread / `map` / `filter`** |
| Replacing by index, sorting, reversing | **`with` / `toSorted` / `toReversed`**, or copy-then-mutate |
| Genuinely nested state you control | **Flatten it** — [structuring state](../10-structuring-state.md) |
| Genuinely nested state you cannot reshape | **Immer** |
| A deep snapshot for undo or reset | `structuredClone`, knowingly |

react.dev's recap ends with the Immer pointer:

> You can use Immer to keep your code concise.

Immer's advantage over a deep clone is exactly the point above: it produces
copies **only along the path you touched**, leaving every other branch
referentially identical. That is what a hand-written nested spread does too — it
is just doing it for you.

One thing to know before adopting it: an Immer `draft` is a Proxy. Logging one
shows a proxy rather than your data (use `current(draft)`), and it must not
escape the producer function — returning the draft, or storing it, leaks a
revoked proxy that throws on next access.

## Does the React Compiler change this?

No, and it is worth being clear because people assume otherwise. The Compiler
memoizes; it does not make mutation safe. Its analysis *depends* on state being
treated immutably, and a component that mutates state is one it will refuse to
compile — which, as in [Phase 2](../../phase-2-components/02-purity/03-strictmode-and-the-compiler.md),
makes the bail-out list a useful place to find these bugs.

## Gotchas

**Symptom:** an item's change shows in some places and not others.
**Cause:** a shallow array copy plus a mutated item object — the array is new,
the item is not.
**Fix:** `map` returning a new object for the changed item.

**Symptom:** a list reorders itself somewhere unrelated.
**Cause:** `sort` or `reverse` called directly on state or a prop.
**Fix:** `[...arr].sort()` or `arr.toSorted()`.

**Symptom:** `splice` was used instead of `slice`.
**Cause:** the names. `slice` copies, `splice` mutates.
**Fix:** `filter` for removal by identity, `toSpliced` for removal by index.

**Symptom:** `DataCloneError: could not be cloned`.
**Cause:** `structuredClone` on state containing a function, a DOM node or an
unsupported class instance.
**Fix:** do not deep-clone state. Copy along the path that changed.

**Symptom:** everything below a change re-renders even though most of it did not
change.
**Cause:** a deep clone gave every object a new identity, defeating every
memoization boundary.
**Fix:** structural sharing — spreads along the path, or Immer.

**Symptom:** an Immer draft logs as a Proxy, or throws when read later.
**Cause:** drafts are proxies and are revoked when the producer returns.
**Fix:** `current(draft)` for logging; never let a draft escape the producer.

## Interview questions

**★ Which array methods are unsafe in React state?**
The mutating ones: `push` and `unshift` for adding, `pop`, `shift` and `splice`
for removing, `splice` and index assignment for replacing, and `sort` and
`reverse`. Their copying counterparts are spread and `concat`, `filter` and
`slice`, `map`, and copy-then-sort — or the ES2023 methods `toSorted`,
`toReversed`, `toSpliced` and `with`. `slice` and `splice` being one letter
apart and opposite is worth over-learning.

**★ Why is copying an array not enough?**
Because the copy is shallow — the new array holds the same item objects. Mutating
one of those items changes the original state and every previous snapshot, while
the new array still triggers a re-render, so the bug half-works. The idiom that
avoids it is `map` returning a *new object* for the item being changed.

**★ Why not just `structuredClone` the state on every update?**
Three reasons. It gives every object in the tree a new identity, so every
memoization boundary below the change re-renders — structural sharing is what
makes React's comparisons cheap. It throws on functions, DOM nodes and unknown
class instances. And it costs time proportional to the whole tree on every
keystroke.

**What does Immer actually do?**
It hands you a Proxy draft, records the writes you make, and produces a new
immutable object that copies only along the paths you touched — leaving every
other branch referentially identical. That is the same result as a hand-written
nested spread, which is why it is a readability tool rather than a semantic
change.

**Do the ES2023 array methods change the advice?**
They make it shorter, not different. `toSorted`, `toReversed`, `toSpliced` and
`with` are copying versions of the mutating four, supported in current browsers
and Node 20+. They are still shallow copies, which is correct — the items should
stay shared unless one of them is what changed.

**Does the React Compiler make mutation safe?**
No. It memoizes on the assumption that state is treated immutably, and it
declines to compile components that break the rules. If anything it makes
mutation easier to *find*, since the list of components it skipped is a static
report of rule violations.

---

← Prev: [Objects and nesting](01-objects-and-nesting.md) ·
Index: [Immutable updates](README.md) ·
Next → [Derived state](../06-derived-state.md)
