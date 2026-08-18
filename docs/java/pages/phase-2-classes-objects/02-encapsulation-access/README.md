---
title: "Encapsulation and access modifiers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §6.6 (access control), §6.6.2
> (details on protected access), §8.4.8.3 (requirements in overriding), and
> the JDK 25 API documentation.

**Access modifiers are not politeness — they are the compiler enforcing which
code is allowed to depend on which. Every member you expose is an API you now
maintain forever; every member you hide is refactoring freedom you kept. The
four levels are learnable in a minute; the craft is that most codebases use
exactly two of them well (`private`, `public`) and waste the two in the
middle — `protected` misunderstood, package-private forgotten.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The four levels, precisely](01-the-four-levels.md)** | The access table, the two misread rows, `private` as class-level, top-level rules |
| 2 | **[Designing with access](02-designing-with-access.md)** | Behaviour vs getters, collection encapsulation, why `public` fields lock an API, records |
| 3 | **[Boundaries at scale](03-boundaries-at-scale.md)** | Access under inheritance, package-as-module design, JPMS `exports`, sealed types as the third wall |

## Why this is a Master topic

Access decisions are the highest-leverage lines in a codebase precisely
because they are one keyword long: they decide which refactors are local and
which ripple across teams. The "entity that can't change its representation",
the "internal class three other teams now import", and the "protected helper
the whole package secretly calls" are all one-word mistakes with multi-year
consequences.

## Phase gate contribution

The gate's order domain needs internals that stay internal: package-private
implementation types behind a public interface, and no setter that can break
an invariant — chunks 2 and 3 are that design skill.

---

← Prev: [Class anatomy and construction](../01-class-anatomy/README.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [Inheritance](../03-inheritance/README.md)
