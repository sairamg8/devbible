---
title: "IDENTITY disables JDBC batching for that entity, and no configuration setting will bring it back — this is the single most consequential default in the topic"
sidebar_label: "7b · IDENTITY kills batching"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.7.10 *Using IDENTITY
> columns* and §13.1 *JDBC batching*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §8.3 *Enabling statement batching*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the `java.sql.Statement#addBatch`/`executeBatch` javadoc for JDK 25
> ([docs.oracle.com/en/java/javase/25/docs/api/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18, pgJDBC 42.7.x.

**Someone adds `spring.jpa.properties.hibernate.jdbc.batch_size=50` to fix a slow bulk
import. Nothing changes. They increase it to 500. Still nothing. The reason is not
configuration and it is not the pool — it is that the entity's identifier strategy is
`IDENTITY`, which makes batching structurally impossible. The User Guide states it in
one sentence, and that sentence is worth more than most performance tuning advice you
will read.**

## The sentence

Hibernate ORM 7.4 User Guide §3.7.10:

> There is yet another important runtime impact of choosing IDENTITY generation:
> **Hibernate will not be able to batch INSERT statements for the entities using the
> IDENTITY generation.**

Not "batching is less effective". Not "you should tune it". It cannot be done.

And §13.2 supplies the word that explains why nobody notices: "Hibernate disables insert
batching at the JDBC level **transparently** if you use an identity identifier
generator." Transparently means no warning, no log line, no failure — the setting is
accepted and quietly does nothing.

## Why it cannot be done — the JDBC mechanism

Batching in JDBC means: build one `PreparedStatement`, call `addBatch()` once per row,
then `executeBatch()` to send them together. One network round trip carries many rows.
This is exactly the mechanism covered in
[Topic 01 · JDBC](../01-jdbc/README.md), and Hibernate is doing nothing exotic on top
of it.

Now line that up against `IDENTITY`'s constraint. From
[7 · IDENTITY](07-generatedvalue-identity.md): "the entity row must be physically
inserted prior to the identifier value being known", and the identifier is needed
*immediately*, because a managed entity has to be filed in the persistence context under
its key.

So the sequence Hibernate needs is:

```
persist(a) → INSERT a → read a's key → file a in the persistence context
persist(b) → INSERT b → read b's key → file b in the persistence context
```

Batching would require deferring all the INSERTs to flush and then reading the keys
back afterwards. But `persist(a)` has to return with `a` managed and keyed, and `a` may
be referenced by `b` before flush ever happens. The dependency is real, not an
implementation shortcut.

## Why `SEQUENCE` does not have the problem

A sequence is an independent counter. Hibernate can ask it for values *before* writing
anything:

```
persist(a) → next value from sequence → assign to a → file a → QUEUE the insert
persist(b) → next value from sequence → assign to b → file b → QUEUE the insert
...
flush()    → one PreparedStatement, addBatch() × N, executeBatch()
```

Every entity is fully identified and fully managed the moment `persist` returns, and no
row has been written. At flush, the whole set goes out together. And with a pooled
optimizer — [8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md) —
Hibernate does not even hit the database once per value; it draws a block and hands out
values from memory.

The same reasoning applies to `TABLE` and `UUID`: both produce the identifier without
inserting the row, so both keep batching available. `IDENTITY` is the exception.

## What batching is worth, and where the number comes from

Turning batching on is one property. The Introduction §8.3:

> An easy way to improve performance of some transactions, with almost no work at all,
> is to turn on automatic DML statement batching. Batching only helps in cases where a
> program executes many inserts, updates, or deletes against the same table in a single
> transaction. All we need to do is set a single property: `hibernate.jdbc.batch_size`.

In Spring Boot that is:

```properties
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
```

The User Guide's own sizing advice is "an integer between 10 and 50", and it notes that
"zero or a negative number disables this feature".

The two `order_*` settings matter more than they look. Batching requires *consecutive*
statements against the same table; interleaved inserts into two tables break the batch
into fragments, and ordering groups them. `hibernate.order_updates` additionally "orders
SQL updates by the entity type and the primary key value of the items being updated",
which the User Guide says "will also result in fewer transaction deadlocks in highly
concurrent systems" — a real benefit independent of batching, since consistent lock
ordering is what prevents two transactions from deadlocking on the same pair of rows.

⚠️ Neither is free. The User Guide attaches the same caveat to both: ordering "comes with
a performance hit, so benchmark before and after to see if this actually helps or hurts
your application." Sorting statements costs CPU and memory in proportion to how many are
pending.

⛔ **No number is quoted here for what batching saves, because there is no PostgreSQL on
this machine and no run happened.** What can be said without measuring is the shape:
unbatched, each INSERT is its own network round trip, so the cost is dominated by
latency × row count; batched, the round trips are divided by the batch size. On a
low-latency connection the saving is modest; across a network it is the difference
between an import that finishes and one that does not. Measure it on your own system —
and note that the "before" and "after" must differ *only* in batching, which is the
trap [Topic 01 · JDBC](../01-jdbc/README.md) covers.

To see whether batching is actually happening, the Introduction names the switch:
"To confirm that statement batching is working, enable TRACE-level logging for the
category `org.hibernate.orm.jdbc.batch`." Turning that on is fine; reproducing its
output here is not — see [18 · Seeing what Hibernate
does](18-seeing-what-hibernate-does.md).

## What to do about it

**If you control the schema: use `SEQUENCE`.** It is the strategy Hibernate itself
suggests when `IDENTITY`'s behaviour is inconvenient, and on PostgreSQL a sequence is
native, cheap and transactionally independent.

**If bulk insert is the actual problem, consider not using entities at all.** The
Introduction, immediately after explaining batching, adds: "batching is rarely the most
convenient or most efficient way to update or delete many rows at once. Even better
than DML statement batching is the use of HQL update or delete queries, or even native
SQL that calls a stored procedure!" For a large import, plain JDBC batching or
PostgreSQL's `COPY` — both in [Topic 01 · JDBC](../01-jdbc/README.md) — will beat any
ORM path, and Hibernate's own `StatelessSession` sits between the two.

**Do not clear the persistence context and call it a fix.** Periodically calling
`flush()` and `clear()` during a long loop is good advice for *memory* — it stops the
context accumulating thousands of managed entities and their snapshots, which is
[14e · What dirty checking costs](14e-what-dirty-checking-costs.md). It does nothing
about `IDENTITY`, because the INSERTs already happened at `persist`.

## Gotchas

**The batch size property is silently inert under `IDENTITY`.**
No warning, no log line, no error. The setting is accepted and has no effect on that
entity. This is why the problem survives so long: every visible signal says the
configuration is correct.

**Batching is per-entity, not per-application.**
One `IDENTITY` entity in a graph does not disable batching for the others. An import
that writes `Order` (SEQUENCE) and `OrderLine` (IDENTITY) batches the orders and not the
lines, which produces a confusing half-improvement when someone changes only one of
them.

**`order_inserts` off means the batch fragments.**
Inserting order, line, order, line breaks into single-statement batches even when every
entity uses `SEQUENCE`, because consecutive statements must target the same table.
Setting `hibernate.order_inserts=true` is what makes the batch size meaningful.

**Batching and `IDENTITY` also interact badly with generated keys in a batch.**
Even where a driver supports retrieving generated keys from a batch, Hibernate's model
still needs the key at `persist` time, not at `executeBatch` time. The JDBC-level
question — what a driver returns from a batch — is covered in
[Topic 01 · JDBC](../01-jdbc/README.md); it does not rescue the JPA case.

**A batch does not reduce the number of statements the database plans and executes.**
It reduces round trips. The server still inserts N rows, still updates N index entries,
still fires N triggers. Batching is a network optimisation, and framing it as "one
statement instead of many" leads people to expect savings that are not there.

**Switching to `SEQUENCE` for batching, without setting `allocationSize`, buys less than
you think.**
The default allocation size is 50, so Hibernate draws a block of 50 and hands out values
from memory — good. But if the migration created the sequence with `increment by 1`
while the mapping expects 50, Hibernate 7 does not quietly cope: by default it throws at
bootstrap. That is [8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md).

## Interview questions

**★ Why does `IDENTITY` prevent Hibernate from batching INSERTs?**
Because JDBC batching means accumulating statements and executing them together, while
`IDENTITY` means the identifier only exists once the row has been inserted — and
Hibernate needs the identifier at `persist` time, not at flush time, in order to file the
entity in the persistence context under its key. You cannot both defer the INSERT and
have its generated key immediately. The User Guide states the outcome flatly: Hibernate
"will not be able to batch INSERT statements for the entities using the IDENTITY
generation."

**★ A colleague sets `hibernate.jdbc.batch_size=100` and reports no improvement. How do you diagnose it?**
Check the identifier strategy of the entity being inserted first — if it is `IDENTITY`,
or `AUTO` resolving to something you have not verified, the setting is inert for that
entity and no amount of tuning will change it. If the strategy is `SEQUENCE`, check
`hibernate.order_inserts`, because batching requires consecutive statements against the
same table and an interleaved graph fragments the batch. Then confirm empirically by
enabling TRACE logging on `org.hibernate.orm.jdbc.batch`, which reports what Hibernate is
actually doing rather than what it was configured to do.

**★ Does batching reduce the work the database does?**
No — it reduces network round trips. The server still executes each statement, maintains
each index, and fires each trigger. That is why the benefit scales with connection
latency rather than with row count alone, and why a batch of 1000 on a local socket may
be barely distinguishable from unbatched while the same batch across a WAN is
transformative.

**★ Why doesn't `flush()` plus `clear()` in a loop fix `IDENTITY`'s batching problem?**
Because there is nothing left to flush. Under `IDENTITY` each `persist` has already
executed its INSERT, so the flush has no queued insert actions to combine. `flush()` and
`clear()` are still worth doing in a long loop — they stop the persistence context
accumulating managed entities and their dirty-checking snapshots, which is a memory and
CPU problem — but they address a different failure.

**★ You have to insert a million rows. What do you actually reach for?**
Not the entity model, in most cases. Hibernate's own documentation says batching "is
rarely the most convenient or most efficient way to update or delete many rows at once"
and points at HQL bulk statements, native SQL, or a stored procedure. For a genuine bulk
load on PostgreSQL, `COPY` through the JDBC driver beats every row-at-a-time path by a
wide margin. If you must go through Hibernate, a `StatelessSession` avoids the
persistence context entirely — no identity map, no snapshots, no dirty checking — which
removes the memory problem as well as the batching one.

**★ Does `TABLE` generation have the same batching problem?**
No. `TABLE` produces the identifier by reading and updating a counter row, entirely
independently of inserting the entity's own row, so Hibernate can assign the id at
`persist` and still defer the INSERT to flush. Batching is preserved. `TABLE`'s problems
are different ones — contention on the counter row, and an extra statement per block —
which is [9 · TABLE, AUTO and UUID](09-table-auto-uuid.md).

---

← Prev: [7 · @GeneratedValue and IDENTITY](07-generatedvalue-identity.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [8 · SEQUENCE and allocationSize](08-sequence-and-allocationsize.md)
