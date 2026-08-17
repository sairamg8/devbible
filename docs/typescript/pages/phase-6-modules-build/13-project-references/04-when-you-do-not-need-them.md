---
title: "When a monorepo does *not* need project references"
sidebar_label: "04 · When you do not need them"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the constraints cited (`composite` implying `declaration`
> and `incremental`, and the enumerable-file-list requirement) are the
> `TS6304`/`TS6307`/`TS6379` diagnostics quoted in
> [chunk 01](./01-what-tsc-b-does.md), read from the installed **TypeScript
> 5.9.3** build. **No sandbox, no console blocks** — and **no build-time figure
> is claimed here**, because none was measured.

The syllabus row for this topic ends *"…and when a monorepo actually needs
them"*, and that is the half most treatments skip. Project references are
presented as what a serious monorepo does. They are machinery with a cost, and
plenty of monorepos are better off without them.

## What references actually cost

Every one of these is a real, recurring cost, not a one-off setup tax:

1. **`composite: true` everywhere**, which forces declaration emit
   ([`TS6304`](./01-what-tsc-b-does.md)) and incremental compilation
   (`TS6379`). If your packages do not otherwise emit declarations, you have
   just taken on declaration emit as a build step — including its failure modes
   ([topic 07 chunk 08](../07-authoring-d-ts-files/08-when-declaration-emit-fails.md)).
2. **An enumerable file list per project** (`TS6307`), so `include` patterns must
   actually cover everything.
3. **A second graph to maintain.** The `references` arrays must stay consistent
   with the real dependencies, and nothing checks that they have — a missing
   reference gives you a wrong build order that usually still works, until it
   does not.
4. **A `.tsbuildinfo` per package**, with its own path
   ([topic 10 chunk 07](../10-skiplibcheck/07-the-tsbuildinfo-interaction.md)),
   and `TS6377` waiting if two collide.
5. **Cognitive cost.** Everything in chunks 02 and 03 — the up-to-date states,
   the error propagation default — becomes something the team has to know.

## The three arrangements that need none of it

### 1. One project over everything

```jsonc
// tsconfig.json at the root
{
  "compilerOptions": { "strict": true, "noEmit": true },
  "include": ["packages/*/src"]
}
```

One program, every package's source, one `tsc --noEmit`. No `composite`, no
`references`, no build order, no staleness — because there is no intermediate
artefact at all.

🔴 **This is the right answer more often than its reputation suggests.** If your
packages are compiled by a bundler or run by a runtime that strips types, then
`tsc` is only a *checker* — and a checker does not need build orchestration,
because it produces nothing to orchestrate.

**What you give up:** per-package compiler options, and any enforced boundary
(everything can see everything). **What you gain:** it cannot be stale, cannot be
half-built, and there is nothing to explain to a new contributor.

### 2. Workspaces and independent builds

Each package builds itself, with its own `tsconfig.json`, and a task runner —
`npm run build --workspaces`, or Turborepo, Nx, moon — handles ordering and
caching.

📌 **This is references' job done by a different tool, usually better.** Those
runners cache across machines and CI runs, understand non-TypeScript tasks, and
give you one mental model for the whole build instead of two. If you already run
one, adding project references is duplicating its central feature.

⚠️ **Note the honest limit:** an external runner orders *tasks*, and only `tsc -b`
knows that a rebuild whose `.d.ts` did not change means dependents can be skipped
([`TS6354`](./02-the-up-to-date-check.md)). Most task runners cache at
whole-package granularity, which is coarser and — for a deep graph — sometimes
much worse.

### 3. A bundler that owns the build

If Vite, esbuild, Rollup or webpack produces what you ship, `tsc` is a checker
again and arrangement 1 applies. The bundler resolves across packages; TypeScript
just needs to agree about types.

## When references do earn their place

Four situations, and they are specific:

1. 🔴 **A deep graph where declarations are stable.** This is the real one. If
   `shared` is rebuilt constantly but its public `.d.ts` rarely changes,
   `TS6354` skips the entire downstream graph, and nothing else gives you that
   — a task runner sees "the package rebuilt" and invalidates everything below.
2. **Packages with genuinely different compiler options.** One targets the DOM,
   one Node; one is `strict` and a legacy one is not. A single project cannot
   express that; references can.
3. **Enforced boundaries between owners.** Different teams, and reaching into
   another package's internals should not be possible by accident.
4. **You publish some of the packages.** Then declarations have to be emitted
   anyway, so `composite`'s biggest cost has already been paid — and
   [topic 12](../12-sharing-types-across-a-monorepo/README.md)'s built route
   becomes cheap.

📌 **Reason 4 is why "we publish from this repo" so often settles the question.**
The main objection to references disappears the moment you were emitting
declarations regardless.

## The honest decision

```
does tsc EMIT the thing you ship?

├─ no (a bundler or a stripping runtime does)
│    → one project over everything, or workspaces + a task runner.
│      References add machinery for a build you are not doing.
│
└─ yes
     ├─ do you publish any package?          → references are cheap. Use them.
     ├─ deep graph, stable declarations?     → references, for TS6354 alone.
     ├─ different options per package?       → references. Nothing else expresses it.
     └─ none of the above                    → workspaces + a task runner is simpler.
```

⚠️ **The failure mode to avoid is adopting references because a large repo
"should" have them**, and then carrying chunks 02 and 03's behaviour as
unexplained folklore. Machinery nobody understands is worse than machinery you
did not need.

## Gotchas

**Symptom:** References were adopted and nothing got faster.
**Cause:** The graph is shallow, or declarations change on every build so
`TS6354` never fires.
**Fix:** The saving comes from skipping downstream projects. If nothing is
skipped, you have paid the cost for nothing.

**Symptom:** `composite` was added to packages that never needed declarations.
**Cause:** It is required for referencing, and it forces declaration emit.
**Fix:** Real, and it brings the `TS4053` family with it. Worth knowing before
adopting.

**Symptom:** A task runner and project references are both configured.
**Cause:** Two tools doing the same ordering job.
**Fix:** Not automatically wrong — the runner caches across machines, `tsc -b`
skips on unchanged declarations — but only if someone chose it deliberately.

**Symptom:** A missing `references` entry, and the build works anyway.
**Cause:** Order happened to be right, or resolution found the output regardless.
**Fix:** Nothing checks the array against real dependencies. It will break on a
clean build or a reordering.

**Symptom:** A repo where `tsc` only type-checks has full references machinery.
**Cause:** Adopted by reputation.
**Fix:** One project over everything is simpler and cannot be stale.

**Symptom:** Contributors keep asking why a package did not rebuild.
**Cause:** The up-to-date check is invisible without `--verbose`.
**Fix:** A cost of references, not a bug. Chunk 02.

**Symptom:** Someone proposes references purely for build speed, with no
measurement.
**Cause:** Reasonable expectation, untested.
**Fix:** Measure. `TS6354` skipping is real, but whether it dominates depends on
your graph's depth and declaration churn.

## Interview questions

**★ When does a monorepo not need project references?**
When `tsc` does not emit what you ship. If a bundler or a type-stripping runtime
produces the output, `tsc` is only a checker — and a checker has no intermediate
artefacts to order, so one project over all packages is simpler and cannot go
stale.

**★ What do references cost?**
`composite` everywhere (which forces declaration emit and incremental
compilation), an enumerable file list per project, a second dependency graph
nothing validates, a `.tsbuildinfo` per package, and the team having to
understand the up-to-date states and the error-propagation default.

**★ What is the single strongest reason to use them?**
`TS6354` — when a dependency rebuilds but its declarations do not change, the
entire downstream graph is skipped. No task runner gives you that; they cache at
whole-package granularity and invalidate everything below.

**★ Why does publishing settle the question?**
Because declarations have to be emitted anyway, so `composite`'s biggest cost is
already paid. The main objection disappears.

**Is running both a task runner and project references wrong?**
Not necessarily — they optimise different things (cross-machine caching versus
skipping on unchanged declarations). It is wrong only when nobody chose it and
the team maintains two build models by accident.

**What happens if a `references` array is missing a real dependency?**
Often nothing, at first — the order may still be right, or resolution finds the
output anyway. Nothing validates the array against actual imports, so it breaks
later, on a clean build or a reordering.

**What is the worst outcome of adopting references by reputation?**
Carrying the up-to-date semantics and the `stopBuildOnErrors` default as
unexplained folklore. Machinery nobody understands costs more than the machinery
you did not need.

---

← Prev: [03 · Errors do not stop the build](./03-errors-do-not-stop-the-build.md) · Back to [the topic index](./README.md)
