---
title: "`esModuleInterop` and default imports"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules*, *Modules →
> Reference*) and the **TSConfig reference**, with every default, every option
> difference and both helper bodies read out of the compiler's own **option
> records, computed-option table, helper table and checker source** — installed
> **TypeScript 5.9.3**. **No sandbox, no console blocks.**

## The one-sentence version

> **`import express from 'express'` asks for `module.exports.default`, which does
> not exist** — and the two flags in this topic are two different ways of opting
> into the convention that a CommonJS module *is* its own default.

## Three sentences worth keeping

1. **The two flags differ by exactly one line in their option records.**
   `allowSyntheticDefaultImports` has `affectsSemanticDiagnostics`;
   `esModuleInterop` also has `affectsEmit`. So the first is a *permission* — a
   promise that something else does the interop — and the second is *behaviour*.
   Which is why the first can produce a green build and a runtime `undefined`.
2. **The defaults are computed, not constant.** `esModuleInterop` is on by
   default under `module` = `node16`/`node18`/`node20`/`nodenext`/`preserve`, and
   `allowSyntheticDefaultImports` is on under `moduleResolution: bundler`. Many
   "should we enable this?" discussions are about a project that already has it.
3. **The flag forbids as well as allows.** Turning on `esModuleInterop` makes
   `import * as x from 'cjs'; x()` an error, because a namespace import becomes a
   real module namespace object — which is correct, and is why migrations feel
   contradictory.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What a default import means](./01-what-a-default-import-means.md) | The mismatch, `__esModule`, and why `import x = require()` is the accurate spelling nobody uses |
| 02 | [The two flags](./02-the-two-flags.md) | `affectsEmit` as the whole difference, and the computed defaults |
| 03 | [The emit](./03-the-emit.md) | `__importDefault` and `__importStar` verbatim, and the copy that changes identity |
| 04 | [The errors](./04-the-errors.md) | Six diagnostics sorted by what each will *accept* as a fix |
| 05 | [Choosing and migrating](./05-choosing-and-migrating.md) | Who emits your JavaScript, and what breaks when you turn it on |

## 🔴 The four compiler behaviours this topic settles

1. **`esModuleInterop`'s computed default is `true` for the whole Node family and
   `preserve`** — the option record's static `false` is not the operative answer
   (chunk 02).
2. **`allowSyntheticDefaultImports` computes `true` from `esModuleInterop` OR
   `module: system` OR `moduleResolution: bundler`** — the last being the modern
   configuration where interop appears to work with no flag set (chunk 02).
3. **`TS1259` names a different flag depending on your `module` setting** —
   `moduleKind >= ES2015 ? "allowSyntheticDefaultImports" : "esModuleInterop"` —
   which is why the ecosystem's advice on this is permanently contradictory
   (chunks 02 and 04).
4. **`__importStar` builds a new object and copies own keys** unless the module
   carries `__esModule`, so a CommonJS namespace import is **not** the package's
   `module.exports` and fails an identity comparison against it (chunk 03).

## The decision, in one place

```
who emits the JavaScript you actually run?
  ├─ tsc              → esModuleInterop        (you want the helpers)
  ├─ a bundler        → allowSyntheticDefaultImports, or nothing if
  │                     moduleResolution: bundler already gives it to you
  └─ module is node16/node18/node20/nodenext/preserve
                      → already on. Do not set it, and do not set it false.
```

## Where this connects

- **← [Topic 08 · Typing an untyped dependency](../08-typing-an-untyped-dependency/README.md)**
  — a shim declares `export =` because that is what the runtime does; whether a
  consumer may write `import x from` against it is *this* topic's flag question,
  and declaring a `default` to satisfy them is the worst available outcome.
- **← [Topic 07 · The export forms](../07-authoring-d-ts-files/06-the-export-forms.md)**
  — `export =` versus `export default`, and the `TS2497` that connects them.
- **→ [Phase 7 · `tsconfig.json` for a Node service](../../phase-7-server/01-tsconfig-for-a-node-service/README.md)**
  — the applied case on a real Node 24 service. **This topic owns the general
  rule; that page owns the worked configuration.**
- **→ 02 · `import type` / `export type` and `verbatimModuleSyntax`** *(not
  written yet)* — the adjacent emit flag, commonly set alongside this one and
  answering a different question.
- **→ 11 · Publishing a typed package** *(not written yet)* — testing your
  package as a consumer would compile it, with interop both on and off.

---

← [Phase 6 index](../README.md) · Start → [01 · What a default import means](./01-what-a-default-import-means.md)
