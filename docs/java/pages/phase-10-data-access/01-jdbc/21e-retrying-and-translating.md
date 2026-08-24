---
title: "There are exactly three things to do with a `SQLException`, and the one everybody actually does is not on the list"
sidebar_label: "21e · Retrying and translating"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Serialization Failure Handling*
> (postgresql.org/docs/18/mvcc-serialization-failure-handling.html) and *Appendix A.
> PostgreSQL Error Codes* (postgresql.org/docs/18/errcodes-appendix.html); the JDK 25
> API documentation for `java.sql.SQLException` and `java.sql.SQLRecoverableException`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/); and the pgJDBC source for
> `PSQLException` plus the pgJDBC *Connection Parameters* documentation
> (github.com/pgjdbc/pgjdbc, jdbc.postgresql.org/documentation/use/). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**Chunks [21](21-sqlexception.md) through [21d](21d-the-chain-and-what-to-do.md) were
about reading a `SQLException`. This one is about the decision that follows, and there
are only three legitimate answers: **retry it**, **translate it**, or **let it
propagate**. Everything else — returning `null`, logging and continuing, catching
`Exception`, rethrowing just the message — destroys information that the previous four
chunks were entirely about preserving, and does so in a way that no test catches and no
compiler warns about. The two answers with real substance are retry, where PostgreSQL's
manual tells you precisely which codes qualify and, more importantly, that the unit of
retry is the whole transaction rather than the statement; and translation, where one
boundary in the data-access layer keeps `java.sql` and `org.postgresql` out of every
class above it. Get those two right and the fourth chunk's chain-walking has somewhere
to deliver its findings.**

## Catch it once, at the boundary, and translate

🔴 **`org.postgresql` must not appear in an import above your DAO.** The rich driver
type from [chunk 21c](21c-what-pgjdbc-throws.md) is genuinely useful, which is exactly
how it spreads: one service class unwraps a `PSQLException` "just this once", and now
the service layer cannot be tested without PostgreSQL, cannot be pointed at another
database without touching business logic, and makes decisions on driver fields that
belong to persistence. Unwrap where the SQL lives, throw a domain exception, and
enforce the boundary with an architecture test that forbids the import above it. That
is [Phase 5's translation pattern](../../phase-5-exceptions/04-custom-exceptions-translation.md)
applied to JDBC, and the reason it comes up so often here is
[the same one that makes `SQLException` awkward inside lambdas](../../phase-5-exceptions/06-checked-exceptions-lambdas.md) —
a checked exception forces a decision at every call site, and the path of least
resistance is to absorb it.

**What a framework does with all this, conceptually.** Spring's
`SQLExceptionSubclassTranslator` reads the JDBC subclass hierarchy from
[chunk 21b](21b-the-subclass-hierarchy.md) and falls back to SQLState-class translation
when the driver does not populate it; `SQLErrorCodeSQLExceptionTranslator` maps vendor
codes from a per-database table — and therefore does nothing useful on PostgreSQL,
where `getErrorCode()` is always `0`. Both produce one unchecked hierarchy
(`DuplicateKeyException`, `DeadlockLoserDataAccessException`,
`CannotAcquireLockException`, and so on) so callers never see `SQLException`. The
mechanism is not magic; it is exactly the two-tier strategy this topic has been
building, written once.

## Retrying: the shape, and which codes deserve it

The PostgreSQL manual is unusually direct about which errors are worth a retry.
`40001 serialization_failure` is the canonical one: applications using Repeatable Read
or Serializable *"must be prepared to retry transactions that fail due to serialization
errors"*, and the manual says it is *"recommendable to just retry serialization_failure
errors unconditionally"*. `40P01 deadlock_detected` is second — *"It may also be
advisable to retry deadlock failures."* And `23505 unique_violation` and
`23P01 exclusion_violation` are a qualified third: sometimes appropriate, because *"if
the application selects a new value for a primary key column after inspecting the
currently stored keys, it could get a unique-key failure because another application
instance selected the same new key concurrently. This is effectively a serialization
failure"* — but with the warning that *"more care is needed when retrying these other
error codes, since they might represent persistent error conditions rather than
transient failures."*

🔴 **The scope of a retry is the whole transaction, not the statement.** The manual is
explicit: *"It is important to retry the complete transaction, including all logic that
decides which SQL to issue and/or which values to use. Therefore, PostgreSQL does not
offer an automatic retry facility, since it cannot do so with any guarantee of
correctness."*

```java
for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try (Connection c = dataSource.getConnection()) {      // a FRESH connection
        c.setAutoCommit(false);
        var input = readInputs(c);                          // the reads are inside
        applyBusinessRules(c, input);                       // so is the decision logic
        c.commit();
        return;
    } catch (SQLException e) {
        if (!isRetryable(e) || attempt == MAX_ATTEMPTS) throw e;
        sleepWithJitter(attempt);                           // exponential backoff
    }
}
```

Four things that snippet gets right and most real code does not: the connection is
acquired *inside* the loop, so a `SQLRecoverableException` gets a new one; the reads and
the decision logic are inside the transaction, so a replay re-derives its values; the
attempts are capped; and the backoff is jittered, because synchronised retries after a
deadlock simply deadlock again.

⚠️ **Retries must be idempotent or transactional, and a transaction gives you that for
free — until it does not.** Anything with a side effect outside the database (an email,
a payment call, a Kafka publish) must not sit inside the retried block, or a
serialization failure sends it twice.

⚠️ **The manual also warns that a retry is not a guarantee:** *"Transaction retry does
not guarantee that the retried transaction will complete; multiple retries may be
needed. In cases with very high contention, it is possible that completion of a
transaction may take many attempts."*

## The four anti-patterns, and what each costs

```java
catch (SQLException e) { return null; }                      // ❌ 1
catch (SQLException e) { log.error("db error", e); }         // ❌ 2
catch (Exception e) { /* … */ }                              // ❌ 3
catch (SQLException e) { throw new RuntimeException(e.getMessage()); }  // ❌ 4
```

1. **Catch and return `null`** (or an empty list). A database outage becomes an empty
   catalogue, a missing user becomes "user not found", and the incident is diagnosed
   hours later from the wrong end. The caller cannot distinguish "no rows" from "the
   database is gone", because you erased the difference.
2. **Log and swallow.** Execution continues on the assumption the operation succeeded.
   Inside a transaction it is worse than useless — every subsequent statement fails with
   `25P02 in_failed_sql_transaction`, so you get one real error and a flood of noise.
3. **Catch `Exception`.** Sweeps up `NullPointerException`, `IllegalStateException` and
   anything else in the block, so a genuine bug gets reported as a database problem.
   Catch the narrowest type that you can actually handle.
4. **Rethrow the message only.** Drops the SQLState, the vendor code, the chain, the
   cause and the stack — everything this topic has been about. If you rethrow, pass the
   exception: `new DataAccessException("saving order " + id, e)`.

## Gotchas

**⚠️ Retrying the statement instead of the transaction**
**Symptom:** a retry that produces `25P02 in_failed_sql_transaction`, or — worse —
succeeds and leaves a half-applied unit of work.
**Cause:** on `40001` or `40P01` the database has already rolled the whole transaction
back. There is nothing to resume.
**Fix:** retry the outermost transactional boundary, re-reading and re-deciding inside
it, exactly as the manual instructs.

**⚠️ Retrying without a cap, backoff or jitter**
**Symptom:** a deadlock storm that gets worse under load, and a connection pool drained
by retrying threads.
**Cause:** two transactions that deadlocked will re-run at the same instant and deadlock
again.
**Fix:** cap the attempts, back off exponentially, add jitter, and surface the failure
after the cap rather than looping forever.

**⚠️ A side effect inside the retried block**
**Symptom:** two confirmation emails, or a payment charged twice, after a
`serialization_failure` that the retry loop handled "successfully".
**Cause:** the transaction rolls back the database work and nothing else.
**Fix:** move external calls outside the transaction, or make them idempotent with a key
recorded in the same transaction.

**⚠️ Treating class `23` as retryable because a race can produce it**
**Symptom:** a loop that hammers the database re-inserting a row that will never be
insertable, starving the pool.
**Cause:** `23505` *looks* transient in a race and usually is not.
**Fix:** the manual's own guidance — retry `serialization_failure` unconditionally, but
take more care with `23505` and `23P01` since they *"might represent persistent error
conditions rather than transient failures"*. Retry it only where your own
read-then-write generated the value, and cap it hard.

**⚠️ Logging the raw message into an HTTP response**
**Symptom:** a `42703 undefined_column` telling an attacker your column names, or a
`23505` echoing another user's email address back to a stranger.
**Cause:** the message contains schema identifiers and, via PostgreSQL's `Detail` field,
actual data.
**Fix:** log the full exception server-side with a correlation id; return a code and the
id. pgJDBC itself makes this distinction — its constructor chooses between
`serverError.toString()` and `serverError.getNonSensitiveErrorMessage()`.

**⚠️ Catching `SQLException` in every DAO method**
**Symptom:** try/catch in fifty methods, each logging and returning something plausible,
and a database outage that looks like a quiet day.
**Cause:** the checked exception forces a decision at every call site.
**Fix:** one translation boundary for the whole data-access layer; everything above it
works with your own unchecked types.

## Interview questions

**★ Which PostgreSQL errors are genuinely safe to retry, and what exactly do you retry?**
Two unconditionally and a third with care. `40001 serialization_failure` is the
canonical one — the manual states that applications using Repeatable Read or
Serializable must be prepared to retry transactions that fail with it, and that it is
recommendable to retry those unconditionally. `40P01 deadlock_detected` is second; the
manual says it may also be advisable. The third is `23505 unique_violation` and
`23P01 exclusion_violation`, which the manual says is *sometimes* appropriate — its
example is an application that picks a new key after inspecting the existing ones and
races another instance, which is effectively a serialization failure the server cannot
see as one — but it warns explicitly that these might represent persistent conditions
rather than transient ones. As for what you retry: the **complete transaction**,
including the logic that decided which SQL to issue and which values to use. The manual
says exactly that, and gives the reason PostgreSQL ships no automatic retry facility —
it cannot replay your decisions, so it cannot guarantee correctness.

**★ Write a correct retry loop and defend each part of it.**
Acquire the connection *inside* the loop, because `SQLRecoverableException` is documented
as requiring at minimum that you close the current connection and get a new one — a loop
that reuses one connection cannot recover from connection loss. Put the reads and the
business decisions inside the transaction, because retrying only the write replays values
derived from a snapshot that no longer holds, which is precisely the anomaly
serialization checking exists to prevent. Cap the attempts, because the manual warns that
completion is not guaranteed and high contention may need many attempts — an uncapped
loop turns contention into an outage. Back off exponentially *with jitter*, because two
transactions that just deadlocked will otherwise retry in lockstep and deadlock again.
And keep every side effect that is not a database write outside the block, because
rollback undoes the database and not the email you sent.

**★ Where should a `SQLException` be caught, and what should happen to it there?**
Once, at the data-access boundary, and it should be translated — never swallowed. The
argument is that `SQLException` is a persistence-mechanism detail: a service class that
catches it either has to know SQLState codes, which couples business logic to the
database, or handles it generically, which is indistinguishable from ignoring it.
Catching it in every DAO method is the failure mode this produces in practice — fifty
try/catch blocks, each logging and returning `null` or an empty list, so a database
outage presents as an empty catalogue and gets diagnosed hours later. Instead, the DAO
inspects the SQLState (and, on PostgreSQL, the structured `ServerErrorMessage`), maps
known conditions to domain exceptions like `EmailAlreadyRegisteredException`, wraps the
rest in one unchecked type *passing the original exception as the cause*, and lets it
propagate to a single global handler that logs the full detail with a correlation id and
returns a code. Frameworks package exactly this: Spring's translators map JDBC subclasses
or SQLState to an unchecked `DataAccessException` hierarchy so callers never import
`java.sql`.

**★ Someone rethrows `new RuntimeException(e.getMessage())`. What has been lost?**
Everything that makes the error diagnosable. The SQLState — the only portable,
non-localised identifier for what actually happened. The vendor code, where the driver
supplies one. The whole `getNextException` chain, so on a batch failure you lose every
error after the first. The cause, and with it any underlying `IOException` from a dead
socket. The original stack trace, which is replaced by one starting at the rethrow, so
the log points at the translation layer rather than the query. And on PostgreSQL, the
`ServerErrorMessage` with the constraint, table and column names. What survives is one
line of prose that may be localised and may contain user data — the single least useful
and most dangerous field on the object. The fix is one character of extra typing: pass
the exception as the cause, and add context in the message rather than replacing it.

**★ You see thousands of `25P02` in the logs after one real error. What happened, and
what is the fix?**
Someone caught an exception inside a transaction and kept going. PostgreSQL aborts a
transaction on the first error and then refuses every subsequent statement with
`25P02 in_failed_sql_transaction` until a rollback — including the statements the
recovery code issues. So one genuine failure produces a cascade, and the real diagnosis
sits hundreds of lines above the noise where nobody looks. The structural fix is that
any `SQLException` inside a transaction ends the transaction: roll back and propagate.
If the requirement genuinely is to continue past a failing statement — a bulk import
where one bad row should not kill the run — the mechanism is an explicit `SAVEPOINT`
before each statement and a rollback to it on failure, which is also what pgJDBC's
`autosave=always` connection parameter does automatically. It is not free: a savepoint
per statement costs round trips and server-side resources, which is why the driver's
default is `never`.

---
← Prev: [21d · The chain and the cause](21d-the-chain-and-what-to-do.md) · Index: [JDBC](README.md) · Next → [22 · Client-side timeouts](22-timeouts-cancellation-metadata.md)
