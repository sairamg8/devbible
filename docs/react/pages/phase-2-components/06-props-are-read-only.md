---
title: "Props are read-only"
sidebar_label: "06 · Props are read-only"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
> and [Keeping Components Pure](https://react.dev/learn/keeping-components-pure).
> No sandbox script backs this page; claims are cited, not measured.

**Props are immutable by contract, not by enforcement. Mutating one usually
works — which is the problem, because it works right up until React skips a
render, and then it does not.**

## The contract

react.dev states it without hedging:

> However, props are **immutable**—a term from computer science meaning
> "unchangeable". When a component needs to change its props (for example, in
> response to a user interaction or new data), it will have to "ask" its parent
> component to pass it *different props*—a new object! Its old props will then be
> cast aside, and eventually the JavaScript engine will reclaim the memory taken
> by them.

and:

> **Don't try to "change props".** When you need to respond to the user input
> (like changing the selected color), you will need to "set state".

Two things follow that are easy to miss:

**"A new object" is literal.** Props are not updated in place. Each render
builds a fresh props object from the JSX, and the old one is garbage. So the
thing you mutated is discarded on the next render anyway — which is why the
symptom is a value that mysteriously reverts.

**Read-only is one level deep, in enforcement terms.** React does not freeze the
objects your props point at. `props.user.name = 'x'` runs happily. The contract
covers it; the runtime does not.

## What "read-only" does and does not stop

```jsx
function Profile({user, tags}) {
  user.name = 'Anon';        // 🔴 mutating a prop's object — runs fine
  tags.push('new');          // 🔴 mutating a prop's array — runs fine
  user = {…user, name: 'x'}; // ⚠️ reassigning the local binding — legal, useless
  return …;
}
```

The third line is worth separating from the first two, because it is the one
that is *not* a bug. Reassigning a destructured parameter changes only a local
variable inside this call. Nothing outside sees it, nothing else is affected,
and it disappears when the function returns. It is confusing to read and usually
signals a value that should have been a `const` with a different name, but it
does not violate anything.

Lines 1 and 2 are the violations, and they violate two rules at once: props are
read-only, and [components must be pure](02-purity/01-the-two-rules.md) — you
have written to an object that existed before the render.

## Why mutating a prop appears to work

This is the part worth understanding properly, because "it works on my machine"
is the entire reason this bug survives code review.

```jsx
function Total({cart}) {
  cart.total = cart.items.reduce((n, i) => n + i.price, 0);   // 🔴
  return <b>{cart.total}</b>;
}
```

On the screen, the number is right. Of course it is — you computed it one line
earlier and rendered it immediately. Nothing has had a chance to go wrong yet.

The failures arrive later, and each is unrecognisable as this bug:

**The parent re-renders and the value vanishes.** The parent passes a fresh
`cart` object; your `total` was never on it. The UI shows `undefined` for one
render and then, if this component runs again, corrects itself. Intermittent.

**A sibling reads `cart.total` and gets `undefined`.** It rendered before
`<Total>` did. Now the bug depends on tree order, which changes when someone
reorders two JSX elements for unrelated reasons.

**A `memo`'d ancestor skips a render.** Your mutation is the only thing that
computed `total`, and it did not run. The value is stale, not missing — the
worst of the three, because nothing looks broken.

**`StrictMode` doubles it.** For `total` that is harmless. For
`cart.items.push(x)` it means two items.

**A concurrent render is abandoned.** The mutation already happened; the render
did not commit. Now the object carries a value from a render that never
appeared, and something else may read it.

Every one of these is the same defect, and none of them points at the line that
caused it.

## What to do instead

**Compute it.** If it derives from props, it is a local `const`. This covers the
large majority of cases:

```jsx
function Total({cart}) {
  const total = cart.items.reduce((n, i) => n + i.price, 0);   // ✅
  return <b>{total}</b>;
}
```

**Copy before transforming.** Array methods split cleanly into the ones that
mutate and the ones that return a new array. Three of the mutating ones are easy
to write by accident on a prop:

```jsx
items.sort(byName)          // 🔴 sorts the prop's array in place
[...items].sort(byName)     // ✅
items.toSorted(byName)      // ✅ ES2023, available on Node 20+ and current browsers

items.reverse()             // 🔴 → [...items].reverse() or items.toReversed()
items.splice(i, 1)          // 🔴 → items.toSpliced(i, 1) or items.filter(…)
```

`sort` is the one that catches experienced people, because it reads like a query
and is in fact a mutation.

**Ask the parent.** If the value must actually change, that is a state update in
whichever component owns it — call the handler it passed you. That is what
[lifting state up](05-lifting-state-up/README.md) is for.

**Copy into state, only for a draft.** A form editing a record is the legitimate
case: the user's in-progress edits are genuinely a different value from the
committed record. That is not duplication, and it has a defined end — save or
cancel. Phase 3 covers the version of this that *is* a bug: an effect that keeps
copying the prop in whenever it changes.

## One-way data flow, and what it buys

Props down, events up. The value of the constraint is that it makes the question
"why is this value wrong?" answerable: **only the owner can have changed it.**
You walk up until you find the `useState`, and the answer is in that component.

Mutating a prop breaks precisely that guarantee. The value can now be changed by
any component that receives it, anywhere in the tree, at any point during a
render — and there is no way to find out which one without reading everything.
The cost is not the bug; it is that the debugging technique stops working.

This is the same reason the React documentation is careful about *how* mutation
looks. `cart.total = …` is one character different from a read, and it is on the
same line as a legitimate calculation. There is no syntax that stands out. Only
the discipline does.

## Gotchas

**Symptom:** a value computed in a child disappears when the parent re-renders.
**Cause:** the child wrote it onto a prop object. The parent then passed a new
object.
**Fix:** compute it as a local `const`. Nothing about it needed to persist.

**Symptom:** a list quietly reorders itself somewhere unrelated.
**Cause:** `props.items.sort(…)` sorted the parent's array in place.
**Fix:** `[...items].sort(…)` or `items.toSorted(…)`.

**Symptom:** duplicate entries appear only in development.
**Cause:** a `push` onto a prop array, doubled by `StrictMode`.
**Fix:** build a new array. The doubling is the detector, not the disease.

**Symptom:** a memoized component shows stale derived data.
**Cause:** the derivation was a mutation performed during a render that got
skipped.
**Fix:** derive during render, every render. A skipped render then produces no
stale value because there is no stored value.

**Symptom:** ESLint says nothing, TypeScript says nothing.
**Cause:** neither checks deep mutability by default. `readonly` in TypeScript
covers reassignment; `ReadonlyArray` and `Readonly<T>` go one level.
**Fix:** if this bites repeatedly, type props with deeply-readonly types, or
`Object.freeze` inputs in development. Neither is common practice — discipline
plus review is what most codebases rely on.

## Interview questions

**★ Are props immutable in React?**
By contract, yes — the documentation says so plainly, and a component that needs
different props must ask its parent for them. By enforcement, no: React does not
freeze props or the objects they reference, so mutation runs without error. That
gap is why the rule has to be learned rather than discovered.

**★ Why does mutating a prop appear to work?**
Because the mutation and the render that reads it happen microseconds apart. It
breaks later, in ways that do not resemble the cause: the value vanishes when
the parent supplies a fresh object, a sibling that rendered first reads
`undefined`, a memoized ancestor skips the render that performed the mutation,
`StrictMode` doubles it, or a concurrent render is abandoned after the mutation
has already happened.

**★ What is the alternative when a child needs a prop to change?**
Nothing about the prop changes. Either the value is derivable, in which case
compute it locally during render, or it is real state, in which case the child
calls a handler and the owner updates its state — producing new props on the
next render. Props down, events up.

**Which array methods are unsafe to call on a prop?**
The mutating ones: `sort`, `reverse`, `splice`, `push`, `pop`, `shift`,
`unshift`, and `fill`. `sort` is the trap, because it reads like a query. Use a
spread copy first, or the ES2023 non-mutating forms — `toSorted`, `toReversed`,
`toSpliced`, `with`.

**Is reassigning a destructured prop parameter a violation?**
No. That changes a local binding inside one call and nothing outside can observe
it. It is confusing to read, and usually means you wanted a differently-named
`const`, but it breaks no rule. The violations are writes *through* a prop to
the object it points at.

**What does one-way data flow actually buy you?**
A working debugging technique. If only the owner can change a value, then "why
is this wrong?" is answered by walking up to the `useState` that owns it.
Mutating props destroys that guarantee — any component in the tree becomes a
candidate — and no amount of tooling gives it back.

---

← Prev: [Lifting state up](05-lifting-state-up/README.md) · Index: [Phase 2](README.md) · Next → [Destructuring and default values](07-destructuring-and-defaults.md)
