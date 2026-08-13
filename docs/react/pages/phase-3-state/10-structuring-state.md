---
title: "Structuring state"
sidebar_label: "10 · Structuring state"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure).
> No sandbox script backs this page; claims are cited, not measured.

**Five principles that remove most state bugs before they exist. The goal, in
the docs' words, is "to make state easy to update without introducing
mistakes" — which mostly means making the wrong states impossible to
represent.**

## The five principles

Verbatim:

> 1. **Group related state.** If you always update two or more state variables at
>    the same time, consider merging them into a single state variable.
> 2. **Avoid contradictions in state.** When the state is structured in a way that
>    several pieces of state may contradict and "disagree" with each other, you
>    leave room for mistakes. Try to avoid this.
> 3. **Avoid redundant state.** If you can calculate some information from the
>    component's props or its existing state variables during rendering, you
>    should not put that information into that component's state.
> 4. **Avoid duplication in state.** When the same data is duplicated between
>    multiple state variables, or within nested objects, it is difficult to keep
>    them in sync. Reduce duplication when you can.
> 5. **Avoid deeply nested state.** Deeply hierarchical state is not very
>    convenient to update. When possible, prefer to structure state in a flat
>    way.

And the framing, which is the useful part:

> This is similar to how a database engineer might want to "normalize" the
> database structure to reduce the chance of bugs. To paraphrase Albert Einstein,
> **"Make your state as simple as it can be--but no simpler."**

## 1 — Group related state

```jsx
const [x, setX] = useState(0);          // always set together
const [y, setY] = useState(0);

const [position, setPosition] = useState({x: 0, y: 0});   // ✅ one thing
```

The test is in the principle: **do you always update them at the same time?**
Coordinates, a width/height pair, a from/to date range. Grouping those makes the
update atomic and removes the possibility of a render where one has moved and
the other has not.

The inverse matters equally. Fields that change independently should stay
separate — one object holding `name`, `email` and `isSubmitting` forces a spread
on every keystroke and re-renders everything for each of them.

A third case the docs mention: group when you do not know how many pieces there
will be, as with a form whose fields are driven by data.

## 2 — Avoid contradictions

```jsx
const [isSending, setIsSending] = useState(false);      // 🔴 four combinations
const [isSent, setIsSent] = useState(false);            //    two are nonsense
```

`isSending && isSent` is meaningless, and nothing prevents it. One forgotten
setter in one branch produces a UI stuck in an impossible state.

```jsx
const [status, setStatus] = useState('typing');   // ✅ 'typing' | 'sending' | 'sent'
```

Three states, all valid, all reachable, none contradictory. The recap:

> Choose your state variables carefully to avoid creating "impossible" states.

This generalises well beyond booleans, and it is the single highest-leverage of
the five. Two booleans give four combinations; three give eight. A status string
— or a discriminated union in TypeScript, where the compiler then enforces which
fields exist in which state — gives exactly the states that are real.

## 3 — Avoid redundant state

Fully covered in [derived state](06-derived-state.md). The short version:

```jsx
const [fullName, setFullName] = useState('');    // 🔴 derivable
const fullName = firstName + ' ' + lastName;     // ✅
```

The recap adds a boundary worth quoting:

> Don't put props *into* state unless you specifically want to prevent updates.

"Specifically want to prevent updates" is the whole test. A draft that must stop
tracking the record is a legitimate reason; "so I can modify it later" is not.

## 4 — Avoid duplication

```jsx
const [items, setItems] = useState(initialItems);
const [selectedItem, setSelectedItem] = useState(items[0]);   // 🔴 a copy
```

Edit the item in `items` and `selectedItem` still holds the old object. Delete
it and `selectedItem` dangles. The recap gives the fix as a rule:

> For UI patterns like selection, keep ID or index in state instead of the object
> itself.

```jsx
const [selectedId, setSelectedId] = useState(0);
const selectedItem = items.find(item => item.id === selectedId) ?? null;   // ✅
```

Now an edit is reflected automatically and a deletion yields `null` rather than
a stale object. This is duplication and redundancy overlapping — most real cases
are both.

## 5 — Avoid deep nesting

```jsx
// 🔴 updating a leaf means spreading every level above it
{places: [{id: 0, childPlaces: [{id: 1, childPlaces: [...]}]}]}
```

The flat alternative is a lookup table keyed by id — the same **normalisation** a
relational schema uses:

```jsx
{
  0: {id: 0, title: 'Root',   childIds: [1, 42]},
  1: {id: 1, title: 'Africa', childIds: [2, 3]},
  2: {id: 2, title: 'Botswana', childIds: []},
}
```

Updating one node is now a single-level spread:

```jsx
setPlaces({...places, [id]: {...places[id], title: next}});
```

The trade is explicit and worth stating: you gain trivial updates and lose the
ability to read the tree by walking the object — rendering it means following
`childIds` recursively. For deep or frequently-edited trees that is a good
trade; for a two-level structure it is not.

The recap's phrasing keeps it conditional: *"If updating deeply nested state is
complicated, try flattening it."* Flatten in response to pain, not pre-emptively.

## A checklist

Applied to a real piece of state, in order:

1. **Can I calculate this?** → do not store it.
2. **Is this a copy of something else?** → store an id.
3. **Do these always change together?** → group them.
4. **Can these disagree?** → replace the booleans with one status.
5. **Is the update code more than two levels of spread?** → flatten.

The recap in full:

> - If two state variables always update together, consider merging them into one.
> - Choose your state variables carefully to avoid creating "impossible" states.
> - Structure your state in a way that reduces the chances that you'll make a
>   mistake updating it.
> - Avoid redundant and duplicate state so that you don't need to keep it in sync.
> - Don't put props *into* state unless you specifically want to prevent updates.
> - For UI patterns like selection, keep ID or index in state instead of the object
>   itself.
> - If updating deeply nested state is complicated, try flattening it.

## When to reach for `useReducer`

Not one of the five, but it is where the five point. When several fields change
together in a small number of well-defined ways — the status transitions above —
a reducer puts those transitions in one place and names them. The state shape
stops being something every handler can rearrange arbitrarily, and the
"impossible state" problem largely solves itself because only the reducer can
produce a new state.

Phase 5 covers `useReducer` properly. The signal that you want one is not "the
state is big" but "the same combination of updates appears in three handlers".

## Gotchas

**Symptom:** a spinner is stuck on after a successful save.
**Cause:** two booleans that can contradict; one branch forgot to clear one.
**Fix:** one status value.

**Symptom:** an edited item is stale in one part of the UI.
**Cause:** the object was stored in two places.
**Fix:** store the id, derive the object.

**Symptom:** typing in one field re-renders and re-validates every other field.
**Cause:** unrelated fields grouped into one object.
**Fix:** separate them. Grouping is for values that change together.

**Symptom:** an update is four levels of spread and nobody wants to touch it.
**Cause:** deeply nested state.
**Fix:** normalise to a lookup table, or adopt Immer if the shape is fixed
([topic 05](05-immutable-updates/02-arrays-and-tools.md)).

**Symptom:** a selection points at an item that no longer exists.
**Cause:** the object was stored rather than the id.
**Fix:** derive with `find`, which yields `null` when it is gone.

**Symptom:** the same three setters are called together in five handlers.
**Cause:** a transition that has no name.
**Fix:** a reducer.

## Interview questions

**★ What are the principles for structuring state?**
Group state that always changes together; avoid structures where pieces can
contradict each other; do not store what you can calculate; do not duplicate the
same data in two places; and avoid deep nesting. The framing react.dev uses is
database normalisation — the goal is making it easy to update without
introducing mistakes.

**★ What is an "impossible state" and how do you eliminate it?**
A combination the data structure permits but the domain does not — `isSending`
and `isSent` both true. Two booleans give four combinations and only three are
meaningful. Replacing them with a single status value makes the invalid
combination unrepresentable rather than merely avoided, and in TypeScript a
discriminated union lets the compiler enforce it.

**★ Why store a selected id rather than the selected object?**
Because the object is a copy that goes stale when the original is edited and
dangles when it is deleted. Storing the id and deriving the object with `find`
means edits are reflected automatically and deletions yield `null`. react.dev
gives this as a rule for selection patterns specifically.

**When should you group state variables into one object?**
When they always update together — a coordinate pair, a size, a date range — or
when you do not know in advance how many pieces there will be. Grouping fields
that change independently is the mistake in the other direction: it forces a
spread on every update and re-renders everything for each change.

**What is the trade-off of flattening nested state?**
Updates become single-level spreads instead of nested ones, but you lose the
ability to read the structure by walking the object — rendering a tree means
following id references recursively. The docs frame flattening conditionally: do
it if updating the nested version has become complicated, not pre-emptively.

**When does this point at `useReducer`?**
When the same combination of updates keeps appearing in several handlers. A
reducer gives those transitions a name and a single home, and it makes
impossible states much harder to produce because only the reducer can construct
a new state.

---

← Prev: [Lazy initial state](09-lazy-initial-state.md) · Index: [Phase 3](README.md) · Next → [Bailing out](11-bailing-out.md)
