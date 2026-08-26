---
title: "`queryForObject` throws on zero rows — and the `try`/`catch` everybody writes to fix that also swallows a completely different bug"
sidebar_label: "7 · Empty results"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `JdbcOperations` and `DataAccessUtils` source in
> spring-framework `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/JdbcOperations.java)),
> the `JdbcClient.MappedQuerySpec` / `ResultQuerySpec` javadoc
> ([docs.spring.io/.../simple/JdbcClient.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/simple/JdbcClient.html))
> and the `org.springframework.dao` package javadoc
> ([docs.spring.io/.../dao/package-summary.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/package-summary.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18.

**`jdbcTemplate.queryForObject(sql, mapper, id)` for a row that does not exist
throws `EmptyResultDataAccessException`. It does not return `null`. Everybody meets
this once, and the reflex fix — wrap it in a `try`/`catch` and return `null` — is
worse than the problem, because `EmptyResultDataAccessException` is a *subclass* of
the exception thrown when the query matched two rows. The catch block that turns "no
such customer" into `null` also turns "your unique constraint is missing" into
`null`.**

## Why it throws

`queryForObject` is not a special query. It runs the ordinary `query(...)`, gets a
`List`, and then applies a size rule. The javadoc says it plainly:

> `@throws org.springframework.dao.IncorrectResultSizeDataAccessException`
> `if the query does not return exactly one row`

The rule lives in `DataAccessUtils`, and the two methods behind it are precise:

| Method | 0 results | 1 result | 2+ results |
|---|---|---|---|
| `requiredSingleResult` | `EmptyResultDataAccessException(1)` | the value | `IncorrectResultSizeDataAccessException(1, size)` |
| `nullableSingleResult` | `EmptyResultDataAccessException(1)` | the value | `IncorrectResultSizeDataAccessException(1, size)` |
| `singleResult` | `null` | the value | `IncorrectResultSizeDataAccessException(1, size)` |
| `optionalResult` | `Optional.empty()` | the value | delegates to `singleResult` — throws |

Note the constructor arguments: `EmptyResultDataAccessException(1)` says "I expected
at least one". `IncorrectResultSizeDataAccessException(1, size)` says "I expected 1,
I got `size`".

## The inheritance that makes the reflex fix dangerous

```
IncorrectResultSizeDataAccessException      "expecting a single row but getting 0 or more than 1"
└── EmptyResultDataAccessException          "expected to have at least one row … zero were returned"
```

So this, which is everywhere:

```java
public Customer findByEmail(String email) {
    try {
        return jdbcTemplate.queryForObject(BY_EMAIL, CUSTOMER_MAPPER, email);
    }
    catch (EmptyResultDataAccessException ex) {
        return null;                       // "not found"
    }
}
```

…is *almost* right. It catches only the subclass, so two rows still throws. But the
version people actually write when they are in a hurry is:

```java
catch (IncorrectResultSizeDataAccessException ex) {   // ⛔ catches both
    return null;
}
```

and now a duplicate email — a broken uniqueness invariant, a genuine data
corruption bug — is reported to the caller as "no such customer". The system keeps
running and the real problem is invisible.

🔴 **If you catch anything here, catch `EmptyResultDataAccessException`, never its
parent.**

## The `JdbcClient` answer: do not catch anything

The whole `try`/`catch` disappears:

```java
public Optional<Customer> findByEmail(String email) {
    return jdbcClient.sql(BY_EMAIL)
                     .param("email", email)
                     .query(CUSTOMER_MAPPER)
                     .optional();
}
```

`.optional()` is documented as "retrieve a single result, **if available**, as an
`Optional` handle". Zero rows is `Optional.empty()`; two rows still throws, because
two rows is still a bug. The intent — "at most one" — is now in the code rather
than in a comment above a catch block.

## The full table

| Rows returned | `queryForObject` | `.single()` | `.optional()` | `.list()` |
|---|---|---|---|---|
| **0** | `EmptyResultDataAccessException` | `EmptyResultDataAccessException` | `Optional.empty()` | `[]` |
| **1** | the object | the object | `Optional.of(x)` | `[x]` |
| **2+** | `IncorrectResultSizeDataAccessException` | `IncorrectResultSizeDataAccessException` | **throws** | `[x, y]` |

Three rules follow, and they cover essentially every lookup you will write:

- **"exactly one, or something is broken"** → `.single()`. A lookup by primary key
  inside an aggregate you just loaded; a `count(*)`.
- **"at most one"** → `.optional()`. Every `findBy…` on the way to a 404.
- **"any number"** → `.list()`.

The untyped side of `JdbcClient` mirrors this exactly: `singleValue()` behaves like
`single()` and `optionalValue()` — added in 6.2 — behaves like `optional()`.

## `null` is a fourth case, and it is not the same as zero rows

A query can return exactly one row whose single column is SQL `NULL`. That is *not*
an empty result:

```sql
select max(placed_at) from orders where customer_id = ?;
```

For a customer with no orders this returns **one row containing `NULL`**, so
`queryForObject(..., OffsetDateTime.class, id)` returns `null` — its javadoc says
"the result object of the required type, or `null` in case of SQL NULL". No
exception is thrown.

Aggregates behave this way generally. `select count(*)` **always** returns exactly
one row, so `queryForObject(sql, Long.class)` on a count can never throw
`EmptyResultDataAccessException` — a common misconception in the other direction.
`min`, `max`, `sum` and `avg` also return one row, but it may contain `NULL`.

⚠️ **`.single()` enforces non-null as of 6.2.** So `query(OffsetDateTime.class)
.single()` on that `max` query throws rather than returning `null`. If a SQL `NULL`
is a legitimate answer, use `.optional()` — it is the API's way of saying "there
may be nothing here", and it covers both the no-rows and the null-value cases.

## Gotchas

**Catching `IncorrectResultSizeDataAccessException` to handle "not found" hides
duplicates.** It is the parent class. A `findByEmail` written that way turns a
missing unique index into a silent "not found", and the symptom surfaces months
later as "the user cannot log in but their row is right there".

**`.optional()` still throws on two rows, and that is a feature.** People
occasionally reach for `.list().stream().findFirst()` to make the two-row case go
away. That does make it go away — along with the information that your data violated
an invariant. If duplicates are genuinely expected, `.list()` and handle them
explicitly; if they are not, let it throw.

**`queryForObject` returning `null` and throwing are different situations.** `null`
means one row with a SQL `NULL` value. The exception means zero rows. Code that
treats them the same is usually wrong about one of them — particularly for
aggregates, where zero rows is impossible and `NULL` is routine.

**A `RowMapper` that returns `null` makes `single()` throw.** As of 6.2 `single()`
"enforces non-null". So a mapper with an early `return null` for a row it does not
like turns a perfectly good single row into a failure. Mappers should not return
`null` — see **[`RowMapper` and friends](03-rowmapper.md)**.

**`count(*)` cannot be empty, so a `try`/`catch` around one is dead code.** An
aggregate with no `GROUP BY` returns exactly one row. Wrapping
`queryForObject("select count(*) …", Long.class)` in a catch for
`EmptyResultDataAccessException` looks defensive and never executes. Add a `GROUP BY`
and it *can* return zero rows — which is the case people are usually half-remembering.

**A `SingleColumnRowMapper` failure and a wrong-row-count failure are different
exceptions and people conflate them.** More than one column selected →
`IncorrectResultSetColumnCountException`. Wrong number of rows →
`IncorrectResultSizeDataAccessException` (or its subclass
`EmptyResultDataAccessException`). If you see the first one, your `select` has
extra columns; if you see the second, your `where` matched the wrong number of rows.

**Returning `null` from a repository is a decision you no longer have to make.**
Before `Optional` and before `JdbcClient` there was no better option. There is now,
and a `findBy…` returning `Optional<T>` documents the possibility of absence in the
signature rather than in the caller's memory.

**`EmptyResultDataAccessException` is non-transient, so a retry loop will not
help.** It sits under `NonTransientDataAccessException`, correctly: the row is not
going to appear because you asked again. If you find it inside a retry wrapper,
something has confused "not found" with "temporarily unavailable".

## Interview questions

**★ Why does `queryForObject` throw instead of returning `null` when there is no
row?**
Because the method's contract is "exactly one row" — its javadoc says it throws
`IncorrectResultSizeDataAccessException` "if the query does not return exactly one
row". Under the covers it runs an ordinary query, gets a `List`, and applies
`DataAccessUtils`, which throws `EmptyResultDataAccessException(1)` for an empty
collection and `IncorrectResultSizeDataAccessException(1, size)` for more than one.
Returning `null` would collapse "no such row" into the same value as "one row whose
column was SQL NULL", which are genuinely different outcomes — and `queryForObject`
does return `null` for the second of those.

**★ What is wrong with catching the exception and returning `null`?**
It depends which exception you catch, and the dangerous version is very easy to
write. `EmptyResultDataAccessException` extends
`IncorrectResultSizeDataAccessException`, so a catch on the parent also catches the
two-rows case. That case is not "not found" — it is a broken invariant, usually a
missing or dropped unique constraint — and converting it to `null` makes a data
integrity bug present itself as an ordinary miss. If you must catch, catch the
subclass. Better, use `JdbcClient`'s `.optional()`, which expresses "at most one"
directly and still throws on two.

**★ What is the difference between `.single()` and `.optional()`?**
Only the zero-row case. `.single()` requires exactly one and throws
`EmptyResultDataAccessException` when there are none; `.optional()` requires at most
one and returns `Optional.empty()`. Both throw
`IncorrectResultSizeDataAccessException` on two or more. As of 6.2 `.single()` also
enforces that the mapped value is non-null, which matters for single-column queries
that can legitimately return SQL `NULL`. So `.single()` is for lookups whose absence
would mean a bug, and `.optional()` is for lookups whose absence is a normal
outcome — which is most `findBy…` methods.

**★ Can `select count(*) from t` throw `EmptyResultDataAccessException`?**
No. An aggregate with no `GROUP BY` always returns exactly one row — for an empty
table that row contains zero. So `queryForObject(sql, Long.class)` on a plain count
is safe and a catch block around it never runs. It changes the moment you add a
`GROUP BY`, because then a query matching no groups returns no rows at all. That
distinction catches people out in both directions: defensive code around a plain
count, and no handling at all around a grouped one.

**★ When does `queryForObject` return `null` rather than throwing?**
When the query returns exactly one row and the value in it is SQL `NULL`. The
javadoc for the `Class`-typed overload says it returns "the result object of the
required type, or `null` in case of SQL NULL". `select max(placed_at) from orders
where customer_id = ?` for a customer with no orders is the everyday example: one
row, one `NULL`. That is different from an empty result and should usually be
handled differently — and on `JdbcClient` you would use `.optional()`, which covers
both without you having to distinguish them.

**★ Two rows came back from a `findByEmail`. What has actually gone wrong?**
Almost always a missing uniqueness guarantee in the database. The Java code assumed
"at most one" and only the schema can enforce it — a unique index or constraint on
`email`. Either it was never created, or it was created on a case-sensitive column
while the application treats addresses case-insensitively, or a migration dropped
it. The right response is not to make the query tolerate duplicates; it is to add
the constraint, clean the data, and leave the exception in place so that the next
occurrence is loud.

**★ Would you ever retry an `EmptyResultDataAccessException`?**
No. It sits under `NonTransientDataAccessException`, whose javadoc says a retry
"would fail unless the cause of the Exception is corrected" — and the row not
existing is not going to be corrected by asking again. If it ever appears to work,
you have a different problem: something else is writing the row concurrently and
your code is racing it, which is a design issue rather than something a retry policy
should paper over.

---

← Prev: [6c · On PostgreSQL](06c-what-to-catch-on-postgresql.md) · Index: [05 · SQL-first access](README.md) · Next → [8 · Writes and keys](08-writes-and-generated-keys.md)
