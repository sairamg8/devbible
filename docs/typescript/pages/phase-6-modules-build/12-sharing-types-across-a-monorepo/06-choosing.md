---
title: "Choosing, and migrating"
sidebar_label: "06 · Choosing"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the recommendation below follows from the compiler
> behaviour established in chunks 01–05, each of which names its source in the
> installed **TypeScript 5.9.3** build. The workspace guidance is
> [topic 03 chunk 05](../03-path-aliases/05-the-decision.md)'s, linked rather
> than restated. **No sandbox, no console blocks** — and no build-time figure is
> claimed anywhere in this topic, because none was measured.

Five chunks of mechanism. The decision is smaller than it looks, because two of
the four combinations are simply worse than the others.

## The decision

```
does anything in this repo get PUBLISHED to npm?

├─ yes → the built-declaration route must exist somewhere.
│        Not necessarily in the dev loop — but a CI job must check
│        what consumers will actually receive.  (topic 11)
│
└─ no  → the source route is defensible everywhere, and simpler.
         You still want ONE job that emits declarations, or emit
         failures wait until the day you do publish.

then, separately:

what does the DEV LOOP optimise for?

├─ iteration speed, cross-package refactors, no build step
│        → source route (project references, redirect left on)
└─ fidelity to the published interface, real boundaries
         → built route + declarationMap + a watch build
```

🔴 **The recommendation, stated plainly:** *project references throughout, the
source-of-project-reference redirect left at its default, `declarationMap: true`
everywhere, and one CI job that builds declarations and runs
[topic 11's checks](../11-publishing-a-typed-package/08-wiring-the-checks-in.md).*

That gets the source route's dev loop with the built route's guarantees, and the
guarantees are enforced by a job rather than by everyone remembering.

## Why this arrangement and not the others

| Arrangement | Verdict |
|---|---|
| Source in dev, built in CI | ✅ **The recommendation.** Immediacy where you need it, fidelity where it is checked |
| Built everywhere + watch build | ✅ Also fine, and the right choice when the boundary needs to be real *while* people work — a large team, or packages owned by different groups |
| Source everywhere, no declaration build | ⚠️ Works until publish day, then fails all at once |
| `paths` to another package's `src` | ❌ [Topic 03 chunk 05](../03-path-aliases/05-the-decision.md) — removes the boundary, and types and runtime resolve to different files |

📌 **The second row is not a lesser option.** If the reason you split the packages
was ownership rather than build speed, a boundary you can accidentally reach
through is not doing its job, and the watch build is a small price.

## The migration, in the order that keeps the repo working

Most monorepos arrive at this topic with `paths` aliases and no references.
Migrating in this order means each step leaves the repo buildable:

**1. Make every package a real package first.** A real `name`, a real
`package.json`, resolvable through workspaces. Nothing about types changes yet —
but until this is true, none of the rest is available. This is topic 03 chunk
05's *"the answer most of the time"*.

**2. Add `exports` to each internal package.** This is where the boundary
actually starts existing. ⚠️ Expect to find imports that were reaching into
internals; that discovery *is* the value, and each one is a decision about what
the public surface should be.

**3. Add `declaration` and `declarationMap` to every package.** Still no
references. This is the step that surfaces the `TS4053`/`TS2742` family
([topic 07 chunk 08](../07-authoring-d-ts-files/08-when-declaration-emit-fails.md))
— often a genuine surprise in a repo that has only ever type-checked.

🔴 **Do step 3 before step 4.** Adding `composite` first means fighting emit
failures and reference-graph errors at the same time, and they are unrelated
problems.

**4. Add `composite: true` and the `references` arrays.** Now build order is
modelled and `tsc -b` works. Expect `TS6304` and `TS6307` here
([chunk 05](./05-the-failure-catalogue.md)) — both are quick fixes once they are
the only thing you are dealing with.

**5. Delete the `paths` aliases.** They are now redundant, and leaving them means
two mechanisms answering the same question — the unpredictability
[chunk 01](./01-the-question-and-the-compilers-answer.md) warns about.

**6. Add the CI job** that builds declarations and runs `attw`/`publint` on
anything published.

⚠️ **Step 5 is the one that gets skipped**, because by then everything works and
removing the aliases feels like risk. It is the step that makes the arrangement
comprehensible to the next person.

## What to write down

This topic's failures are all *"someone did not know which arrangement we use"*.
Four lines in the contributing guide prevent most of them:

> - Packages are consumed by name through workspaces. **No `paths` aliases.**
> - Type-checking uses **source** via project references; CI additionally builds
>   declarations.
> - Run `tsc -b --watch` if you want `dist` current; nothing else requires it.
> - `declarationMap` is on everywhere — go-to-definition lands on real code. If it
>   does not, say so rather than working around it.

📌 If you have set `disableReferencedProjectLoad` or `disableSolutionSearching`
for editor performance ([chunk 04](./04-editor-versus-build.md)), **that belongs
in the same note** — it makes editor-versus-build divergence expected, and
nothing else will explain that to someone.

## What this topic did not measure

No build-time number appears anywhere in it. The source route compiles more code
and the built route reads smaller declarations, so the built route is *expected*
to scale better on a large graph — but by how much depends entirely on your
package sizes and the shape of the dependency graph, and nothing here was
benchmarked.

If you need the answer, `tsc --noEmit --extendedDiagnostics` under each
arrangement on your own repo is the honest way to get it. **Phase 12 · Tooling,
performance and testing** *(not written yet)* owns compiler performance in
general.

## Gotchas

**Symptom:** `composite` was added first and the migration stalled in errors.
**Cause:** Emit failures and reference-graph errors arriving together.
**Fix:** Declarations first, references second. They are unrelated problems and
are much easier apart.

**Symptom:** The migration finished and `paths` aliases are still in the config.
**Cause:** Step 5 felt like unnecessary risk.
**Fix:** Remove them. Two mechanisms answering one question is the state chunk 01
warns about.

**Symptom:** Adding `exports` to internal packages broke many imports.
**Cause:** They were reaching into internals, which is what `exports` stops.
**Fix:** That is the finding, not the failure. Each one is a decision about the
public surface.

**Symptom:** A repo that never publishes still hit declaration-emit errors.
**Cause:** Step 3 — the errors were always there and nothing had asked for the
emit.
**Fix:** Better now than on the day you first publish.

**Symptom:** The team cannot agree on source versus built.
**Cause:** Treating it as one decision rather than two — dev loop and CI can
differ.
**Fix:** Source in dev, built in CI. Write it down.

**Symptom:** A published package's types are wrong despite a clean monorepo
build.
**Cause:** Nothing checked the published artefact.
**Fix:** The CI job from step 6. Topic 11 chunk 08.

**Symptom:** New contributors keep hitting the same monorepo confusion.
**Cause:** The arrangement is real but undocumented.
**Fix:** The four lines above. Most of this topic's failures are a knowledge
problem, not a configuration one.

**Symptom:** Someone proposes the built route everywhere for speed, with no
measurement.
**Cause:** A plausible expectation, untested.
**Fix:** Measure with `--extendedDiagnostics` on your repo. Nobody else's number
describes your graph.

## Interview questions

**★ What arrangement would you recommend for a TypeScript monorepo?**
Project references throughout with the source redirect left at its default,
`declarationMap: true` everywhere, and one CI job that builds declarations and
validates anything published. That gives the source route's dev loop with the
built route's guarantees, enforced by a job rather than by discipline.

**★ Is that always right?**
No. If the packages were split for *ownership* rather than build speed, a
boundary people can accidentally reach through is not doing its job — then the
built route with a watch build is the better answer, and the watch process is a
small price.

**★ What order do you migrate in, and why does the order matter?**
Real packages → `exports` → `declaration`/`declarationMap` → `composite` and
`references` → delete `paths` → add the CI check. Declarations before
`composite` specifically, because otherwise emit failures and reference-graph
errors arrive together and they are unrelated problems.

**★ Which migration step is usually skipped?**
Deleting the `paths` aliases, because by then everything works. Leaving them
means two mechanisms answering the same question, which is exactly the state that
makes a monorepo behave unpredictably.

**Why does adding `exports` to internal packages break imports, and is that
bad?**
It breaks imports that were reaching into another package's internals. That is
the finding rather than the failure — each break is a decision about what the
package's public surface should be.

**A repo that never publishes — does any of topic 11 apply?**
Yes, at step 3: declaration emit still needs to be exercised, or `TS4053`-family
failures wait until the day you first publish and arrive all at once.

**Why is there no performance number in this topic?**
Because none was measured. The built route is expected to scale better on a large
graph since it reads interfaces rather than compiling sources, but the size of
that difference depends entirely on your graph — measure with
`--extendedDiagnostics` on your own repo.

---

← Prev: [05 · The failure catalogue](./05-the-failure-catalogue.md) · Back to [the topic index](./README.md)
