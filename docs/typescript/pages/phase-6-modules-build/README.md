---
title: "Phase 6 — Modules, declarations and the build"
sidebar_label: "Phase 6 · Modules, declarations and the build"
sidebar_position: 6
---

> Verified: 2026-08 against the **TypeScript handbook** (*Modules*, *Modules —
> Reference*, *Modules — Theory*, *Modules — Choosing Compiler Options*), the
> **TSConfig reference** for every flag named, and the **release notes** for
> anything with a version on it. Option defaults and the values each flag accepts
> are read out of the **compiler's own option records** in the installed
> **TypeScript 5.9.3** table and cross-checked against the **7.0.2** native
> binary, rather than recalled. **No sandbox, no console blocks** — a
> plausible-looking `tsc` transcript written from memory is not evidence.

**16 topics.** This is where TypeScript stops being a type system and starts
being a build tool.

Every other phase in this corpus is about what a type *means*. This one is about
something stranger: TypeScript does not run your code, so it has to **model** the
module system your code will eventually run under — and if the model and the
runtime disagree, the runtime wins. That single sentence explains almost every
"it compiles but crashes" report you will ever be handed.

The phase divides cleanly in two, and the two halves are written by different
lanes:

- **Topics 01–06 — the module system, and how the compiler sees files.** What
  `module` and `moduleResolution` actually do, why a type-only import must be
  erasable, and why `@/lib` resolves in your editor and throws in production.
- **Topics 07–16 — declarations, packaging and the build.** Authoring `.d.ts`,
  typing something untyped, shipping a package other people can consume, and the
  flags that make a large build finish.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [`module` and `moduleResolution`](./01-module-and-moduleresolution/README.md) *(11 chunks)* | <span className="db-tier t-master">Master</span> | `node16`/`nodenext` vs `bundler` vs the legacy `node10`; picking the one that matches what actually loads your code |
| 02 | [`import type` / `export type` and `verbatimModuleSyntax`](./02-import-type-and-verbatim-module-syntax/README.md) *(7 chunks)* | <span className="db-tier t-master">Master</span> | Why a type-only import must be erasable, and the runtime import that vanished and broke a side effect |
| 03 | [Path aliases — `paths`](./03-path-aliases/README.md) *(6 chunks)* | <span className="db-tier t-master">Master</span> | `tsc` resolves `@/lib`, **Node does not** — so something has to resolve it again at runtime |
| 04 | [`lib`, `target` and the ambient environment](./04-lib-target-ambient/README.md) *(9 chunks)* | <span className="db-tier t-understand">Understand</span> | DOM vs Node globals, `@types/node`, and why `structuredClone` is missing from your types but present at runtime |
| 05 | `isolatedModules` | <span className="db-tier t-understand">Understand</span> | The constraint every single-file transpiler needs, and the patterns it bans |
| 06 | File extensions — `.ts`/`.mts`/`.cts`/`.d.ts` | <span className="db-tier t-understand">Understand</span> | `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, and writing the extension the *runtime* wants |
| 07 | [Authoring `.d.ts` files](./07-authoring-d-ts-files/README.md) *(13 chunks)* | <span className="db-tier t-understand">Understand</span> | Declaring a module's public surface by hand, and when you should |
| 08 | [Typing an untyped dependency](./08-typing-an-untyped-dependency/README.md) *(6 chunks)* | <span className="db-tier t-understand">Understand</span> | `declare module 'legacy-lib'`, the shim that unblocks you today, and the upstream fix |
| 09 | [`esModuleInterop` and default imports](./09-esmoduleinterop-and-default-imports/README.md) *(5 chunks)* | <span className="db-tier t-understand">Understand</span> | What `import express from 'express'` means for a CommonJS package |
| 10 | [`skipLibCheck`](./10-skiplibcheck/README.md) *(8 chunks)* | <span className="db-tier t-understand">Understand</span> | Nearly everyone sets it; know exactly which errors you are agreeing not to see |
| 11 | Publishing a typed package | <span className="db-tier t-understand">Understand</span> | `exports`, `types`/`typesVersions`, dual ESM/CJS, and validating the result |
| 12 | Sharing types across a monorepo | <span className="db-tier t-understand">Understand</span> | Source imports vs built `.d.ts`, and the editor-vs-build divergence each causes |
| 13 | Project references and `tsc -b` | <span className="db-tier t-know">Know</span> | `composite`, build order, and when a monorepo actually needs them |
| 14 | Incremental builds | <span className="db-tier t-know">Know</span> | `.tsbuildinfo`, what invalidates it, and caching it in CI |
| 15 | `isolatedDeclarations` | <span className="db-tier t-know">Know</span> | Declaration emit without full inference, the annotation cost, and the speed it buys |
| 16 | Typing non-code imports | <span className="db-tier t-know">Know</span> | CSS modules, JSON, images, and `?raw`-style bundler suffixes |

## The one idea this phase is built on

TypeScript has **two independent questions** to answer about every `import` you
write, and confusing them is the source of most of the confusion in this area:

1. **Where is the file?** — that is `moduleResolution`. It decides which file on
   disk a specifier like `'./util'` or `'lodash'` refers to, and therefore which
   types you get.
2. **What does the output look like?** — that is `module`. It decides whether the
   emitted JavaScript says `import` or `require`, and therefore what the runtime
   sees.

They are different questions with different answers, and TypeScript lets you get
them **inconsistently wrong** — which is exactly how you end up with code that
type-checks perfectly and then fails to start.

## Phase gate

Move on when you can **explain why an import that type-checks can still throw
`ERR_MODULE_NOT_FOUND` at runtime**, and name the three places that mismatch can
come from.

The three are worth stating up front so you know what you are reading for: a
**resolution mode** that models a different algorithm than the runtime uses, a
**specifier** the runtime cannot resolve even though the compiler could (this is
`paths`), and an **emit format** that does not match how the file is loaded.

## Where this connects

- **← [Phase 0 · How TypeScript runs](../phase-0-how-typescript-runs/README.md)**
  — the erasure model. Everything in this phase is a consequence of the compiler
  emitting JavaScript that has to survive on its own.
- **← [Phase 4 · Module augmentation](../phase-4-classes-declarations/01-module-augmentation/README.md)**
  — augmenting somebody else's module only works if the compiler resolves it to
  the file you think it does. This phase is how it decides.
- **→ [Phase 7 · `tsconfig.json` for a Node service](../phase-7-server/01-tsconfig-for-a-node-service/README.md)**
  — the applied case, argued on a real server. This phase owns the general rule;
  that page owns the concrete Node 24 configuration.
- **→ Node.js · Modules** — TypeScript *models* module resolution; Node
  *performs* it. When the two disagree, Node wins.
- **Deliberately not here:** how ESM and CJS behave at runtime, the full
  resolution algorithm, and `package.json` `exports` semantics beyond what
  TypeScript reads from them — the Node syllabus owns those.

---

← [Phase 5 — Type-level programming](../phase-5-type-level/README.md) · Next → [01 · `module` and `moduleResolution`](./01-module-and-moduleresolution/README.md)
