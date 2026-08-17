---
title: "What the gate guarantees"
sidebar_label: "02 · What the gate guarantees"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** for `files`, `include`,
> `exclude`, `noEmit` and `skipLibCheck`, and against the **TypeScript 5.9.3 option
> table read from disk** (`sandbox/ts-p0`) for `--explainFiles`, `--listFiles`,
> `--listFilesOnly` and `--showConfig`, whose descriptions are quoted **verbatim**
> below. ⚠️ **No timing figure here is ours.** **No console block.**

[Chunk 01](./01-the-green-build-that-proves-nothing.md) argued that a gate must
exist. This chunk is the other half, and it is the one people skip:

> 🔴 **`tsc --noEmit` checks *the program you configured*. It says nothing about
> files that are not in it — and a green run is compatible with an entire directory
> never having been looked at.**

Adding the step is easy. Knowing what it covers is the work.

## What a green run actually claims

Precisely this, and no more:

> *Every file in the program is internally consistent under this configuration.*

**Which leaves four things it does not claim**, all of them routinely assumed:

| Not claimed | Why |
|---|---|
| your code is **correct** | consistent ≠ right; the types can be faithfully wrong |
| **runtime data** matches its type | nothing crossed a boundary was checked ([phase 10 · 13](../../phase-10-strictness/13-unknown-first-apis.md)) |
| files **outside** the program are fine | they were not read |
| another config would pass | a different `tsconfig` is a different program |

## 🔴 The files that quietly are not in the program

This is where green runs come from on codebases that have errors:

- **Config and script files at the root** — `vite.config.ts`, `scripts/*.ts`,
  `*.config.ts`. Frequently outside `include`, and frequently the files doing the
  riskiest untyped work.
- **Tests**, when `exclude` lists them so the *build* config stays clean — and then
  nothing else checks them.
- **`.js` files**, unless `allowJs` **and** `checkJs` are on. A migration that still
  has JavaScript in it has a checked half and an unchecked half.
- **Files reachable only by dynamic import** or by a string path, which the import
  graph cannot follow.

⚠️ **And the one that surprises people: `exclude` does not remove a file from the
program if something in the program imports it.** `exclude` filters what `include`
*finds*; it is not a firewall. A file can be excluded by glob and still be compiled
because a reachable module imports it — so `exclude` is unreliable as a way of
*not* checking something, and equally unreliable as a way of predicting what got
checked.

## 🔴 The multi-config hole

The most common structural gap, and the one worth checking first on any real
project. A modern app template ships **several** `tsconfig` files — an app config, a
Node/tooling config, sometimes a build config — with a root config that only
references them.

**`tsc --noEmit` runs one configuration.** Pointed at a root config that is a
solution file of references, it can do almost nothing while exiting zero.

⚠️ **The fix is to check what the command covered rather than to assume**, and for
a referenced project layout the build-mode invocation (`tsc -b`) is what walks the
references. **Verify, do not reason about it** — the flags below exist for exactly
this.

## The four flags that tell you what was checked

All four are in the compiler's own option table; the descriptions are its own words:

| Flag | Description, verbatim |
|---|---|
| 🔴 `--explainFiles` | *"Print names of files and the reason they are part of the compilation."* |
| `--listFiles` | *"Print all of the files read during the compilation."* |
| `--listFilesOnly` | list the files and stop |
| 🔴 `--showConfig` | *"Print the final configuration instead of building."* |

📌 **`--explainFiles` is the one to reach for**, because the *reason* is the answer
you actually need — it distinguishes "matched by `include`" from "imported by
another file" from "pulled in by `types`", which is precisely the distinction the
`exclude` trap turns on.

📌 **`--showConfig` settles arguments about inheritance.** With `extends` chains
across a monorepo, the config that is *in effect* is often not the one anyone has
read.

## `skipLibCheck` shrinks the guarantee, deliberately

It skips type checking **inside** `.d.ts` files. Your call sites against those
declarations are still checked — so it is a real reduction in what the gate covers,
in a region most teams accept losing.

⚠️ **Two things it is not**, both already settled in this corpus and neither to be
re-argued here: it is **not a suppression mechanism**
([phase 10 · 08 · chunk 03](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md))
— it cannot affect assignability at your call sites — and its **correctness** trade
belongs to [phase 7](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md).
Its *performance* framing is **topic 08 of this phase** *(not written yet)*.

## 🔴 Test the gate, or you do not have one

The step that gets skipped and should not:

> **Break something on purpose and confirm CI goes red.**

An untested gate is indistinguishable from a green one that runs nothing — a wrong
path, a config that resolves to zero files, a `|| true` someone added during an
incident and never removed, a script that exits zero because it lost the exit code
through a pipe. **All of those produce a passing job and no signal.**

📌 **Do it again whenever the config moves.** Adding a project reference, splitting
a config, or moving to a monorepo tool are all changes that can silently shrink the
program the gate covers, and none of them makes CI go red when they do.

## Gotchas

**Symptom:** `tsc --noEmit` passes and the editor shows errors in `vite.config.ts`.
**Cause:** the file is not in the program — usually outside `include`.
**Fix:** `--explainFiles`. 🔴 Root-level config and script files are the most common
unchecked region, and disproportionately the place doing untyped work.

**Symptom:** a file is in `exclude` and is still being compiled.
**Cause:** something in the program imports it. `exclude` filters what `include`
finds; it is not a firewall.
**Fix:** ⚠️ do not use `exclude` to reason about coverage in either direction — ask
the compiler with `--explainFiles`.

**Symptom:** the gate passes in seconds on a large monorepo.
**Cause:** it is pointed at a config that references other projects and checks
almost nothing itself.
**Fix:** `--listFilesOnly` to see the size of what it looked at, and build mode to
walk the references. **A suspiciously fast gate is the tell.**

**Symptom:** tests have type errors that CI never reports.
**Cause:** they are excluded from the config the gate runs.
**Fix:** check them, in their own config if the build config must stay clean. ⚠️
Test files are where `as any` accumulates
([phase 10 · 12](../../phase-10-strictness/12-assertion-discipline/README.md)), so
an unchecked test directory hides the assertions as well as the errors.

**Symptom:** two engineers disagree about a compiler option and both have read a
`tsconfig`.
**Cause:** `extends` — the effective config is the merge, not the file.
**Fix:** `--showConfig` prints the final configuration. It ends the argument in one
command.

**Symptom:** CI has been green for months and a bulk `tsc` run locally reports two
hundred errors.
**Cause:** the gate is not running what you think — a shell pipeline swallowing the
exit code, a wrong path, or a `|| true`.
**Fix:** 🔴 break something deliberately and confirm the job fails. This should be
part of setting the gate up, not a thing discovered later.

**Symptom:** a green gate, and a `TypeError` from data the type said was a `User`.
**Cause:** the gate checks consistency, not reality — nothing verified what crossed
the boundary.
**Fix:** that is [phase 10 · 13](../../phase-10-strictness/13-unknown-first-apis.md)'s
job, not the gate's. ⚠️ Expecting the type checker to catch it is the misunderstanding
that makes teams distrust the gate for failing at something it never claimed.

## Interview questions

**What does a green `tsc --noEmit` actually guarantee?**
That every file **in the program** is internally consistent under **that**
configuration. It does not say the code is correct, that runtime data matches its
types, that files outside the program are fine, or that a different config would
pass. Most surprises come from the second word: the program is smaller than people
assume.

**How do you find out what is actually being checked?**
`--explainFiles`, whose own description is "print names of files and the reason they
are part of the compilation". The *reason* is the useful part — it tells you whether
a file arrived via `include`, via an import, or via `types`, which is exactly the
distinction that makes `exclude` misleading. `--showConfig` settles what the
effective configuration is after `extends`.

**A file is listed in `exclude` and it is still being compiled. Why?**
Because `exclude` filters what `include` finds; it does not prevent a file entering
the program by being imported. If anything reachable imports it, it is in. So
`exclude` cannot be relied on either to guarantee something is checked or to
guarantee it is not.

**Your monorepo's type-check job finishes in four seconds. Is that good?**
It is suspicious. A root config that only references other projects checks almost
nothing itself while exiting zero. Check the size of the program with
`--listFilesOnly` and use build mode so the references are walked. A fast gate is
more often a small one than an efficient one.

**Does `skipLibCheck` weaken the gate?**
Yes, deliberately and in a bounded way: it skips checking inside `.d.ts` files while
still checking your call sites against them. It is a real reduction in coverage that
most teams accept. What it is not is a suppression mechanism — it cannot change
assignability at your own call sites, so it will not silence an error it is
repeatedly proposed as a fix for.

**How do you know the gate works?**
Break something on purpose and watch CI go red. An untested gate is
indistinguishable from one that runs nothing, and there are several ways to get a
passing job with no signal — a wrong path, a config resolving to zero files, a lost
exit code in a shell pipeline, a `|| true` added during an incident. Re-test
whenever the config layout changes, because splitting or referencing configs can
shrink the program silently.

---

← [01 · The green build that proves nothing](./01-the-green-build-that-proves-nothing.md) · [Topic index](./README.md) · Next → **03 · Where the gate goes** *(not written yet)*
