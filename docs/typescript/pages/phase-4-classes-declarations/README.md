---
title: "Phase 4 — Classes, objects and declaration merging"
sidebar_label: "Phase 4 · Classes and declarations"
sidebar_position: 4
---

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging*,
> *Classes*, *Modules*) and the release notes for anything with a version.
> Error codes and their exact `{0}`-templated message text are read out of the
> **compiler's own diagnostic table** rather than recalled — ⚠️ the install
> inspected is TypeScript **6.0.3**, not the 7.0.2 this corpus targets, and each
> page that quotes it says so. **No sandbox, no console blocks**: every claim
> here is documentation-validated, and a plausible-looking `tsc` transcript
> written from memory is not evidence.

**14 topics.** TypeScript's class syntax is mostly JavaScript's, so this phase is
short on the class and long on the two things that are genuinely TypeScript:
**declaration merging** and **module augmentation** — the mechanism behind every
`req.user` you have ever seen typed.

The framing worth carrying in: [Phase 3](../phase-3-generics/README.md) was about
writing code for a type you have not been told yet. This phase is about **types
you do not own** — somebody else's library, the global scope, a shape assembled
from several files — and the one mechanism TypeScript gives you for extending
them without forking them.

It is also where the compile-time / runtime line is sharpest. `private` is a
suggestion, `#private` is not. Parameter properties emit code, so Node's
strip-only mode rejects them. Getting this line wrong is how a `private` field
ends up in a JSON payload.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [Module augmentation — `declare module`](./01-module-augmentation/README.md) *(3 chunks)* | <span className="db-tier t-master">Master</span> | Adding properties to somebody else's types; how `req.user`, custom `globalThis` keys and library plugins are typed |
| 02 | [Access modifiers](./02-access-modifiers/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | `public`/`private`/`protected` are **compile-time only**; `#private` is real at runtime |
| 03 | [Parameter properties](./03-parameter-properties.md) | <span className="db-tier t-understand">Understand</span> | `constructor(private readonly repo: Repo)`, and the fact that they **emit code** |
| 04 | [`implements` vs `extends`](./04-implements-vs-extends.md) | <span className="db-tier t-understand">Understand</span> | A contract check that adds no inference, versus real inheritance |
| 05 | [Interface declaration merging](./05-interface-declaration-merging/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | Two declarations of one interface combine — the feature `type` deliberately lacks |
| 06 | [Global augmentation](./06-global-augmentation.md) | <span className="db-tier t-understand">Understand</span> | `declare global`, typing `globalThis`, and why it only works inside a module |
| 07 | [Branded / nominal types](./07-branded-nominal-types.md) | <span className="db-tier t-understand">Understand</span> | Stopping a `PostId` being passed where a `UserId` belongs |
| 08 | [`readonly` members and definite assignment `!:`](./08-readonly-and-definite-assignment.md) | <span className="db-tier t-understand">Understand</span> | The two ways to promise the compiler a field will exist, and what each guarantees |
| 09 | Typing getters and setters | <span className="db-tier t-know">Know</span> | Divergent getter/setter types, and validation on write |
| 10 | `this` types and polymorphic `this` | <span className="db-tier t-know">Know</span> | Fluent builders that keep the subclass type through a chain |
| 11 | Abstract classes and abstract construct signatures | <span className="db-tier t-know">Know</span> | Typing "a class, not an instance", and `new (…args) => T` |
| 12 | Static members, static blocks and the static side | <span className="db-tier t-know">Know</span> | Why the instance type and the constructor type are two different types |
| 13 | Decorators (stage 3) | <span className="db-tier t-know">Know</span> | The current standard form, and the older `experimentalDecorators` you still meet |
| 14 | Mixins | <span className="db-tier t-when">When Needed</span> | The constructor-returning-class pattern, and its type cost |

*(Pages are linked from this table as they are written.)*

## Phase gate

Move on when you can **add a typed property to `Express.Request` from scratch**,
and explain why it must live in a file the compiler actually includes.

That second half is the part that catches people. An augmentation that is never
loaded is not a compile error — it is simply absent, and the symptom is
`Property 'user' does not exist on type 'Request'` in a file that looks correct.

## Where this connects

- **← [Phase 1 · `type` vs `interface`](../phase-1-type-vocabulary/07-type-vs-interface.md)**
  — merging is the one capability that genuinely separates them, and topic 05 is
  where that claim gets paid off.
- **← [Phase 3 · Generic classes](../phase-3-generics/09-generic-classes.md)** —
  the static-side restriction met there is topic 12's whole subject, and
  `TS2442`'s declaration-site privacy is what makes branding work in topic 07.
- **→ Phase 6 (Modules, declarations and the build)** — *why* a `.d.ts` is or is
  not picked up: `include`, `types`, `typeRoots`. This phase shows you the
  augmentation; that one explains why it did not load.
- **→ Phase 7 (TypeScript on the server)** — `req.user` in an Express middleware
  chain is topic 01 applied, and it is the single most-searched TypeScript
  question in a Node codebase.

---

← [Phase 3 — Generics](../phase-3-generics/README.md) · Next → [01 · Module augmentation](./01-module-augmentation/README.md)
