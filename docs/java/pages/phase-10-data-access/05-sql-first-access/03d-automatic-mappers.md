---
title: "Spring ships four row mappers you never write, and `JdbcClient.query(Class)` uses the one nobody can name"
sidebar_label: "3d · The built-in mappers"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the javadoc for `BeanPropertyRowMapper` (@since 2.5),
> `DataClassRowMapper` (@since 5.3), `SimplePropertyRowMapper` (@since 6.1),
> `SingleColumnRowMapper` (@since 1.2) and `JdbcClient.StatementSpec`
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/package-summary.html)),
> and the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)).
> JDK 25, Spring Framework 7.0.9, PostgreSQL 18.

**Writing `(rs, n) -> new Actor(rs.getLong("id"), rs.getString("first_name"))` for
every query gets old, and Spring has four mappers that do it by reflection. They
differ in *how they construct the object* — a no-arg constructor and setters, a
data-class constructor, or a permissive mixture — and on JDK 25 with records the
answer is nearly always the mixture, which is what `JdbcClient` quietly uses. All
four say in their own javadoc that they are for convenience rather than
performance, and that sentence is worth taking seriously.**

## The four, and what each one requires of your class

| Mapper | @since | Needs | Column → member |
|---|---|---|---|
| `SingleColumnRowMapper<T>` | 1.2 | nothing — `T` is the value | the one column |
| `BeanPropertyRowMapper<T>` | 2.5 | no-arg constructor + setters | setter names |
| `DataClassRowMapper<T>` | 5.3 | a data-class constructor (or setters) | constructor parameter names, then setters |
| `SimplePropertyRowMapper<T>` | 6.1 | any of the three | constructor parameters, then setters, then fields |

### `SingleColumnRowMapper` — for a result with one column

> "`RowMapper` implementation that converts a single column into a single result
> value per row. Expects to operate on a `java.sql.ResultSet` that just contains a
> single column."

This is what is behind `queryForObject(sql, Integer.class)` and
`queryForList(sql, String.class)`. It validates that exactly one column was
selected, and its `convertValueToRequiredType` will stringify via `toString()` for
a `String` target, do numeric conversion for a `Number` target, and otherwise go
through the `ConversionService`.

If the result has more than one column you get
`IncorrectResultSetColumnCountException` — which `JdbcOperations` names in the
`queryForObject` javadoc as thrown "if the query does not return a row containing a
single column". That is a *different* exception from the wrong-number-of-rows one,
and the distinction saves you a lot of time when reading a stack trace.

### `BeanPropertyRowMapper` — the classic

The oldest of the reflective mappers, and the one most examples use. Its javadoc
sets out the naming rule:

> "Column values are mapped based on matching the column name (as obtained from
> result set meta-data) to public setters in the target class for the corresponding
> properties. The names are matched either directly or by transforming a name
> separating the parts with underscores to the same name using 'camel' case."

So `first_name` finds `setFirstName`, and the documentation's own advice for the
mismatch case is to alias in SQL:

> "try using underscore-separated column aliases in the SQL statement like
> `select fname as first_name from customer`, where `first_name` can be mapped to a
> `setFirstName(String)` method"

Three settings decide how forgiving it is:

- **`primitivesDefaultedForNullValue`** — default `false`. A SQL `NULL` read into an
  `int` property throws `TypeMismatchException`. Set it `true` and the property
  keeps its initial value instead. ⚠️ The javadoc attaches a warning to that:
  if you later use the ignored primitive to update the database, "the NULL value
  will be changed to the current value of that primitive property". Turning it on
  converts a loud failure into silent data corruption on the write path.
- **`checkFullyPopulated`** — default `false`, "accepting unpopulated properties".
  A property with no matching column is simply left alone.
- **`conversionService`** — a `DefaultConversionService` by default since 4.3,
  which is what gives you `java.time` support without writing converters.

It needs a no-arg constructor and setters, which means **it cannot map to a
record** — records have neither. That is what `DataClassRowMapper` is for, and the
`BeanPropertyRowMapper` javadoc says so directly.

### `DataClassRowMapper` — records and other constructor-shaped classes

> "The term 'data class' applies to Java records, Kotlin data classes, and any
> class which has a constructor with named parameters that are intended to be
> mapped to corresponding column names."

It extends `BeanPropertyRowMapper`, so it inherits the underscore rule and the
conversion service, and adds constructor binding with a stated precedence:

> "any property mapped successfully via a constructor argument will not be mapped
> additionally via a corresponding setter method. This means that constructor
> arguments take precedence over property setter methods."

There is one hard structural requirement, repeated in every one of these mappers'
javadoc and worth memorising because the failure is confusing:

> "The mapped target class must be a top-level class or static nested class."

A record declared *inside a method* — a local record, which is exactly what you
reach for when the result shape is used once — will not work here.

### `SimplePropertyRowMapper` — the one `JdbcClient` uses

Added in 6.1 alongside `JdbcClient`, and it is the most permissive of the three:

> "it may expose either a data class constructor with named parameters
> corresponding to column names or classic bean property setter methods with
> property names corresponding to column names **or fields with corresponding field
> names**."

with a three-level precedence — "constructor arguments take precedence over
property setter methods which in turn take precedence over direct field mappings" —
and a note about where it is used:

> "In terms of its fallback property discovery algorithm, this class is similar to
> `SimplePropertySqlParameterSource` and is similarly used for `JdbcClient`."

🔴 **That is the fact to carry away: `JdbcClient.query(SomeClass.class)` maps with
`SimplePropertyRowMapper`, not `DataClassRowMapper` and not
`BeanPropertyRowMapper`.** So the behaviour you get from `JdbcClient` is the
permissive one — it will bind a record's constructor, a bean's setters, or raw
fields, in that order. When you read documentation or an answer describing
`BeanPropertyRowMapper`'s strictness and then observe something different through
`JdbcClient`, this is why.

For a simple value type, `StatementSpec.query(Class)` documents both paths — "a
simple value type for a single column mapping or a JavaBean / record class / field
holder for a multi-column mapping" — so `query(Long.class)` is the
`SingleColumnRowMapper` route and `query(Actor.class)` is the property route.

## Records are the natural row type

On JDK 25 the honest Java type for "one row of this query" is a record, and it
costs one line:

```java
public record ActorRow(long id, String firstName, String lastName) {}

List<ActorRow> actors = jdbcClient
        .sql("select id, first_name, last_name from actor order by last_name")
        .query(ActorRow.class)
        .list();
```

`first_name` binds to the `firstName` component through the underscore rule.
Nothing is declared anywhere else, the record is immutable, and the compiler
guarantees every component is set — which is a real advantage over the setter route,
where an unmatched column leaves a field silently null.

**Declare the record next to the repository, not in the domain package.** It is a
result shape, not a domain object; giving it a name ending in `Row`, `View` or
`Summary` keeps that visible. And declare it as a **top-level or `static` nested**
type, per the requirement above.

## The performance sentence, which is not boilerplate

Both `BeanPropertyRowMapper` and `DataClassRowMapper` carry the same line:

> "Please note that this class is designed to provide convenience rather than high
> performance. For best performance, consider using a custom `RowMapper`
> implementation."

The reflective mappers read `ResultSetMetaData` for every result, match names,
and invoke setters or a constructor reflectively per row. For a page of 20 rows
this is irrelevant. For a job that maps a million rows in a loop, a hand-written
mapper is a straightforward win and worth the twelve lines. Use the automatic
mappers by default and hand-write the ones in hot paths — and note that you can
mix freely, since both are just a `RowMapper`.

## Gotchas

**A local record cannot be mapped.** Every one of these mappers requires "a
top-level class or static nested class". A record declared inside the repository
*method* that uses it — the most natural thing to write — fails at mapping time,
not at compile time. Promote it to a `static` nested record on the repository
class.

**`checkFullyPopulated` is off, so a typo in a column alias silently produces
nulls.** `select first_nmae as firstName …` does not fail; the property just never
gets set. With a bean this is a `null` field discovered later; with a record you at
least get a constructor parameter that must come from somewhere. This is the
strongest argument for records over beans in this role.

**Renaming a database column silently breaks the mapping.** There is no compile-time
link between `first_name` and `firstName` — the connection is a string comparison
at runtime. A migration that renames the column leaves code that compiles, starts
and returns objects with a missing field. Nothing in Java can catch this; only a
test that asserts on the mapped values can.

**PostgreSQL folds unquoted identifiers to lower case, and that is usually what
saves you.** `select firstName from actor` returns a column labelled `firstname`,
which the underscore rule cannot turn into `firstName` — but the matching is
case-insensitive, so it works anyway. It stops working the moment somebody
double-quotes an identifier in the DDL, because then the column really is
`"firstName"` and every unquoted reference to it fails. Do not quote identifiers in
migrations.

**Two columns with the same name in a join, and the mapper takes one of them.**
`select o.*, c.* from orders o join customers c …` produces two columns called
`id`. The mapper matches on name and cannot know which you meant. Always alias in a
join — `o.id as order_id, c.id as customer_id` — and the aliases then feed the
underscore rule cleanly.

**`primitivesDefaultedForNullValue = true` is a data-corruption switch, not a
convenience.** Turning it on to silence a `TypeMismatchException` means a `NULL`
column becomes `0` in your object. If that object is ever written back, the `NULL`
is now a `0` in the database. The javadoc spells this out. The correct fix is to
make the field a boxed `Integer`/`Long`, or to make the column `NOT NULL`.

**`DataClassRowMapper` extends `BeanPropertyRowMapper`, so "constructor binding"
does not mean "constructor only".** If your class has both a data-class constructor
and setters, both are used, with constructor arguments winning. A half-record,
half-bean class therefore gets populated in two passes and is very hard to reason
about. Pick one shape per class.

## Interview questions

**★ What is the difference between `BeanPropertyRowMapper` and
`DataClassRowMapper`?**
Construction. `BeanPropertyRowMapper` requires a no-arg constructor and populates
the object through public setters, matching column names to property names either
directly or by converting `underscore_separated` to camel case. `DataClassRowMapper`
adds constructor binding: it matches column names to the named parameters of a
data-class constructor, which is what makes it work with Java records and Kotlin
data classes — neither of which has a no-arg constructor or setters. It extends
`BeanPropertyRowMapper`, so it can do both, and its javadoc states the precedence:
constructor arguments win over setters for any property both could populate.

**★ Which mapper does `JdbcClient.query(SomeRecord.class)` actually use?**
`SimplePropertyRowMapper`, added in 6.1 with `JdbcClient` itself. Its javadoc says
it is "similarly used for `JdbcClient`". It is the most permissive of the family:
it will bind a data-class constructor, then bean setters, then raw fields, in that
order of precedence. That matters because most of what is written about Spring's
automatic mapping describes `BeanPropertyRowMapper`, whose rules are stricter — so
if you reason about `JdbcClient` using `BeanPropertyRowMapper`'s documentation you
will predict failures that do not happen. For a simple value type such as
`Long.class`, `query(Class)` takes the single-column path instead.

**★ Should you use the automatic mappers or write `RowMapper`s by hand?**
Automatic by default; hand-written where it matters. The mappers themselves tell
you this — both `BeanPropertyRowMapper` and `DataClassRowMapper` carry the sentence
"designed to provide convenience rather than high performance. For best
performance, consider using a custom `RowMapper` implementation." They read result
set metadata and use reflection per row, which is invisible on a page of results
and measurable on a million. The other reason to hand-write is control: a mapper
you wrote is where you put `wasNull()` handling, enum parsing with a sensible
error, or a column that needs to become two fields.

**★ How does a column called `first_name` end up in a field called `firstName`?**
By a naming convention implemented in the mapper, not by anything declarative. The
javadoc describes matching "either directly or by transforming a name separating
the parts with underscores to the same name using 'camel' case", and the match is
case-insensitive. It is a runtime string comparison against
`ResultSetMetaData`, so there is no compile-time link at all — renaming the column
in a migration breaks the mapping silently. When names cannot be made to line up,
the documentation's own advice is to alias in the SQL: `select fname as first_name
from customer`.

**★ What happens when a column in the result has no matching property?**
Nothing, by default. `checkFullyPopulated` defaults to `false`, described as
"accepting unpopulated properties", so unmatched columns are ignored and unmatched
properties keep their initial value. That is convenient and it is also how a typo
in an alias turns into a silently null field. Setting `checkFullyPopulated` to
`true` makes it strict, but the better structural answer is a record, where every
component must be supplied by the constructor and an unmatched one is a mapping
failure rather than a quiet default.

**★ Why does mapping a `NULL` column into an `int` throw, and what should you do
about it?**
Because there is no `int` value that means "absent", so the mapper cannot honour
the request — it raises `TypeMismatchException`. There is a flag,
`primitivesDefaultedForNullValue`, that makes it skip the property instead, and I
would not use it: the javadoc warns that if you later write that object back, the
`NULL` becomes whatever the primitive defaulted to, which turns a read-time error
into a write-time data change. The two honest fixes are to box the field, so
`Integer` can hold `null`, or to make the column `NOT NULL` if the domain says it
should never be absent.

**★ Where should the record you map to live?**
Next to the repository that produces it, as a top-level or `static` nested type —
never as a local record inside the method, because every one of these mappers
requires "a top-level class or static nested class" and a local record fails at
runtime. Conceptually it is a query result, not a domain object, and naming it
`…Row`, `…View` or `…Summary` keeps that distinction visible. Putting query result
shapes in the domain package is how a codebase ends up with fifteen near-identical
"entities" that are really projections.

---

← Prev: [3c · Two queries, and `LIMIT`](03c-two-queries-and-limit.md) · Index: [05 · SQL-first access](README.md) · Next → [4 · `JdbcClient`](04-jdbcclient.md)
