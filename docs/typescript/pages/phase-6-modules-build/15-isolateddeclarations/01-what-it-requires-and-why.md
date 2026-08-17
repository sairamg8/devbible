---
title: "What it requires, and who it is for"
sidebar_label: "01 · What it requires, and why"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the `isolatedDeclarations` option record (including its
> **category**) and the whole `TS90xx` diagnostic range are read out of the
> compiler's own option table and numbered message table in the installed
> **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

`isolatedDeclarations` is usually introduced as *"a strictness flag that makes
you annotate things"*. That is what it feels like and it is not what it is for.
The option record says what it is for, in one line:

```js
{
  name: "isolatedDeclarations",
  type: "boolean",
  category: Diagnostics.Interop_Constraints,
  description: Diagnostics
    .Require_sufficient_annotation_on_exports_so_other_tools_can_trivially_generate_declaration_files,
  defaultValueDescription: false,
  affectsBuildInfo: true,
  affectsSemanticDiagnostics: true
}
```

> 🔴 *"Require sufficient annotation on exports so **other tools** can trivially
> generate declaration files."*

## Read the category, not just the description

🔴 **It is filed under `Interop_Constraints`** — the same category as
`esModuleInterop`, `allowSyntheticDefaultImports` and `erasableSyntaxOnly`. Not
`Type_Checking`, not `Emit`, not `Completeness`.

That placement is the whole thesis. Like
[`erasableSyntaxOnly`](../../phase-0-how-typescript-runs/README.md)'s *"Do not
allow runtime constructs that are not part of ECMAScript"* — which shares its
category and its exact flag pair, `affectsBuildInfo` + `affectsSemanticDiagnostics`
— this is **a constraint you accept so that something other than `tsc` can do a
job**.

The job is declaration emit. And the constraint exists because of a property of
declaration emit that is easy to miss:

## Why `tsc` is the only thing that can generate `.d.ts` today

To write `export declare function parse(input: string): ParseResult;`, a tool
must know what `parse` returns. If the source says:

```ts
export function parse(input: string) {
  return { ok: true, value: input.trim() };
}
```

…then working out the return type requires **type inference over the whole
program** — following `input.trim()` to `String.prototype.trim`, and so on. Only
a full type checker can do that, which means only `tsc` can emit declarations,
which means:

- Declaration emit **cannot be parallelised per file**, because each file's
  answer may depend on any other.
- Fast transpilers — esbuild, swc, oxc — **can strip types but cannot emit
  `.d.ts`**, so a build that wants both ends up running `tsc` anyway, for the
  slowest part.

🔴 **`isolatedDeclarations` removes that dependency.** If every exported thing is
annotated, generating the declaration for a file needs *only that file* — a
syntactic transformation any tool can do, in parallel, quickly.

📌 **The name is the give-away, and it parallels `isolatedModules` exactly.**
[Topic 05](../05-isolatedmodules/README.md) constrains you so each file can be
*transpiled* alone; this constrains you so each file can be *declared* alone.
Same shape, different output.

## What it actually asks for

The requirements are the diagnostics, and there are seventeen of them
([chunk 02](./02-the-diagnostics.md) is the full catalogue). They reduce to one
rule:

> **Anything reachable from an export must have a type the compiler can write
> down by looking at this file alone.**

Which in practice means:

- **Explicit return types** on exported functions, methods and accessors
  (`TS9007`, `TS9008`, `TS9009`).
- **Explicit types** on exported variables, parameters and properties
  (`TS9010`, `TS9011`, `TS9012`).
- **No inference from expressions** the compiler would have to evaluate
  (`TS9013` and most of the rest).

## The build it buys you

```
without isolatedDeclarations          with isolatedDeclarations
──────────────────────────────        ────────────────────────────────
tsc  → .js  and  .d.ts                esbuild/swc → .js   (fast, parallel)
     (one process, whole program)     any tool    → .d.ts (fast, parallel)
                                      tsc --noEmit        (checking only)
```

⚠️ **Note what does not go away:** you still need a type checker to *check* your
code. `isolatedDeclarations` does not make `tsc` unnecessary — it makes `tsc`
unnecessary **on the emit path**, so checking can move off the critical path of a
build and into CI or a parallel job.

🔴 **That reframes the whole cost/benefit.** If your build already emits with
`tsc` and you have no intention of changing that, the flag buys you very little
directly — its value is almost entirely in enabling a different toolchain.
[Chunk 03](./03-adopting-it.md) is honest about that.

## The connection to the previous two topics

There is a second benefit that costs nothing extra, and this corpus has now
argued it twice:

- [Topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md) —
  `TS6354` skips a project's dependents when its emitted `.d.ts` did not change.
- [Topic 14 chunk 02](../14-incremental-builds/02-what-invalidates-it.md) — a
  file's `signature` is a hash of its emitted declaration, and an unchanged
  signature stops the rebuild cascade.

Both reward **declarations that do not move when implementations do**. An
inferred public return type moves with its body; an annotated one does not.

> 🔴 **`isolatedDeclarations` is those two arguments turned into a rule the
> compiler enforces.** You were being advised to annotate public surfaces for
> build-time reasons in both topics; this flag stops it being advice.

## Gotchas

**Symptom:** The flag is described as a strictness setting and dismissed as
noise.
**Cause:** It looks like `noImplicitAny` for return types.
**Fix:** Its category is `Interop_Constraints`. It exists so tools other than
`tsc` can emit declarations, not to catch bugs.

**Symptom:** It was enabled and the build got no faster.
**Cause:** Nothing changed about *who* emits — `tsc` is still doing it.
**Fix:** The flag enables a different toolchain; it does not install one. Chunk
03.

**Symptom:** Someone expects it to remove the need for `tsc`.
**Cause:** Conflating emit with checking.
**Fix:** You still need a checker. It moves emit off `tsc`, not checking.

**Symptom:** The requirement feels arbitrary on a specific line.
**Cause:** The rule is per-file self-sufficiency, not per-symbol strictness.
**Fix:** Ask *"could a tool write this file's `.d.ts` reading only this file?"*
That answers every case.

**Symptom:** A team enables it for "better types".
**Cause:** Annotations do improve error messages and stability, which is a real
side benefit.
**Fix:** Fine as a reason, but name it honestly — the flag's purpose is the
build.

**Symptom:** Confusion with `isolatedModules`.
**Cause:** The names are deliberately parallel.
**Fix:** `isolatedModules` = each file transpilable alone.
`isolatedDeclarations` = each file's `.d.ts` generatable alone.

**Symptom:** It is grouped with `erasableSyntaxOnly` in a config and nobody knows
why.
**Cause:** Same category, same flag pair, same motivation — both let a non-`tsc`
tool do a job correctly.
**Fix:** That grouping is coherent, not accidental.

## Interview questions

**★ What is `isolatedDeclarations` for?**
Its own description: *"Require sufficient annotation on exports so **other
tools** can trivially generate declaration files."* It is filed under
`Interop_Constraints`, not type checking — it exists so something other than
`tsc` can emit `.d.ts` files.

**★ Why can't esbuild or swc emit declarations today?**
Because an inferred public type can depend on any other file in the program, so
writing a declaration requires whole-program type inference. Only a full checker
can do it, which also means declaration emit cannot be parallelised per file.

**★ What does the flag actually require?**
That anything reachable from an export has a type the compiler can write down
from this file alone — explicit return types on exported functions, methods and
accessors, explicit types on exported variables, parameters and properties, and
no inference from expressions it would have to evaluate.

**★ Does it make `tsc` unnecessary?**
No. It takes `tsc` off the **emit** path, not the **checking** path. You still
need a checker; it can now run in parallel or in CI instead of gating the build.

**How is it related to `isolatedModules`?**
Deliberately parallel. `isolatedModules` constrains you so each file can be
*transpiled* alone; `isolatedDeclarations` so each file's declaration can be
*generated* alone.

**Is there a benefit even if you keep emitting with `tsc`?**
Yes — annotated public surfaces produce stable declarations, which is exactly
what `TS6354` and the incremental `signature` hash reward. This flag turns that
advice from topics 13 and 14 into an enforced rule.

**Why is it in the same category as `erasableSyntaxOnly`?**
Both are constraints accepted so a non-`tsc` tool can do a job correctly — one
for stripping types, one for emitting declarations. They even share the same
option-record flag pair.

---

← [Topic index](./README.md) · Next → [02 · The diagnostics](./02-the-diagnostics.md)
