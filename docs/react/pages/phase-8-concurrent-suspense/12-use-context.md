---
title: "use(context)"
sidebar_label: "12 · use(context)"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`use`](https://react.dev/reference/react/use) (parameters, caveats, and the context
> section) and
> [`useContext`](https://react.dev/reference/react/useContext).
> No sandbox script backs this page; claims are cited, not measured.

**`use(Context)` reads context, and unlike `useContext` it may be called inside a
condition, a loop, or after an early return. That is a documented exception to the Rules
of Hooks — and the interesting question is not how to use it but when the exception is
worth taking.**

## The API

> `use` is a React API that lets you read the value of a Promise or **context**.

> `context`: A context created with `createContext`.

```jsx
import { use } from 'react';

function Button() {
  const theme = use(ThemeContext);
  // ...
}
```

> `use` returns the context value for the passed context, determined by the **closest
> context provider above** the calling component. If there is no provider, the returned
> value is the **`defaultValue`** passed to `createContext`.

Identical lookup semantics to `useContext` — the closest provider wins, the default value
is the fallback. Nothing about *what* it reads has changed
([Phase 5 · 04](../phase-5-refs-context-reducers/04-createcontext-usecontext.md) and
[Phase 5 · 13](../phase-5-refs-context-reducers/13-default-context-value.md) still apply
in full).

## The exception

> **Unlike Hooks, `use` CAN be called within loops and conditional statements** like `if`
> and `for`.

> **Unlike `useContext`, `use` can be called within loops and conditional statements like
> `if`.**

```jsx
function HorizontalRule({ show }) {
  if (show) {
    const theme = use(ThemeContext);   // ✅ legal, and useContext here is not
    return <hr className={theme} />;
  }
  return false;
}
```

**Why it is safe** is [Phase 7 · 10](../phase-7-custom-hooks/10-use-breaks-the-rule.md),
and the short version bears repeating because it is what stops the exception being
generalised: context is found by **walking up the tree to the closest provider**, so the
lookup does not depend on how many `use` calls preceded it. `useState` is handed no
identifier at all and must be identified by position, which is why *it* cannot move. The
exemption is a property of the API, not a permission you can extend.

## Where it genuinely helps

Three cases, and they are narrower than the freedom suggests.

**1. A read that only applies on one branch.** A component that renders a themed variant
and an unthemed one should not subscribe to the theme in the second case. With
`useContext` the read is unconditional whether or not the branch uses it.

**2. A read after an early return.** The guard-clause problem from
[Phase 7 · 09](../phase-7-custom-hooks/09-conditional-hooks.md) disappears for this one
API — you can put the guard first and read context after it, without restructuring the
component.

```jsx
function Row({ item }) {
  if (!item) return null;
  const theme = use(ThemeContext);   // ✅ after a conditional return
  return <li className={theme}>{item.label}</li>;
}
```

**3. A read inside a loop over contexts.** Rare, and mostly appears in libraries that
compose a set of contexts dynamically.

## 🔴 Why not use it everywhere

The temptation is to replace every `useContext` and stop thinking about hook rules. That
trade is worse than it looks, for the reason
[Phase 7 · 06](../phase-7-custom-hooks/06-designing-a-hooks-api/README.md) gives about
constraint:

- **Top-level reads are readable.** A block of hook calls at the top of a component is an
  inventory of everything that can make it re-render. Once reads are scattered through
  branches, answering "what does this component subscribe to?" means reading every path.
- **The linter's coverage shrinks.** `useContext` is subject to the Rules of Hooks and the
  exhaustive-deps machinery around them; `use` deliberately is not. You are opting out of
  a check to gain a freedom you usually do not need.
- **Consistency is worth more than micro-optimisation.** Skipping a context subscription
  on one branch rarely matters — context reads are cheap; it is the *provider's* value
  changing that causes re-renders
  ([Phase 5 · 05](../phase-5-refs-context-reducers/05-context-re-render-problem.md)), and
  that is unaffected by how you read it.

**The default stays `useContext` at the top level. Reach for `use` when the condition is
real.**

## What it does not change

- **Re-render behaviour is identical.** Every consumer of a context re-renders when the
  provider's value changes, whichever API read it. `use` is not a selector and does not
  subscribe to part of a value.
- **The provider rules are unchanged.** Memoize the value, split contexts by update
  frequency, prefer a reader hook as the public API — all of
  [Phase 7 · 03 · 03](../phase-7-custom-hooks/03-share-logic-not-state/03-when-you-wanted-shared-state.md)
  still holds.
- **`use` must still be called inside a Component or a Hook.** The exception covers *where
  in the body*, not *what may call it*. Event handlers and plain functions are still out.

## The Server Component restriction

> **Reading context with `use` is not supported in Server Components.**

Worth knowing before you reach for it in a codebase with an RSC boundary: the promise form
of `use` is the one that belongs on the server, and context is a client concern. A shared
component that must work on both sides cannot read context with `use` — pass the value as
a prop instead. Phase 10 covers what crosses the boundary.

## And still no `try`/`catch`

> `use` **cannot be called inside a try-catch block.** Instead, wrap your component in an
> **Error Boundary** to catch errors.

This applies to the context form as well as the promise form, even though a context read
does not suspend. Take it as a property of the API rather than of the resource.

## Gotchas

**Symptom:** `useContext` is moved inside an `if` and the app breaks.
**Cause:** the exception belongs to `use`, not to `useContext`.
**Fix:** use `use`, or restructure. The two are not interchangeable in that position.

**Symptom:** every `useContext` is replaced with `use` and nobody can tell what a
component subscribes to.
**Cause:** the freedom was taken as a default rather than for a real condition.
**Fix:** top-level `useContext` remains the default; scattered reads cost readability and
lint coverage.

**Symptom:** conditional reads were adopted to reduce re-renders, and nothing improved.
**Cause:** consumers re-render when the provider's value changes regardless of how the
read is written; `use` is not a selector.
**Fix:** memoize the provider value and split contexts by update frequency.

**Symptom:** `use(SomeContext)` fails in a Server Component.
**Cause:** reading context with `use` is not supported there.
**Fix:** pass the value as a prop, or read it in a Client Component.

**Symptom:** `use(Context)` in an event handler throws.
**Cause:** the exception covers where in the body, not what may call it — it must still be
inside a Component or Hook.
**Fix:** read it during render and close over the value.

**Symptom:** a missing provider yields `undefined` rather than an error.
**Cause:** with no provider, the `defaultValue` from `createContext` is returned — the
same as `useContext`.
**Fix:** throw from a reader hook, or supply a real default deliberately.

## Interview questions

**★ How does `use(Context)` differ from `useContext`?**
Only in where it may be called. Both return the value from the closest provider above, and
both fall back to the `defaultValue` passed to `createContext`. But `use` may be called
inside conditions and loops, and after an early return, while `useContext` must be at the
top level. Re-render behaviour, provider semantics and the lack of any selector are
identical.

**★ Why is the exception safe for `use` and not for `useState`?**
Because context is found by walking up the tree to the closest provider, so the lookup does
not depend on how many calls preceded it. `useState` receives no identifier and is
identified purely by its position in the component's hook list, so its position cannot
vary. The exemption is a property of the API rather than a permission that extends to other
hooks.

**★ Should you replace `useContext` with `use` everywhere?**
No. Top-level reads make a component's subscriptions readable at a glance, and scattering
them through branches means reading every path to answer what makes the component
re-render. You also opt out of the lint coverage the Rules of Hooks bring. Take the
exception when the condition is genuine — a read that only applies on one branch, or one
after a guard clause — and keep the top-level habit otherwise.

**★ Does reading context conditionally reduce re-renders?**
No. Every consumer re-renders when the provider's value changes, however the read is
written; `use` is not a selector and cannot subscribe to part of a value. The tools that
actually help are memoizing the provider value and splitting contexts by update frequency.

**Any restriction you should know before using it in an RSC codebase?**
Reading context with `use` is not supported in Server Components — the promise form is the
one that belongs there. A component shared across the boundary should take the value as a
prop instead.

**Can you wrap it in `try`/`catch`?**
No, and the restriction applies to the context form too even though a context read does
not suspend. Errors belong to an error boundary; treat the ban as a property of the API
rather than of the resource being read.

---

← Prev: [Suspense inside a transition](11-suspense-inside-a-transition.md) ·
Index: [Phase 8](README.md) ·
Next → [`cache` and `cacheSignal`](13-cache-and-cachesignal.md)
