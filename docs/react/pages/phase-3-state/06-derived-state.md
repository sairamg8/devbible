---
title: "Derived state"
sidebar_label: "06 · Derived state"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> and [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure).
> No sandbox script backs this page; claims are cited, not measured.

**If you can calculate it, do not store it. The `useEffect`-that-syncs-state
antipattern costs an extra render pass and a visible moment of wrong UI, and it
is probably the single most common unnecessary thing in React codebases.**

## The rule

react.dev states it as an imperative:

> **When something can be calculated from the existing props or state, don't put
> it in state. Instead, calculate it during rendering.**

and lists the reasons:

> This makes your code faster (you avoid the extra "cascading" updates), simpler
> (you remove some code), and less error-prone (you avoid bugs caused by
> different state variables getting out of sync with each other).

The `Choosing the State Structure` recap says the same thing from the other
side:

> Avoid redundant and duplicate state so that you don't need to keep it in sync.

## The antipattern and its cost

```jsx
// 🔴 Avoid: redundant state and unnecessary Effect
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');

  const [fullName, setFullName] = useState('');
  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);
}
```

```jsx
// ✅ Good: calculated during rendering
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  const fullName = firstName + ' ' + lastName;
}
```

The cost of the first version is worth spelling out, because "it works" is the
usual defence. react.dev describes the sequence:

> When you update the state, React will first call your component functions to
> calculate what should be on the screen. Then React will "commit" these changes
> to the DOM, updating the screen. Then React will run your Effects. If your
> Effect *also* immediately updates the state, this restarts the whole process
> from scratch!

So one keystroke produces:

1. Render with the new `firstName` and the **old** `fullName`.
2. Commit that to the DOM — **the wrong value is now on screen**.
3. Run the effect, which sets `fullName`.
4. Render again.
5. Commit again.

Two renders, two commits, and a frame in between showing stale data. On a fast
machine you will not see it; on a slow one, or with a large tree, you will. And
the derived version has none of it: `fullName` cannot be stale, because it is
recomputed from the same values in the same render.

**Deriving is not merely tidier. It removes an entire category of "out of sync"
bug by making the invalid state unrepresentable.**

## What counts as derivable

More than people assume. Anything computable from props, state or context:

```jsx
const fullName    = firstName + ' ' + lastName;
const total       = items.reduce((n, i) => n + i.price, 0);
const visible     = items.filter(i => i.type === filter);
const isValid     = errors.length === 0;
const isEmpty     = items.length === 0;
const selected    = items.find(i => i.id === selectedId) ?? null;
const pageCount   = Math.ceil(total / pageSize);
const hasChanges  = draft !== original;
```

Two of these are worth their own note.

**`selected` is the important one.** Storing the selected *object* is a
duplication bug: when the item is edited, the copy in state is stale. react.dev
puts it in the recap:

> For UI patterns like selection, keep ID or index in state instead of the
> object itself.

Store `selectedId`; derive `selected`. Then editing the item updates the
selection for free, and deleting it makes the selection `null` automatically
rather than leaving a dangling object.

**`isValid` and `isEmpty`** are the ones people store as booleans that drift.
A `hasItems` boolean next to an `items` array is two things that must agree, and
one day they will not.

## Expensive calculations: `useMemo`, not state

If deriving is genuinely costly, the answer is still not state:

```jsx
// 🔴 Avoid
const [visibleTodos, setVisibleTodos] = useState([]);
useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter));
}, [todos, filter]);

// ✅ Good
const visibleTodos = useMemo(() => getFilteredTodos(todos, filter), [todos, filter]);
```

> This tells React that you don't want the inner function to re-run unless either
> `todos` or `filter` have changed.

`useMemo` keeps the value derived — it is still computed from `todos` and
`filter`, and it cannot go stale — while skipping the recomputation. State plus
an effect makes it a second source of truth that merely *usually* agrees.

Two things to keep in proportion:

- **Measure before reaching for it.** Filtering a few hundred items is not
  expensive. `useMemo` on a cheap calculation costs a dependency comparison and
  some readability for nothing.
- **The React Compiler does this automatically.** The docs note it inline:
  *"React Compiler can automatically memoize expensive calculations for you,
  eliminating the need for manual `useMemo` in many cases."* In a compiled
  codebase, deriving plainly is usually the whole answer.

## When storing it *is* correct

Three cases, and recognising them saves you from over-applying the rule.

**A draft.** An editable copy that is *supposed* to diverge from the source
until the user saves or cancels. `draft` is not derived from `record` — it
started there and then became its own thing. The rule against duplication is
about values that must stay equal; these must not.

**A deliberate snapshot.** "The price when you added it to the basket" does not
track the product's current price. Storing it is the requirement.

**Something genuinely not computable.** Which accordion panel is open, what the
user typed, whether a dialog is showing. These have no source to derive from.

react.dev's recap covers the first two in one line:

> Don't put props *into* state unless you specifically want to prevent updates.

"Specifically want to prevent updates" is the test. If you cannot articulate why
this value should stop tracking its source, it should not be in state.

## Resetting and adjusting: the two escape hatches

Sometimes state must *react* to a prop change. Both documented answers avoid
effects.

**Reset everything → `key`.**

```jsx
// 🔴 Avoid
useEffect(() => { setComment(''); }, [userId]);

// ✅ Good
<Profile userId={userId} key={userId} />
```

> This is inefficient because `ProfilePage` and its children will first render
> with the stale value, and then render again.

[Topic 07](07-resetting-state-with-key.md) covers this in full.

**Adjust part of it → set state during render, conditionally.**

```jsx
function List({items}) {
  const [selection, setSelection] = useState(null);
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }
}
```

> `setSelection` is called directly during a render, so React will re-render the
> `List` *immediately* after it exits with a `return` statement. React has not
> rendered the `List` children or updated the DOM yet, so this lets the `List`
> children skip rendering the stale `selection` value.

But the docs immediately push back on their own pattern:

> **However, most components shouldn't need this pattern either.**

and give the version that needs no adjustment at all:

```jsx
// ✅ Best: Calculate everything during rendering
const [selectedId, setSelectedId] = useState(null);
const selection = items.find(item => item.id === selectedId) ?? null;
```

Which is the whole topic in one example: the "adjust state when a prop changes"
problem existed only because the wrong thing was in state.
[Topic 16](16-updating-state-during-render.md) covers the pattern and its rules.

## Gotchas

**Symptom:** a derived value is one render behind.
**Cause:** it is stored in state and synced by an effect, so the first render
after a change shows the old value.
**Fix:** derive it during render. The staleness becomes unrepresentable.

**Symptom:** two state variables disagree.
**Cause:** one is derivable from the other and both are stored.
**Fix:** delete the derived one. If an effect exists to keep them equal, that
effect is the evidence.

**Symptom:** a selected item shows stale data after an edit.
**Cause:** the object was stored, not the id.
**Fix:** store `selectedId`, derive the object. Deletion then yields `null`
automatically instead of a dangling reference.

**Symptom:** a filter re-runs on every keystroke in an unrelated field.
**Cause:** the derivation is genuinely expensive and unmemoized.
**Fix:** `useMemo` — after measuring. Not state plus an effect.

**Symptom:** an effect chain — one effect sets state, which triggers another
effect, which sets more state.
**Cause:** cascading derived state.
**Fix:** derive all of it during render. A chain of effects is almost always one
calculation written as several.

**Symptom:** a form stops reflecting the record it is editing.
**Cause:** this is the draft case and it is correct.
**Fix:** nothing — unless you want it to reset when the record changes, which is
`key`.

## Interview questions

**★ What is the derived-state antipattern and what does it cost?**
Storing a value in state that could be calculated from other state or props, and
keeping it in sync with an effect. It costs an extra render pass — React renders
with the stale value, commits it to the DOM, runs the effect, sets state, and
renders again — so there is a real frame showing wrong data. It also creates two
sources of truth that can disagree.

**★ How do you decide whether something belongs in state?**
Ask whether it can be calculated from what you already have. If yes, calculate it
during render. If it is expensive, `useMemo` it — still derived, just cached. Put
it in state only when it genuinely cannot be computed, or when you specifically
want it to *stop* tracking its source: a draft, or a deliberate snapshot like a
price at time of purchase.

**★ Why store a selected id rather than the selected object?**
Because the object is a duplicate that goes stale the moment the original is
edited, and dangles when it is deleted. With `selectedId` in state and the object
derived by `find`, an edit is reflected automatically and a deletion produces
`null` rather than a reference to something that no longer exists. react.dev
recommends this explicitly.

**When is `useMemo` the right answer instead of deriving plainly?**
When the calculation is genuinely expensive and you have measured it. `useMemo`
keeps the value derived — it still cannot go stale — while skipping recomputation
when the inputs are unchanged. Note that the React Compiler memoizes these
automatically, so in a compiled codebase plain derivation is usually enough.

**What are the two escape hatches when state must react to a prop change?**
`key`, to reset all the state below a component when its identity changes; and
setting state during render inside a condition, to adjust part of it. The docs
present the second reluctantly, saying most components should not need it — and
their own example ends by removing the need entirely by storing an id and
deriving the object.

**How do you spot this antipattern in review?**
Look for a `useEffect` whose body is only `setSomething(...)` with dependencies
that are the inputs to that calculation. That shape is almost always a
derivation, and it can be deleted and replaced by a `const`.

---

← Prev: [Immutable updates](05-immutable-updates/README.md) · Index: [Phase 3](README.md) · Next → [Resetting state with `key`](07-resetting-state-with-key.md)
