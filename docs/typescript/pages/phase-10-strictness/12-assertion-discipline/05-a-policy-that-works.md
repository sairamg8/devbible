---
title: "A policy that works"
sidebar_label: "05 · A policy that works"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's** rule pages for
> `no-explicit-any`, `no-non-null-assertion`, `no-unnecessary-type-assertion` and
> `no-unsafe-type-assertion`, and against the **TypeScript handbook** for `as const`
> and `satisfies`. ⚠️ typescript-eslint is not installed here, so rule claims are
> documentation-attributed. The policy argument builds on
> [topic 07](../07-unsound-by-design/README.md) and
> [topic 08](../08-suppression-directives/README.md) rather than restating them.
> **No sandbox run, no console block.**

Everything so far has been about a single assertion. This is about the population —
and the phase has been building toward it since
[topic 07](../07-unsound-by-design/README.md) observed that `any`, `as` and `!` are
**the only unsound things you write**, and therefore the only ones a policy can
reach.

## 🔴 Count, do not ban — and here is the mechanism

[Topic 08](../08-suppression-directives/README.md) reached this conclusion for
suppression comments: a ban is honoured and produces a worse workaround, or is
suspended and never reinstated. Assertions give the argument a concrete mechanism,
from [chunk 04](./04-as-any-is-an-exit.md):

> **Banning `as any` converts it into `as any as T` and `as unknown as T` — two
> spellings the `any`-tracking rules cannot see.** The ban does not reduce the
> population; it moves it somewhere your tooling has no visibility.

⚠️ **Which yields the warning topic 08 also gave, now with teeth: the count is
gameable by moving to a wider tier unless you count the whole family together.**
A dashboard showing `as any` alone will report an improving codebase while the
exits migrate.

## What to count

One number, with the tiers visible underneath it:

| Tier | What | Found by |
|---|---|---|
| 1 | `as T` | `no-unsafe-type-assertion`, or a grep 🔴 **excluding `as const`** |
| 2 | `!` | `no-non-null-assertion` — ⚠️ **grep cannot do this** ([chunk 03](./03-the-one-character-claim.md)) |
| 3 | `as any` | `no-explicit-any` plus the `no-unsafe-*` reports it triggers |
| 4 | 🔴 `as any as T` / `as unknown as T` | a dedicated grep — **nothing else sees them** |
| 5 | `@ts-expect-error` / `@ts-ignore` | [topic 08](../08-suppression-directives/README.md)'s ladder |

📌 **Tier 4 is the one to build deliberately**, because it is the only tier with no
tool behind it and the one a ban on tier 3 will inflate.

🔴 **And exclude `as const`, in the tooling and in the written rule.** It requests
more precise inference rather than asserting something doubtful
([chunk 02](./02-what-an-as-is-standing-in-for.md)), so counting it penalises the
safest construct in the language and teaches people to avoid it.

## 🔴 The metric this phase has been building toward

Not the raw count — **assertions added per error fixed**, measured when a strictness
flag is enabled:

> Turn on `noUncheckedIndexedAccess`. It produces 300 errors. If the branch that
> closes them adds 250 assertions, **the flag has been defeated**: the errors are
> gone and none of the underlying uncertainty was resolved.

**Why this is the right measurement and the raw count is not:** the raw count is
a property of the codebase's age and its dependencies, so it says little about the
team. The ratio is a property of *how the work was done*, and it is the number that
predicts whether the next flag will be worth enabling.

⚠️ **A healthy ratio is not zero.** Some errors genuinely resolve to an assertion —
a `find` you can prove hits, a boundary you have validated elsewhere. **A ratio near
1.0 means the flag bought nothing;** a ratio near zero on a large migration usually
means the errors were easy, which is worth knowing too.

## The ratchet, not the cleanup

**Do not set a goal of zero.** Set two rules that a codebase can actually keep:

1. **The number does not grow without a reason in the commit message.** A CI check
   that compares the count against the base branch is enough — it does not have to
   block, it has to be *visible in the diff*.
2. **Every new assertion answers the review question** from
   [chunk 02](./02-what-an-as-is-standing-in-for.md): *what would have to be true
   for this to be deleted?* If the answer is "nothing", it is a design decision in
   the wrong place.

📌 **The asymmetry that makes a ratchet work here:** assertions **never
self-clean**. There is no `TS2578` for them
([chunk 03](./03-the-one-character-claim.md) — `no-unnecessary-type-assertion` is
the closest, and only for the provably redundant), so the population only ever grows
unless something is watching. A one-off cleanup is undone within a quarter; a
ratchet holds.

## Where to spend the effort

Not evenly. [Chunk 02](./02-what-an-as-is-standing-in-for.md)'s taxonomy says where
the leverage is:

| Spend here | Because |
|---|---|
| 🔴 **the boundary** — parsers, handlers, config | one validator removes dozens of assertions **and** the `no-unsafe-*` reports behind them |
| **a signature asserted against three times** | one fix, every caller, including future ones |
| `as X` on config objects | one keyword, `satisfies`, no behaviour change |
| an `as` inside a matching `if` | the compiler was already going to do it |

⚠️ **Do not spend it on** the assertions in tests, or on a `!` in a script — that is
where the ratio of argument to value is worst, and losing the argument there costs
you the policy everywhere else.

## The end state worth aiming at

A number that is **not zero, is known, and does not grow** — with every entry
traceable to a decision somebody made on purpose. That is a materially different
codebase from one with the same count and no idea what is in it, and the difference
is entirely in whether anyone is looking.

## Gotchas

**Symptom:** the `as any` count is falling and the bug rate is not.
**Cause:** migration to the double-assertion spellings, which nothing reports.
**Fix:** 🔴 count tier 4 explicitly. A ban on tier 3 with no tier 4 grep produces
exactly this graph.

**Symptom:** a policy of "no assertions" is adopted and quietly abandoned.
**Cause:** zero is not reachable — some assertions are correct and have no better
spelling.
**Fix:** the ratchet. A count that cannot grow without a note is enforceable; a
count of zero is not, and an abandoned rule is worse than none because it teaches
people the rules are decorative.

**Symptom:** the assertion count jumps after enabling a strictness flag, and it is
treated as a failure of the flag.
**Cause:** it is a failure of the migration.
**Fix:** measure assertions per error fixed. The flag exposed real uncertainty; the
question is whether the branch resolved it or annotated it away.

**Symptom:** `as const` shows up in the count and people start avoiding it.
**Cause:** the metric greps for `as `.
**Fix:** exclude it. 🔴 A metric that penalises the one assertion that cannot be
wrong is training the team away from precision.

**Symptom:** the `!` count is zero and nobody believes it.
**Cause:** somebody grepped for `!`, got thousands of hits from negation and `!==`,
and gave up.
**Fix:** `no-non-null-assertion`. This is the tier that needs a type-aware tool and
therefore the tier most often reported as "we don't have that problem".

**Symptom:** review comments on assertions never change anything.
**Cause:** "avoid `as`" is not actionable.
**Fix:** ask which of chunk 02's six substitutions it is. Two of them are one-line
fixes, which is what converts a style argument into a merged commit.

**Symptom:** the policy is enforced strictly in tests and loosely at the boundary.
**Cause:** tests are where the assertions are easiest to see.
**Fix:** ⚠️ exactly backwards. The boundary assertions are the ones that fail in
production; the test ones fail in CI, which is what CI is for.

## Interview questions

**Should a team ban `as any`?**
No — count it, along with everything else in the family. A ban on that one spelling
converts it into `as any as T` and `as unknown as T`, which the `any`-tracking rules
cannot see because the resulting type is `T`. The population does not shrink, it
moves somewhere the tooling is blind, and the dashboard improves while the codebase
does not.

**What would you actually measure?**
Assertions added per error fixed, taken when a strictness flag is enabled. The raw
count is mostly a property of the codebase's age and its dependencies; the ratio is
a property of how the migration was done, and it is the number that tells you
whether the next flag is worth enabling. A ratio near 1.0 means the flag bought
nothing.

**Why not aim for zero assertions?**
Because some are correct and have no better spelling — a controlled test double, a
lookup you can prove hits, a boundary validated elsewhere — and a goal that cannot
be met gets abandoned, which teaches people the rules are decorative. A ratchet that
prevents growth is enforceable and survives.

**Why does a ratchet work particularly well for assertions?**
Because they never self-clean. There is no `TS2578` equivalent, so an assertion that
became unnecessary stays until someone removes it deliberately — the population only
grows. That makes a one-off cleanup pointless within a quarter and a
does-not-increase rule genuinely effective.

**What do you exclude from the count, and why?**
`as const`. It asks the compiler to infer more precisely rather than to accept a
claim it doubts, and the language restricts it to literals, so it cannot be aimed at
anything it could be wrong about. Counting it penalises the safest construct
available and pushes people away from it — the opposite of what the policy is for.

**Where do you spend the fixing effort?**
At the boundaries — parsers, request handlers, config loading. One validator removes
dozens of assertions and the `no-unsafe-*` reports behind them at the same time.
After that, any signature that has been asserted against three or more times, since
one fix serves every caller. Not on tests, where the argument costs more than the
value.

**How do you make an assertion review productive?**
By replacing "avoid this" with "what is it standing in for" — a guard, a validator,
a predicate, a better upstream type, `satisfies`, or nothing at all. Each has a
different fix and two of them are one-line changes, so the conversation ends in a
commit rather than in a disagreement about style.

---

← [04 · `as any` is an exit](./04-as-any-is-an-exit.md) · [Topic index](./README.md) · [Phase 10 index](../README.md)
