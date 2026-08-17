---
title: "Caching it in CI"
sidebar_label: "03 · Caching it in CI"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the invalidation rules relied on here are chunks 01 and
> 02's, each read from the installed **TypeScript 5.9.3** build; `TS6381` and
> `TS6377` are quoted from the compiler's numbered message table. **No sandbox,
> no console blocks** — and **no timing figure is claimed**, because none was
> measured.

Caching `.tsbuildinfo` between CI runs is the one place incremental compilation
pays off for a whole team rather than one developer. It is also easy to do in a
way that is worse than not caching at all, and the failure is silent — a cache
that restores, reports a hit, and helps nothing.

## The rule that makes it work

> 🔴 **Cache the buildinfo and the outputs together, and key the cache on
> everything that invalidates them.**

Both halves matter, and each has a distinct failure if you skip it.

### Cache the outputs *with* the buildinfo

The buildinfo says *"these files are current"*. If it is restored without the
`dist` it describes, the compiler believes outputs exist that do not — and either
does nothing useful or, worse, reports success while emitting nothing. Restore
them as one unit or neither.

### Key on what actually invalidates

From [chunk 02](./02-what-invalidates-it.md), three things:

| Invalidator | Include in the cache key |
|---|---|
| The TypeScript version (`TS6381`) | the **lockfile hash** — it moves when TypeScript does |
| `affectsBuildInfo` options | the **`tsconfig*.json` hashes** |
| Source content | ⛔ **not in the key** — this is what the cache is *for* |

⚠️ **Keying on source content defeats the purpose.** A cache that only hits when
nothing changed is a cache that never helps. Key on the *configuration*, restore
on a prefix match, and let the buildinfo work out what changed.

```yaml
# the shape, not a specific CI system's syntax
key:          tsbuild-${{ hashFiles('**/package-lock.json', '**/tsconfig*.json') }}
restore-keys: tsbuild-
paths:
  - "**/*.tsbuildinfo"
  - "**/dist"
```

📌 **`restore-keys` is what makes it useful.** An exact-key miss after a
dependency bump still restores the most recent compatible cache, and `TS6381` or
the options comparison correctly invalidates whatever is genuinely stale.

## 🔴 The timestamp problem, which is the real trap

Chunk 02 listed it as an *accidental* invalidation, and CI is where it bites
hardest — in both directions:

- **A checkout writes every source file with a fresh timestamp.** Now every
  source looks newer than every restored output, and the build rebuilds
  everything. The cache restored perfectly and bought nothing.
- **A restore writes outputs with fresh timestamps** while sources keep older
  ones. Now everything looks current and the build **skips work it should have
  done** — the dangerous direction.

**Why it does not usually break correctness:** the per-file `version` hash is
content-based, so once the compiler looks at a file it compares hashes rather
than mtimes. Timestamps drive the *project-level* up-to-date check
([topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md)), which
is where the second bullet does its damage.

**The mitigations, in order of preference:**

1. **Cache outputs and buildinfo as one unit** — the whole rule above. Most
   timestamp skew comes from restoring one and not the other.
2. **Prefer content-addressed caching at the task level** — a task runner that
   hashes inputs and restores outputs does not depend on mtimes at all.
3. **`tsc -b --clean` on a cache-restore anomaly**, once, rather than `--force`
   forever ([topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md)
   calls a permanent `--force` a defect marker).

## One buildinfo path per option set — the CI form

The rule from [topic 10 chunk 07](../10-skiplibcheck/07-the-tsbuildinfo-interaction.md),
restated because CI is where it actually costs money:

> A pipeline that runs `tsconfig.json` (with `skipLibCheck: true`) and
> `tsconfig.build.json` (with it `false`) against **one** buildinfo path has each
> job invalidating the other's declaration-file diagnostics, every run, forever.
> The cache reports hits and never helps.

`TS6377` catches the project-reference form of this. The two-config form is not
caught by anything — it is simply slow.

## Is it worth it?

Honestly: **it depends on your repo, and no number here would be trustworthy.**

- A large `composite` graph with stable declarations is where it pays most,
  because `TS6354` skipping compounds across the graph.
- A single project that rebuilds fully in a few seconds gains little, and the
  cache upload/download may cost more than the build.
- 🔴 **Measure before adopting.** `tsc --extendedDiagnostics` on your own repo,
  warm and cold, is the honest way. **Phase 12 · Tooling, performance and
  testing** *(not written yet)* owns compiler performance in general.

⚠️ **And measure again after adopting**, because a cache that silently stopped
hitting looks exactly like a cache that is working.

## Gotchas

**Symptom:** The cache restores and the build takes as long as a cold one.
**Cause:** Either the key includes source content, or the buildinfo was restored
without its outputs, or two jobs share one buildinfo path.
**Fix:** Key on lockfile + configs, cache outputs and buildinfo together, one
path per option set.

**Symptom:** The cache hits and the build skips work it should have done.
**Cause:** Restored outputs are newer than the checked-out sources.
**Fix:** The dangerous direction. Restore both together, or use content-addressed
task caching.

**Symptom:** Everything rebuilds after a dependency bump.
**Cause:** `TS6381` if TypeScript moved — correct and expected.
**Fix:** Keying on the lockfile makes this an intentional cache miss rather than
a surprise.

**Symptom:** The cache never hits at all.
**Cause:** The key includes something that changes every run — a commit SHA, a
timestamp, source hashes.
**Fix:** Key on configuration; use `restore-keys` for near misses.

**Symptom:** A `--force` was added to the CI build "to be safe" and the cache
still uploads.
**Cause:** `--force` bypasses the up-to-date check entirely.
**Fix:** You are paying to store a cache you have instructed the build to ignore.
Remove one or the other.

**Symptom:** `TS6377` in a CI build only.
**Cause:** Two projects resolving to the same buildinfo path, exposed by the
build order CI uses.
**Fix:** Explicit `tsBuildInfoFile` per project.

**Symptom:** Caching was adopted and nobody knows whether it helped.
**Cause:** No before-measurement.
**Fix:** Measure both ways on your own repo. A silently-missing cache is
indistinguishable from a working one without it.

**Symptom:** The `.tsbuildinfo` was committed to git to "cache" it.
**Cause:** Reasonable-sounding, wrong.
**Fix:** It records a compiler version and paths, and it changes on every build.
Cache it in the CI cache, not in the repository.

## Interview questions

**★ How do you cache `.tsbuildinfo` correctly in CI?**
Cache the buildinfo **and** the outputs it describes as one unit, and key the
cache on the lockfile and the `tsconfig*.json` files — the things that genuinely
invalidate it — with `restore-keys` for near misses. Never key on source content;
that is what the buildinfo is for.

**★ Why not include source hashes in the cache key?**
Because then the cache only hits when nothing changed, which is exactly when you
do not need it. The configuration is the right key; the buildinfo works out what
changed within it.

**★ What is the timestamp problem, and which direction is dangerous?**
A checkout gives sources fresh timestamps, so restored outputs look stale and
everything rebuilds — wasteful. A restore gives outputs fresh timestamps while
sources are older, so the build skips work it should have done — that is the
dangerous one, because it is silent.

**★ Why doesn't that break correctness more often?**
Because the per-file `version` is a content hash, so once a file is examined the
comparison is content-based. Timestamps drive the project-level up-to-date check,
which is where the silent skip happens.

**How does the two-config `skipLibCheck` case interact with CI caching?**
If both configs share one buildinfo path, each run invalidates the other's cached
declaration-file diagnostics — a cache that reports hits and never helps.
Nothing diagnoses it; `TS6377` only catches the project-reference form.

**Should you commit the `.tsbuildinfo`?**
No. It records a compiler version and paths and changes every build. Use the CI
cache.

**Is CI caching always worth it?**
No. It pays most on a large composite graph with stable declarations, where
`TS6354` skipping compounds. On a project that rebuilds in seconds the cache
transfer can cost more than the build. Measure on your own repo, both before and
after — a cache that stopped hitting looks exactly like one that works.

---

← Prev: [02 · What invalidates it](./02-what-invalidates-it.md) · Back to [the topic index](./README.md)
