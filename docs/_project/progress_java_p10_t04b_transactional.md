---
name: devbible Java P10 topic 04 — Spring @Transactional, chunks 13–22 (agent D)
description: Progress, verified sources and traps for chunks 13-22 of docs/java/pages/phase-10-data-access/04-spring-transactional/
metadata:
  type: project
---

# devbible · Java · Phase 10 · Topic 04 — chunks 13–22 (agent D)

⚠️ **This file belongs to agent D (chunks 13–22).** Chunks 01–12 are another
agent's and their memory is `progress_java_p10_t04_transactional.md` — do not
write to that one from here.

**Scope:** `docs/java/pages/phase-10-data-access/04-spring-transactional/`,
files `13*` through `22*` only. Tier **Master**. JDK 25, Spring Boot 4.1.0,
Spring Framework 7.0.8, HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13.

⛔ Raw JDBC (`setAutoCommit`, savepoint API, isolation levels from first
principles, SQLSTATE 40001) belongs to **topic 03**, referenced as bold plain
text with *(not written yet)*.

## Per-file status

| # | File | Lines | Gotchas | Questions | State |
|---|---|---|---|---|---|
| 13 | 13-rollback-rules.md | 281 | 7 | 6 | ✅ |
| 13b | 13b-changing-the-rule.md | 297 | 7 | 6 | ✅ |
| 13c | 13c-how-a-rule-is-matched.md | 284 | 7 | 6 | ✅ |
| 14 | 14-the-caught-exception.md | 293 | 5 | 6 | ✅ |
| 14b | 14b-three-honest-options.md | 286 | 7 | 6 | ✅ |
| 15 | 15-read-only.md | 292 | 6 | 6 | ✅ |
| 15b | 15b-where-read-only-pays.md | 297 | 8 | 7 | ✅ |
| 16 | 16-isolation.md | 277 | 6 | 6 | ✅ |
| 16b | 16b-isolation-in-the-plumbing.md | 291 | 6 | 8 | ✅ |
| 17 | 17-timeouts.md | 298 | 5 | 6 | ✅ |
| 17b | 17b-what-actually-bounds-it.md | 281 | 8 | 6 | ✅ |
| 18 | 18-threads-and-async.md | 284 | 8 | 7 | ✅ |
| 18b | 18b-reactive-and-virtual-threads.md | 297 | 7 | 7 | ✅ |
| 19 | 19-transactional-events.md | 292 | 6 | 7 | ✅ |
| 19b | 19b-after-commit-is-not-durable.md | 280 | 8 | 7 | ✅ |
| 20 | 20-transactions-in-tests.md | 281 | 7 | 7 | ✅ |
| 20b | 20b-the-false-positives.md | 300 | 8 | 7 | ✅ |
| 21 | 21-what-belongs-in-a-transaction.md | 296 | 6 | 9 | ✅ |
| 21b | 21b-shaping-the-work.md | 290 | 9 | 7 | ✅ |
| 22 | 22-the-checklist.md | 274 | 6 | 6 | ✅ |
| 22b | 22b-reviewing-a-service.md | 287 | 6 | 8 | ✅ |

Chunk 13 was written as one file, measured 367 lines, and split into 13/13b/13c
on concept boundaries (the default rule · changing it · how a rule is matched).
Chunk 14 measured 361 and split into 14/14b (the swallow · the three options).
Chunk 15 split into 15/15b (the four layers · where it pays + when it is ignored).
Chunk 16 split into 16/16b (the silent-ignore rule · the pool/session plumbing).
Chunk 17 split into 17/17b (Spring's timeout · the server-side timeouts that bind).
Chunk 18 split into 18/18b (ThreadLocal + @Async · reactive + virtual threads).
Chunk 19 split into 19/19b (the phases · why AFTER_COMMIT is not durable → outbox).
Chunk 20 split into 20/20b (test rollback + TestTransaction · the false positives).
Chunk 21 split into 21/21b (what to keep out · read-then-act + retry placement).
Chunk 22 split into 22/22b (the 8-check debugging order · the review checklist).

🔴 **ALL OF AGENT D'S SCOPE IS COMPLETE: 21 files, 6058 lines, 0 over 300,
0 unresolved links, no console blocks anywhere.**

## NEW sourced claims fetched by agent D — do NOT re-fetch

Everything already in `progress_java_p10_t04_transactional.md` still holds. The
following are additions verified by fetch on 2026-08-25.

### rolling-back.html — full verbatim, previously only summarised
<https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html>
- **Type matching:** "given a configured exception type `C`, a thrown exception of
  type `T` will be considered a match against `C` if `T` is equal to `C` or a
  subclass of `C`. This provides type safety and avoids any unintentional matches
  that may occur when using a pattern."
- **Pattern matching:** "the pattern can be a fully qualified class name or a
  substring of a fully qualified class name for an exception type (which must be
  a subclass of `Throwable`), with no wildcard support at present."
- "You must carefully consider how specific a pattern is and whether to include
  package information (which isn't mandatory). For example, `\"Exception\"` will
  match nearly anything and will probably hide other rules. `\"java.lang.Exception\"`
  would be correct if `\"Exception\"` were meant to define a rule for all checked
  exceptions. With more unique exception names such as `\"BaseBusinessException\"`
  there is likely no need to use the fully qualified class name."
- 🔴 "a thrown exception is considered to be a match for a given pattern-based
  rollback rule if the name of the thrown exception contains the exception
  pattern configured for the rollback rule." Documented examples:
  `com.example.CustomException` also matches `com.example.CustomExceptionV2` and
  `com.example.CustomException$AnotherException`.
- **Strongest matching rule wins**, with the XML example
  `<tx:method name="*" rollback-for="Throwable" no-rollback-for="InstrumentNotFoundException"/>`
  and the sentence "any exception other than an `InstrumentNotFoundException`
  results in a rollback of the attendant transaction".

### @EnableTransactionManagement javadoc — `rollbackOn` VERBATIM
<https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html>
- "Indicate the rollback behavior for rule-based transactions without custom
  rollback rules: default is rollback on unchecked exception, this can be
  switched to rollback on any exception (including checked)."
- "Note that transaction-specific rollback rules override the default behavior
  but retain the chosen default for unspecified exceptions. This is the case for
  Spring's Transactional as well as JTA's Transactional when used with Spring
  here."
- "Unless you rely on EJB-style business exceptions with commit behavior, it is
  advisable to switch to RollbackOn.ALL_EXCEPTIONS for a consistent rollback even
  in case of a (potentially accidental) checked exception. Also, it is advisable
  to make that switch for Kotlin-based applications where there is no enforcement
  of checked exceptions at all."
- Since **6.2**; default `RUNTIME_EXCEPTIONS`; enum is
  `org.springframework.transaction.annotation.RollbackOn`.
- ⚠️ Its "See Also" lists `Transactional.rollbackOn()` / `dontRollbackOn()` —
  those are **JTA's** `jakarta.transaction.Transactional` attributes, NOT
  Spring's. Spring's `@Transactional` has no `rollbackOn`/`dontRollbackOn`
  (confirmed against the 7.0.x `@Transactional` javadoc).

### @Transactional javadoc — attribute defaults VERBATIM
<https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html>
- `rollbackFor` / `noRollbackFor` default `{}`; both carry "This is the preferred
  way to construct a rollback rule (in contrast to `rollbackForClassName()`),
  matching the exception type and its subclasses in a type-safe manner."
- `rollbackFor`: "By default, a transaction will be rolled back on
  `RuntimeException` and `Error` but not on checked exceptions (business
  exceptions). See `DefaultTransactionAttribute.rollbackOn(Throwable)` for a
  detailed explanation."
- `readOnly` default **false**; "This just serves as a hint for the actual
  transaction subsystem; it will *not necessarily* cause failure of write access
  attempts. A transaction manager which cannot interpret the read-only hint will
  *not* throw an exception when asked for a read-only transaction but rather
  silently ignore the hint."
- `isolation` default `DEFAULT`, `timeout` default **-1**, `timeoutString`
  default `""` **since 5.3**, `label` default `{}` **since 5.3**, `propagation`
  default `REQUIRED`.
- 🔴 `isolation`, `timeout` and `timeoutString` each carry: "**Exclusively
  designed for use with `Propagation.REQUIRED` or `Propagation.REQUIRES_NEW`**
  since it only applies to newly started transactions." `isolation` adds:
  "Consider switching the \"validateExistingTransaction\" flag to \"true\" on your
  transaction manager if you'd like isolation level declarations to get rejected
  when participating in an existing transaction with a different isolation
  level."

### TransactionAspectSupport javadoc
<https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html>
- `currentTransactionStatus()`: "Return the transaction status of the current
  method invocation. Mainly intended for code that wants to set the current
  transaction rollback-only but not throw an application exception."
- "This exposes the locally declared transaction boundary with its declared name
  and characteristics, as managed by the aspect. At runtime, the local boundary
  may participate in an outer transaction: If you need transaction metadata from
  such an outer transaction (the actual resource transaction) instead, consider
  using `TransactionSynchronizationManager`."
- 🔴 Throws `NoTransactionException` — "if the transaction info cannot be found,
  because the method was invoked outside an AOP invocation context." So it is
  LOUD, unlike most transaction mistakes.
- `currentTransactionInfo()` is `protected`; "A TransactionInfo will be returned
  even if no transaction was created. The `TransactionInfo.hasTransaction()`
  method can be used to query this."

### Isolation enum javadoc (7.0.9 page)
<https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Isolation.html>
- Class: "Enumeration that represents transaction isolation levels for use with
  the `@Transactional` annotation, corresponding to the `TransactionDefinition`
  interface."
- `DEFAULT`: "Use the default isolation level of the underlying data store. All
  other levels correspond to the JDBC isolation levels."
- `READ_UNCOMMITTED`: "A constant indicating that dirty reads, non-repeatable
  reads, and phantom reads can occur."
- `READ_COMMITTED`: "A constant indicating that dirty reads are prevented;
  non-repeatable reads and phantom reads can occur."
- `REPEATABLE_READ`: "A constant indicating that dirty reads and non-repeatable
  reads are prevented; phantom reads can occur."
- `SERIALIZABLE`: "A constant indicating that dirty reads, non-repeatable reads,
  and phantom reads are prevented."

### HibernateJpaDialect javadoc
<https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/jpa/vendor/HibernateJpaDialect.html>
- `setPrepareConnection`: "Set whether to prepare the underlying JDBC Connection
  of a transactional Hibernate Session, that is, whether to apply a
  transaction-specific isolation level and/or the transaction's read-only flag to
  the underlying JDBC Connection." Default **true**; "If you turn this flag off,
  JPA transaction management will not support per-transaction isolation levels
  anymore. It will not call `Connection.setReadOnly(true)` for read-only
  transactions anymore either."
- `beginTransaction`/`prepareTransaction`: "This implementation returns
  transaction data for a flush mode reset if necessary, calling
  `DefaultJpaDialect.prepareFlushMode(EntityManager, boolean)` accordingly."
  `protected FlushMode prepareFlushMode(Session session, boolean readOnly)`.
- "NOTE: The default behavior in terms of read-only handling changed in Spring
  4.1, propagating the read-only status to the JDBC Connection now, analogous to
  other Spring transaction managers."

### TestContext tx.html — VERBATIM (previously only summarised)
<https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html>
- "By default, test transactions will be automatically rolled back after
  completion of the test; however, transactional commit and rollback behavior can
  be configured declaratively via the `@Commit` and `@Rollback` annotations."
- "Annotating a test method with `@Transactional` causes the test to be run
  within a transaction that is, by default, automatically rolled back after
  completion of the test."
- `@BeforeTransaction`/`@AfterTransaction`: "Occasionally, you may need to run
  certain code before or after a transactional test method but outside the
  transactional context — for example, to verify the initial database state prior
  to running your test or to verify expected transactional commit behavior after
  your test runs… `TransactionalTestExecutionListener` supports the
  `@BeforeTransaction` and `@AfterTransaction` annotations for exactly such
  scenarios." Plus: "methods annotated with `@BeforeTransaction` or
  `@AfterTransaction` are only run for transactional test methods."
- `TestTransaction`: "You can interact with test-managed transactions
  programmatically by using the static methods in `TestTransaction`… to start or
  end the current test-managed transaction or to configure the current
  test-managed transaction for rollback or commit."
- 🔴 **False positives:** "When you test application code that manipulates the
  state of a Hibernate session or JPA persistence context, make sure to flush the
  underlying unit of work within test methods that run that code. Failing to
  flush the underlying unit of work can produce false positives: Your test passes,
  but the same code throws an exception in a live, production environment. Note
  that this applies to any ORM framework that maintains an in-memory unit of
  work."
- 🔴 **Preemptive timeouts:** "Spring's testing support binds transaction state to
  the current thread (via a `java.lang.ThreadLocal` variable) *before* the current
  test method is invoked. If a testing framework invokes the current test method
  in a new thread in order to support a preemptive timeout, any actions performed
  within the current test method will *not* be invoked within the test-managed
  transaction… such actions will be committed to the persistent store — for
  example, a relational database — even though the test-managed transaction is
  properly rolled back by Spring." Named cases: JUnit 4 `@Test(timeout = …)` and
  the `TimeOut` rule; JUnit Jupiter `assertTimeoutPreemptively(…)`; TestNG
  `@Test(timeOut = …)`.

### Spring reference — @Async (integration/scheduling.html)
<https://docs.spring.io/spring-framework/reference/integration/scheduling.html>
- "Even methods that return a value can be invoked asynchronously. However, such
  methods are required to have a `Future`-typed return value."
- "`@Async` methods may not only declare a regular `java.util.concurrent.Future`
  return type but also `java.util.concurrent.CompletableFuture`…"
- "You can not use `@Async` in conjunction with lifecycle callbacks such as
  `@PostConstruct`."
- void-returning `@Async` exceptions: "With a `void` return type, however, the
  exception is uncaught and cannot be transmitted. You can provide an
  `AsyncUncaughtExceptionHandler` to handle such exceptions." "By default, the
  exception is merely logged."
- ⚠️ The page does **not** mention virtual threads for `@Async`; virtual threads
  appear only for `SimpleAsyncTaskExecutor` / `SimpleAsyncTaskScheduler`. Do not
  claim more than that.

### PostgreSQL 18 runtime-config-client — timeouts
<https://www.postgresql.org/docs/18/runtime-config-client.html>
- `statement_timeout`: "Abort any statement that takes more than the specified
  amount of time." Zero (the default) disables. "The timeout is measured from the
  time a command arrives at the server until it is completed by the server."
  "Setting `statement_timeout` in `postgresql.conf` is not recommended because it
  would affect all sessions."
- `lock_timeout`: "Abort any statement that waits longer than the specified amount
  of time while attempting to acquire a lock… The time limit applies separately to
  each lock acquisition attempt." Default zero.
- `idle_in_transaction_session_timeout`: "Terminate any session that has been idle
  (that is, waiting for a client query) within an open transaction for longer than
  the specified amount of time." Default zero. "an open transaction prevents
  vacuuming away recently-dead tuples… so remaining idle for a long time can
  contribute to table bloat."
- `transaction_timeout`: "Terminate any session that spans longer than the
  specified amount of time in a transaction. The limit applies both to explicit
  transactions (started with `BEGIN`) and to an implicitly started transaction
  corresponding to a single statement." Default zero. "If `transaction_timeout` is
  shorter or equal to `idle_in_transaction_session_timeout` or
  `statement_timeout` then the longer timeout is ignored." "Prepared transactions
  are not subject to this timeout."

### HikariCP — connection state reset
- README property text (verbatim): `readOnly` — "This property controls whether
  *Connections* obtained from the pool are in read-only mode by default. Note some
  databases do not support the concept of read-only mode, while others provide
  query optimizations when the *Connection* is set to read-only."
  `transactionIsolation` — "This property controls the default transaction
  isolation level of connections returned from the pool. If this property is not
  specified, the default transaction isolation level defined by the JDBC driver is
  used." <https://github.com/brettwooldridge/HikariCP>
- ⚠️ **The README does NOT state the reset behaviour.** It comes from the source:
  `ProxyConnection` tracks six dirty bits —
  `DIRTY_BIT_READONLY 0b000001`, `DIRTY_BIT_AUTOCOMMIT 0b000010`,
  `DIRTY_BIT_ISOLATION 0b000100`, `DIRTY_BIT_CATALOG 0b001000`,
  `DIRTY_BIT_NETTIMEOUT 0b010000`, `DIRTY_BIT_SCHEMA 0b100000` — and on close,
  `if (dirtyBits != 0) poolEntry.resetConnectionState(this, dirtyBits)`, which
  delegates to `PoolBase.resetConnectionState`. That method restores each dirty
  property to the **pool's own configured value** (`isReadOnly`, `isAutoCommit`,
  `transactionIsolation`, `catalog`, `networkTimeout`, `schema`), and only when
  the current state differs.
  Files: `src/main/java/com/zaxxer/hikari/pool/ProxyConnection.java`,
  `PoolEntry.java`, `PoolBase.java` on the `dev` branch.

### More verbatim gathered for chunks 15–16

- **TransactionDefinition.isReadOnly()** full text: "The read-only flag applies to
  any transaction context, whether backed by an actual resource transaction
  (PROPAGATION_REQUIRED/PROPAGATION_REQUIRES_NEW) or operating non-transactionally
  at the resource level (PROPAGATION_SUPPORTS). In the latter case, the flag will
  only apply to managed resources within the application, such as a Hibernate
  Session." + the hint paragraph. Returns "true if the transaction is to be
  optimized as read-only (false by default)".
- **TransactionDefinition.getTimeout()**: "Must return a number of seconds, or
  TIMEOUT_DEFAULT." / "Exclusively designed for use with PROPAGATION_REQUIRED or
  PROPAGATION_REQUIRES_NEW since it only applies to newly started transactions." /
  "Note that a transaction manager that does not support timeouts will throw an
  exception when given any other timeout than TIMEOUT_DEFAULT."
- **TIMEOUT_DEFAULT**: "Use the default timeout of the underlying transaction
  system, or none if timeouts are not supported."
- **getIsolationLevel()**: "Must return one of the ISOLATION_XXX constants defined
  on this interface. Those constants are designed to match the values of the same
  constants on Connection." + the exclusively-designed paragraph + "Note that a
  transaction manager that does not support custom isolation levels will throw an
  exception when given any other level than ISOLATION_DEFAULT."
- 🔴 **annotations.html settings table** — exactly THREE rows carry the
  REQUIRED/REQUIRES_NEW note: `isolation` ("Applies only to propagation values of
  REQUIRED or REQUIRES_NEW."), `timeout` (same wording), and `readOnly`
  ("Read-write versus read-only transaction. **Only applicable to values of
  REQUIRED or REQUIRES_NEW.**"). `timeoutString` does NOT carry it in the table,
  though its javadoc does.
  ⚠️ **Apparent tension worth keeping:** the table says readOnly is only
  applicable to REQUIRED/REQUIRES_NEW, while the TransactionDefinition javadoc
  says it applies to any transaction context including PROPAGATION_SUPPORTS
  (where it reaches only managed resources such as a Hibernate Session). Both are
  quoted in 15b and reconciled there: the table is about the *transaction's*
  characteristics, the javadoc about the *managed resource*.

### More verbatim gathered for chunks 17–18

- **DataSourceTransactionManager** class javadoc, the timeout sentence in full:
  "Supports custom isolation levels, and timeouts which get applied as appropriate
  JDBC statement timeouts. To support the latter, application code must either use
  `JdbcTemplate`, call `DataSourceUtils.applyTransactionTimeout(Statement,
  DataSource)` for each created JDBC `Statement`, or go through a
  `TransactionAwareDataSourceProxy` which will create timeout-aware JDBC
  `Connection`s and `Statement`s automatically."
  Also: "Binds a JDBC `Connection` from the specified `DataSource` to the current
  thread, potentially allowing for one thread-bound `Connection` per `DataSource`."
  And the `LazyConnectionDataSourceProxy` paragraph: it "will not fetch an actual
  JDBC `Connection` from the target `DataSource` until a `Statement` gets
  executed".
- **TransactionTimedOutException** javadoc: "Exception to be thrown when a
  transaction has timed out. Thrown by Spring's local transaction strategies if
  the deadline for a transaction has been reached when an operation is attempted…
  Beyond such checks before each transactional operation, Spring's local
  transaction strategies will also pass appropriate timeout values to resource
  operations (for example to JDBC Statements, letting the JDBC driver respect the
  timeout)… In a JTA environment, it is up to the JTA transaction coordinator to
  apply transaction timeouts."
  Chain: Throwable → Exception → RuntimeException → NestedRuntimeException →
  TransactionException → TransactionTimedOutException. **So it rolls back under
  the default rule.**
- **PostgreSQL 18 timeouts** — all four quoted in the memory section above.
- **Spring reference strategies.html**: `ReactiveTransactionManager` is "primarily
  a service provider interface (SPI), although you can use it programmatically
  from your application code", for "reactive applications that make use of
  reactive types or Kotlin Coroutines". Both interface listings captured.
- 🔴 **TransactionContextManager javadoc** (this is the reactive counterpart of
  `TransactionSynchronizationManager`):
  "Delegate to register and obtain transactional contexts."
  `createTransactionContext()`: "Create a `TransactionContext` and register it in
  the subscriber `Context`." (Reactor's `reactor.util.context.Context`.)
  `currentContext()`: "Obtain the current `TransactionContext` from the subscriber
  context or the transactional context holder. Context retrieval fails with
  NoTransactionException if no context or context holder is registered."
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/reactive/TransactionContextManager.html>
- **programmatic.html, reactive half**: `TransactionalOperator.create(txManager)`;
  operator style `mono.as(transactionalOperator::transactional)` vs callback style
  `execute(TransactionCallback<T>)`; 🔴 "Since version 5.3 cancel signals lead to
  a roll back. As a result it is important to consider the operators used
  downstream from a transaction `Publisher`. In particular in the case of a `Flux`
  or other multi-value `Publisher`, the full output must be consumed to allow the
  transaction to complete."
- 🔴 **JEP 491 "Synchronize Virtual Threads without Pinning" — Status Closed /
  Delivered, Release 24.** So on the JDK 25 baseline pinning on `synchronized` is
  resolved. Summary verbatim: "Improve the scalability of Java code that uses
  synchronized methods and statements by arranging for virtual threads that block
  in such constructs to release their underlying platform threads for use by other
  virtual threads. This will eliminate nearly all cases of virtual threads being
  pinned to platform threads, which severely restricts the number of virtual
  threads available to handle an application's workload."
  ⚠️ **openjdk.org returns 403 to WebFetch** — fetch it with
  `curl -A "Mozilla/5.0" https://openjdk.org/jeps/491` instead.

### More verbatim gathered for chunks 19–22

- **event.html (live 7.0 wording — note it differs slightly from older quotes):**
  "When you do so, the listener is bound to the commit phase of the transaction by
  default." / "The valid phases are `BEFORE_COMMIT`, `AFTER_COMMIT` (default),
  `AFTER_ROLLBACK`, as well as `AFTER_COMPLETION` which aggregates the transaction
  completion (be it a commit or a rollback)." / 🔴 "**If no transaction is running,
  the listener is not invoked at all, since we cannot honor the required
  semantics.** You can, however, override that behavior by setting the
  `fallbackExecution` attribute of the annotation to `true`." / "As of 6.1,
  `@TransactionalEventListener` can work with thread-bound transactions managed by
  `PlatformTransactionManager` as well as reactive transactions managed by
  `ReactiveTransactionManager`. For the former, listeners are guaranteed to see the
  current thread-bound transaction. Since the latter uses the Reactor context
  instead of thread-local variables, the transaction context needs to be included
  in the published event instance as the event source."
- 🔴 **TransactionSynchronization javadoc — the single most load-bearing quote for
  chunk 19.** `afterCommit`: "**NOTE:** The transaction will have been committed
  already, but the transactional resources might still be active and accessible. As
  a consequence, any data access code triggered at this point will still
  'participate' in the original transaction, allowing to perform some cleanup (with
  no commit following anymore!), unless it explicitly declares that it needs to run
  in a separate transaction. Hence: **Use `PROPAGATION_REQUIRES_NEW` for any
  transactional operation that is called from here.**" The identical NOTE appears on
  `afterCompletion`.
  Exception behaviour differs per callback: `beforeCommit` and `afterCommit` →
  "propagated to the caller"; `beforeCompletion` and `afterCompletion` → "logged but
  not propagated". `beforeCommit` also: "This callback does *not* mean that the
  transaction will actually be committed. A rollback decision can still occur after
  this method has been called." and "Note that exceptions will get propagated to the
  commit caller and cause a rollback of the transaction."
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html>
- **TestTransaction javadoc** — six static methods: `isActive()`,
  `isFlaggedForRollback()`, `flagForRollback()`, `flagForCommit()`, `start()`,
  `end()`. 🔴 `flagFor*`: "Invoking this method will *not* end the current
  transaction. Rather, the value of this flag will be used to determine whether the
  current test-managed transaction should be rolled back or committed once it is
  ended." `end()`: "Immediately force a *commit* or *rollback* of the current
  test-managed transaction, according to the rollback flag." `start()`: "Only call
  this method if `end()` has been called or if no transaction has been previously
  started." Since 4.1.
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/transaction/TestTransaction.html>
- **@MockitoBean / @MockitoSpyBean** are **Spring Framework** annotations in
  `org.springframework.test.context.bean.override.mockito`: "can be used in test
  classes to override a bean in the test's `ApplicationContext` with a Mockito
  *mock* or *spy*, respectively. In the latter case, an early instance of the
  original bean is captured and wrapped by the spy." Declarable on a non-static
  field (incl. an enclosing class of a `@Nested` test) or at type level.
  <https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html>
- **DataSourceTransactionManager — `LazyConnectionDataSourceProxy` paragraph:**
  "Consider defining a `LazyConnectionDataSourceProxy` for your target
  `DataSource`… This will lead to optimized handling of 'empty' transactions, i.e.
  of transactions without any JDBC statements executed. A
  `LazyConnectionDataSourceProxy` will not fetch an actual JDBC `Connection` from
  the target `DataSource` until a `Statement` gets executed, lazily applying the
  specified transaction settings to the target `Connection`."

## Traps found by agent D

- ⛔ **THIS CLAIM WAS WRONG AND IS WITHDRAWN (corrected 2026-08-25).** It is a
  **no-op**, not a narrowing: an unmatched rule leaves `winner == null` and
  `RuleBasedTransactionAttribute.rollbackOn` falls through to
  `DefaultTransactionAttribute.rollbackOn`, which is
  `return (ex instanceof RuntimeException || ex instanceof Error);` — so the `Error`
  rolls back anyway. Explicit rules **add to** the default rather than replacing it.
  Superseded text follows, kept only so the error is recognisable if it resurfaces:
  ~~`rollbackFor = RuntimeException.class` is narrower than the default~~
  because the default is `RuntimeException` **or** `Error`. Writing it "to be
  explicit" makes things worse.
- 🔴 Spring's `@Transactional` has **no** `rollbackOn`/`dontRollbackOn`. Those are
  JTA's. The `@EnableTransactionManagement` "See Also" list is misleading.
- 🔴 Boot 4.1 has **no property** for the rollback rule. `spring.transaction.*`
  maps to `TransactionProperties` with exactly `default-timeout` and
  `rollback-on-commit-failure`.
- ⚠️ Declaring `@EnableTransactionManagement` in a Boot app to set `rollbackOn`
  makes you responsible for its other attributes — notably `proxyTargetClass`,
  Framework default `false` vs Boot's `spring.aop.proxy-target-class=true`.
- ⚠️ `currentTransactionStatus()` throwing `NoTransactionException` is the one
  loud failure in this whole topic — worth teaching as a probe.
- 🔴 A `Statement` created from a raw `dataSource.getConnection()` gets **no**
  transaction timeout AND is **not in the transaction** — two bugs, one line.
- 🔴 HikariCP `connectionTimeout` is borrow-wait, NOT a transaction/query timeout.
  Frequently conflated.
- ⚠️ PostgreSQL `transaction_timeout` ignores the longer of
  `idle_in_transaction_session_timeout` / `statement_timeout` if it is shorter or
  equal; and prepared transactions are exempt.
- ⚠️ `idle_in_transaction_session_timeout` **terminates the session**, so the
  application sees connection errors rather than a clean timeout.
- 🔴 `@Transactional` on an `@Async` method starts its OWN transaction on the
  async thread — it never joins the caller's. A void `@Async` also swallows its
  exception by default ("merely logged").
- ⚠️ `parallelStream()` splits work across the caller's thread (inside the
  transaction) and ForkJoinPool threads (outside it) non-deterministically.
- 🔴 **A DB write inside an `AFTER_COMMIT` listener silently never commits** unless
  the listener declares `REQUIRES_NEW`. The javadoc says it in as many words
  ("with no commit following anymore!"). This is the #1 mistake with the feature.
- 🔴 `@TransactionalEventListener` with **no transaction running is not invoked at
  all** — not deferred, not immediate. Kills naive unit tests.
- 🔴 Only `BEFORE_COMMIT` can veto the commit (its exceptions propagate AND cause a
  rollback). `AFTER_COMMIT` exceptions propagate but cannot undo.
  `AFTER_COMPLETION` exceptions are logged, not propagated.
- 🔴 Testing an `AFTER_COMMIT` listener REQUIRES `TestTransaction`:
  `flagForCommit()` → `end()` → `start()`. Ordering is enforced with
  `IllegalStateException` both ways.
- 🔴 `assertTimeoutPreemptively` / JUnit 4 `@Test(timeout=)` / TestNG
  `@Test(timeOut=)` run the body on a new thread → writes COMMIT and survive the
  test rollback. `@Timeout` and `assertTimeout` are safe.
- ⚠️ Boot 4: `@MockBean`/`@SpyBean` are **removed**; use Framework's
  `@MockitoBean`/`@MockitoSpyBean`.
- ⚠️ Boot registers `OpenEntityManagerInViewInterceptor` by default in web apps —
  the persistence context outlives the transaction for the whole request.
  `spring.jpa.open-in-view=false` turns it off. Used in chunk 21.

## Owed / next

- ✅ **Nothing owed by agent D.** Chunks 13–22 are all written and QC'd.
- Coordinator still owes: `README.md`, the ← Prev / Next → footers, `sidebar_position`
  renumbering 1..N, and repointing every **bold plain text *(not written yet)*** to
  a real link once 01–12 and topic 03 exist.
- Cross-chunk references to 01–12 and topic 03 are deliberately **bold plain text
  with *(not written yet)***, for the coordinator to repoint.
