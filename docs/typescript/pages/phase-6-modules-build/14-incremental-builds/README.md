---
title: "Incremental builds"
sidebar_label: "14 · Incremental builds"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the `.tsbuildinfo` field list, the
> `toIncrementalBuildInfoCompilerOptions` `affectsBuildInfo` filter, and the
> `incremental`/`tsBuildInfoFile` option records are read out of the compiler's
> own serialiser and option table in the installed **TypeScript 5.9.3** build.
> `TS6381` and `TS6377` are quoted from the numbered message table. **No sandbox,
> no console blocks** — and **no timing figure is claimed anywhere**, because
> none was measured.

## The one-sentence version

> **A `.tsbuildinfo` records, per file, a hash of the text and a hash of the
> emitted declaration** — and the gap between those two is the entire reason
> incremental builds are fast.

## Four sentences worth keeping

1. **`version` hashes the text; `signature` hashes the emitted declaration.** A
   body edit changes the first and not the second, so the file recompiles and its
   dependents do not.
2. 🔴 **Only options with `affectsBuildInfo: true` are stored**, which is the
   precise, greppable definition of what invalidates the cache.
3. **The errors are cached in the file.** An incremental run can report a
   diagnostic it never recomputed — and a stale buildinfo can report one that is
   no longer true.
4. **In CI, cache the buildinfo and its outputs together and key on
   configuration, never on source content.**

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What is in a `.tsbuildinfo`](./01-what-is-in-a-tsbuildinfo.md) | The field list, `version` vs `signature`, cached diagnostics, `latestChangedDtsFile` |
| 02 | [What invalidates it](./02-what-invalidates-it.md) | The `affectsBuildInfo` filter, `TS6381`, and real vs accidental invalidation |
| 03 | [Caching it in CI](./03-caching-it-in-ci.md) | Cache keys, the timestamp trap in both directions, and whether it is worth it |

## 🔴 The compiler behaviours this topic settles

1. **`incremental`'s documented default is *"false unless `composite` is
   set"***, so every composite project writes a buildinfo (chunk 01).
2. **`version` and `signature` are separate hashes** — text and emitted
   declaration — and the second is what stops the rebuild cascade (chunk 01).
3. **`semanticDiagnosticsPerFile` and `emitDiagnosticsPerFile` are persisted**,
   so errors are served from cache (chunk 01).
4. **`latestChangedDtsFile` is tracked only for `composite` projects**, which is
   what powers `TS6354` (chunk 01).
5. 🔴 **`toIncrementalBuildInfoCompilerOptions` filters on `affectsBuildInfo`,
   sorted by name** — so that flag decides invalidation, and reordering a config
   invalidates nothing (chunk 02).
6. **`tsBuildInfoFile` carries both `affectsEmit` and `affectsBuildInfo`**, so
   moving it is itself a recorded change (chunk 01).

## Where this connects

- **← [Topic 13 · Project references](../13-project-references/README.md)** — its
  [chunk 02](../13-project-references/02-the-up-to-date-check.md) owns the
  up-to-date **decision** and every reason code; this topic owns the **file** the
  decision reads. `TS6354` there is `signature` here, one scale up.
- **← [Topic 10 · `skipLibCheck`](../10-skiplibcheck/README.md)** — its
  [chunk 07](../10-skiplibcheck/07-the-tsbuildinfo-interaction.md) is the worked
  example of an `affectsBuildInfo` option invalidating a slice of the cache, and
  the source of the one-path-per-option-set rule.
- **← [Topic 12 · Sharing types across a monorepo](../12-sharing-types-across-a-monorepo/README.md)**
  — `composite` implies `incremental`, so every package in a referenced graph has
  one of these files.
- **→ 15 · `isolatedDeclarations`** *(not written yet)* — takes chunk 02's
  "annotate the public surface so the signature is stable" argument to its
  conclusion by requiring it.
- **→ Phase 12 · Tooling, performance and testing** *(not written yet)* — the
  measurement this topic deliberately does not make.

---

← [Phase 6 index](../README.md) · Start → [01 · What is in a `.tsbuildinfo`](./01-what-is-in-a-tsbuildinfo.md)
