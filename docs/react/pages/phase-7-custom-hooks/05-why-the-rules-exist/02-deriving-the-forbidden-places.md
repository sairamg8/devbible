---
title: "Deriving every forbidden place"
sidebar_label: "02 · Deriving the forbidden places"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks) (both rules and
> the full ✅/🔴 lists),
> [Invalid hook call warning](https://react.dev/warnings/invalid-hook-call-warning)
> (the three causes), and
> [State: A Component's Memory](https://react.dev/learn/state-a-components-memory).
> No sandbox script backs this page; claims are cited, not measured.

**The six-item forbidden list is not six rules. It is one rule — the index must land in
the same place every render — applied to six places where it cannot.** Here is each
one derived rather than memorised, which is the difference between recalling the list
and recognising a violation you have never seen before.

The list, verbatim:

> * 🔴 Do not call Hooks inside conditions or loops.
> * 🔴 Do not call Hooks **after a conditional `return` statement**.
> * 🔴 Do not call Hooks in event handlers.
> * 🔴 Do not call Hooks in class components.
> * 🔴 Do not call Hooks inside functions passed to `useMemo`, `useReducer`, or
>   `useEffect`.
> * 🔴 Do not call Hooks inside `try`/`catch`/`finally` blocks.

They divide into two groups with two different failure modes, and knowing which group
you are in tells you what will go wrong.

## Group A — the count can change (items 1, 2, 6)

These are all *inside* a render. The hooks do run; the problem is that how many of them
run depends on the data.

**Conditions and loops.** Direct from
[chunk 01](01-the-array-and-the-index.md): the number of calls varies with the
condition or the iteration count, so the index lands differently on the next render and
every hook below shifts. A loop is the worse of the two, because `items.map(item =>
useItemState(item))` looks like ordinary React and silently re-indexes every time the
list length changes — which is every time the data loads.

**After a conditional `return`.** This is the one the ✅ list phrases carefully — *"always
use Hooks at the top level of your React function, **before any early returns**"* — and
it is worth stating why it is listed separately. Syntactically there is no `if` around
the hook; the hook really is at the top level of the function body. The variability is
in the *reachability*:

```jsx
function Profile({ user }) {
  if (!user) return null;             // 🔴 an early return above a hook
  const [tab, setTab] = useState('posts');
  // ...
}
```

When `user` is null the render reaches zero hooks; when it is present it reaches one.
That is the "fewer hooks than expected" case, and the correct shape is to hoist the
hooks above the guard:

```jsx
function Profile({ user }) {
  const [tab, setTab] = useState('posts');   // ✅ every render reaches it
  if (!user) return null;
  // ...
}
```

The cost is a hook that is sometimes unused, which is exactly right: the component
*has* that state either way. This is the "unconditional declarations" reading from
chunk 01, and the larger restructure — split the component so each variant declares its
own needs — is [Phase 7 · 09](../09-conditional-hooks.md).

**`try`/`catch`/`finally`.** The newest entry on the list, and the one people push back
on because "my hook doesn't throw". The mechanism answer does not depend on your hook
throwing: a `try` block is a region whose *completion* is conditional. If anything
inside it throws — a hook, or any line between two hooks — the remaining hooks in the
block are skipped, the index stops early, and control resumes in a `catch` that may
call more hooks, or none. The hook count becomes a function of whether an exception
occurred, which is the least stable input available.

There is a React-specific sharpening of this: rendering legitimately throws as a control
mechanism. A suspended read is a throw, and it is meant to abort this render and be
retried — so a `catch` around hooks can swallow the very signal Suspense depends on (Phase 8
covers what that signal is).
Error handling for render belongs in an **error boundary**, not in a `try` around your
hooks.

```jsx
// 🔴 the hook count now depends on whether something threw
try {
  const data = useData(id);
} catch (e) {
  // ...
}
```

## Group B — there is no index at all (items 3, 4, 5)

These are not "the order might change". These are calls made when **no component is
rendering**, so there is no current component, no array, and no index to advance. The
error is immediate and categorical:

> **Hooks can only be called inside the body of a function component.**

**Event handlers.** A click happens long after the render that created the handler
finished. React is not rendering anything at that moment, so there is no array to take
a slot from. The intent behind the attempt is usually "I need this data only when the
user clicks" — and the answer is that the hook is called during render, its *result* is
used in the handler.

**Class components.** They have no hook array — their state mechanism is `this.state`,
which predates the design entirely.

**Functions passed to `useMemo`, `useReducer` or `useEffect`.** This one surprises
people because the call *looks* like it is inside a component:

```jsx
useEffect(() => {
  const theme = useContext(ThemeContext);   // 🔴 runs after render, not during it
}, []);
```

The arrow function is created during render but **invoked afterwards** — an effect runs
after commit, a reducer runs when an action is dispatched, a `useMemo` factory runs
during render but is not guaranteed to run on any particular render. None of them is
"the body of a function component". Lexical position is not the test; *when the code
runs* is the test.

That is the single most useful reframing on this page: **the rule is about the moment of
execution, not the location in the file.** A hook must be called synchronously, during
the render of a component, in the same order every time. Everything on the list either
breaks the order or misses the moment.

## The second rule, and what it is really for

> Don't call Hooks from regular JavaScript functions. Instead, you can:
> ✅ Call Hooks from React function components.
> ✅ Call Hooks from custom Hooks.

The mechanical reason is Group B — a plain function might be called from anywhere,
including outside a render. But react.dev gives a second, human reason:

> By following this rule, you ensure that **all stateful logic in a component is clearly
> visible from its source code.**

That is the same guarantee the `use` naming convention buys
([Phase 7 · 02](../02-writing-a-custom-hook.md)): if stateful logic could hide in any
plain function, you could not tell by reading a component what makes it re-render.

## When it is not your code: the invalid hook call

The same error has three documented causes, and only one of them is a rules violation:

> 1. **Breaking the Rules of Hooks** — You might be calling Hooks inside loops,
>    conditions, or nested functions instead of at the top level of your React function.
> 2. **Mismatching versions of React and React DOM** — You might be using a version of
>    `react-dom` (< 16.8.0) or `react-native` (< 0.59) that doesn't yet support Hooks.
> 3. **More than one copy of React** — If the `react` import from your application code
>    resolves to a **different module** than the `react` import from inside the
>    `react-dom` package, **Hooks will fail to work.**

Cause 3 is worth understanding rather than pattern-matching, because it is the one that
strikes code that is completely correct. The hook functions you import from `react` do
not hold the state themselves — they forward to whichever renderer is currently
rendering, and that "currently rendering" pointer lives on the `react` module instance.
Two copies of `react` in the module graph means two independent pointers: `react-dom`
sets the one it imported, your component reads the other, finds nothing rendering, and
throws.

Practically, this is what a monorepo with a linked package, two versions of `react` in
`node_modules`, or a library bundling React instead of listing it as a peer dependency
produces. The tell is that it fails **everywhere at once**, including in components that
obviously obey the rules — and `npm ls react` reporting more than one entry settles it.

## Where the linter fits

> You can use the **`eslint-plugin-react-hooks` plugin** to catch these mistakes.

It catches almost all of Group A and most of Group B by static position, which is why
these bugs are rare in a well-configured project — and why they are baffling when they
do occur, because the case that slipped through is by definition one the linter could
not see: a hook reached through a variable, a component called as a function, a hook in
a file the config does not cover. Version 7 of the plugin is in
[Phase 6 · 10](../../phase-6-performance/10-eslint-plugin-react-hooks.md).

One hook is a genuine, designed exception to the top-level rule — `use`, which **may**
be called inside a condition or a loop. That is not a hole in the mechanism; it works
because `use` does not allocate a slot the way `useState` does, and it is
[Phase 7 · 10](../10-use-breaks-the-rule.md).

## Gotchas

**Symptom:** a hook inside `.map` over a list works until the list length changes.
**Cause:** the number of hook calls tracks the data.
**Fix:** render a child component per item and let each own its hooks.

**Symptom:** a guard clause is added at the top of a component and everything breaks.
**Cause:** hooks now sit after a conditional `return`, so some renders reach fewer.
**Fix:** hooks above the guard. An occasionally unused hook is correct.

**Symptom:** `useContext` inside `useEffect` throws "Hooks can only be called inside the
body of a function component".
**Cause:** the callback runs after commit, not during render — lexical position is not
the test.
**Fix:** call the hook in the component body and use the value inside the effect.

**Symptom:** a `try`/`catch` around a hook "works fine".
**Cause:** nothing has thrown yet. The count is conditional on an exception that has not
happened, and a suspended read will throw one.
**Fix:** error boundaries for render errors; keep hooks out of `try` blocks.

**Symptom:** the invalid hook call error appears in every component at once, including
trivial ones.
**Cause:** almost certainly two copies of React, not a rules violation.
**Fix:** `npm ls react`; deduplicate, and make React a peer dependency of any library
that renders.

**Symptom:** a hook is called from a plain helper and nothing complains in tests.
**Cause:** the helper happened to be invoked during a render.
**Fix:** it is a latent failure. Rename it `useX` if it is a hook, or remove the hook
call if it is not.

## Interview questions

**★ Walk through the forbidden list and explain each from the mechanism.**
Two groups. Conditions, loops and code after a conditional `return` all let the number
of hooks reached vary between renders, so the index lands differently and every hook
below shifts. `try`/`catch`/`finally` is the same problem via an exception: if anything
in the block throws, the remaining hooks are skipped and the count depends on whether
something failed. Event handlers, class components and callbacks passed to `useMemo`,
`useReducer` or `useEffect` are a different failure — they run when no component is
rendering, so there is no array and no index at all, and the call throws immediately.

**★ Why is "after a conditional return" listed separately from "inside a condition"?**
Because syntactically the hook *is* at the top level of the function — there is no `if`
wrapped around it. What varies is reachability, not nesting. It is the most common way
the rule is broken by accident, usually by adding a guard clause to a component that
already had hooks, and it produces "Rendered fewer hooks than expected".

**★ Why can't you call a hook inside a `useEffect` callback? It's inside the component.**
Lexically, yes; that is not the test. The callback is created during render and invoked
after commit, when no component is rendering, so there is no hook array to take a slot
from. The rule is about the moment of execution, not the position in the file. Call the
hook in the component body and use its value inside the effect.

**★ Why were `try`/`catch`/`finally` added to the list?**
Because a `try` block's completion is conditional: if anything inside throws, the
remaining hooks are skipped, so the hook count becomes a function of whether an
exception occurred. React also throws during render as a control mechanism — a
suspended read is a throw meant to abort and retry — so a `catch` around hooks can
swallow it. Render errors belong to error boundaries.

**The invalid hook call error fires in every component at once. What do you check
first?**
Not the code. The docs list three causes, and only one is a rules violation; a
project-wide failure points at the other two. Check for more than one copy of React —
if the `react` import in your app resolves to a different module than the one inside
`react-dom`, hooks fail everywhere — and check that `react-dom` is new enough to support
hooks at all.

**If the linter catches almost everything, why learn the mechanism?**
Because the cases it misses are exactly the ones that reach production: a component
called as a plain function, a hook reached through a variable, files outside the lint
config, or a duplicate React. When the linter is silent and the app throws, the
mechanism is the only thing that tells you where to look — and React's own runtime check
compares hook *counts* only, so an order change that preserves the count is caught by
neither.

---

← Prev: [The array and the index](01-the-array-and-the-index.md) ·
Index: [Why the rules exist](README.md) ·
Next → [Designing a hook's API](../06-designing-a-hooks-api/README.md)
