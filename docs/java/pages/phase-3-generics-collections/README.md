---
title: "Phase 3 — Generics and collections"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the JLS, the JDK 25 API documentation).
> No sandbox: pages carry Java code, never fabricated program output.

Every request handler you will ever write moves data through these types.
Choosing the right one — and knowing its cost model — is daily work, and the
`HashMap`-internals and erasure questions are interview staples because they
separate users from understanders.

🚧 **14 of 16 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Generics: why, and the diamond](01-generics-raw-types/README.md)** | <span className="db-tier t-master">Master</span> | Raw types are a bug factory the compiler can't help |
| 02 | **[Type erasure](02-type-erasure.md)** | <span className="db-tier t-understand">Understand</span> | No `new T[]`, no `instanceof List<String>`, one class per generic |
| 03 | **[Bounds, wildcards and PECS](03-wildcards-pecs.md)** | <span className="db-tier t-understand">Understand</span> | Reading `? super T` signatures without flinching |
| 04 | **[The collection hierarchy](04-collection-hierarchy.md)** | <span className="db-tier t-understand">Understand</span> | `Collection`, `List`, `Set`, `Map` (not a `Collection`!), `Queue` |
| 05 | **[`ArrayList`](05-arraylist/README.md)** | <span className="db-tier t-master">Master</span> | The default list — and why `LinkedList` almost never wins |
| 06 | **[Sets](06-sets.md)** | <span className="db-tier t-understand">Understand</span> | `HashSet`, `LinkedHashSet`, `TreeSet` — dedupe in one constructor |
| 07 | **[`HashMap` internals](07-hashmap-internals.md)** | <span className="db-tier t-understand">Understand</span> | Buckets, hashing, treeification — why keys must be immutable |
| 08 | **[`LinkedHashMap` and `TreeMap`](08-linkedhashmap-treemap.md)** | <span className="db-tier t-understand">Understand</span> | A 10-line LRU cache; range queries |
| 09 | **[Queues and deques](09-queues-deques.md)** | <span className="db-tier t-understand">Understand</span> | `ArrayDeque`, `PriorityQueue` — job-scheduling shapes |
| 10 | **[`Comparable` vs `Comparator`](10-comparable-comparator/README.md)** | <span className="db-tier t-master">Master</span> | Chained comparators, nulls, and the contract-violation crash |
| 11 | **Iteration and `ConcurrentModificationException`** *(not written yet)* | <span className="db-tier t-master">Master</span> | Removing while iterating — why the exception is a feature |
| 12 | **Immutable collections** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `List.of` vs `unmodifiableList` — copy vs view |
| 13 | **[`Collections` and `Arrays` utilities](13-collections-arrays-utilities.md)** | <span className="db-tier t-understand">Understand</span> | `sort`, `binarySearch`, the `asList` fixed-size trap |
| 14 | **[Choosing a collection — the decision table](14-choosing-a-collection/README.md)** | <span className="db-tier t-master">Master</span> | By lookup, ordering and mutation pattern |
| 15 | **[Writing an `Iterable`](15-writing-an-iterable.md)** | <span className="db-tier t-know">Know</span> | Iteration for your own types |
| 16 | **[Legacy types](16-legacy-types.md)** | <span className="db-tier t-know">Know</span> | `Vector`, `Hashtable`, `Stack` — recognize, never write |

## Phase gate

Move on when: given "look up users by id, keep signup order for display,
dedupe emails case-insensitively", you name the exact types — `HashMap`,
`LinkedHashSet` or a list, `TreeSet` with a comparator — and the cost of each
operation.

## Where this connects

- **[Phase 2](../phase-2-classes-objects/README.md)** supplies
  `equals`/`hashCode` — the contract `HashMap` and `HashSet` enforce.
- **Phase 4 — Streams** consumes every type here as a source.
- **Phase 6 — Concurrency** replaces these with their concurrent cousins where
  threads share them.
