---
title: "`isolatedDeclarations`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the option record (including its **category**), the whole
> `TS90xx` range, and 🔴 the **sole call site of `TS9005`/`TS9006` in
> `transformDeclarationsForJS`** are read out of the compiler's own tables and
> source in the installed **TypeScript 5.9.3** build. **No sandbox, no console
> blocks** — and **no speed figure is claimed anywhere**, because none was
> measured.

## The one-sentence version

> **It requires enough annotation on exports that a tool other than `tsc` can
> generate a file's `.d.ts` by reading only that file** — which is why its
> category is `Interop_Constraints` and not type checking.

## Four sentences worth keeping

1. 🔴 **The purpose is other tools.** Its own description: *"Require sufficient
   annotation on exports so **other tools** can trivially generate declaration
   files."* Today only `tsc` can, because an inferred public type may depend on
   any file in the program.
2. **It does not make your build faster by itself.** It is a *precondition* for a
   parallel emit toolchain. Enable it and keep emitting with `tsc` and nothing
   changes — except that declarations become stable.
3. **The mechanical migration is mostly automated.** `TS9027`–`TS9036` are
   quick-fix labels, so fix-all plus a careful diff review is the realistic
   shape.
4. 🔴 **`TS9005`/`TS9006` are not its diagnostics**, despite the number range —
   neither names the flag, and their sole call site is the JavaScript declaration
   path.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What it requires, and why](./01-what-it-requires-and-why.md) | The `Interop_Constraints` category, why only `tsc` can emit `.d.ts`, the parallel with `isolatedModules` |
| 02 | [The diagnostics](./02-the-diagnostics.md) | All seventeen, sorted by what response each needs; the `TS9005` correction |
| 03 | [Adopting it](./03-adopting-it.md) | What is smaller than it looks, what is larger, and the order to do it in |

## 🔴 The compiler behaviours this topic settles

1. **Its category is `Interop_Constraints`** — shared with `esModuleInterop` and
   `erasableSyntaxOnly`, along with the exact flag pair `affectsBuildInfo` +
   `affectsSemanticDiagnostics` (chunk 01).
2. **The diagnostics fall into three groups** — annotation requirements
   (9007–9012), inference refusals (9013–9018, 9038), structural refusals
   (9019–9026, 9037, 9039) — and only the first has an annotation-shaped fix
   (chunk 02).
3. 🔴 **`TS9005`/`TS9006`'s sole call site is `transformDeclarationsForJS`**, so
   they mean `allowJs` + `declaration`, not this flag (chunk 02).
4. **`TS9027`–`TS9036` are quick-fix menu labels**, matching phase 10's finding
   about the 90xxx/95xxx ranges — so most requirements are one keystroke
   (chunk 02).
5. **`TS9009` says *"at least one"* accessor**, which shows the rule is about
   sufficiency rather than blanket annotation (chunk 02).

## Where this connects

- **← [Topic 05 · `isolatedModules`](../05-isolatedmodules/README.md)** — the
  deliberate parallel. That flag makes each file *transpilable* alone; this one
  makes each file's declaration *generatable* alone.
- **← [Topic 07 · When declaration emit fails](../07-authoring-d-ts-files/08-when-declaration-emit-fails.md)**
  — the `TS4053`/`TS2742` family this flag largely pre-empts by requiring the
  annotations that would have unblocked them.
- **← [Topic 13 · The up-to-date check](../13-project-references/02-the-up-to-date-check.md)**
  and **[Topic 14 · What invalidates it](../14-incremental-builds/02-what-invalidates-it.md)**
  — both argue for stable declarations on build-time grounds. 🔴 **This topic is
  that argument turned into an enforced rule.**
- **← [Phase 4 · Mixins](../../phase-4-classes-declarations/14-mixins/README.md)**
  — `TS9021`/`TS9022` make the mixin factory pattern unbuildable under this flag.
  ⚠️ That page also cites `TS9005` for a `.ts` example, where it would not
  actually fire (see chunk 02); it belongs to another lane and has been flagged
  rather than edited.
- **→ [16 · Typing non-code imports](../16-typing-non-code-imports/README.md)** — the last topic in this
  phase.
- **→ Phase 12 · Tooling, performance and testing** *(not written yet)* — where
  the emit-toolchain speed question actually belongs.

---

← [Phase 6 index](../README.md) · Start → [01 · What it requires, and why](./01-what-it-requires-and-why.md)
