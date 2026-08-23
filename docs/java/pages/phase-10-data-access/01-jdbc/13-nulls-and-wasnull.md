---
title: "`getInt` on a NULL column returns 0, and nothing tells you"
sidebar_label: "13 · Nulls, primitives and `wasNull`"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.ResultSet` —
> `wasNull()`, the primitive getters, and `getObject(int, Class)`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the PostgreSQL 18
> manual *Functions and Operators → Comparison Functions and Operators*.
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**SQL has three-valued logic and Java's primitives have two values and no
absence. JDBC bridges that gap by lying: `rs.getInt(col)` on a SQL NULL returns
**0**, `rs.getBoolean(col)` returns **false**, `rs.getLong(col)` returns **0L** —
no exception, no warning, no distinction from a column that genuinely contained
zero. The API's answer is `wasNull()`, a method you must call *after* the getter
and which almost nobody does, and which reports on the last column read rather
than on a column you name. This is a silent data-corruption bug that lives happily
in production for years: a discount of NULL becomes a discount of 0, a nullable
`retry_count` reads as 0 and the retry logic behaves as if the row had never been
attempted, an unset boolean flag reads as false and a feature is silently off. It
is worth a chunk of its own because the fix is easy and the failure is invisible.**

## The behaviour

```java
// orders.discount_pct is nullable
int discount = rs.getInt("discount_pct");   // NULL → 0. No exception.
```

Zero and "no discount specified" are different facts, and this code cannot tell
them apart. The same applies to every primitive getter:

| Getter | SQL NULL yields |
|---|---|
| `getInt`, `getLong`, `getShort`, `getByte` | `0` |
| `getDouble`, `getFloat` | `0.0` |
| `getBoolean` | `false` |
| `getString` | `null` — object types are fine |
| `getBigDecimal`, `getTimestamp`, `getObject` | `null` |

🔴 **Object-returning getters are safe; primitive-returning getters are not.** That
is the whole rule, and it means the danger is concentrated exactly where the
column is a number or a flag — which is where business logic lives.

## `wasNull`, and why its shape is awkward

The javadoc:

> Reports whether the last column read had a value of SQL `NULL`. Note that you
> must first call one of the getter methods on a column to try to read its value
> and then call the method `wasNull` to see if the value read was SQL `NULL`.

```java
int discount = rs.getInt("discount_pct");
Integer discountOrNull = rs.wasNull() ? null : discount;    // ✅ correct
```

Two things make this awkward enough that it gets skipped:

- **It is stateful and positional.** It refers to *the last column read*, not to a
  column you name. Interleave any other getter between the read and the `wasNull`
  and you are asking about the wrong column.
- **It doubles the line count** of every nullable primitive read, in exactly the
  code that is already the most tedious in the application.

⚠️ **The stateful trap, concretely:**

```java
int discount = rs.getInt("discount_pct");
int quantity = rs.getInt("quantity");
if (rs.wasNull()) { ... }        // ❌ this is about quantity, not discount
```

## The modern answer: `getObject` with a type

JDBC 4.2's typed accessor removes the problem entirely, because it returns an
object and objects can be null:

```java
Integer discount = rs.getObject("discount_pct", Integer.class);   // ✅ null is null
Long    parentId = rs.getObject("parent_id", Long.class);
Boolean optedIn  = rs.getObject("opted_in", Boolean.class);
```

🔴 **This is the recommendation for every nullable column, and the reason is that
it makes the nullability visible in the Java type.** `Integer discount` says the
value may be absent; `int discount` says it cannot be. A reviewer can see the
mismatch between a nullable column and an `int` field; nobody can see a missing
`wasNull()` call.

The trade is boxing. For a mapper reading millions of rows in a batch job that is
a measurable allocation cost and `getInt` + `wasNull` is defensible. For request
handling it is not worth a thought.

## Deciding what null *means* before you map it

The mapping question is downstream of a design question people skip: what does a
NULL in this column mean, and what should the domain object hold?

| SQL | Java | When |
|---|---|---|
| `NOT NULL` column | `int`, `long`, `boolean` | ✅ the default you should push for |
| nullable, absence is meaningful | `Integer`, `Optional<Integer>` in the domain | a discount that may not be set |
| nullable, absence means a default | map to the default **at the boundary**, explicitly | `COALESCE(discount_pct, 0)` in the SQL, and a `NOT NULL` Java type |

🔴 **`COALESCE` in the SQL is underrated.** If the domain genuinely treats absence
as zero, saying so in the query is better than doing it in Java: the intent is
visible in the statement, the mapper stays trivial, and there is no primitive
getter reading a null. It also lets the database use the value in expressions and
indexes.

⚠️ **The best fix is usually further upstream: make the column `NOT NULL`.** A
large fraction of nullable columns are nullable because nobody decided, not
because absence is meaningful. `NOT NULL DEFAULT 0` removes an entire class of
bug from every consumer of that table forever. That is a migration
(**Topic 11 — Migrations with Flyway** *(not written yet)*), not a mapper change.

## `Optional` in records, and where it belongs

```java
record Order(long id, long customerId, OptionalInt discountPct) { }   // ⚠️ awkward
record Order(long id, long customerId, Integer discountPct) { }        // ✅ simpler
```

`Optional` as a *record component* or a field is generally discouraged in Java —
it is designed as a return type — and `OptionalInt` in particular gains you little
over `Integer` while making every accessor uglier. The pragmatic shape for a
persistence record is a boxed type with the nullability documented, and
`Optional.ofNullable(order.discountPct())` at the point where a caller wants to
branch on presence.

## Writing nulls back

The other direction has its own trap, covered in
[chunk 6](06-the-preparedstatement-api.md) and worth restating in one line here
because it is the mirror image: `ps.setNull(n, Types.INTEGER)` sets a NULL, and
`WHERE discount_pct = ?` with a NULL bound matches **nothing**, because `= NULL` is
unknown rather than true. Reading and writing nulls fail in opposite directions —
reading silently produces a wrong value, writing silently produces no rows.

## The trade-off

`getObject(col, Integer.class)` everywhere costs boxing and makes every numeric
field in your domain object a wrapper type, which propagates: arithmetic needs
null checks, comparisons need `Objects.equals`, and an accidental `==` compares
references. That propagation is genuinely annoying, and it is the correct annoyance
— it is the type system making a real property of the data visible. The wrong
response is to unbox eagerly with a default, because that recreates the original
bug with more steps.

## Gotchas

**⚠️ `getInt` on a nullable column**
**Symptom:** a business rule behaving as though the value were zero, indefinitely,
with no error anywhere.
**Cause:** the primitive getters return 0 for SQL NULL by specification.
**Fix:** `getObject(col, Integer.class)`, or `getInt` immediately followed by
`wasNull()`.

**⚠️ `getBoolean` on a nullable flag**
**Symptom:** a feature silently off for rows where the flag was never set —
indistinguishable from an explicit `false`.
**Cause:** NULL reads as `false`.
**Fix:** `Boolean` via `getObject`, and decide explicitly what an unset flag
means.

**⚠️ `wasNull()` called after reading a different column**
**Symptom:** null-handling that is right for some rows and wrong for others.
**Cause:** `wasNull` refers to the *last column read*, not to a named column.
**Fix:** call it immediately after the getter it belongs to, with nothing in
between — or use `getObject` and stop needing it.

**⚠️ `WHERE col = ?` with a null bound**
**Symptom:** an optional filter that returns zero rows instead of "no filter".
**Cause:** three-valued logic; `= NULL` is unknown.
**Fix:** `IS NULL` in the SQL, or two query variants.

**⚠️ Unboxing a nullable value into a primitive field**
**Symptom:** a `NullPointerException` in a mapper, thrown from an assignment with
no visible dereference.
**Cause:** auto-unboxing a `null` `Integer`.
**Fix:** keep it boxed, or `COALESCE` in the SQL so the value is never null in the
first place.

**⚠️ Comparing boxed values with `==`**
**Symptom:** equality that works for small integers and fails for large ones,
because of the `Integer` cache.
**Cause:** `==` on wrappers compares references.
**Fix:** `Objects.equals`, or compare unboxed values after establishing
non-nullness.

**⚠️ A nullable column nobody decided to make nullable**
**Symptom:** every consumer of the table writes the same defensive null handling.
**Cause:** the schema never said what absence means.
**Fix:** `NOT NULL DEFAULT ...` in a migration. One change removes the problem for
every reader, forever.

## Interview questions

**★ What does `rs.getInt(...)` return for a SQL NULL?**
Zero, with no exception and no warning. All the primitive getters behave this way
— `getLong` returns 0, `getDouble` returns 0.0, `getBoolean` returns false — because
a Java primitive has no representation for absence and the API had to return
something. The object-returning getters are fine: `getString` and `getBigDecimal`
return null. That asymmetry is what makes the bug so persistent, because the
dangerous case is exactly the numeric and boolean columns that business logic
branches on, and a discount of NULL silently becoming a discount of 0 is not
something any test with non-null fixtures will ever catch.

**★ How does `wasNull()` work and why is it easy to get wrong?**
It reports whether the *last column read* was SQL NULL, so it has to be called
immediately after the getter it refers to. It names no column, which means any
intervening getter changes what it is talking about — read the discount, read the
quantity, then call `wasNull()`, and you have asked about the quantity. It also
doubles the size of every nullable read, in the most tedious code in the
application, which is why it gets skipped. The modern alternative removes the
problem rather than managing it: `getObject(col, Integer.class)` returns a boxed
`Integer` that is null when the column is null, and the nullability then lives in
the Java type where a reviewer can see it.

**★ How would you decide between `Integer`, `int` with `COALESCE`, and a `NOT
NULL` column?**
By asking what absence means in the domain. If absence is genuinely meaningful —
a discount that has not been set is different from a discount of zero — then the
column stays nullable and the Java type is a boxed `Integer`, so the distinction
survives into the code. If absence just means "use the default", then say so in
the SQL with `COALESCE(discount_pct, 0)` and keep an `int` in Java: the intent is
visible in the query, and no primitive getter ever meets a null. And if the column
is nullable only because nobody decided, the right fix is a migration to `NOT NULL
DEFAULT`, which removes the problem for every reader of that table rather than for
one mapper.

**★ Why do reading and writing nulls fail in opposite directions?**
Reading fails by producing a plausible wrong value: `getInt` on a NULL gives you 0
and the program carries on. Writing fails by producing nothing: `WHERE col = ?`
with a null bound matches no rows, because SQL comparison is three-valued and
`anything = NULL` is unknown rather than true, so the predicate filters everything
out — including the rows where the column really is null, which is what the person
writing it usually wanted. The read side needs `wasNull` or a boxed accessor; the
write side needs `IS NULL` in the SQL text, because no bound value can change an
`=` into an `IS`.

**★ Is there a cost to using `getObject(col, Integer.class)` everywhere?**
Boxing, and the propagation of wrapper types through your domain objects. For
request handling the allocation is irrelevant next to the network round trip; for
a batch mapper reading millions of rows it is measurable, and there `getInt` plus
an immediate `wasNull()` is a defensible optimisation. The propagation is the more
interesting cost: once a field is `Integer`, arithmetic needs null checks,
comparisons need `Objects.equals` rather than `==`, and every caller has to think
about absence. That is annoying and it is correct — it is the type system making a
real property of the data visible. The wrong response is to unbox eagerly with a
default, because that is the original bug with extra steps.

---

← Prev: [`ResultSet`: the cursor model](12-resultset-the-cursor-model.md) · Index: [JDBC](README.md) · Next → [Dates, times and `timestamptz`](14-dates-times-and-timestamptz.md)
