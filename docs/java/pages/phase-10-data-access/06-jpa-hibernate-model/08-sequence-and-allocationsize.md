---
title: "allocationSize is not a tuning knob — it is a contract between your mapping and your DDL, and Hibernate 7 throws at startup when the two disagree"
sidebar_label: "8 · SEQUENCE and allocationSize"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.7.9 *Using sequences*
> and §3.7.13 *Optimizers*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §3.5 *Generated identifiers*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Hibernate ORM 7.4 source for `OptimizableGenerator`, `SequenceStyleGenerator`,
> `OptimizerFactory` and `SequenceMismatchStrategy`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/tree/7.4/hibernate-core/src/main/java/org/hibernate/id)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**`allocationSize` is widely read as "how many ids Hibernate grabs at a time", which is
true and dangerously incomplete. Hibernate does not merely *use* the number — it
*assumes the database sequence was declared with the same increment*, and it hands out
values in the gaps between what the sequence returns. If the sequence says `increment by
1` and your mapping says 50, every id Hibernate invents in between is one the database
will hand out again later. Hibernate 7 defends against this by default, and the defence
is an exception at startup, not a warning.**

## The simple form first

```java
@Entity
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;
}
```

No sequence is named. The User Guide explains the default: "Hibernate will assume a
sequence name based on the name of the table to which the entity is mapped. Here, since
the entity is mapped to a table named `product`, Hibernate will use a sequence named
`product_seq`."

⚠️ Under Spring Boot the *table* name has already been snake-cased by
`PhysicalNamingStrategySnakeCaseImpl`, and that strategy applies to sequence names too —
see [2 · `@Entity` and `@Table`](02-entity-and-table.md). So an entity `OrderLine`
mapped to `order_line` looks for `order_line_seq`.

To name it explicitly, the shortest form is `@GeneratedValue#generator`:

```java
@Id
@GeneratedValue(strategy = SEQUENCE, generator = "explicit_product_sequence")
private Long id;
```

and the fully-specified form is JPA's `@SequenceGenerator`:

```java
@Id
@GeneratedValue(strategy = SEQUENCE, generator = "product_gen")
@SequenceGenerator(name = "product_gen",
                   sequenceName = "product_seq",
                   initialValue = 1,
                   allocationSize = 50)
private Long id;
```

## What `allocationSize` really means

Here is the mechanism, and it is worth reading twice.

Hibernate calls `nextval` on the sequence and treats the returned number as the
**boundary of a block of `allocationSize` values**. It then hands out every value in
that block from memory, without touching the database again, until the block is
exhausted.

The User Guide §3.7.13 describes the two block-based optimizers:

> **pooled-lo** — the increment-value is encoded into the database table/sequence
> structure. […] consider a brand new sequence defined as `create sequence m_sequence
> start with 1 increment by 20`. This sequence essentially defines a "pool" of 20 usable
> id values each and every time we ask it for its next-value. The pooled-lo optimizer
> interprets the next-value as the low end of that pool. So when we first ask it for
> next-value, we'd get 1. We then assume that the valid pool would be the values from
> 1-20 inclusive. The next call to the sequence would result in 21, which would define
> 21-40 as the valid range.
>
> **pooled** — Just like pooled-lo, except that here the value from the table/sequence is
> interpreted as the high end of the value pool.

The sentence that carries the whole risk is the first one: **the increment value is
encoded into the sequence itself.** Hibernate's block arithmetic is only sound if the
sequence really does advance by that much.

The Introduction states the benefit and the cost in one breath: "Hibernate doesn't have
to go to the database every time a new identifier is needed. Instead, a given process
obtains a block of ids, of size `allocationSize`, and only needs to hit the database each
time the block is exhausted. Of course, the downside is that generated identifiers are
not contiguous."

## The defaults, read from the source

Three numbers that are worth knowing exactly rather than approximately.

**The default allocation size is 50.** Not 1. `OptimizableGenerator` declares
`DEFAULT_INCREMENT_SIZE = 50`, and `SequenceStyleGenerator` uses it when no
`allocationSize` is given. `jakarta.persistence.SequenceGenerator#allocationSize` also
defaults to 50.

**The default initial value is 1** (`DEFAULT_INITIAL_VALUE = 1`).

**The optimizer is chosen from the increment size.** `OptimizerFactory` decides:

```java
public static String determineImplicitOptimizerName(int incrementSize, Properties configSettings) {
    if ( incrementSize <= 1 ) {
        return StandardOptimizerDescriptor.NONE.getExternalName();
    }
    else {
        // see if the user defined a preferred pooled optimizer
        final String preferredPooledOptimizerStrategy =
                configSettings.getProperty( PREFERRED_POOLED_OPTIMIZER );
        return isNotEmpty( preferredPooledOptimizerStrategy )
                ? preferredPooledOptimizerStrategy
                : StandardOptimizerDescriptor.POOLED.getExternalName();
    }
}
```

So `allocationSize = 1` means the `none` optimizer — one database round trip per
identifier, contiguous ids. Anything above 1 means `pooled`, unless
`hibernate.id.optimizer.pooled.preferred` names another. And with `none`,
`determineAdjustedIncrementSize` clamps any increment above 1 back down to 1, logging
that it is honouring the optimizer setting.

The `hilo` and `legacy-hilo` optimizers still exist; the User Guide says they "are not
recommended for use. They are maintained (and mentioned) here simply for use by legacy
applications."

## The mismatch check, and why it throws

This is the part almost nobody knows, and it is the reason a perfectly reasonable
migration can stop an application from starting.

`SequenceStyleGenerator` reads the *actual* increment of the sequence out of the database
at bootstrap and compares it with the `allocationSize` in your mapping. What happens on
disagreement is governed by `hibernate.id.sequence.increment_size_mismatch_strategy`,
whose values are:

| Strategy | Behaviour |
|---|---|
| `LOG` | logs the offending sequence and carries on |
| `EXCEPTION` | throws a `MappingException` naming the sequence |
| `FIX` | overrides the mapping with the increment found in the database |
| `NONE` | skips the check entirely, which also skips querying the sequences at bootstrap |

🔴 **The default is `EXCEPTION`.** The User Guide's settings appendix (A.6.13) records
it verbatim — "Default Value: `SequenceMismatchStrategy.EXCEPTION`, meaning that an
exception is thrown when such a conflict is detected" — and the source agrees:
`SequenceMismatchStrategy.interpret(null)` returns `EXCEPTION`. The check runs when the
optimizer is pooled and the structure is a real sequence, which is exactly the
configuration most people end up in.

**This is Hibernate protecting you from silent duplicate keys**, and it is the right
default. Consider the mapping saying `allocationSize = 50` against a sequence created
with `increment by 1`:

- Hibernate calls `nextval`, gets `1`, and assumes it owns 1…50.
- It hands out 1, 2, 3, … from memory.
- The database's counter is still at 1. Another process — or your own next block
  request — calls `nextval` and gets `2`.

Two rows now claim the same identifier, and the failure surfaces as a unique-constraint
violation on the primary key at some unrelated later point. The startup exception is far
kinder.

## Getting the DDL and the mapping to agree

```sql
-- Flyway migration
create sequence product_seq start with 1 increment by 50;
```

```java
@SequenceGenerator(name = "product_gen", sequenceName = "product_seq",
                   initialValue = 1, allocationSize = 50)
```

The Introduction says it directly: "if you're working with a database schema managed
outside Hibernate, make sure the `initialValue` and `allocationSize` members of
`@SequenceGenerator` match the `start with` and `increment` specified in the DDL." When
Hibernate generates the schema itself it gets this right automatically — which is
precisely why the problem only appears once you move to Flyway, and why it appears as a
surprise.

Continued in
[8b · Sequences on PostgreSQL](08b-sequence-on-postgres.md), which covers what
PostgreSQL 18 actually does with a sequence, and the generator-scoping rule that decides
whether two entities share one.

## Gotchas

**`allocationSize` defaults to 50, so "I did not configure it" does not mean "it is 1".**
Every `@GeneratedValue(strategy = SEQUENCE)` without an explicit `allocationSize` is
already pooling in blocks of 50 and already assuming the sequence increments by 50.

**Ids will have gaps, and that is correct behaviour.**
A restart, a rollback, or a second instance all abandon the unused remainder of a block.
Ids are unique, not contiguous. Any process that counts rows by subtracting ids, or reads
"id 1000" as "the thousandth row", was already broken — rollbacks consume sequence values
on every database.

**`increment by 1` in the DDL with the default mapping is the classic Flyway collision.**
Someone writes `create sequence product_seq;` — PostgreSQL's default increment is 1 — and
the mapping silently expects 50. Under Hibernate 7's default that is a startup exception
naming the sequence; under `LOG`, or an older version, it is duplicate keys in production.

**`FIX` looks like the convenient answer and hides a real disagreement.**
It makes the mapping follow the database, so an application configured with
`allocationSize = 50` quietly runs with 1 and does 50× the round trips. Fix the DDL.

**`allocationSize = 1` costs a round trip per insert.**
It gives you contiguous ids, which people occasionally want for auditing reasons. It
also selects the `none` optimizer, so every single `persist` calls `nextval`. On a
high-insert table that is a real cost, and the auditing benefit is usually better served
by a separate, explicitly gapless sequence.

**Two entities can end up sharing one generator by accident.**
Generator names have a scope, and Hibernate's historic scope is local rather than global.
That is [8b](08b-sequence-on-postgres.md)'s subject, and it is worth reading before you
reuse a generator name.

**Changing `allocationSize` in a running system needs both sides changed together.**
Deploy a mapping with a new allocation size against the old sequence increment and you
get the mismatch exception on the first instance that restarts. Alter the sequence in a
migration that ships in the same release.

**A sequence value is consumed even if the transaction rolls back.**
Sequences are deliberately non-transactional — that is what lets concurrent transactions
draw from one without blocking. An id is therefore not proof of a successful insert.

## Interview questions

**★ What does `allocationSize` control?**
The size of the block of identifiers Hibernate claims from the sequence on each round
trip. It calls `nextval` once and then serves that many values from memory before going
back. But it is not only a client-side hint: Hibernate assumes the sequence itself was
declared with a matching increment, because the block arithmetic is derived from the
returned value. If the two disagree, Hibernate hands out values the database will hand
out again.

**★ What is the default `allocationSize`, and why does that surprise people?**
50 — both in `jakarta.persistence.SequenceGenerator` and in Hibernate's own
`OptimizableGenerator.DEFAULT_INCREMENT_SIZE`. It surprises people because a
hand-written `create sequence` defaults to `increment by 1` on PostgreSQL, so the two
defaults are incompatible with each other. A mapping that specifies nothing and a
migration that specifies nothing are already in conflict.

**★ What happens when the mapping and the sequence disagree in Hibernate 7?**
By default, a `MappingException` at bootstrap naming the sequence. The behaviour is
controlled by `hibernate.id.sequence.increment_size_mismatch_strategy`, whose options are
`LOG`, `EXCEPTION`, `FIX` and `NONE`, and whose default is `EXCEPTION`. The check runs
when the optimizer is pooled and the structure is a real sequence. Failing at startup is
the desirable outcome, because the alternative is duplicate primary keys appearing later
under concurrency.

**★ Why are ids generated by a pooled sequence not contiguous?**
Because a process claims a block and abandons whatever it has not used when it stops.
Restart the application with 30 of 50 values unused and those 30 are gone. Sequences also
advance on transactions that later roll back, since they are deliberately
non-transactional so that concurrent inserters do not block each other. Gaps are normal
and no application logic should depend on their absence.

**★ What is the difference between the `pooled` and `pooled-lo` optimizers?**
Only how the value returned by the sequence is interpreted. `pooled-lo` treats it as the
*low* end of the block — `nextval` returns 1, so the block is 1 to 20 for an increment of
20. `pooled` treats it as the *high* end. Hibernate's implicit choice for an increment
greater than 1 is `pooled`; `hibernate.id.optimizer.pooled.preferred` can change it. The
distinction matters most when a legacy sequence's current value has to line up with
existing data.

**★ When would you set `allocationSize = 1`?**
When you need identifiers with no gaps, or when you are sharing a sequence with a
non-Hibernate writer that assumes `increment by 1`. Be clear about the price: it selects
the `none` optimizer, so every `persist` makes its own `nextval` round trip, which is a
measurable cost on an insert-heavy table. And it does not actually guarantee gaplessness,
because a rolled-back transaction still consumes the value it drew.

**★ Why does this problem only appear when you adopt Flyway?**
Because when Hibernate generates the schema it emits the sequence with the increment its
own mapping expects, so the two can never disagree. As soon as a migration tool owns the
DDL, the two are written by different people at different times from different defaults,
and nothing ties them together except the mismatch check at bootstrap — which is exactly
why that check exists and why its default is to throw.

---

← Prev: [7b · IDENTITY kills batching](07b-identity-kills-batching.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [8b · Sequences on PostgreSQL](08b-sequence-on-postgres.md)
