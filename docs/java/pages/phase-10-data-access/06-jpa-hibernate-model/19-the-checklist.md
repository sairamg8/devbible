---
title: "Reviewing an entity — the twenty questions to ask about a mapping, in the order that finds the expensive mistakes first"
sidebar_label: "19 · The checklist"
sidebar_position: 41
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — every item on this page is a summary of a claim argued and sourced in
> the chunk it links to. The underlying sources are the Hibernate ORM 7.4 *User Guide* and
> *Introduction*
> ([docs.hibernate.org/orm/7.4/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Jakarta Persistence 3.2 specification
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html))
> and the Spring Boot 4.1 / Spring Framework 7.0 references and sources
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Two of the items below are ordered first because they corrupt data silently rather than
failing. Everything after them is ordered by how expensive it is to change once the table has
rows in it. Nothing here is style.**

## The two that corrupt

**1 · Is any enum mapped without `@Enumerated(STRING)`?**
The default is `ORDINAL`, and `ORDINAL` turns reordering an enum's constants — a change no
reviewer flags — into silent, irreversible corruption of existing rows.
→ [4 · Enums and the `ORDINAL` trap](04-enums-ordinal-corruption.md)

**2 · Do `equals` and `hashCode` use a generated `@Id`?**
The hash changes when the identifier is assigned, so an instance put in a `HashSet` before
persisting is lost inside it afterwards.
→ [10 · `equals` and `hashCode`](10-equals-and-hashcode.md),
[10b · Fixing entity equality](10b-fixing-entity-equality.md)

## Identity and generation

**3 · Is the identifier a wrapper type, not a primitive?**
`Long`, not `long`. Hibernate uses a default value to distinguish transient from detached, and
a primitive `0` is indistinguishable from an assigned zero.
→ [6 · The identifier](06-the-identifier.md)

**4 · Is `GenerationType.IDENTITY` used, and does anything about this entity do bulk
inserts?**
`IDENTITY` forces the `INSERT` at `persist()` and disables JDBC batching for that entity
entirely — transparently, so `batch_size` looks configured and does nothing.
→ [7b · `IDENTITY` kills batching](07b-identity-kills-batching.md)

**5 · If `SEQUENCE`, does `allocationSize` match the database sequence's `INCREMENT BY`?**
It is a contract, not a tuning knob, and Hibernate 7 throws at startup when the two disagree.
→ [8 · `SEQUENCE` and `allocationSize`](08-sequence-and-allocationsize.md),
[8b · Sequences on PostgreSQL](08b-sequence-on-postgres.md)

**6 · Does anything assign a value to a `@GeneratedValue` or `@Version` field?**
Both defeat the transient/detached heuristic, and assigning a version is forbidden outright.
→ [12 · The four entity states](12-the-four-states.md),
[16 · `@Version`](16-version-and-optimistic-locking.md)

## Columns and values

**7 · Is `@Lob` on anything?**
On PostgreSQL it selects the LOB JDBC API and therefore the `oid` type — almost never what
was wanted. `@Column(length = …)` is the right lever.
→ [5b · Large columns and `@Lob`](05b-lobs-and-large-columns.md)

**8 · Are mutable types (`java.util.Date`, `byte[]`, mutable value objects) mapped?**
Each costs a deep copy into the snapshot and an `equals` comparison on every flush, and each
can be mutated in place — which counts as a change even though no setter was called.
→ [14c · What counts as a change](14c-what-counts-as-a-change.md)

**9 · Is there a converter whose Java type has no `equals`/`hashCode`?**
Hibernate says so at startup with `HHH000481`, and the consequence is bad dirty checking.
→ [14c · What counts as a change](14c-what-counts-as-a-change.md)

**10 · Does anything assign to a *mapped* field during load — `@PostLoad`, a normalising
getter, a defensive copy?**
The entity is then dirty the instant it is read, and every read transaction emits an
`UPDATE`. Derived state belongs on a `@Transient` field.
→ [14c · What counts as a change](14c-what-counts-as-a-change.md)

**11 · Is `@Column(updatable = false)` being used to mean "do not write this now"?**
It fails silently: assignments to the field never reach the database, and the entity can
still be dirty on other fields.
→ [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md)

**12 · Is the access type what you think?**
`@Id` on a field means field access; on a getter, property access — and property access calls
your getters during dirty checking.
→ [3 · Fields, columns, access](03-fields-columns-access.md)

## Concurrency

**13 · Does a frequently updated entity have `@Version`?**
The Hibernate *Introduction*'s position is that almost every one should. Adding it later is a
migration, not an annotation, because existing rows need the column backfilled.
→ [16 · `@Version` and optimistic locking](16-version-and-optimistic-locking.md)

**14 · If it has `@Version`, does the version reach the client and come back?**
If the DTO does not carry it, the check passes vacuously and you have the column, the
increments and none of the protection.
→ [16b · When the check fails](16b-when-the-version-check-fails.md)

**15 · Is the version numeric?**
The documentation calls timestamps "a less reliable way of optimistic locking", and two
updates inside the clock's resolution defeat them.
→ [16 · `@Version` and optimistic locking](16-version-and-optimistic-locking.md)

**16 · Is `@OptimisticLock(excluded = true)` or `@OptimisticLocking(type = NONE)` present?**
The first is a decision to accept lost updates on that attribute; the second disables the
check even with `@Version` mapped.
→ [16c · Beyond `@Version`](16c-beyond-version.md)

## Shape and cost

**17 · How wide is the entity, and is all of it needed?**
Every mapped attribute is compared on every flush of every transaction that loaded the row,
whether or not you read it.
→ [14e · What dirty checking costs](14e-what-dirty-checking-costs.md)

**18 · Is `@DynamicUpdate` present, and is this entity written in bulk?**
It narrows the `SET` clause and fragments JDBC batching. The two goals are incompatible;
choose knowingly.
→ [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md)

**19 · Should the entity be `@Immutable`?**
A reference table or an append-only row gets a smaller memory footprint and skips the dirty
check entirely.
→ [14f · Turning it off](14f-turning-dirty-checking-off.md)

**20 · Should this be an entity at all?**
If nothing ever modifies it, a projection or DTO query loads no entity, takes no snapshot and
adds nothing to any flush.
→ [topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)

## And two about the schema, not the class

**21 · What is `ddl-auto` set to in each environment, and where is it set?**
A raw `spring.jpa.properties.hibernate.hbm2ddl.auto` overrides the shortcut everywhere, and
`create` through the shortcut drops your tables.
→ [17 · `ddl-auto`](17-ddl-auto.md)

**22 · Is the schema owned by migrations?**
`update` only ever adds. Anything not purely additive silently diverges.
→ [17b · Why `update` is never production](17b-why-update-is-never-production.md)

*Relationships, cascade and fetch types have their own review list and belong to
[topic 07 · Relationships and fetch types](../07-relationships-fetch/README.md).*

## Gotchas

**★ Most of this list cannot be checked by a linter.** The dangerous items — an enum without
`STRING`, a version that never leaves the server, a `ddl-auto` in the wrong file — are all
individually legal code.

**★ Items 1 and 5 fail at different times.** The `allocationSize` mismatch throws at startup
in Hibernate 7; the `ORDINAL` enum never throws at all. Prioritise by failure mode, not by
severity of the eventual damage.

**★ Adding `@Version` to an existing entity is a schema migration.** The column has to exist
and be backfilled to a non-null value in the same deployment, or every update stops matching.

**★ "It works" is not evidence for items 8, 10 and 17.** Phantom updates, snapshot cost and a
too-wide entity all produce correct behaviour and worse performance.

**★ Reviewing an entity in isolation misses the state questions.** Whether an instance is
managed when it is modified is a property of the calling code, not the class —
[19b · Reviewing the unit of work](19b-reviewing-the-unit-of-work.md).

**★ A `@Transient` field is a mapping decision *and* a performance decision.** It is the only
way to keep derived state on the entity without paying for it at every flush.

**★ An entity that is read-only in practice is rarely marked as such.** Items 19 and 20 are
the two most commonly missed, because nothing about the code looks wrong.

**★ Item 21 has an ordering trap: the value can be set in four places** — the raw Hibernate
property, the Boot shortcut, the JPA-standard property, and Boot's computed default — and the
first one wins.

## Interview questions

**★ You are reviewing a new entity. What do you look at first?**
Enums without `@Enumerated(STRING)` and `equals`/`hashCode` built on a generated identifier —
because those two corrupt data or lose objects silently, rather than failing. Everything else
either throws or merely costs.

**★ Why is the identifier's Java type a review item?**
Because Hibernate distinguishes transient from detached partly by whether the identifier holds
its default value. A primitive `long` cannot express "unset", so a legitimate zero and an
unassigned identifier are the same thing.

**★ What would make you object to `GenerationType.IDENTITY`?**
Any workload that inserts many rows at once. `IDENTITY` requires the `INSERT` to execute at
`persist()`, which disables JDBC batching for that entity — and the documentation notes it
happens transparently, so the batch settings look correct and do nothing.

**★ How do you tell whether an entity is paying for dirty checking it does not need?**
Look for mapped mutable types, for assignments to mapped fields during load, and for width
that no code path reads. Then confirm with statistics: entity update counts above zero in a
read path, or flush counts far above write counts.

**★ What is the review question that catches most silent write bugs?**
Whether the version travels to the client and back. An application with `@Version` mapped and
DTOs that omit it has all of optimistic locking's cost and none of its protection, and nothing
reports it.

**★ Why is `ddl-auto` an entity-review item at all?**
Because the mapping and the schema are two halves of one thing, and `update` will happily let
them diverge. If the answer to "who owns the schema" is not "the migration tool", the review
of the class is not the binding constraint.

**★ When is the right answer "this should not be an entity"?**
When nothing modifies it. An entity is the shape you choose to get change tracking; if you
never change it, a projection avoids the identity map, the snapshot and every flush cost, and
loses nothing.

---

← Prev: [18c · open-in-view](18c-open-in-view.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [19b · Reviewing the unit of work](19b-reviewing-the-unit-of-work.md)
