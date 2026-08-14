---
title: "eslint-plugin-react-hooks"
sidebar_label: "10 · eslint-plugin-react-hooks"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 from documentation — react.dev
> [`eslint-plugin-react-hooks`](https://react.dev/reference/eslint-plugin-react-hooks)
> for the rule list, and the **React 19.2 release post** (1 Oct 2025) for the v6
> change. **Version:** npm shows **7.1.1** as the current release; the react.dev
> reference page is published against an `rc` channel, so treat the exact minor as
> something to check at install time rather than a fact to memorise.
> No sandbox script backs this page.

**The other half of the Compiler. It carries the Compiler's static analysis as
lint rules — and, crucially, you can run all of them without adopting the Compiler
at all.**

## 🔴 The rules work without the Compiler

The line that changes how you should think about adoption:

> React Compiler diagnostics are **automatically surfaced by this ESLint plugin, and
> can be used even if your app hasn't adopted the compiler yet.**

So the sequencing everyone assumes — adopt the Compiler, then deal with what it
complains about — is backwards. You can get the entire diagnostic surface first, in
your editor, with no build change and no runtime change, and fix things at your own
pace. Then the Compiler, when you enable it, has more it can analyse
([topic 09](09-how-the-compiler-bails-out.md)).

**This is the cheapest high-value change in the phase.** A lint plugin, no build
impact, and it finds real bugs.

## Versions

The 19.2 release post lists:

> **`eslint-plugin-react-hooks` v6** — Flat config by default with **React Compiler
> powered rules**.

That is the release where compiler-powered rules arrived and flat config became the
default. **v7 is the current major** at the time of writing. Both facts get quoted
in different places and appear to contradict each other; they do not — they are
just a year apart.

## Setup

Flat config, with two preset choices:

```js
// eslint.config.js
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  reactHooks.configs.flat.recommended,
];
```

- **`flat.recommended`** — the recommended rules, which now include the
  Compiler-powered ones.
- **`flat['recommended-latest']`** — bleeding-edge experimental compiler rules.
  Useful if you are actively adopting the Compiler and want the newest diagnostics;
  not what you pin a team to.

## The rules

**The two you already know:**

| Rule | What it validates |
|---|---|
| `rules-of-hooks` | components and hooks follow the Rules of Hooks |
| `exhaustive-deps` | dependency arrays contain all necessary dependencies |

`exhaustive-deps` is the one this bible has argued with most —
[Phase 4 · 03](../phase-4-effects/03-the-dependency-array.md) and
[Phase 4 · 11](../phase-4-effects/11-removing-dependencies/README.md) exist largely
to say it is right and to catalogue the legitimate ways to satisfy it.

**The Compiler-powered ones:**

| Rule | What it validates |
|---|---|
| `immutability` | against mutating props, state and other immutable values |
| `purity` | components/hooks are pure, by checking known-impure functions |
| `globals` | against assignment/mutation of globals during render |
| `refs` | correct ref usage — not reading or writing during render |
| `set-state-in-render` | against setting state during render |
| `set-state-in-effect` | against calling `setState` **synchronously** in an effect |
| `static-components` | components are static, not recreated every render |
| `error-boundaries` | error boundaries rather than `try`/`catch` for child errors |
| `component-hook-factories` | against higher-order functions defining nested components or hooks |
| `unsupported-syntax` | against syntax the Compiler does not support |
| `incompatible-library` | against libraries incompatible with memoization |
| `preserve-manual-memoization` | existing manual memoization is preserved |
| `use-memo` | `useMemo` used without a return value |
| `config` | the compiler configuration options themselves |
| `gating` | the gating-mode configuration |

## Reading the diagnostics

Most of these are earlier phases arriving as automated checks, which is the useful
way to read them:

- **`refs`** → [Phase 5 · 01](../phase-5-refs-context-reducers/01-useref.md)'s
  symmetric "do not write *or read* `ref.current` during rendering". This one is
  valuable precisely because the *reading* half is the part people do not know.
- **`set-state-in-effect`** →
  [Phase 4 · 06 · 02](../phase-4-effects/06-you-might-not-need-an-effect/02-chains-of-effects.md).
  Given react.dev's claim that most React performance problems are effect chains,
  a lint rule that finds them is a performance tool as much as a correctness one.
- **`static-components`** → components defined inside components, which remount
  their entire subtree on every parent render — a correctness *and* performance bug
  that is easy to write and hard to spot.
- **`immutability`** and **`purity`** →
  [Phase 2 · Purity](../phase-2-components/02-purity/01-the-two-rules.md). These are
  the two that most often block Compiler coverage.
- **`use-memo`** — a `useMemo` with no return value. Almost always a refactoring
  slip, and it silently produces `undefined`.

Two are about the Compiler's own setup rather than your components — **`config`**
and **`gating`** — so they only fire once you have configured it.

## Where it sits relative to the Compiler

| | Linter | Compiler |
|---|---|---|
| When it runs | editor / CI | build |
| Needs the Compiler installed | **no** | — |
| Finds rule violations | **yes** | no — compiles them anyway |
| Makes code faster | no | yes |
| Effect on coverage | fixing its findings **increases** it | — |

The asymmetry in row three is the one to remember, and it is why
[Phase 0 · 11](../phase-0-how-react-runs/11-the-compiler.md) puts it bluntly:
**compiler for speed, linter for correctness.**

## Gotchas

**Symptom:** the team is waiting to adopt the Compiler before addressing its
diagnostics.
**Cause:** assuming the rules require it.
**Fix:** they do not — the plugin surfaces compiler diagnostics without adoption.
Run them first; it is a lint change with no build impact.

**Symptom:** documentation says v6, npm says v7.
**Cause:** the 19.2 release post is from Oct 2025 and describes the release where
compiler-powered rules arrived; v7 is the current major.
**Fix:** check the version at install time rather than trusting either number.

**Symptom:** experimental rules firing unexpectedly after a config change.
**Cause:** `recommended-latest` rather than `recommended`.
**Fix:** use `flat.recommended` for a team; `recommended-latest` is for actively
tracking the bleeding edge.

**Symptom:** `preserve-manual-memoization` fires on a component you were tidying.
**Cause:** you removed or altered memoization the Compiler was preserving.
**Fix:** leave existing memoization in place unless you have tested the change
([topic 11](11-do-you-still-write-usememo.md)).

**Symptom:** `set-state-in-effect` fires across a large part of the codebase.
**Cause:** effect chains — which react.dev names as the cause of most React
performance problems.
**Fix:** [Phase 4 · 06](../phase-4-effects/06-you-might-not-need-an-effect/README.md).
This is the highest-value set of findings the plugin produces.

**Symptom:** `config` or `gating` rules never fire.
**Cause:** they validate Compiler configuration, which you may not have yet.
**Fix:** expected.

## Interview questions

**★ Do you need the React Compiler to use its lint rules?**
No, and this is the most useful fact about the plugin: compiler diagnostics are
surfaced by the ESLint plugin and **can be used even if your app hasn't adopted the
compiler yet**. So the sensible order is linter first — no build change, no runtime
change, real bugs found — and the Compiler afterwards, by which point it can analyse
more of your code.

**★ How does the linter relate to the Compiler?**
They are complementary and asymmetric. The Compiler makes code faster but is not a
validator — it compiles rule-violating code that it can analyse, silently. The
linter finds those violations but changes nothing at runtime. Compiler for speed,
linter for correctness. And fixing the linter's findings directly increases how much
the Compiler can optimise, because they are the same violations that cause bail-outs.

**★ Name some of the compiler-powered rules and what they map to.**
`immutability` and `purity` cover mutation and impure render logic — the Rules of
React from Phase 2. `refs` catches reading or writing `ref.current` during render.
`set-state-in-effect` catches effect chains, which react.dev calls the cause of most
React performance problems, so it is a performance rule in disguise.
`static-components` catches components defined inside components.
`incompatible-library` and `preserve-manual-memoization` are the Compiler-specific
ones.

**Which version has the compiler-powered rules?**
They arrived in **v6**, announced with React 19.2 alongside flat config becoming the
default. **v7 is the current major.** Both numbers appear in the documentation
because the release post is a year older than the package, which is worth knowing
before assuming one of them is wrong.

**What is the difference between `recommended` and `recommended-latest`?**
`flat.recommended` is the recommended rule set, including the compiler-powered
rules. `flat['recommended-latest']` adds bleeding-edge experimental compiler rules —
useful while actively adopting the Compiler and wanting the newest diagnostics, but
not what you pin a team to, since the rules can change.

---

← Prev: [How the Compiler bails out](09-how-the-compiler-bails-out.md) · Index: [Phase 6](README.md) · Next → [Do you still write `useMemo`?](11-do-you-still-write-usememo.md)
