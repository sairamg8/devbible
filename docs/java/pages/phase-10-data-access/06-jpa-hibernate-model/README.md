---
title: "06 · The JPA/Hibernate model"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**Entities, `@Id` generation and the persistence context — why a setter call became an UPDATE you never wrote.**

:::caution Topic in progress — 22 of 30 chunks written
Everything through **13c · `remove`, `refresh`, `detach`, `clear`** is finished —
entities, mapping, `@Id` generation, the persistence context and the entity states.
Outstanding: dirty checking (14, 14b), flush (15, 15b), `@Version` (16), `ddl-auto`
(17), seeing what Hibernate does (18) and the checklist (19). Forward references to
those appear as bold plain text rather than links.
:::

<!--CHUNKS-->

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · What an entity is](01-what-an-entity-is.md)** | An entity is not a class with annotations on it — it is a class you have handed to a runtime that promises to watch it |
| 2 | **[1b · The rules the spec imposes](01b-the-rules-the-spec-imposes.md)** | Every structural rule the spec places on an entity class exists because of one specific thing the runtime has to do to it |
| 3 | **[1c · Why not a record](01c-why-not-a-record.md)** | A record cannot be a JPA entity — and the reason is not a limitation anyone chose, it is what a record is |
| 4 | **[2 · @Entity and @Table](02-entity-and-table.md)** | @Entity names a thing in your query language; @Table names a thing in your database — confusing the two is the first mapping bug everyone writes |
| 5 | **[3 · Fields, columns, access](03-fields-columns-access.md)** | Almost every field maps itself — the annotations exist for the handful that cannot, and for telling the logical layer apart from the mapping layer |
| 6 | **[4 · Enums and the ORDINAL trap](04-enums-ordinal-corruption.md)** | @Enumerated defaults to ORDINAL, and ORDINAL turns a routine refactor into silent, irreversible data corruption |
| 7 | **[5 · Embeddables and converters](05-embeddables-lobs-converters.md)** | Two ways to map something JPA has no built-in type for — @Embeddable when the value spans columns, a converter when it is one column of an unknown type |
| 8 | **[5b · Large columns and @Lob](05b-lobs-and-large-columns.md)** | @Lob selects a JDBC API, not a column size — and on PostgreSQL that makes it the wrong annotation for almost every large column you will ever map |
| 9 | **[6 · The identifier](06-the-identifier.md)** | The @Id is not really for the database — it is the key the persistence context files your object under, and that is why the rules around it are strict |
| 10 | **[7 · @GeneratedValue and IDENTITY](07-generatedvalue-identity.md)** | GenerationType.IDENTITY forces Hibernate to INSERT the moment you call persist — every strange thing about IDENTITY follows from that one fact |
| 11 | **[7b · IDENTITY kills batching](07b-identity-kills-batching.md)** | IDENTITY disables JDBC batching for that entity, and no configuration setting will bring it back — this is the single most consequential default in the topic |
| 12 | **[8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md)** | allocationSize is not a tuning knob — it is a contract between your mapping and your DDL, and Hibernate 7 throws at startup when the two disagree |
| 13 | **[8b · Sequences on PostgreSQL](08b-sequence-on-postgres.md)** | PostgreSQL's own sequence cache and Hibernate's allocationSize are two independent blocking schemes stacked on top of each other, and only one of them is yours |
| 14 | **[9 · TABLE, AUTO and UUID](09-table-auto-uuid.md)** | AUTO is a decision Hibernate makes from your field's Java type — so a bare @GeneratedValue on a Long and on a UUID are two completely different strategies |
| 15 | **[10 · equals and hashCode](10-equals-and-hashcode.md)** | equals/hashCode based on a generated @Id loses elements out of a HashSet, because the hash changes while the object is in it |
| 16 | **[10b · Fixing entity equality](10b-fixing-entity-equality.md)** | There are exactly three ways to fix entity equality, Hibernate recommends the middle one, and the third is a documented workaround with a real cost |
| 17 | **[11 · The persistence context](11-the-persistence-context.md)** | Load the same row twice and you get the same object — not two equal objects, the identical reference. That one guarantee is what a persistence context is |
| 18 | **[11b · The find that issues no SQL](11b-find-that-issues-no-sql.md)** | The first-level cache is a correctness feature that happens to save queries — treating it as a performance cache is how people end up surprised by stale data |
| 19 | **[12 · The four entity states](12-the-four-states.md)** | An entity instance is always in exactly one of four states relative to a persistence context — and Hibernate has to guess which one, using heuristics you can accidentally defeat |
| 20 | **[13 · persist, find, getReference](13-persist-find-getreference.md)** | persist and remove schedule work; find and refresh go to the database now; getReference goes nowhere at all — knowing which is which explains most of the API |
| 21 | **[13b · merge returns a copy](13b-merge-returns-a-copy.md)** | merge does not attach your object — it returns a different one, and every bug people have with merge is a consequence of ignoring the return value |
| 22 | **[13c · remove, refresh, detach, clear](13c-remove-refresh-detach-clear.md)** | remove, refresh, detach, clear, contains and lock — the operations you reach for when the default behaviour is not what you want, each with a documented sharp edge |
