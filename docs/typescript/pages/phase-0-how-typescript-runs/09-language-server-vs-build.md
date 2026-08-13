---
title: "The language server is not the build"
sidebar_label: "09 · Editor vs build"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 with **TypeScript 7.0.2** and **5.9.3** installed side by
> side in `sandbox/ts-p0/`, run against the same file (`ex4-strict.sh`,
> `ex6-where-types-come-from.sh`).

**Your editor is running a different program, on a different file set, with a
different compiler version, than CI.** Usually they agree. The value of this page
is knowing exactly which four things can make them disagree, so "works on my
machine" takes minutes instead of an afternoon.

## Two programs, one codebase

| | Editor | CI |
|---|---|---|
| Process | a long-lived language server | `tsc --noEmit`, cold, once |
| Compiler version | often the **editor's bundled** one | the repo's `devDependencies` |
| Files | the ones you have open, resolved outward | everything `include` matches |
| State | incremental, in-memory, includes **unsaved buffers** | the files on disk |
| Config | the nearest `tsconfig.json` to the open file | the one you passed |

Both use the same type checker. Neither is more correct. They just answer
different questions, and every disagreement traces to one of those five rows.

## Disagreement 1 — different compiler version

Same file, two compilers installed in one folder:

```console
$ node node_modules/typescript/bin/tsc --noEmit --target es2022 src-ex4/loose.ts
src-ex4/loose.ts(1,19): error TS7006: Parameter 'id' implicitly has an 'any' type.
src-ex4/loose.ts(6,13): error TS18047: 'user' is possibly 'null'.
src-ex4/loose.ts(9,3): error TS2564: Property 'token' has no initializer…
src-ex4/loose.ts(13,44): error TS18046: 'err' is of type 'unknown'.
exit=1
```

```console
$ node node_modules/typescript5/bin/tsc --noEmit --target es2022 src-ex4/loose.ts
exit=0
```

**Four errors on one, silence on the other, same file, same flags.** The cause is
the changed `strict` default ([05](./05-strict.md)) — but the shape of the
problem is what matters: a version difference produces a completely different
verdict, with no hint that versions are involved.

This is exactly what happens when the editor uses its bundled TypeScript and the
repo pins another. **Fix:** point the editor at the workspace version. In VS Code:
*TypeScript: Select TypeScript Version → Use Workspace Version*, and commit
`.vscode/settings.json` with `"typescript.tsdk": "node_modules/typescript/lib"`
so it is the default for everyone.

## Disagreement 2 — different file set

The compiler's program is the closure of `include` plus everything imported. The
editor's is seeded by what you have open.

Consequences:

- A file **nobody imports and `include` misses** is checked in your editor when
  you open it, and never in CI. Its errors ship.
- A `.d.ts` outside `include` types things in your editor and not in CI.
- Ambient `@types` auto-inclusion depends on the **cwd**, which for the editor is
  the workspace root and for CI is wherever the script ran — the confound that
  broke the benchmark in [07](./07-typescript-7-native-compiler.md).

**Fix:** make `include` describe reality, and run `tsc --noEmit` locally at least
once before pushing — it is the only way to see the CI file set.

## Disagreement 3 — unsaved buffers and stale state

The language server reads your editor's in-memory buffer. `tsc` reads disk. Half
of "the error is wrong" is an unsaved file — yours or a dependency's.

The server is also incremental and can go stale after a `git checkout`, a
dependency install, or a `tsconfig.json` edit. **Restart TS Server** is the fix,
and it is worth trying *before* debugging anything that looks impossible.

## Disagreement 4 — different config

The server picks the nearest `tsconfig.json` above the open file. In a monorepo
or a project with `tsconfig.node.json` alongside `tsconfig.json`, that can be a
different file from the one CI passes — different `strict`, `lib`, `types`,
`paths`.

**Fix:** one config per source root, and a CI script that names its config
explicitly (`tsc -p tsconfig.json --noEmit`) rather than relying on discovery.

## What the editor gives you that CI cannot

Worth being explicit, because the point is not that the editor is unreliable:

- **Completion, hover and go-to-definition** — the checker answering
  interactively.
- **Rename across the project**, driven by real references rather than text.
- **Quick fixes** — add a missing import, implement an interface's members.
- **Errors as you type**, before a save, let alone a commit.

These come from the same type information; they are the reason the server exists
as a long-lived process at all.

## Trade-off

**Trusting the editor** is fast and usually right, and quietly lets
non-`include`d files and version drift through.

**Trusting only CI** is authoritative and slow — a five-minute round trip for a
typo.

**The working arrangement:** editor for the inner loop, `tsc --noEmit` as the
authority, both pinned to the same compiler version so the two rarely differ.

## Gotchas

**Symptom:** Editor is clean, CI reports errors
**Cause:** Version drift (editor's bundled TypeScript vs the repo's) or a file CI
includes and your editor never opened.
**Fix:** Use the workspace TypeScript version; run `tsc --noEmit` locally.

**Symptom:** Editor reports errors, CI is clean
**Cause:** The file is outside `include`, or the server picked a different,
stricter config.
**Fix:** Check which `tsconfig.json` applies to that path.

**Symptom:** An error that cannot possibly be true, and does not go away
**Cause:** Stale language-server state after a checkout or install.
**Fix:** Restart TS Server. If it persists, delete `.tsbuildinfo` and retry.

**Symptom:** Errors that vanish on save
**Cause:** The server was checking the unsaved buffer.
**Fix:** Normal. Save before believing anything.

**Symptom:** Autocomplete works but `tsc` says the module has no types
**Cause:** The editor resolved a `.d.ts` through a path CI's `include` or `types`
does not cover.
**Fix:** Bring the declaration inside the project's file set.

## Interview questions

**★ Why can your editor and CI disagree about the same file?**
They are different programs: different compiler version, different file set
(open-file closure vs `include`), in-memory buffers vs disk, incremental state vs
a cold run, and possibly a different `tsconfig.json`. A version difference alone
is enough — the same file gave four errors on 7.0.2 and none on 5.9.3, because
the `strict` default changed.

**★ How do you make them agree?**
Pin the editor to the workspace TypeScript version, keep one `tsconfig.json` per
source root, make `include` describe the real file set, and treat `tsc --noEmit`
as the authority.

**★ What is the language server actually doing?**
Running the same type checker as a long-lived incremental process, answering
queries about the files you have open — diagnostics, completion, hover,
references, rename, quick fixes — including for unsaved buffers.

**Why does restarting TS Server fix things so often?**
It is incremental and caches program state. Checkouts, dependency installs and
config edits can invalidate assumptions it does not notice, leaving diagnostics
computed against a world that no longer exists.

**A file has errors in the editor but is never checked in CI. How?**
It is not in the program CI builds — no `include` glob matches it and nothing
included imports it. The editor checked it because you opened it. Broaden
`include` or delete the file.

---

← Prev: [Where types come from](./08-where-types-come-from.md) · Next → [Checking is not transpiling](./10-checking-vs-transpiling.md)
