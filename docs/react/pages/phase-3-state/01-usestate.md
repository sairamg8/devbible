---
title: "useState"
sidebar_label: "01 · useState"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`useState`](https://react.dev/reference/react/useState),
> [State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
> and [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state).
> No sandbox script backs this page; claims are cited, not measured.

**State does not belong to a variable. It belongs to a *position in the render
tree*, and React finds it by counting hook calls. Every rule about hooks follows
from that one implementation detail.**

## The pair

```jsx
const [count, setCount] = useState(0);
```

Two values out of one call: the current value for **this render**, and a
function that requests a new one for the **next** render. The array destructuring
is convention — `useState` returns an array specifically so you can name both
halves whatever you like, which an object could not do as cleanly.

The naming convention is universal enough to be worth following without thought:
`const [thing, setThing]`. Deviating from it makes a component harder to read
for no gain.

## Where the value actually lives

Not in your component. react.dev's phrasing:

> React stores state outside of your component, as if on a shelf.

Your function runs, calls `useState`, and React hands back whatever is on the
shelf for that component instance. The local `const` is a copy that lives for
exactly one render and is then discarded. That is why:

- Reassigning it does nothing — `count = 5` changes a local binding React never
  reads.
- The setter is required — it is the only channel to the shelf.
- The value is stable *within* a render, however many times you call the setter
  ([topic 02](02-state-is-a-snapshot.md)).

## How React finds the right value: call order

There is no name. `useState('')` does not register "the name field" — React has
no idea what you called the variable. It matches state to a **slot in a list**,
attached to the component's position in the tree, by the order the hooks were
called in during that render.

```jsx
function Form() {
  const [name, setName]   = useState('');    // slot 0
  const [email, setEmail] = useState('');    // slot 1
  const [age, setAge]     = useState(0);     // slot 2
}
```

Slot 0, 1, 2 — every render, in that order. Which is the entire reason for the
rule the docs state as a caveat:

> `useState` is a Hook, so you can only call it **at the top level of your
> component** or your own Hooks. You can't call it inside loops or conditions.
> If you need that, extract a new component and move the state into it.

Break it and the slots shift:

```jsx
function Form({showEmail}) {
  const [name, setName] = useState('');            // slot 0
  if (showEmail) {
    const [email, setEmail] = useState('');        // 🔴 slot 1 — sometimes
  }
  const [age, setAge] = useState(0);               // slot 1 or 2, depending
}
```

When `showEmail` flips to `false`, `age` starts reading slot 1 — the email
string. The error React raises (`Rendered fewer hooks than expected`) names the
count, not the cause, and if the types happen to line up you may get no error at
all, just wrong values.

The docs' own remedy is the important half of the rule: **if you need
conditional state, extract a component.** A component boundary creates a new
slot list, so the state can legitimately come and go with the component.

## State belongs to a position, not to a component

The subtler half, and the one that explains a whole class of "why did my state
survive / vanish" questions.

> React preserves a component's state for as long as it's being rendered at its
> position in the UI tree.

So state is keyed by *where the component is*, not by which component it is:

```jsx
{isFancy ? <Counter isFancy /> : <Counter />}    // same position → state kept
{isPaused ? <p>Paused</p> : <Counter />}          // type changed  → state lost
```

Two `<Counter />` elements at two different positions have two independent
counts, even though they are the same component. One `<Counter />` whose props
change entirely keeps its count, because its position did not change. This is
the same reconciliation rule that makes
[the nesting bug](../phase-2-components/01-function-components/02-identity-and-nesting.md)
so destructive, and it is what [`key`](07-resetting-state-with-key.md) lets you
control deliberately.

## The initial value is only initial

```jsx
function Field({defaultValue}) {
  const [value, setValue] = useState(defaultValue);   // read ONCE
}
```

`useState`'s argument is used on the **first render at that position** and
ignored on every subsequent one. Passing a new `defaultValue` later changes
nothing, and this is one of the most common sources of "the prop updated but the
UI did not".

It is not a bug and there is no flag to change it. The three real options:

| You want | Do |
|---|---|
| The value to follow the prop | Don't put it in state — use the prop ([topic 06](06-derived-state.md)) |
| A fresh start when the record changes | `key` ([topic 07](07-resetting-state-with-key.md)) |
| A draft that starts from the prop and then diverges | State, deliberately — and accept that it will not follow |

The third is legitimate and common: an edit form whose contents are *supposed*
to stop tracking the record once the user starts typing.

If computing the initial value is expensive, pass a function instead of a value
— [lazy initial state](09-lazy-initial-state.md), which is a different topic
because the failure mode is subtle.

## `StrictMode` calls your initialiser twice

> In Strict Mode, React will **call your initializer function twice** in order to
> help you find accidental impurities. This is development-only behavior and does
> not affect production. If your initializer function is pure (as it should be),
> this should not affect the behavior. The result from one of the calls will be
> ignored.

The same applies to updater functions. Both are "calculating the UI", so both
are held to the purity rule from
[Phase 2](../phase-2-components/02-purity/README.md) — an initialiser that
increments a counter or pushes to a log is a bug that `StrictMode` is designed
to expose.

## One state variable or several?

The default is **several**, one per independently-changing value. React does not
charge you for extra `useState` calls, and separate variables give you smaller,
more obvious updates.

Group them when they always change together — a `{x, y}` position, a
`{width, height}` size. [Structuring state](10-structuring-state.md) has the
five principles in full; the short version is that grouping is about *values
that move together*, not about tidiness.

The one thing to avoid is the middle ground: a single object holding several
unrelated fields, which forces a spread on every update and re-renders every
consumer for every change.

## Gotchas

**Symptom:** the value logged right after `setCount` is the old one.
**Cause:** not a bug — the set function only affects the next render.
**Fix:** [topic 02](02-state-is-a-snapshot.md). If you need the new value in the
same handler, compute it into a local `const` and use that.

**Symptom:** `Rendered fewer hooks than expected than during the previous render`.
**Cause:** a hook inside a condition, loop, or early return.
**Fix:** move it to the top level. If the state genuinely should come and go,
extract a component — that is the documented remedy, not a workaround.

**Symptom:** a prop changes but the state initialised from it does not.
**Cause:** the initial value is read once, at the first render in that position.
**Fix:** derive it instead of storing it, or remount with `key`.

**Symptom:** two components share a value they should not, or fail to share one
they should.
**Cause:** state is per position — two elements are two instances; one element
whose props changed is still one instance.
**Fix:** `key` to force separation; [lifting](../phase-2-components/05-lifting-state-up/README.md)
to force sharing.

**Symptom:** state resets whenever an unrelated sibling updates.
**Cause:** the component's *type* is changing between renders — a component
defined inside another component.
**Fix:** module top level. Phase 2, topic 01.

**Symptom:** assigning to the state variable has no effect.
**Cause:** it is a local `const` copy of a value React holds elsewhere.
**Fix:** the setter is the only channel.

## Interview questions

**★ How does React know which `useState` call corresponds to which state?**
By call order. There is no name or key — React keeps a list of state slots
attached to the component's position in the tree and matches them positionally
on every render. That is the entire reason hooks must be called unconditionally
at the top level: a hook inside an `if` shifts every subsequent slot when the
condition flips.

**★ Where does state actually live?**
Outside the component — react.dev describes React as storing it "as if on a
shelf", keyed by the component's position in the render tree. The variable you
destructure is a per-render copy, which is why reassigning it does nothing and
why the setter is the only way to change anything.

**★ Why does state survive when props change, but reset when you render a
different component in the same place?**
Because state is tied to a position plus a component type, not to the JSX. The
same type at the same position keeps its state however much the props change; a
different type at that position tears the subtree down and rebuilds it. `key`
participates as part of the position, which is how you reset deliberately.

**Why is `useState`'s argument ignored after the first render?**
Because it is the *initial* state — React reads it once when the state slot is
created at that position and never again. A prop passed as the initial value
will not track later changes; if you need that, derive the value instead of
storing it, or remount with `key`.

**When would you use one state object instead of several variables?**
When the fields always change together — a coordinate pair, a size. Separate
variables are the default because they make updates smaller and more obvious.
The bad middle ground is one object holding several unrelated fields, which
forces a spread on every update and re-renders everything for every change.

**Why does StrictMode call the initialiser twice?**
Because the initialiser is part of calculating the UI, so it must be pure. Two
calls to a pure function produce the same value and change nothing; if the
second call changes something observable, the initialiser has a side effect.
React discards one of the two results.

---

← Index: [Phase 3](README.md) · Next → [State is a snapshot](02-state-is-a-snapshot.md)
