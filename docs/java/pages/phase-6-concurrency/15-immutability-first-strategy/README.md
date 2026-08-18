---
title: "Immutability as the first strategy"
sidebar_label: "15 · Immutability first"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §17.5 (final field semantics),
> the JDK 25 Javadoc for `List.copyOf`, `Map.copyOf`,
> `Collections.unmodifiableList`, `java.lang.Record` and
> `AtomicReference`, and the Oracle Java Tutorials concurrency lesson
> (Immutable Objects — the strategy pages).

**Every hazard in this phase — the race, the lock, the visibility bug,
the deadlock — needs *shared mutable* state to exist. Immutability
deletes the second word. An object that cannot change is thread-safe by
construction: no lock to forget, no happens-before edge to arrange, no
interleaving to reason about, because there is no *write* for another
thread to observe half of. That is why it is the first strategy, not a
nice-to-have: the concurrency problem you design away is the only kind
you can never get wrong at 3am.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Why it deletes the problem](01-why-it-deletes-the-problem.md)** | The three race ingredients and which one immutability removes, the JLS §17.5 final-field publication guarantee and its construction rules, records as the default carrier, what phase 2's recipe buys under threads |
| 2 | **[Boundaries, copies and "effectively immutable"](02-boundaries-and-effective-immutability.md)** | `List.copyOf`/`Map.copyOf` vs `unmodifiable*` views, defensive copies at API edges, effective immutability and safe publication — and how one late mutation or leaked `this` breaks it |
| 3 | **[Change as replacement](03-change-as-replacement.md)** | The volatile snapshot swap, CAS retry for concurrent writers, builder-then-freeze and withers, where mutation genuinely belongs and how to fence it in |

## Why this is a Master topic

- **It is the strategy the rest of the phase falls back from.** Locks
  ([topic 04](../04-synchronized-intrinsic-locks/README.md)) and the JMM
  ([topic 05](../05-java-memory-model/README.md)) exist to *manage* shared
  mutation; this topic removes it. Reaching for the cure that leaves
  nothing to get wrong is a design instinct, and instincts are built by
  understanding, not by rules of thumb.
- **The final-field guarantee is precise and conditional** — it holds only
  for properly constructed objects, and "properly" has exact rules people
  break by accident (`this` escaping construction). Knowing the condition
  is what separates using the guarantee from being lucky.
- **The snapshot-swap pattern is production architecture.** Config
  reloads, pricing tables, feature flags, routing maps — the
  read-mostly data of every service is served this way, and the pattern
  spans records, `volatile`, and CAS in one design.
- **Virtual threads raise the stakes.** Millions of cheap threads mean
  more concurrent readers of everything; data that is immutable scales
  reads with zero coordination cost.

## Where this connects

- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)** —
  the phase-2 recipe (final fields, defensive copies, builders). This
  topic is that design stance *seen from the concurrency side*: what the
  JMM promises it, and what patterns it unlocks under threads.
- **[The cures](../03-race-conditions/03-the-cures.md)** — immutability is
  cure 2 of three; this topic is that cure given its full depth.
- **[`volatile` and safe publication](../05-java-memory-model/03-volatile-and-safe-publication.md)** —
  the memory-model machinery the snapshot swap leans on.

---

← Prev: [Virtual-thread pinning](../14-virtual-thread-pinning.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [Why it deletes the problem](01-why-it-deletes-the-problem.md)
