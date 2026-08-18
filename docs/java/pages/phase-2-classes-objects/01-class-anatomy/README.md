---
title: "Class anatomy and construction"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8 (classes), §8.8.7 (constructor
> bodies), §12.4 (initialization of classes), §12.5 (creation of new class
> instances), JEP 513 (Flexible Constructor Bodies, finalized in 25), and
> *Effective Java* 3rd ed. items 1–2 for the factory/builder idioms.

**Construction of a Java object is a fully specified sequence — superclass
first, then field initializers and instance blocks in textual order, then the
constructor body — and half of the "impossible" bugs in object setup are code
observing that sequence mid-flight. Learn the order once and constructor bugs
stop being mysteries; learn the idioms (chaining, static factories, builders)
and your constructors stop being the bug.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The parts and the order](01-the-parts-and-the-order.md)** | Fields, initializers, `this`; the full §12.4/§12.5 initialization sequence; field shadowing |
| 2 | **[Constructors and chaining](02-constructors-and-chaining.md)** | `this(...)` chaining, JEP 513 prologues, the default constructor, telescoping constructors |
| 3 | **[Factories, builders and safe construction](03-factories-builders-safety.md)** | Static factory methods, the builder hand-off, why `this` must not escape a constructor |

## Why this is a Master topic

Every object in every service you ship goes through this machinery. The
initialization order explains the "field was definitely set but reads as
`null`" class of bug; the default-constructor rule explains a whole family of
Jackson/JPA runtime failures; the factory and builder idioms are the shape of
every modern Java API from `List.of` to `HttpRequest.newBuilder`.

## Phase gate contribution

The gate's `Money` and `Order` types need a canonical constructor holding the
invariants, with every other entry point delegating to it — chunk 2's
pattern, packaged by chunk 3's factories.

---

← Index: [Phase 2 — Classes and objects](../README.md) · Next → [Encapsulation and access modifiers](../02-encapsulation-access/README.md)
