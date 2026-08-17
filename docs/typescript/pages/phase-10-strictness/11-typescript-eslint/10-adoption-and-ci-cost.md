---
title: "Adoption and the CI cost"
sidebar_label: "10 · Adoption and the CI cost"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's** *Getting Started → Typed
> Linting*, *Troubleshooting → Typed Linting → Performance* and *Users → Configs*.
> The three cost quotes are reproduced in
> [chunk 01](./01-what-type-aware-means.md) and are the only figures the project
> publishes. ⚠️ **No multiplier, no timing and no benchmark of our own appears on
> this page** — typescript-eslint is not installed here and there is no sandbox for
> it, and any specific "N× slower" number in circulation is somebody's project
> rather than a general fact. **No console block.**

The syllabus row ends with *"and their CI cost."* [Chunk 01](./01-what-type-aware-means.md)
established what that cost **is** — type-aware lint ≈ one `tsc` run, in the
project's own words. This chunk is what to **do** about it, and the order to turn
the whole topic on.

## 🔴 The arithmetic, stated plainly

A typical CI job runs `tsc --noEmit` and then ESLint. With type-aware rules
enabled, **ESLint builds the program too**:

```
tsc --noEmit        ~T
eslint .            ~T   ← builds the same program again, then lints
                    ───
                     2T
```

**You are running two type-checks per job.** That is the honest complaint, and it
is a different complaint from "the linter is slow" — the linter is doing exactly
what it says it does.

🔴 **And the two runs cannot be merged.** ESLint and `tsc` are separate processes
building separate programs; there is no supported way to hand one's work to the
other. So the levers are only these three, and it is worth being clear that
*making lint faster* is not among them:

| Lever | What it buys | What it costs |
|---|---|---|
| **Run them as parallel CI jobs** | wall-clock back to ~T | machine-time still 2T — you pay in money, not minutes |
| **Scope the type-aware config** | a real reduction in the second T | some files stop being checked by the type-aware rules |
| **Drop `tsc --noEmit`** ⚠️ | one T | ⛔ **do not** — lint reports rule violations, not type errors; they are not substitutes |

⚠️ **That last row is a trap worth naming.** A type-aware lint run *builds* the
program, so a type error will surface as a lint crash or a cascade of `no-unsafe-*`
reports rather than as `TS2322` on the right line. **It is not a type-check**, and a
pipeline that drops `tsc` because "lint already builds it" has replaced precise
diagnostics with noise.

## 🔴 "Only lint the changed files" does not work here

The single most common attempt to reduce the cost, and it does not:

> *"you incur the performance penalty of asking TypeScript to do a build of your
> project before ESLint can do its linting"*

**The build is of the project, not of the file.** Linting one changed file still
requires the whole program, because a type-aware rule needs to resolve types that
live in other files. So a changed-files filter saves the *lint* pass — which is the
cheap half — and pays the *build* in full.

📌 **Same reasoning applies to ESLint's `--cache`**: it can skip re-linting an
unchanged file, but it cannot skip the program build that the rules depend on. Both
techniques are worth keeping for the syntactic rules; neither is the answer to the
type-aware cost.

## The shape that actually reduces it

[Chunk 01](./01-what-type-aware-means.md) introduced the `*-type-checked-only`
variants. This is what they are for:

- **The syntactic config everywhere.** `recommended` needs no type information and
  is cheap enough to run on everything.
- **The type-aware config where it pays**, via a second config block scoped by
  files glob — using the `-only` variant so the syntactic rules are not applied
  twice.

**Where it pays most:** code that touches the outside world — request handlers,
parsers, database access, anything `async`. That is where inherited `any`
([chunk 08](./08-the-rules-that-track-any.md)) and floating promises actually live.

**Where it pays least:** generated clients, fixture and snapshot files, and code
that is already fully typed and does no I/O. ⚠️ **Tests are a genuine judgement
call** — they are full of promises, which argues for including them, and full of
deliberate `any`, which argues against. Decide it explicitly rather than by
accident.

## 🔴 Flags before rules — the topic's ordering principle

The one piece of advice that changes the total work rather than moving it:

> **Every compiler flag you enable first *reduces* the lint work, and never the
> other way round.**

It holds three times over in this topic, each already argued:

| Enable this flag | And this gets smaller |
|---|---|
| `strictNullChecks` | `no-unnecessary-condition` becomes functional at all ([chunk 04](./04-no-unnecessary-condition.md)) |
| `noUncheckedIndexedAccess` | its largest class of false positives disappears ([chunk 04](./04-no-unnecessary-condition.md)) |
| typed boundaries instead of `any` | the `no-unsafe-*` counts collapse ([chunk 08](./08-the-rules-that-track-any.md)) |

📌 **So a team that turns the rules on first meets the worst version of every one of
them**, concludes the rules are noisy, and disables the ones that were about to be
most valuable. The flags are also cheaper: they are configuration, not a diff.

## The order, end to end

1. **`strict`** ([topic 01](../01-strict-flag-by-flag/README.md)), then
   **`noUncheckedIndexedAccess`** ([topic 02](../02-nouncheckedindexedaccess.md)).
2. **`recommended-type-checked`** — the promise rules
   ([02](./02-no-floating-promises.md), [03](./03-no-misused-promises.md)) and the
   `any`-tracking five ([08](./08-the-rules-that-track-any.md)).
3. **The quiet five** from [chunk 09](./09-the-five-that-share-a-prefix.md) — low
   volume, mostly true positives, independent of how well-typed the project is.
4. **`no-unnecessary-condition`**, once the flags above have removed its false
   positives.
5. **`strict-boolean-expressions`**, in the three passes
   [chunk 07](./07-fixing-them-without-breaking-them.md) sets out.

⚠️ **One step per commit, and never a flag and a rule together** — otherwise no
report can be attributed to a cause.

## What to defend if you can only defend one

The topic's phase gate asks whether you would pay a second type-check for
`no-floating-promises` **alone**. The case: it is the one rule here with **zero**
compiler overlap ([chunk 02](./02-no-floating-promises.md)), its failure mode is
silent — an unhandled rejection, a write that never happened, a test that passes
because it finished before the assertion ran — and the bug is invisible in review
because the correct and incorrect code differ by one keyword. 🔴 **A whole class of
production incidents, against a cost you can state in seconds.** That is a
defensible trade, and it is the answer to "is any of this worth it".

## Gotchas

**Symptom:** CI time roughly doubled after enabling type-aware linting.
**Cause:** it is now running two type-checks per job, which is documented behaviour.
**Fix:** parallelise the jobs to recover wall-clock, scope the type-aware config to
recover machine-time, or accept it deliberately. ⚠️ **Do not** drop `tsc --noEmit`
to save the other half.

**Symptom:** linting only changed files did not help.
**Cause:** the program build is per-project, not per-file, and it dominates.
**Fix:** scope by *directory config* rather than by changed files — that genuinely
reduces what gets built and checked.

**Symptom:** lint is far slower than `tsc --noEmit` on the same project, not
roughly equal.
**Cause:** per the performance page, usually a wide `include` pulling in `dist/`,
`coverage/` and generated code ([chunk 01](./01-what-type-aware-means.md)).
**Fix:** `projectService`, which the docs say needs no extra configuration for wide
includes. Treat the discrepancy as misconfiguration, because the documented
expectation is parity.

**Symptom:** CI breaks on a day nobody changed anything.
**Cause:** `strict` and `strict-type-checked` are explicitly **not semver-stable** —
rules can be added outside a major release.
**Fix:** extend `recommended-type-checked` and enable the strict rules you want by
name. A real trade-off, and one to make on purpose.

**Symptom:** the team disables the noisiest rules to get CI green, and the count of
suppressions grows quietly.
**Cause:** the rules were turned on before the compiler flags that make them
tractable.
**Fix:** the ordering above. And apply
[topic 08's](../08-suppression-directives/README.md) rule — **count suppressions,
do not ban them**, because a ban produces a worse workaround.

**Symptom:** someone proposes running the type-aware rules only on a nightly job.
**Cause:** a reasonable-sounding compromise.
**Fix:** ⚠️ consider what it actually buys. The rules find bugs that are cheap to
fix at authoring time and expensive later; moving them to a nightly means they are
found after the branch is merged and the author has moved on. Scoping *what* is
linted is a better lever than *when*.

**Symptom:** the pipeline builds the program three times — `tsc`, lint, and the
bundler.
**Cause:** nobody counted.
**Fix:** count. This is the actual finding on most projects, and it usually makes
the lint pass look far less exceptional than it did.

## Interview questions

**What does type-aware linting actually cost?**
About one `tsc` run — typescript-eslint states that running typed linting is
"generally as slow as type checking that same project", and that lint times "should
be roughly the same as your build times". So a CI job that also runs `tsc --noEmit`
is doing two type-checks. That is the honest framing, and it is a different
statement from "the linter is slow".

**Can you avoid paying twice?**
Not by merging the runs — ESLint and `tsc` build separate programs and neither can
consume the other's work. You can parallelise the jobs to recover wall-clock time,
or scope the type-aware config to the directories where it pays. What you must not
do is drop `tsc --noEmit`, because lint reports rule violations rather than type
errors; a type error surfaces there as noise, not as a diagnostic on the right line.

**Why doesn't linting only the changed files help?**
Because the type-aware rules need a built program, and the build is of the project,
not of the file — resolving a type means reading other files. A changed-files filter
saves the lint pass, which is the cheap half, and pays the build in full. The same
limitation applies to ESLint's `--cache`.

**In what order would you turn all of this on?**
Compiler flags first — `strict`, then `noUncheckedIndexedAccess` — because every one
of them *reduces* the lint work: `no-unnecessary-condition` is non-functional
without `strictNullChecks` and its false positives come from unsound types, and the
`no-unsafe-*` counts are a function of how well the boundaries are typed. Then
`recommended-type-checked`, then the cheap `no-unsafe-*` rules that do not track
`any`, then `no-unnecessary-condition`, then `strict-boolean-expressions` in its own
passes. One step per commit.

**If you could justify only one type-aware rule, which and why?**
`no-floating-promises`. It is the only rule in this topic with zero compiler
overlap — an expression statement that discards its value is legal JavaScript, so
there is no diagnostic to attach — and its failure mode is silent: unhandled
rejections, writes that never happened, tests that pass because they finished early.
The bug differs from correct code by one keyword, so review does not catch it
either. That is a whole class of production incidents for a cost you can state.

**Would you use `strict-type-checked`?**
Only with the semver caveat understood: the project documents that its enabled rules
and options may change outside major versions, so a patch update can fail a build on
a day nothing changed. If the pipeline must be stable against dependency updates,
extend `recommended-type-checked` and add the strict rules by name. The strict
config genuinely finds more bugs — it should be a decision, not a default.

**Where would you not run the type-aware rules?**
Generated clients, fixtures and snapshots, and fully-typed code that does no I/O —
the reports there are few and the cost is the same. The rules pay where values cross
a boundary: handlers, parsers, database access, anything `async`. Tests are a real
judgement call, full of promises (argues for) and deliberate `any` (argues against),
and worth deciding explicitly rather than by default.

**Someone reports "typed linting is 5× slower". How do you read that?**
As a claim about their project, not about the tool. The documentation publishes no
multiplier — only the expectation of parity with build times — so a figure that far
off the documented expectation is evidence of misconfiguration, most often a wide
`include` glob pulling build output into the program. The first thing to check is
whether they are on `projectService`.

---

← [09 · The five that only share a prefix](./09-the-five-that-share-a-prefix.md) · [Topic index](./README.md) · [Phase 10 index](../README.md) · Next topic → **12 · Assertion discipline** *(not written yet)*
