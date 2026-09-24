---
name: progress-java-p10-t04-depthpass-b
description: Java Phase 10 topic 04 (Spring @Transactional) — interview-Q&A depth re-judge over chunks 10–14b
metadata:
  type: project
---

# Java P10 · topic 04 · depth pass B — chunks 10 … 14b

Directory: `docs/java/pages/phase-10-data-access/04-spring-transactional/`
Tier: Master (`t-master`) on every file.

## Scope

Own and may edit ONLY: `10`, `10b`, `11`, `11b`, `12`, `12b`, `13`, `13b`, `13c`,
`14`, `14b` plus new letter-suffixed splits in that range. A second fork owns
01–09b and 20d; 15–22b are finished.

## The task

Not new authoring. The 11 files carry 6/6/5/6/6/6/6/6/6/6/6 interview questions —
uniform, which is rule 13's template tell. Re-judge each file on its own merits;
add only questions the chunk can genuinely answer; leave exhaustive files alone
and say why.

## Status

Started. Plan checkpoint at `_plan-repair-b.md` in the topic directory.

## Load-bearing claims to verify (primary sources)

- `@Transactional` default rollback = `RuntimeException` **or `Error`**, so
  `rollbackFor = RuntimeException.class` is NARROWER than the default.
- Spring's `@Transactional` has no `rollbackOn`/`dontRollbackOn` — that is JTA's
  `jakarta.transaction.Transactional`.
- `RollbackRuleAttribute` matches by substring on the class name; winner is the
  deepest match (`getDepth`).
- `NESTED` needs savepoint support — `JdbcTransactionManager` /
  `DataSourceTransactionManager`; `JpaTransactionManager` throws.
- Boot 4 `spring.transaction.*` = `default-timeout`, `rollback-on-commit-failure`
  only. No rollback-rule property.

## Progress — batch 1 (files 10, 10b, 10c, 11, 11b)

| File | Before | After | Q before | Q after |
|---|---|---|---|---|
| 10-requires-new.md | 263 | 287 | 6 | 7 |
| 10b-when-requires-new-is-right.md | 258 | 278 | 6 | 7 |
| **10c-what-suspension-costs.md (NEW SPLIT)** | — | 293 | — | 7 (6 gotchas) |
| 11-nested-and-savepoints.md | 243 | 291 | 5 | 8 |
| 11b-choosing-nested.md | 230 | 274 | 6 | 8 |

### Verified claims used (primary sources)

- `AbstractPlatformTransactionManager.suspend` "suspends transaction
  synchronization first, then delegates to the `doSuspend` template method"
  (javadoc). `DataSourceTransactionManager.doSuspend` = clear connection holder +
  `TransactionSynchronizationManager.unbindResource(obtainDataSource())`;
  `doResume` = `bindResource`. Source on GitHub `main`.
- `JpaTransactionManager.doSuspend` unbinds the `EntityManagerHolder` (keyed by
  the `EntityManagerFactory`) and the `DataSource` `ConnectionHolder` if bound,
  returning a `SuspendedResourcesHolder`. **So a `REQUIRES_NEW` inner method runs
  on a FRESH persistence context.**
- PostgreSQL 18 `idle_in_transaction_session_timeout`: "Terminate any session that
  has been idle … within an open transaction …"; default `0`. Also: "even when no
  significant locks are held, an open transaction prevents vacuuming away
  recently-dead tuples … can contribute to table bloat."
  `transaction_timeout` default `0`, applies to explicit and implicit
  transactions. Routine Vacuuming: "End long-running open transactions."
- `DataSourceTransactionManager()` constructor calls
  `setNestedTransactionAllowed(true)`. Class javadoc: supports nested transactions
  via `java.sql.Savepoint`; flag defaults to `true`.
- 🔴 `JpaTransactionManager` class javadoc: "This transaction manager supports
  nested transactions via JDBC Savepoints. The `nestedTransactionAllowed` flag
  defaults to `false`, though, since nested transactions will just apply to the
  JDBC Connection, not to the JPA EntityManager and its cached entity objects and
  related context. … do not expect JPA access code to semantically participate in
  a nested transaction." **CORRECTED the page's "JPA does not support savepoints"
  — it does; the flag is just off, and the reason is the persistence context.**
- Three distinct nested-transaction failure messages, from source:
  - `AbstractPlatformTransactionManager`: "Transaction manager does not allow
    nested transactions by default - specify 'nestedTransactionAllowed' property
    with value 'true'"
  - `JdbcTransactionObjectSupport.createSavepoint`: "Cannot create a nested
    transaction because savepoints are not supported by your JDBC driver"
  - `JdbcTransactionObjectSupport.getConnectionHolderForSavepoint`:
    `TransactionUsageException` "Cannot create nested transaction when not
    exposing a JDBC transaction"
- `createSavepoint` also throws `CannotCreateTransactionException` "Cannot create
  savepoint for transaction which is already marked as rollback-only".
- `rollbackToSavepoint` calls `conHolder.resetRollbackOnly()` — **this is why
  NESTED cures the UnexpectedRollbackException trap and REQUIRED+catch does not.**
- `ConnectionHolder.SAVEPOINT_NAME_PREFIX = "SAVEPOINT_"`; `supportsSavepoints()`
  caches `getMetaData().supportsSavepoints()`. `releaseSavepoint` swallows
  `SQLFeatureNotSupportedException` ("typically on Oracle") and SQLSTATE `3B001`.

### 🔴 Correction found, still to apply (file 13 / 13b)

`RuleBasedTransactionAttribute.rollbackOn` (source, `main`) falls back to
`super.rollbackOn(ex)` — `DefaultTransactionAttribute`, `ex instanceof
RuntimeException || ex instanceof Error` — when **no** rule matches. A
`RollbackRuleAttribute(RuntimeException.class)` returns depth `-1` for an `Error`,
so `rollbackFor = RuntimeException.class` still rolls back on `Error`.
**Therefore the widely repeated claim that it is "narrower than the default" is
WRONG, and file 13 currently asserts it (one gotcha + one Q&A). Must be fixed.**
The same fallback means `rollbackFor = MyCheckedException.class` ADDS to the
default rather than replacing it.

## Progress — batch 2 (files 12, 12b, 12c)

| File | Before | After | Q before | Q after |
|---|---|---|---|---|
| 12-the-other-propagations.md | 265 | 284 | 6 | 7 |
| 12b-supports-and-not-supported.md | 263 | 271 | 6 | 6 |
| **12c-the-empty-transaction.md (NEW SPLIT)** | — | 291 | — | 7 (6 gotchas) |

⚠️ **Defect found and fixed:** 12 and 12b carried the SAME interview question
verbatim ("You are designing a service where a partially applied operation is very
expensive…"). Removed from 12b, kept in 12 where MANDATORY lives.

### Verified claims (primary sources) used in batch 2

- `AbstractPlatformTransactionManager.getTransaction` three-way structure:
  `isExistingTransaction` → `handleExistingTransaction`; else `MANDATORY` throws
  *"No existing transaction found for transaction marked with propagation
  'mandatory'"*; else REQUIRED/REQUIRES_NEW/NESTED start; else the **"empty"
  transaction** branch, source comment *"Create \"empty\" transaction: no actual
  transaction, but potentially synchronization."*
- `NEVER` throws only inside `handleExistingTransaction`: *"Existing transaction
  found for transaction marked with propagation 'never'"*. **So NEVER does NOT
  throw inside a SUPPORTS/empty scope.**
- Empty branch logs *"Custom isolation level specified but no actual transaction
  initiated; isolation level will effectively be ignored: "* + def.
- `newSynchronization = (getTransactionSynchronization() == SYNCHRONIZATION_ALWAYS)`
  in both the empty branch and the `NOT_SUPPORTED` branch.
  `setTransactionSynchronization` javadoc: *"Default is 'always'."*
  SYNCHRONIZATION_ALWAYS: *"even for 'empty' transactions that result from
  PROPAGATION_SUPPORTS with no existing backend transaction"*;
  SYNCHRONIZATION_ON_ACTUAL_TRANSACTION is the opposite.
- `Propagation.SUPPORTS` javadoc: *"the same resources (JDBC Connection, Hibernate
  Session, etc) will be shared for the entire specified scope"* → **a
  NOT_SUPPORTED scope binds one connection for its whole duration, on top of the
  suspended outer one.**
- `setValidateExistingTransaction` javadoc: default `false`, *"leniently ignoring
  inner transaction settings"*; reference: a participating transaction "silently
  ignor[es] the local isolation level, timeout value, or read-only flag".
- Boot 4: `spring.transaction.*` has exactly two properties —
  `default-timeout` and `rollback-on-commit-failure`. **No rollback-rule property.**

## Next

Files 13, 13b, 13c, 14, 14b. 13 carries the WRONG `rollbackFor =
RuntimeException.class` claim (see correction above) — fix it there and check 13b.

## Progress — batch 3 (13, 13b, 13c, 13d NEW, 13e NEW)

| File | Before | After | Q before | Q after |
|---|---|---|---|---|
| 13-rollback-rules.md | 281 | 289 | 6 | 6 (one Q rewritten — was WRONG) |
| 13b-changing-the-rule.md | 298 | 299 | 6 | 6 (gotcha corrected; at the cap) |
| 13c-how-a-rule-is-matched.md | 285 | 291 | 6 | 6 (+forward links) |
| **13d-the-matching-algorithm.md (NEW)** | — | 267 | — | 7 (4 gotchas) |
| **13e-when-rules-collide.md (NEW)** | — | 209 | — | 5 (4 gotchas) |

🔴 **The correction landed.** `rollbackFor = RuntimeException.class` is a **no-op**,
not a narrowing: an `Error` scores `-1` against that rule, `winner == null`, and
`RuleBasedTransactionAttribute.rollbackOn` falls through to
`super.rollbackOn(ex)` = `ex instanceof RuntimeException || ex instanceof Error`.
Both the gotcha in 13 and the Q&A in 13 said "narrower"; 13b's gotcha said the
same. All three fixed and the mechanism written up in 13d.

### Extra verified facts used in 13d / 13e

- `SpringTransactionAnnotationParser.parseTransactionAnnotation` appends rules in
  the order `rollbackFor` → `rollbackForClassName` → `noRollbackFor` →
  `noRollbackForClassName`. Combined with the strict `depth < deepest`, an exact
  tie resolves to the **rollback** rule. NOT a documented contract — flagged as
  such on the page.
- `RollbackRuleAttribute.getDepth` recurses on `getSuperclass()` and stops at
  `Throwable` → **interfaces are never consulted by a rule.**
- Spring's local variable is named `deepest` but holds the *shallowest* depth —
  the source of the widespread "deepest match wins" error. Javadoc: "a rule with
  a lower matching depth wins."
- A pattern rule reaches depth 0 far more easily than a type rule, so
  `noRollbackForClassName = "NotFound"` beats `rollbackFor = RuntimeException.class`
  for `OrderNotFoundException`. This is the mechanism behind the reference's
  "will probably hide other rules".
- `@Transactional` attributes (12): value, transactionManager, label, propagation,
  isolation, timeout, timeoutString, readOnly, rollbackFor, rollbackForClassName,
  noRollbackFor, noRollbackForClassName. **No `rollbackOn` / `dontRollbackOn`** —
  those are JTA's `jakarta.transaction.Transactional`; Spring's `rollbackOn` is an
  attribute of `@EnableTransactionManagement` (a different scope).

## Next

Files 14 and 14b.

## Progress — batch 4 (14, 14b, 14c NEW) · PASS COMPLETE

| File | Before | After | Q before | Q after |
|---|---|---|---|---|
| 14-the-caught-exception.md | 294 | 297 | 6 | 6 (+link to 14c) |
| 14b-three-honest-options.md | 287 | 300 | 6 | 7 |
| **14c-what-the-database-did.md (NEW SPLIT)** | — | 267 | — | 6 (6 gotchas) |

### Verified for 14c

- libpq: *"PQTRANS_INTRANS (idle, in a valid transaction block), or PQTRANS_INERROR
  (idle, in a failed transaction block)"*.
- PostgreSQL 18 error codes, Class 25: **`25P02` `in_failed_sql_transaction`**
  (also `25P03` idle_in_transaction_session_timeout, `25P04` transaction_timeout).
- `ROLLBACK TO SAVEPOINT`: *"Roll back all commands that were executed after the
  savepoint was established and then start a new subtransaction at the same
  transaction level."* → **the only escape from a failed transaction block, which
  is why NESTED exists.**
- Jakarta Persistence 3.2 `FlushModeType.AUTO`: *"(Default) Flushing to occur at
  query execution."*; `COMMIT`: *"Flushing to occur at transaction commit."*
- Spring Data JPA `saveAndFlush`: *"Saves an entity and flushes changes
  instantly."*; `flush()`: *"Flushes all pending changes to the database."*
  → `save` alone may send nothing, so a per-row `catch` can catch nothing.
- `TransactionAspectSupport.currentTransactionStatus()` javadoc: exposes the
  **locally declared** boundary, which "may participate in an outer transaction"
  → option 2 (`setRollbackOnly` + return a report) is only honest at a boundary
  you own.

## ✅ PASS COMPLETE

16 files. Q counts now 5–8 (were uniformly 6/6/5/6/6/6/6/6/6/6/6). Gotchas 4–9.
No file over 300. 0 broken links. 0 duplicate questions.

New splits: `10c-what-suspension-costs.md`, `12c-the-empty-transaction.md`,
`13d-the-matching-algorithm.md`, `13e-when-rules-collide.md`,
`14c-what-the-database-did.md`.

### Could not confirm against a primary source

- What an *empty* transaction reports to its `TransactionSynchronization`
  callbacks when `setRollbackOnly()` is called on it. Stated as unconfirmed on the
  page (12c, last question) rather than guessed.
