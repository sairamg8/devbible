---
title: "The types you reach for when the column holds an object — jsonb, arrays, UUID, enums, intervals and timestamptz — and why a save-and-load test passes on H2 for every one of them"
sidebar_label: "01d · Types you query with"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *Data Types*
> ([datatypes.html](https://www.h2database.com/html/datatypes.html)), *Functions*
> ([functions.html](https://www.h2database.com/html/functions.html)) and *Features →
> PostgreSQL Compatibility Mode*
> ([features.html](https://www.h2database.com/html/features.html)) — the **PostgreSQL 18 manual**,
> *Date/Time Types*
> ([datatype-datetime](https://www.postgresql.org/docs/18/datatype-datetime.html)) — and the
> **pgJDBC connection-parameter reference**
> ([jdbc.postgresql.org](https://jdbc.postgresql.org/documentation/use/)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing or a test run.

**[01c](01c-what-h2-gets-wrong.md) established the scope of `MODE=PostgreSQL` and the identifier
divergence. This page takes the types you choose deliberately — the ones where the column holds a
structure rather than a scalar. Every entry here shares a property that makes it worth its own
page: the JPA save-and-load test is green on H2 for all of them, because Hibernate serialises and
deserialises symmetrically on whatever engine it is given. What is not green, and in most cases
cannot even be expressed, is the query you chose the type for.**
## The types

### `jsonb`, and the operator family that comes with it

PostgreSQL has two JSON types (`json` stores text, `jsonb` stores a parsed binary form) and an
operator vocabulary built on top: `->`, `->>`, `#>`, `#>>` for extraction; `@>` and `<@` for
containment; `?`, `?|`, `?&` for key existence; `||` and `-` and `#-` for modification; `@?` and
`@@` for JSONPath; plus `jsonb_set`, `jsonb_agg`, `jsonb_path_query`, and GIN indexing over the
whole lot.

H2 has one `JSON` type, and its documentation describes something quite different:

> *"A RFC 8259-compliant JSON text… Mapped to `byte[]`. … To set a JSON value with
> `java.lang.String` in a `PreparedStatement` use a `FORMAT JSON` data format
> (`INSERT INTO TEST(ID, DATA) VALUES (?, ? FORMAT JSON)`) or use
> `setObject(parameter, jsonText, H2Type.JSON)` instead of `setString()`. **Without the data
> format `VARCHAR` values are converted to JSON string values.**"*

Two separate problems in that paragraph.

**One: there are no operators.** H2's documented JSON functions are `JSON_ARRAY`, `JSON_OBJECT`,
`JSON_ARRAYAGG` and `JSON_OBJECTAGG` — constructors. There is no `->`, no `->>`, no `@>` in H2's
grammar. Any query that reaches *into* a JSON document is a false red on H2, so it gets rewritten
into "select the whole column and parse it in Java", which is the portable-SQL compromise
arriving through the back door.

**Two: `setString` silently means something else.** On H2, `ps.setString(1, "{\"a\":1}")` against
a `JSON` column stores the JSON *string value* `"{\"a\":1}"` — a scalar — not an object. The
document is now double-encoded and every read looks fine because Jackson happily round-trips a
string. On PostgreSQL the same call does not silently succeed, because pgJDBC is explicit about
what `setString` sends:

> *"If `stringtype` is set to `VARCHAR` (the default), such parameters will be sent to the server
> as `varchar` parameters. If `stringtype` is set to `unspecified`, parameters will be sent to
> the server as untyped values, and the server will attempt to infer an appropriate type."*

A `varchar` parameter bound to a `jsonb` column is a type mismatch the server rejects.

**The test that passes anyway:** the save-and-load test. An entity field mapped with
`@JdbcTypeCode(SqlTypes.JSON)` round-trips through Hibernate on both engines, so
`assertThat(loaded.getPayload()).isEqualTo(saved.getPayload())` is green everywhere. What is
never tested is the only reason you chose `jsonb` in the first place — querying inside it.

### Arrays

PostgreSQL spells an array type `text[]`, `integer[]`. H2 spells it `VARCHAR(100) ARRAY`,
`INTEGER ARRAY`, optionally with a maximum cardinality — *"The allowed cardinality is from 0 to
65536 elements"* — and maps it to `java.lang.Object[]`.

Because the DDL spellings differ, a migration containing `tags text[] not null default '{}'` does
not parse on H2 at all. Because the operator vocabularies differ, neither do the queries:
PostgreSQL's `@>`, `&&`, `= ANY(...)` and `unnest()` against H2's `ARRAY_CONTAINS`, `ARRAY_CAT`,
`ARRAY_APPEND`, `ARRAY_SLICE`, `CARDINALITY`, `TRIM_ARRAY` and `UNNEST`. `UNNEST` and `ARRAY_AGG`
are the overlap; almost nothing else is.

### `UUID` — the most common false red in the catalogue

Both engines have a native `UUID` type. The divergence is in what the driver will accept.

H2's documentation lists three accepted binding forms:

> *"To store values, use `PreparedStatement.setBytes`, `setString`, or `setObject(uuid)` (where
> `uuid` is a `java.util.UUID`). `ResultSet.getObject` will return a `java.util.UUID`."*

PostgreSQL accepts one. With pgJDBC's default `stringtype=VARCHAR`, `setString(1, id.toString())`
sends a `varchar` and the server will not implicitly cast it to `uuid`. So:

```java
// Green on H2. Rejected by PostgreSQL.
jdbc.update("insert into account(id, email) values (?, ?)", id.toString(), email);

// Correct on both.
jdbc.update("insert into account(id, email) values (?, ?)", id, email);
```

This is a **false red**, so it gets found — and it gets found in staging, where the pressure is
to fix it fast. The fast fix is to add `stringtype=unspecified` to the production JDBC URL, which
disables the driver's typing for *every* parameter in the application, not just this one. The
correct fix is the second line above: bind the `UUID`.

### `ENUM`

PostgreSQL's enum is a catalog object: `CREATE TYPE order_status AS ENUM ('NEW','PAID')`, then
`status order_status not null`. H2's `ENUM` is an inline column type — `status ENUM('NEW','PAID')`
— with no `CREATE TYPE` statement at all. A migration written for PostgreSQL does not parse on
H2, and vice versa.

More generally: **`CREATE EXTENSION` does not exist in H2.** `pgcrypto`, `uuid-ossp`, `pg_trgm`,
`citext`, `hstore`, `postgis` and `vector` are all unavailable, so any migration that installs one
is a hard stop.

**The test that passes anyway:** every JPA test, because `@Enumerated(EnumType.STRING)` maps to a
plain `varchar` on both engines and never touches a native enum type. The project only meets this
divergence when someone writes the migration by hand.

### `INTERVAL`

Both have interval types, and neither gives you a portable Java object. H2's is *"Mapped to
`org.h2.api.Interval`"*; pgJDBC hands back `org.postgresql.util.PGInterval`. Any code that reads
an interval column holds an engine-specific class.

The type models differ too. PostgreSQL has one `interval` type with optional field
qualifiers. H2 has **thirteen distinct interval types** — `INTERVAL YEAR`, `INTERVAL DAY TO
SECOND` and the rest — and enforces a split: *"Year-month intervals are comparable only with
another year-month intervals. Day-time intervals are comparable only with another day-time
intervals."*

### `timestamp with time zone` — the one that silently changes your data

This is the highest-value entry on the page, because the types have the same name, the same JDBC
mapping and completely different semantics.

PostgreSQL 18:

> *"For `timestamp with time zone` values, an input string that includes an explicit time zone
> will be converted to UTC … In either case, **the value is stored internally as UTC, and the
> originally stated or assumed time zone is not retained.**"* … *"When a `timestamp with time
> zone` value is output, it is always converted from UTC to the current `timezone` zone, and
> displayed as local time in that zone."*

H2 2.x:

> *"Mapped to `java.time.OffsetDateTime`. `java.time.ZonedDateTime` and `java.time.Instant` are
> also supported. Values of this data type are compared by UTC values."*

H2 stores the offset you gave it and gives it back. PostgreSQL discards the offset on write and
renders in the session zone on read. Same instant, different `OffsetDateTime`.

```java
OffsetDateTime created = OffsetDateTime.parse("2026-08-31T09:00+05:30");
repository.save(new Order(id, created));
Order loaded = repository.findById(id).orElseThrow();

// H2: the offset survives, so this is green.
// PostgreSQL: the offset is whatever the session zone renders, so this can fail.
assertThat(loaded.getCreatedAt()).isEqualTo(created);

// Correct on both, because it asserts about the instant rather than the rendering.
assertThat(loaded.getCreatedAt()).isEqualTo(created.toInstant().atOffset(loaded.getCreatedAt().getOffset()));
// or, plainly:
assertThat(loaded.getCreatedAt().toInstant()).isEqualTo(created.toInstant());
```

The first assertion is what people write, because `isEqualTo` reads like equality and
`OffsetDateTime.equals` compares the offset as well as the instant. On H2 it is green forever.
The lesson survives the container: **assert about instants, not about renderings** — that
assertion was wrong on H2 too, it just never got a chance to say so.


## Gotchas

**★ `setString` against a `JSON` column on H2 stores a JSON string, not a JSON object.**
H2 says so: *"Without the data format `VARCHAR` values are converted to JSON string values."* The
document is double-encoded and reads back fine through Jackson, so nothing fails and no assertion
notices. Bind with `? FORMAT JSON` or `setObject(i, jsonText, H2Type.JSON)` — or, better, stop
using H2 for the tests that touch JSON at all, since the operators you actually query with do not
exist there.

**★ `setString(uuid.toString())` works on H2, is rejected by PostgreSQL, and the fast fix is a disaster.**
H2 accepts `setBytes`, `setString` and `setObject` for a `UUID` column; pgJDBC sends `setString` as
a `varchar` under its default `stringtype=VARCHAR`. The repair that gets shipped under staging
pressure is `stringtype=unspecified` in the production URL, which stops the driver typing *every*
parameter in the application and hands type inference to the server for all of them. The correct
repair is one character of Java: pass the `UUID`, not its `toString()`.

**★ An `OffsetDateTime` round-trip assertion written with `isEqualTo` is green on H2 forever.**
H2 retains the offset; PostgreSQL stores UTC and *"the originally stated or assumed time zone is
not retained"*. `OffsetDateTime.equals` compares offsets, so the assertion is engine-dependent.
Assert on `toInstant()`. The assertion was wrong on H2 too — H2 just never told you.

**★ A migration containing `jsonb`, `text[]`, `CREATE TYPE … AS ENUM` or `CREATE EXTENSION` cannot run on H2, so the schema under test is a different schema.**
This is not a query-level problem, it is a schema-level one. If the migration will not run, either
the test schema came from `ddl-auto` instead
([01g](01g-transactional-ddl-and-which-schema.md)) or somebody maintains a second, H2-flavoured
copy of the migrations. The second copy drifts, and nothing in the build detects the drift —
because the only thing that could detect it is a test running the real migrations on the real
engine.

**★ `CREATE EXTENSION` has no H2 equivalent at all, so anything built on an extension is untested by construction.**
`pgcrypto`, `uuid-ossp`, `pg_trgm`, `citext`, `hstore`, `postgis`, `vector` — none of them exist in
H2 under any mode. Code that calls `gen_random_uuid()` in a column default, or uses a `pg_trgm`
similarity operator for fuzzy search, cannot be exercised on H2, so the test either mocks the
repository (proving nothing) or does not exist.

**★ H2's `ARRAY` has a documented maximum cardinality of 65,536 elements.**
*"The allowed cardinality is from 0 to 65536 elements."* PostgreSQL arrays have no such documented
ceiling. If your test fixture stays small — and it does — you will never see this, and it is a
reminder that the two implementations are not merely spelled differently.

**★ H2 and pgJDBC each hand back a proprietary class for an interval column.**
`org.h2.api.Interval` on one side, `org.postgresql.util.PGInterval` on the other. Any Java that
reads an interval holds an engine-specific type, so the *mapping code itself* is engine-specific
and cannot be shared between the test and production paths. If a duration needs to cross the JDBC
boundary, store it as a `bigint` of seconds or an ISO-8601 string and convert in Java, where the
semantics are yours.

**★ H2 splits intervals into two incomparable families; PostgreSQL does not.**
*"Year-month intervals are comparable only with another year-month intervals. Day-time intervals
are comparable only with another day-time intervals."* A comparison that H2 rejects outright,
PostgreSQL will happily evaluate — a false red — and a comparison that PostgreSQL evaluates using
its own month-length assumptions is a semantic question H2 declines to answer at all.

**★ `@Enumerated(EnumType.STRING)` is why nobody meets the enum divergence until it is a production migration.**
JPA maps enums to `varchar` on both engines, so every entity test is green and the native enum
type is never involved. The divergence only surfaces when someone writes
`CREATE TYPE order_status AS ENUM (...)` by hand — at which point the migration does not parse on
H2 and the whole migration test suite has to be reconsidered under deadline.

## Interview questions

**★ Your JPA repository test is green on H2. What has it actually established about your `jsonb` column?**
That Hibernate can serialise and deserialise the object, which is really a Jackson test. It has
established nothing about the queries you chose `jsonb` for, because H2 has no `->`, no `->>` and
no `@>` — a containment query cannot be expressed there at all, let alone indexed with GIN. If the
test writes through `setString` rather than a JSON-typed binding, it has additionally proved that
a double-encoded document round-trips, which is worse than proving nothing: it is a green test
covering a data corruption.

**★ How would you test that a `timestamp with time zone` column behaves correctly?**
Not with an equality assertion on `OffsetDateTime`, because that compares the offset and the two
engines disagree about whether the offset survives — PostgreSQL states that *"the originally stated
or assumed time zone is not retained"*, while H2 maps the type to `OffsetDateTime` and keeps what
you gave it. Assert on `toInstant()`, which is the only thing both engines promise. Then run the
test against the engine you deploy anyway, because the interesting question — what the session
`TimeZone` does to the value you read back — has no answer on H2.

**★ A colleague fixes a staging failure by adding `stringtype=unspecified` to the JDBC URL. What do you say?**
That it works and that it is much larger than the bug. pgJDBC's default is
*"parameters will be sent to the server as `varchar` parameters"*; `unspecified` means
*"parameters will be sent to the server as untyped values, and the server will attempt to infer an
appropriate type"* — for every `setString` in the application, not just the one that failed. You
have traded a compile-time-ish guarantee for server-side inference everywhere, and the next
mis-typed parameter will now be silently coerced instead of rejected. The failure was a `UUID` bound
with `toString()`; bind the `UUID`.

**★ Why is `timestamp with time zone` the most valuable single entry in this catalogue?**
Because everything about it looks portable. Same SQL type name, same JDBC mapping to
`OffsetDateTime`, same Hibernate handling. Only the semantics differ: PostgreSQL normalises to UTC
and discards the offset, H2 stores the offset you gave it. So it produces the purest form of false
green — a test that passes on H2, would pass on PostgreSQL under some session time zones, and
fails under others, which means it also presents as flakiness rather than as a bug. Any divergence
that can masquerade as flakiness costs more than one that fails cleanly.

**★ What is the general shape of the failure on this page?**
Symmetric serialisation hides asymmetric semantics. Hibernate writes and reads through the same
mapping, so anything you write comes back the way you wrote it regardless of engine, and the
save-and-load test is green everywhere. The engine only starts to matter when something *other
than your own writer* interprets the stored value — a `WHERE payload @> ?`, an index over a JSON
path, a `timestamptz` rendered in a session zone, a native enum a migration declared. That is
also the practical test for whether a data-layer test is worth anything: does anything except your
own serialiser get a vote on the result?

{/* FOOTER */}
