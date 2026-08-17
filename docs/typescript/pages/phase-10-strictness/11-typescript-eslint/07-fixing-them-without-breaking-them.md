---
title: "Fixing them without breaking them"
sidebar_label: "07 · Fixing them without breaking them"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **ECMAScript specification** for `ToBoolean`, for
> `??` and its deliberate refusal to mix with `||`/`&&` without parentheses, and for
> `Number.isFinite`; against **MDN** for *Nullish coalescing* and *Falsy*; and
> against **typescript-eslint's** `strict-boolean-expressions` and
> `prefer-nullish-coalescing` pages for options and defaults.
> ⚠️ typescript-eslint is not installed here, so rule behaviour is
> documentation-attributed — in particular **nothing here claims what the rule's
> fixer does**; the argument is about what a fixer *could* know.
> **No sandbox, no console block.**

[Chunk 06](./06-the-conditions-you-get-wrong.md) is the catalogue. This is the part
that goes wrong in the pull request: **half of these fixes change runtime
behaviour**, and a bulk lint sweep is exactly the review in which nobody looks for
that.

## The fixes, and what each one changes

| You wrote | You probably meant | Write | Runtime delta |
|---|---|---|---|
| `if (str)` | not empty | `str !== ''` | none |
| `if (str)` | supplied | `str != null` | 🔴 `''` now takes the true branch |
| `if (n)` | non-zero | `n !== 0` | 🔴 **`NaN` now takes the true branch** |
| `if (n)` | a usable number | `Number.isFinite(n)` | `0` now takes the true branch |
| `x \|\| d` | default when absent | `x ?? d` | 🔴 `0`/`''`/`false` no longer defaulted |
| `if (enumVal)` | supplied | `enumVal !== undefined` | 🔴 the zero member now takes the true branch |
| `if (obj)` | supplied | `obj != null` | none — [chunk 05](./05-strict-boolean-expressions.md)'s allowed case |
| `{n && <X/>}` | show when non-zero | `{n > 0 && <X/>}` | 🔴 stops rendering a literal `0` |

🔴 **Four of the eight change behaviour.** Three of those four are the *point* — the
old behaviour was the bug. The `NaN` row is the one that is not.

## 🔴 The one fix that makes things worse

```ts
const n = Number(input)

if (n) { … }              // NaN is falsy → parse failure rejected
if (n !== 0) { … }        // NaN !== 0 is TRUE → parse failure accepted
```

**The truthiness check was accidentally doing two jobs** — rejecting zero *and*
rejecting a failed parse — and the mechanical rewrite keeps only the first. The
`NaN` then propagates silently through every arithmetic operation it touches,
surfacing somewhere with no connection to the line that was "fixed".

Decide which question you are asking:

```ts
if (Number.isFinite(n) && n !== 0) { … }   // usable and non-zero
if (Number.isFinite(n)) { … }              // parsed successfully
```

⚠️ **Use `Number.isFinite`, not the global `isFinite`.** The global coerces its
argument first, so `isFinite('42')` is `true` and it will happily accept the string
you were trying to detect. Same trap as `isNaN` versus `Number.isNaN`.

📌 **The general lesson is worth more than the case:** a truthiness check can be
load-bearing for a reason nobody wrote down. Before replacing one, ask what *else*
in the type is falsy — that is the set of values whose behaviour you are about to
change.

## Why this cannot be a mechanical edit

`if (str)` might mean "not empty" or "was supplied", and those are **different
programs** for the input `''`. No tool can choose between them, because the
information needed was never written down anywhere — not in the type, not in the
condition, not in a test that distinguishes the two.

🔴 **That is the deeper point of the rule.** It is not asking you to change a
spelling; it is asking you to *record a decision* that has been implicit since the
line was written. The report is the first time anyone has been made to state it.

⚠️ **So treat a bulk fix as a behaviour change under review, not a lint sweep.**
Every row in the table above with a delta is a place where the diff does something
the reviewer cannot see from the diff. In practice that means: small commits, one
option at a time, and a note in the description saying which values change branch.

## The rollout, in the order that survives review

1. **Leave the defaults on first.** They report nullable values only, every report
   is a genuine ambiguity, and there are far fewer than you expect.
2. **Then `allowNumber: false`, on its own.** This is where the JSX `0` and the
   `.length` idioms surface. Highest value per report, and small enough to read.
3. **Then `allowString: false`.** Usually the largest pass and the most mechanical —
   and the one to split by directory if it does not fit in a single review.
4. ⚠️ **Never in the same commit as a compiler flag change.**
   `noUncheckedIndexedAccess` moves this rule's count on its own
   ([topic 02](../02-nouncheckedindexedaccess.md)); if both land together, no report
   can be attributed to either.

📌 **Do the `??` migration as its own pass**, driven by `prefer-nullish-coalescing`
rather than by hand. It is bug 2 repeated across a codebase, and it has the highest
ratio of real bugs to churn of anything in this topic — but it is also the pass most
likely to change behaviour in a place nobody was thinking about, which is precisely
why it should not be mixed into another one.

## Gotchas

**Symptom:** replacing `if (n)` with `if (n !== 0)` clears the lint report and
introduces a `NaN` in production.
**Cause:** `NaN !== 0` is `true`, so the parse failure that truthiness happened to
reject now passes.
**Fix:** `Number.isFinite(n)`. 🔴 **The only case in the language where the explicit
spelling is less safe than the truthiness it replaced** — check it by hand before
any bulk fix.

**Symptom:** the `Number.isFinite` fix is applied and a string still gets through.
**Cause:** the global `isFinite` was used instead of `Number.isFinite`; it coerces,
so `isFinite('42')` is `true`.
**Fix:** always the `Number.` form, for both `isFinite` and `isNaN`.

**Symptom:** switching `||` to `??` changes behaviour somewhere unrelated.
**Cause:** it is supposed to — but only where the left operand can be `0`, `''`,
`false`, `NaN` or `0n`.
**Fix:** apply it per site with the operand's type in view. For a `T | undefined`
where `T` is an object type the two are identical and the change is pure noise, so
a blanket search-and-replace produces a large diff whose interesting rows are
invisible.

**Symptom:** `??` next to `||` or `&&` is a syntax error.
**Cause:** the language forbids mixing them without parentheses, deliberately,
because any precedence choice would be a guess.
**Fix:** parenthesise the intent. 📌 Worth noticing as a design decision: the
committee treated the ambiguity as unacceptable rather than picking a default —
the same judgement this rule makes about conditions.

**Symptom:** a codemod fixed hundreds of sites and the test suite still passes.
**Cause:** that is expected and proves little. These bugs live on inputs the tests
mostly do not have — the empty string, the zero, the failed parse, the first enum
member.
**Fix:** do not take a green suite as evidence for this class of change. Review the
rows with a runtime delta by hand, and add the missing cases as tests while you are
there — they are the tests that were absent all along.

**Symptom:** the strict pass produces a diff too large for anyone to review
honestly.
**Cause:** `allowString: false` on a mature codebase touches everything.
**Fix:** split it by directory and land it over several commits. ⚠️ A review that
nobody actually reads is worse than no review, because it launders the behaviour
changes hidden in it.

**Symptom:** the same condition gets "fixed" twice, in opposite directions, by two
people.
**Cause:** `no-unnecessary-condition` and `strict-boolean-expressions` can fire on
neighbouring lines, and they pull opposite ways — delete the check versus make it
explicit ([chunk 04](./04-no-unnecessary-condition.md)).
**Fix:** read which rule fired before touching the line.

## Interview questions

**Is making a condition explicit always safer?**
No, and `NaN` is the counter-example. `if (n)` rejects a failed parse because `NaN`
is falsy; `if (n !== 0)` accepts it, because `NaN !== 0` is `true`. The mechanical
fix admits a value the original rejected. If the question is "is this a usable
number", the answer is `Number.isFinite(n)` — and it is worth checking by hand
during any bulk fix, because it is the one row of the table where the lint report
leads you somewhere worse.

**How is `??` different from `||`, and when does the difference matter?**
`||` tests truthiness, `??` tests only `null` and `undefined`. They differ exactly
when the left operand can be a falsy value of its own type — `0`, `''`, `false`,
`NaN`, `0n`. For an object-typed value they are identical. So the migration is worth
doing per site with the type in view rather than by search-and-replace, and it is
the highest-value pass in this topic.

**Why can't a linter auto-fix these?**
Because half the fixes change runtime behaviour and the tool cannot know which
behaviour was intended. `if (str)` might mean "not empty" or "was supplied", and
those produce different programs for `''`. The information needed to choose was
never written down — which is the deeper point of the rule: it asks you to record a
decision, not to change a spelling.

**How would you roll this rule out on a large codebase?**
In three passes, using the option matrix as the schedule: defaults first (nullable
values only, few reports, each one real), then `allowNumber: false` (the JSX and
`.length` cases, highest value per report), then `allowString: false` (largest and
most mechanical, split by directory if needed). Never in the same commit as
`noUncheckedIndexedAccess` or any other flag that moves the count, or nothing can be
attributed.

**Your test suite passes after the migration. What has that told you?**
Very little. These bugs live on inputs a suite usually lacks — the empty string, the
zero, the `NaN`, the first enum member — which is why they survived to be found by a
linter rather than by a test. The green suite is evidence that nothing *else* broke;
the rows with a runtime delta still need reading, and the honest move is to add the
missing cases as tests during the migration.

**When would you decide the rule is not worth it for your project?**
If `''`, `0` and `false` are not meaningful values anywhere in the domain, then the
strict options report style rather than bugs, and the honest response is to
configure it down to the nullable checks rather than disable it. That keeps the half
that is unambiguously about correctness — a nullable value in a condition — and
drops the half that is about house convention.

**Two rules fired on adjacent lines and their advice conflicts. What is going on?**
`no-unnecessary-condition` says the check is already decided and should be deleted;
`strict-boolean-expressions` says the check is ambiguous and should be made
explicit. They are complements, not duplicates, and applying the wrong one leaves a
line worse than it started. Read the rule name in the report before editing.

---

← [06 · The conditions you get wrong](./06-the-conditions-you-get-wrong.md) · [Topic index](./README.md) · Next → **08 · The `no-unsafe-*` family** *(not written yet)*
