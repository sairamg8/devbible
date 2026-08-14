---
title: "React calls components and hooks"
sidebar_label: "03 · React calls them, not you"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [React calls Components and Hooks](https://react.dev/reference/rules/react-calls-components-and-hooks)
> and [Rules of React](https://react.dev/reference/rules).
> No sandbox script backs this page; claims are cited, not measured.

**The second rule family is about who does the calling. Components go in JSX, never
in parentheses; hooks are called by name, never stored, passed or wrapped. Both rules
exist so that React — not your call stack — decides when a component runs.**

This is the family with the weakest tooling and the most convincing-looking
violations, because both `{Article()}` and `<Button useData={useX} />` are perfectly
valid JavaScript that appears to work.

## 1 · Never call component functions directly

> Components should only be used in JSX. Don't call them as regular functions.
> **React should call it.**

> **React must decide when your component function is called** during rendering. In
> React, you do this using JSX.

```jsx
function BlogPost() {
  return <Layout><Article /></Layout>; // ✅ Good: Only use components in JSX
}
```

```jsx
function BlogPost() {
  return <Layout>{Article()}</Layout>; // 🔴 Bad: Never call them directly
}
```

The two lines produce the same-looking output, which is the trap. The difference is
what React *knows*. With `<Article />`, JSX creates an element — a description React
owns, with a type it can compare, a place in the tree, and a lifetime. With
`Article()`, the function has already run by the time React sees anything; there is no
`Article` in the tree at all, only whatever it returned, inlined into `BlogPost`.

The immediate consequence is a Rules of Hooks violation waiting to happen:

> **If a component contains Hooks, it's easy to violate the Rules of Hooks** when
> components are called directly in a loop or conditionally.

Which follows directly from [Phase 7 · 01](../01-the-rules-of-hooks.md): `Article()`
inside `BlogPost` puts `Article`'s hooks into **`BlogPost`'s** slot list. Call it in a
`.map`, or behind a condition, and the slot list changes length between renders —
"Rendered fewer hooks than expected", from code containing no visible conditional
hook. The `useState` inside `Article` is now `BlogPost`'s state, and it is also gone
the moment `BlogPost` stops calling it.

react.dev lists five things you give up, and they are worth taking one at a time
because each is a distinct capability, not five phrasings of one:

> * **Components become more than functions** — React can augment them with features
>   like local state through Hooks
> * **Component types participate in reconciliation** — React won't attempt to re-use
>   components when moving between different pages
> * **React can enhance your user experience** — The browser can work between component
>   calls so re-rendering doesn't block the main thread
> * **A better debugging story** — Components as first-class citizens enable rich
>   developer tools
> * **More efficient reconciliation** — React can decide exactly which components need
>   re-rendering

Restated as what breaks:

| Benefit lost | What you actually see |
|---|---|
| Hooks and local state | The child's state belongs to the parent, and dies with the parent's next branch change |
| Type-based reconciliation | State preserved or reset in the wrong places; [Phase 3 · 15](../../phase-3-state/15-preserving-and-resetting.md) |
| Yielding between components | A long list renders as one uninterruptible block — no time-slicing |
| DevTools | The component is absent from the tree; no props panel, no profiler row |
| Targeted re-rendering | The child cannot re-render on its own, and `memo` on it does nothing |

That last one is worth stating plainly because it comes up in performance work:
**`memo(Article)` is dead code if the caller writes `Article()`.** The memo compares
props of an element that is never created.

The two legitimate-looking cases and what to do instead:

- **"I need to call it conditionally."** That is what JSX conditionals are for —
  `{show && <Article />}`. The element is created or not; the function is still React's
  to call.
- **"It is just a helper that returns JSX."** Then it is a helper, and the honest form
  is a plain function that takes arguments and contains **no hooks** — usually named
  `renderRow`, not `Row`. The moment it needs state, it must become a real component
  used in JSX.

## 2 · Never pass around hooks as regular values

> Hooks should only be called inside of components or Hooks. **Never pass it around as
> a regular value.**

> Hooks allow you to augment a component with React features. They should **always be
> called as a function, and never passed around as a regular value**. This enables
> *local reasoning*, or the ability for developers to understand everything a
> component can do by looking at that component in isolation.

Two specific prohibitions follow.

### Don't dynamically mutate a hook

> Hooks should be as **"static"** as possible. You shouldn't dynamically mutate them —
> for example, **don't write higher order Hooks**:

```jsx
function ChatInput() {
  const useDataWithLogging = withLogging(useData); // 🔴 Bad: don't write higher order Hooks
  const data = useDataWithLogging();
}
```

> Instead, create a static version of the Hook with the desired functionality:

```jsx
function ChatInput() {
  const data = useDataWithLogging(); // ✅ Good: Create a new version of the Hook
}

function useDataWithLogging() {
  // ... Create a new version of the Hook and inline the logic here
}
```

The instinct being blocked here is a good one from elsewhere in JavaScript —
composition, decorators, `withX` wrappers — and it is specifically wrong for hooks.
`withLogging(useData)` produces a **new function identity on every render**, so nothing
about the hook is stable enough to reason about or lint, and the linter cannot verify
that the thing eventually called is a hook at all. Duplicating a few lines into a
second concrete hook is the intended trade.

### Don't dynamically use hooks

> Hooks should also **not be dynamically used**. Don't pass a Hook as a value:

```jsx
function ChatInput() {
  return <Button useData={useDataWithLogging} /> // 🔴 Bad: don't pass Hooks as props
}
```

> Always inline the call of the Hook into that component and handle any logic there:

```jsx
function ChatInput() {
  return <Button />
}

function Button() {
  const data = useDataWithLogging(); // ✅ Good: Use the Hook directly
}

function useDataWithLogging() {
  // If there's any conditional logic to change the Hook's behavior, it should be inlined into
  // the Hook
}
```

> This makes components easier to understand and debug. **Dynamic Hook usage increases
> complexity and inhibits local reasoning**, making it easier to accidentally break the
> Rules of Hooks.

Note the last clause of the good example's comment: **conditional logic belongs inside
the hook.** That is the escape hatch people are usually reaching for when they pass a
hook as a prop — "sometimes I want the logging version". Take a parameter instead of
taking a hook.

### Why "static" is the operative word

Rule 1 of the Rules of Hooks — top level, same order, every render — is only checkable
if the *identity* of what is being called is fixed at the call site. `useData()` is a
statement about this component that the linter, the Compiler and a human reader can all
verify without leaving the file. `props.useData()` is a statement about whatever the
parent happened to pass, which could be a different hook per render, could be
conditional, and could be no hook at all.

That is what "inhibits local reasoning" means concretely: **the set of hooks a component
calls stops being a property of the component.** Everything React and its tooling do
with hooks — slot allocation, the lint rules, the Compiler's memoization, DevTools'
hook tree — depends on that set being knowable from the source.

## Gotchas

**Symptom:** "Rendered fewer hooks than expected" in a component with no conditional
hooks.
**Cause:** a child component called as a function, conditionally or in a loop, so its
hooks landed in the caller's slot list.
**Fix:** render it as JSX. `{Article()}` → `<Article />`.

**Symptom:** a child's state resets or persists at the wrong times.
**Cause:** called directly, so the child has no identity in the tree and does not
participate in reconciliation.
**Fix:** JSX. Then [Phase 3 · 15](../../phase-3-state/15-preserving-and-resetting.md)
governs its state.

**Symptom:** a component is missing from React DevTools.
**Cause:** it was invoked as a function, so no element and no fiber were ever created.
**Fix:** JSX — and treat "not in DevTools" as the fast way to detect this.

**Symptom:** `memo()` on a component has no effect at all.
**Cause:** the caller invokes it directly; `memo` needs an element whose props it can
compare.
**Fix:** JSX. Verify in the profiler, not by reading the code.

**Symptom:** a long list blocks the main thread even under a transition.
**Cause:** rows called as functions render as one synchronous block, with no points for
React to yield.
**Fix:** JSX per row.

**Symptom:** the hooks linter is silent on a component that clearly misuses hooks.
**Cause:** the hook arrived as a prop or from a factory, so the linter cannot tell it
is a hook.
**Fix:** call hooks by name. Move variation inside the hook as a parameter.

**Symptom:** a `withX(useY)` wrapper causes effects to re-run every render.
**Cause:** the wrapper returns a new function identity each render, so nothing
downstream is stable.
**Fix:** write the concrete `useYWithX` hook and inline the logic.

## Interview questions

**★ What breaks if you write `{Article()}` instead of `<Article />`?**
React never sees `Article`. No element is created, so there is no fiber, no type to
reconcile, no DevTools entry, no independent re-render and no `memo`. Worse, any hooks
inside `Article` execute inside the *caller's* slot list — so calling it conditionally
or in a loop changes the caller's hook count between renders and throws "Rendered fewer
hooks than expected" from a component with no visible conditional hook. React must
decide when a component function is called; JSX is how you let it.

**★ Why can't you write a higher-order hook like `withLogging(useData)`?**
Because hooks must be as static as possible. A factory produces a new function identity
every render, so nothing downstream is stable, and neither the linter, the Compiler nor
a reader can verify that what is being called is a hook or that it is called
unconditionally. The intended fix is duplication: write a concrete `useDataWithLogging`
and inline the logic.

**★ What does passing a hook as a prop cost you?**
Local reasoning. The set of hooks a component calls stops being a property of that
component and becomes a property of whatever its parent passed — potentially different
per render. That defeats the lint rules, makes Rules of Hooks violations easy to
introduce accidentally, and makes the component impossible to understand in isolation.
Conditional behaviour belongs inside the hook, taken as a parameter.

**★ Name the concrete capabilities React lists as reasons for orchestrating the calls.**
Components can be augmented with features like local state through Hooks; component
types participate in reconciliation, so React does not reuse components across
different pages; the browser can do work between component calls so re-rendering does
not block the main thread; components as first-class citizens make rich devtools
possible; and reconciliation can target exactly the components that need re-rendering.

**A helper function returns JSX. Is that a rule violation?**
Not by itself — a plain function that takes arguments, contains no hooks and returns
JSX is a helper, and calling it is fine. It stops being fine the moment it needs state,
an effect or any hook, because then it needs its own identity in the tree. The naming
convention carries the intent: `renderRow` is a helper, `Row` is a component and
belongs in JSX.

**How would you spot this in an unfamiliar codebase?**
Look for a component name followed by `(` instead of appearing in angle brackets, and
for hooks arriving as props or being produced by factories. The runtime tells you too:
a component that should be there and is absent from the DevTools tree was called
directly, and a `memo` that provably does nothing usually means the same.

---

← Prev: [What is immutable, and when](02-immutability.md) ·
Index: [Rules of React beyond hooks](README.md) ·
Next → [Refs and the DOM during render](04-refs-and-the-dom-in-render.md)
