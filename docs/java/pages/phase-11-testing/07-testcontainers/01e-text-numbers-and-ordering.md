---
title: "Text, numbers, the types H2 simply does not have, and the sort-order defaults that are exact opposites — the divergences that only appear on data your fixture did not contain"
sidebar_label: "01e · Text, numbers, ordering"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *Data Types*
> ([datatypes.html](https://www.h2database.com/html/datatypes.html)), *Commands →
> `SET DEFAULT_NULL_ORDERING`* and *→ `SET COLLATION`*
> ([commands.html](https://www.h2database.com/html/commands.html)) and *Features → Compatibility*
> ([features.html](https://www.h2database.com/html/features.html)) — and the **PostgreSQL 18
> manual**: *Character Types*
> ([datatype-character](https://www.postgresql.org/docs/18/datatype-character.html)), *Sorting
> Rows* ([queries-order](https://www.postgresql.org/docs/18/queries-order.html)) and *Collation
> Support* ([collation](https://www.postgresql.org/docs/18/collation.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing or a test run.

**[01d](01d-the-types-you-query-with.md) covered the types where the column holds a structure.
This page covers the ones you never think about — a string, a number, a sort — and that is
precisely why they are dangerous. Nobody reviews a `varchar` column or an `ORDER BY` clause for
portability. The default null ordering of the two engines is *exactly opposite*, an unqualified
`NUMERIC` is not the same type on both, and text sort order is not even stable between two
PostgreSQL instances. All three only show themselves on data a tidy fixture does not contain.**
## Text and numbers

### `TEXT`, `VARCHAR` and `CLOB`

PostgreSQL's advice is blunt:

> *"There is no performance difference among these three types, apart from increased storage
> space when using the blank-padded type… In most situations `text` or `character varying`
> should be used instead."*

`text` is unlimited and idiomatic. **H2's documented data type list contains no `TEXT` at all.**
Its three character types are `CHARACTER`, `CHARACTER VARYING` (max 1,000,000,000 characters,
*"The whole text is loaded into memory when using this data type"*) and `CHARACTER LARGE OBJECT`,
which is *"Mapped to `java.sql.Clob`"* and streamed.

So a `@Lob String` field is not the same physical column on the two engines: on H2 it is a CLOB
whose JDBC type is `java.sql.Clob`, and on PostgreSQL `text` is an ordinary string column.

⚠️ **What I could not confirm:** which physical type Hibernate 7's `PostgreSQLDialect` assigns to
a `@Lob String` on Boot 4.1 — the historical answer (a large-object `oid`) changed at some point
in the Hibernate 6 line and I found no statement in the Hibernate 7 documentation settling it.
What *is* settled is that H2 maps its own large character type to `java.sql.Clob` and PostgreSQL
`text` is not that, which is enough to know the two columns are not the same column. Check the
generated DDL on the engine you deploy rather than trusting either answer.

### `NUMERIC` and the money arithmetic you thought you tested

Read the PostgreSQL-mode bullet again with money in mind:

> *"`NUMERIC` and `DECIMAL`/`DEC` data types without parameters are treated like `DECFLOAT` data
> type."*

An unqualified `NUMERIC` column — which is what you write when you want arbitrary precision — is
not an arbitrary-precision exact type on H2-in-PostgreSQL-mode. It is `DECFLOAT`, a decimal
*floating* type, and the scale that comes back through `getBigDecimal` is not the scale
PostgreSQL would have given you.

And a second bullet, which is a difference between H2 and *itself*:

> *"When converting a floating point number to an integer, the fractional digits are not be
> truncated, but the value is rounded."*

In H2's REGULAR mode that conversion truncates. Switching the mode changes the answer of
`CAST(2.7 AS INT)` from 2 to 3. If a compatibility mode can change an arithmetic result inside
one engine, it is not a thin shim over dialect syntax.

`MONEY` gets the same treatment — *"`MONEY` data type is treated like `NUMERIC(19, 2)` data
type"* — where PostgreSQL's `money` is a distinct type whose output formatting depends on
`lc_monetary`.

### Types PostgreSQL has that H2's documented list does not name at all

H2's data type index is short enough to check exhaustively: `CHARACTER`, `CHARACTER VARYING`,
`CHARACTER LARGE OBJECT`, `VARCHAR_IGNORECASE`, `BINARY`, `BINARY VARYING`, `BINARY LARGE
OBJECT`, `BOOLEAN`, `TINYINT`, `SMALLINT`, `INTEGER`, `BIGINT`, `NUMERIC`, `REAL`, `DOUBLE
PRECISION`, `DECFLOAT`, `DATE`, `TIME`, `TIME WITH TIME ZONE`, `TIMESTAMP`, `TIMESTAMP WITH TIME
ZONE`, `INTERVAL`, `JAVA_OBJECT`, `ENUM`, `GEOMETRY`, `JSON`, `UUID`, `ARRAY`, `ROW`.

Not on it, and therefore not available under any mode: `jsonb` · `inet`, `cidr`, `macaddr` ·
the range and multirange types (`int4range`, `tsrange`, `daterange` and friends) · `tsvector` and
`tsquery` · `xml` · `citext` (H2's nearest relative is `VARCHAR_IGNORECASE`, a different name
with different semantics) · `hstore` · `money` outside PostgreSQL mode · `bytea` (H2 spells the
concept `BINARY VARYING`).

**The test that passes anyway:** none of them, individually — these are false reds. Collectively
they are the reason a project's schema drifts toward the intersection type system, and *that*
degradation is invisible.


## NULL ordering and collation

### `NULLS FIRST` / `NULLS LAST` — the defaults are exact opposites

PostgreSQL 18:

> *"The `NULLS FIRST` and `NULLS LAST` options can be used to determine whether nulls appear
> before or after non-null values in the sort ordering. **By default, null values sort as if
> larger than any non-null value**; that is, `NULLS FIRST` is the default for `DESC` order, and
> `NULLS LAST` otherwise."*

H2, documenting `SET DEFAULT_NULL_ORDERING`:

> *"**`LOW` is the default one, `NULL` values are considered as smaller than other values during
> sorting.** … With `HIGH` default ordering `NULL` values are considered as larger than other
> values during sorting."*

Larger versus smaller. Same clause, opposite answer. This is why H2's own recommended PostgreSQL
URL carries `DEFAULT_NULL_ORDERING=HIGH` as a separate setting — the mode does not set it, and a
project that wrote only `MODE=PostgreSQL` is sorting nulls the wrong way round.

**The test that passes anyway, and this is the exact anatomy of a false green:**

```java
// The production query: the soonest-expiring active token.
@Query("select t from Token t where t.userId = :id order by t.expiresAt limit 1")
Optional<Token> nextExpiring(@Param("id") long id);
```

If `expires_at` is nullable — "null means never expires" — then on PostgreSQL the never-expiring
token sorts **last** and the query returns a real expiry. On H2 it sorts **first** and the query
returns the never-expiring token. The test is green on H2 because the fixture has three tokens
with three concrete dates, since that is what a tidy fixture looks like. The divergence lives on
data the fixture does not contain, which is the definition of the class of bug a test suite is
supposed to exist for.

### Collation

PostgreSQL's `ORDER BY` on text is locale-dependent:

> *"The default collation selects the locale specified at database creation time."*

H2's is not, unless you ask. `SET COLLATION` takes a `java.text.Collator` name and a strength, and
carries a hard constraint:

> *"Sets the collation used for comparing strings. This command can only be executed if there are
> no tables defined."*

Left alone, H2 compares strings the way Java does. So `ORDER BY name` over
`['apple', 'Banana', 'cherry']` is not guaranteed to agree between the two engines — Java's
natural ordering puts every upper-case letter before every lower-case one, while an `en_US.UTF-8`
collation does not.

The second-order lesson is more useful than the first: it is not guaranteed to agree between two
*PostgreSQL* instances either, if they were initialised with different locales. Pin the locale of
the image your container runs, or write `COLLATE "C"` where the order is part of the contract.


## Gotchas

**★ `NUMERIC` with no precision is `DECFLOAT` on H2 in PostgreSQL mode.**
Straight from the compatibility list. If you are testing money arithmetic, the column you tested
against was a decimal *floating* type and the scale coming back from `getBigDecimal` is not
PostgreSQL's. Declare precision and scale explicitly — `numeric(19,4)` — which you wanted anyway
for money, and this particular divergence closes for good.

**★ `MONEY` is a different concept on the two engines and the mode papers over it.**
*"`MONEY` data type is treated like `NUMERIC(19, 2)` data type"* on H2 in PostgreSQL mode.
PostgreSQL's `money` is a distinct type whose input parsing and output formatting depend on
`lc_monetary`, which is a database-level locale setting. Do not use `money` in either engine; the
divergence is a symptom of a type nobody should be storing amounts in.

**★ H2's documented type list has no `TEXT`, so every unbounded string column has to be spelled differently.**
PostgreSQL's manual says *"In most situations `text` or `character varying` should be used
instead."* H2's three character types are `CHARACTER`, `CHARACTER VARYING` and `CHARACTER LARGE
OBJECT`. A migration written with `text` columns needs a translation before it will run on H2, and
translating it is how a second, drifting copy of the schema gets created.

**★ `@Lob String` is not the same physical column on the two engines.**
H2's `CHARACTER LARGE OBJECT` is *"Mapped to `java.sql.Clob`"* and streamed; PostgreSQL `text` is
an ordinary string column. ⚠️ I could not confirm from the Hibernate 7 documentation which physical
type `PostgreSQLDialect` assigns to a `@Lob String` on Boot 4.1 — the historical answer, a
large-object `oid`, changed somewhere in the Hibernate 6 line and I found nothing authoritative
settling the current behaviour. Read the generated DDL on the engine you deploy rather than
trusting either answer, including this one.

**★ `NULLS` ordering defaults are exact opposites and `MODE=PostgreSQL` does not change it.**
PostgreSQL: *"null values sort as if larger than any non-null value."* H2: *"`LOW` is the default
one, `NULL` values are considered as smaller than other values during sorting."* H2's recommended
PostgreSQL URL carries `DEFAULT_NULL_ORDERING=HIGH` as a *third* setting for exactly this reason.
If you cannot set it, write `NULLS LAST` explicitly in the query — which you should be doing
anyway, because the default is one of the few things in SQL that changes the answer silently.

**★ `ORDER BY x LIMIT 1` over a nullable column is the canonical false green on this page.**
The fixture has three rows with three concrete values, because that is what a tidy fixture looks
like. Production has a fourth row where the column is `NULL`, and on H2 that row sorts first while
on PostgreSQL it sorts last. The test could not have caught it: the divergence lives entirely on
data the fixture did not contain, which is exactly the class of defect a test suite exists for.

**★ `ORDER BY name` is not stable across engines, and not across PostgreSQL instances either.**
H2 compares strings with Java semantics unless you set a `Collator`; PostgreSQL uses the locale
chosen at database creation — *"The default collation selects the locale specified at database
creation time."* So the same query can order differently on two PostgreSQL containers built from
different images. If sort order is part of the contract, put an explicit `COLLATE` in the SQL and
pin the locale of the image you run.

**★ H2's `SET COLLATION` can only run before any table exists.**
*"This command can only be executed if there are no tables defined."* So you cannot retrofit a
collation onto a running H2 database the way you can add a `COLLATE` clause to a PostgreSQL column
or index. If a team decides its H2 test database should sort like production, the change has to go
into the connection URL or the very first statement of the schema — which means it silently
applies to every column, not just the one you cared about.

**★ `IGNORECASE=TRUE` is a database-wide switch hidden in a URL.**
It makes every text column in the H2 schema compare case-insensitively — H2 introduces it as a
MySQL-compatibility feature. A suite carrying it in a test URL proves nothing about case
sensitivity anywhere in the application, and not one test file mentions it. `VARCHAR_IGNORECASE`
is the per-column version, and neither has a PostgreSQL spelling: there you would need `citext`
(an extension) or `ILIKE` at the call site.

**★ `CHAR` behaves differently between H2's own modes, never mind between engines.**
The compatibility list: *"Spaces are trimmed from the right side of `CHAR` values, but `CHAR`
values in result sets are right-padded with spaces to the declared length."* H2's own `CHARACTER`
documentation says a `CHARACTER` with no length is one character, and that two `CHARACTER` strings
of different length compare equal if the extra characters are spaces. Padding semantics are the
oldest source of `.equals()` failures in JDBC code, and here they change with a URL parameter.

## Interview questions

**★ Why is the null-ordering divergence a better example of a false green than the `jsonb` one?**
Because the `jsonb` divergence is loud — a containment operator does not exist on H2, so the query
fails to parse and somebody has to deal with it. Null ordering fails silently and only on data the
fixture lacks. A fixture is written by the same person who wrote the query, in the same hour, with
the same assumptions, and it therefore contains exactly the shapes of data the author had in mind.
`NULL` in a sort column is by definition a shape they did not have in mind — otherwise they would
have written `NULLS LAST`. The divergence and the blind spot have the same cause.

**★ How do you make an `ORDER BY` clause portable?**
Say what you mean, in the SQL. Write the null ordering explicitly (`ORDER BY expires_at NULLS
LAST`), because the defaults are opposite. Write the collation explicitly where order is part of
the contract (`ORDER BY name COLLATE "C"`), because PostgreSQL's default comes from the locale the
database was created with and H2's default comes from Java. And add a total-order tiebreaker — a
primary key — because two rows with equal sort keys can come back in either order on any engine
and that is not a divergence, it is SQL.

**★ What should you use instead of `money`, and why does the question come up in a portability discussion?**
`numeric` with explicit precision and scale — `numeric(19,4)` for amounts, with the currency in a
separate column. It comes up here because `money` is a case where both engines have a type of the
same name and neither means the same thing: PostgreSQL's `money` is locale-dependent through
`lc_monetary`, and H2 in PostgreSQL mode simply treats it as `NUMERIC(19, 2)`. But the real reason
to avoid it is not portability — it is that a fixed two-decimal locale-formatted type is wrong for
most currencies and all intermediate arithmetic. The portability problem is a symptom.

**★ Two PostgreSQL containers produce different `ORDER BY` results for the same query and data. What happened?**
They were initialised with different locales, so their default collations differ — PostgreSQL
documents that *"The default collation selects the locale specified at database creation time."*
Different base images, or the same image with a different `LANG`/`LC_ALL`, and a case- and
punctuation-aware collation like `en_US.UTF-8` orders text differently from `C`, which is byte
order. The fix is to pin the locale of the image (and to know which locale production uses), and
to write `COLLATE` explicitly anywhere the order is part of a contract. This is worth knowing
because it is a reminder that "run it on a real PostgreSQL" is necessary and not sufficient — the
real PostgreSQL has to be configured like the real PostgreSQL.

**★ A test asserts that a lookup is case-insensitive and it passes. What do you check first?**
Whether the H2 URL contains `IGNORECASE=TRUE`, and whether the column is `VARCHAR_IGNORECASE`. Both
are H2-only, both are invisible in the test source, and the first is database-wide — it makes
every text comparison in the schema case-insensitive. On PostgreSQL the same behaviour needs
either the `citext` extension or an explicit `ILIKE`/`lower()` at the call site, neither of which
the code will have. This is the mirror image of the usual failure: the test is green because the
test database is *more* permissive than production, not less.

{/* FOOTER */}
