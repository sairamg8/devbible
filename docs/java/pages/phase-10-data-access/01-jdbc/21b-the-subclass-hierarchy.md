---
title: "The subclass hierarchy puts \"is retrying worth it\" into the type system, and the answer has three values, not two"
sidebar_label: "21b · The `SQLException` hierarchy"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for `java.sql.SQLException`,
> `SQLNonTransientException`, `SQLTransientException`, `SQLRecoverableException`,
> `SQLIntegrityConstraintViolationException`, `SQLTransactionRollbackException`,
> `SQLSyntaxErrorException`, `SQLDataException`, `SQLTransientConnectionException`,
> `SQLNonTransientConnectionException`, `SQLInvalidAuthorizationSpecException`,
> `SQLFeatureNotSupportedException`, `SQLTimeoutException` and
> `SQLClientInfoException`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the PostgreSQL 18 manual
> *Appendix A. PostgreSQL Error Codes*
> (postgresql.org/docs/18/errcodes-appendix.html). JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**[Chunk 21](21-sqlexception.md) argued that SQLState is the field you read. JDBC 4.0
added a second mechanism on top of it: a hierarchy of `SQLException` subclasses that
encodes, in the *type system*, the one question you almost always want answered — is
this worth retrying, and if so, do I have to throw the connection away first? Three
branches answer it, and their javadocs say so in almost exactly those words, which is
what makes the hierarchy usable rather than decorative: you can read the policy off
the catch ladder without a lookup table. The design has one enormous caveat, and it is
big enough to have its own chunk —
[whether your driver populates the hierarchy at all is the driver's choice](21c-what-pgjdbc-throws.md),
and pgJDBC largely declines. Learn the hierarchy anyway. It is the vocabulary every
abstraction layer above JDBC is written in, and it is the shape your own translation
layer should imitate even when the driver does not hand it to you.**

## Three branches, and the middle one is the interesting one

Quoting the JDK 25 javadocs directly, because the wording *is* the specification:

- **`SQLNonTransientException`** — *"The subclass of `SQLException` thrown when an
  instance where a retry of the same operation would fail unless the cause of the
  `SQLException` is corrected."* → **do not retry.**
- **`SQLTransientException`** — *"The subclass of `SQLException` is thrown in
  situations where a previously failed operation might be able to succeed when the
  operation is retried without any intervention by application-level
  functionality."* → **retry as-is.**
- **`SQLRecoverableException`** — *"The subclass of `SQLException` thrown in
  situations where a previously failed operation might be able to succeed if the
  application performs some recovery steps and retries the entire transaction or in
  the case of a distributed transaction, the transaction branch. At a minimum, the
  recovery operation must include closing the current connection and getting a new
  connection."* → **retry, but throw the connection away first.**

🔴 **This is a three-way split, not a two-way one, and the third case is the one people
forget.** The intuitive model is "permanent vs temporary". The actual model adds a
third state: *the connection itself is suspect*. On a `SQLRecoverableException` the
javadoc is explicit that retrying is not enough — the recovery must, at a minimum,
close the current connection and get a new one. Retrying on the same `Connection` is
documented as insufficient, and in a pooled application that means **evicting** the
connection rather than returning it to the pool. That is the same failure mode as
[a connection that has silently died](04-connection-is-expensive.md), and the reason
pools validate on borrow.

⚠️ **Note what `SQLRecoverableException` says about scope.** It does not say retry the
statement; it says retry *the entire transaction*, or in a distributed setting the
transaction branch. That is not a stylistic preference — a transaction that failed
part-way has no meaning to resume from, and the values you would replay may have been
chosen by reads that are now stale.

## The leaves, and the SQLState class each one claims

Every leaf javadoc names the SQLState class it corresponds to, which is what makes the
two mechanisms interchangeable rather than competing — the hierarchy is a typed view
over the same classification chunk 21 read out of the string:

| Class | Branch | SQLState class | The javadoc's own words |
|---|---|---|---|
| `SQLIntegrityConstraintViolationException` | non-transient | `23` | *"an integrity constraint (foreign key, primary key or unique key) has been violated"* |
| `SQLSyntaxErrorException` | non-transient | `42` | *"the in-progress query has violated SQL syntax rules"* |
| `SQLDataException` | non-transient | `22` | *"various data errors, including but not limited to data conversion errors, division by 0, and invalid arguments to functions"* |
| `SQLInvalidAuthorizationSpecException` | non-transient | `28` | *"the authorization credentials presented during connection establishment are not valid"* |
| `SQLNonTransientConnectionException` | non-transient | `08` | *"…will not succeed if the operation is retried without the cause of the failure being corrected"* |
| `SQLFeatureNotSupportedException` | non-transient | `0A` | *"the JDBC driver does not support an optional JDBC feature"* |
| `SQLTransactionRollbackException` | transient | `40` | *"the current statement was automatically rolled back by the database because of deadlock or other transaction serialization failures"* |
| `SQLTransientConnectionException` | transient | `08` | *"…might be able to succeed if the operation is retried without any application-level changes"* |
| `SQLTimeoutException` | transient | — | *"thrown when the timeout specified by `Statement.setQueryTimeout`, `DriverManager.setLoginTimeout`, `DataSource.setLoginTimeout`, `XADataSource.setLoginTimeout` has expired"* |

Three rows deserve a second look.

⚠️ **Class `08` appears twice on purpose.** The SQLState alone cannot tell you whether
a connection failure is worth retrying — `08006 connection_failure` might be a network
blip, `08004 sqlserver_rejected_establishment_of_sqlconnection` will not fix itself —
so JDBC splits it by *intent* instead of by code. Where a driver populates these, the
subclass is strictly more informative than the five characters, and this is the single
best argument for the hierarchy existing at all.

⚠️ **`SQLTimeoutException` has no SQLState.** Its javadoc adds the sentence *"This
exception does not correspond to a standard SQLState."* It is one of the few places
where the *type* carries information the code cannot, because a JDBC timeout is not a
database condition — nothing failed on the server; the driver gave up waiting. On
PostgreSQL a *server-side* `statement_timeout` is a different event and reports
`57014 query_canceled`. That code has two indistinguishable causes, a timeout firing
and another thread calling `Statement.cancel()`, so if your application does both you
have to track the cancellation yourself.

⚠️ **`SQLFeatureNotSupportedException` is about the driver, not the database.** Class
`0A`, and the javadoc lists three shapes: no support for an optional feature, for an
optional overloaded method, or for an optional *mode* of a method — where the mode is
determined by constants you passed in. That last one is why the same method call can
succeed with one argument and throw with another.

## The catch is ordered, not flat

```java
try {
    orderRepository.save(order);
} catch (SQLTransientException e) {              // 40xxx, transient 08xxx, timeouts
    // retry the whole transaction, with a cap and backoff
} catch (SQLRecoverableException e) {
    // evict this Connection, get a fresh one, retry the transaction
} catch (SQLIntegrityConstraintViolationException e) {
    // a business conflict: "that email is taken"
} catch (SQLException e) {
    // everything else: translate and rethrow — never swallow
}
```

Java's most-specific-first rule does the dispatch; the only thing you must get right is
putting every leaf catch above the bare `SQLException`. Ordering *between* the leaves
does not matter here, because none of them is a supertype of another — the three
branches are siblings under `SQLException`.

🔴 **`SQLRecoverableException` is a sibling of the other two, not a subclass.** It
extends `SQLException` directly, so `catch (SQLTransientException e)` will not catch it
and `catch (SQLNonTransientException e)` will not either. A ladder that handles only
"transient" and "non-transient" has a hole exactly where the connection is broken.

## The rest of the direct subclasses

The `SQLException` page's own list of direct known subclasses also names
`BatchUpdateException`, `SQLWarning`, `SQLClientInfoException`, and the
`javax.sql.rowset` types `RowSetWarning`, `SerialException`, `SyncFactoryException`
and `SyncProviderException`. The first two are really about the *chain* rather than
about classification, and are
[chunk 21d](21d-the-chain-and-what-to-do.md)'s subject.

`SQLClientInfoException` is the odd one out and worth thirty seconds. Its javadoc
explains that *"Some databases do not allow multiple client info properties to be set
atomically. For those databases, it is possible that some of the client info
properties had been set even though the `Connection.setClientInfo` method threw an
exception."* So a single yes/no would be a lie, and the exception carries
`getFailedProperties()` — a `Map<String, ClientInfoStatus>` naming exactly which
properties did not take and why. Small class, but a clean illustration of the
principle running through this whole area: where one boolean cannot describe the
outcome, JDBC attaches structure to the exception rather than expecting you to
reconstruct it from the message.

## Gotchas

**⚠️ Retrying a `SQLRecoverableException` on the same `Connection`**
**Symptom:** a retry loop where every attempt fails instantly with the same error,
burning the whole retry budget in milliseconds and then reporting a timeout that never
happened.
**Cause:** the javadoc states the recovery *must at a minimum* close the current
connection and get a new one. The connection is the thing that is broken, so replaying
on it cannot work.
**Fix:** evict the connection from the pool, acquire a fresh one, and retry the entire
transaction — not the single statement.

**⚠️ Assuming `SQLRecoverableException` is under one of the other two branches**
**Symptom:** a handler that covers `SQLTransientException` and
`SQLNonTransientException` and still lets connection-loss errors reach the generic
catch.
**Cause:** all three extend `SQLException` directly; they are siblings.
**Fix:** three branches in the ladder, always. If you are writing a helper predicate,
name all three explicitly rather than testing for "not non-transient".

**⚠️ Catching `SQLException` before its subclasses**
**Symptom:** an "unreachable catch block" compile error — or, when the ordering is
spread across layers rather than one `try`, a generic handler that quietly absorbs the
cases you wrote specific handlers for and no compiler complains at all.
**Cause:** Java requires most-specific-first, and only *tells* you when the blocks sit
in the same `try`.
**Fix:** keep the ladder in one place. Where translation is layered, make the generic
layer rethrow rather than absorb.

**⚠️ Treating `SQLFeatureNotSupportedException` as a database failure**
**Symptom:** an on-call alert for a "database error" that is actually a call to an
optional JDBC method the driver never implemented — a scrollable
[`ResultSet`](12-resultset-the-cursor-model.md), an unsupported holdability, a
`setNetworkTimeout`.
**Cause:** class `0A` is about the driver. Nothing failed in PostgreSQL; nothing will
be fixed by retrying or by paging anyone.
**Fix:** treat it as a programming error — fail fast in development, and ask
`DatabaseMetaData` for the capability rather than probing with a call and catching.

**⚠️ Reading `SQLTimeoutException` as "the query is finished"**
**Symptom:** a client-side timeout fires, your code moves on, and the database is still
executing the statement and holding its locks.
**Cause:** the exception means the *driver* stopped waiting. Whether the server stops
depends on the cancel reaching it.
**Fix:** where it matters, prefer a server-enforced `statement_timeout` — which really
does end the statement and reports `57014` — over relying on `setQueryTimeout` alone.

**⚠️ Building a retry predicate out of `instanceof` alone**
**Symptom:** code that is correct against the spec and retries nothing in production.
**Cause:** the hierarchy is only as good as the driver's willingness to instantiate it.
**Fix:** pair every `instanceof` with a SQLState fallback —
[chunk 21c](21c-what-pgjdbc-throws.md) is the whole argument, and on PostgreSQL the
fallback is the branch that actually runs.

## Interview questions

**★ What do `SQLTransientException`, `SQLNonTransientException` and
`SQLRecoverableException` mean, and how does each change your code?**
They are the portable answer to "is retrying worth it".
`SQLNonTransientException` is documented as the case where a retry of the same
operation would fail unless the cause is corrected — so do not retry; fix the data, the
SQL, or the permission. `SQLTransientException` is where a previously failed operation
might succeed when retried *without any application-level intervention* — so retry
as-is; its leaves are `SQLTransactionRollbackException` (class `40`),
`SQLTransientConnectionException` (class `08`) and `SQLTimeoutException`.
`SQLRecoverableException` is the one people forget: retrying might work, but only after
recovery steps, and the javadoc says at a minimum those must include closing the
current connection and getting a new one before retrying the entire transaction. In
practice that produces an ordered catch — the transient branch retries, the recoverable
branch evicts the connection first, the integrity-violation branch becomes a business
error, and the bare `SQLException` catch translates and rethrows.

**★ Why does JDBC bother with a subclass hierarchy when SQLState already exists?**
Because SQLState answers "what happened" and the hierarchy answers "what do I do", and
those are not the same question. Class `08` is the clearest example: it covers both a
transient network blip and a server that rejected your connection outright, and no
amount of reading the five characters tells you which you have without a per-vendor
lookup table. JDBC splits it into `SQLTransientConnectionException` and
`SQLNonTransientConnectionException` so the *intent* lives in the type, where a `catch`
acts on it directly and a reviewer can see the policy without following a constant into
another file. It also lets Java's most-specific-first catch ordering do the dispatch,
which is more readable and less error-prone than a ladder of string comparisons. The
cost is that it depends entirely on driver cooperation, which is precisely where it
falls down on PostgreSQL.

**★ `SQLTimeoutException` says it does not correspond to a standard SQLState. Why not,
and what does that tell you operationally?**
Because it is not a database condition. It is thrown when a timeout configured on the
*client* expires — `Statement.setQueryTimeout`, or one of the login timeouts on
`DriverManager`, `DataSource` or `XADataSource` — which means the driver gave up
waiting, not that the server reported a failure. There may be no server message at all
to carry a SQLSTATE. Operationally the distinction is sharp: a client-side timeout
leaves a statement possibly still running on the server, holding locks and consuming
CPU, until a cancel takes effect; a server-side `statement_timeout` on PostgreSQL has
already ended the statement and reports `57014 query_canceled`. So if you see `57014`
the database enforced the limit; if you see a bare `SQLTimeoutException`, your
application did, and the next question is whether the query is still burning resources
on the server.

**★ Someone writes `catch (SQLTransientException e) { retry(); }` and nothing else.
What is wrong with it?**
Three things, in increasing order of severity. First, it misses
`SQLRecoverableException`, which is a sibling rather than a subclass, so the
connection-loss case — arguably the most common genuinely retryable failure in a
long-running service — falls through. Second, it retries the *operation* rather than
the *transaction*: if the failing statement was one of several inside a transaction,
the database has already rolled the whole thing back, so replaying one statement
produces either `25P02 in_failed_sql_transaction` or, worse, a half-applied unit of
work. Third, and fatally on PostgreSQL, `SQLTransientException` is a type pgJDBC does
not generally throw, so the block never executes and the code that looks like a retry
policy is dead. A correct version handles all three branches, retries the enclosing
transaction, and pairs the type check with a SQLState-class fallback.

**★ Where does `SQLClientInfoException` fit, and why does it have an extra accessor?**
It is a direct subclass of `SQLException` thrown when one or more client info
properties could not be set on a `Connection`. The extra accessor exists because the
operation is not necessarily atomic — the javadoc notes that some databases do not
allow multiple client info properties to be set atomically, so it is possible that
*some* were set even though `Connection.setClientInfo` threw. Reporting a single
failure would be misleading, so the exception carries `getFailedProperties()`, a
`Map<String, ClientInfoStatus>` naming exactly which properties did not take and why.
It matters more than its obscurity suggests, because client info is how many teams
push an application name or a request id down to the database for correlation in
`pg_stat_activity` — and a silent partial failure there means your traces stop lining
up with your query logs.

**★ Does catching a subclass tell you anything the SQLState class does not?**
Sometimes, and it is worth knowing which cases. For classes `23`, `42`, `22` and `28`
the subclass is a straight restatement of the code's class, so it adds readability and
nothing else. For class `08` it adds genuine information, because JDBC splits one
SQLState class into a transient and a non-transient type based on intent that the code
does not express. For `SQLTimeoutException` it adds information that has no SQLState at
all. And for `SQLRecoverableException` it adds a whole recovery instruction — discard
the connection — that no code table conveys. So the honest summary is that the
hierarchy is mostly a nicer spelling of what you already know, with three places where
it is strictly more expressive; and since those three are exactly the connection and
timeout cases that dominate real incident handling, they are the ones worth writing
handlers for.

---
← Prev: [21 · `SQLException`](21-sqlexception.md) · Index: [JDBC](README.md) · Next → [21c · What pgJDBC actually throws](21c-what-pgjdbc-throws.md)
