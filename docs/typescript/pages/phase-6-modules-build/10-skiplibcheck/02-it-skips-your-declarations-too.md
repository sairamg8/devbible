---
title: "It skips *your* declaration files too"
sidebar_label: "02 · It skips your declarations too"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the predicate is read out of the compiler's own
> `skipTypeCheckingWorker` in the installed **TypeScript 5.9.3** build, not
> recalled; the `declaration`/`emitDeclarationOnly` behaviour is the **TSConfig
> reference**'s. **No sandbox, no console blocks.**

[Chunk 01](./01-what-it-actually-skips.md) established the clause:

```js
options.skipLibCheck && sourceFile.isDeclarationFile
```

This chunk is about the four words that are missing from it — **and nothing about
`node_modules`** — because that omission is the difference between the flag most
people think they enabled and the one they actually did.

## The mental model almost everybody has

> *"`skipLibCheck` stops the compiler wasting time checking other people's types
> in `node_modules`."*

That sentence is how the flag is universally described, it is how it is usually
justified in a code review, and it is **wrong in a way that only bites library
authors** — which is exactly why it survives. In an application, the wrong model
and the right one predict the same outcome, so nothing corrects it.

## What the predicate actually covers

`isDeclarationFile` is a property of the parsed source file. It is true for any
file the compiler treats as a declaration file, and the compiler's program
contains four distinct populations of those:

| Population | Where it comes from | Skipped by the flag? |
|---|---|---|
| `node_modules/**/*.d.ts` | dependencies that ship their own types | ✅ yes |
| `node_modules/@types/**` | DefinitelyTyped packages | ✅ yes |
| `lib.*.d.ts` | TypeScript's own standard library | ✅ yes — see [chunk 05](./05-skipdefaultlibcheck-and-neighbours.md) |
| 🔴 **`src/types/*.d.ts`, your `globals.d.ts`, your shims, your emitted `dist/*.d.ts`** | **you wrote or built them** | 🔴 **yes — identically** |

That last row is the one that matters. The compiler draws no distinction between
a declaration file you authored this morning and one that arrived with a
dependency three years ago. Both are declaration files; both stop being checked.

## The three places this actually costs you

### 1. Hand-authored `.d.ts` files in your own repo

Everything [topic 07](../07-authoring-d-ts-files/README.md) taught you to write —
a `globals.d.ts`, an ambient module declaration, a `.d.ts` describing a legacy
script — is unchecked the moment `skipLibCheck` is on.

That is not merely "you lose a safety net". It means the file can contain claims
that are internally inconsistent and nobody finds out at build time. The
consumers of those claims — your own `.ts` files — are still checked, so you get
errors *there* that trace back to a declaration nobody validated. Debugging that
is unpleasant precisely because the true source of the problem is in the one file
the compiler has been told to ignore.

### 2. Shims for untyped dependencies

[Topic 08](../08-typing-an-untyped-dependency/README.md) is entirely about
writing a `declare module 'legacy-lib'` shim, and it makes the point that a shim
must be a **script** file while an augmentation must be a **module** file — an
asymmetry that produces `TS2664` and `TS2665` when you get it the wrong way
round.

⚠️ **Those diagnostics come from checking the declaration file.** With
`skipLibCheck: true`, the shim that is subtly the wrong shape can fail silently:
you do not get told the augmentation targets nothing, you simply get `any` (or
`TS2307`) at the use site and no explanation.

### 3. 🔴 The declaration files your own build emits

This is the sharpest form of the problem, and it is the reason the rule in
[phase 7](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)
is phrased as *"`true` in an application, `false` in the CI job that builds a
published library's declarations"*.

Consider the ordinary two-step of publishing a package:

1. `tsc` compiles `src/**/*.ts` and emits `dist/**/*.d.ts`.
2. Something — a test, a second compile, a smoke-test package — consumes `dist`.

At step 2, `dist/index.d.ts` is a declaration file. With `skipLibCheck: true`, it
is **not checked**. So the artefact you are about to publish, the one thing whose
correctness your consumers depend on entirely, is the exact file the flag
excludes from verification.

> 🔴 **`skipLibCheck: true` in a library's build config means you can ship a
> `.d.ts` that does not type-check and never know.** Your consumers find out,
> because *their* config might not have the flag — or because their editor shows
> them an error inside your package that you have never seen.

### The self-consumption trap in a monorepo

The same shape appears without any publishing at all. A monorepo where
`packages/app` imports `packages/lib` **via `lib`'s built `dist/*.d.ts`** is
consuming a declaration file, so `skipLibCheck` in the root config covers it.
That is one of the two configurations **12 · Sharing types across a monorepo**
*(not written yet)* has to distinguish, and it is why the editor-versus-build
divergence in a monorepo so often turns out to be this flag.

## What this does *not* mean

Be precise about the boundary, because over-claiming here is easy:

- ❌ It does **not** mean your `.ts` files stop being checked. The predicate is
  per source file and `isDeclarationFile` is false for them.
- ❌ It does **not** mean the *types declared in* your `.d.ts` stop applying. They
  are loaded, resolved, and used at every call site as normal. What stops is
  checking whether the declarations are coherent **among themselves**.
- ❌ It does **not** affect declaration *emit* errors. Those are computed from the
  `.ts` file being emitted from, and `getDeclarationDiagnosticsForFile` returns
  early for declaration files regardless of the flag. The `TS4053` "private name"
  family in [topic 07 chunk 08](../07-authoring-d-ts-files/08-when-emit-fails.md)
  still fires.

That third point is worth holding onto: **the flag cannot make a broken build
emit a `.d.ts`, but it can stop anyone noticing the `.d.ts` it emitted is
wrong.**

## The rule that follows

Two configs, and the split is not arbitrary:

```jsonc
// tsconfig.json — the app / dev loop
{ "compilerOptions": { "skipLibCheck": true } }

// tsconfig.build.json — the job that produces published declarations
{ "extends": "./tsconfig.json",
  "compilerOptions": { "skipLibCheck": false, "declaration": true } }
```

The reasoning is not "one is safer". It is that the two builds have **different
declaration-file populations that matter**. In the app build the interesting
declaration files are other people's and you cannot fix them anyway. In the
library build the interesting declaration file is *yours*, and it is the
deliverable.

[Chunk 08](./08-choosing-it.md) turns this into a policy, including what to do
when turning it off floods you with unrelated errors.

## Gotchas

**Symptom:** A published package's consumers report type errors inside its
`.d.ts` and CI is green.
**Cause:** `skipLibCheck: true` in the config that produced the declarations —
the artefact was never checked.
**Fix:** `skipLibCheck: false` in the declaration-building config. This is the
canonical case for the two-config split.

**Symptom:** A hand-written `globals.d.ts` has an obvious mistake and no error is
reported.
**Cause:** It is a declaration file. The flag does not care that you wrote it.
**Fix:** Turn the flag off, or move the declarations into a `.ts` file where they
are checked (only possible if they are not ambient).

**Symptom:** A `declare module` shim does not take effect and there is no
diagnostic explaining why.
**Cause:** `TS2664`/`TS2665` are raised by checking the declaration file, which
is skipped.
**Fix:** Temporarily disable the flag to see the real error. Topic 08 chunk 03
covers the script-versus-module condition behind most of them.

**Symptom:** In a monorepo, an error appears in `app` and points into `lib`'s
`dist/index.d.ts`, but building `lib` alone is clean.
**Cause:** `lib`'s own build has `skipLibCheck: true`, so its output was never
validated; `app` surfaces the inconsistency at the use site.
**Fix:** Check `lib`'s declarations in `lib`'s own build.

**Symptom:** Someone argues the flag is safe because "we don't have any `.d.ts`
files".
**Cause:** A repo almost always has some — `@types`, `vite-env.d.ts`, generated
declarations, `dist`.
**Fix:** `find . -name '*.d.ts' -not -path '*/node_modules/*'` settles it in a
second.

**Symptom:** Turning the flag off in the library build produces errors in
`node_modules`, not in your own `dist`.
**Cause:** It is all-or-nothing — there is no way to check only your declaration
files.
**Fix:** Expected, and chunk 08 covers the workaround: check the built package
from a separate, minimal project whose only dependency is the package itself.

**Symptom:** An `any` appears in a consumer where your `.d.ts` clearly declares a
type.
**Cause:** Not this flag — the declarations still apply. Look at resolution
(`types`, `exports`, `typesVersions`) instead.
**Fix:** **11 · Publishing a typed package** *(not written yet)*. `skipLibCheck`
never changes which types are found, only whether they are checked.

**Symptom:** A team disables the flag globally to be safe, and the build slows
down a lot and reports errors nobody can act on.
**Cause:** The population it now checks is dominated by dependencies.
**Fix:** That is the trade the flag exists for. Scope it to the build where your
own declarations are the deliverable.

## Interview questions

**★ Does `skipLibCheck` skip checking your own declaration files?**
Yes, identically to a dependency's. The predicate tests
`sourceFile.isDeclarationFile` and contains no path component, so a
`globals.d.ts` you wrote and a `.d.ts` in `node_modules` are treated the same.

**★ Why is `skipLibCheck: true` a problem for a library author specifically?**
Because the `.d.ts` files their build emits are declaration files, so the flag
excludes the published artefact from checking. They can ship a `.d.ts` that does
not type-check and only find out from consumers.

**★ What is the standard mitigation?**
Two configs: `skipLibCheck: true` for the application or dev loop,
`skipLibCheck: false` for the job that builds published declarations. The
populations of declaration files that matter differ between the two.

**★ Does `skipLibCheck` stop your `.d.ts` declarations from applying?**
No. They are still resolved and used at every call site. What stops is verifying
that the declarations are internally coherent — the types work, they are just
unvalidated.

**Does it affect declaration emit errors like the `TS4053` "private name"
family?**
No. Those are computed for the `.ts` file being emitted from, and the declaration
diagnostics path returns early for declaration files anyway. The flag cannot make
a failing declaration emit succeed.

**In a monorepo, when does this flag start mattering?**
As soon as a package consumes another package through its built `.d.ts` rather
than its source. At that moment the internal artefact is a declaration file and
falls under the flag.

**Why does the "it skips `node_modules`" model survive despite being wrong?**
Because in an application it predicts the right outcome — the only declaration
files anyone looks at are in `node_modules`. It only fails for library authors
and monorepos, which is a minority of the people repeating it.

---

← Prev: [01 · What it actually skips](./01-what-it-actually-skips.md) · Next → [03 · The file-format rules go quiet](./03-the-file-format-rules-go-quiet.md)
