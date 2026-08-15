---
title: "Interface declaration merging"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging* —
> *Basic Concepts*, *Merging Namespaces*, *Merging Namespaces with Classes,
> Functions, and Enums*, *Disallowed Merges*), with the declaration table and all
> four examples quoted verbatim in the chunks. Error codes come from the
> **compiler's own diagnostic table** (⚠️ install inspected: TypeScript
> **6.0.3**). **No console block** — no sandbox run covers this phase.

[Topic 01](../01-module-augmentation/README.md) used merging to reach into
somebody else's types, and covered the merge rules in full. **This topic is the
same mechanism inside your own codebase**, where it is mostly a liability — and
the one genuinely useful thing it does that augmentation does not.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What merges with what](./01-what-merges-with-what.md) | The Namespace/Type/Value declaration table that explains every merge and every disallowed one, and the namespace merges worth recognising |
| 02 | [The accidents](./02-the-accidents.md) | Why a duplicated interface combines silently, the diagnostic that gives it away, how a dependency can merge into your globals, and when merging is actually the right tool |

## The one-sentence version

**Two declarations can coexist when they do not collide in the same slot** —
namespace, type, or value. An `interface` occupies only the type slot and is
*open*, so a second one merges instead of erroring; a `type` alias is closed, so
the same mistake is `TS2300`.

## Where this connects

- **← [01 · Module augmentation](../01-module-augmentation/README.md)** — the
  merge *rules* live there in full (unique-or-identical members, function members
  becoming overloads, later declarations first). This topic does not restate
  them.
- **← [Phase 1 · `type` vs `interface`](../../phase-1-type-vocabulary/07-type-vs-interface.md)**
  — the decision this topic gives a practical argument for.
- **→ [06 · Global augmentation](../06-global-augmentation.md)** — `declare global` on its
  own terms, which is where the global-scope hazard in chunk 02 gets its remedy.

---

← [Phase 4 index](../README.md) · Next → [01 · What merges with what](./01-what-merges-with-what.md)
