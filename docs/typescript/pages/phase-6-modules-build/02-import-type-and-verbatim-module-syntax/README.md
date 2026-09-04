---
title: "02 — `import type` / `export type` and `verbatimModuleSyntax`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes**
> (`--verbatimModuleSyntax`, quoted verbatim including its examples), the
> **TSConfig reference**, and the **TypeScript handbook** on type-only imports.
> All **eleven** `verbatimModuleSyntax` diagnostics and the type-only re-export
> family were read out of the compiler's own message table in the installed
> **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

[Topic 01](../01-module-and-moduleresolution/README.md) settled which file an
import refers to and what format it is emitted in. This topic settles a
different question about the same line of code:

**Does this import still exist in the output at all?**

## The one-sentence version

TypeScript **deletes** imports it believes were only used for types — and that
deletion is a whole-program inference, made from information a single-file tool
does not have. `import type` lets you state the intent; `verbatimModuleSyntax`
makes stating it compulsory.

## Why this is a Master topic and not a footnote

Because the failure it prevents is silent, and it has three separate faces:

1. **A side effect disappears.** `import { Config } from "./setup"` where
   `./setup` also registers something at load time. The binding was type-only, so
   the whole statement is dropped — along with the registration. Nothing warns
   you; the module simply never runs.
2. **A single-file transpiler leaves an import that has no runtime export.**
   esbuild, SWC, Babel and Node's type stripper each see one file. They cannot
   tell an `interface` from a `class`, so they keep the import, and the runtime
   fails looking for an export that was only ever a type.
3. **The same source emits differently under different tools.** Which is the
   worst of the three, because it means your local build and your production
   build disagree about what your program is.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Import elision](./01-import-elision.md) | What the compiler deletes, why, and the two cases where the inference is genuinely undecidable |
| 02 | [The `type` modifier, every form](./02-the-type-modifier.md) | `import type`, inline `type`, `export type`, and where each one is legal |
| 03 | [`verbatimModuleSyntax`](./03-verbatim-module-syntax.md) | The rule in one sentence, the five diagnostics it adds to imports, and what it makes impossible |
| 04 | [Re-exports, the hardest case](./04-re-exports.md) | Six diagnostics about re-exporting a type, and why re-export is harder than import |
| 05 | [The CommonJS caveat](./05-the-commonjs-caveat.md) | `import x = require()`, `export =`, and the four errors that appear in a CommonJS file |
| 06 | [Adopting it](./06-adopting-it.md) | The flags it replaced, the migration, and when the answer is genuinely no |

## Three sentences to keep

1. **Elision is an inference; `type` is a declaration.** The flag's whole purpose
   is to replace the first with the second.
2. **Any tool that compiles one file at a time needs this.** Only `tsc` sees the
   whole program, and even there the flag makes the output predictable.
3. **Under `verbatimModuleSyntax`, what you see is what you get** — the 5.0
   release notes' own summary, and the reason it is worth the errors.

## Where this connects

- **← [Topic 01 · The two questions](../01-module-and-moduleresolution/01-the-two-questions.md)**
  — the specifier is emitted as written; this topic is about whether the
  *statement* is emitted at all.
- **← [Topic 01 · Format detection](../01-module-and-moduleresolution/09-format-detection.md)**
  — several of this topic's errors fire only in a file detected as CommonJS.
- **→ [Phase 7 · Emit layout and programs](../../phase-7-server/01-tsconfig-for-a-node-service/05-emit-layout-and-programs.md)**
  — the applied case: why the flag is not optional when Node strips types. That
  page owns the who-compiles argument; this topic owns the language rules.
- **→ Phase 6 · 05 · `isolatedModules`** *(not written yet)* — the weaker sibling,
  and the parts it catches that this flag does not.

---

← [Phase 6 index](../README.md) · Next → [01 · Import elision](./01-import-elision.md)
