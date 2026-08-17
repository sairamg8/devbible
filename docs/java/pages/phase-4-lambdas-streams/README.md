---
title: "Phase 4 — Lambdas, streams and Optional"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the JDK 25 API documentation, the JEP that
> finalized each feature). No sandbox: pages carry Java code, never fabricated
> program output.

Functional Java is how collection-shaped work reads since Java 8. The skill is
knowing the collectors — and knowing when a plain loop is clearer. The
Master rows are the ones that ship bugs: lazy pipelines that never ran,
`toMap` meeting duplicate keys, `orElse` doing work you thought was deferred.

🚧 **0 of 13 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Lambdas and functional interfaces** *(not written yet)* | <span className="db-tier t-master">Master</span> | `Function`, `Supplier`, `Consumer`, `Predicate` — the API vocabulary |
| 02 | **Method references** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `User::getEmail` — when they read better, when they don't |
| 03 | **The stream pipeline** *(not written yet)* | <span className="db-tier t-master">Master</span> | Source → lazy intermediates → terminal; nothing runs early |
| 04 | **Core operations** *(not written yet)* | <span className="db-tier t-master">Master</span> | `map`, `filter`, `flatMap`, `sorted`, `distinct`, `peek` |
| 05 | **Collectors** *(not written yet)* | <span className="db-tier t-master">Master</span> | `toMap`'s duplicate-key crash, `groupingBy`, `joining` |
| 06 | **`reduce` and primitive streams** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Summing money-in-cents without boxing |
| 07 | **`Optional` used correctly** *(not written yet)* | <span className="db-tier t-master">Master</span> | A return type, not a field; `orElse` vs `orElseGet` |
| 08 | **Streams vs loops** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The honest line between pipeline and loop |
| 09 | **Parallel streams** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Why `.parallel()` in a web app is usually a mistake |
| 10 | **Stateful lambdas and side effects** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The hidden ordering bug inside pipelines |
| 11 | **`toList()` vs `Collectors.toList()`** *(not written yet)* | <span className="db-tier t-know">Know</span> | Unmodifiable vs mutable-by-accident |
| 12 | **Infinite streams** *(not written yet)* | <span className="db-tier t-know">Know</span> | `iterate`, `generate`, `takeWhile`/`dropWhile` |
| 13 | **Stream gatherers** *(not written yet)* | <span className="db-tier t-know">Know</span> | `Stream.gather` (24): windowing without a library |

## Phase gate

Move on when you can turn "group orders by customer, keep the three most
recent each, as `Map<CustomerId, List<Order>>`" into one readable pipeline —
and can also say when you'd refuse to and write the loop.

## Where this connects

- **[Phase 3](../phase-3-generics-collections/README.md)** supplies the
  sources and sinks; collectors are collection constructors in disguise.
- **Phase 6 — Concurrency** owns the parallel-stream story's thread pool.
- **Phase 10 — Data access** is where `Optional` return types meet
  repositories.
