---
title: "Lists and key"
sidebar_label: "07 · Lists and key"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. The
> reorder experiment, the DOM-node tracking and every warning string are printed
> by `sandbox/react-p1/ex06-lists-and-keys.mjs`.

**A key is an identity, not an index. It answers one question — "which item
from last render is this one?" — for one sibling list. Get it wrong and nothing
crashes; the wrong data quietly ends up attached to the wrong row.**

## The measurement

Three rows, each containing an **uncontrolled** input. The user types into all
three. Then the last item moves to the front. Same data, same operation, run
twice: once with `key={index}`, once with `key={item.id}`.

Uncontrolled inputs matter here: the typed text lives in the DOM node, so it
moves exactly when React moves the node — nothing is being restored from React
state.

```console
$ node ex06-lists-and-keys.mjs
=== index keys vs stable keys — same data, same reorder (production) ===
  --- key={index} ---
    before: Ada=typed-Ada, Bob=typed-Bob, Cy=typed-Cy
    after:  Cy=typed-Ada, Ada=typed-Bob, Bob=typed-Cy
    DOM node order: li0 li1 li2
    mutations: added=0 removed=0 text=3 attr=9, Row instances created=3
  --- key={item.id} ---
    before: Ada=typed-Ada, Bob=typed-Bob, Cy=typed-Cy
    after:  Cy=typed-Cy, Ada=typed-Ada, Bob=typed-Bob
    DOM node order: li2 li0 li1
    mutations: added=2 removed=2 text=0 attr=6, Row instances created=3
```

Read the `after:` lines. With index keys, Cy's row now holds the text that was
typed into Ada's. **The data followed the position.** With stable keys every
row kept its own text.

Now read the two lines below each. They explain *why*, and they contradict the
usual folklore:

- **`key={index}`** — DOM node order is unchanged (`li0 li1 li2`). React kept
  the three `<li>` elements exactly where they were and **rewrote their text**
  (`text=3`). To React, "the item in slot 0" is still the item in slot 0; only
  its content changed. The input element was never touched, so it kept the
  value the user typed into it — under a different name.
- **`key={item.id}`** — DOM node order is now `li2 li0 li1`. React **moved the
  real DOM nodes** (`added=2 removed=2` are the moves) and rewrote **no text**
  at all.

And the line that surprises everyone:

> **`Row instances created=3` in both cases.**

Index keys did **not** cause a remount. Nothing unmounted, no effect re-ran, no
React state was lost. The damage is subtler than "it remounts": React did the
*minimum* work for the wrong identity assumption. Anything that lives outside
React state — DOM state, focus, scroll position, a CSS transition, a
third-party widget attached to the node — stays with the slot instead of with
the item.

## What a key actually is

- **Scoped to siblings.** Two lists may both use `key="1"`. A key is only
  compared against the other children of the same parent.
- **Not a prop.** It compiles to a separate argument (see
  [page 01](01-jsx-is-a-function-call.md)) and never reaches your component. If
  the component needs the id, pass it twice: `<Row key={id} id={id} />`.
- **Stringified.** `key={1}` and `key={'1'}` are the same key.
- **Compared before position.** Among siblings, React matches by key first; the
  positions are then rearranged to match.

## Where the key goes

On the **outermost element returned by the map callback** — the thing that is
actually a child of the list:

```jsx
{items.map(i => <Row key={i.id} item={i} />)}          // ✓
{items.map(i => <li><Row key={i.id} item={i} /></li>)} // ✗ key is on the wrong node
{items.map(i => <Fragment key={i.id}><dt/><dd/></Fragment>)}  // ✓ keyed fragment
```

The second one silently does nothing useful: the `<li>` children are unkeyed,
and the key sits on a node that has no siblings to be distinguished from.

For a fragment you need the long form — `<>…</>` cannot take a key. It is a
**syntax error**, not a runtime warning:

```console
=== the one thing the shorthand fragment cannot do ===
  const x = <key={d.id}><dt/><dd/></>;
    -> SyntaxError: Unexpected token (1:14)
  const x = <Fragment key={d.id}><dt/><dd/></Fragment>;
    -> const x = _jsxs(Fragment, { children: [_jsx("dt", {}), _jsx("dd", {})] }, d.id);
```

## Choosing a key

| Source | Verdict |
|---|---|
| A database id | ✅ the answer |
| A natural unique field (slug, ISBN, email) | ✅ if it is genuinely unique and stable |
| `crypto.randomUUID()` generated **when the item is created** | ✅ store it on the item |
| The array index | ⚠️ only if the list never reorders, filters or inserts except at the end |
| `Math.random()` / `Date.now()` **during render** | ❌ a new key every render — everything remounts, every time |
| A non-unique field (a name, a status) | ❌ duplicate keys |
| `JSON.stringify(item)` | ❌ changes whenever any field changes |

Index keys are not a sin. They are correct for a static list rendered once, or
an append-only log. They are wrong the moment an item can move — and "can move"
includes sorting, filtering, and deleting from the middle.

## The warnings — and the one that does not appear

```console
  [error] Each child in a list should have a unique "key" prop.

Check the render method of `NoKey`. See https://react.dev/link/warning-keys for
more information.

  [error] Encountered two children with the same key, `x`. Keys should be unique
so that components maintain their identity across updates. Non-unique keys may
cause children to be duplicated and/or omitted — the behavior is unsupported and
could change in a future version.
```

Duplicate keys are the more dangerous of the two: React's own text says children
may be **duplicated or omitted**. A rendered list with a missing row and no
error is usually this.

### 🔴 The warning is deduplicated more aggressively than you think

Seven offending cases were rendered in one page, in two different orders:

```console
=== development build — every key warning React prints ===
    case: no key at all                            -> warned (`NoKey`)
    case: duplicate keys                           -> warned
    case: key on the inner element, none on the outer -> silent
    case: keyed Fragment                           -> silent
    case: static children, no keys                 -> silent
    case: array literal, no keys                   -> silent
    case: two bad lists in one component           -> warned once (`TwoLists`)

=== the same cases in the opposite order — which ones warn now ===
    case: two bad lists in one component           -> warned TWICE
    case: array literal, no keys                   -> silent
    …
    case: no key at all                            -> silent
```

Whichever offending list renders **first** warns; later ones with the same
parent element type stay silent — even in a different component, and even though
the message names a component. When `TwoLists` ran first it warned twice, once
for its `<ul>` and once for its `<ol>`; when it ran last it warned once.

The operational consequence: **the absence of a key warning is not evidence
that your keys are fine.** One offending list anywhere in the page can mask the
rest. Audit `.map(` in review; do not rely on the console.

(Static children never warn — `<ul><li/><li/></ul>` compiles to `jsxs`, which
tells React the array was literal. See [page 01](01-jsx-is-a-function-call.md).)

## Using keys deliberately

A key does not only fix lists. Changing a key is the idiomatic way to say
"this is a different thing now, throw the old one away":

```jsx
<CommentForm key={postId} postId={postId} />
```

Without the key, moving from post 12 to post 13 keeps the half-typed draft from
the previous post. With it, React unmounts and remounts. This is covered again
in Phase 3 with state.

## Gotchas

**Symptom:** after inserting a row at the top, checkboxes are ticked on the
wrong rows — or typed text appears under the wrong name.
**Cause:** `key={index}`. React matched by slot, so DOM state stayed with the
slot. Measured above: `Cy=typed-Ada`.
**Fix:** key by a stable id from the data.

**Symptom:** every row remounts on every render; inputs lose focus mid-typing.
**Cause:** a key generated during render — `Math.random()`, `Date.now()`,
`crypto.randomUUID()` inside the map.
**Fix:** generate the id when the item is created and store it on the item.

**Symptom:** a row silently disappears from a list, no error.
**Cause:** duplicate keys. React's warning says children may be "duplicated
and/or omitted".
**Fix:** make the key unique — compose it if you must: `${type}-${id}`.

**Symptom:** you added keys and the warning stayed.
**Cause:** the key is on an inner element rather than on the array's direct
child.
**Fix:** move it to the outermost element the map callback returns.

**Symptom:** no key warning, but the list misbehaves on reorder.
**Cause:** the warning was suppressed by an earlier offending list with the same
parent tag.
**Fix:** grep for `.map(` and check each one by eye.

**Symptom:** `<>` with a `key` will not compile.
**Cause:** the shorthand fragment accepts no attributes at all.
**Fix:** `<Fragment key={…}>` with `import {Fragment} from 'react'`.

**Symptom:** a CSS enter/leave animation plays on the wrong element after a
sort.
**Cause:** index keys again — React changed text in place rather than moving
nodes, so the animation belongs to the slot.
**Fix:** stable keys, so nodes move.

## Interview questions

**★ What is a `key` and why does React need one?**
An identity for a child within one sibling list, used to match children across
renders. Without it React matches by position, so inserting or reordering
associates the wrong previous state with each item. Keys are scoped to siblings,
are not passed to the component, and are compared before position.

**★ What actually goes wrong with `key={index}`?**
Not a remount — measured, the same three component instances survived. React
keeps each DOM node where it is and rewrites its contents, so anything living
outside React state — the value in an uncontrolled input, focus, scroll
position, an in-flight animation — stays with the slot instead of the item.
With stable keys React moves the DOM nodes instead and rewrites no text.

**★ When is `key={index}` acceptable?**
When the list is never reordered, filtered, or inserted into anywhere but the
end, and items have no state of their own. A static render or an append-only log
qualifies.

**Where must the key be placed in a `.map`?**
On the outermost element returned by the callback — the direct child of the
array. A key on an inner element does nothing.

**Can two lists on the same page use the same keys?**
Yes. Keys are only compared among siblings of the same parent.

**Why can't you put a key on `<>…</>`?**
The shorthand takes no attributes at all — it is a syntax error. Use
`<Fragment key={…}>`.

**What does the duplicate-key warning actually threaten?**
React's own wording: children may be duplicated and/or omitted. It is not
cosmetic — rows can vanish.

**Does a missing-key warning always appear when keys are missing?**
No. Measured: after the first offending list with a given parent tag warns,
later ones — even in other components — stay silent. Absence of the warning
proves nothing.

---

← Prev: [Conditional rendering](06-conditional-rendering.md) · Index: [Phase 1](README.md) · Next → [Fragments](08-fragments.md)
