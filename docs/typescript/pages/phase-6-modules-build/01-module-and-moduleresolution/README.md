---
title: "01 — `module` and `moduleResolution`"
sidebar_label: "01 · `module` and `moduleResolution`"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules — Theory*,
> *Modules — Reference*, *Modules — Choosing Compiler Options*), the **TSConfig
> reference** for `module` and `moduleResolution`, and the **5.8** and **5.9**
> release notes for `node18`, `node20` and `require(esm)`. Every option value,
> every implied default and every diagnostic quoted here was **read out of the
> compiler's own tables** — the option records and computed-option functions in
> the installed **TypeScript 5.9.3** JavaScript build, cross-checked against the
> string table compiled into the **7.0.2** native binary. **No sandbox, no
> console blocks.**

Two settings. Between them they decide whether your program starts.

They are also the two settings most likely to have been copied into your
`tsconfig.json` from a blog post in 2019, which is why this is a Master topic
rather than a reference table: **almost everybody has values here they did not
choose and cannot defend.**

## The one-sentence version

**`moduleResolution` decides which file an import refers to; `module` decides
what the emitted import looks like.** They answer different questions, they can
be set inconsistently, and the compiler will happily let you do it.

## Why this is hard, in one paragraph

TypeScript does not run your code. It emits JavaScript, and something else — Node,
a browser, a bundler, Bun — loads that JavaScript under *its* rules. So the
compiler has to **model** a module system it does not control. When the model is
right, module errors are caught at compile time. When the model is wrong, the
code type-checks perfectly and then fails at startup, and the error you get is
from the runtime, in a file you did not write, with no mention of TypeScript
anywhere. The handbook says this plainly:

> Notice that all of these questions depend on characteristics of the *host* — the
> system that ultimately consumes the output JavaScript (or raw TypeScript, as
> the case may be) to direct its module loading behavior, typically either a
> runtime (like Node.js) or bundler (like Webpack).

Everything in this topic is a consequence of that sentence.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The two questions](./01-the-two-questions.md) | The model — specifier, resolution, emit format, and why the specifier is *not* rewritten |
| 02 | [Every `module` value](./02-every-module-value.md) | All fourteen accepted values, what each emits, and what the handbook says to do with the legacy ones |
| 03 | [`preserve` and the Node family](./03-preserve-and-the-node-family.md) | The two rungs that matter today — per-statement and per-file — and choosing among `node16`…`nodenext` |
| 04 | [Every resolution strategy](./04-every-resolution-strategy.md) | `classic`, `node10`, `node16`/`nodenext`, `bundler` — what each can and cannot see |
| 05 | [The defaults you did not set](./05-the-defaults-you-did-not-set.md) | 🔴 The computed-option chain, read from source — including the one that silently gives you `classic` |
| 06 | [Format detection, file by file](./06-format-detection.md) | How `node16`–`nodenext` decides ESM or CJS per file, and how to ask the compiler why |
| 07 | [When the model is wrong](./07-when-the-model-is-wrong.md) | The failure catalogue: symptom → cause → fix, with the compiler's own message text |
| 08 | [Choosing, and migrating](./08-choosing-and-migrating.md) | The decision procedure per host, the doc-backed configs, and the order to change things in |

## Three sentences to keep

1. **`module` is about emit; `moduleResolution` is about lookup.** Conflating
   them is the single most common cause of confusion in this area.
2. **`node16`, `node18`, `node20` and `nodenext` are the only values that emit
   different formats for different files** — every other value forces the whole
   program into one format.
3. **A module specifier is emitted as written.** TypeScript rewrites your
   `import` *statement*; it almost never rewrites the *string*. Every runtime
   resolution failure lives in that gap.

## Where this connects

- **→ [02 · `import type` and `verbatimModuleSyntax`](../02-import-type-and-verbatim-module-syntax.md)**
  *(not written yet)* — once the format is decided, the next question is which of
  your imports survive to the output at all.
- **→ Phase 6 · 03 · Path aliases** *(not written yet)* — `paths` is the one
  feature that deliberately breaks the rule in sentence 3 above.
- **→ [Phase 7 · The module format](../../phase-7-server/01-tsconfig-for-a-node-service/02-the-module-format.md)**
  — the applied case, argued on a real Node 24 service. This topic owns the
  general rule; that page owns the concrete configuration and the `require(esm)`
  comparison.
- **← [Phase 0 · How TypeScript runs](../../phase-0-how-typescript-runs/README.md)**
  — the erasure model these settings operate inside.

---

← [Phase 6 index](../README.md) · Next → [01 · The two questions](./01-the-two-questions.md)
