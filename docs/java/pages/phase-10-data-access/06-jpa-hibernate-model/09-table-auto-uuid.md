---
title: "AUTO is a decision Hibernate makes from your field's Java type — so a bare @GeneratedValue on a Long and on a UUID are two completely different strategies"
sidebar_label: "9 · TABLE, AUTO and UUID"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.7.8 *Interpreting
> AUTO*, §3.7.11 *Using the table identifier generator* and §3.7.12 *Using UUID
> generation*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §3.5 *Generated identifiers*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `jakarta.persistence.GenerationType` javadoc in the Jakarta Persistence 3.2 API
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html))
> and the PostgreSQL 18 manual *CREATE SEQUENCE*
> ([postgresql.org/docs/18/sql-createsequence.html](https://www.postgresql.org/docs/18/sql-createsequence.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Three strategies remain, and they are the ones people reason about least. `AUTO` is
the default, which means most applications are using it without having chosen it. `TABLE`
is the portable fallback nobody should pick deliberately. `UUID` is the one whose costs
are entirely about index behaviour rather than about JPA. This chunk finishes the
generation story and gives you a decision rule for the whole set.**

## `AUTO` — and how Hibernate 7 interprets it

The spec deliberately does not say. The User Guide §3.7.8 opens with it: "How a
persistence provider interprets the `AUTO` generation type is left up to the provider."

Hibernate's rule is short and depends on your Java type:

> The default behavior is to look at the Java type of the identifier attribute, plus what
> the underlying database supports.
>
> If the identifier type is `UUID`, Hibernate is going to use a UUID generator.
>
> If the identifier type is numeric (e.g. `Long`, `Integer`), then Hibernate will use its
> `SequenceStyleGenerator` which resolves to a SEQUENCE generation if the underlying
> database supports sequences and a table-based generation otherwise.

The Introduction's table says the same thing more compactly: `AUTO` "selects SEQUENCE,
TABLE, or UUID based on the identifier type and capabilities of the database."

Two consequences that matter every day:

**On PostgreSQL, a bare `@GeneratedValue Long id` is a sequence.** Not an identity
column. So it does *not* have the batching restriction from
[7b · IDENTITY kills batching](07b-identity-kills-batching.md) — a fact that
contradicts a widespread assumption. It also inherits everything from
[8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md), including the
default `allocationSize` of 50 and the bootstrap mismatch check.

**Changing the field's type changes the strategy.** Switch `Long id` to `UUID id` under a
bare `@GeneratedValue` and you have silently moved from sequence generation to UUID
generation. That is by design, but it means the strategy is not visible in the
annotation.

⚠️ `AUTO` was interpreted differently in Hibernate 4 and 5 — the old
`hibernate.id.new_generator_mappings` era, where `AUTO` on some configurations meant
`TABLE`. Anything you remember from that period should be re-read against §3.7.8 rather
than recalled.

## `TABLE` — the portable one, and why it is a last resort

`TABLE` emulates a sequence with a table. The User Guide describes Hibernate's
implementation, `org.hibernate.id.enhanced.TableGenerator`, as defining "a table capable
of holding multiple named value segments for any number of entities" — one table, one row
per generator, each row a counter.

```java
@Id
@GeneratedValue(strategy = GenerationType.TABLE, generator = "product_gen")
@TableGenerator(name = "product_gen",
                table = "id_generator",
                pkColumnName = "sequence_name",
                valueColumnName = "next_val",
                pkColumnValue = "product",
                allocationSize = 50)
private Long id;
```

It keeps batching — the identifier is produced without inserting the entity's row — and
it uses the same pooled optimizers as `SEQUENCE`, so `allocationSize` means exactly what
it means there.

**What it costs is concurrency.** Claiming a block means reading the counter row and
updating it, which takes a row lock that every other inserter of that entity must wait
for. The PostgreSQL manual makes the comparison for us when explaining why sequences are
not gapless: an exclusively-locked counter table "is much more expensive than sequence
objects, especially if many transactions need sequence numbers concurrently." `TABLE`
generation is that expensive design, adopted for portability rather than for gaplessness
— and it is not even gapless, because the pooled optimizer discards unused block
remainders exactly as a sequence does.

**Use it only when the database has no sequences.** On PostgreSQL, which has had them
forever, there is no reason to choose it.

## `UUID` — no round trip, at a cost paid by your indexes

```java
@Id
@GeneratedValue(strategy = GenerationType.UUID)
private UUID id;
```

The User Guide §3.7.12 describes two implementations: the modern
`org.hibernate.id.uuid.UuidGenerator`, configured with Hibernate's `@UuidGenerator`
annotation, and the older `org.hibernate.id.UUIDGenerator`, reached through
`@GenericGenerator` and explicitly deprecated. "For legacy reasons,
`org.hibernate.id.UUIDGenerator` is used when the generator is implicit," and "future
versions of Hibernate will drop support for `org.hibernate.id.UUIDGenerator`."

"By default, Hibernate uses a random (IETF RFC 4122 version 4) generation." That default
is the thing to think about.

**What you gain.** The identifier is produced in the JVM with no database contact at all,
so there is no round trip, no sequence to keep in step with a mapping, no shared counter,
and no coordination between application instances. You can build an entire object graph
with all its keys before touching the database, and you can merge data from independent
systems without renumbering. Ids also stop leaking business volume — sequential ids tell
anyone who can see one roughly how many rows you have.

**What you pay is index locality.** A version-4 UUID is random, so consecutive inserts
land at random positions in the primary key's B-tree instead of appending at the right-
hand edge. That means more pages touched per insert, worse cache behaviour, and more page
splits. The column is also wider — 16 bytes as PostgreSQL's native `uuid` type against 8
for a `bigint` — and that width is copied into every foreign key and every index that
includes the key.

**The mitigation is a time-ordered UUID.** Hibernate's `@UuidGenerator` supports styles
other than random, including a time-based one, which restores the append-at-the-end
behaviour while keeping client-side generation. On PostgreSQL, always map it to the
native `uuid` type rather than to a `varchar(36)` — the User Guide's §3.2.38 covers UUID
as binary and as `(var)char`, and text storage doubles the width for no benefit.

⛔ No index-size or insert-rate numbers are given here; there is no PostgreSQL on this
machine and no measurement was made. The *direction* of each effect is a structural
property of a B-tree, not something that needs measuring; the magnitude on your data does.

## Choosing, on PostgreSQL 18

| Situation | Strategy |
|---|---|
| Ordinary entity, you own the schema | `SEQUENCE` with an explicit `allocationSize` matching your DDL |
| Bulk inserts matter | `SEQUENCE` — it is the one that preserves batching *and* avoids per-row round trips |
| Ids must be generated offline, merged across systems, or not leak volume | `UUID`, time-ordered, mapped to native `uuid` |
| Legacy schema already has identity columns | `IDENTITY`, knowingly, with the batching consequence accepted |
| The database has no sequences | `TABLE` |
| You have not thought about it | `AUTO` — which on PostgreSQL means `SEQUENCE`, so you got lucky |

## Gotchas

**`AUTO` hides the strategy in the field's type.**
Two entities in the same codebase, one with `Long id` and one with `UUID id`, both with a
bare `@GeneratedValue`, are using different generators. Nothing in either annotation says
so. Writing the strategy out explicitly costs one word and removes the question.

**People assume `AUTO` means `IDENTITY` and reason about batching from that.**
On PostgreSQL it means sequence generation, so the batching restriction they are worried
about does not apply — or, worse, they assume the reverse and are surprised by the
`allocationSize` mismatch check at bootstrap.

**`TABLE` serialises inserts on a row lock.**
Under concurrency the counter row becomes a contention point, and the symptom is
inserts waiting on each other with no obvious cause in the application code. The pooled
optimizer reduces how often you take the lock; it does not remove the lock.

**A `UUID` stored as `varchar(36)` is more than twice the width it needs to be.**
And string comparison is slower than 128-bit comparison. Map it to PostgreSQL's native
`uuid`.

**Random UUID primary keys degrade insert performance in a way that grows with table
size.**
A small table fits in cache and the randomness costs nothing visible. The cost appears
when the index no longer fits in memory, which is exactly when the table is large and
changing the key is hardest. Decide before the table is big.

**`@GeneratedValue` on a `UUID` is outside portable JPA.**
Jakarta Persistence restricts *generated* identifier types to integer types.
`GenerationType.UUID` is a standard enum constant, so the intent is portable; the
underlying support is not guaranteed by every provider.

**The implicit UUID generator is the deprecated one.**
`@GeneratedValue` on a `UUID` field, with no further annotation, currently routes to the
older `org.hibernate.id.UUIDGenerator` for legacy reasons, which the User Guide says will
be dropped. Use Hibernate's `@UuidGenerator` explicitly if you care which implementation
you get.

**Do not mix strategies across an inheritance hierarchy.**
The root entity owns the identifier, and subclasses inherit it. Trying to give a subclass
its own generator does not work, and the attempt usually means the hierarchy is modelling
two things.

## Interview questions

**★ What does `GenerationType.AUTO` do?**
It defers to the provider, and the spec deliberately says nothing more. Hibernate 7
decides from the Java type of the identifier: a `UUID` gets a UUID generator, and a
numeric type gets `SequenceStyleGenerator`, which uses a real sequence where the database
supports one and falls back to a table where it does not. On PostgreSQL that makes a bare
`@GeneratedValue Long id` a sequence — not an identity column, which is what most people
assume.

**★ Why does that matter for batching?**
Because `IDENTITY` is the only strategy that disables INSERT batching, and people
frequently believe `AUTO` is `IDENTITY`. On PostgreSQL it is not, so a bare
`@GeneratedValue` keeps batching available — while inheriting the `allocationSize`
defaults and the sequence-increment mismatch check that come with sequence generation,
which is the thing that will actually bite.

**★ When is `TABLE` generation the right choice?**
Essentially only when the target database has no sequences, which is why the strategy
exists. It preserves batching and supports the same pooled optimizers as `SEQUENCE`, so
it is not slow by construction — but claiming a block means locking and updating a
counter row, so every inserter of that entity contends on it. The PostgreSQL manual
describes precisely this design, in another context, as "much more expensive than
sequence objects, especially if many transactions need sequence numbers concurrently".

**★ What are the trade-offs of UUID primary keys?**
You gain independence: the id is generated in the JVM with no round trip and no shared
counter, so instances need not coordinate, whole object graphs can be built before any
write, data from separate systems merges without renumbering, and ids stop leaking row
counts. You pay in index behaviour: a random version-4 UUID inserts at a random position
in the B-tree rather than appending, which touches more pages and causes more splits, and
the key is 16 bytes rather than 8 in every index and foreign key that carries it. The
usual resolution is a time-ordered UUID, which keeps client-side generation while
restoring append-at-the-end locality.

**★ How should a UUID be stored on PostgreSQL?**
As the native `uuid` type. Storing it as `varchar(36)` more than doubles the width, makes
comparisons string comparisons, and gives up the type's validation. Hibernate maps a Java
`UUID` to the native type on PostgreSQL by default; the `(var)char` form exists for
databases that lack one.

**★ You inherit a service whose entities all use `IDENTITY` and whose bulk import is slow. What is your plan?**
Confirm the diagnosis first: check that the entities really are `IDENTITY` rather than
`AUTO`, and enable TRACE logging on `org.hibernate.orm.jdbc.batch` to see whether
batching is happening at all. If `IDENTITY` is confirmed, migrating to `SEQUENCE` is a
two-part change — a migration creating a sequence whose start value is above the current
maximum id and whose `increment by` matches the `allocationSize` the mapping will use, and
then the mapping change — and Hibernate will refuse to start if the two disagree, which is
a feature. Before doing any of that, ask whether the import should be going through the
entity model at all; a `StatelessSession`, a bulk HQL statement, or PostgreSQL's `COPY`
will each beat it.

---

← Prev: [8b · Sequences on PostgreSQL](08b-sequence-on-postgres.md) · Index: [The JPA/Hibernate model](README.md) · Next → [10 · equals and hashCode](10-equals-and-hashcode.md)
