---
title: "Measure before you guess"
sidebar_label: "01 · Measure before you guess"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 option table read from disk**
> (`sandbox/ts-p0`) — `--diagnostics`, `--extendedDiagnostics`, `--generateTrace`
> and `--generateCpuProfile` are all present, and **their descriptions are quoted
> verbatim** below — and against the **TypeScript wiki's Performance** page.
> ⚠️ **No timing figure on this page is ours**: there is no build sandbox, so the
> page teaches *how to read your own numbers* and quotes none of its own.
> **No console block.**

Every slow-compile investigation goes wrong in the same way: somebody has a theory,
changes a setting, and the build is still slow — but now with a config change nobody
can justify.

> 🔴 **The compiler will tell you where the time went. It has four flags for it, and
> one of them is not in the syllabus for this topic because most people have never
> heard of it.**

## The four flags, in the compiler's own words

| Flag | Description, verbatim from the option table | Use it to |
|---|---|---|
| `--diagnostics` | *(the summary form)* | get the headline counts fast |
| 🔴 `--extendedDiagnostics` | *"Output more detailed compiler performance information after building."* | **see which phase the time is in** |
| 🔴 `--generateTrace` | *"Generates an event trace **and a list of types**."* | find the *file and the type* responsible |
| `--generateCpuProfile` | *"Emit a v8 CPU profile of the compiler run for debugging."* | when the answer is inside the compiler itself |

📌 **Note the second half of `--generateTrace`'s description**: it emits a **list of
types** as well as the event trace. **That is the half that identifies the culprit**
— the trace tells you when time was spent, the type list tells you on what.

⚠️ **`--generateCpuProfile` is a debugging tool for the compiler, not for your
code.** It is the right flag when you suspect the compiler rather than your types,
which is rare and worth knowing is possible.

## 🔴 Read the phase split first, because it changes the whole investigation

`--extendedDiagnostics` breaks the run into phases, and **which phase dominates
tells you what kind of problem you have.** They call for entirely different fixes:

| If the time is in… | The problem is | Look at |
|---|---|---|
| **parse / program construction** | **too many files**, not complex types | `include` globs, `dist/` in the program, barrel files |
| 🔴 **check** | **complex types** | [chunk 02](./02-the-shapes-that-are-slow.md) |
| **bind** | rare — usually enormous files | file size |
| **emit / declaration emit** | output, not checking | [topic 03](../03-build-pipelines/README.md) |

🔴 **This split is the single most valuable thing on the page, because the two common
causes have opposite fixes.** *"Our types are too clever"* and *"we are compiling
nine thousand files we do not need"* both present as "the build is slow", and a
config change aimed at the wrong one does nothing.

📌 **A useful ratio to look at rather than an absolute number: files in the program
versus files you meant to compile.** If it is much larger than one, the problem is
the program, and [topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)'s
`--explainFiles` is the next command — **and it means your gate has also been
checking things you did not intend, which is a coverage finding as well as a
performance one.**

## What "too many files" usually is

Three causes, in rough order of frequency:

1. **A wide `include`** pulling in build output — the same misconfiguration
   [phase 10 · 11 · chunk 01](../../phase-10-strictness/11-typescript-eslint/01-what-type-aware-means.md)
   documents for type-aware linting, where the docs say wide globs *"can heavily
   impact performance"*.
2. 🔴 **Barrel files.** An `index.ts` re-exporting a whole directory means importing
   **one** symbol pulls the **entire** directory into the program. ⚠️ The cost is
   invisible at the import site — one short line — and it compounds when barrels
   import barrels.
3. **`types` not narrowed**, so every `@types/*` package in `node_modules` is
   included whether you use it or not.

## Where the CPU actually goes when checking is slow

⚠️ **Do not reason from what looks complicated.** The checker's own limits, read out
of the 5.9.3 source in
[phase 5 · 09](../../phase-5-type-level/09-type-level-performance/README.md), give
two facts that overturn the usual intuition:

- 🔴 **The expensive work is per-EXPRESSION.** The instantiation counter resets per
  expression, per source element and per deferred node — **so a slow check is
  usually one expression, not a large project.**
- 🔴 **The comparison budget shrinks as the relation cache fills.** Which is why the
  slowdown arrives *gradually*, with no commit responsible, and why a type that is
  fine in a playground is expensive in place.

**Consequence for the method: look for a *file and a type*, not a threshold to
raise.** The trace's type list is what gives you that.

⚠️ **Those constants are 5.9.3's and are explicitly not claimed for the 7.0.2 native
port.** The *method* transfers; the numbers are version-specific.

## The loop that works

1. **`--extendedDiagnostics`** → which phase.
2. **If parse/program**: `--explainFiles`, then fix the globs, the barrels or
   `types`. **Stop — do not touch type-level anything.**
3. **If check**: `--generateTrace`, read the **type list**, find the file.
4. **Change one thing, re-measure.** 🔴 On the same machine, and warm — a cold cache
   or a busy laptop moves the number more than most fixes do.
5. **Only then** consider a lever that costs coverage
   ([topic 01 · chunk 04](../01-type-checking-in-ci/04-making-it-fast-enough.md)).

📌 **Step 4 is where investigations are lost**, and it is the same discipline as
verifying any measurement: if the "slow" and "fast" runs differ in anything besides
the change, the comparison means nothing.

## Gotchas

**Symptom:** a config change was made to speed up the build and nothing improved.
**Cause:** the time was in a different phase from the one the change addressed.
**Fix:** 🔴 `--extendedDiagnostics` first. *Too many files* and *types too complex*
present identically and have opposite fixes.

**Symptom:** the program contains far more files than the project has.
**Cause:** a wide `include`, barrel files, or an un-narrowed `types`.
**Fix:** `--explainFiles`. ⚠️ And note this is simultaneously a **coverage** finding:
the gate has been checking things nobody intended.

**Symptom:** importing one helper made the build noticeably slower.
**Cause:** the import went through a barrel, so the whole directory entered the
program.
**Fix:** import from the module directly. 📌 The cost is invisible at the import
site, which is why barrels accumulate.

**Symptom:** the build got slow over months with no commit responsible.
**Cause:** the comparison budget shrinks as the relation cache fills — phase 5 · 09.
**Fix:** it is still usually one expression. Trace it rather than concluding the
project has outgrown the compiler.

**Symptom:** a fix looked like a large improvement and did not reproduce.
**Cause:** the two runs differed in more than the fix — cold cache, other load, a
different machine.
**Fix:** re-measure warm, on one machine, changing one thing. ⚠️ A confounded
measurement is worse than none, because it gets acted on.

**Symptom:** the trace was generated and is unreadable.
**Cause:** the event trace alone is hard to read by eye.
**Fix:** 🔴 read the **type list** it emits alongside — that is the half that names
the culprit, and it is why the flag's description says *"and a list of types"*.

**Symptom:** the compiler itself is suspected.
**Cause:** occasionally correct.
**Fix:** `--generateCpuProfile` exists for exactly this. ⚠️ Rare — exhaust your own
types first.

## Interview questions

**How do you start on a slow compile?**
`--extendedDiagnostics`, to see which phase the time is in — because *too many
files* and *types too complex* both present as "the build is slow" and have opposite
fixes. Time in parse or program construction means the program is too large; time in
checking means the types are expensive. Changing a setting before knowing which is
how investigations get lost.

**What does `--generateTrace` give you that the diagnostics do not?**
A per-file, per-event view *and a list of types* — its own description says "an
event trace and a list of types". The type list is the half that names the culprit;
the trace alone tells you when time was spent without telling you on what.

**Your program has ten thousand files and the project has four hundred. What now?**
`--explainFiles`, and expect one of three causes: a wide `include` pulling in build
output, barrel files that drag whole directories in through a single import, or an
un-narrowed `types` including every `@types` package installed. It is also a
coverage finding — the gate has been checking things nobody intended.

**Why are barrel files a performance problem?**
Because importing one symbol from an `index.ts` that re-exports a directory pulls
the entire directory into the program. The cost is invisible at the import site — it
is one short line — and it compounds when barrels import other barrels.

**The build got slower over six months and no commit is responsible. Why?**
Because the comparison budget is computed against the relation cache and shrinks as
the project fills it, so the same types get more expensive in place over time. It is
still usually one expression rather than general growth, so the answer is to trace
it rather than to conclude the project has outgrown the tool.

**What is the most common methodological error here?**
Comparing two runs that differ in more than the change — a cold cache, a busy
machine, a different checkout. A confounded measurement is worse than no measurement
because it gets acted on, and the config change it justifies then stays forever.

---

[Topic index](./README.md) · Next → [02 · The shapes that are slow](./02-the-shapes-that-are-slow.md)
