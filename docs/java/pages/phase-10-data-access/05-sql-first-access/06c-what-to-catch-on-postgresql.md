---
title: "On PostgreSQL every translated exception comes from five characters, and three of the errors you meet most often have no mapping at all"
sidebar_label: "6c · On PostgreSQL"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `SQLStateSQLExceptionTranslator` source in
> spring-framework `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/support/SQLStateSQLExceptionTranslator.java)),
> the `org.springframework.dao` package javadoc
> ([docs.spring.io/.../dao/package-summary.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/package-summary.html)),
> and the PostgreSQL 18 manual *Appendix A · PostgreSQL Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, Spring Framework 7.0.9, PostgreSQL 18, pgJDBC 42.7.x.

**Because pgJDBC does not throw the JDBC 4 `SQLException` subclasses and always
reports `getErrorCode()` as `0`, the entire translation on PostgreSQL comes down to
the SQLSTATE — and mostly to its first two characters. That makes the mapping
completely predictable, which is useful, and it also means you can work out in
advance which errors Spring will hand you as `UncategorizedSQLException`. There are
three common ones, and two of them are errors you will definitely meet.**

## The mapping, error by error

Spring checks `23505` exactly, and everything else by SQLSTATE *class* — the first
two characters.

| SQLSTATE | PostgreSQL condition | Spring exception | Branch |
|---|---|---|---|
| `23505` | `unique_violation` | **`DuplicateKeyException`** | non-transient |
| `23503` | `foreign_key_violation` | `DataIntegrityViolationException` | non-transient |
| `23502` | `not_null_violation` | `DataIntegrityViolationException` | non-transient |
| `23514` | `check_violation` | `DataIntegrityViolationException` | non-transient |
| `22001` | `string_data_right_truncation` | `DataIntegrityViolationException` | non-transient |
| `40001` | `serialization_failure` | **`CannotAcquireLockException`** | **transient** |
| `40P01` | `deadlock_detected` | **`CannotAcquireLockException`** | **transient** |
| `42601` | `syntax_error` | `BadSqlGrammarException` | non-transient |
| `42P01` | `undefined_table` | `BadSqlGrammarException` | non-transient |
| `42703` | `undefined_column` | `BadSqlGrammarException` | non-transient |
| `08006` | `connection_failure` | `DataAccessResourceFailureException` | non-transient |
| `08003` | `connection_does_not_exist` | `DataAccessResourceFailureException` | non-transient |
| `53300` | `too_many_connections` | `DataAccessResourceFailureException` | non-transient |
| `57014` | `query_canceled` | **`QueryTimeoutException`** | **transient** |

The `23505` row is worth pausing on, because it is the one place a specific state
rather than a class is matched. The helper is:

```java
static boolean indicatesDuplicateKey(@Nullable String sqlState, int errorCode) {
    return ("23505".equals(sqlState) ||
            ("23000".equals(sqlState) && DUPLICATE_KEY_ERROR_CODES.contains(errorCode)));
}
```

The first half is the standard SQLSTATE and works on any database that reports it —
including PostgreSQL. The second half is the vendor route, matching numeric error
codes, and it can never fire on PostgreSQL because `getErrorCode()` is always `0`
(**[What pgJDBC throws](../01-jdbc/21c-what-pgjdbc-throws.md)**). You get
`DuplicateKeyException` anyway, via the first half.

## The three that fall through

`UncategorizedSQLException` is what you get when no rule matches. Working from
Spring's class-code sets — `07 21 2A 37 42 65`, `01 02 22 23 27 44`, `40 61`,
`08 53 54 57 58`, `JW JZ S1` — these classes are **absent**:

| SQLSTATE | PostgreSQL condition | Class | You get |
|---|---|---|---|
| `55P03` | `lock_not_available` | `55` | `UncategorizedSQLException` |
| `25P02` | `in_failed_sql_transaction` | `25` | `UncategorizedSQLException` |
| `0A000` | `feature_not_supported` | `0A` | `UncategorizedSQLException` |

The first two matter a great deal.

**`55P03` is what `SELECT … FOR UPDATE NOWAIT` throws** when the row is locked, and
`FOR UPDATE NOWAIT` is a normal, deliberate pattern —
**[`NOWAIT`, `SKIP LOCKED` and scope](../03-jdbc-transactions/12b-nowait-skip-locked-and-scope.md)**.
So the one error your code exists to handle arrives with no useful type. You have to
catch `UncategorizedSQLException` and inspect the SQLSTATE, or install a custom
translator ([chunk 6b](06b-the-translator-chain.md)):

```java
public class PostgresTranslator extends SQLExceptionSubclassTranslator {

    @Override
    protected @Nullable DataAccessException doTranslate(String task, @Nullable String sql, SQLException ex) {
        if ("55P03".equals(ex.getSQLState())) {
            return new CannotAcquireLockException(buildMessage(task, sql, ex), ex);
        }
        return super.doTranslate(task, sql, ex);
    }
}
```

That is twelve lines and it puts `NOWAIT` failures back on the transient branch,
where a retry policy can see them.

**`25P02` is the aborted-transaction error** — every statement issued after a
failure in the same transaction reports it, which is
**[The aborted transaction](../03-jdbc-transactions/10-the-aborted-transaction.md)**.
It is uncategorised, which is arguably right: it is not itself a failure, it is the
echo of one. But it means a log full of `UncategorizedSQLException` is often a log
about one real error you have not found yet.

## What this buys you: a retry boundary that is correct

Class `40` — both `40001` and `40P01` — maps to `CannotAcquireLockException`, which
sits under `PessimisticLockingFailureException`, `ConcurrencyFailureException` and
finally `TransientDataAccessException`. So the generic retry from
[chunk 6](06-the-exception-hierarchy.md) catches serialization failures and
deadlocks and nothing else — which is exactly the rule argued in
**[Retrying safely](../03-jdbc-transactions/14-retrying-safely.md)**: class 40 is
the one that is a yes without conditions.

`57014` mapping to `QueryTimeoutException`, also transient, is the other one you may
want to retry — but only if you know the statement is idempotent and the timeout was
not a symptom of the load you are about to add to.

## Gotchas

**`FOR UPDATE NOWAIT` failures are uncategorised, and that surprises people who
chose `NOWAIT` precisely to handle contention.** Class `55` is in none of Spring's
sets. Until you add a translator, `catch (CannotAcquireLockException ex)` around a
`NOWAIT` query catches nothing and the failure escapes as an unrecognised runtime
exception.

**`DataIntegrityViolationException` on PostgreSQL does not tell you which
constraint.** Class `23` covers unique, foreign key, `NOT NULL` and `CHECK`
violations, and only the unique case is split out. To report "this email is already
registered" versus "that category does not exist" you need the constraint name,
which pgJDBC exposes on its own exception —
**[What pgJDBC throws](../01-jdbc/21c-what-pgjdbc-throws.md)** — reachable by
unwrapping the cause. Do not parse the message text.

**A retry on `CannotAcquireLockException` must restart the transaction, not the
statement.** On PostgreSQL a failed statement aborts the whole transaction, so
re-running the statement on the same connection gets you `25P02` forever. The retry
belongs outside the `@Transactional` boundary — see
**[Shaping the work](../04-spring-transactional/21b-shaping-the-work.md)**.

**Class `01` is "warning" and Spring maps it to a data integrity violation.** It is
in `DATA_INTEGRITY_VIOLATION_CODES` alongside `02`, `22`, `23`, `27` and `44`. That
is Spring's judgement, not the standard's, and it is worth knowing if you ever meet a
class-01 state and find yourself in a catch block you did not expect.

**`08` states are mapped to `DataAccessResourceFailureException`, which is
NON-transient.** A dropped connection is intuitively something to retry, and Spring
classifies it as non-transient because a retry on the *same* connection cannot
work. Retrying a connection failure is a job for the pool and for a policy that gets
a fresh connection, not for a `catch (TransientDataAccessException)`.

**`53300 too_many_connections` is a resource failure, not a timeout.** Pool
exhaustion inside HikariCP surfaces differently again — as a
`SQLTransientConnectionException` from the pool rather than from the server. The two
look similar in a log and have completely different causes; see
**[Connection pooling with HikariCP](../02-connection-pooling/README.md)**.

**The SQLSTATE is on the `SQLException`, which is the *cause*.** Spring's exception
does not expose `getSQLState()`. `UncategorizedSQLException` has a `getSQLException()`
accessor; for the rest you unwrap the cause. Any code that needs the state should get
it from there rather than from the message.

## Interview questions

**★ On PostgreSQL, what does Spring translate a unique constraint violation into?**
`DuplicateKeyException`. PostgreSQL reports SQLSTATE `23505` for
`unique_violation`, and `SQLStateSQLExceptionTranslator` checks that state
explicitly — `"23505".equals(sqlState)` — before falling through to the generic
class-23 rule. This is one of the few places the translator matches a full five
character state rather than the two-character class. The other half of the same
check, matching vendor error codes for SQLSTATE `23000`, can never fire on
PostgreSQL because pgJDBC always reports `getErrorCode()` as zero.

**★ Which PostgreSQL errors end up as `UncategorizedSQLException`, and does it
matter?**
Any whose SQLSTATE class is not in Spring's five sets. In practice the ones you meet
are `55P03` `lock_not_available`, `25P02` `in_failed_sql_transaction` and `0A000`
`feature_not_supported`. The first genuinely matters: `55P03` is what
`SELECT … FOR UPDATE NOWAIT` throws, which is a deliberate pattern for handling
contention, so the error you most want typed is the one that is not. The fix is a
small custom translator that maps `55P03` to `CannotAcquireLockException`, putting
it back on the transient branch where a retry policy can see it. `25P02` being
uncategorised is more defensible — it is the echo of an earlier failure rather than
a failure of its own.

**★ How do you tell a duplicate email from a missing foreign key?**
Not from the Spring exception, if both arrive as
`DataIntegrityViolationException` — and one of them will, since only `23505` is
split out into `DuplicateKeyException`. For anything finer you need the constraint
name, and pgJDBC carries it: unwrap the cause to the `PSQLException` and read the
server error message's constraint field. That is a real, structured value, unlike
parsing the human-readable text, which changes with the server locale. It is also an
argument for naming your constraints deliberately in migrations, because the name is
what your error handling will switch on.

**★ Which exceptions would you retry on PostgreSQL, and where?**
`CannotAcquireLockException`, which is what SQLSTATE class `40` becomes — both
`40001 serialization_failure` and `40P01 deadlock_detected`. Both are genuinely
transient: the same transaction re-run may well succeed, because the conflict was
with a concurrent transaction that has now finished. Possibly also
`QueryTimeoutException` from `57014`, if the operation is idempotent. Where matters
more than which: the retry has to be outside the transaction boundary and restart
the whole transaction, because on PostgreSQL the first failed statement aborts the
transaction and everything after it reports `25P02`.

**★ Why is a connection failure classified as non-transient?**
Because the classification is about whether retrying *the same operation* can
succeed with no intervention, and a broken connection cannot carry another attempt.
Class `08` maps to `DataAccessResourceFailureException`, under
`NonTransientDataAccessResourceException`. That is not a claim that the database
will never come back — it is a claim that the fix is not "try again on this
connection". Recovering from it means getting a new connection, which is the pool's
job, and a policy that operates above the level Spring's hierarchy is describing.

**★ Where do you get the SQLSTATE from, once Spring has translated the exception?**
From the cause. Spring's exceptions do not expose `getSQLState()`;
`UncategorizedSQLException` offers `getSQLException()`, and for the rest you unwrap
until you find the `SQLException`. This is deliberate — the hierarchy exists so that
application code does not switch on vendor strings — but when you are writing a
custom translator or diagnosing an uncategorised error, the state is the thing you
need, and it is one `getCause()` away.

---

← Prev: [6b · The translator chain](06b-the-translator-chain.md) · Index: [05 · SQL-first access](README.md) · Next → [7 · Empty results](07-queryforobject-and-empty.md)
