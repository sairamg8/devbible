---
title: "The up-to-date check"
sidebar_label: "02 · The up-to-date check"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — every message below is quoted from the compiler's own
> numbered diagnostic table in the installed **TypeScript 5.9.3** build, with
> `TS6354` and `TS6388` cross-checked in the **7.0.2** native binary. The
> `assumeChangesOnlyAffectDirectDependencies` description is its own option
> record's. **No sandbox, no console blocks** — no build was run and no output is
> reproduced.

`tsc -b`'s whole value is deciding **not** to build things. This chunk is how it
decides, which matters because the two questions people actually ask — *"why did
that rebuild?"* and the much worse *"why did that **not** rebuild?"* — are both
answered by these messages, and `--verbose` prints them.

## The out-of-date reasons

| Code | Message |
|---|---|
| **6352** | *"Project '{0}' is out of date because output file '{1}' does not exist"* |
| **6350** | *"Project '{0}' is out of date because output '{1}' is older than input '{2}'"* |
| **6353** | *"Project '{0}' is out of date because its dependency '{1}' is out of date"* |
| **6381** | *"Project '{0}' is out of date because output for it was generated with version '{1}' that differs with current version '{2}'"* |
| **6388** | *"Project '{0}' is being forcibly rebuilt"* |

🔴 **`TS6381` is the one worth knowing about in advance.** Upgrading TypeScript
invalidates every project's output, because the version is recorded in the
buildinfo. A CI cache that survives a TypeScript bump will produce one very slow
build, and it is not a bug — it is the compiler correctly refusing to trust
output from a different version.

## The up-to-date reasons — and the interesting one

| Code | Message |
|---|---|
| **6351** | *"Project '{0}' is up to date because newest input '{1}' is older than output '{2}'"* |
| **6361** | *"Project '{0}' is up to date"* |
| 🔴 **6354** | *"Project '{0}' is up to date with `.d.ts` files from its dependencies"* |

**`TS6354` is the optimisation that makes project references worth having**, and
it is worth stating carefully:

> A dependency was rebuilt. Its **emitted declarations did not change**. So every
> project that depends on it is *still up to date*, because nothing it can
> observe about that dependency has changed.

Change a function body in `shared` and `shared` rebuilds — but its `.d.ts` is
byte-identical, so `ui`, `api` and everything downstream are skipped. In a graph
of any depth this is the difference between a two-second build and a two-minute
one.

📌 **It is also the strongest practical argument for keeping declarations
stable**, which is an argument for explicit return-type annotations on a
package's public surface: an inferred type that changes shape when an
implementation detail changes invalidates the whole downstream graph.
**15 · `isolatedDeclarations`** *(not written yet)* takes that further.

### Timestamp-only updates

```text
TS6359: Updating output timestamps of project '{0}'...
TS6371: Updating unchanged output timestamps of project '{0}'...
```

The other half of the same optimisation. When the outputs are semantically
current but their timestamps are behind, `tsc -b` **touches the files rather than
regenerating them**. That is why a build can report activity on a project and
produce byte-identical output — nothing is wrong, and it is not a wasted rebuild.

## Reading a `--verbose` build

The messages come in a predictable shape, and the reading is mechanical:

```
Projects in this build: …                (TS6355 — the computed order)
Project 'shared' is out of date because output … does not exist   (TS6352)
Building project 'shared'...             (TS6358)
Project 'ui' is up to date with .d.ts files from its dependencies (TS6354)
```

🔴 **Read the *reason*, not the verb.** "Building" tells you nothing you did not
know; the out-of-date reason tells you what to change if you did not want that
rebuild. `TS6355` first, to confirm the graph is what you think it is.

## `--dry` and `--force`, and what each is for

```text
TS6357: A non-dry build would build project '{0}'
TS6374: A non-dry build would update timestamps for output of project '{0}'
TS6356: A non-dry build would delete the following files: {0}
```

**`--dry`** answers *"what does the build think it needs to do?"* without doing
it. Its most valuable use is with `--clean`, where `TS6356` lists what would be
deleted — worth reading once before running a `--clean` in a repo you did not
configure.

**`--force`** *"Build all projects, including those that appear to be up to
date"*. It is a **diagnostic tool, not a fix**: if `--force` makes a problem go
away, the problem is in the up-to-date check's inputs, and putting `--force` in
CI hides it permanently while paying the cost every run.

⚠️ **A `--force` in a CI script is a defect marker.** Someone hit a staleness
problem and made it invisible. Find out which project was wrongly considered
current.

## `assumeChangesOnlyAffectDirectDependencies`

```text
"Have recompiles in '--incremental' and '--watch' assume that changes within a
 file will only affect files directly depending on it."
```

An opt-in relaxation: propagate a change one level instead of transitively. It
makes large watch builds much faster and it is **unsound by design** — a change
whose effects reach two levels down will not be rechecked.

📌 **Reasonable in a watch loop, wrong in CI.** The whole point of the CI build is
to be the one that does not take shortcuts.

## When the check is wrong

It relies on file timestamps and the recorded buildinfo, so anything that
disturbs either can mislead it:

- **A checkout or a cache restore** that writes source files with timestamps
  *older* than existing outputs. The build sees current outputs and skips.
- **Hand-edited files in `dist`.** They are newer than the source, so the project
  looks current — and your edit survives until something else invalidates it.
- **Clock skew** in containers or across network filesystems.

🔴 **The correct response is `--clean` then a full build, not `--force` in
perpetuity.** `--force` treats the symptom every time; `--clean` removes the
inconsistent state once.

## Gotchas

**Symptom:** Everything rebuilds after a TypeScript upgrade.
**Cause:** `TS6381` — the recorded version differs, so no output is trusted.
**Fix:** Expected and correct. Budget for one slow build after a bump.

**Symptom:** A dependency rebuilt and its dependents did not.
**Cause:** `TS6354` — the emitted `.d.ts` did not change, so nothing observable
changed.
**Fix:** Working as designed, and it is the main reason to use references.

**Symptom:** A project reports activity but its output is byte-identical.
**Cause:** `TS6359`/`TS6371` — a timestamp-only update.
**Fix:** Not a wasted rebuild.

**Symptom:** A trivial implementation change invalidates the entire graph.
**Cause:** An inferred public type changed shape with it.
**Fix:** Annotate the public surface explicitly. Stable declarations are what
make `TS6354` fire.

**Symptom:** `--force` fixes a mysterious build failure.
**Cause:** The up-to-date check was given misleading inputs — usually
timestamps.
**Fix:** `--clean` and rebuild once. `--force` in CI hides the defect and pays
for it every run.

**Symptom:** A cache restore leaves the build convinced everything is current.
**Cause:** Restored sources with timestamps older than the cached outputs.
**Fix:** Cache the outputs *and* the buildinfo together, or clean on restore.

**Symptom:** A watch build misses an error that CI catches.
**Cause:** `assumeChangesOnlyAffectDirectDependencies` — deliberately
non-transitive.
**Fix:** Expected. Do not enable it in CI.

**Symptom:** Someone edited a file in `dist` and the change persisted through
builds.
**Cause:** The edit made the output newer than its input, so the project looked
current.
**Fix:** `--clean`. And nothing should be edited in `dist`.

## Interview questions

**★ What makes project references fast?**
`TS6354` — *"up to date with `.d.ts` files from its dependencies"*. When a
dependency rebuilds but its emitted declarations do not change, every downstream
project is skipped, because nothing it can observe has changed. In a deep graph
that is the whole win.

**★ What does that imply about how you write a package's public API?**
That stable declarations are valuable. An inferred public type that changes shape
whenever an implementation detail changes invalidates the entire downstream
graph, so explicit return-type annotations on the public surface pay for
themselves in build time.

**★ Why does everything rebuild after a TypeScript upgrade?**
`TS6381` — the compiler version is recorded in the buildinfo, and output
generated by a different version is not trusted. Correct behaviour, and worth
anticipating in CI cache planning.

**★ Is `--force` in a CI script a good idea?**
No — it is a defect marker. It means someone hit a staleness problem and made it
invisible while paying full build cost every run. The right response is `--clean`
once, then find out why a project was wrongly considered current.

**What can make the up-to-date check wrong?**
Anything that disturbs timestamps or the buildinfo: a checkout or cache restore
writing sources older than existing outputs, hand-edited files in `dist`, or
clock skew.

**What does `assumeChangesOnlyAffectDirectDependencies` do and where does it
belong?**
It assumes a change in a file affects only its direct dependents rather than
propagating transitively. It is unsound by design, which makes it reasonable in a
watch loop and wrong in CI.

**A project reports a timestamp update but no output change. Is that a wasted
rebuild?**
No. `TS6359`/`TS6371` — the outputs were semantically current and only their
timestamps were behind, so the build touched them instead of regenerating them.

**What is `--dry` most useful for?**
Combined with `--clean`, where `TS6356` lists exactly what would be deleted —
worth reading before running a clean in a repository you did not configure.

---

← Prev: [01 · What `tsc -b` does](./01-what-tsc-b-does.md) · Next → [03 · Errors do not stop the build](./03-errors-do-not-stop-the-build.md)
