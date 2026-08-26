---
title: "@Lob selects a JDBC API, not a column size — and on PostgreSQL that makes it the wrong annotation for almost every large column you will ever map"
sidebar_label: "5b · Large columns and @Lob"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §4.9 *Column lengths
> and adaptive column types* and §4.10 *LOBs*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §3.2.47 *Handling LOB data* and §3.2.18 *Clob /
> NClob*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the PostgreSQL 18 manual *Large Objects*
> ([postgresql.org/docs/18/largeobjects.html](https://www.postgresql.org/docs/18/largeobjects.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18, pgJDBC 42.7.x.

**Almost everyone learns `@Lob` as "put this on big columns". It is not that. It selects
which JDBC methods Hibernate uses, and on PostgreSQL those methods reach a completely
different storage facility from the `text` and `bytea` columns you probably meant. This
chunk is short because the correct answer is short: write a length, not a `@Lob`.**

## What `@Lob` really selects

This is the section where the internet is wrong and the primary source is unambiguous,
so read it before you copy a `@Lob` off a blog.

`@Lob` is not a size hint. The Hibernate Introduction §4.10 says what Hibernate actually
does with it: "an attribute annotated `@Lob` will be written to JDBC using the
`setClob()` or `setBlob()` method of `PreparedStatement`, and will be read from JDBC
using the `getClob()` or `getBlob()` method of `ResultSet`." It selects a *JDBC API*,
not a column size.

And it then points out that you rarely need that API: "JDBC drivers are perfectly
capable of converting between `String` and CLOB or between `byte[]` and BLOB. So unless
you specifically need to use these JDBC LOB APIs, you don't need the `@Lob` annotation."

🔴 **On PostgreSQL the annotation is actively wrong for ordinary large columns.**
The Introduction's conclusion, verbatim:

> - on PostgreSQL, `@Lob` always means the OID type,
> - `@Lob` should never be used to map columns of type BYTEA or TEXT, and
> - please don't believe everything you read on stackoverflow.

PostgreSQL's `oid` large-object facility stores data out of line in `pg_largeobject`
with a handle in your column. It is a different storage model from `text`/`bytea`, with
different backup, permission and deletion behaviour. Meanwhile the PostgreSQL JDBC
driver "doesn't allow BYTEA or TEXT columns to be read via the JDBC LOB APIs" — which is
the origin of the whole genre of blog posts recommending dialect hacks. The
documentation's answer to all of them is one line: "simply removing the `@Lob`
annotation has exactly the same effect."

**What to write instead: a length.** Hibernate adapts the generated column type to the
length you ask for, and `org.hibernate.Length` gives you the constants:

| Constant | Value | Meaning |
|---|---|---|
| `DEFAULT` | 255 | default `VARCHAR`/`VARBINARY` length |
| `LONG` | 32600 | largest `VARCHAR`/`VARBINARY` allowed on every database Hibernate supports |
| `LONG16` | 32767 | the 16-bit maximum |
| `LONG32` | 2147483647 | the maximum length of a Java `String` |

```java
import static org.hibernate.Length.LONG32;

@Column(length = LONG32)     // good: correct column type inferred
private String articleBody;

@Column(length = LONG32)
private byte[] thumbnail;
```

The Introduction is explicit that this is the normal route: "This is usually all you
need to do to make use of large object types in Hibernate," and it shows exactly this
pair — `@Column(length=LONG32) String text;` — as the thing to write "instead of"
`@Lob`, which it labels "almost always unnecessary".

**When `@Lob`, or a locator, is genuinely right.** The User Guide §3.2.47 draws the
distinction between a **LOB locator** (`java.sql.Blob`/`Clob`/`NClob`), which is a
reference to off-table data that a driver may stream, and a **materialized LOB**
(`String`, `char[]`, `byte[]`), which "requires materializing the entire contents of the
LOB in memory when the object is first retrieved." Its verdict on the annotation matches
the Introduction's: "The `@Lob` annotation is a special-purpose tool that should only be
used when a default basic mapping to `String` would result in unacceptable performance
characteristics."

A locator has a hard limitation worth knowing before you reach for one: "it's not
portable to access a LOB locator after the end of the transaction in which it was
obtained." So a `Clob` field on a detached entity is not usable.

⚠️ **Whichever you choose, a materialized large column is loaded eagerly by
default.** Every `find` of that entity pulls the whole article body across the wire,
even for a listing page that shows only a title. `@Basic(fetch = LAZY)` is the direct
expression of the fix but needs bytecode enhancement to work at all (see
[3 · Fields, columns, access](03-fields-columns-access.md)); moving the column into its
own entity works unconditionally.

## Gotchas

**On PostgreSQL, `@Lob` means the `oid` type — not `text`, not `bytea`.**
If a Flyway migration creates a `text` column and the entity says `@Lob String`, the
mapping and the schema disagree, and the pgJDBC driver will not read a `text` column
through the JDBC LOB API at all. The fix is to delete the annotation and set
`@Column(length = LONG32)`.

**Every dialect-hacking recipe you will find for "Hibernate `@Lob` on PostgreSQL" is
solving a self-inflicted problem.**
The Hibernate documentation says as much, and offers the one-line alternative: remove
the annotation. Recognising this saves an afternoon.

**A `@Lob` column you also filter on is not a LOB.**
Large-object columns index poorly and their comparison semantics vary by database. If
your queries have `where article_body like ...`, you want a `varchar`/`text` column with
an appropriate index, not a large object.

**A materialized large column is eager by default and there is no cheap fix.**
`@Basic(fetch = LAZY)` needs bytecode enhancement or it is silently ignored — see
[3 · Fields, columns, access](03-fields-columns-access.md). Moving the column to its own
entity always works, at the cost of an association; that association's fetch behaviour
is **Topic 07 · Relationships and fetch types** *(not written yet)*, and the query-count
consequence of getting it wrong is **Topic 08 · The N+1 problem** *(not written yet)*.

**A `java.sql.Clob` or `Blob` is not usable after its transaction ends.**
The User Guide: "it's not portable to access a LOB locator after the end of the
transaction in which it was obtained." So a locator on a detached entity returned from a
service method is a runtime failure waiting for the controller to touch it.

**Assigning to a locator field needs `LobHelper`, not `new`.**
There is no public constructor for a `Clob`. Hibernate's `Session` supplies one:
`session.getLobHelper().createClob(text)`. Code that tries to build one directly does
not compile, which at least is a good failure.

**`@Column(length = ...)` shapes generated DDL only.**
On a migration-managed schema the length is inert at runtime; the column type is
whatever your migration created. The annotation still earns its place as documentation
and as the thing `ddl-auto: validate` checks against — see
**17 · `ddl-auto`** *(not written yet)*.

**Deleting a row does not necessarily delete a PostgreSQL large object.**
This is the operational cost of the `oid` model: the large object lives in
`pg_largeobject` and the row holds only a handle, so orphaned objects accumulate unless
something unlinks them. It is one more reason not to end up on `oid` by accident.

## Interview questions

**★ What does `@Lob` actually do, and should you use it on PostgreSQL?**
It selects a JDBC API rather than a column size: Hibernate writes the attribute with
`PreparedStatement.setClob()`/`setBlob()` and reads it with
`ResultSet.getClob()`/`getBlob()`. On PostgreSQL that means the `oid` large-object type,
which stores the data out of line in `pg_largeobject` — and the PostgreSQL JDBC driver
will not read a `text` or `bytea` column through those APIs at all. So on PostgreSQL,
`@Lob` on a column you intended to be `text` or `bytea` is simply the wrong mapping. The
Hibernate documentation says so directly and adds that the endless blog posts hacking
the dialect around it are unnecessary, because removing the annotation has the same
effect. The right mapping is a length: `@Column(length = LONG32)`, from which Hibernate
infers the correct column type.

**★ What is the difference between a LOB locator and a materialized LOB?**
A locator — `java.sql.Blob`, `Clob` or `NClob` — is a reference to data that stays in the
database; the driver may stream it on demand, which can use much less memory, and it can
in principle address far more data than fits in a Java `String`. A materialized mapping —
`String`, `char[]`, `byte[]` — reads the whole value into memory when the entity is
loaded. The locator's price is awkwardness and a hard portability limit: it is not
portable to use one after the transaction that produced it has ended, so a locator on a
detached entity is unusable.

**★ How do you map a large text column properly in Hibernate 7?**
With a length, not an annotation about size. `@Column(length = LONG32)` — using the
constants in `org.hibernate.Length` — and Hibernate adapts the generated column type to
suit. `Length` defines `DEFAULT` (255), `LONG` (32600, the largest `VARCHAR` allowed on
every database Hibernate supports), `LONG16` (32767) and `LONG32` (2147483647, the
maximum length of a Java `String`). The Introduction calls this "usually all you need to
do to make use of large object types in Hibernate".

**★ When is `@Lob` the right annotation?**
When you actually want the JDBC LOB APIs — because you are mapping to a database whose
large-object type genuinely needs them, or because a materialized `String` mapping has
unacceptable memory or performance characteristics and you intend to stream through a
locator. The User Guide frames it exactly that way: a special-purpose tool for when "a
default basic mapping to `String` would result in unacceptable performance
characteristics". On PostgreSQL it is almost never the answer for a `text` or `bytea`
column.

**★ Why does a large column hurt a listing endpoint even when the listing doesn't show it?**
Because a basic attribute is fetched eagerly by default, so every `find` or query that
returns the entity selects the column and pulls its full contents across the connection.
Loading a page of fifty entities to render fifty titles also transfers fifty article
bodies. The direct fix, `@Basic(fetch = LAZY)`, is optional in JPA and only honoured by
Hibernate with bytecode enhancement enabled, so the dependable fix is structural: put the
large column in its own entity, or stop loading entities for read-only listings and
select a projection instead.

---

← Prev: [5 · Embeddables and converters](05-embeddables-lobs-converters.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [6 · The identifier](06-the-identifier.md)
