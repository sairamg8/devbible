---
title: "Access modifiers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes → Member
> Visibility*) and **MDN** (*Private properties*), with the load-bearing
> sentences quoted verbatim in the chunks. Error codes come from the
> **compiler's own diagnostic table** (⚠️ install inspected: TypeScript
> **6.0.3**). **No console block** — no sandbox run covers this phase.

There are **two privacy systems** in a TypeScript class, and they are not
variations on a theme. One is a type annotation that disappears at compile time;
the other is JavaScript syntax the engine enforces. Nearly every surprise in this
topic comes from treating the first as if it were the second — and the worst
version of that mistake puts a password hash in an API response.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Soft private and hard private](./01-soft-private-and-hard-private.md) | What `private` actually guarantees (less than you think), what `#` guarantees, and the serialisation difference that reaches production |
| 02 | [Visibility rules and choosing](./02-visibility-rules-and-choosing.md) | Cross-instance and cross-hierarchy access, how `#` brands a class in both worlds, and which to reach for |

## The one-sentence version

**`private` is a comment the compiler checks; `#` is a fact the engine
enforces.**

## Where this connects

- **← [01 · Module augmentation](../01-module-augmentation/README.md)** — the
  same compile-time/runtime split, in the other direction: `declare module`
  describes without emitting, and here `private` annotates without enforcing.
- **← [Phase 3 · Generic classes](../../phase-3-generics/09-generic-classes.md)**
  — `TS2442`, where a private member makes class comparison nominal rather than
  structural. Chunk 02 is where that becomes a tool.
- **→ [03 · Parameter properties](../03-parameter-properties.md)** —
  `constructor(private readonly repo: Repo)`, which works with `private` and has
  no `#` equivalent.
- **→ [07 · Branded / nominal types](../07-branded-nominal-types.md)** — the deliberate use of
  declaration-site privacy.

---

← [Phase 4 index](../README.md) · Next → [01 · Soft private and hard private](./01-soft-private-and-hard-private.md)
