---
name: progress-java-p10-t04-depthpass-a
description: Java Phase 10 topic 04 (Spring @Transactional) — repair and depth pass A, chunks 01–09b plus the new 20d
metadata:
  type: project
---

# Java P10 · topic 04 · `@Transactional` — repair & depth pass A

Directory: `docs/java/pages/phase-10-data-access/04-spring-transactional/`
Tier: **Master** on every file. Version spine: JDK 25, Spring Boot 4.1.0,
Spring Framework 7.0.8, Hibernate ORM 7.4.1, Spring Data JPA 4.1.0, PostgreSQL 18.

## What this pass is

The topic was already written (50 chunks, 13,738 lines) by two earlier forks. This is
a **repair + depth pass**, not new authoring:

1. **Task 1 — the one hard defect.** `20c-the-other-ways-a-test-lies.md` footer links
   forward to `20d-what-a-test-must-assert.md`, which does not exist. Write it.
2. **Task 2 — the interview-Q&A depth re-judge**, per file, over chunks 01–09b.
   Those 22 files carried 4–6 questions each with 6 dominating — rule 13's template
   tell. Re-judge each on its own merits; no blanket +2.

## Ownership

Mine: 01, 02, 02b, 02c, 03, 03b, 03c, 04, 04b, 04c, 05, 05b, 05c, 06, 06b, 06c, 07,
07b, 08, 08b, 09, 09b + the new 20d (and any 20e… split).
Not mine: 10–14b (a second fork), 15–22b (finished), README.md, _plan-c.md, _plan-d.md.

## Status

- ✅ `_plan-repair-a.md` written (checkpoint file, updated per file).
- ⏳ 20d not yet written.
- ⏳ Q&A re-judge not yet started.

## Traps already known

- The coordinator regenerates every footer. Existing files end with a generated
  `← Prev: … · Index: … · Next → …` line — leave it exactly in place; new content in
  a parent goes *before* it. New child files end with a bare `<!--FOOTER-->`.
- 296 body lines is the write cap (coordinator's footer costs 4).

---

## Task 1 progress — 20d… written

`20c`'s dangling forward link is resolved. Written to the length the subject deserved,
then split on concept boundaries into **five** chunks (rule 1: content fixed, file
count variable):

| File | Lines | Gotchas | Questions | Subject |
|---|---|---|---|---|
| `20d-what-a-test-must-assert.md` | 181 | 3 | 4 | the assertion rule: the value must not be one the test could have produced; `TestEntityManager.persistFlushFind` |
| `20e-what-the-context-hides.md` | 257 | 6 | 7 | entity lifecycle callbacks that never fire; one persistence context per thread; `clear` vs `detach` vs `refresh`; the update round trip |
| `20f-asserting-the-boundary-exists.md` | 270 | 6 | 6 | `isActualTransactionActive()`, where to put the probe, `getCurrentTransactionName()` |
| `20g-asserting-the-settings.md` | 255 | 5 | 5 | `isCurrentTransactionReadOnly`, isolation, the timeout on the `ConnectionHolder`, `currentTransactionStatus()` vs the manager |
| `20h-asserting-the-commit.md` | ⏳ | | | commit/rollback from a separate transaction, `@Commit` cleanup debt, `@Sql` fixture, what needs a real database |

### Load-bearing claims and their sources

- "the exposed name will be the *fully-qualified class name + "." + method name* (by
  default)" — `TransactionAspectSupport` javadoc. This is what makes
  `getCurrentTransactionName()` a **self-invocation detector**: a self-call reports the
  OUTER method's name.
- `isActualTransactionActive()` "indicates whether the current thread is associated
  with an actual transaction rather than just with active transaction synchronization…
  (with or without a backing resource transaction; also on `PROPAGATION_SUPPORTS`)" —
  `TransactionSynchronizationManager` javadoc. So `isSynchronizationActive()` is the
  WRONG probe.
- `currentTransactionStatus()` "exposes the locally declared transaction boundary…
  If you need transaction metadata from such an outer transaction (the actual resource
  transaction) instead, consider using `TransactionSynchronizationManager`" — and it
  throws `NoTransactionException` outside an AOP invocation context, so it cannot be a
  boolean probe.
- Entity lifecycle callbacks: `@PostPersist`/`@PreUpdate`/`@PostUpdate` "will not be
  called unless `entityManager.flush()` is invoked"; `@PostLoad` needs
  `entityManager.clear()` **before** the reload — Spring 7.0 reference, *Testing ORM
  entity lifecycle callbacks*. Two different calls for two different halves.
- `TestEntityManager.persistFlushFind` "Delegates to `persistAndFlush(Object)` then
  `find(Class, Object)`" — **no `clear()` in the chain**, so the read can still be
  served from the persistence context.
- Boot 4.1 packages: `org.springframework.boot.jpa.test.autoconfigure.TestEntityManager`
  and `org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest` — both moved
  from `org.springframework.boot.test.autoconfigure.orm.jpa`.
- `ResourceHolderSupport.getTimeToLiveInSeconds()` **throws**
  `TransactionTimedOutException` once the deadline is reached — it does not return ≤0.
- `TransactionSynchronization.beforeCommit` exceptions "will get propagated to the
  commit caller and cause a rollback"; `beforeCompletion`/`afterCompletion` exceptions
  are "logged but not propagated". So an assertion thrown in a synchronization either
  becomes a rollback or vanishes.
- `SqlConfig.TransactionMode.ISOLATED` — "SQL scripts should always be executed in a
  new, *isolated* transaction that will be immediately committed."
- Spring 7.0 reference: "you should use caution if Spring-managed or
  application-managed transactions are configured with any propagation type other than
  `REQUIRED` or `SUPPORTS`."

### ✅ TASK 1 COMPLETE — 7 chunks, 1,741 lines

| File | Lines | Gotchas | Questions |
|---|---|---|---|
| `20d-what-a-test-must-assert.md` | 183 | 3 | 4 |
| `20e-what-the-context-hides.md` | 257 | 6 | 7 |
| `20f-asserting-the-boundary-exists.md` | 270 | 6 | 6 |
| `20g-asserting-the-settings.md` | 255 | 5 | 5 |
| `20h-asserting-the-commit.md` | 252 | 4 | 4 |
| `20i-committing-and-what-participates.md` | 228 | 6 | 6 |
| `20j-the-fixture-and-the-real-database.md` | 296 | 6 | 7 |

`20c`'s dangling forward link to `20d-what-a-test-must-assert.md` now resolves. All
inter-chunk links verified against the filesystem; 0 unresolved.

Additional sources used for 20h–20j:
- `TransactionSynchronization` javadoc — `afterCompletion(int status)` and the
  `STATUS_COMMITTED` / `STATUS_ROLLED_BACK` / `STATUS_UNKNOWN` constants; exception
  contracts per callback.
- `@DataJpaTest` javadoc — "use an embedded in-memory database (replacing any explicit
  or usually auto-configured `DataSource`)". This is the load-bearing claim behind the
  "what needs a real database" section.
- Spring Boot 4.1 reference *Testing → Testcontainers* — `@ServiceConnection` in
  `org.springframework.boot.testcontainers.service.connection`; "a single test
  container instance can, and often is, retained across execution of tests from
  multiple test classes".
- Spring 7.0 reference *Executing SQL scripts* — default script detection
  (`<ClassName>.sql` / `<ClassName>.<methodName>.sql`), `@SqlMergeMode`, the
  `BEFORE_TEST_CLASS` / `AFTER_TEST_CLASS` phases that cannot be overridden.

**Next: Task 2 — the per-file interview-Q&A depth re-judge over 01…09b.**

## Task 2 — the Q&A depth re-judge, running log

| File | Before | After | Q before | Q after | What was added, and why |
|---|---|---|---|---|---|
| `01-not-a-language-feature.md` | 254 | 281 | 5 | 7 | the lede claims writes still work under autocommit but never interrogates it; and the "two transaction managers" gotcha had no question |
| `02-the-proxy.md` | 250 | 289 | 5 | 8 | three quoted reference claims had gotchas but no questions: Objenesis constructor bypass, the module-system limit; plus `AopUtils.isAopProxy`/`getTargetClass` as the runtime check |
| `02b-where-the-annotation-lives.md` | 293 | 225 | 6 | 6 | **SPLIT** at the inheritance boundary → `02d`; added "the commit is a call that can fail", which the chunk's own pseudocode asserts and never interrogates |
| `02d-the-inheritance-rule.md` **(new)** | — | 155 | — | 5 | the inheritance rule + its 4 gotchas carved out; added annotate-the-base trade-off, `@Inherited` has "no effect… other than a class" so method annotations never inherit, and the bridge-method diagnostic |
| `02c-visibility-and-the-interface-question.md` | 268 | 282 | 6 | 7 | the visibility table says package-private is advised since 6.0 without the reference's own caveat — "package-private methods in a parent class from a different package… are effectively private" |

New sources: `AopUtils` javadoc (`isAopProxy`/`isJdkDynamicProxy`/`isCglibProxy` all
"additionally check… `SpringProxy`"; `getTargetClass` returns "the target class for an
AOP proxy or the plain class otherwise"); `java.lang.annotation.Inherited` javadoc
("no effect if the annotated type is used to annotate anything other than a class").

⚠️ **Found, not mine to fix:** `13-rollback-rules.md` (×2) and `13b-changing-the-rule.md`
link to `13d-the-matching-algorithm.md`, which does not exist. Chunks 13/13b belong to
another fork.
| `03-the-self-invocation-trap.md` | 252 | 292 | 4 | 7 | the "what it is not" section raises outer-annotated + inner `REQUIRES_NEW` and drops it; the "other annotations" gotcha had no question; no question on how to *test* for it |
| `03b-the-initialization-variant.md` | 251 | 277 | 5 | 7 | self-injection is a circular reference and Boot disallows those by default — the page recommends `@Lazy` without saying why it is load-bearing; event choice had a gotcha, no question |
| `03c-bound-receivers.md` | 280 | 294 | 6 | 7 | the "never intercepted" table invites over-application; added the calibration question (a self-bound reference is a bug only when its target is advised) |
| `04-fixing-self-invocation.md` | 260 | 274 | 6 | 7 | same circular-reference point, from the fix side |
| `04b-the-escape-hatches.md` | 261 | 277 | 6 | 7 | the checked-exception gotcha had no question and it shapes real code |
| `04c-aspectj-weaving.md` | 254 | 276 | 6 | 9 | 🔴 **had a real defect** — see below |

### 🔴 `04c` carried a structural defect and a wrong claim

1. **Three duplicated sections.** `## The decision table` appeared **twice** and
   `## The trade-off` **three times**, with overlapping text. Deduplicated to one of
   each (kept the table whose rows carry chunk links; merged the three trade-offs into
   one that keeps the "only fix 5 is a repair" asymmetry and the "weigh it as
   architecture" framing).
2. **A wrong gotcha, now corrected.** It claimed weaving does *not* make a `private`
   `@Transactional` method work, on the grounds that `publicMethodsOnly` semantics
   still apply. The `AnnotationTransactionAspect` source says the opposite. Verified
   against the aspect itself
   (`spring-aspects/src/main/java/org/springframework/transaction/aspectj/AnnotationTransactionAspect.aj`,
   `main` branch):
   - it is constructed with `new AnnotationTransactionAttributeSource(false)` —
     **`publicMethodsOnly = false`**;
   - class-level pointcut:
     `execution(public * ((@Transactional *)+).*(..)) && within(@Transactional *)`
     — **public only**, and it covers subtypes;
   - method-level pointcut: `execution(@Transactional * *(..))` — **no visibility
     restriction**;
   - javadoc: *"Any method may be annotated (regardless of visibility). Annotating
     non-public methods directly is the only way to get transaction demarcation for the
     execution of such operations."*
   - javadoc: *"When using this aspect, you **must** annotate the implementation class…
     **not** the interface… AspectJ follows Java's rule that annotations on interfaces
     are **not** inherited."*
   So the visibility rule **flips** on migration: private is dead under proxying and
   live under weaving, but only when annotated directly, never by class-level
   inheritance.
3. **The `spring-boot-starter-aop` → `spring-boot-starter-aspectj` rename is CONFIRMED**
   (Boot 4.0.0 M3 release notes / 4.0 migration guide, spring-boot issue #42948). The
   existing gotcha's claim stands.

Other new sources: `SpringApplication.setAllowCircularReferences` — "Defaults to
`false`", since 2.6.0.
| `05-annotations-that-do-nothing.md` | 227 | 269 | 6 | 9 | the checklist's row 9 says "unwrapped" and never defines it; nothing asked which rows a static analyser can catch; rows 4–5 say "under CGLIB" without the JDK-proxy counterpart |
| `05b-detecting-a-dead-annotation.md` | 249 | 278 | 6 | 8 | technique 3's log line is never quoted, yet it carries the transaction *name*; and no question asked what a passing `isActualTransactionActive()` assertion fails to cover |
| `05c-proving-it-and-preventing-it.md` | 240 | 285 | 6 | 8 | the page tells you to inject a failure and never shows one; and the ArchUnit rules have no answer for an existing codebase that fails them |

New sources: `TransactionAspectSupport` source (`spring-tx`, `main`) — the interceptor's
own trace strings are `Getting transaction for [<joinpoint>]`,
`Completing transaction for [<joinpoint>]` and, crucially,
`No need to create transaction for [<joinpoint>]` when the attribute lookup found
nothing; the joinpoint identification is the same `Class.method` string
`getCurrentTransactionName()` returns. `AopTestUtils` source (`spring-test`, `main`) —
`getTargetObject`: "If the supplied `candidate` is a Spring proxy, the target of the
proxy will be returned; otherwise, the `candidate` will be returned *as is*", via a cast
to `Advised` and `getTargetSource().getTarget()`; plus `getUltimateTargetObject`.
| `06-the-transaction-manager.md` | 297 | 235 | 6 | 6 | **SPLIT** → `06d` (it was already at the cap); added "the `throws` clause is unchecked" and why `ISOLATION_*` share JDBC's numeric values |
| `06d-the-status-handle.md` **(new)** | — | 162 | — | 5 | `TransactionStatus` + `currentTransactionStatus()` carved out; added `hasSavepoint`/`isCompleted`, `NoTransactionException` as a feature, and reading `isNewTransaction` from declarative code |
| `06b-which-manager-you-have.md` | 270 | 298 | 6 | 7 | `TransactionAwareDataSourceProxy` was named twice as the thing that makes plain JDBC safe and never explained — rule 13's "names the fix, never shows it" tell |
| `06c-what-boot-picked-for-you.md` | 258 | 296 | 6 | 8 | `spring.transaction.rollback-on-commit-failure` sat in a table with no explanation anywhere; added it plus the two flags that actually matter |

New sources:
- `TransactionAwareDataSourceProxy` javadoc — "Data access code that should remain
  unaware of Spring's data access support can work with this proxy to seamlessly
  participate in Spring-managed transactions"; the manager must still work with the
  underlying `DataSource`, "**not** with this proxy"; it must be "the outermost
  `DataSource` of a chain"; it applies "remaining transaction timeouts to all created
  JDBC (Prepared/Callable)Statement"; and "if possible, use Spring's `DataSourceUtils`,
  `JdbcTemplate` or JDBC operation objects… avoiding the need to define such a proxy".
- `AbstractPlatformTransactionManager` javadoc — `setRollbackOnCommitFailure` "Typically
  not necessary and thus to be avoided, as it can potentially override the commit
  exception with a subsequent rollback exception. Default is `false`";
  `setGlobalRollbackOnParticipationFailure` **default true**, "The only possible outcome
  of such a transaction is a rollback: The transaction originator *cannot* make the
  transaction commit anymore", and turning it off "will only work as long as all
  participating resources are capable of continuing towards a transaction commit even
  after a data access failure: This is generally not the case for a Hibernate
  `Session`"; `setFailEarlyOnGlobalRollbackOnly` default false, "only causing an
  `UnexpectedRollbackException` at the outermost transaction boundary".
| `07-thread-binding.md` | 282 | 282 | 6 | 6 | 🟢 **LEFT ALONE.** Its six questions already interrogate every claim it makes — where the transaction lives, why `dataSource.getConnection()` escapes it and why Spring cannot fix that, why the templates participate, the per-`DataSource` keying, the no-transaction path, and the ergonomics/surprise trade. The two gaps I found (`isConnectionTransactional`, `LazyConnectionDataSourceProxy`) are about *obtaining* a connection, which is 07b's subject, so they went there. |
| `07b-getting-the-connection-safely.md` | 237 | 284 | 6 | 8 | the chunk argues connection-hold time tracks the outermost boundary and never names `LazyConnectionDataSourceProxy`; and it never says how to tell whether a connection you were handed is the bound one |
| `08-propagation-required.md` | 272 | 288 | 6 | 7 | a gotcha says "find the outermost `@Transactional` first" and nothing says how |
| `08b-whose-settings-win.md` | 262 | 219 | 6 | 6 | **SPLIT** → `08c` (both brief-named gaps landed here and pushed it to 304) |
| `08c-making-the-mismatch-loud.md` **(new)** | — | 207 | — | 5 | `validateExistingTransaction` carved out and given the material it was missing |

### The two gaps the brief named, both real and both answered in `08b`

1. **Does an inner `rollbackFor` still mark the shared physical transaction
   rollback-only?** **Yes**, and it is the asymmetry that makes "inner settings are
   ignored" too crude. Isolation/timeout/read-only go to the *manager* at
   `getTransaction`, which a participating call never does. Rollback rules are evaluated
   by the *interceptor* on the way out, per scope, so an inner `rollbackFor` is consulted
   and takes effect — it just cannot roll back only its own work. Source: the default
   `globalRollbackOnParticipationFailure = true`, "The only possible outcome of such a
   transaction is a rollback: The transaction originator *cannot* make the transaction
   commit anymore." **An inner scope has no say over HOW the transaction runs and complete
   say over WHETHER it may commit.**
2. **Does `timeout` inherit the way isolation does?** The inner *declaration* is
   discarded, but the outer *deadline* absolutely applies, because it lives on the
   thread-bound `ConnectionHolder`, not on the scope. `DataSourceUtils.applyTransactionTimeout`
   applies "the current transaction timeout, if any" to each statement, and
   `ResourceHolderSupport.getTimeToLiveInSeconds` returns the **remaining** time — and
   **throws `TransactionTimedOutException`** once the deadline has passed. So an inner
   method can fail on its first statement with a timeout it never declared.

Exact `validateExistingTransaction` failure messages, read from
`AbstractPlatformTransactionManager` source (`main`):
`"Participating transaction with definition [...] specifies isolation level which is
incompatible with existing transaction: <level>"` and
`"Participating transaction with definition [...] is not marked as read-only but existing
transaction is"`. The isolation check is skipped when the inner definition is
`ISOLATION_DEFAULT`, and prints `(unknown)` when the outer boundary set no level — which
is the most common way the flag fires on first adoption. Field defaults confirmed in the
same source: `validateExistingTransaction = false`,
`globalRollbackOnParticipationFailure = true`, `failEarlyOnGlobalRollbackOnly = false`,
`rollbackOnCommitFailure = false`.

New source: Boot 4.1 `TransactionManagerCustomizer` — "Callback interface that can be
implemented by beans wishing to customize a `TransactionManager` to fine-tune its
auto-configuration", `void customize(T transactionManager)`, since 4.0.0. This is how to
set `validateExistingTransaction` **without** declaring your own manager bean and
silently disabling the `spring.transaction.*` properties.
| `09-marked-rollback-only.md` | 244 | 287 | 5 | 7 | the chunk complains the exception "names no cause" and never mentions the flag that moves it; and a gotcha says a scope can exist that you did not write, without saying where it comes from |
| `09b-fixing-the-rollback-only-trap.md` | 287 | 288 | 6 | 7 | 🔴 **had a duplicated `## Seeing it coming` section** (same defect class as 04c) — removed; and the "three fixes" table omits `NESTED`, which is the only arrangement that gets partial progress + atomicity + one connection |

New sources: `AbstractPlatformTransactionManager.setFailEarlyOnGlobalRollbackOnly` —
default false, "only causing an `UnexpectedRollbackException` at the outermost
transaction boundary"; on, it fires "as early as the global rollback-only marker has
been first detected", and the lenient default exists so as to "continue unit tests even
after an operation failed". Spring Data JPA 4.1 reference *Transactionality* — "methods
inherited from `CrudRepository` inherit the transactional configuration from
`SimpleJpaRepository`. For read operations, the transaction configuration `readOnly` flag
is set to `true`. All others are configured with a plain `@Transactional`", and
redeclaring the method on your interface overrides it.

## ✅ TASK 2 COMPLETE

22 owned files re-judged individually. Three splits (`02b`→`02d`, `06`→`06d`,
`08b`→`08c`), **two structural repairs**, one file deliberately left alone with the
reason recorded (`07`). Interview-question counts now range **5–9** across the range,
replacing the near-uniform 6 that was rule 13's template tell.

### Still owed / found but not mine

- `13-rollback-rules.md` (×2) and `13b-changing-the-rule.md` link to
  `13d-the-matching-algorithm.md`, **which does not exist**. Chunks 10–14b belong to a
  second fork; this is the same class of defect as the `20d` link I was sent to fix, and
  somebody must either write `13d` or repoint those three links.
- Every claim in this pass was confirmed against a primary source. **Nothing was left
  unconfirmed**, and no console output, timing or byte count was written anywhere.
