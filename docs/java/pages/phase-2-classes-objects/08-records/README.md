---
title: "Records — the default data carrier"
sidebar_label: "08 · Records"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 395 (Records, finalized in 16), the
> `java.lang.Record` Javadoc (JDK 25), JEP 440 (record patterns, 21), and the
> Jackson databind release notes for record support.

**A record declares "I am transparent, immutable data" and the compiler holds
you to it: components become final fields, accessors, a canonical
constructor, and contract-correct `equals`/`hashCode`/`toString` — all
derived from one line, all updating themselves when the line changes. Since
16, the answer to "DTO, value object, map key, API payload?" is a record
unless something specific disqualifies it — and the disqualifiers (JPA
entities, mutable identity) are a short, learnable list.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The feature](01-the-feature.md)** | Components and generated members, compact constructors, finality and *shallow* immutability, what records can't do |
| 2 | **[Records in practice](02-records-in-practice.md)** | DTOs with Jackson, validation and defensive copies, records vs Lombok vs JavaBeans, when *not* a record, deconstruction patterns |

## Why this is a Master topic

Records are where four earlier threads pay off at once: value semantics
([topic 06's](../06-equals-hashcode/README.md) generated contract),
immutability (topic 12's design, enforced by the compiler), `toString`
hygiene ([topic 07](../07-tostring.md)), and the ADT story
(topic 09 · sealed types — records are its case classes). Every phase after
this one uses records as the default request/response/value shape.

## Phase gate contribution

The gate's `Money` record — `BigDecimal` amount, validated, normalized,
`HashSet`-safe — is chunk 2's worked example.

---

← Index: [Phase 2 — Classes and objects](../README.md) · Next → [Sealed types + records + switch](../09-sealed-adts.md)
