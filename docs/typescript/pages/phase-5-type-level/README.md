---
title: "Phase 5 — Type-level programming"
sidebar_label: "Phase 5 · Type-level programming"
sidebar_position: 5
---

> Verified: 2026-08 against the **TypeScript handbook** (*Mapped Types*,
> *Conditional Types*, *Template Literal Types*, *Utility Types*, *Indexed Access
> Types*, *keyof*) and the release notes for anything with a version. Diagnostic
> text is read out of the **compiler's own message table** and confirmed against
> the installed **TypeScript 7.0.2** rather than recalled; each page says so.
> **No sandbox, no console blocks** — every claim here is documentation-validated,
> and a plausible-looking `tsc` transcript written from memory is not evidence.

**16 topics.** Types that take types as input. This is the phase where TypeScript
stops describing values and starts computing.

The useful fifth of it — mapped types, conditional types, and the built-in
utilities they are made of — is not optional knowledge: it is what every library
you use is written in, and what your own helper types will be. The rest is a
genuine skill with a strict discipline attached, and the discipline is the point:

> **A clever type that produces an unreadable error message is a net loss.**

That sentence is why topic 08 exists as a peer of the mechanisms rather than as
an afterthought, and why several pages here end by telling you *not* to write the
type.

The framing worth carrying in: [phase 3](../phase-3-generics/README.md) was about
writing code for a type you have not been told yet. [Phase 4](../phase-4-classes-declarations/README.md)
was about types you do not own. **This phase is about types you compute** — where
the input is a type and the output is another type, derived by rules you write.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [Mapped types](./01-mapped-types/README.md) *(4 chunks)* | <span className="db-tier t-master">Master</span> | `{ [K in keyof T]: … }`, adding and removing `?` and `readonly` with `+`/`-`, and building your own `Partial` |
| 02 | [Conditional types](./02-conditional-types/README.md) *(4 chunks)* | <span className="db-tier t-master">Master</span> | `T extends U ? X : Y`, the assignability question it actually asks, and nesting them readably |
| 03 | [The built-in utility types](./03-utility-types/README.md) *(5 chunks)* | <span className="db-tier t-master">Master</span> | Which are mapped and which are conditional, so you can write the missing one |
| 04 | [Key remapping — `as` in a mapped type](./04-key-remapping.md) | <span className="db-tier t-understand">Understand</span> | Renaming keys, prefixing, and filtering keys out by mapping to `never` |
| 05 | [Distributive conditional types](./05-distributive-conditionals.md) | <span className="db-tier t-understand">Understand</span> | Why a conditional over a union applies member by member, and how to stop it |
| 06 | [Extracting with `infer`](./06-infer/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | `ReturnType`, `Parameters`, `Awaited`, `InstanceType`, and writing your own extractor |
| 07 | [Template literal types](./07-template-literal-types.md) | <span className="db-tier t-understand">Understand</span> | Typed event names and route strings, and the case-changing intrinsics |
| 08 | Knowing when to stop | <span className="db-tier t-understand">Understand</span> | The readability test — if the error is worse than the bug, delete the type |
| 09 | Type-level performance | <span className="db-tier t-understand">Understand</span> | Instantiation depth, `TS2589`, and what makes a codebase's checker slow |
| 10 | Deriving one function's type from another | <span className="db-tier t-understand">Understand</span> | `Parameters<typeof f>` for wrappers, decorators and adapters |
| 11 | Recursive types | <span className="db-tier t-know">Know</span> | Walking a nested object at the type level, and the recursion limits you hit |
| 12 | `DeepPartial` / `DeepReadonly` | <span className="db-tier t-know">Know</span> | How they are built, and why they wreck error messages in big shapes |
| 13 | Tuple manipulation | <span className="db-tier t-know">Know</span> | Head/tail, length, variadic tuple types, and typing `bind`/`curry` |
| 14 | `NoInfer<T>` | <span className="db-tier t-know">Know</span> | Blocking a bad inference site so the caller gets the error where the mistake is |
| 15 | Union → intersection and other identities | <span className="db-tier t-know">Know</span> | The tricks worth recognising when you read library code |
| 16 | Higher-kinded types | <span className="db-tier t-when">When Needed</span> | What TypeScript cannot express, and the interface-map workaround libraries use |

## Phase gate

Move on when you can **write `Pick`, `Omit` and `ReturnType` from an empty
file**, and explain what error a caller gets when each is used wrongly.

The second half is the real gate. Anyone can copy a mapped type; the question
that separates understanding from memorisation is what the *caller* sees when
they get it wrong — because that is the only thing your type contributes to
somebody else's day.

## Where this connects

- **← [Phase 3 · `keyof`](../phase-3-generics/04-keyof/README.md)** and
  **[Indexed access types](../phase-3-generics/06-indexed-access-types.md)** —
  a mapped type is `keyof` plus indexed access in a loop. If either is shaky,
  fix that first; nothing here will make sense without them.
- **← [Phase 3 · `infer` in conditional types](../phase-3-generics/11-infer-in-conditional-types.md)**
  — introduced there for generics; topic 06 makes it the tool for extraction.
- **← [Phase 1 · `type` vs `interface`](../phase-1-type-vocabulary/07-type-vs-interface.md)**
  — everything in this phase is a `type` alias, because interfaces cannot compute.
- **→ Phase 6 (Modules, declarations and the build)** — computed types are what
  makes a `.d.ts` enormous and a build slow; topic 09 here, the build settings
  there.

---

← [Phase 4 — Classes and declarations](../phase-4-classes-declarations/README.md) · Next → [01 · Mapped types](./01-mapped-types/README.md)
