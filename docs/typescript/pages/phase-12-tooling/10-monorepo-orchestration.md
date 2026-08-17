---
title: "Monorepo orchestration"
sidebar_label: "10 · Monorepo orchestration"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **`tsconfig` reference** for `composite`,
> `references` and `--build`, and the **Turborepo** and **Nx** documentation for
> task graphs, task inputs and remote caching. ⚠️ **Sharing types across a monorepo
> is [phase 6 · 12](../phase-6-modules-build/12-sharing-types-across-a-monorepo/README.md)'s**
> and **project references are
> [phase 6 · 13](../phase-6-modules-build/13-project-references/README.md)'s** — this
> page takes only the **task-runner** angle. **No timing figure is ours. No console
> block.**

[Topic 01 · chunk 04](./01-type-checking-in-ci/04-making-it-fast-enough.md) said
that when a monorepo's check is genuinely large the answer is **orchestration, not
weakening**. This is that answer, and it starts with a distinction people skip:

> 🔴 **There are two orchestrators in a TypeScript monorepo, and they both think
> they own build order.** `tsc -b` walks the **project reference** graph; Turborepo
> or Nx walks the **task** graph. **They are two descriptions of the same dependency
> structure, and nothing keeps them in sync.**

## Decide which graph is authoritative

| Shape | Who owns order | Trade |
|---|---|---|
| **References authoritative** — the task runner runs `tsc -b` once at the root | the compiler | ✅ one graph, no drift · ⚠️ **one giant task**, so the runner can cache only *all or nothing* |
| 🔴 **Tasks authoritative** — each package has its own `typecheck` task | the task runner | ✅ **per-package caching** — one package changes, one task re-runs · ⚠️ the graph is duplicated in two places |
| **Both, unreconciled** | nobody | ⛔ the failure mode below |

📌 **Per-package tasks are what make caching possible at all**, and that is usually
the deciding argument: a single root `tsc -b` is one enormous task whose inputs are
the entire repository, so it is invalidated by every commit.

## 🔴 The cache-input problem, one level up from topic 09

A task runner caches a task against its **declared inputs**. So the soundness
condition is exact:

> **A cached task is only sound if it is deterministic given the inputs you
> declared.**

⚠️ **A `typecheck` task that depends on a sibling package's types but does not
declare that dependency will hit the cache when the sibling's types have changed** —
and report success for a check it did not run. **That is a stale green**, the same
class of failure as [topic 01](./01-type-checking-in-ci/README.md)'s unchecked
program, arriving through the cache instead of the config.

**So the declared inputs must include:**

- the package's own sources **and** its `tsconfig`,
- 🔴 **the dependency packages' *outputs*** — their declarations, if that is what
  you consume — **not merely a task ordering.** *"Run after"* is not *"invalidate
  when"*.
- the compiler version and the lockfile ([topic 09](./09-caching-in-ci-and-docker.md)).

📌 **The distinction between ordering and invalidation is the whole bug.** A task
runner will happily run tasks in the right order and still serve you a cached result
from before the dependency changed.

## What you consume decides what you must build

The question [phase 6 · 12](../phase-6-modules-build/12-sharing-types-across-a-monorepo/README.md)
answers in full, with the orchestration consequence stated here:

- **If a package consumes its dependency's `.d.ts`**, then the dependency must be
  **built** before the dependent can be checked — a real ordering constraint the
  task graph has to encode, and a real invalidation input.
- **If it consumes the dependency's source**, there is no build step to order, but
  the checking work is duplicated in every dependent — and you are back to large
  programs ([topic 06](./06-diagnosing-a-slow-compile/README.md)).

⚠️ **Neither is wrong, and the choice belongs to phase 6.** What belongs here: **the
task graph has to match the choice**, and a mismatch produces either an unnecessary
build step or a stale check.

## The trade nobody states

🔴 **Per-package checking is slower cold and much faster warm.** Splitting one
program into twelve means twelve programs to construct, and shared dependencies get
loaded repeatedly — so a cold CI run can be *worse* than a single root check.

**It pays because most runs are not cold.** ⚠️ **Which means the whole arrangement
depends on the cache actually hitting** — so if your cache is misconfigured
([topic 09](./09-caching-in-ci-and-docker.md)), you have taken the cost and none of
the benefit. **Verify the hit rate before concluding the split failed.**

## Gotchas

**Symptom:** a package's `typecheck` task is cached green after a dependency's types
changed.
**Cause:** the dependency was declared as an *ordering* edge, not as an *input*.
**Fix:** 🔴 declare its outputs as inputs. *"Run after"* is not *"invalidate when"*,
and this is the one bug that makes the whole cache untrustworthy.

**Symptom:** cold CI got slower after splitting into per-package tasks.
**Cause:** twelve programs instead of one, with shared dependencies loaded
repeatedly.
**Fix:** expected. ⚠️ The arrangement pays on warm runs, so check the cache hit rate
before judging it.

**Symptom:** `tsc -b` and the task runner disagree about what to build first.
**Cause:** two graphs describing the same structure, drifting.
**Fix:** pick one as authoritative. 📌 Usually the task runner, because per-package
tasks are what make caching possible — but then keep the references configuration
consistent with it rather than half-maintained.

**Symptom:** a dependent package cannot resolve its dependency's types until
something is built.
**Cause:** it consumes declarations, so the dependency has a real build step.
**Fix:** encode it in the task graph. This is phase 6 · 12's decision surfacing as an
orchestration requirement.

**Symptom:** remote caching was enabled and results became suspect.
**Cause:** the same input-declaration problem, now shared across machines — a wrong
input set is wrong for everyone at once.
**Fix:** ⚠️ get the inputs right *before* sharing a cache. Remote caching multiplies
whatever correctness you already had.

**Symptom:** the root check was kept "for safety" alongside per-package tasks.
**Cause:** reasonable caution.
**Fix:** 📌 it is also the honest fallback — but know you are paying twice, and
decide it deliberately rather than leaving it because nobody dared remove it.

## Interview questions

**What is the core problem with orchestrating TypeScript in a monorepo?**
There are two graphs describing the same dependency structure — the project
reference graph that `tsc -b` walks, and the task graph the runner walks — and
nothing keeps them in sync. The first decision is which one is authoritative, and
per-package tasks usually win because they are what makes caching possible.

**When is a cached typecheck task unsound?**
When it is not deterministic given its declared inputs. If a package's check depends
on a sibling's types but only declares an ordering edge, the task will hit the cache
after the sibling changed and report success for a check it never ran. Ordering is
not invalidation, and that distinction is the whole bug.

**What belongs in a typecheck task's inputs?**
The package's sources and `tsconfig`, the dependencies' outputs — the declarations
you actually consume, not just a "runs after" relationship — and the compiler
version and lockfile, for the same reason they belong in any TypeScript cache key.

**Does splitting into per-package checks always help?**
No — it is slower cold and faster warm. Twelve programs instead of one means shared
dependencies get loaded repeatedly, so a cold run can be worse than a single root
check. It pays because most runs are warm, which makes the whole arrangement
dependent on the cache actually hitting; if it is misconfigured you have taken the
cost and none of the benefit.

**How does what you consume affect the task graph?**
If a package consumes its dependency's declarations, the dependency has to be built
first — a genuine ordering constraint and a genuine invalidation input. If it
consumes source, there is nothing to order but the checking work is duplicated in
every dependent, which brings back the large-program problem. The choice is phase
6's; matching the task graph to it is this topic's job.

**Is remote caching a good idea here?**
Only once the input declarations are right. It multiplies whatever correctness you
already have — so a wrong input set that produced occasional stale greens on one
machine produces them for the whole team at once.

---

← [09 · Caching TypeScript in CI and Docker](./09-caching-in-ci-and-docker.md) · [Phase 12 index](./README.md)
