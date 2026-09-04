---
title: "05 — `isolatedModules`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** for `isolatedModules`,
> `verbatimModuleSyntax`, `preserveConstEnums` and `erasableSyntaxOnly`; every
> diagnostic below is quoted verbatim from the installed **TypeScript 5.9.3**
> message table, and every default and implication is read from that build's
> option records and `_computedOptions` rather than recalled. **No sandbox, no
> console blocks.**

`isolatedModules` is the one compiler flag that is not about your code. It is
about **a different tool** — the single-file transpiler that will one day build
your project instead of `tsc` — and it is `tsc` agreeing to accept only code that
tool can also handle.

## The one-sentence version

**If a transpiler would have to open another file to emit a line correctly, the
line is banned.** Every rule in this topic is that sentence applied somewhere.

## Why it earns a topic rather than a paragraph

Because the flag is universally recommended, near-universally enabled, and
almost universally misunderstood in three specific ways:

1. **It is thought to make builds faster.** It does not. It makes the codebase
   *compatible* with tools that are faster.
2. **It is thought to be optional if you only run `tsc`.** In practice most
   projects already transpile somewhere — Jest, Vite, Next.js, `tsx`, Bun,
   Node's own type stripping — and without the flag those paths can silently
   miscompile.
3. **It is thought to be free.** Nine of its ten rules cost two tokens. The
   tenth changes what your code compiles to.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The one-file compiler](./01-the-one-file-compiler.md) | why the flag exists, and the re-export that no transpiler can emit correctly |
| 02 | [Every rule it enforces](./02-every-rule.md) | all ten diagnostics, each read as "what would the transpiler have to look up?" |
| 03 | [`const enum` under the flag](./03-const-enum.md) | 🔴 the one rule with a real cost — the optimisation is turned off, not just restricted |
| 04 | [And `verbatimModuleSyntax`](./04-and-verbatim-module-syntax.md) | 🔴 one implies the other, and they share their diagnostics word for word |
| 05 | [Adopting it](./05-adopting-it.md) | the order that works, the two errors that are not mechanical, and the audit |

## Four sentences to keep

1. **The flag restricts input, never output.** Its option record has no
   `affectsEmit`; `verbatimModuleSyntax`'s does, and that is the whole difference
   between them.
2. **`verbatimModuleSyntax` implies it** — the computed value is
   `isolatedModules || verbatimModuleSyntax`, so a config that never mentions
   `isolatedModules` may still be enforcing every rule here.
3. **`const enum` loses its point under the flag**, because `preserveConstEnums`
   is computed on, and an *ambient* `const enum` becomes an outright error
   (TS2748) that no setting can rescue.
4. **`tsc --init` writes both flags live**, under a header called *Recommended
   Options*. Turning them off is now the decision that needs a reason.

## The clearest evidence in the compiler

Two names, both read out of 5.9.3, that say what the flag is more plainly than
any documentation:

- **TS18055** — *"'{0}' has a string type, but must have **syntactically
  recognizable** string syntax when 'isolatedModules' is enabled."* That phrase
  is the standard: what the checker knows and what the text says must agree.
- **`appearsValueyToTranspiler`** — the checker's own variable name for the
  condition behind TS2865. The compiler is explicitly modelling what a *different
  tool* would conclude from the same characters.

## Where this connects

- **← [Topic 02 · `import type` and `verbatimModuleSyntax`](../02-import-type-and-verbatim-module-syntax/README.md)**
  — the stronger flag that implies this one. Read that for the emit half; this
  topic owns the portability half.
- **← [Topic 01 · The defaults you did not set](../01-module-and-moduleresolution/07-the-defaults-you-did-not-set.md)**
  — `moduleDetection` and the computed-option chain, of which
  `isolatedModules → preserveConstEnums` is another link.
- **→ [Phase 7 · The module format](../../phase-7-server/01-tsconfig-for-a-node-service/02-the-module-format.md)**
  — `erasableSyntaxOnly` on a real Node service, the strictest member of this
  family.
- **← [Phase 4 · Decorators](../../phase-4-classes-declarations/13-decorators.md)**
  — the context for TS1272, and why `emitDecoratorMetadata` codebases move
  slowest.
- **Deliberately not here:** the elision rules and import-form rewriting, which
  are `verbatimModuleSyntax`'s and belong to topic 02.

---

← [Phase 6 index](../README.md) · Next → [01 · The one-file compiler](./01-the-one-file-compiler.md)
