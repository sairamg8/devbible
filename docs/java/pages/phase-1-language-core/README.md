---
title: "Phase 1 — Language core"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the Java Language Specification, the JDK 25
> API documentation, and the JEP that finalized each feature). No sandbox:
> pages carry Java code, never fabricated program output.

The syntax is the easy half. The Master rows here are the ones that produce
production bugs when half-known: boxing, `==` on strings, floating point for
money, silent integer overflow. This phase is written against the reader who
"knows Java" from another language and keeps getting cut by the 10% that
differs.

🚧 **0 of 16 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Primitives vs reference types** *(not written yet)* | <span className="db-tier t-master">Master</span> | 8 primitives, stack vs heap, why `long` and `Long` differ when unset |
| 02 | **Autoboxing and the integer cache** *(not written yet)* | <span className="db-tier t-master">Master</span> | `127 == 127` true, `128 == 128` false — the real-IDs bug |
| 03 | **`var`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Local inference: where it helps, where it hides the type |
| 04 | **Operators, division and overflow** *(not written yet)* | <span className="db-tier t-master">Master</span> | Silent wraparound, `%` with negatives, `Math.addExact` |
| 05 | **Floating point and `BigDecimal`** *(not written yet)* | <span className="db-tier t-master">Master</span> | `0.1 + 0.2 != 0.3` here too; money = `BigDecimal`, always |
| 06 | **Strings** *(not written yet)* | <span className="db-tier t-master">Master</span> | Immutability, the pool, `==` vs `equals`, `StringBuilder` in loops |
| 07 | **Text blocks** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | SQL and JSON without escape soup |
| 08 | **Control flow and `switch` expressions** *(not written yet)* | <span className="db-tier t-master">Master</span> | Arrows, `yield`, exhaustiveness over enums |
| 09 | **Arrays** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Fixed size, covariance and `ArrayStoreException` |
| 10 | **Methods: overloading, varargs, pass-by-value** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Which overload runs on `null`; Java copies references |
| 11 | **`static`** *(not written yet)* | <span className="db-tier t-master">Master</span> | Class-level state — and why mutable static state ruins tests |
| 12 | **`final`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | What it prevents on variables, methods, classes — not deep immutability |
| 13 | **`null` and `NullPointerException`** *(not written yet)* | <span className="db-tier t-master">Master</span> | Helpful NPEs, boundary defence, `Objects.requireNonNull` |
| 14 | **Casting and `instanceof` patterns** *(not written yet)* | <span className="db-tier t-master">Master</span> | `if (o instanceof User u)` — the checked cast that ended a decade of boilerplate |
| 15 | **Naming and idiom** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The conventions the ecosystem actually enforces |
| 16 | **Precedence and evaluation order** *(not written yet)* | <span className="db-tier t-know">Know</span> | Read it, don't rely on it; parenthesize |

## Phase gate

Move on when you can say, without running it, what
`Integer.valueOf(1000) == Integer.valueOf(1000)`, `"a" + "b" == "ab"` and
`0.1 + 0.2 == 0.3` each evaluate to — and why the fix for each is different.

## Where this connects

- **[Phase 0 — The platform and the JVM](../phase-0-platform-jvm/README.md)**
  explains the machine these semantics run on.
- **Phase 2 — Classes and objects** builds the object model on top of these
  value semantics; `equals`/`hashCode` assumes topic 06's `==` story.
- **Phase 3 — Generics and collections** picks up boxing (topic 02) at
  collection scale, where `List<Integer>` makes it a performance story.
