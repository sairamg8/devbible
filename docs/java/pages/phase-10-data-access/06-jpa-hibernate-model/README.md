---
title: "06 · The JPA/Hibernate model"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**Entities, `@Id` generation and the persistence context — why a setter call became an UPDATE you never wrote.**

:::tip Complete — 42 chunks
The topic runs from what an entity is, through mapping and `@Id` generation, the
persistence context and the four entity states, to the machinery the whole phase turns
on: dirty checking and the snapshot, flush and its fixed operation order, `@Version`
and optimistic locking, `ddl-auto`, and how to see what Hibernate is actually doing.
:::

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · What an entity is](01-what-an-entity-is.md)** | An entity is not a class with annotations on it — it is a class you have handed to a runtime that promises to watch it |
| 2 | **[1b · The rules the spec imposes](01b-the-rules-the-spec-imposes.md)** | Every structural rule the spec places on an entity class exists because of one specific thing the runtime has to do to it |
| 3 | **[1c · Why not a record](01c-why-not-a-record.md)** | A record cannot be a JPA entity — and the reason is not a limitation anyone chose, it is what a record is |
| 4 | **[2 · @Entity and @Table](02-entity-and-table.md)** | @Entity names a thing in your query language; @Table names a thing in your database — confusing the two is the first mapping bu… |
| 5 | **[3 · Fields, columns, access](03-fields-columns-access.md)** | Almost every field maps itself — the annotations exist for the handful that cannot, and for telling the logical layer apart fro… |
| 6 | **[4 · Enums and the ORDINAL trap](04-enums-ordinal-corruption.md)** | @Enumerated defaults to ORDINAL, and ORDINAL turns a routine refactor into silent, irreversible data corruption |
| 7 | **[5 · Embeddables and converters](05-embeddables-lobs-converters.md)** | Two ways to map something JPA has no built-in type for — @Embeddable when the value spans columns, a converter when it is one c… |
| 8 | **[5b · Large columns and @Lob](05b-lobs-and-large-columns.md)** | @Lob selects a JDBC API, not a column size — and on PostgreSQL that makes it the wrong annotation for almost every large column… |
| 9 | **[6 · The identifier](06-the-identifier.md)** | The @Id is not really for the database — it is the key the persistence context files your object under, and that is why the rul… |
| 10 | **[7 · @GeneratedValue and IDENTITY](07-generatedvalue-identity.md)** | GenerationType.IDENTITY forces Hibernate to INSERT the moment you call persist — every strange thing about IDENTITY follows fro… |
| 11 | **[7b · IDENTITY kills batching](07b-identity-kills-batching.md)** | IDENTITY disables JDBC batching for that entity, and no configuration setting will bring it back — this is the single most cons… |
| 12 | **[8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md)** | allocationSize is not a tuning knob — it is a contract between your mapping and your DDL, and Hibernate 7 throws at startup whe… |
| 13 | **[8b · Sequences on PostgreSQL](08b-sequence-on-postgres.md)** | PostgreSQL's own sequence cache and Hibernate's allocationSize are two independent blocking schemes stacked on top of each othe… |
| 14 | **[9 · TABLE, AUTO and UUID](09-table-auto-uuid.md)** | AUTO is a decision Hibernate makes from your field's Java type — so a bare @GeneratedValue on a Long and on a UUID are two comp… |
| 15 | **[10 · equals and hashCode](10-equals-and-hashcode.md)** | equals/hashCode based on a generated @Id loses elements out of a HashSet, because the hash changes while the object is in it |
| 16 | **[10b · Fixing entity equality](10b-fixing-entity-equality.md)** | There are exactly three ways to fix entity equality, Hibernate recommends the middle one, and the third is a documented workaro… |
| 17 | **[11 · The persistence context](11-the-persistence-context.md)** | Load the same row twice and you get the same object — not two equal objects, the identical reference. That one guarantee is wha… |
| 18 | **[11b · The find that issues no SQL](11b-find-that-issues-no-sql.md)** | The first-level cache is a correctness feature that happens to save queries — treating it as a performance cache is how people … |
| 19 | **[12 · The four entity states](12-the-four-states.md)** | An entity instance is always in exactly one of four states relative to a persistence context — and Hibernate has to guess which… |
| 20 | **[13 · persist, find, getReference](13-persist-find-getreference.md)** | persist and remove schedule work; find and refresh go to the database now; getReference goes nowhere at all — knowing which is … |
| 21 | **[13b · merge returns a copy](13b-merge-returns-a-copy.md)** | merge does not attach your object — it returns a different one, and every bug people have with merge is a consequence of ignori… |
| 22 | **[13c · remove, refresh, detach, clear](13c-remove-refresh-detach-clear.md)** | remove, refresh, detach, clear, contains and lock — the operations you reach for when the default behaviour is not what you wan… |
| 23 | **[14 · Dirty checking](14-dirty-checking.md)** | Nothing in your code asked for that UPDATE — Hibernate kept a private copy of the row when it loaded it, and compares against t… |
| 24 | **[14b · When the snapshot is taken](14b-when-the-snapshot-is-taken.md)** | Every operation that makes an instance managed takes a snapshot, except the one that never reads the row — and the differences … |
| 25 | **[14c · What counts as a change](14c-what-counts-as-a-change.md)** | The comparison is per mapped value and it does not go through your setters, so anything that makes a value differ from its snap… |
| 26 | **[14d · The shape of the UPDATE](14d-the-shape-of-the-update.md)** | Hibernate writes every column in the UPDATE, not just the one you changed — and the annotation that fixes that trades one kind … |
| 27 | **[14e · What dirty checking costs](14e-what-dirty-checking-costs.md)** | The comparison is proportional to what is in the persistence context, not to what you changed — and it runs on every flush, whi… |
| 28 | **[14f · Turning it off](14f-turning-dirty-checking-off.md)** | There are five ways to stop paying for dirty checking, they are not interchangeable, and the one everyone reaches for does some… |
| 29 | **[15 · Flush](15-flush.md)** | Flush sends the SQL; commit ends the transaction — they are different events, they usually happen microseconds apart, and every… |
| 30 | **[15b · What triggers a flush](15b-what-triggers-a-flush.md)** | AUTO flushes before a query only when the query overlaps the pending changes — and a native query overlaps nothing, because Hib… |
| 31 | **[15c · Flush operation order](15c-flush-operation-order.md)** | Hibernate does not execute your statements in the order you wrote them — it drains an action queue in a fixed order, and delete… |
| 32 | **[15d · Reading your own writes](15d-reading-your-own-writes.md)** | A bulk update writes rows the persistence context has never heard of, so every entity you already loaded is now silently stale … |
| 33 | **[16 · @Version and optimistic locking](16-version-and-optimistic-locking.md)** | @Version is one field on your entity, and adding it changes the SQL of every update and delete that entity will ever produce — … |
| 34 | **[16b · When the check fails](16b-when-the-version-check-fails.md)** | Four different exceptions can come out of one failed version check, one of them does not mean a concurrency conflict at all, an… |
| 35 | **[16c · Beyond @Version](16c-beyond-version.md)** | When a version column is not enough or not possible: versionless strategies, forced increments, and the point at which optimist… |
| 36 | **[17 · ddl-auto](17-ddl-auto.md)** | ddl-auto has more values than the four everybody knows, Spring Boot's default depends on what database you connected to, and th… |
| 37 | **[17b · Why update is never production](17b-why-update-is-never-production.md)** | update never drops, never narrows and never renames — so it cannot fail, and a schema it has been maintaining diverges from you… |
| 38 | **[18 · Seeing what Hibernate does](18-seeing-what-hibernate-does.md)** | The SQL log tells you which statements ran; it cannot tell you why one of them exists — and for a topic whose whole subject is … |
| 39 | **[18b · The statistics you read](18b-the-statistics-you-actually-read.md)** | Six counters answer every question this topic raises, and the most useful reading is not any one of them but the ratio between two |
| 40 | **[18c · open-in-view](18c-open-in-view.md)** | open-in-view is on by default and it changes the one thing this whole topic is about — how long the persistence context lives |
| 41 | **[19 · The checklist](19-the-checklist.md)** | Reviewing an entity — the twenty questions to ask about a mapping, in the order that finds the expensive mistakes first |
| 42 | **[19b · Reviewing the unit of work](19b-reviewing-the-unit-of-work.md)** | Reviewing the code around the entity — the questions that have no answer in the mapping, because a persistence context is a pro… |
