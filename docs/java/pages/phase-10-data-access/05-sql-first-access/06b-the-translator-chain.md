---
title: "Two unrelated mechanisms are both called \"exception translation\", and `@Repository` only turns on the one `JdbcTemplate` never needed"
sidebar_label: "6b · The translator chain"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access → DAO
> Support* and *JDBC Core Classes*
> ([docs.spring.io/.../dao.html](https://docs.spring.io/spring-framework/reference/data-access/dao.html),
> [.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)),
> the `JdbcAccessor`, `SQLExceptionSubclassTranslator` and
> `SQLStateSQLExceptionTranslator` source in spring-framework `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/support/JdbcAccessor.java)),
> and the `PersistenceExceptionTranslationPostProcessor` javadoc
> ([docs.spring.io/.../dao/annotation/PersistenceExceptionTranslationPostProcessor.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/annotation/PersistenceExceptionTranslationPostProcessor.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**"Exception translation" names two different things in Spring, and they run in
different places for different technologies. `JdbcTemplate` translates
`SQLException` itself, inside the template, with no annotation and no proxy. The
`@Repository` annotation switches on a *separate* AOP-based mechanism that
translates native ORM exceptions. Putting `@Repository` on a `JdbcTemplate` DAO in
order to get translation is a very common belief and it does nothing — the
translation was already happening.**

## Mechanism 1 — inside the template, for JDBC

The reference lists it among the things `JdbcTemplate` does: "Catching JDBC
exceptions and translating them to the generic `org.springframework.dao` exception
hierarchy." No annotation, no proxy, no configuration. Every `query`, `update` and
`execute` call is wrapped.

The translator it uses is chosen lazily in `JdbcAccessor.getExceptionTranslator()`,
and the logic is two lines:

1. if `SQLErrorCodeSQLExceptionTranslator.hasUserProvidedErrorCodesFile()` →
   `new SQLErrorCodeSQLExceptionTranslator(dataSource)`
2. otherwise → `new SQLExceptionSubclassTranslator()`

which matches the reference:

> "`SQLErrorCodeSQLExceptionTranslator` is the implementation of
> `SQLExceptionTranslator` that is used by default when a file named
> `sql-error-codes.xml` is present in the root of the classpath."

and

> "As of 6.0, the default exception translator is `SQLExceptionSubclassTranslator`,
> detecting JDBC 4 `SQLException` subclasses with a few extra checks, and with a
> fallback to `SQLState` introspection through `SQLStateSQLExceptionTranslator`."

**So in a normal application, with no `sql-error-codes.xml`, the chain is:**

```
SQLException
   │
   ├─ SQLExceptionSubclassTranslator      does the driver throw JDBC 4 subclasses?
   │        │ no mapping → null
   │        ▼
   └─ SQLStateSQLExceptionTranslator      what is the SQLSTATE class (first 2 chars)?
            │ no mapping → null
            ▼
     UncategorizedSQLException            "something went wrong"
```

### Step one: the JDBC 4 subclass

`SQLExceptionSubclassTranslator` reads the `SQLException`'s *Java class*:

| `java.sql` subclass | Spring exception |
|---|---|
| `SQLTransientConnectionException` | `TransientDataAccessResourceException` |
| `SQLTransactionRollbackException` | `CannotAcquireLockException` / `PessimisticLockingFailureException` |
| `SQLTimeoutException` | `QueryTimeoutException` |
| `SQLNonTransientConnectionException` | `DataAccessResourceFailureException` |
| `SQLDataException` | `DataIntegrityViolationException` |
| `SQLIntegrityConstraintViolationException` | `DuplicateKeyException` / `DataIntegrityViolationException` |
| `SQLInvalidAuthorizationSpecException` | `PermissionDeniedDataAccessException` |
| `SQLSyntaxErrorException` | `BadSqlGrammarException` |
| `SQLFeatureNotSupportedException` | `InvalidDataAccessApiUsageException` |
| `SQLRecoverableException` | `RecoverableDataAccessException` |

Its own javadoc admits the limitation: it "falls back to a standard
`SQLStateSQLExceptionTranslator` if the JDBC driver does not actually expose JDBC 4
compliant `SQLException` subclasses."

🔴 **pgJDBC is such a driver.** It throws `PSQLException` for essentially
everything rather than the JDBC 4 subclasses — the argument is in
**[What pgJDBC throws](../01-jdbc/21c-what-pgjdbc-throws.md)** — so on PostgreSQL
step one almost always returns `null` and the real work is step two.

### Step two: the SQLSTATE class

`SQLStateSQLExceptionTranslator` "analyzes the SQL state in the `SQLException`
based on the first two digits (the SQL state 'class')". The sets are in the source:

| Set | Class codes | Result |
|---|---|---|
| `BAD_SQL_GRAMMAR_CODES` | `07` `21` `2A` `37` `42` `65` | `BadSqlGrammarException` |
| `DATA_INTEGRITY_VIOLATION_CODES` | `01` `02` `22` `23` `27` `44` | `DataIntegrityViolationException` |
| `PESSIMISTIC_LOCKING_FAILURE_CODES` | `40` `61` | `CannotAcquireLockException` |
| `DATA_ACCESS_RESOURCE_FAILURE_CODES` | `08` `53` `54` `57` `58` | `DataAccessResourceFailureException` |
| `TRANSIENT_DATA_ACCESS_RESOURCE_CODES` | `JW` `JZ` `S1` | `TransientDataAccessResourceException` |

It also unwraps a `BatchUpdateException` to reach the nested SQLSTATE, and has a
specific check for `57014` — PostgreSQL's `query_canceled` — as a query timeout.

Compare that table with the SQLSTATE classes in
**[`SQLException`](../01-jdbc/21-sqlexception.md)** and the mapping is unsurprising:
class `23` is integrity constraint violation, class `40` is transaction rollback,
class `08` is connection exception. Spring is reading the standard.

## Mechanism 2 — the AOP one, for ORM

`@Repository` plus `PersistenceExceptionTranslationPostProcessor` is a completely
different machine. Its javadoc:

> "Bean post-processor that automatically applies persistence exception translation
> to any bean marked with Spring's `@Repository` annotation, adding a corresponding
> `PersistenceExceptionTranslationAdvisor` to the exposed proxy… Autodetects beans
> that implement the `PersistenceExceptionTranslator` interface, which are
> subsequently asked to translate candidate exceptions."

and, crucially, what supplies those translators:

> "All of Spring's applicable resource factories (for example,
> `LocalContainerEntityManagerFactoryBean`) implement the
> `PersistenceExceptionTranslator` interface out of the box."

So this mechanism proxies your repository, catches the *native* exception a JPA or
Hibernate call threw, and asks the entity manager factory to translate it. In Spring
Boot it is switched on for you: `PersistenceExceptionTranslationAutoConfiguration`
registers the post-processor under `spring.dao.exceptiontranslation.enabled`, with
`matchIfMissing = true`.
*(Confirmed against the Spring Boot API javadoc for that class; the page for 4.1
was not reachable in this pass, and the annotation has been stable since 1.5.)*

🔴 **A `JdbcTemplate` DAO does not need it and does not use it.** By the time an
exception leaves `jdbcTemplate.update(...)` it is already a `DataAccessException` —
there is no native exception left for the advisor to translate. Keep `@Repository`
on the class for the stereotype and component scanning; just do not believe it is
what makes translation work.

## Changing the translation

Two documented routes, both worth knowing and both rarely needed.

**Per template**, by subclassing and overriding `customTranslate`:

```java
public class CustomSQLErrorCodesTranslator extends SQLErrorCodeSQLExceptionTranslator {

    protected DataAccessException customTranslate(String task, String sql, SQLException sqlEx) {
        if (sqlEx.getErrorCode() == -12345) {
            return new DeadlockLoserDataAccessException(task, sqlEx);
        }
        return null;
    }
}
```

then `jdbcTemplate.setExceptionTranslator(tr)`. Returning `null` means "I have
nothing to say", and the normal chain continues.

⚠️ **That example is from the reference and it is Oracle-shaped.** It switches on
`getErrorCode()`, which on PostgreSQL is always `0` —
**[What pgJDBC throws](../01-jdbc/21c-what-pgjdbc-throws.md)**. A custom translator
for PostgreSQL must switch on `getSQLState()`, and that is
[chunk 6c](06c-what-to-catch-on-postgresql.md).

**Globally**, by putting a `sql-error-codes.xml` in the classpath root — which also
silently switches the whole application from subclass translation to error-code
translation, because that is what `hasUserProvidedErrorCodesFile()` checks. On
PostgreSQL that is a downgrade, for the same reason.

## Gotchas

**`@Repository` does not enable exception translation for `JdbcTemplate`.** The
annotation adds an AOP advisor that translates *native* exceptions from ORM
resource factories. `JdbcTemplate` has already translated by the time the exception
leaves it. The belief is harmless in effect and harmful in reasoning: people remove
`@Repository` "to test" and see no change, then conclude translation is not
happening at all.

**Dropping a `sql-error-codes.xml` into the classpath changes the translator for
the entire application.** `JdbcAccessor` checks for the file, not for whether it
mentions your database. Adding one for a legacy Oracle module silently moves every
`JdbcTemplate` in the process — including the PostgreSQL ones — onto error-code
translation, which on PostgreSQL classifies almost nothing because `getErrorCode()`
is always `0`.

**A custom translator returning `null` is correct, not a bug.** `customTranslate`
returning `null` means "not mine", and the chain continues to the standard rules.
People sometimes return `new UncategorizedSQLException(...)` from the default branch
to be helpful, which short-circuits everything the standard translator would have
done.

**The subclass translator is nearly inert on PostgreSQL.** Every table of "which
`SQLException` subclass maps to what" is accurate and largely irrelevant here,
because pgJDBC does not throw those subclasses. If you are reasoning about what your
application will catch on PostgreSQL, reason about SQLSTATE classes.

**`DataIntegrityViolationException` from class `01` looks wrong and is
deliberate.** SQLSTATE class `01` is "warning" and `02` is "no data", yet both sit
in `DATA_INTEGRITY_VIOLATION_CODES`. That is Spring's choice, not a standard
mapping, and it is worth knowing before you write a `catch` that assumes a class-23
constraint violation.

**Translation happens per call, not per transaction.** Each `JdbcTemplate`
operation translates its own failure. So in a transaction where several statements
fail, you see the exception from the first one to throw — and on PostgreSQL every
subsequent statement in that transaction reports a *different*, misleading error,
which is
**[The aborted transaction](../03-jdbc-transactions/10-the-aborted-transaction.md)**.

## Interview questions

**★ How does `JdbcTemplate` turn a `SQLException` into a `DataAccessException`?**
It catches the `SQLException` around every operation and passes it to a
`SQLExceptionTranslator`. Which translator it holds is decided lazily in
`JdbcAccessor.getExceptionTranslator()`: if a `sql-error-codes.xml` exists in the
classpath root it builds a `SQLErrorCodeSQLExceptionTranslator`, otherwise — the
normal case since 6.0 — a `SQLExceptionSubclassTranslator`. That one inspects the
Java class of the exception, mapping the JDBC 4 subclasses onto Spring's hierarchy,
and if it recognises nothing it falls back to `SQLStateSQLExceptionTranslator`,
which looks at the first two characters of the SQLSTATE. If that also fails you get
an `UncategorizedSQLException`.

**★ Does `@Repository` enable exception translation?**
For ORM code, yes; for `JdbcTemplate`, no — and this is the most commonly muddled
point in the whole area. `@Repository` is picked up by
`PersistenceExceptionTranslationPostProcessor`, which proxies the bean and adds an
advisor that asks `PersistenceExceptionTranslator` beans — such as
`LocalContainerEntityManagerFactoryBean` — to translate native JPA or Hibernate
exceptions. `JdbcTemplate` translates inside itself, before the exception ever
crosses the repository boundary, so there is nothing left for the advisor to do.
Keep the annotation for the stereotype; do not credit it with the translation.

**★ Which translator actually does the work on PostgreSQL?**
`SQLStateSQLExceptionTranslator`, almost always. The default chain starts with
`SQLExceptionSubclassTranslator`, which inspects the JDBC 4 `SQLException`
subclasses — but pgJDBC throws `PSQLException` rather than those subclasses, so that
step usually returns `null` and control falls through. The SQLSTATE translator then
takes the first two characters of the state: class `23` becomes
`DataIntegrityViolationException`, class `40` becomes `CannotAcquireLockException`,
class `08` becomes `DataAccessResourceFailureException`, class `42` becomes
`BadSqlGrammarException`. That is why SQLSTATE is the thing to know on PostgreSQL
and vendor error codes are not.

**★ How would you make a specific constraint violation produce your own exception?**
Subclass the translator and override `customTranslate(String task, String sql,
SQLException ex)`, returning your exception when it matches and `null` when it does
not so the standard chain continues, then install it with
`jdbcTemplate.setExceptionTranslator(...)`. The reference's own example switches on
`getErrorCode()`, which is an Oracle idiom — on PostgreSQL that value is always
zero, so the check has to be on `getSQLState()`, or on the constraint name that
pgJDBC's `PSQLException` exposes through its server error message.

**★ What is `sql-error-codes.xml` and should you add one?**
It is the configuration file for `SQLErrorCodeSQLExceptionTranslator`, mapping
vendor-specific numeric error codes to Spring exceptions, and Spring ships defaults
for a number of databases. Its presence in the classpath root is what makes
`JdbcAccessor` choose error-code translation over subclass translation — for the
whole application, not just the module that added it. On PostgreSQL I would not add
one: `getErrorCode()` is always `0` there, so error-code translation has nothing to
work with and you have quietly disabled the SQLSTATE path that was doing the job.

**★ What happens when no translator can classify an exception?**
You get an `UncategorizedSQLException`, a subclass of
`UncategorizedDataAccessException`, whose javadoc describes it as the case where "we
can't distinguish anything more specific than 'something went wrong with the
underlying resource'". The original `SQLException` is retained as the cause, so
nothing is lost — but the category is gone, which means a retry policy or an error
handler keyed on the hierarchy cannot act on it. Repeated occurrences are worth
investigating: usually a SQLSTATE class Spring has no rule for, which you can then
handle with a custom translator.

---

← Prev: [6 · The exception hierarchy](06-the-exception-hierarchy.md) · Index: [SQL-first access](README.md) · Next → [6c · On PostgreSQL](06c-what-to-catch-on-postgresql.md)
