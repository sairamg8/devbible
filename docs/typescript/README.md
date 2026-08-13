---
title: "TypeScript — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against **TypeScript 7.0.2** (`npm view typescript version`) on
> **Node 24.19.0** Active LTS. Every version fact in the table below came from a
> command run on this machine, not from memory.

The complete topic inventory for TypeScript, tiered for **mastery in fullstack
application development**. **13 phases, 187 topics**, split into 4 parts to stay
under the 300-line file cap.

The bar is **no knowledge gaps**: every TypeScript construct you would meet
building a full commerce application — typed handlers, typed query results,
typed components, validated boundaries, a strict compiler and a fast build — has
a row here. Nothing is left as "you'll pick that up later".

Architectural role: **the type layer over JavaScript** — a checker that runs at
build time and leaves nothing behind at runtime. That single fact ("types are
erased") is what most of this syllabus is downstream of: it decides why
validation still exists, why `as` is dangerous, why `enum` behaves unlike every
other type construct, and why the compiler is a separate tool from whatever
actually runs your code.

## Scope — what this syllabus owns

**The type system and everything that serves it.** JavaScript semantics belong
to the JavaScript syllabus; TypeScript never re-teaches closures, the event loop
or `this`. The rule is: *if removing the types would remove the topic, it is
TypeScript's.*

| Concern | Home |
|---|---|
| Closures, `this`, coercion, the event loop, iterators | **JavaScript** |
| Type system, narrowing, generics, `.d.ts`, `tsconfig`, the compiler | **TypeScript** |
| How a React hook or an Express middleware *works* | **React** / **Express** |
| How to *type* a hook, a handler, a `pg` row, a request | **TypeScript** (Part 3) |
| Runtime behaviour of ESM/CJS resolution in Node | **Node** Phase 1 |
| How `module`/`moduleResolution` model that behaviour | **TypeScript** Phase 6 |

**Open question for approval (Part 3):** Phases 7–9 type Express handlers, React
components and DB rows. That is a deliberate overlap with three syllabi — the
same shape as the PostgreSQL/Node boundary exception. The proposed split is
*"they own the mechanism, TypeScript owns the typing of it"*, and Part 3 links
out rather than re-explaining. Say the word and Part 3 shrinks to a single
phase, with the typing rows pushed into React and Express instead.

## Version facts

All measured on this machine, 2026-08-13:

| | |
|---|---|
| Target compiler | **TypeScript 7.0.2** — the `latest` dist-tag |
| What TS 7 is | The **native (Go) compiler**. `typescript@7.0.2` ships platform binaries as optional deps (`@typescript/typescript-linux-x64`, …); the package is 3.6 MB installed |
| The JS compiler API is **gone** | `require('typescript')` in 7.0.2 exports exactly **two** keys — `version` and `versionMajorMinor`. `ts.createProgram` is `undefined`. Anything built on the old `ts.*` API (ts-morph, custom transformers, type-aware lint plugins) must be checked against this before you upgrade |
| Previous line | **`typescript@5.9.3`** is the last 5.x; **6.0** is the JS-based deprecation bridge (`beta` tag), 7.0 is the rewrite |
| Runtime | **Node 24.19.0**, the Active LTS — the same target as the Node syllabus |
| Running `.ts` in Node 24 | **Works with no flag.** `node demo.ts` executed and printed output |
| …but strip-only mode is real | A file containing `enum E { A }` fails with `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode`. This is why `erasableSyntaxOnly` exists, and it is Phase 0 material, not a footnote |
| Flags confirmed present in 7.0.2 | `--erasableSyntaxOnly`, `--verbatimModuleSyntax`, `--isolatedDeclarations`, `--noUncheckedIndexedAccess`, `--exactOptionalPropertyTypes` |

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[The type system](syllabus/01-type-system.md)** | How TS runs, the vocabulary, narrowing, generics | 0–3 | 57 |
| 2 | **[Types at scale](syllabus/02-types-at-scale.md)** | Classes and augmentation, type-level programming, modules and build | 4–6 | 46 |
| 3 | **[TypeScript in the stack](syllabus/03-in-the-stack.md)** | Node/Express, React, the untyped boundary | 7–9 | 44 |
| 4 | **[Rigour and tooling](syllabus/04-rigour-and-tooling.md)** | Strictness, migration, tooling and performance | 10–12 | 40 |

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="typescript" compact />

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 54 | 29 % |
| <span className="db-tier t-understand">Understand</span> | 95 | 51 % |
| <span className="db-tier t-know">Know</span> | 32 | 17 % |
| <span className="db-tier t-when">When Needed</span> | 6 | 3 % |

Master sits inside the brief's 25–30 % band. It is front-loaded on purpose:
27 of the 54 are in Part 1, because the type vocabulary and narrowing are what
you use without documentation open, every hour, in every file.

## Prerequisites

| | |
|---|---|
| Required | **JavaScript** Phases 1–4 (values, coercion, functions, objects). Typing a language you cannot read is a waste of both |
| Required | **Node** Phase 1 (modules) before TypeScript Phase 6 — `moduleResolution` models runtime resolution, so learn the runtime first |
| Pairs with | **React** and **Express** for Part 3. Part 3 assumes you know what a hook and a middleware are |
| Not required | Any Node phase past 1 for Parts 1–2. The type system is host-agnostic |

## Example policy

Every page runs on **Node 24.19.0** with **TypeScript 7.0.2**. A page shows:

| | |
|---|---|
| The code | Complete and runnable — no `...` elisions |
| The check result | Real `tsc --noEmit` output, including the **error code** (`error TS2322: …`) |
| The runtime result | What actually happens when the file runs, when that differs from what the types promised |
| The failure | The exact compiler message, not a paraphrase of it |

Where a type is inferred rather than written, show the inferred type as the
editor reports it. Type-level topics without a runtime half say so explicitly.

## Explanations

The explanations will live in **`pages/`** — one page per topic (or tight group),
with code, gotchas and interview questions. **Nothing is written yet**; this
syllabus is the proposal.

## Tier legend

| Badge | Bar to clear |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; looking up signatures is fine |
| <span className="db-tier t-know">Know</span> | Know what, why and when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

---

Start → [Part 1 — The type system](syllabus/01-type-system.md)
