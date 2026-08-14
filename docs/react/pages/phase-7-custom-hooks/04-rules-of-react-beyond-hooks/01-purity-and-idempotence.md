---
title: "Purity and idempotence"
sidebar_label: "01 · Purity and idempotence"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Rules of React](https://react.dev/reference/rules),
> [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure),
> and [`useRef`](https://react.dev/reference/react/useRef) (Strict Mode caveat).
> No sandbox script backs this page; claims are cited, not measured.

**The Rules of Hooks are one of three rule families, and the smallest. This one —
purity — is the rule the other two exist to protect, the rule the Compiler needs in
order to do anything for you, and the only one with no linter that can fully catch
you.**

React states the stakes plainly, and the word "rules" is deliberate:

> They are **rules – and not just guidelines** – in the sense that if they are broken,
> **your app likely has bugs**. Your code also becomes unidiomatic and harder to
> understand and reason about.

And the reason purity in particular is singled out:

> **Purity in Components and Hooks is a key rule of React** that makes your app
> predictable, easy to debug, and **allows React to automatically optimize your code.**

That last clause is not decoration. It is the difference between the Compiler
memoizing your component and skipping it
([Phase 6 · 09](../../phase-6-performance/09-how-the-compiler-bails-out.md)).

## The three rule families

| Family | What it constrains | Enforced by |
|---|---|---|
| **Components and Hooks must be pure** | What your code may *do* while rendering | `eslint-plugin-react-hooks` v7 (partly), `StrictMode` (partly), the Compiler (as a bail-out) |
| **React calls Components and Hooks** | Who is allowed to *invoke* them | The linter, weakly; mostly discipline — [chunk 03](03-react-calls-components-and-hooks.md) |
| **Rules of Hooks** | *Where* a hook call may appear | The linter, reliably — [Phase 7 · 01](../01-the-rules-of-hooks.md) |

The Rules of Hooks get all the attention because they are the ones a tool shouts
about. Purity is the one that quietly costs you correctness, and it is the family this
topic is mostly about.

## What "pure" means here, exactly

react.dev's definition has three parts, and each excludes a different mistake:

> A pure component or hook is one that is:
>
> * **Idempotent** – You always get the same result every time you run it with the
>   same inputs – **props, state, context** for component inputs; and **arguments** for
>   hook inputs.
> * **Has no side effects in render** – Code with side effects should run **separately
>   from rendering**. For example as an event handler – where the user interacts with
>   the UI and causes it to update; or as an Effect – which runs after render.
> * **Does not mutate non-local values**: Components and Hooks should **never modify
>   values that aren't created locally** in render.

Note what counts as an input: **props, state and context** for a component; **the
arguments** for a hook. Anything else you read while rendering — a module variable, the
DOM, `Date.now()`, `Math.random()`, `localStorage`, a mutable ref — is an input React
does not know about, and idempotence is exactly the property it breaks.

## Rule 1 · Idempotent

> Components must always return the **same output with respect to their inputs** –
> props, state, and context. This is known as *idempotency*.

And the sentence people skip, which is where the rule gets teeth:

> This means that **_all_ code that runs during render must also be idempotent** in
> order for this rule to hold.

*All* code — not just the `return`. The helper you call at the top of the component,
the `.map` callback, the default argument, the custom hook three levels down, the
getter on an object you destructured. If any of it is non-idempotent, the component
is not idempotent, no matter how clean the JSX looks.

```jsx
function Message({ text }) {
  const id = Math.random();                  // 🔴 different every render
  const now = new Date().toLocaleTimeString(); // 🔴 different every render
  return <p id={id}>{now}: {text}</p>;
}
```

Both of these look harmless and both are genuine bugs, not style violations. Under
`StrictMode` they produce two different values in development; under SSR they produce
one value on the server and a different one during hydration, which is a hydration
mismatch; and under the Compiler the component becomes unmemoizable, because a
memoized result would be indistinguishable from a stale one.

The fixes are all "move the impurity to where it belongs":

- A stable id for accessibility attributes → [`useId`](../../phase-5-refs-context-reducers/14-useid.md).
- A value that must be generated once → lazy initial state,
  [Phase 3 · 09](../../phase-3-state/09-lazy-initial-state.md).
- A clock → state updated by an effect, so the render itself stays a function of state.

## Rule 2 · Side effects must run outside render

> **Side effects should not run in render**, as React can render components multiple
> times to create the best possible user experience.

The reason is that clause: *React can render components multiple times*. Not "will
occasionally" — it is an architectural fact. `StrictMode` renders twice in development
on purpose, a render can be started and thrown away, a suspended render is retried,
and a transition can render a component at low priority and abandon the result.

A side effect in render therefore does not run "once per update". It runs an unknown
number of times, and if it is a `POST`, that number is the number of duplicate records.

react.dev is careful about the vocabulary, which is worth adopting because the
distinction matters in review:

> Side effects are a **broader term than Effects**. Effects specifically refer to code
> that's wrapped in `useEffect`, while a **side effect is a general term for code that
> has any observable effect other than its primary result of returning a value** to the
> caller.
>
> Side effects are typically written inside of event handlers or Effects. But **never
> during render.**

So the placement question has exactly two answers, and the ordering between them is
the subject of
[Phase 4 · 01](../../phase-4-effects/01-what-an-effect-is-for.md):

| The effect is caused by | It belongs in |
|---|---|
| A specific user interaction | An event handler |
| The component being displayed, whatever caused that | An `useEffect` |
| Nothing — it is just producing the output | Render, and it is not a side effect |

**"It works" is not evidence.** A `fetch` in render works fine on a fast machine with
one render pass. The failure shows up as duplicate requests under `StrictMode`, then
as duplicate writes in production under concurrent rendering, and by then it is three
months from the line that caused it.

## Rule 3 · No mutation of non-local values — and the exception

The third clause is the one with a genuine, explicitly blessed exception, so it is
worth reading closely:

> One common example of a side effect is **mutation**, which in JavaScript refers to
> changing the value of a non-primitive value. In general, while mutation is not
> idiomatic in React, **_local_ mutation is absolutely fine**:

```jsx
function FriendList({ friends }) {
  const items = []; // ✅ Good: locally created
  for (let i = 0; i < friends.length; i++) {
    const friend = friends[i];
    items.push(
      <Friend key={friend.id} friend={friend} />
    ); // ✅ Good: local mutation is okay
  }
  return <section>{items}</section>;
}
```

> Even though it looks like we are mutating `items`, the key point to note is that
> this code only does so **_locally_ – the mutation isn't "remembered" when the
> component is rendered again.**

That last sentence is the whole test, and it is a better test than "am I using
`push`?". Ask: **would a second render see the effect of this mutation?**

- `items` is created fresh at the top of every render, so no. Mutating it is fine.
- A prop, a state object, a module-level array, a `ref.current`, an object from
  context — all of those outlive the render, so yes. Mutating them is not.

This is why the "never mutate" advice people carry around is subtly wrong and makes
React code worse: building an array with `push`, or an object with successive property
assignments, inside a render is idiomatic and costs nothing. What is banned is
mutating something that was not born in this render.

The same test settles the case that confuses everyone —
[immutable state updates](../../phase-3-state/05-immutable-updates/README.md): a draft
copy you created in the event handler is local and may be mutated freely right up
until you hand it to `setState`; the state object you copied it *from* never may be.

## `StrictMode` is the smoke test, not the enforcement

> In Strict Mode, React will **call your component function twice** in order to help
> you find accidental impurities. This is development-only behavior and does not
> affect production. … **If your component function is pure (as it should be), this
> should not affect the behavior.**

Read the last sentence as its contrapositive, which is how to actually use it: *if
double-rendering changes the behaviour, the component is not pure.* That makes
`StrictMode` a detector for exactly the class of bug this page is about — and a cheap
one, because you get it by leaving it switched on.

What it will and will not catch:

| Impurity | Caught by double render? |
|---|---|
| `Math.random()` / `Date.now()` in render | ✅ Usually — two different values |
| A `console.log` counter, or an analytics ping | ✅ Fires twice, visibly |
| Mutating a prop or module variable | ✅ Often — the second pass sees the first pass's damage |
| A `fetch` in render | ✅ Two requests in the network panel |
| Reading `ref.current` in render | ⚠️ Sometimes — see [chunk 04](04-refs-and-the-dom-in-render.md) |
| Writing to `localStorage` in render | 🔴 No — idempotent write, invisible |
| Reading the DOM in render | 🔴 No — it will simply be wrong, quietly |

`StrictMode` is a smoke test with real gaps. It is not a substitute for knowing the
rule. Details of the double invocation, including what is and is not doubled:
[Phase 4 · 05](../../phase-4-effects/05-strictmode-double-invocation.md).

## Gotchas

**Symptom:** a hydration mismatch warning naming a value that "looks fine".
**Cause:** the render is not idempotent — `Date`, `Math.random`, `window`, a counter —
so server and client produce different output from the same inputs.
**Fix:** move the impure value into state, an effect, or `useId`. Render must be a
function of props, state and context only.

**Symptom:** duplicate rows, duplicate analytics events, or two network requests per
interaction in development.
**Cause:** a side effect in render, doubled by `StrictMode`.
**Fix:** move it to an event handler if a specific interaction caused it, or to an
effect if being displayed caused it.

**Symptom:** "it only breaks in production."
**Cause:** the impurity is being hidden by development's simpler scheduling; a
discarded or retried render exposes it.
**Fix:** treat `StrictMode` disagreement as proof, and treat its silence as no evidence
at all.

**Symptom:** a code review rejects `items.push(...)` inside a component.
**Cause:** "never mutate" applied without the locality test.
**Fix:** local mutation is explicitly fine — the docs' own example builds an array with
`push` in render. The question is whether a later render could observe the mutation.

**Symptom:** a component is pure but calls a helper that reads a module-level cache.
**Cause:** *all* code that runs during render must be idempotent, including helpers and
custom hooks.
**Fix:** the rule follows the call stack, not the file. Read shared mutable state
through `useSyncExternalStore`
([Phase 7 · 03](../03-share-logic-not-state/04-external-stores.md)).

**Symptom:** the Compiler memoizes the app but skips a handful of components, with no
error.
**Cause:** it could not prove those components pure, and a bail-out is silent by design.
**Fix:** find the impurity — usually a mutation of something non-local, or a read of a
value that is not props/state/context.

## Interview questions

**★ What does "pure" mean for a React component, precisely?**
Three things. Idempotent: the same inputs — props, state and context for a component,
arguments for a hook — always produce the same output. No side effects during render:
anything observable beyond returning a value belongs in an event handler or an effect.
And no mutation of non-local values: it must not modify anything it did not create
during this render. The rule applies to *all* code that runs during render, not only
the component body.

**★ Why does React insist on this rather than treating it as a style preference?**
Because React reserves the right to call your component multiple times, discard a
render, retry a suspended one, or render at a low priority — so a non-idempotent render
has no defined behaviour. React's own framing is that these are rules and not
guidelines: if they are broken, the app likely has bugs. Purity is also what lets React
optimize automatically; the Compiler can only memoize code whose behaviour it can
prove, and it skips what it cannot, silently.

**★ Is mutation banned in render?**
No — *local* mutation is explicitly fine, and the docs demonstrate it by building an
array with `push` inside a component. The test is whether the mutation would be
remembered on a later render. A local array created this render is invisible to the
next one; a prop, a state object, a context value, a ref or a module variable outlives
the render, so mutating those is the violation.

**★ What is the difference between a side effect and an Effect?**
An Effect is specifically code wrapped in `useEffect`. A side effect is the general
term for any code with an observable effect other than returning a value. Side effects
normally live in event handlers or Effects — never in render. The distinction matters
because "I don't have any effects in this component" is not an answer to "does this
render have side effects".

**How much does `StrictMode` actually protect you?**
It calls component functions twice in development to surface accidental impurities, so
it reliably catches random values, logging, extra fetches and many mutations. It does
not catch idempotent side effects like a `localStorage` write, and it cannot catch a
DOM read that is simply wrong. It is a smoke test whose silence proves nothing.

**A helper function called during render reads a module-level cache. Is the component pure?**
No. All code that runs during render must be idempotent for the component to be, and
the rule follows the call stack rather than the file boundary. Reading mutable module
state during render also risks tearing under concurrent rendering; the supported way to
read an external store is `useSyncExternalStore`.

---

← Index: [Rules of React beyond hooks](README.md) ·
Prev: [Share logic, not state](../03-share-logic-not-state/README.md) ·
Next → [What is immutable, and when](02-immutability.md)
