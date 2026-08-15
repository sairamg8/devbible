---
title: "Module augmentation — `declare module`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging* —
> module augmentation, global augmentation, merging interfaces) with its examples
> quoted verbatim, and against the **installed `@types/express-serve-static-core`
> 5.1.3** in this repository's own `node_modules`, read rather than recalled.
> **No console block** — no sandbox run covers this phase.

This is the phase's Master topic, and the reason is practical rather than
theoretical: **`declare module` is the only sanctioned way to change a type you
do not own.** Every `req.user`, every plugin that adds a method to a client,
every `process.env.DATABASE_URL` that autocompletes, is this mechanism.

It is also the single most common source of *"I wrote the types and nothing
happened"* — because an augmentation that never loads produces **no error at
all**, just the original type. Three chunks, and the third is the one you will
come back to.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What merging and augmentation are](./01-what-merging-and-augmentation-are.md) | Why two declarations of one interface combine, the exact merge rules, and the handbook's `Observable` example |
| 02 | [Augmenting a package](./02-augmenting-a-package.md) | The two forms, `req.user` worked end to end against the real Express types, and the two things you may not do |
| 03 | [Why it did not load](./03-why-it-did-not-load.md) | The failure catalogue — the file, the module-ness, the specifier — plus Gotchas and Interview questions |

## The one-sentence version

**An interface is open**: declare it twice and the declarations merge, so
`declare module 'pkg' { interface X { … } }` reopens somebody else's `X` and adds
to it — provided the file doing it is a module, and provided the compiler
actually includes that file.

## The mental model

A `class` or a `type` alias is a **closed** statement: say it twice and you get
`TS2300: Duplicate identifier`. An `interface` and a `namespace` are **open**:
say them twice and TypeScript unions the members into one declaration.

Augmentation is not a special feature bolted on — it is that openness, aimed at a
name that lives in another file. Once you see it that way, the rules stop needing
memorising: you can add to something open, you cannot create something new, and
the file has to be one the compiler reads.

## Where this connects

- **← [Phase 1 · `type` vs `interface`](../../phase-1-type-vocabulary/07-type-vs-interface.md)**
  — merging is the capability that genuinely separates the two, and this is where
  that claim gets cashed.
- **→ [05 · Interface declaration merging](../05-interface-declaration-merging/README.md)** — the same
  mechanism inside your own codebase, including the accidents it causes.
- **→ 06 · Global augmentation** *(not written yet)* — `declare global` on its
  own terms, and typing `globalThis`.
- **→ Phase 6 (Modules, declarations and the build)** — `include`, `types` and
  `typeRoots`, which is *why* chunk 03's failures happen.
- **→ Phase 7 (TypeScript on the server)** — `req.user` in a real middleware
  chain.

---

← [Phase 4 index](../README.md) · Next → [01 · What merging and augmentation are](./01-what-merging-and-augmentation-are.md)
