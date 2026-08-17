---
title: "Making it fast enough to be required"
sidebar_label: "04 · Fast enough to be required"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** for `incremental`,
> `tsBuildInfoFile`, `composite`, `skipLibCheck` and `--build`, and the
> **TypeScript handbook**. The type-checking cost model is
> [phase 5 · 09](../../phase-5-type-level/09-type-level-performance/README.md)'s,
> read from the 5.9.3 checker and **linked rather than re-derived**. ⚠️ **No timing
> figure on this page is ours** — there is no sandbox for a build pipeline, and the
> compiler's own speed claims belong to
> [phase 0 · 07](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md).
> **No console block.**

> 🔴 **Speed is a correctness concern here, not a comfort one.** A gate that takes
> too long does not stay a gate: it gets moved off the pull request, made advisory,
> scoped to a subset, or skipped with a label — and each of those is a decision to
> check less, taken for a reason that has nothing to do with types.

So the question is not *how fast can it be* but **how fast does it need to be to
survive as a required check.** Everything below is ordered by the only distinction
that matters.

## 🔴 Levers that cost you nothing

| Lever | What it does |
|---|---|
| **`incremental: true`** | writes `.tsbuildinfo` so the next run reuses prior work — ⚠️ **useless in CI unless the file is cached between runs** ([phase 6 · 14](../../phase-6-modules-build/14-incremental-builds/README.md) owns what invalidates it) |
| **Project references + `tsc -b`** | rebuilds only the projects whose inputs changed ([phase 6 · 13](../../phase-6-modules-build/13-project-references/README.md)) |
| 🔴 **Excluding build output from the program** | stops the compiler parsing `dist/`, `coverage/` and generated clients |
| **The native compiler** | [phase 0 · 07](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md) — its speed claims are there, not here |
| **More memory on the runner** | unglamorous, frequently the actual answer |

⚠️ **`incremental` in CI is the one that is usually configured and never works.**
Each job starts from a clean checkout, so `.tsbuildinfo` does not exist and the flag
buys nothing. It has to be restored from the CI cache with a key that changes when
the sources do — **and depth on that belongs to this phase's topic 09 · Caching
TypeScript in CI and Docker** *(not written yet)*.

📌 **Excluding `dist/` is free; excluding `src/legacy/` is not.** Both make the run
faster and only the first leaves the guarantee intact — which is
[chunk 02](./02-what-the-gate-guarantees.md)'s point arriving as a performance
decision. **Every "make it faster by checking less" change is a coverage change,
and should be reviewed as one.**

## Levers that trade guarantee for speed

| Lever | What you give up |
|---|---|
| `skipLibCheck` | checking **inside** `.d.ts` files — bounded, and widely accepted ([chunk 02](./02-what-the-gate-guarantees.md)) |
| a narrower `include` | whatever you removed, entirely |
| running only on changed **projects** | cross-project breakage, unless references model the dependencies correctly |
| moving it to nightly | ⚠️ **it stops being a gate** — see [chunk 05](./05-when-the-gate-fails.md) |

🔴 **Only the first belongs in the "usually fine" column.** The rest are a smaller
gate wearing the same name, and the danger is that they all show up in a pull
request titled *"speed up CI"* where nobody reads them as coverage changes.

## 🔴 Measure before you optimise — and the cause is usually small

The instinct on a slow check is to reach for the config. **The instinct is wrong
often enough to be worth resisting**, because
[phase 5 · 09](../../phase-5-type-level/09-type-level-performance/README.md) — which
read the limits out of the checker itself — establishes two things that change where
you look:

1. 🔴 **The expensive work is per-expression, not per-file.** `TS2589`'s
   `instantiationCount` is reset per expression, per source element and per deferred
   node. **So "the project got too big" is rarely the cause**; one type, in one
   place, usually is.
2. 🔴 **The comparison budget *shrinks as the project fills the relation cache* —
   `relationCount = (16e6 − relation.size) >> 3`.** Which is the mechanical reason a
   type that compiles fine in isolation is expensive in situ, and why the slowdown
   appears gradually rather than on the commit that caused it.

📌 **So the diagnosis is: find the expression, not the setting.** `--extendedDiagnostics`
and `--generateTrace` are the tools, and they belong to **topic 06 · Diagnosing a
slow compile** *(not written yet)*. **Reach for them before any lever above** — a
`DeepPartial` in one file has fixed more slow builds than a config change ever has.

## When it is genuinely large

If the honest whole-program check on a monorepo takes many minutes, the answer is
**orchestration, not weakening**: project references so the graph is real, a task
runner that caches the typecheck as a task, and parallel jobs per package. That is
**topic 10 · Monorepo orchestration** *(not written yet)*, and it is the right place
for the effort.

⚠️ **What is not the answer: making the gate advisory.** It is the change that most
reliably converts a slow check into no check, because a non-blocking red is
indistinguishable from a green one after the second week.

## Gotchas

**Symptom:** `incremental: true` is set and CI is no faster.
**Cause:** every job starts from a clean checkout, so there is no `.tsbuildinfo` to
reuse.
**Fix:** cache it, keyed so it invalidates when sources change. 🔴 This is the most
commonly configured performance setting that does nothing in the environment it was
configured for.

**Symptom:** a "speed up CI" pull request halves the check time.
**Cause:** frequently a narrower `include` or a new `exclude`.
**Fix:** ⚠️ read it as a coverage change and ask what stopped being checked.
Excluding `dist/` is free; excluding source is not, and the two look identical in a
diff.

**Symptom:** the check got slow gradually and no commit is responsible.
**Cause:** the comparison budget shrinks as the relation cache fills — phase 5 · 09.
**Fix:** it is still usually one expression. Trace it rather than assuming the
project simply grew.

**Symptom:** someone proposes checking only the packages that changed.
**Cause:** reasonable, and it works **only** if project references model the real
dependencies.
**Fix:** verify the graph. Otherwise a change in a leaf package breaks a consumer
that was never rebuilt, which is the semantic-merge-conflict failure from
[chunk 03](./03-where-the-gate-goes.md) in a different costume.

**Symptom:** the gate was moved to nightly and errors reach `main` for a day.
**Cause:** a nightly check is a report, not a gate.
**Fix:** [chunk 05](./05-when-the-gate-fails.md). ⚠️ If the check genuinely cannot
run per-PR, that is an orchestration problem to solve, not a fact to accept.

**Symptom:** the runner is at its memory limit and the compiler is thrashing.
**Cause:** a large program on a small machine.
**Fix:** more memory. 📌 Unglamorous, and it is the answer more often than a config
change — worth trying *before* anything that reduces coverage.

**Symptom:** `skipLibCheck` was enabled for speed and an error appeared later that
it was assumed to hide.
**Cause:** it skips checking **inside** `.d.ts` files and does not affect your call
sites.
**Fix:** it did not hide the error and cannot. That is settled in
[phase 10 · 08 · chunk 03](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md);
what it costs you is bounded and different from what it is usually blamed for.

## Interview questions

**Why does the speed of the type check matter beyond convenience?**
Because a slow gate does not stay a gate. It gets moved off the pull request, made
advisory, scoped to a subset, or skipped with a label — and every one of those is a
decision to check less, taken for reasons unrelated to types. Speed is what keeps
the check required.

**Which speed levers are free and which cost coverage?**
Free: `incremental` with a cached `.tsbuildinfo`, project references with build
mode, excluding build output from the program, the native compiler, and more memory.
Costly: `skipLibCheck` (bounded, usually accepted), a narrower `include`, checking
only changed projects, and moving to nightly — which stops being a gate altogether.

**`incremental: true` is set and CI is no faster. Why?**
Because CI starts from a clean checkout and `.tsbuildinfo` is not there. The flag
only pays if the file is restored from the CI cache with a key that invalidates when
the sources change. It is the most commonly configured performance setting that does
nothing in the environment it was configured for.

**The check has become slow and no single commit caused it. What is happening?**
Probably the relation cache. The comparison budget is computed as sixteen million
minus the cache size, divided by eight, so it shrinks as the project fills it — which
is why a type that is fine in isolation becomes expensive in place, and why the
slowdown arrives gradually. It is still usually one expression; trace it rather than
assuming the project simply got big.

**Where do you look first on a slow check?**
At the trace, not the config. The expensive work is per-expression — the compiler's
instantiation counter resets per expression, per source element and per deferred
node — so "the project got too big" is rarely the real cause. One `DeepPartial` or
one deep conditional is the usual answer, and no config change fixes it.

**The monorepo check takes eleven minutes. What now?**
Orchestration: project references so the dependency graph is real, a task runner
that caches the typecheck, parallel jobs per package. Not making it advisory — a
non-blocking red is indistinguishable from a green after a couple of weeks, so that
change reliably converts a slow check into no check.

---

← [03 · Where the gate goes](./03-where-the-gate-goes.md) · [Topic index](./README.md) · Next → [05 · When the gate fails](./05-when-the-gate-fails.md)
