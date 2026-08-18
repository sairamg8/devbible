---
title: "The hierarchy, checked vs unchecked"
sidebar_label: "01 · The hierarchy, checked vs unchecked"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §11 (Exceptions), the JDK 25 Javadoc
> for `Throwable`, `Error`, `Exception`, `RuntimeException`,
> `OutOfMemoryError`, `StackOverflowError` and `NoClassDefFoundError`, and the
> `Throwable(String, Throwable, boolean, boolean)` protected constructor doc.

**Java's exception system is one tree and one compiler rule. The tree:
`Throwable` splits into `Error` ("the JVM is in trouble — don't catch") and
`Exception` ("the program is in trouble"), and `Exception` contains the
`RuntimeException` subtree. The compiler rule: anything under `Exception` but
outside `RuntimeException` is *checked* — a method must catch it or declare
it. Every design argument about Java error handling — and every interview
question about it — is really about whether that compiler rule helps or
hurts, and the modern answer is more nuanced than either camp admits.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The tree, and what each branch means](01-the-tree.md)** | `Throwable` → `Error` / `Exception` → `RuntimeException` with the operational meaning of each layer; the big three `Error`s (`OutOfMemoryError`, `StackOverflowError`, `NoClassDefFoundError`) and why catching them lies to you |
| 2 | **[Checked exceptions — the mechanics and the debate](02-checked-mechanics-debate.md)** | Catch-or-declare precisely, `throws` clauses and overriding, where checked exceptions still earn their keep, why Kotlin and C# dropped them, Bloch's rules stated fairly |
| 3 | **[The modern lean, and what exceptions cost](03-modern-lean-and-cost.md)** | Unchecked-in-application-code with translation at boundaries, sneaky throws, `fillInStackTrace` and the real cost model, stackless exceptions via the protected constructor |

## Why this is a Master topic

- **Every other page in this phase stands on it** — try-with-resources,
  translation at layer boundaries, exceptions-vs-`Optional` all assume you
  can say what checked means and defend a choice between the subtrees.
- **It is the API-design decision of failure handling** — every method you
  write that can fail forces "checked, unchecked, `Optional`, or crash?",
  and the wrong pick propagates: a checked exception in a core interface
  contaminates every caller and every lambda that touches it
  ([the lambda fight](../../phase-4-lambdas-streams/01-lambdas-functional-interfaces/03-composition-checked-exceptions.md)
  is this decision echoing back).
- **The interview classic** — "checked vs unchecked, and when would you use
  each?" is asked at every level, and the strong answer needs the debate's
  actual content, not a slogan.
- **The `Error` branch is operationally live** — production incidents
  regularly hinge on someone having caught `OutOfMemoryError` and kept
  serving corrupt state.

## Where this connects

- **[NPE and designing nulls out](../../phase-1-language-core/13-null-and-npe/README.md)** —
  `NullPointerException` is the unchecked exception you meet first.
- **[`Optional` used correctly](../../phase-4-lambdas-streams/07-optional/README.md)** —
  the return-type alternative for *expected* absence; topic 07 in this phase
  draws the full line.
- **Topic 04 · Custom exceptions and layer translation** — applies this
  page's default (unchecked in application code) to real service layers.

---

← Index: [Phase 5 — Exceptions and failure design](../README.md) · Next → [The tree, and what each branch means](01-the-tree.md)
