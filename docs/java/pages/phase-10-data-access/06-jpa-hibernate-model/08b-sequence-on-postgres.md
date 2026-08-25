---
title: "PostgreSQL's own sequence cache and Hibernate's allocationSize are two independent blocking schemes stacked on top of each other, and only one of them is yours"
sidebar_label: "8b · Sequences on PostgreSQL"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *CREATE SEQUENCE*
> ([postgresql.org/docs/18/sql-createsequence.html](https://www.postgresql.org/docs/18/sql-createsequence.html)),
> the Hibernate ORM 7.4 *User Guide* §3.7.9 *Using sequences* and §3.7.13 *Optimizers*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *Introduction* §3.5 *Generated identifiers*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, PostgreSQL 18.

**PostgreSQL sequences have their own preallocation feature — `CACHE` — that does almost
exactly what Hibernate's `allocationSize` does, at a different layer, with its own
independent block size. Stack the two without noticing and you get identifiers that jump
in unexpected ways and, more importantly, `last_value` in the database that tells you
nothing useful. This chunk covers what PostgreSQL 18 actually guarantees about a
sequence, and the generator-scoping rule that decides whether two entities share one.**

## What PostgreSQL guarantees, and what it does not

Four statements from the PostgreSQL 18 manual, each of which contradicts something
people commonly assume.

**The default increment is 1.** "The optional clause `INCREMENT BY increment` specifies
which value is added to the current sequence value to create a new value. […] The
default value is 1." So `create sequence product_seq;` and
`@GeneratedValue(strategy = SEQUENCE)` — whose `allocationSize` defaults to 50 — are
incompatible out of the box. That is the collision
[8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md) is about, and the
two defaults being different is the root cause.

**Sequence values are never rolled back.** "Because `nextval` and `setval` calls are
never rolled back, sequence objects cannot be used if 'gapless' assignment of sequence
numbers is needed." A failed insert has still consumed its id. The manual even names the
alternative and its price: "It is possible to build gapless assignment by using exclusive
locking of a table containing a counter; but this solution is much more expensive than
sequence objects, especially if many transactions need sequence numbers concurrently."
That is exactly what `GenerationType.TABLE` does — see
[9 · TABLE, AUTO and UUID](09-table-auto-uuid.md).

**`CACHE` is a second, per-session preallocation.** "The optional clause `CACHE cache`
specifies how many sequence numbers are to be preallocated and stored in memory for
faster access. The minimum value is 1 (only one value can be generated at a time, i.e.,
no cache), and this is also the default." The manual is explicit about the consequence:
"any numbers allocated but not used within a session will be lost when that session ends,
resulting in 'holes' in the sequence."

**With `CACHE > 1`, values are not even generated in order across sessions.** "with a
cache setting of 10, session A might reserve values 1..10 and return `nextval`=1, then
session B might reserve values 11..20 and return `nextval`=11 before session A has
generated `nextval`=2. Thus, with a cache setting of one it is safe to assume that
`nextval` values are generated sequentially; with a cache setting greater than one you
should only assume that the `nextval` values are all distinct, not that they are
generated purely sequentially."

## Two caches, stacked

Read those together with Hibernate's pooled optimizer and the picture is a two-layer
system:

| Layer | Who blocks | Setting | Lost on |
|---|---|---|---|
| Hibernate | the JVM process | `allocationSize` (default 50) | application restart |
| PostgreSQL | the database session | `CACHE` (default 1) | session close |

Both hand out values from memory. Both leave holes when their owner goes away. They
multiply: `allocationSize = 50` on a sequence with `CACHE 10` means the database
preallocates in tens and Hibernate then treats each returned value as the boundary of a
fifty-wide block — which does *not* line up.

**Leave `CACHE` at its default of 1 when Hibernate owns the sequence.** Hibernate's
pooled optimizer already gives you the round-trip saving that `CACHE` exists for, and it
gives it to you at the JVM level where the increment is declared in the sequence and
checked at bootstrap. Adding a second, invisible blocking layer buys nothing and makes
the numbers harder to reason about.

The one thing `CACHE > 1` genuinely breaks is your ability to read the sequence's state:
"`last_value` will reflect the latest value reserved by any session, whether or not it
has yet been returned by `nextval`." So `last_value` is an upper bound, not a count. Any
migration that computes a safe starting point from `last_value` needs to know that.

## Reading a sequence's real configuration

Before writing a migration that changes `allocationSize`, look at what is actually there:

```sql
select sequencename, start_value, increment_by, cache_size, last_value
from pg_sequences
where schemaname = 'public';
```

`pg_sequences` is the readable view; `increment_by` is the number that must match your
`allocationSize`, and `cache_size` is PostgreSQL's own block size.

⛔ No output is shown here — there is no PostgreSQL on this machine and no query was run.
Run it on yours.

## The generator-name scope rule

The second PostgreSQL-adjacent surprise is not about PostgreSQL at all: it is about
whether two entities end up sharing one sequence.

The User Guide §3.7.9:

> The scope of the generator name can be controlled with the
> `hibernate.jpa.compliance.global_id_generators` configuration setting. With JPA
> compliance enabled, the name scope is global — i.e. there may not be two generator
> definitions with the same name. Historically, Hibernate ORM used a local scope — i.e.
> every managed type may have a generator with the same name, preferring the "local"
> definition over a more distant one.

That local scope is a feature, and the User Guide's example shows what it is for:

```java
@MappedSuperclass
@SequenceGenerator(name = "my-generator", sequenceName = "base_sequence")
public static abstract class BaseEntity {
    @Id
    @GeneratedValue(generator = "my-generator")
    private Long id;
}

@Entity(name = "Entity1")
public static class Entity1 extends BaseEntity { }

@Entity(name = "Entity2")
@SequenceGenerator(name = "my-generator", sequenceName = "sub_sequence")
public static class Entity2 extends BaseEntity { }
```

"In this case, `base_sequence` will be used when an `Entity1` is persisted, whereas for
persists of an `Entity2`, Hibernate ORM will use `sub_sequence`." A shared
`@MappedSuperclass` sets a default generator and a subclass overrides it just by reusing
the name.

The flip side is that **two unrelated entities that happen to use the same generator
name may or may not share a sequence, depending on a compliance flag.** Under the
historic local scope they get their own; under global scope, one definition wins for
both. Give generators distinct, entity-specific names and the question never arises.

The Introduction adds a third placement worth knowing: a `@SequenceGenerator` or
`@TableGenerator` may be put at **package** level, after which "any entity in this
package which specifies `strategy=SEQUENCE` or `strategy=TABLE` without also explicitly
specifying a generator name will be assigned a generator based on the package-level
annotation."

## Gotchas

**One sequence shared by every entity is a legitimate design and a common accident.**
Deliberately, it gives globally unique ids across tables, which is handy. Accidentally —
by everyone copying the same `generator = "seq_gen"` — it makes one sequence the
serialisation point for every insert in the application, and makes ids look sparse and
strange.

**`CACHE` and `allocationSize` are not the same knob and do not substitute for each
other.**
Setting `CACHE 50` and leaving `allocationSize` at 50 does not give you two levels of
saving; it gives you a mismatch between what Hibernate thinks the increment is and what
it is, which is the bootstrap exception from
[8](08-sequence-and-allocationsize.md).

**`last_value` is not "the highest id in use".**
With caching it is the highest value *reserved*, possibly by a session that will discard
it. A migration that does `setval(..., last_value)` after altering an increment is
working from an upper bound, which is safe; one that computes a starting point from
`max(id)` in the table is working from a lower bound, which is not, unless it adds
headroom.

**Sequences are owned, or not, and it matters at drop time.**
A sequence created by `serial`/`bigserial` or by an identity column is owned by that
column and is dropped with the table. A standalone `create sequence` in a Flyway
migration is not, and survives a `drop table` — which is how orphan sequences accumulate
and how a rerun migration hits "relation already exists".

**Renaming a table does not rename its implicit sequence.**
If you relied on the `<table>_seq` default and then renamed the table in a migration,
the mapping now looks for a sequence that does not exist. Naming the sequence explicitly
in `@SequenceGenerator` removes the coupling.

**A sequence's increment can be altered, but existing Hibernate blocks are already
issued.**
`alter sequence ... increment by 50` takes effect at the database. Any JVM currently
holding a block drawn under the old increment keeps handing out values from it. Change
the increment in a migration that runs before the new mapping is deployed, and accept a
window of gaps.

## Interview questions

**★ PostgreSQL sequences already have a `CACHE`. Why does Hibernate have `allocationSize` too?**
They solve the same problem at different layers and neither can see the other.
PostgreSQL's cache is per database *session*, so it saves work inside the server and is
lost when the connection closes. Hibernate's `allocationSize` is per JVM *process*, so it
saves the network round trip entirely — which is the expensive part — and it is declared
in the mapping where the application can reason about it. Because Hibernate's pooled
optimizer derives its block arithmetic from the sequence's declared increment, stacking
a database-side cache on top makes the two disagree about what a returned value means.
Leave `CACHE` at 1 when Hibernate owns the sequence.

**★ Can a PostgreSQL sequence give you gapless ids?**
No, and the manual says so directly: `nextval` and `setval` are never rolled back, so a
failed transaction still consumes its value. The manual's own suggested alternative is
an exclusively-locked counter table, and it points out that this "is much more expensive
than sequence objects, especially if many transactions need sequence numbers
concurrently" — which is precisely the trade `GenerationType.TABLE` makes. If you need a
gapless series, such as invoice numbers, it should be a separate concern from the primary
key, generated deliberately where you can pay for the serialisation.

**★ What does `last_value` on a sequence tell you?**
The highest value any session has *reserved*, not the highest that has been returned or
used. With a cache greater than 1 a session reserves a block and advances `last_value`
immediately, then serves the block from memory; if it disconnects, those values are gone.
So `last_value` is an upper bound on ids in use, which makes it safe to start a new
sequence above but useless as a row count.

**★ Two entities in different packages both declare a generator called `seq_gen`. Do they share a sequence?**
It depends on `hibernate.jpa.compliance.global_id_generators`. Hibernate's historic
behaviour is a *local* scope, where each managed type may have its own generator of that
name and the nearest definition wins; JPA-compliant behaviour is a *global* scope, where
two definitions with the same name are not permitted. The local scope exists for a good
reason — it lets a `@MappedSuperclass` define a default generator that a subclass
overrides just by reusing the name — but it means "same name" does not reliably mean
"same sequence". Use distinct names.

**★ You are moving from `ddl-auto: update` to Flyway on an existing database. What do you check about sequences?**
Read `pg_sequences` for every sequence Hibernate created and record `increment_by`,
`last_value` and `cache_size`, then write migrations that reproduce those exactly, so the
mapping's `allocationSize` still matches after the switch. Check ownership too: sequences
created behind `serial` or an identity column are owned by the column and dropped with
the table, whereas a sequence created by a migration is standalone — so a schema rebuild
behaves differently depending on which one you have.

**★ Why is `@SequenceGenerator` at package level useful?**
It sets a default for every entity in the package that asks for `strategy = SEQUENCE`
without naming a generator, which removes a repeated annotation from every class in a
module. It is the same idea as the `@MappedSuperclass` case: put the shared decision in
one place and let individual entities override it. The cost is invisibility — a reader
looking at the entity sees no generator and has to know to look in `package-info.java`.

---

← Prev: [8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md) · Index: [The JPA/Hibernate model](README.md) · Next → [9 · TABLE, AUTO and UUID](09-table-auto-uuid.md)
