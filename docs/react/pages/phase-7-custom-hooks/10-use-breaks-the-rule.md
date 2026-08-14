---
title: "`use` breaks the rule on purpose"
sidebar_label: "10 · `use` breaks the rule"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`use`](https://react.dev/reference/react/use) (definition, parameters, caveats, and
> the context section) and
> [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks).
> The explanation of *why* the exception is safe is **reasoning from the documented
> behaviour**, not a published implementation note, and is labelled as such below.
> No sandbox script backs this page; claims are cited, not measured.

**There is exactly one API in React that may be called inside an `if` or a `for`, and
React says so in the caveats rather than leaving you to discover it. Knowing why it is
safe is what stops you generalising the exception to hooks that cannot survive it.**

## What `use` is

> `use` is a React API that lets you read the value of a **Promise** or **context**.

```js
const value = use(resource);
```

> **`context`**: A context created with `createContext`.
>
> **`promise`**: A Promise whose resolved value you want to read. **The Promise must be
> cached** so that the same instance is reused across re-renders.

Two resources, one call. Note what is *not* in that list: no state, no effect, no ref,
no subscription. `use` reads something that already exists somewhere else. That is the
whole reason it can break the rule.

## The exception, stated

> **`use` must be called inside a Component or a Hook.**
>
> **Unlike Hooks, `use` CAN be called within loops and conditional statements** like `if`
> and `for`.

And for context specifically:

> Call `use` with a context to read its value. **Unlike `useContext`, `use` can be called
> within loops and conditional statements like `if`.**

> `use` returns the context value for the passed context, determined by the **closest
> context provider above** the calling component. If there is no provider, the returned
> value is the `defaultValue` passed to `createContext`.

So this is legal, and `useContext` in the same position is not:

```jsx
function HorizontalRule({ show }) {
  if (show) {
    const theme = use(ThemeContext);   // ✅ conditional, and allowed
    return <hr className={theme} />;
  }
  return false;
}
```

## Why it is safe — the reasoning

⚠️ **react.dev states the rule but does not publish the implementation reason.** What
follows is reasoning from the documented behaviour, and it is consistent with everything
on this page; treat it as a model rather than a quoted fact.

[Phase 7 · 05](05-why-the-rules-exist/README.md) established the mechanism the rule
protects: React keeps **an array of state pairs per component and an index reset to 0
before every render**, and each `useState` takes the next entry. The rule exists because
that index must land in the same place every render.

`use` does not participate in that. Its two resources both identify themselves:

- **A context** is found by walking up the tree to the closest provider. Nothing about
  that lookup depends on how many `use` calls preceded it, so calling it zero times on
  one render and once on the next changes nothing to get out of step.
- **A promise** is identified by the promise object you pass in — which is why the docs
  require it to be cached and reused across renders. The identity comes from the
  argument, not from a position.

Contrast `useState(0)`, which is handed no identifier at all
([Phase 7 · 05 · 01](05-why-the-rules-exist/01-the-array-and-the-index.md)) and therefore
*must* be identified by position. **The rule is not a policy React could relax; it is a
consequence of hooks having no identity of their own.** `use` has one, so it does not
need the rule.

The useful generalisation: **an API can be called conditionally exactly when it does not
need a slot.** That is a property of the API, not something you can arrange by being
careful, which is why "but `use` can do it" is never an argument about any other hook.

## The rules `use` still obeys

The exception is narrow, and three constraints survive it.

**1. It must be called inside a Component or a Hook.** The second Rule of Hooks is
untouched. `use` in an event handler, a plain helper, a `setTimeout` callback or a class
component is invalid, for the same reason as any hook — there is no component rendering
at that moment.

**2. 🔴 It cannot be called inside `try`/`catch`.**

> `use` **cannot be called inside a try-catch block.** Instead, wrap your component in an
> **Error Boundary** to catch errors.

This is worth pairing with the `try`/`catch`/`finally` entry on the Rules of Hooks list
([Phase 7 · 05 · 02](05-why-the-rules-exist/02-deriving-the-forbidden-places.md)),
because the two prohibitions look identical and have *different* causes. For ordinary
hooks, a `try` block makes the hook **count** conditional on whether something threw. For
`use`, the count was never the issue — the problem is that suspending is signalled by
throwing, so a `catch` around `use` intercepts the mechanism React uses to pause and
retry the render. A rejected promise is likewise not an exception for you to catch here:
it belongs to an error boundary.

The practical shape, therefore, is a **Suspense boundary for the pending case and an
error boundary for the rejected case**, wrapped around the component — not `try`/`catch`
inside it.

**3. Reading context with `use` is not supported in Server Components.**

> **Reading context with `use` is not supported in Server Components.**

The promise form is the one that matters there; context is a client concern. Phase 10
covers what does and does not cross the RSC boundary.

## The promise form, and its two real constraints

> The Promise must be **cached** so that the same instance is reused across re-renders.

> **Promises passed to `use` must be cached** so the same Promise instance is reused
> across re-renders.

The docs say it twice, which is a fair reflection of how easy it is to get wrong.
`use(fetch('/api/thing'))` written in a component body creates a **new promise on every
render**, and every render therefore suspends on something that has never resolved — an
unresolvable loop rather than a slow load. The promise has to come from somewhere stable:
a cache, a framework loader, or a Server Component that created it and passed it down.

> When passing a Promise from a Server Component to a Client Component, its resolved
> value must be **serializable**.

Which is the pattern the API is really designed around: the server starts the work and
hands the client component a promise to read, rather than the client creating one during
render. Phase 10 covers the mechanics (Phase 12 would have covered the client-side half
and was **dropped**); the point here is that the caching
requirement is not an optimisation — an uncached promise is a broken component.

## `use` versus `useContext`

| | `useContext` | `use` |
|---|---|---|
| Where it may be called | Top level of a component or hook only | Inside conditions and loops as well |
| What it reads | Context | Context **or** a promise |
| In Server Components | — | Promise: yes. **Context: not supported** |
| Inside `try`/`catch` | No (Rules of Hooks) | No (it would catch suspension) |

Should you replace every `useContext` with `use`? **No** — and the reason is the design
principle from
[Phase 7 · 06 · 01](06-designing-a-hooks-api/01-the-name-and-the-arguments.md): a
constrained API makes calling code more declarative. `useContext` at the top level makes
a component's context dependencies visible in one glance, which is precisely the
guarantee the Rules of Hooks buy everywhere else. Reach for the conditional form when the
condition is real — a context read that genuinely only applies on one branch, or a read
inside a loop — and keep the top-level habit otherwise.

## Gotchas

**Symptom:** an infinite suspension — the component never renders content.
**Cause:** a new promise created during render, so nothing ever resolves for the render
that awaits it.
**Fix:** cache the promise. The same instance must be reused across renders.

**Symptom:** a `try`/`catch` around `use` swallows the loading state and produces
strange behaviour.
**Cause:** suspension is signalled by throwing; the `catch` intercepts it.
**Fix:** a Suspense boundary for pending, an error boundary for rejected. The docs
forbid the `try`/`catch` outright.

**Symptom:** `use(SomeContext)` fails in a Server Component.
**Cause:** reading context with `use` is not supported there.
**Fix:** pass the value as a prop, or read it in a Client Component.

**Symptom:** a promise passed from a server component works locally and fails once its
value contains a class instance or a function.
**Cause:** the resolved value must be serializable across the boundary.
**Fix:** send plain data.

**Symptom:** someone starts calling every hook conditionally, citing `use`.
**Cause:** the exception read as a general relaxation.
**Fix:** `use` is exempt because it does not need a positional slot. No other hook has
that property, and none can be given it.

**Symptom:** `use` called in an event handler.
**Cause:** assuming the exception covers the second rule too.
**Fix:** it does not — `use` must be called inside a Component or a Hook, like any hook.

## Interview questions

**★ Which React API may be called conditionally, and why is that safe?**
`use` — the docs state that unlike Hooks it *can* be called within loops and conditional
statements. The reason, reasoning from the documented behaviour, is that it does not need
a positional slot: a context is found by walking up to the closest provider, and a promise
is identified by the object you pass in, which is why it must be cached and reused. A
`useState` call is handed no identifier at all, so it must be identified by position —
the rule is a consequence of that, not a policy React chose.

**★ Which rules does `use` still obey?**
It must still be called inside a Component or a Hook, so it is invalid in event handlers,
plain functions and class components. It may not be called inside `try`/`catch` — errors
belong to an error boundary. And reading context with it is not supported in Server
Components.

**★ Why can't `use` go inside `try`/`catch`, and is that the same reason hooks can't?**
No, and the difference is worth knowing. Ordinary hooks are banned from `try` blocks
because a throw makes the hook *count* conditional. `use` is banned because suspending is
signalled by throwing, so a `catch` intercepts the mechanism React uses to pause and retry
the render — and a rejected promise likewise belongs to an error boundary. Same
prohibition, different cause.

**★ What goes wrong with `use(fetch('/api/x'))` in a component body?**
A new promise is created on every render, so every render suspends on something that has
never resolved and the component never settles. The docs require the promise to be cached
so the same instance is reused across renders — usually created by a cache, a framework
loader, or a Server Component that passes it down, in which case its resolved value must
be serializable.

**Should you replace `useContext` with `use` everywhere?**
No. The top-level restriction is what makes a component's context dependencies visible at
a glance, which is the same guarantee the Rules of Hooks buy everywhere else. Use the
conditional form when the condition is genuine — a read that only applies on one branch,
or a read inside a loop — and keep the top-level habit as the default.

**Does `use` mean React could eventually relax the Rules of Hooks generally?**
Not by this route. The rule exists because `useState` and friends have no identity except
their position in the component's hook list. `use` is exempt because its resource
identifies itself. Any hook that stores something per call still needs a slot, and a slot
still needs a stable index.

---

← Prev: [Conditional hooks and the correct restructure](09-conditional-hooks.md) ·
Index: [Phase 7](README.md) ·
Next → [Testing a custom hook](11-testing-a-custom-hook.md)
