---
title: "The React Compiler v1.0"
sidebar_label: "07 · The React Compiler v1.0"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8** and
> **babel-plugin-react-compiler 1.0.0**, from documentation — react.dev
> [React Compiler · Introduction](https://react.dev/learn/react-compiler/introduction).
> 🔴 **The measured output — what it emits, `_c()` slot counts, which functions it
> treats as compilable, and the proof that it is not a linter — is
> [Phase 0 · 11](../phase-0-how-react-runs/11-the-compiler.md)**, which is
> sandbox-backed. This page is what it means for the memoization in *this* phase.
> No sandbox script backs this page.

**Build-time automatic memoization. It does at compile time what topics 02–04 do
by hand — and its existence changes the answer to "should I memoize this?" more
than it changes the reasoning behind it.**

> React Compiler is a **build-time tool that automatically optimizes your React
> app.** It works with plain JavaScript, and **understands the Rules of React**, so
> you don't need to rewrite any code to use it.

## Stable

> **React Compiler is now stable** and has been tested extensively in production.
> While it has been used in production at companies like Meta, **rolling out the
> compiler to production for your app will depend on the health of your codebase
> and how well you've followed the Rules of React.**

That second clause is the whole adoption story. It is not "will it work" — it is
"how much of your code can it analyse", and that is a function of how well the
Rules of React are followed ([topic 09](09-how-the-compiler-bails-out.md)).

## The two things it automates

> React Compiler's automatic memoization is primarily focused on two use cases:
>
> 1. **Skipping cascading re-rendering of components** — Re-rendering `<Parent />`
>    causes many components in its component tree to re-render, even though only
>    `<Parent />` has changed.
> 2. **Skipping expensive calculations from outside of React** — for example,
>    calling `expensivelyProcessAReallyLargeArrayOfObjects()` inside of your
>    component or hook that needs that data.

Map those onto this phase and the correspondence is exact:

| Compiler use case | The manual equivalent |
|---|---|
| Skipping cascading re-renders | `memo` + `useCallback` + stable props ([02](02-memo.md), [04](04-usecallback.md)) |
| Skipping expensive calculations | `useMemo` for cost ([03](03-usememo.md)) |

Which means the Compiler automates **all three** of `useMemo`'s documented reasons
and the whole of `memo`'s purpose — the parts of this phase that are mechanical.

## 🔴 What it does not do

Two limits, both stated plainly, and both change how you read the promise.

> React Compiler **only memoizes React components and hooks, not every function.**

Phase 0's measurement shows the exact boundary: a `use`-prefixed helper that calls
no hooks is left alone, and ordinary functions are never touched. So an expensive
utility called from a component is memoized *at the call site inside the component*
— not made cheap in itself.

> React Compiler's memoization **is not shared across multiple components or
> hooks.**

> Example: If `expensivelyProcessAReallyLargeArrayOfObjects` is a
> non-component/non-hook function used in many different components, **that
> expensive calculation would be run repeatedly.**

Each component gets its own cache. Ten components calling the same expensive
function with the same argument compute it ten times. That is a real gap, and the
fix is an ordinary module-level cache — nothing React provides.

**And critically, it does nothing about the composition column.** The Compiler
memoizes; it does not restructure. Accepting `children` and moving state down
([topic 06](06-the-memoization-trap.md), [topic 13](13-moving-state-down.md)) remove
work rather than caching it, and remain the better fix with the Compiler on.

## It is not a correctness tool

Phase 0 measured this directly and it is worth carrying forward: a component that
**mutates a prop during render** — a plain Rules of React violation — was
**compiled anyway**, into four cache slots, with nothing reported. Catching that is
`eslint-plugin-react-hooks`' job ([topic 10](10-eslint-plugin-react-hooks.md)).

> compiler for speed, linter for correctness

The pairing matters because the failure mode is asymmetric: the linter tells you
about a bug, the compiler silently produces a cache around it.

## What happens to the memoization you already wrote

The recommendation is conservative, and the reason is not sentimental:

> For **existing code**, we recommend either **leaving existing memoization in
> place (removing it can change compilation output)** or carefully testing before
> removing the memoization.

*Removing it can change compilation output* — your `useMemo` is an input to the
Compiler's analysis, not just redundant work it steps around.

> The `useMemo` and `useCallback` hooks **can continue to be used with React
> Compiler as an escape hatch** to provide control over which values are memoized.
> A common use-case for this is **if a memoized value is used as an effect
> dependency**, in order to ensure that an effect does not fire repeatedly even when
> its dependencies do not meaningfully change.

So they are not deprecated — they are demoted to a precision tool, and the named
surviving use is the *identity* case from [topic 03](03-usememo.md), specifically
for effect dependencies.

> For **new code**, we recommend **relying on the compiler for memoization** and
> using `useMemo`/`useCallback` where needed to achieve precise control.

[Topic 11](11-do-you-still-write-usememo.md) works through the migration.

## Where this is going

> While the compiler is still an **optional addition** to React today, **in the
> future some features may require the compiler** in order to fully work.

Worth knowing when arguing about adoption: the trajectory is toward the Compiler
being assumed, not toward it staying optional forever.

## What does not change

The reasoning in topics 01, 05, 06 and 13 is untouched:

- You still have to know **why** something re-rendered — the Compiler cannot fix a
  context that re-renders every consumer, or an effect chain producing four commits
  per interaction.
- You still have to **measure**, because the Compiler's benefit is a claim like any
  other.
- **Composition still beats caching**, and the Compiler does not do composition.
- react.dev's own "most performance problems are caused by chains of updates
  originating from Effects" is a Phase 4 problem the Compiler does not address at
  all.

**The Compiler changes the ending of this phase, not the reasoning.**

## Gotchas

**Symptom:** the Compiler is on and an expensive shared function still runs per
component.
**Cause:** memoization is not shared across components or hooks — each gets its own
cache.
**Fix:** a module-level cache, outside React.

**Symptom:** a `use`-prefixed helper was expected to be optimised and was not.
**Cause:** it calls no hooks, so it is treated as a plain function
([Phase 0 · 11](../phase-0-how-react-runs/11-the-compiler.md)).
**Fix:** nothing to fix — it has no fiber to hang a cache on.

**Symptom:** deleting `useMemo` after enabling the Compiler changed behaviour.
**Cause:** documented — removing existing memoization can change compilation
output, and a `useMemo` may exist for referential identity something else depends
on.
**Fix:** leave existing memoization in place, or test carefully before removing.

**Symptom:** the Compiler is treated as validating the code.
**Cause:** it compiles rule-violating components silently.
**Fix:** run the linter. Compiler for speed, linter for correctness.

**Symptom:** context consumers still all re-render with the Compiler on.
**Cause:** that is not a memoization problem
([Phase 5 · 05](../phase-5-refs-context-reducers/05-context-re-render-problem.md)).
**Fix:** split the context. The Compiler cannot help here.

**Symptom:** adoption stalls because "not enough of it compiles".
**Cause:** how much it can optimise depends on how well the Rules of React are
followed.
**Fix:** the linter first — its findings are the same violations that cause bail-outs.

## Interview questions

**★ What does the React Compiler actually automate?**
Two things, per the docs: skipping cascading re-renders when a parent re-renders,
and skipping expensive calculations inside components and hooks. Those map exactly
onto `memo` plus stable props, and `useMemo` for cost — so it automates the
mechanical parts of manual memoization. It is stable, and how much of your code it
can optimise depends on how well you follow the Rules of React.

**★ What does it *not* do?**
It only memoizes components and hooks, not every function, and **its memoization is
not shared across components** — ten components calling the same expensive function
compute it ten times. It does not restructure code, so composition fixes like
accepting `children` or moving state down still matter and still win. And it is not
a correctness tool: it will happily compile a component that mutates a prop during
render, which is the linter's job to catch.

**★ Should you delete your existing `useMemo` and `useCallback`?**
The docs recommend leaving them, because removing them can change the compilation
output — they are an input to the analysis, not just redundant work. They remain
supported as an escape hatch for precise control, with the named use case being a
memoized value used as an effect dependency. For new code, rely on the compiler and
reach for them only when you need that control.

**Does the Compiler make this phase obsolete?**
No — it changes the ending, not the reasoning. You still need to know why something
re-rendered, because it cannot fix a context re-rendering every consumer or an
effect chain producing several commits per interaction. You still need to measure.
And composition still beats caching, which is the one column the Compiler does not
automate.

**Is the Compiler going to stay optional?**
The docs say it is optional today but that **in the future some features may
require the compiler** to fully work. That is worth knowing when weighing adoption:
the direction of travel is toward it being assumed.

---

← Prev: [The memoization trap](06-the-memoization-trap.md) · Index: [Phase 6](README.md) · Next → [Installing and configuring the Compiler](08-installing-the-compiler.md)
