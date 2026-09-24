---
name: devbible Java Phase 10 topic 04 — Spring @Transactional
description: Progress, verified sources and traps for the Master-tier Spring @Transactional topic in docs/java/pages/phase-10-data-access/04-spring-transactional/
metadata:
  type: project
---

# devbible · Java · Phase 10 · Topic 04 — Spring `@Transactional`

**Scope:** `docs/java/pages/phase-10-data-access/04-spring-transactional/` only.
Tier **Master**. Target: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8,
HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13.

⛔ **Boundary:** the raw JDBC layer (`setAutoCommit`, `commit`/`rollback`,
savepoint API, isolation levels from first principles) belongs to **topic 03**,
written by another agent in parallel. Reference it as bold plain text with
*(not written yet)* — never a link.

## Plan — 22 chunks + README

| # | File | Argues |
|---|---|---|
| 1 | 01-not-a-language-feature.md | the annotation is metadata; infrastructure does the work |
| 2 | 02-the-proxy.md | JDK dynamic proxy vs CGLIB; Boot defaults to CGLIB |
| 3 | 03-the-self-invocation-trap.md | the failing example first |
| 4 | 04-fixing-self-invocation.md | five fixes with honest verdicts |
| 5 | 05-annotations-that-do-nothing.md | private/final/static/interface/@PostConstruct |
| 6 | 06-the-transaction-manager.md | PlatformTransactionManager, TransactionStatus |
| 7 | 07-thread-binding.md | TransactionSynchronizationManager, DataSourceUtils |
| 8 | 08-propagation-required.md | logical vs physical transaction scope |
| 9 | 09-marked-rollback-only.md | UnexpectedRollbackException |
| 10 | 10-requires-new.md | second connection, pool deadlock |
| 11 | 11-nested-and-savepoints.md | NESTED is JDBC-only |
| 12 | 12-the-other-propagations.md | SUPPORTS/MANDATORY/NOT_SUPPORTED/NEVER |
| 13 | 13-rollback-rules.md | checked exceptions do not roll back |
| 14 | 14-the-caught-exception.md | catching it rolls back nothing |
| 15 | 15-read-only.md | readOnly is a hint at four layers |
| 16 | 16-isolation.md | only applies to new transactions |
| 17 | 17-timeouts.md | a transaction timeout is not a wall clock |
| 18 | 18-threads-and-async.md | ThreadLocal binding, @Async |
| 19 | 19-transactional-events.md | @TransactionalEventListener phases |
| 20 | 20-transactions-in-tests.md | test rollback and false positives |
| 21 | 21-what-belongs-in-a-transaction.md | keep HTTP/mail/computation out |
| 22 | 22-the-checklist.md | synthesis + debugging order |

## Files written so far

⚠️ The topic is being written by TWO agents in parallel. Agent C owns 02b/02c and
chunks 03–12; agent D owns chunks 13–22. This table records agent C's files.

| File | Lines | Gotchas | Questions |
|---|---|---|---|
| 01-not-a-language-feature.md | 253 | 5 | 5 |
| 02-the-proxy.md | 249 | 9 | 5 |
| 02b-where-the-annotation-lives.md | 292 | 8 | 6 |
| 02c-visibility-and-the-interface-question.md | 267 | 6 | 6 |
| 03-the-self-invocation-trap.md | 251 | 5 | 4 |
| 03b-the-initialization-variant.md | 250 | 7 | 5 |
| 03c-bound-receivers.md | 279 | 7 | 6 |
| 04-fixing-self-invocation.md | 259 | 7 | 6 |
| 04b-the-escape-hatches.md | 260 | 9 | 6 |
| 04c-aspectj-weaving.md | 253 | 7 | 6 |
| 05-annotations-that-do-nothing.md | 226 | 6 | 6 |
| 05b-detecting-a-dead-annotation.md | 248 | 7 | 6 |
| 05c-proving-it-and-preventing-it.md | 239 | 8 | 6 |
| 06-the-transaction-manager.md | 296 | 7 | 6 |
| 06b-which-manager-you-have.md | 269 | 8 | 6 |
| 06c-what-boot-picked-for-you.md | 257 | 9 | 6 |
| 07-thread-binding.md | 281 | 7 | 6 |
| 07b-getting-the-connection-safely.md | 236 | 8 | 6 |
| 08-propagation-required.md | 271 | 8 | 6 |
| 08b-whose-settings-win.md | 261 | 9 | 6 |
| 09-marked-rollback-only.md | 243 | 6 | 5 |
| 09b-fixing-the-rollback-only-trap.md | 286 | 9 | 6 |
| 10-requires-new.md | 260 | 7 | 6 |
| 10b-when-requires-new-is-right.md | 257 | 7 | 6 |
| 11-nested-and-savepoints.md | 242 | 6 | 5 |
| 11b-choosing-nested.md | 229 | 7 | 6 |
| 12-the-other-propagations.md | 264 | 8 | 6 |
| 12b-supports-and-not-supported.md | 262 | 9 | 6 |

✅ **AGENT C IS COMPLETE — 26 files, 02b through 12b.** Ten planned chunks plus
the 02b repair became 26 files; every one is ≤ 300 lines, every one carries the
`t-master` badge, a `> Verified:` line with real URLs, and `<!--FOOTER-->` as its
last line. All internal links resolved against the filesystem. No console blocks
anywhere. `sidebar_position` runs 3..28 provisionally — the coordinator renumbers.

🔴 **Cross-topic links now RESOLVED (checked with `ls`, 2026-08-25 late):**
agent D landed 13–22 and topic 02 landed while agent C was writing, so the
placeholders were converted to real links —
`21-what-belongs-in-a-transaction.md` from 07b, and
`../02-connection-pooling/03-the-connection-budget.md` ("3 · The deadlock floor")
from both 07 and 10. **Topic 03 (`../03-jdbc-transactions/`) was deliberately NOT
linked** — the boundary holds and it is referenced as bold plain text only.

🔴 **02b arrived at 336 lines (over the 300 cap) and was SPLIT, not trimmed**, on
the concept boundary between *which annotation the lookup finds* (02b: interceptor
shape, placement precedence, the ancestor-class rule) and *which methods it cannot
reach* (02c: interface-vs-class recommendation, the 6.0 visibility change,
publicMethodsOnly, jakarta.transaction.Transactional).

🔴 **Chunk 03 was written at 354 lines and split three ways** on real boundaries:
03 = the trap and its mechanism; 03b = initialization code (fails TWICE — the
proxy does not exist during @PostConstruct); 03c = bound receivers (default
methods, lambdas, method references).

## Load-bearing claims and their sources — ALL VERIFIED BY FETCH 2026-08-24

### Spring Framework 7.0 reference — Data Access / Transaction Management

- **declarative.html** — "declarative transaction management works at **method
  granularity around a thread of execution**. It cannot be used on arbitrary code
  blocks." Declarative TX is made possible through Spring AOP.
  <https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html>
- **declarative/annotations.html**
  <https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html>
  - "In proxy mode (which is the default), only external method calls coming in
    through the proxy are intercepted. This means that self-invocation (in
    effect, a method within the target object calling another method of the
    target object) does not lead to an actual transaction at runtime even if the
    invoked method is marked with `@Transactional`."
  - "Also, the proxy must be fully initialized to provide the expected behavior,
    so you should not rely on this feature in your initialization code — for
    example, in a `@PostConstruct` method."
  - "The `@Transactional` annotation is typically used on methods with `public`
    visibility. As of 6.0, `protected` or package-visible methods can also be
    made transactional for class-based proxies by default. Note that
    transactional methods in interface-based proxies must always be `public` and
    defined in the proxied interface."
  - `publicMethodsOnly` via `new AnnotationTransactionAttributeSource(true)`
    restores pre-5.3 behaviour.
  - **Defaults:** propagation `PROPAGATION_REQUIRED`; isolation
    `ISOLATION_DEFAULT`; read-write; timeout = underlying system default;
    "Any `RuntimeException` or `Error` triggers rollback, and any checked
    `Exception` does not."
  - Attributes: value/transactionManager, label, propagation, isolation, timeout,
    timeoutString, readOnly, rollbackFor, rollbackForClassName, noRollbackFor,
    noRollbackForClassName. isolation/timeout/readOnly "Only applicable to values
    of `REQUIRED` or `REQUIRES_NEW`."
  - XML/annotation settings table: `mode` default `proxy`; `proxy-target-class`
    default **false** at the Framework level; `order` default LOWEST_PRECEDENCE.
  - "The Spring team recommends that you annotate methods of concrete classes …
    rather than relying on annotated methods in interfaces … your transaction
    annotations may be silently ignored: Your code might appear to 'work' until
    you test a rollback scenario."
  - "a class-level annotation does not apply to ancestor classes up the class
    hierarchy; in such a scenario, inherited methods need to be locally
    redeclared".
  - "The most derived location takes precedence when evaluating the transactional
    settings for a method."
  - "the mere presence of the `@Transactional` annotation is not enough to
    activate the transactional behavior … merely metadata".
  - As of 6.2 `@EnableTransactionManagement(rollbackOn=ALL_EXCEPTIONS)`.
  - `jakarta.transaction.Transactional` supported as a drop-in replacement.
- **declarative/rolling-back.html**
  <https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html>
  - "In its default configuration, the Spring Framework's transaction
    infrastructure code marks a transaction for rollback only in the case of
    runtime, unchecked exceptions… (`Error` instances also, by default, result in
    a rollback)." / "Checked exceptions that are thrown from a transactional
    method do not result in a rollback in the default configuration."
  - Type matching: thrown `T` matches configured `C` if T == C or subclass.
  - Pattern matching: FQCN or substring, **no wildcards**; "a thrown exception is
    considered to be a match … if the name of the thrown exception contains the
    exception pattern".
  - "the strongest matching rule wins."
  - `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`.
- **declarative/tx-propagation.html**
  <https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html>
  - REQUIRED: "a logical transaction scope is created for each method upon which
    the setting is applied… all these scopes are mapped to the same physical
    transaction."
  - "By default, a participating transaction joins the characteristics of the
    outer scope, silently ignoring the local isolation level, timeout value, or
    read-only flag (if any)." → `validateExistingTransaction=true` rejects them.
  - UnexpectedRollbackException paragraph quoted in full in chunk 09.
  - REQUIRES_NEW: "The resources attached to the outer transaction will remain
    bound there while the inner transaction acquires its own resources such as a
    new database connection. This may lead to exhaustion of the connection pool
    and potentially to a deadlock… **Do not use `PROPAGATION_REQUIRES_NEW` unless
    your connection pool is appropriately sized, exceeding the number of
    concurrent threads by at least 1.**"
  - NESTED: "uses a single physical transaction with multiple savepoints…
    typically mapped onto JDBC savepoints, so it works only with JDBC resource
    transactions."
- **strategies.html** — PlatformTransactionManager / ReactiveTransactionManager
  interface source, TransactionStatus source (isNewTransaction, hasSavepoint,
  setRollbackOnly, isRollbackOnly, flush, isCompleted).
  <https://docs.spring.io/spring-framework/reference/data-access/transaction/strategies.html>
- **programmatic.html** — TransactionTemplate is **thread-safe**, does not
  maintain conversational state but does maintain configuration state;
  TransactionCallbackWithoutResult; `status.setRollbackOnly()`.
  <https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html>
- **event.html** — `@TransactionalEventListener` phases BEFORE_COMMIT,
  AFTER_COMMIT (default), AFTER_ROLLBACK, AFTER_COMPLETION; "If no transaction is
  running, the listener is not invoked at all, since the required semantics
  cannot be honored" unless `fallbackExecution=true`. Since 6.1 works with
  thread-bound transactions managed by PlatformTransactionManager.
  <https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html>
- **jdbc/connections.html** — DataSourceUtils thread-bound Connection;
  `JdbcTemplate` implicitly uses DataSourceUtils; TransactionAwareDataSourceProxy
  warning: "It is rarely desirable to use this class, except when already
  existing code must be called and passed a standard JDBC `DataSource` interface
  implementation… It is generally preferable to write your own new code by using
  the higher level abstractions".
  <https://docs.spring.io/spring-framework/reference/data-access/jdbc/connections.html>
- **core/aop/proxying.html** — JDK proxy if the target implements ≥1 interface,
  else CGLIB subclass. CGLIB limits: final classes cannot be proxied, final
  methods cannot be advised, private methods cannot be advised, non-visible
  (effectively private) methods cannot be advised, constructor not called twice
  (Objenesis), module-system limits. Self-invocation `SimplePojo` example;
  `AopContext.currentProxy()` "highly discouraged"; "AspectJ compile-time weaving
  and load-time weaving do not have this self-invocation issue".
  <https://docs.spring.io/spring-framework/reference/core/aop/proxying.html>
- **testing/testcontext-framework/tx.html** — test @Transactional rolls back by
  default; @Rollback/@Commit; @BeforeTransaction/@AfterTransaction;
  TestTransaction; false positives without flush; preemptive-timeout warning;
  new threads do not participate.
  <https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html>

### Spring Framework 7.0.8 javadoc

- `Propagation` — all 7 constants quoted; REQUIRES_NEW/NOT_SUPPORTED note that
  actual suspension "will not work out-of-the-box on all transaction managers"
  (JtaTransactionManager); NESTED "Out of the box, this only applies to the JDBC
  DataSourceTransactionManager"; SUPPORTS synchronization-scope note.
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html>
- `TransactionDefinition` — isReadOnly: "This just serves as a hint for the
  actual transaction subsystem; it will not necessarily cause failure of write
  access attempts. A transaction manager which cannot interpret the read-only
  hint will not throw an exception when asked for a read-only transaction."
  Read-only flag "applies to any transaction context… In the latter case
  (PROPAGATION_SUPPORTS), the flag will only apply to managed resources within
  the application, such as a Hibernate Session."
  getTimeout / getIsolationLevel: "Exclusively designed for use with
  PROPAGATION_REQUIRED or PROPAGATION_REQUIRES_NEW since it only applies to newly
  started transactions." getName: FQCN + "." + method name.
  TIMEOUT_DEFAULT. ISOLATION_* constants match `java.sql.Connection`.
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html>
- `UnexpectedRollbackException` — "Thrown when an attempt to commit a transaction
  resulted in an unexpected rollback." extends TransactionException extends
  NestedRuntimeException extends RuntimeException.
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/UnexpectedRollbackException.html>
- `DataSourceTransactionManager` — "Binds a JDBC `Connection` from the specified
  `DataSource` to the current thread"; "Application code is required to retrieve
  the JDBC `Connection` via `DataSourceUtils.getConnection(DataSource)` instead
  of a standard EE-style `DataSource.getConnection()` call"; nested transactions
  via JDBC Savepoint with `nestedTransactionAllowed` defaulting to true;
  "Supports custom isolation levels, and timeouts which get applied as
  appropriate JDBC statement timeouts"; timeout requires JdbcTemplate,
  `DataSourceUtils.applyTransactionTimeout`, or TransactionAwareDataSourceProxy;
  "As of 5.3, `JdbcTransactionManager` is available as an extended subclass which
  includes commit/rollback exception translation".
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html>
- `TransactionSynchronizationManager` — "Central delegate that manages resources
  and transaction synchronizations per thread. To be used by resource management
  code but not by typical application code." getResource/bindResource/
  unbindResource/isSynchronizationActive/isActualTransactionActive/
  isCurrentTransactionReadOnly/getCurrentTransactionName/registerSynchronization.
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html>
- `@EnableTransactionManagement` — `proxyTargetClass` default **false** at the
  Framework level, "setting this attribute to `true` will affect *all*
  Spring-managed beans requiring proxying"; `mode` default PROXY, "Local calls
  within the same class cannot get intercepted that way; an `Transactional`
  annotation on such a method within a local call will be ignored since Spring's
  interceptor does not even kick in for such a runtime scenario"; `order` default
  Ordered.LOWEST_PRECEDENCE (2147483647); `rollbackOn` since **6.2**, values
  RUNTIME_EXCEPTIONS (default) / ALL_EXCEPTIONS, with the advice paragraph.
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html>

### Spring Boot 4.1

- `AopAutoConfiguration` javadoc **(page states Spring Boot 4.1.1)** —
  `spring.aop.auto` default true; **`spring.aop.proxy-target-class` default
  `true` → CGLIB proxies**; false → JDK proxies. 🔴 This is the fact that makes
  Boot behave differently from bare Framework (whose default is false).
  <https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/autoconfigure/aop/AopAutoConfiguration.html>
- Boot reference *SQL Databases → Open EntityManager in View*: "If you are
  running a web application, Spring Boot by default registers
  `OpenEntityManagerInViewInterceptor` … If you do not want this behavior, you
  should set `spring.jpa.open-in-view` to `false`." Also "We prefer HikariCP for
  its performance and concurrency. If HikariCP is available, we always choose
  it."
  <https://docs.spring.io/spring-boot/reference/data/sql.html>
- `TransactionProperties` javadoc (Boot 4.1.1) — prefix `spring.transaction`,
  properties `defaultTimeout` (Duration, nullable) and `rollbackOnCommitFailure`
  (Boolean, nullable); "Configuration properties that can be applied to an
  `AbstractPlatformTransactionManager`." Since 4.0.0. ⚠️ Package is now
  `org.springframework.boot.transaction.autoconfigure` (Boot 4 package move).
  <https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html>

### PostgreSQL 18

- transaction-iso.html — "In PostgreSQL, you can request any of the four standard
  transaction isolation levels, but internally only three distinct isolation
  levels are implemented, i.e., PostgreSQL's Read Uncommitted mode behaves like
  Read Committed." Serialization failures "always return with an SQLSTATE value
  of '40001'"; applications "must be prepared to retry".
  <https://www.postgresql.org/docs/18/transaction-iso.html>
- sql-set-transaction.html — "The transaction isolation level cannot be changed
  after the first query or data-modification statement (`SELECT`, `INSERT`,
  `DELETE`, `UPDATE`, `MERGE`, `FETCH`, or `COPY`) of a transaction has been
  executed." READ ONLY forbids INSERT/UPDATE/DELETE/MERGE, COPY FROM to
  non-temp tables, all CREATE/ALTER/DROP, COMMENT/GRANT/REVOKE/TRUNCATE, and
  EXPLAIN ANALYZE / EXECUTE of those.
  <https://www.postgresql.org/docs/18/sql-set-transaction.html>

### pgjdbc 42.7.x

- `readOnly` default **false**; `readOnlyMode` default **`transaction`** — one of
  `ignore`, `transaction`, `always`; in `transaction` mode with readOnly=true and
  autocommit=false the driver sends **`BEGIN READ ONLY`**.
  <https://jdbc.postgresql.org/documentation/use/>

## Traps / notes for the writer

- 🔴 Framework default `proxyTargetClass=false` vs **Boot default
  `spring.aop.proxy-target-class=true`**. Both must be stated — a page that names
  only one is wrong for half its readers.
- 🔴 `rollbackOn` is **since 6.2**, so it IS available on Framework 7.0.8.
- ⚠️ Boot 4 moved `TransactionProperties` into
  `org.springframework.boot.transaction.autoconfigure`.
- ⚠️ Do not re-teach isolation anomalies from first principles — topic 03 owns
  that. Only Spring's exposure of them.
- ⚠️ No console output anywhere. Exception *type names* and *documented* message
  strings only (e.g. PostgreSQL's "could not serialize access due to concurrent
  update", quoted from the manual).

## NEW verbatim quotes fetched 2026-08-25 (agent C) — the two genuine gaps

These were named in the plan but NOT reproduced above. Now banked in full.

### tx-propagation.html — PROPAGATION_REQUIRED, the rollback-only paragraphs

> "When the propagation setting is `PROPAGATION_REQUIRED`, a logical transaction
> scope is created for each method upon which the setting is applied. Each such
> logical transaction scope can determine rollback-only status individually, with
> an outer transaction scope being logically independent from the inner
> transaction scope. In the case of standard `PROPAGATION_REQUIRED` behavior, all
> these scopes are mapped to the same physical transaction. So a rollback-only
> marker set in the inner transaction scope does affect the outer transaction's
> chance to actually commit."

> "However, in the case where an inner transaction scope sets the rollback-only
> marker, the outer transaction has not decided on the rollback itself, so the
> rollback (silently triggered by the inner transaction scope) is unexpected. A
> corresponding `UnexpectedRollbackException` is thrown at that point. This is
> expected behavior so that the caller of a transaction can never be misled to
> assume that a commit was performed when it really was not. So, if an inner
> transaction (of which the outer caller is not aware) silently marks a
> transaction as rollback-only, the outer caller still calls commit. The outer
> caller needs to receive an `UnexpectedRollbackException` to indicate clearly
> that a rollback was performed instead."

Also, first paragraph: "`PROPAGATION_REQUIRED` enforces a physical transaction,
either locally for the current scope if no transaction exists yet or
participating in an existing 'outer' transaction defined for a larger scope. This
is a fine default in common call stack arrangements within the same thread (for
example, a service facade that delegates to several repository methods where all
the underlying resources have to participate in the service-level transaction)."

And: "Consider switching the `validateExistingTransaction` flag to `true` on your
transaction manager if you want isolation level declarations to be rejected when
participating in an existing transaction with a different isolation level. This
non-lenient mode also rejects read-only mismatches (that is, an inner read-write
transaction that tries to participate in a read-only outer scope)."

### tx-propagation.html — REQUIRES_NEW, first paragraph (was not banked)

> "`PROPAGATION_REQUIRES_NEW`, in contrast to `PROPAGATION_REQUIRED`, always uses
> an independent physical transaction for each affected transaction scope, never
> participating in an existing transaction for an outer scope. In such an
> arrangement, the underlying resource transactions are different and, hence, can
> commit or roll back independently, with an outer transaction not affected by an
> inner transaction's rollback status and with an inner transaction's locks
> released immediately after its completion. Such an independent inner
> transaction can also declare its own isolation level, timeout, and read-only
> settings and not inherit an outer transaction's characteristics."

### tx-propagation.html — NESTED, in full

> "`PROPAGATION_NESTED` uses a single physical transaction with multiple
> savepoints that it can roll back to. Such partial rollbacks let an inner
> transaction scope trigger a rollback for its scope, with the outer transaction
> being able to continue the physical transaction despite some operations having
> been rolled back. This setting is typically mapped onto JDBC savepoints, so it
> works only with JDBC resource transactions."

### Propagation javadoc — every constant's text, verbatim

- **REQUIRED** — "Support a current transaction, create a new one if none exists.
  Analogous to EJB transaction attribute of the same name." / "This is the default
  setting of a transaction annotation."
- **SUPPORTS** — "Support a current transaction, execute non-transactionally if
  none exists. Analogous to EJB transaction attribute of the same name." / "Note:
  For transaction managers with transaction synchronization, `SUPPORTS` is
  slightly different from no transaction at all, as it defines a transaction scope
  that synchronization will apply for. As a consequence, the same resources (JDBC
  Connection, Hibernate Session, etc) will be shared for the entire specified
  scope. Note that this depends on the actual synchronization configuration of the
  transaction manager."
- **MANDATORY** — "Support a current transaction, throw an exception if none
  exists. Analogous to EJB transaction attribute of the same name."
- **REQUIRES_NEW** — "Create a new transaction, and suspend the current
  transaction if one exists. Analogous to the EJB transaction attribute of the
  same name." / "NOTE: Actual transaction suspension will not work out-of-the-box
  on all transaction managers. This in particular applies to
  `JtaTransactionManager`, which requires the
  `jakarta.transaction.TransactionManager` to be made available to it (which is
  server-specific in standard Jakarta EE)."
- **NOT_SUPPORTED** — "Execute non-transactionally, suspend the current
  transaction if one exists. Analogous to EJB transaction attribute of the same
  name." + the same NOTE as REQUIRES_NEW.
- **NEVER** — "Execute non-transactionally, throw an exception if a transaction
  exists. Analogous to EJB transaction attribute of the same name."
- **NESTED** — "Execute within a nested transaction if a current transaction
  exists, behave like `REQUIRED` otherwise. There is no analogous feature in EJB."
  / "Note: Actual creation of a nested transaction will only work on specific
  transaction managers. Out of the box, this only applies to the JDBC
  DataSourceTransactionManager. Some JTA providers might support nested
  transactions as well."

## Additional traps found while writing (agent C, 2026-08-25)

- ⚠️ **`NOT_SUPPORTED` carries the SAME connection-pool arithmetic as
  `REQUIRES_NEW`** and almost nobody says so: suspension does not release the
  outer connection, so a thread running a `NOT_SUPPORTED` method inside a
  transaction holds two connections. The javadoc's suspension caveat applies to
  both constants identically.
- ⚠️ **`SUPPORTS` with no transaction is NOT the same as no annotation.** It opens
  a synchronization scope, so the same JDBC `Connection` is shared for the whole
  scope — which is why `isSynchronizationActive()` is a false positive for "am I
  in a transaction" and `isActualTransactionActive()` is the right check.
- ⚠️ **`MANDATORY` is the most under-used constant in the enum** and is the one
  that converts a silent bug (a fragment committing on its own under `REQUIRED`)
  into an `IllegalTransactionStateException`. It does NOT defend against
  self-invocation, because the annotation is never read in that case.
- ⚠️ **`NESTED` does most of the job `REQUIRES_NEW` is hired for** — partial
  rollback — at one connection instead of two. The decisive difference is that
  `NESTED` work does NOT survive the outer transaction's rollback, so it is
  useless for an audit row.
- ⚠️ **`validateExistingTransaction` catches isolation and read-only mismatches
  but NOT timeout.** And the read-only direction it rejects is an inner
  read-**write** scope inside a read-**only** outer one.
- ⚠️ Savepoint *names* are Spring's to generate and are not contractual — the
  chunk-11 wire trace uses `<sp>` rather than asserting `SAVEPOINT_1`.

- ⚠️ **The bean lifecycle ordering matters for chunk 03b** and is not in the
  Spring transaction docs — it is general container behaviour: instantiate →
  populate properties → `postProcessBeforeInitialization` → init callbacks
  (`@PostConstruct`, `afterPropertiesSet`, custom init) →
  `postProcessAfterInitialization`, **and the auto-proxy creator builds the proxy
  in that last step**. This is why self-injection does not rescue a
  `@PostConstruct` call.
- ⚠️ **`jakarta.transaction.TxType` has no `NESTED` value.** Spring's
  `Propagation` has 7 constants; `TxType` has 6. Worth stating because the
  drop-in-replacement claim invites the assumption they are equivalent.
- ⚠️ **Under a JDK proxy an interface `default` method IS intercepted on entry**
  while its internal calls are not — producing the "one method of the pair works"
  symptom that reads like a config bug.
- ⚠️ Method references and lambdas bind their receiver **where they are created**,
  not where invoked, so passing `this::method` to another bean does not help. This
  defeats the usual "is the caller external?" heuristic.

## Owed / next

🔴 **Chunk 04 was written at 402 lines and split three ways**: 04 = the two fixes
that restructure the call (extract to a bean; self-injection); 04b = the two
runtime escape hatches (`AopContext.currentProxy()`, `TransactionTemplate`);
04c = AspectJ weaving + the five-option decision table.

🔴 **Chunk 05 was written at 387 lines and split three ways**: 05 = the nine-row
catalogue + check order + the 6.0 visibility statement; 05b = the three runtime
diagnostics (`isActualTransactionActive`, `AopUtils`, TRACE logging); 05c = the
two that stay in the project (the rollback test, the ArchUnit rules).

🔴 **Chunk 06 was split three ways**: 06 = the `PlatformTransactionManager`
interface + `TransactionDefinition` + `TransactionStatus`; 06b = the five
implementations + the four load-bearing `DataSourceTransactionManager` javadoc
sentences + `JdbcTransactionManager`; 06c = Boot auto-configuration, multiple
managers, `spring.transaction` properties.

⚠️ **Agent D has already written 13, 14, 15 and 17 to disk** — links to
`14-the-caught-exception.md`, `15-read-only.md` and `17-timeouts.md` are now real
links (verified with `ls`), not "not written yet" text.

- ✅ Agent C: DONE. Splits made: 02b→02b/02c · 03→03/03b/03c · 04→04/04b/04c ·
  05→05/05b/05c · 06→06/06b/06c · 07→07/07b · 08→08/08b · 09→09/09b · 10→10/10b ·
  11→11/11b · 12→12/12b. 09 split into 09 (the failure + why it is correct) + 09b (the three fixes). 10 split into 10 (mechanism + pool deadlock arithmetic) + 10b (when it is right, when it is misused). 08 split into 08 (logical vs physical scope, where the commit happens) + 08b (whose settings win, validateExistingTransaction). 07 split into 07 (mechanism) + 07b (raw connections, releaseConnection, TransactionAwareDataSourceProxy, connection lifetime). Agent D: chunks 13–22.
- The coordinator writes README.md and all Prev/Next footers.
