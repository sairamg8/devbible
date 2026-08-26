---
title: "What to look for when you review a transactional service, and the four defaults worth changing once for the whole application"
sidebar_label: "22b · Reviewing a service"
sidebar_position: 67
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> *Transaction propagation*
> ([.../declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `@EnableTransactionManagement` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html)),
> the `TransactionDefinition` javadoc
> ([.../transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html))
> and the PostgreSQL 18 manual *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, PostgreSQL 18.

**[22](22-the-checklist.md) is for a service that is already misbehaving. This one
is for the review that stops it getting there — nine questions to ask of a
transactional class, and four defaults that are worth changing once so that most
of the questions stop needing to be asked.**

## Nine questions for a service class

**1 · Is the boundary in the right place?** The annotation should sit on the method
that is the unit of work — the one a controller, listener or scheduled task calls.
Not on the controller, which would wrap parsing and serialisation. Not on a
repository, which is not a unit of work. Not on every method of every layer.

**2 · Is anything slow or external inside it?** An HTTP client, a mail sender, a
broker template, a file write, a long computation. Each one converts somebody
else's latency into your held connection. This is the highest-value question on the
list; see [21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md).

**3 · Does anything hand work to another thread?** `new Thread`, `submit`,
`supplyAsync`, `parallelStream`, `@Async`. Those writes leave the transaction and
survive a rollback.

**4 · Is every exception on the failure path going to roll back?** Check the
`throws` clauses for checked types, and check for a `try`/`catch` that swallows.
A catch that logs and continues is a decision to commit partial work.

**5 · Are the propagation choices deliberate?** `REQUIRED` is the default and is
usually right. A `REQUIRES_NEW` should have a reason written down, because it takes
a second connection while the outer transaction still holds its own — the
propagation reference warns this "may lead to exhaustion of the connection pool and
potentially to a deadlock".

**6 · Are `isolation`, `timeout` and `readOnly` on boundaries that actually start
a transaction?** All three are "Only applicable to values of `REQUIRED` or
`REQUIRES_NEW`", so on an inner method they are decoration. An `isolation` in the
wrong place is a correctness bug; a `readOnly` in the wrong place is only a missed
optimisation.

**7 · Do read paths say so?** `readOnly = true` on the outermost boundary of a read
gives you the ORM's suppressed flush and dirty check, and protects against an
accidental entity mutation being written.

**8 · Do the event listeners have the right phase, and their own transaction if
they write?** `AFTER_COMMIT` for side effects that must follow success;
`REQUIRES_NEW` on any listener that touches the database, or its writes silently
never commit.

**9 · Do the tests prove anything?** A test that asserts an exception was thrown
does not distinguish a rollback from a commit. A test that never flushes does not
exercise a single database constraint. See
[20b · The false positives](20b-the-false-positives.md).

## The four defaults worth changing once

Each of these removes a class of question from the list above, application-wide,
for one line of configuration.

**1 · Roll back on every exception.**

```java
@EnableTransactionManagement(rollbackOn = RollbackOn.ALL_EXCEPTIONS)
```

Since 6.2. The javadoc's own recommendation: "Unless you rely on EJB-style business
exceptions with commit behavior, it is advisable to switch to
`RollbackOn.ALL_EXCEPTIONS` for a consistent rollback even in case of a (potentially
accidental) checked exception." Question 4 becomes much smaller.

**2 · Validate declarations against the transaction in progress**, at least in
tests.

```java
tm.setValidateExistingTransaction(true);
```

The mismatch that question 6 hunts for becomes an exception instead of a silent
drop.

**3 · Bound transactions at the database**, on the application's role rather than
globally.

```sql
ALTER ROLE app_service SET statement_timeout = '10s';
ALTER ROLE app_service SET idle_in_transaction_session_timeout = '30s';
```

The second is the one that catches question 2 in production: a session sitting in
an open transaction while the application waits on something is terminated rather
than holding a connection indefinitely. The manual advises against setting these in
`postgresql.conf` because it "would affect all sessions", which is exactly why the
role is the right scope.

**4 · Mark read paths read-only**, following the Spring Data pattern —
`readOnly = true` at class level on a read-oriented service, with explicit
read-write declarations on the methods that write.

## The topic in six sentences

If you retain nothing else:

- `@Transactional` is **metadata**; a proxy and a transaction manager do the work,
  so anything that bypasses the proxy bypasses the transaction.
- The rules are evaluated on **the exception that escapes the method**, and by
  default a checked exception commits.
- A method that **joins** an existing transaction silently discards its own
  `isolation`, `timeout` and `readOnly`.
- The transaction is bound to a **`ThreadLocal`**, so it does not cross a thread
  boundary and never will.
- An open transaction holds a **connection, locks and a snapshot**, so its duration
  is the number that matters.
- Every one of these failures is **silent**, which is why the checklists exist.

## Where this goes next

Two threads leave this topic deliberately unfinished.

The **outbox pattern** — the only arrangement that makes a side effect survive a
crash between the commit and the publish — is sketched in
[19b · After-commit is not durable](19b-after-commit-is-not-durable.md), and the
relay, the schema variations, ordering guarantees and change-data-capture belong to
**Phase 15 — Messaging** *(not written yet)*.

The **isolation levels themselves** — what each anomaly is, how PostgreSQL
implements them, what a serialization failure looks like and how retry loops are
built at the driver level — are **[Topic 03 — Transactions at the JDBC level](../03-jdbc-transactions/README.md)**. This topic only covered Spring's exposure of them.

## The trade-off

A review checklist is process, and process has a cost: it slows reviews down, it
can become a ritual that is performed rather than thought about, and a reviewer
who works through nine questions may still miss the tenth thing that was actually
wrong.

The defaults are better than the checklist wherever they can replace it, precisely
because they are not process — they are a change to what the framework does, made
once, that cannot be forgotten under deadline. Where a question on the list can be
converted into a configuration setting or a failing test, convert it. What is left
is the part that genuinely needs judgement: where the boundary belongs, and what is
inside it.

## Gotchas

**⚠️ Applying the checklist as a form rather than as questions**
**Symptom:** reviews that tick nine boxes and approve a method with a payment call
inside a transaction.
**Cause:** a list invites completion rather than thought.
**Fix:** treat questions 1 and 2 as the ones that matter and the rest as prompts.
Boundary placement and what is inside it account for most real damage.

**⚠️ Changing the four defaults without cleaning up first**
**Symptom:** an application that will not start, or a suite that fails everywhere,
after enabling `validateExistingTransaction`.
**Cause:** it rejects every mismatch, including the harmless `readOnly` inner
declarations most codebases have accumulated.
**Fix:** enable it in the test profile, fix what it finds, then decide about
production.

**⚠️ Setting the database timeouts globally**
**Symptom:** failing backups and migrations.
**Cause:** `postgresql.conf` applies to every session, which the manual warns
against for exactly this reason.
**Fix:** per role, so batch and admin roles keep their own limits.

**⚠️ `readOnly = true` at class level on a service that also writes**
**Symptom:** write methods failing at the database, or silently not flushing.
**Cause:** class-level attributes apply to every method that does not redeclare
them.
**Fix:** the Spring Data shape — read-only at class level, an explicit read-write
`@Transactional` on each mutating method. If that is most of the methods, the class
is doing two jobs.

**⚠️ A `REQUIRES_NEW` with no comment**
**Symptom:** a propagation choice nobody dares change, and a pool that is one
connection too small.
**Cause:** it was added to fix something specific, and the reason was never
written down.
**Fix:** require a comment. The propagation reference's pool-sizing warning should
be part of the review of every one of them.

**⚠️ Treating the six-sentence summary as the whole topic**
**Symptom:** confident wrong answers about `REQUIRES_NEW`, `NESTED` or event
phases.
**Cause:** a summary is a retrieval aid, not a substitute for the mechanism.
**Fix:** it is there to tell you *which page to reopen*, which is its actual job.

## Interview questions

**★ What do you look for first when reviewing a transactional service?**
Where the boundary is, and what is inside it. Everything else on the list is
detail by comparison. The boundary should be on the method that represents the
unit of work — not a controller, not a repository — and inside it there should be
nothing slow, nothing external and nothing that hands work to another thread. Those
two questions catch the failures that take an application down, as opposed to the
ones that produce a wrong row.

**★ Name a configuration change that removes a whole class of bug.**
`@EnableTransactionManagement(rollbackOn = RollbackOn.ALL_EXCEPTIONS)`, available
since Framework 6.2. It makes checked exceptions roll back like everything else, so
a method that starts throwing `IOException` after an unrelated refactor no longer
silently commits partial work. Spring's own javadoc recommends it unless you
deliberately rely on EJB-style business exceptions with commit behaviour. It is one
line, it is unforgettable in a way a review checklist is not, and per-method
`noRollbackFor` still overrides it where the old behaviour is genuinely wanted.

**★ Why put database timeouts on the role rather than in `postgresql.conf`?**
Because the limits appropriate for request handling are wrong for everything else.
A ten-second `statement_timeout` protects an API and breaks a nightly report, a
migration and a backup. PostgreSQL's manual advises against `postgresql.conf` for
`statement_timeout`, `lock_timeout` and `transaction_timeout` on exactly that
ground — "it would affect all sessions". Per-role settings give the application a
tight bound and let batch or admin roles have their own.

**★ Summarise the whole topic in a few sentences.**
`@Transactional` is metadata, and a proxy plus a transaction manager do the work —
so anything that bypasses the proxy bypasses the transaction. The rollback rules
are evaluated on the exception that escapes the method, and by default a checked
exception commits. A method that joins an existing transaction silently discards
its own isolation, timeout and read-only declarations. The transaction is bound to
a `ThreadLocal`, so it does not cross a thread boundary. And an open transaction
holds a connection, locks and a snapshot, so its duration is a concurrency budget.
Nearly every one of those failures is silent.

**★ Which of these mistakes causes the worst outage, as opposed to the worst
data?**
A slow external call inside a transaction. The data mistakes — a checked exception
committing, a swallowed exception, a thread hand-off — produce inconsistent records
that are usually recoverable and affect the operations involved. A network call
inside a transaction converts another party's latency into held connections from a
pool shared by the entire application, so it takes down endpoints that have nothing
to do with the feature. Worst data is a payment recorded twice; worst outage is
everything, at a time chosen by a third party.

**★ Something in this topic was deliberately left out. What?**
Two things. What the isolation levels actually mean — the anomalies, how PostgreSQL
implements them, what a serialization failure is and how retries are built at the
driver level — which is the JDBC-level topic; this one covered only Spring's
exposure of them, including the fact that a declaration on a participating method is
dropped. And the mechanics of the outbox — the relay, the schema, ordering and
change-data-capture — which is a messaging topic. What belongs here is the argument
for *why* an outbox is needed: `AFTER_COMMIT` is a correct ordering guarantee and
not a delivery guarantee.

**★ If you could add only one automated check to a codebase, what would it be?**
An integration test pattern rather than a lint rule: for each critical write
operation, a test that goes through the container, forces a failure, and then
asserts the database is unchanged after the boundary has closed. That single shape
catches a missing proxy, a self-invocation, a swallowed exception, a checked
exception that does not roll back, and a thread hand-off — five of the eight causes
in the debugging checklist — because all of them produce the same observable
outcome that the test is looking for. A lint rule for `@Transactional` on private
methods is cheaper, but it only catches one.

**★ A junior asks why any of this is hard, given it is one annotation. What do you
tell them?**
That the annotation is the easy part and the model underneath it is not. It is
implemented by a proxy, so it only applies to calls that go through the proxy; it
is bound to a thread, so it does not follow the work if the work moves; its
rollback rule keys on a compiler-level distinction the JVM does not enforce; three
of its attributes apply only when it starts a transaction rather than joins one;
and every one of those failures is silent. None of that is visible in the four
characters you type. The annotation compresses a genuinely distributed problem into
one word, and the price of the compression is that the failure modes are all
invisible from the call site.

---

← Prev: [22 · The debugging order](22-the-checklist.md) · Index: [04 · Spring @Transactional](README.md)
