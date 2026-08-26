---
title: "The exception hierarchy is the real product — one checked, vendor-specific class becomes a tree whose shape is the retry decision"
sidebar_label: "6 · The exception hierarchy"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access → DAO
> Support*
> ([docs.spring.io/spring-framework/reference/data-access/dao.html](https://docs.spring.io/spring-framework/reference/data-access/dao.html))
> and the `org.springframework.dao` package javadoc
> ([docs.spring.io/.../dao/package-summary.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/package-summary.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18, pgJDBC 42.7.x.

**Most descriptions of Spring JDBC lead with the removal of boilerplate. That is
the smaller half. The larger half is that `SQLException` — one checked class
covering every possible database failure, whose meaning is hidden in a
vendor-specific string — is replaced by a tree of unchecked exceptions whose
*shape* encodes the only question application code ever really asks: is retrying
this worth anything?**

## What is wrong with `SQLException`

Three things, argued in full in
**[`SQLException`](../01-jdbc/21-sqlexception.md)**:

1. **It is checked**, so every method that touches JDBC either declares it or wraps
   it, and the wrapping is where information gets lost.
2. **It is one class** for a unique-constraint violation, a syntax error, a dead
   network connection and a lock timeout. Distinguishing them means reading a
   five-character SQLSTATE string.
3. **The values are vendor-specific** at the detail level, so code that switches on
   them is code that only works against one database.

`DataAccessException` fixes all three at once: unchecked, one class per kind of
failure, and the same classes whatever the store underneath is.

## The tree, and why its top three branches matter

```
DataAccessException                      (unchecked, root)
├── NonTransientDataAccessException      retry will fail again
│   ├── BadSqlGrammarException
│   ├── DataIntegrityViolationException
│   │   └── DuplicateKeyException
│   ├── DataRetrievalFailureException
│   │   └── IncorrectResultSizeDataAccessException
│   │       └── EmptyResultDataAccessException
│   ├── InvalidDataAccessApiUsageException
│   ├── NonTransientDataAccessResourceException
│   │   └── DataAccessResourceFailureException
│   └── PermissionDeniedDataAccessException
├── TransientDataAccessException         retry may succeed, unchanged
│   ├── ConcurrencyFailureException
│   │   ├── OptimisticLockingFailureException
│   │   └── PessimisticLockingFailureException
│   │       └── CannotAcquireLockException
│   ├── QueryTimeoutException
│   └── TransientDataAccessResourceException
└── RecoverableDataAccessException       retry may succeed after recovery steps
```

The three second-level classes are where the value is, and the javadoc for each
states the contract precisely:

| Branch | Javadoc |
|---|---|
| `NonTransientDataAccessException` | "…considered non-transient — where a retry of the same operation would fail unless the cause of the Exception is corrected." |
| `TransientDataAccessException` | "…considered transient — where a previously failed operation might be able to succeed when the operation is retried **without any intervention by application-level functionality**." |
| `RecoverableDataAccessException` | "…might be able to succeed if the application performs some recovery steps and retries the entire transaction…" |

🔴 **That is a retry policy expressed in the type system, and it has three values,
not two.** It mirrors the JDBC 4 `SQLException` subclass hierarchy exactly — see
**[The subclass hierarchy](../01-jdbc/21b-the-subclass-hierarchy.md)** — but it is
available on PostgreSQL, where the JDBC one effectively is not.

So a generic retry wrapper can be written once, correctly:

```java
<T> T withRetry(Supplier<T> work, int attempts) {
    for (int i = 1; ; i++) {
        try {
            return work.get();
        }
        catch (TransientDataAccessException ex) {
            if (i >= attempts) throw ex;
            // back off, then loop
        }
    }
}
```

⚠️ **Where that wrapper goes is not a free choice.** It must sit *outside* the
transaction boundary, restarting the whole transaction — a retry inside a
transaction that the database has already marked for rollback retries nothing. That
argument belongs to
**[Retrying safely](../03-jdbc-transactions/14-retrying-safely.md)** and
**[Shaping the work](../04-spring-transactional/21b-shaping-the-work.md)**.

## The leaves you will actually name

| Exception | Javadoc, verbatim |
|---|---|
| `DuplicateKeyException` | "…an attempt to insert or update data results in violation of a primary key or unique constraint." |
| `DataIntegrityViolationException` | "…fails to map the given data, typically but no[t] limited to an insert or update data results in violation of an integrity constraint." |
| `EmptyResultDataAccessException` | "…a result was expected to have at least one row (or element) but zero rows (or elements) were actually returned." |
| `IncorrectResultSizeDataAccessException` | "…a result was not of the expected size, for example when expecting a single row but getting 0 or more than 1 rows." |
| `CannotAcquireLockException` | "…failure to acquire a lock during an update, for example during a 'select for update' statement." |
| `QueryTimeoutException` | "Exception to be thrown on a query timeout." |
| `BadSqlGrammarException` | invalid SQL — an `InvalidDataAccessResourceUsageException` |
| `PermissionDeniedDataAccessException` | "…the underlying resource denied a permission to access a specific element…" |
| `UncategorizedDataAccessException` | "…when we can't distinguish anything more specific than 'something went wrong with the underlying resource'." |

Note the relationship in rows three and four: `EmptyResultDataAccessException`
**extends** `IncorrectResultSizeDataAccessException`. Zero rows is a special case of
"not the expected size". That inheritance is load-bearing and it is the subject of
[chunk 7](07-queryforobject-and-empty.md).

Two of these are deprecated as of 6.0.3 and should not appear in new code:
`DeadlockLoserDataAccessException` and `CannotSerializeTransactionException`, both
"in favor of `PessimisticLockingFailureException`/`CannotAcquireLockException`".

## Why unchecked was the right call

The usual objection is that unchecked exceptions can be forgotten. That is true and
it is the point. Ask what a caller can *do* about each kind:

- `BadSqlGrammarException` — nothing. The SQL is wrong; it is a deployment bug.
- `DataAccessResourceFailureException` — nothing local. The database is unreachable.
- `QueryTimeoutException` — nothing at this layer; possibly retry higher up.
- `DuplicateKeyException` — **something**: report "that email is taken".
- `EmptyResultDataAccessException` — **something**: return a 404.

Only the last two have a local handler, and both are specific classes you catch
deliberately. Forcing every method between the repository and the controller to
declare or wrap the other seven is pure cost, and the wrapping is where the type
information is destroyed. Unchecked lets the two you can act on be caught precisely
and the rest travel to one handler.

## Gotchas

**Catching `DataAccessException` around a repository call throws the design away.**
The whole value is in the subclasses. `catch (DataAccessException ex) { return
Optional.empty(); }` turns a syntax error, a dead database and a permission failure
into "not found". Catch the specific class, or catch nothing and let a
`@ControllerAdvice` map the hierarchy in one place.

**`DataIntegrityViolationException` is not always a duplicate key.** A foreign key
violation, a `NOT NULL` violation and a `CHECK` violation are all integrity
violations too. Code that catches it and reports "that value already exists" will
one day report that for a missing foreign key. Catch `DuplicateKeyException` — the
more specific subclass — when that is what you mean.

**A `TransientDataAccessException` is not a licence to retry blindly.** The class
says a retry *might* succeed without intervention; it says nothing about whether the
operation is idempotent, or about whether the transaction is still usable. On
PostgreSQL a failed statement poisons the whole transaction —
**[The aborted transaction](../03-jdbc-transactions/10-the-aborted-transaction.md)**
— so the retry has to restart from the transaction boundary.

**`UncategorizedDataAccessException` means "translation gave up", and it is a
signal.** Seeing one repeatedly means the translator could not classify a SQLSTATE
it keeps meeting. That is worth investigating rather than catching, because the
underlying error probably *does* have a category and you are losing it.

**The hierarchy does not survive being wrapped.** `catch (DataAccessException ex) {
throw new ServiceException(ex); }` in a service layer is common and destroys
everything this chunk is about — the controller can no longer distinguish a
duplicate key from a timeout without unwrapping causes by hand. If you must have a
service-level exception type, carry the category forward explicitly rather than
flattening it.

**The exception carries the SQL, and that can leak.** Spring's translated
exceptions include the statement and a task description in their message, which is
exactly what you want in a log and exactly what you do not want in an HTTP response
body. Map the hierarchy to responses in one place and never echo `ex.getMessage()`
to a client.

## Interview questions

**★ What is `DataAccessException` and why does Spring have its own hierarchy?**
It is the root of Spring's data access exception tree, and it exists to fix three
problems with `SQLException` at once. `SQLException` is checked, so it forces
declaration or wrapping through every layer; it is a single class for every kind of
failure, so distinguishing a duplicate key from a dead connection means parsing a
SQLSTATE string; and its detail codes are vendor-specific, so code that inspects
them is tied to one database. `DataAccessException` is unchecked, has one subclass
per kind of failure, and presents the same classes whether the store underneath is
JDBC, JPA or Hibernate. The reference makes the point that the original exception is
always wrapped, so nothing is lost.

**★ What is the difference between `TransientDataAccessException` and
`NonTransientDataAccessException`?**
Whether retrying the same operation could possibly help. The javadoc for the
non-transient branch says a retry "would fail unless the cause of the Exception is
corrected" — bad SQL, a constraint violation, a permission problem. The transient
branch says a previously failed operation "might be able to succeed when the
operation is retried without any intervention by application-level functionality" —
a lock that could not be acquired, a query timeout, a temporary resource failure.
There is a third branch, `RecoverableDataAccessException`, for the case where a
retry can work but only after the application takes some recovery step. So the
retry decision has three answers, not two, and it is encoded in the type rather than
in a lookup table you have to maintain.

**★ Which concrete exceptions would a real service catch?**
Very few, deliberately. `DuplicateKeyException`, because "that email is already
registered" is a real user-facing outcome. `EmptyResultDataAccessException`, if you
are on the `JdbcTemplate` API and need to turn a miss into a 404 — though with
`JdbcClient` you would use `.optional()` and not need the catch at all. Possibly
`CannotAcquireLockException` or `TransientDataAccessException` at a retry boundary
outside the transaction. Everything else — bad grammar, resource failure, permission
denied — has no local handler and should travel to a single `@ControllerAdvice`
that maps the hierarchy to responses.

**★ Why did Spring choose unchecked exceptions here?**
Because for almost all of these, the caller can do nothing. A `BadSqlGrammarException`
is a deployment bug, a `DataAccessResourceFailureException` means the database is
gone; neither has a meaningful local handler. Making them checked would force every
intervening method to declare or wrap them, and wrapping is precisely where the
category gets destroyed — a `ServiceException` cause chain is much harder to act on
than a `DuplicateKeyException`. Unchecked means the two or three you can genuinely
handle get caught by their specific type, and the rest reach one handler intact.

**★ `DataIntegrityViolationException` versus `DuplicateKeyException` — when does the
distinction matter?**
Whenever you are about to tell a user something. `DuplicateKeyException` is the
subclass for "primary key or unique constraint" specifically;
`DataIntegrityViolationException` is the parent and also covers foreign key
violations, `NOT NULL` violations and `CHECK` violations. Code that catches the
parent and reports "that value is already taken" is correct until the first foreign
key failure, at which point it lies to the user and hides a real bug. Catch the
subclass when you mean the subclass. If you need to distinguish among the other
integrity violations, you have to go to the SQLSTATE or, on PostgreSQL, to the
constraint name in the driver's own exception.

**★ Does the hierarchy work the same way for JPA and Hibernate?**
That is its whole reason for existing — the reference describes "a convenient
translation from technology-specific exceptions, such as `SQLException` to its own
exception class hierarchy" and lists JDBC, JPA and Hibernate as covered. So a
`DuplicateKeyException` from a `JdbcClient` insert and one originating in a
Hibernate flush are the same class, and a service that catches it works either way.
That matters most in exactly the situation of [chunk 11](11-mixing-both.md), where
one transaction contains both.

**★ What does `UncategorizedDataAccessException` tell you?**
That translation failed — the translator met a SQLSTATE it has no mapping for and
fell back to "something went wrong with the underlying resource", which is its own
javadoc's wording. It is not something to catch and handle; it is something to
investigate. Either the error genuinely has no category, or the translator in use is
not the one you think it is, or a driver is reporting something unusual. Repeated
occurrences of one are a good reason to look at what the actual SQLSTATE was.

---

← Prev: [5b · `IN` lists and the cache](05b-in-lists-and-the-statement-cache.md) · Index: [05 · SQL-first access](README.md) · Next → [6b · The translator chain](06b-the-translator-chain.md)
