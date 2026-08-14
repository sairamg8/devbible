---
title: "The array and the index"
sidebar_label: "01 · The array and the index"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
> (*"How does React know which state to return?"*) and
> [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks).
> Error strings are React runtime messages, corroborated across issue threads
> ([facebook/react#14250](https://github.com/facebook/react/issues/14250),
> [vercel/next.js#78396](https://github.com/vercel/next.js/issues/78396)), **not**
> reproduced in a sandbox — no console block appears on this page.
> No sandbox script backs this page; claims are cited, not measured.

**`useState` is never told which state you mean. It has no name, no key and no
identifier — it returns the *next* entry in a per-component array, and advances a
counter. Everything the Rules of Hooks forbid is a way of making that counter land
somewhere different on the second render.**

Once you have this, the rules stop being arbitrary and you can derive each one
yourself, which is the point of the topic.

## The question nobody asks out loud

react.dev asks it directly:

> You might have noticed that the `useState` call **does not receive any information
> about *which* state variable it refers to**. There is no "identifier" that is passed
> to `useState`, so how does it know which of the state variables to return? Does it
> rely on some magic like parsing your functions? **The answer is no.**

```jsx
function Form() {
  const [first, setFirst] = useState('Mary');
  const [last, setLast]   = useState('Poppins');
  // Two identical calls. Nothing distinguishes them but their position.
}
```

`first` and `last` are your variable names, invisible to React. Both calls are
`useState(<string>)`. React returns different pairs to them for exactly one reason:
one was called before the other.

## The mechanism

> Instead, to enable their concise syntax, Hooks **rely on a stable call order on every
> render of the same component.** This works well in practice because if you follow the
> rule above ("only call Hooks at the top level"), Hooks will always be called in the
> same order.

> Internally, **React holds an array of state pairs for every component. It also
> maintains the current pair index, which is set to `0` before rendering. Each time you
> call `useState`, React gives you the next state pair and increments the index.**

Three facts, and everything else follows from them:

1. **Per component** — the array belongs to a component *instance*, not to a function,
   a module or a hook. Two components have two arrays; the same component rendered
   twice in a list has two arrays.
2. **Index reset to 0 before every render** — the pairing is re-established from
   scratch each time, purely by counting.
3. **Next entry, then increment** — no lookup, no key, no name. Position *is* the
   identity.

Rendering `Form` therefore does this:

| Call, in source order | Index before | Array entry it gets | Index after |
|---|---|---|---|
| `useState('Mary')` | 0 | `state[0]` | 1 |
| `useState('Poppins')` | 1 | `state[1]` | 2 |

Render again and the index resets to 0, the same two calls happen in the same order,
and each gets the same entry. The pairing survives because the *count* survived.

## What a conditional hook actually does

Now break the order. This is the canonical bug and it is worth tracing entry by entry
rather than accepting "it breaks":

```jsx
function Profile({ user }) {
  if (user.isLoading) {
    const [spinner, setSpinner] = useState('dots');   // 🔴 conditional
  }
  const [name, setName]   = useState(user.name);
  const [email, setEmail] = useState(user.email);
  // ...
}
```

**First render, `isLoading` is `true`:**

| Call | Index | Gets |
|---|---|---|
| `useState('dots')` | 0 | `state[0]` — the spinner |
| `useState(user.name)` | 1 | `state[1]` — the name |
| `useState(user.email)` | 2 | `state[2]` — the email |

**Second render, `isLoading` is now `false`:**

| Call | Index | Gets | Should have got |
|---|---|---|---|
| `useState(user.name)` | 0 | `state[0]` — **the spinner's state** | `state[1]` |
| `useState(user.email)` | 1 | `state[1]` — **the name's state** | `state[2]` |
| — | — | `state[2]` is orphaned | — |

`name` is now `'dots'`. Not undefined, not an error — the wrong value, of the wrong
concept, with a plausible type. That is the failure mode react.dev names:

> **Calling Hooks inside conditions, loops, or other nested functions breaks this
> mechanism** … when you call `useState` conditionally, **the call order becomes
> unstable between renders, causing React to match the wrong state pairs to the wrong
> variables.**

**Every hook shifts, not just the conditional one.** That is the part people
underestimate: one misplaced `useState` at the top of a component corrupts every hook
below it, including the effects — an effect can end up holding another effect's
dependency array and cleanup function, so it re-subscribes and tears down the wrong
thing.

## The two errors, and which one you get

React detects the length mismatch when it can, and the message differs by direction:

- **Fewer hooks this render than last** — *"Rendered fewer hooks than expected. This
  may be caused by an accidental early return statement."* Thrown when the render
  returns before reaching hooks the previous render reached.
- **More hooks this render than last** — *"Rendered more hooks than during the previous
  render."* This is **minified React error #310**, which is what you will see in a
  production build, with a link to the decoder rather than the sentence.

Two things to take from this rather than the message text:

**The error names the symptom, not the cause.** "An accidental early return statement"
is a good first guess and often wrong. The same message appears when a hook sits inside
an `if`, inside a `.map`, inside a `try` block that threw, or — most confusingly —
inside a child component that the parent called as a function
([Phase 7 · 04 · 03](../04-rules-of-react-beyond-hooks/03-react-calls-components-and-hooks.md)),
in which case the count that changed is the *parent's* and the code you are staring at
is innocent.

**The error is a courtesy, not the protection.** React can only compare *counts*. A
conditional hook that keeps the count the same — swapping one `useState` for another
in an `if`/`else`, or a loop that happens to run the same number of times — produces
no error at all. You get the wrong state, silently, in the shape the previous section
traced. **The absence of the error proves nothing.**

## Why the count is what it is: custom hooks are inlined

Nothing in the mechanism knows about custom hooks. A custom hook is a function call
that happens to call `useState`, and that `useState` takes the next slot **in whatever
component is currently rendering**. So:

```jsx
function useToggle(initial) {
  const [on, setOn] = useState(initial);   // takes a slot in the CALLER
  return [on, () => setOn(v => !v)];
}

function Panel() {
  const [open, toggleOpen] = useToggle(false);  // slot 0
  const [name, setName]    = useState('');      // slot 1
}
```

`Panel`'s array has two entries. `useToggle` owns none of them — it has no array,
because arrays belong to component instances and `useToggle` is not one.

This is the implementation-level statement of
[Phase 7 · 03](../03-share-logic-not-state/README.md): two callers get independent
state because the state was never in the hook, it was in each caller's array. It also
explains why the rules apply *inside* custom hooks with no exception — an early return
in `useToggle` changes `Panel`'s hook count just as surely as one written in `Panel`.

And it explains a consequence worth knowing before you refactor: **adding a hook to a
custom hook changes the slot layout of every component that calls it.** That is fine,
because the layout is rebuilt from zero on every render — but it is why the count must
be a property of the code, not of the data.

## "Unconditional declarations"

react.dev offers a mental model that is worth adopting because it makes the right
thing feel natural rather than restrictive:

> **Hooks are functions, but it's helpful to think of them as unconditional
> declarations about your component's needs.**

`const [name, setName] = useState(...)` reads like a call, but its meaning is closer to
a field declaration: *this component has a piece of state*. A component either has it
or does not — it cannot have it on Tuesdays. Under that reading, "call it
conditionally" is as obviously wrong as declaring a class field inside an `if`, and the
correct restructure (split the component so each variant declares its own needs) is the
obvious move rather than a workaround. That restructure is
[Phase 7 · 09](../09-conditional-hooks.md).

## Gotchas

**Symptom:** a state variable holds a value that belongs to a different state variable.
**Cause:** a hook was skipped or added on a re-render, so every later hook shifted by
one position.
**Fix:** hoist every hook above every conditional and every early return. The wrong
value, not an error, is the normal presentation.

**Symptom:** "Rendered fewer hooks than expected" pointing at a component with no early
return.
**Cause:** the message names the most common cause, not the actual one — a hook in an
`if`, in a `.map`, in a `try`, or a child component called as a function.
**Fix:** count the hooks the render actually reached, including inside custom hooks and
inside anything invoked as a plain function.

**Symptom:** minified error **#310** in production with no readable message.
**Cause:** "Rendered more hooks than during the previous render", minified.
**Fix:** reproduce in development for the full text, then look for a hook that runs
only on some renders.

**Symptom:** no error, but state is subtly wrong after a branch changes.
**Cause:** the hook count stayed the same while the *order* changed — an `if`/`else`
with a hook in each branch.
**Fix:** React only compares counts, so it cannot catch this. The rule, not the runtime,
is the protection.

**Symptom:** an effect tears down the wrong subscription after an unrelated change.
**Cause:** the shift hit the effect slots too; an effect got another effect's deps and
cleanup.
**Fix:** same fix — the corruption is positional and hits every hook below the
misplaced one.

**Symptom:** adding a `useState` inside a shared custom hook breaks a consumer.
**Cause:** it should not — layout is rebuilt each render. If it does, the consumer was
already calling that hook conditionally.
**Fix:** look at the call site, not the hook.

## Interview questions

**★ How does `useState` know which state to return?**
It does not know — nothing identifies the call. React keeps an array of state pairs per
component instance plus a current index that is reset to 0 before each render; every
`useState` returns the next pair and increments the index. Identity is entirely
positional, which is why hooks rely on a stable call order on every render.

**★ Trace what happens when a hook is called conditionally.**
On the render where the condition is true, the conditional hook takes slot 0 and
everything after it shifts up one. On the next render, with the condition false, the
first real hook takes slot 0 — the conditional hook's state — and every hook below it
reads its predecessor's entry. The result is not an exception but the wrong values in
the wrong variables, and the last slot is orphaned. React matches the wrong state pairs
to the wrong variables.

**★ Why does React sometimes throw and sometimes silently misbehave?**
Because it can only compare the *number* of hooks between renders. Fewer than last time
throws "Rendered fewer hooks than expected", more throws "Rendered more hooks than
during the previous render" (minified error #310). A change that preserves the count —
a hook in each branch of an `if`/`else` — passes both checks and corrupts state
silently. The error is a courtesy; the rule is the protection.

**Where does a custom hook's state actually live?**
In the calling component's array. A custom hook is an ordinary function call, so the
`useState` inside it takes the next slot in whichever component is rendering. That is
why two components calling one hook get independent state, and why the Rules of Hooks
apply inside custom hooks with no exception — an early return there changes the
caller's hook count.

**What does "think of hooks as unconditional declarations" buy you?**
It reframes `useState` from a call you might make into a statement about what the
component *has*. Declarations do not happen conditionally, so the correct restructure —
splitting the component so each variant declares its own needs — becomes the obvious
move instead of a workaround for a linter rule.

---

← Index: [Why the rules exist](README.md) ·
Prev: [Rules of React beyond hooks](../04-rules-of-react-beyond-hooks/README.md) ·
Next → [Deriving every forbidden place](02-deriving-the-forbidden-places.md)
