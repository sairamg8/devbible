---
title: "What is actually in a `.tsbuildinfo`"
sidebar_label: "01 · What is in a .tsbuildinfo"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — 🔴 the field list below is read from the compiler's own
> buildinfo serialiser in the installed **TypeScript 5.9.3** build, and the
> `incremental` and `tsBuildInfoFile` option records from the same table. **No
> sandbox, no console blocks** — no buildinfo was generated and none is
> reproduced.

[Topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md) covered
the *decision* — which projects `tsc -b` rebuilds and why. This topic is the
**file that decision is made from**, and knowing what is in it explains both what
invalidates it and why caching it is worth doing.

## The two options

```js
{
  name: "incremental", shortName: "i", type: "boolean",
  category: Diagnostics.Projects,
  description: Diagnostics.Save_tsbuildinfo_files_to_allow_for_incremental_compilation_of_projects,
  defaultValueDescription: Diagnostics.false_unless_composite_is_set
}
```

🔴 **`defaultValueDescription` is literally *"false unless `composite` is
set"*** — the compiler stating in its own option table what
[topic 13 chunk 01](../13-project-references/01-what-tsc-b-does.md) found as the
`TS6379` diagnostic. Every composite project writes one of these whether or not
anyone asked.

```js
{
  name: "tsBuildInfoFile", type: "string",
  affectsEmit: true,
  affectsBuildInfo: true,
  isFilePath: true,
  defaultValueDescription: ".tsbuildinfo",
  description: Diagnostics.Specify_the_path_to_tsbuildinfo_incremental_compilation_file
}
```

📌 Note it carries **both** `affectsEmit` and `affectsBuildInfo` — changing where
the file goes changes the emit *and* is itself recorded, so a build that moves it
does not silently reuse the old one.

## The contents

Serialised as JSON, and the field names are the compiler's own:

| Field | What it holds |
|---|---|
| `fileNames` | a **table of paths**; everything else refers to files by index into it |
| `fileInfos` | per file: a `version` (a hash of the text), a `signature`, `impliedFormat`, `affectsGlobalScope` |
| `options` | 🔴 **only the options with `affectsBuildInfo`** — see [chunk 02](./02-what-invalidates-it.md) |
| `referencedMap` | which file references which — the dependency graph, at file granularity |
| `semanticDiagnosticsPerFile` | 🔴 **the errors themselves** |
| `emitDiagnosticsPerFile` | the same for emit-time diagnostics |
| `changeFileSet` | files known to have changed and not yet fully processed |
| `affectedFilesPendingEmit` | files that still need output written |
| `latestChangedDtsFile` | 🔴 composite only — the last declaration file whose content actually changed |
| `root` | the root file names |

Three of those rows deserve more than a line.

### 🔴 `version` and `signature` are different things

- **`version`** is a hash of the file's **text**. It answers *"did this file
  change at all?"*
- **`signature`** is a hash of the file's **emitted declaration**. It answers the
  much more useful question: *"did this file's public shape change?"*

That distinction is the whole engine of incremental compilation. Edit a function
body and the `version` changes while the `signature` does not — so the file is
recompiled and **nothing that depends on it is**.

📌 It is the file-level version of
[topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md)'s
`TS6354` at the project level, and it is the same argument for stable public
types arriving one scale down.

### 🔴 Errors are cached in the file

`semanticDiagnosticsPerFile` means a `.tsbuildinfo` stores the diagnostics
themselves. So an incremental run can **report an error it did not recompute** —
it read it from the cache for a file it had no reason to recheck.

That is correct and it is worth knowing, because it explains an otherwise eerie
experience: an error whose file you have not touched, reported instantly, with no
work done. Nothing is stale — the error is still true — but the compiler did not
re-derive it.

⚠️ It also means a corrupted or hand-edited buildinfo can make the compiler
report errors that no longer exist. `--clean` (or deleting the file) is the
reset.

### `latestChangedDtsFile` — composite only

`state.latestChangedDtsFile = compilerOptions.composite ? oldState?.latestChangedDtsFile : undefined`

🔴 **It is tracked only for composite projects, and it is what powers `TS6354`.**
Knowing the last time the emitted declarations *actually changed* is what lets
`tsc -b` tell a dependent *"your dependency rebuilt, but nothing you can see
changed"*. A non-composite incremental project does not track it, which is one
concrete thing `composite` buys beyond being referenceable.

## Where the file goes

Default `.tsbuildinfo`, but the real path is derived from `outDir` and the config
file name when you do not set `tsBuildInfoFile`. Which is why two configs sharing
an `outDir` collide — the trap
[topic 10 chunk 07](../10-skiplibcheck/07-the-tsbuildinfo-interaction.md)
predicted and `TS6377` reports.

> **One buildinfo path per distinct set of compiler options.** That rule comes up
> in three separate topics because it is violated in three separate ways.

## It is not a human artefact

The file is JSON, and reading it is occasionally useful — checking which options
were recorded, or whether a file you expected is in `fileNames`. But:

- 🔴 **It is not a supported format.** The shape has changed across versions and
  will again; `TS6381` exists precisely because output from another version is
  not trusted.
- **Never commit it.** It encodes absolute-ish paths and a compiler version.
- **Never hand-edit it.** The cached diagnostics make that worse than useless.

## Gotchas

**Symptom:** A `.tsbuildinfo` appeared without `incremental` being set.
**Cause:** `composite` implies it — *"false unless `composite` is set"*.
**Fix:** Expected. Make sure its path does not collide.

**Symptom:** An error is reported for a file nobody touched, instantly.
**Cause:** `semanticDiagnosticsPerFile` — it was read from the cache, not
recomputed.
**Fix:** Nothing. The error is still true.

**Symptom:** Errors persist after the code was fixed.
**Cause:** A stale or corrupted buildinfo serving cached diagnostics.
**Fix:** Delete it, or `tsc -b --clean`.

**Symptom:** A function-body change rebuilt the whole project.
**Cause:** The `signature` changed too — usually an inferred public type moved
with the implementation.
**Fix:** Annotate the public surface so the signature is stable.

**Symptom:** Two projects overwrite each other's buildinfo.
**Cause:** The default path derives from `outDir`/config name.
**Fix:** Explicit `tsBuildInfoFile` per project. `TS6377` catches it under
`tsc -b`.

**Symptom:** A committed `.tsbuildinfo` causes strange behaviour on other
machines.
**Cause:** It records paths and a compiler version.
**Fix:** Gitignore it. Cache it in CI instead — [chunk 03](./03-caching-it-in-ci.md).

**Symptom:** Someone parses the buildinfo in a script and it breaks on upgrade.
**Cause:** The format is internal and changes between versions.
**Fix:** Do not depend on it. `tsc -b --verbose` is the supported way to see the
decisions.

**Symptom:** A non-composite incremental project does not skip dependents the way
a composite one does.
**Cause:** `latestChangedDtsFile` is tracked only when `composite` is set.
**Fix:** Expected — it is one of the things `composite` buys.

## Interview questions

**★ What is stored in a `.tsbuildinfo`?**
A file-name table, per-file `version` and `signature` hashes plus
`impliedFormat`/`affectsGlobalScope`, the subset of compiler options that
`affectsBuildInfo`, the file-level reference map, the cached semantic and emit
diagnostics, the pending change and emit sets, and — for composite projects —
`latestChangedDtsFile`.

**★ What is the difference between a file's `version` and its `signature`?**
`version` hashes the file's **text** — did it change at all. `signature` hashes
its **emitted declaration** — did its public shape change. Editing a function
body changes the first and not the second, so the file recompiles and its
dependents do not. That distinction is the engine of incremental compilation.

**★ Are errors stored in the buildinfo?**
Yes — `semanticDiagnosticsPerFile` and `emitDiagnosticsPerFile`. An incremental
run can report an error it never recomputed, which is why a stale or corrupted
buildinfo can show errors for code that has been fixed.

**★ Why does a composite project track `latestChangedDtsFile` and a merely
incremental one not?**
Because it is what powers `TS6354` — telling a dependent that its dependency
rebuilt but its declarations did not change. That skip only matters across
projects, which is the composite case.

**Does `incremental` have to be set explicitly?**
Not for a composite project — its documented default is *"false unless
`composite` is set"*.

**Should a `.tsbuildinfo` be committed?**
No. It encodes paths and a compiler version, and `TS6381` will reject output from
a different version anyway. Cache it in CI instead.

**Is the format safe to parse in tooling?**
No — it is internal and has changed across versions. `tsc -b --verbose` is the
supported way to see what the build decided.

---

← [Topic index](./README.md) · Next → [02 · What invalidates it](./02-what-invalidates-it.md)
