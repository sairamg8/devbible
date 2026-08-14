---
title: "How the Compiler bails out"
sidebar_label: "09 · How the Compiler bails out"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **babel-plugin-react-compiler 1.0.0**, from
> documentation — react.dev
> [React Compiler · Introduction](https://react.dev/learn/react-compiler/introduction),
> [Configuration](https://react.dev/reference/react-compiler/configuration) and
> [`eslint-plugin-react-hooks`](https://react.dev/reference/eslint-plugin-react-hooks)
> (whose compiler rule names are the clearest published list of what the compiler
> must be able to prove).
> 🔴 **The measured bail-out — a conditional hook left exactly as written, and a
> prop-mutating component compiled anyway — is
> [Phase 0 · 11](../phase-0-how-react-runs/11-the-compiler.md).**
> No sandbox script backs this page.

**The Compiler only optimises what it can prove is safe. Bailing out is silent and
per-function, so the failure mode is "no speed-up here" — which means you can have
it installed and getting almost nothing, with no signal at all.**

## What bailing out looks like

Phase 0 measured it: a component with a hook inside an `if` is **left exactly as
written**. Not an error, not a warning, not a broken build — just an uncompiled
function.

> Bailing out is **per-function and silent**, so the failure mode is "no speed-up
> here", never a broken build.

Per-function matters. One unanalysable component does not disable the Compiler for
the file or the app; it is skipped and everything around it still compiles. So a
codebase can be 90% compiled or 20% compiled and feel identical from the outside.

That is exactly why [topic 08](08-installing-the-compiler.md)'s verification step
is not optional: the **"Memo ✨" badge** and a `logger` counting `CompileSuccess`
are the only way to know your coverage.

## What it must be able to prove

The Compiler *"understands the Rules of React"*, and what that means concretely is
best read off the linter's compiler rule names — each is a property the Compiler
needs and the linter can check:

| Rule | The property |
|---|---|
| `immutability` | props, state and other immutable values are **not mutated** |
| `purity` | components and hooks are **pure** — no known-impure calls during render |
| `globals` | no assignment or mutation of **globals during render** |
| `refs` | refs are **not read or written during render** |
| `set-state-in-render` | state is not set during render |
| `set-state-in-effect` | `setState` is not called synchronously in an effect |
| `static-components` | components are **static**, not recreated every render |
| `error-boundaries` | error boundaries, not `try`/`catch`, for child errors |
| `component-hook-factories` | no higher-order functions defining nested components or hooks |
| `unsupported-syntax` | syntax the Compiler does not support |
| `incompatible-library` | libraries **incompatible with memoization** |
| `preserve-manual-memoization` | existing manual memoization is preserved |

Most of these are already familiar from earlier phases —
[refs during render](../phase-5-refs-context-reducers/01-useref.md),
[setting state in an effect](../phase-4-effects/06-you-might-not-need-an-effect/02-chains-of-effects.md),
[purity](../phase-2-components/02-purity/01-the-two-rules.md),
[components defined inside components](../phase-2-components/README.md). The
Compiler does not introduce new rules; it **rewards the ones that were already
there**, which is the strongest practical argument for following them.

Two are worth calling out because they are Compiler-specific:

**`incompatible-library`** — some libraries are simply not memoization-safe, usually
because they rely on being called on every render. The Compiler cannot know that
from your code, so the linter carries the knowledge.

**`preserve-manual-memoization`** — the Compiler must not *break* the `useMemo` you
already wrote. This is the mechanism behind
[topic 07](07-the-react-compiler.md)'s warning that removing existing memoization
can change the compiled output: your memoization is part of the input it preserves.

## 🔴 It compiles rule-breaking code anyway

The most important thing on this page, and Phase 0 measured it directly: a component
that **mutates a prop during render** — a plain `immutability` violation — was
**compiled into four cache slots**, and nothing was reported.

So "bails out" and "detects your bug" are different things:

| | The Compiler | The linter |
|---|---|---|
| Can't analyse it | skips it, silently | — |
| Breaks a rule but *is* analysable | **compiles it anyway** | **reports it** |
| Result | possibly-wrong memoized output | a fixable error |

**Compiler for speed, linter for correctness.** A rule violation that the Compiler
happily compiles is arguably worse than one it skips, because now there is a cache
built on an assumption your code violates.

## Making bail-outs visible or fatal

`panicThreshold` decides what happens when the Compiler meets code that breaks the
rules:

```js
{
  panicThreshold: 'none' // Skip components with errors instead of failing the build
}
```

- **`'none'`** — skip and continue. The right setting during adoption, and what
  produces the silent per-function behaviour above.
- **Stricter settings** fail the build instead, which is a legitimate choice for a
  codebase that has already been through the linter and wants to keep coverage from
  regressing.

There is a real argument for tightening this once a codebase is clean: otherwise
coverage silently erodes as people add components that cannot be compiled, and
nobody notices until someone checks the badge.

## Improving coverage

The order, and it is the same as the rollout order:

1. **Run the linter.** Its findings are the same violations that cause bail-outs, so
   every fix is both a correctness fix and a coverage increase.
2. **Fix `immutability` and `purity` first** — mutation during render and impure
   render logic are the most common, and both are real bugs regardless of the
   Compiler.
3. **Check `unsupported-syntax`** for anything exotic in the build.
4. **Re-check coverage** with the badge or the logger.

Note what is *not* on the list: rewriting code to please the Compiler. Every item
above is something you would want fixed anyway — which is the point react.dev makes
when it says rollout *"will depend on the health of your codebase and how well you've
followed the Rules of React"*.

## Gotchas

**Symptom:** the Compiler is installed and performance is unchanged.
**Cause:** it may be compiling very little. Bail-outs are silent and per-function.
**Fix:** check the "Memo ✨" badge and a `CompileSuccess` logger before concluding
anything.

**Symptom:** one component seems uncompiled while its neighbours are fine.
**Cause:** per-function bail-out — a conditional hook, unsupported syntax, or a rule
it cannot prove.
**Fix:** run the linter on that file.

**Symptom:** a component that clearly breaks the rules shows the "Memo ✨" badge.
**Cause:** the Compiler compiles analysable code even when it violates the rules; it
is not a validator.
**Fix:** the linter reports it. Fix the violation — the cache is built on an
assumption your code breaks.

**Symptom:** compiler coverage was good and has quietly dropped.
**Cause:** new components that cannot be compiled, skipped silently under
`panicThreshold: 'none'`.
**Fix:** tighten `panicThreshold` once the codebase is clean, or track coverage in
CI with the logger.

**Symptom:** memoized output goes wrong after adopting a third-party hook.
**Cause:** a library that is not memoization-safe.
**Fix:** the `incompatible-library` rule exists for exactly this.

**Symptom:** deleting a `useMemo` changed the compiled output.
**Cause:** `preserve-manual-memoization` — your memoization is an input the Compiler
preserves.
**Fix:** leave existing memoization in place, as the docs recommend.

## Interview questions

**★ What happens when the Compiler cannot optimise a component?**
It bails out — silently, per-function, leaving the component exactly as written. It
does not error, warn, or break the build, and it does not stop compiling the rest of
the file. The consequence is that you can have the Compiler installed and getting
almost nothing from it with no signal at all, which is why the "Memo ✨" badge and a
`CompileSuccess` logger matter.

**★ Does the Compiler catch code that breaks the Rules of React?**
No. If it can analyse the code it compiles it, even when the code breaks the rules —
a component that mutates a prop during render was compiled into four cache slots
with nothing reported. Bailing out happens when it *cannot analyse* something, not
when something is wrong. Catching violations is `eslint-plugin-react-hooks`' job:
compiler for speed, linter for correctness.

**★ What does the Compiler need to be able to prove?**
Essentially the Rules of React, and the linter's compiler rule names are the clearest
list: no mutation of props or state, pure render logic, no global mutation during
render, no reading or writing refs during render, no setting state during render or
synchronously in an effect, static components, and no unsupported syntax. It
introduces no new rules — it rewards the ones that already existed, which is the
strongest practical argument for following them.

**How do you increase how much of a codebase gets compiled?**
Run the linter first, because its findings are exactly the violations that cause
bail-outs, and fix `immutability` and `purity` first since those are both the most
common and real bugs anyway. Then re-check coverage. Nothing on that list is
"rewriting code to please the compiler" — it is all work you would want done
regardless, which is what react.dev means by rollout depending on the health of your
codebase.

**Why might you tighten `panicThreshold` later?**
Because `'none'` makes bail-outs silent, so coverage erodes invisibly as people add
components that cannot be compiled. Once a codebase has been through the linter,
failing the build on a violation keeps coverage from regressing. During adoption the
opposite is right — skip rather than break the build.

---

← Prev: [Installing and configuring the Compiler](08-installing-the-compiler.md) · Index: [Phase 6](README.md) · Next → [`eslint-plugin-react-hooks`](10-eslint-plugin-react-hooks.md)
