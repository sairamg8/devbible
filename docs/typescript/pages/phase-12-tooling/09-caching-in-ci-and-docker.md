---
title: "Caching TypeScript in CI and Docker"
sidebar_label: "09 · Caching in CI and Docker"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 option and diagnostic tables read
> from disk** (`sandbox/ts-p0`) — `TS5074`, and the descriptions of `incremental`
> and `tsBuildInfoFile`, are quoted **verbatim** — the `tsconfig` reference, and
> **Docker's** documentation on build cache invalidation and multi-stage builds.
> ⚠️ **What a `.tsbuildinfo` contains and what invalidates it is
> [phase 6 · 14](../phase-6-modules-build/14-incremental-builds/README.md)'s** — this
> page takes only the CI and Docker angle. **No timing figure is ours. No console
> block.**

[Topic 01 · chunk 04](./01-type-checking-in-ci/04-making-it-fast-enough.md) named
the problem this topic exists to solve:

> 🔴 **`incremental: true` is the most commonly configured performance setting that
> does nothing in the environment it was configured for.** CI starts from a clean
> checkout, so there is no `.tsbuildinfo` to reuse and the flag buys exactly
> nothing.

**The flag is not the mechanism. The mechanism is the flag plus a restored file**,
and everything below is about getting the file back.

## First: name the file, or you cannot cache it

The compiler is explicit about the command-line case:

> `TS5074` · *"Option `'--incremental'` can only be specified using tsconfig,
> emitting to single file or when option `'--tsBuildInfoFile'` is specified."*

🔴 **So a CI job that invokes `tsc` with flags rather than through a `tsconfig` must
name the file** — and that turns out to be what you wanted anyway: **an explicit,
known path is what a cache step can save and restore.** Left implicit, the location
is derived, and you are guessing at what to cache.

📌 The two option descriptions, for completeness: `incremental` is *"Save
`.tsbuildinfo` files to allow for incremental compilation of projects."* and
`tsBuildInfoFile` is *"Specify the path to `.tsbuildinfo` incremental compilation
file."*

## 🔴 The cache key, and why the obvious one never hits

Here is the trap, and it catches nearly everyone once:

| Key includes | Result |
|---|---|
| a hash of **all sources** | ⚪ **never hits** — every commit changes it |
| only the **lockfile** | ⚠️ hits constantly, and the entry is stale enough to be near-useless |
| 🔴 **a hierarchy** — exact key, then a prefix fallback | ✅ **restores a recent file and lets the compiler compute the delta** |

> 🔴 **The insight that makes this work: the cache does not need to be *current*, it
> needs to be *recent*.** A `.tsbuildinfo` is a **starting point**, not an answer —
> the compiler compares what it records against what it finds and re-checks whatever
> moved.

⚠️ **Which is also why a stale entry is safe rather than dangerous.** The compiler
validates the file's contents against the current sources rather than trusting it,
so the worst case of restoring an old one is that less work is saved — **not that a
wrong result is produced.** 📌 That property is what licenses the fallback-key
strategy; without it you would have to key exactly and never hit.

**So the key should include the things that make the file *unusable* rather than
merely *out of date*:** the compiler version, the `tsconfig`, and the lockfile —
with a prefix restore-key so a near-miss still returns something.

## Docker: the order of your `COPY` lines is the whole game

Docker invalidates every layer from the first changed one onward. **So a Dockerfile
that copies the source before installing dependencies reinstalls the world on every
source edit** — which is the syllabus row's *"multi-stage build that does not
reinstall the world"*.

**The order that works:**

1. `COPY` the manifest and lockfile **only**.
2. Install dependencies. 🔴 **This layer is now keyed on the lockfile**, so it
   survives every change that does not touch dependencies.
3. `COPY` the source.
4. Build.

📌 **Steps 1–2 are the entire trick**, and the reason it is worth stating is that the
naive Dockerfile — `COPY . .` then install — is both shorter and completely wrong for
caching.

⚠️ **`.dockerignore` matters more than it looks here.** If your build context sweeps
in `node_modules`, `dist` or a local `.tsbuildinfo`, then step 3 invalidates on files
that were never inputs — **and a local `.tsbuildinfo` copied into the image is worse
than none**, because it describes a different machine's paths.

## The multi-stage shape

**A builder stage that has the compiler, and a runtime stage that does not.** The
point is not only image size:

- 🔴 **The runtime image should not contain TypeScript at all** — it ships the
  emitted JavaScript, which
  [topic 03 · chunk 02](./03-build-pipelines/02-the-two-shapes.md) already
  established as a separate concern from checking.
- **The builder stage is where caching pays**, and it is discarded, so an aggressive
  cache there costs nothing at runtime.

📌 **BuildKit cache mounts are the modern form of this** — a mount that persists
across builds for the package manager's store and for the `.tsbuildinfo` path, rather
than baking either into a layer. ⚠️ **A cache mount is not part of the image**, which
is exactly what you want for build-only state, and it sidesteps the `.dockerignore`
hazard above.

## 🔴 What not to expect from caching

**It does not make the gate cheaper to *trust*.** Every warning from
[topic 01 · chunk 02](./01-type-checking-in-ci/02-what-the-gate-guarantees.md)
applies unchanged: a cached run still checks whatever the configuration points at,
and no more.

⚠️ **And re-test the gate after introducing caching**, for the same reason a compiler
upgrade needs it ([topic 02 · chunk 03](./02-typescript-7-for-tooling/03-upgrading-in-stages.md)):
a caching change is a change to how the check runs, and **a green run that reused
everything looks exactly like a green run that checked everything.** Break something
on purpose and confirm it still goes red.

## Gotchas

**Symptom:** `incremental: true` is set and CI is no faster.
**Cause:** clean checkout, no `.tsbuildinfo` to restore.
**Fix:** 🔴 cache and restore it. The flag is half the mechanism.

**Symptom:** the cache never hits.
**Cause:** the key includes a hash of the sources, which changes every commit.
**Fix:** key on the things that make the file unusable — compiler version,
`tsconfig`, lockfile — and add a prefix restore-key. **Recent beats current.**

**Symptom:** worry that a stale `.tsbuildinfo` will produce a wrong result.
**Cause:** reasonable-sounding, and not how it works.
**Fix:** ⚠️ the compiler validates the file against the current sources rather than
trusting it, so a stale entry costs you savings, not correctness. That is precisely
what makes the fallback strategy safe.

**Symptom:** every source edit reinstalls dependencies in Docker.
**Cause:** `COPY . .` before the install step, so the install layer is invalidated by
any file.
**Fix:** copy the manifest and lockfile first, install, then copy the source. 📌 The
naive Dockerfile is shorter and wrong.

**Symptom:** the Docker build ignores the cache for no visible reason.
**Cause:** the build context is sweeping in generated files — `node_modules`,
`dist`, a local `.tsbuildinfo`.
**Fix:** `.dockerignore`. ⚠️ A local `.tsbuildinfo` copied into the image is worse
than none: it describes another machine's paths.

**Symptom:** `TS5074` when adding `--incremental` to a CI command.
**Cause:** invoked with flags rather than through a `tsconfig`, so the file has no
determined location.
**Fix:** pass `--tsBuildInfoFile`. 📌 You needed the explicit path for the cache step
anyway.

**Symptom:** caching was introduced and the gate has been green ever since.
**Cause:** possibly correct; possibly it is no longer checking.
**Fix:** 🔴 re-test it. A caching change changes how the check runs, and a run that
reused everything is indistinguishable from one that checked everything.

## Interview questions

**Why does `incremental: true` often do nothing in CI?**
Because CI starts from a clean checkout, so the `.tsbuildinfo` the flag writes is
never there to be read. The flag is half the mechanism; the other half is a cache
step that restores the file, and without it the setting is configured in the one
environment where it cannot pay.

**How would you key that cache?**
On the things that make the file unusable rather than merely out of date — the
compiler version, the `tsconfig`, the lockfile — with a prefix restore-key so a
near-miss still returns something. Keying on a hash of the sources is the common
mistake: it is correct and never hits, because every commit changes it.

**Is restoring a stale `.tsbuildinfo` dangerous?**
No, and that is what makes the fallback strategy viable. The compiler validates the
file against the current sources rather than trusting it, so an old entry costs you
savings rather than correctness. The cache needs to be recent, not current — the
file is a starting point, not an answer.

**What is the classic Docker mistake here?**
Copying the source before installing dependencies. Docker invalidates every layer
from the first changed one, so an install step that comes after `COPY . .` reruns on
every source edit. Copy the manifest and lockfile, install, then copy the source —
and keep generated files out of the build context with `.dockerignore`.

**Why does a local `.tsbuildinfo` in the image cause trouble?**
Because it describes a different machine's paths, so it is worse than having none —
and it also invalidates layers on a file that was never a real input. Build-only
state belongs in a cache mount, which is not part of the image at all.

**What does caching not buy you?**
Any change to what the gate covers. A cached run checks whatever the configuration
points at and no more, so every coverage caveat still applies — and because a run
that reused everything looks exactly like one that checked everything, introducing
caching is a reason to re-test the gate by breaking something on purpose.

---

← [08 · `skipLibCheck` as a performance lever](./08-skiplibcheck-as-a-performance-lever.md) · [Phase 12 index](./README.md)
