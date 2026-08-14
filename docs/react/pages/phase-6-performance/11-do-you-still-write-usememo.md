---
title: "Do you still write useMemo?"
sidebar_label: "11 · Do you still write useMemo?"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **babel-plugin-react-compiler 1.0.0**, from
> documentation — react.dev
> [React Compiler · Introduction](https://react.dev/learn/react-compiler/introduction)
> and [`eslint-plugin-react-hooks`](https://react.dev/reference/eslint-plugin-react-hooks)
> (`preserve-manual-memoization`).
> No sandbox script backs this page; claims are cited, not measured.

**The question everyone asks on day one of adopting the Compiler, answered by the
docs more conservatively than people expect: mostly yes for existing code, mostly
no for new code, and the exception is specific enough to name.**

## The two-sentence answer

> For **existing code**, we recommend either **leaving existing memoization in
> place (removing it can change compilation output)** or carefully testing before
> removing the memoization.

> For **new code**, we recommend **relying on the compiler for memoization** and
> using `useMemo`/`useCallback` where needed to achieve precise control.

Different answers for existing and new code, which is unusual advice and worth
noticing. There is no migration being asked for.

## 🔴 Why not just delete them

Not caution for its own sake — a mechanism:

> removing it **can change compilation output**

Your `useMemo` is an **input to the Compiler's analysis**, not redundant work it
politely steps around. There is even a lint rule dedicated to this —
**`preserve-manual-memoization`**, which *"validates that existing manual
memoization is preserved by the compiler"*
([topic 10](10-eslint-plugin-react-hooks.md)).

So a codemod that strips every `useMemo` and `useCallback` is not a no-op cleanup.
It is a behavioural change across every file it touches, with no test that
specifically covers it, in exchange for a diff nobody asked for.

And the second reason, from [topic 03](03-usememo.md): **two of `useMemo`'s three
documented purposes are about referential identity**, not cost. Deleting one that
exists for identity can change what a dependency array sees, which is a correctness
change, not a performance one.

## The exception, named

> The `useMemo` and `useCallback` hooks can continue to be used with React Compiler
> as an **escape hatch to provide control over which values are memoized.** A common
> use-case for this is **if a memoized value is used as an effect dependency**, in
> order to ensure that an effect does not fire repeatedly even when its dependencies
> do not meaningfully change.

That is the one to keep writing by hand. The reason it survives is that the
Compiler's job is to make rendering cheaper, while an effect dependency is about
**when an effect re-runs** — a semantic concern, not a performance one
([Phase 4 · 11 · 01](../phase-4-effects/11-removing-dependencies/01-objects-and-functions.md)).

You are not asking for a cache there. You are asking for a *stable identity* so
that a WebSocket does not reconnect. Leaving that to an optimiser — something
explicitly allowed to change its mind — would be trusting a performance tool with a
correctness requirement.

## What to keep, what to stop writing

| | With the Compiler on |
|---|---|
| `useMemo` for an **expensive calculation** | stop writing it — this is what it automates |
| `useMemo` for a **prop to a `memo` child** | stop — cascading re-renders are automated |
| `useMemo` for an **effect dependency** | **keep writing it** — the documented escape hatch |
| `useCallback` for a **`memo` child** | stop |
| `useCallback` for a **Hook dependency** | **keep** — same reasoning |
| `memo` on a component | mostly redundant; leave existing ones |
| **`children` composition** | **keep — the Compiler does not do this** |
| **Moving state down** | **keep — the Compiler does not do this** |

The bottom two rows are the point. The Compiler automates *caching*; it does not
restructure your tree ([topic 06](06-the-memoization-trap.md),
[topic 13](13-moving-state-down.md)). Those fixes remove work rather than
remembering it, help the first render as well as updates, and cannot be silently
broken.

## Migration order for an existing codebase

1. **Linter first**, without the Compiler — you get every diagnostic with no build
   change ([topic 10](10-eslint-plugin-react-hooks.md)).
2. **Fix `immutability` and `purity`**, which are real bugs and also the main
   blockers on coverage.
3. **Enable the Compiler** with `panicThreshold: 'none'`; verify with the
   **"Memo ✨"** badge ([topic 08](08-installing-the-compiler.md)).
4. **Change nothing about existing memoization.**
5. **Measure** ([topic 05](05-measure-before-you-optimise.md)).
6. **Stop writing new memoization** except for effect dependencies.
7. **Delete opportunistically** — as Phase 0 puts it, when you are already editing
   the file, and **never a `useMemo` that exists for referential identity without
   checking what depends on it.**

Step 4 is the one people want to skip, and step 7 is the disciplined version of
skipping it.

## The honest summary

- **Nothing is deprecated.** `useMemo`, `useCallback` and `memo` remain supported
  and documented, demoted from routine tool to precision instrument.
- **New code needs far less of them** — the mechanical cases are automated.
- **One case still needs them by hand:** a value used as an effect dependency.
- **Existing code should mostly be left alone**, because removing memoization
  changes compiler output and there is a lint rule guarding it.
- **Composition is unaffected and still wins.**

## Gotchas

**Symptom:** a codemod stripped every `useMemo` and behaviour changed.
**Cause:** removing manual memoization changes compilation output, and some of those
existed for identity rather than cost.
**Fix:** revert. Delete opportunistically, per file, with tests.

**Symptom:** an effect starts re-firing after "cleaning up" memoization.
**Cause:** a `useMemo` that existed to stabilise an effect dependency was removed.
**Fix:** that is the documented escape hatch — keep it.

**Symptom:** `preserve-manual-memoization` fires during a tidy-up.
**Cause:** the change interferes with memoization the Compiler was preserving.
**Fix:** leave it, or test carefully.

**Symptom:** new code is still full of `useCallback` after adopting the Compiler.
**Cause:** habit.
**Fix:** for new code the docs say rely on the Compiler, reaching for the hooks only
for precise control.

**Symptom:** composition work was reverted because "the Compiler handles it now".
**Cause:** assuming it restructures code.
**Fix:** it memoizes; it does not compose. `children` and local state still win.

**Symptom:** the team cannot agree whether adoption helped.
**Cause:** no measurement, and possibly low coverage.
**Fix:** the badge for coverage, `<Profiler>` for effect — the Compiler's benefit is
a claim like any other.

## Interview questions

**★ With the Compiler on, do you still write `useMemo`?**
For new code, mostly no — the docs say to rely on the compiler and use the hooks
only for precise control. For existing code, the recommendation is to leave
memoization in place or test carefully before removing it, because **removing it can
change compilation output**: your `useMemo` is an input to the analysis, and there is
a `preserve-manual-memoization` lint rule guarding exactly that.

**★ What is the one case that still needs manual memoization?**
A memoized value used as an **effect dependency**, which the docs name explicitly —
to ensure an effect does not re-fire when its dependencies have not meaningfully
changed. It survives because it is not a performance concern at all: you want a
stable identity so a subscription does not tear down and rebuild. Leaving a
correctness requirement to an optimiser that is allowed to change its mind would be
the wrong trade.

**★ What order would you migrate an existing codebase in?**
Linter first without the Compiler, since it surfaces every compiler diagnostic with
no build change. Fix `immutability` and `purity`, which are real bugs and the main
blockers on coverage. Enable the Compiler with `panicThreshold: 'none'` and verify
with the "Memo ✨" badge. Change nothing about existing memoization. Measure. Then
stop writing new memoization except for effect dependencies, and delete old ones
opportunistically when already editing a file.

**Does the Compiler make composition work redundant?**
No, and this is the most common wrong conclusion. It automates caching, not
structure — it will not make a wrapper accept `children`, and it will not move state
down. Those remove work rather than remembering it, help the first render as well as
updates, and cannot be silently broken by a later refactor. They remain the better
fix with the Compiler on.

**Is `useMemo` deprecated?**
No. It, `useCallback` and `memo` remain supported and documented; they are demoted
from a routine tool to a precision one. The docs describe them as an escape hatch
for control over which values are memoized, which is a smaller role, not a removed
one.

---

← Prev: [`eslint-plugin-react-hooks`](10-eslint-plugin-react-hooks.md) · Index: [Phase 6](README.md) · Next → [Lazy loading components](12-lazy-loading.md)
