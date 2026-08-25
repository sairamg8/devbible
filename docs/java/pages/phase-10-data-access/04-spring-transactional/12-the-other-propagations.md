---
title: "Two of the remaining four propagations change nothing at all — MANDATORY and NEVER are runtime assertions, and MANDATORY is the most under-used setting in the enum"
sidebar_label: "12 · The other propagations"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html))
> the Spring Framework 7.0 reference *Transaction propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html))
> and the `AbstractPlatformTransactionManager` javadoc and source
> ([github.com/spring-projects/spring-framework/.../transaction/support/AbstractPlatformTransactionManager.java](https://github.com/spring-projects/spring-framework/blob/main/spring-tx/src/main/java/org/springframework/transaction/support/AbstractPlatformTransactionManager.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**Three propagations do the work — `REQUIRED`, `REQUIRES_NEW`, `NESTED`. The
remaining four are usually skimmed as a list of definitions, which is a mistake:
each one exists because somebody had a specific problem, and two of them are
*assertions* rather than behaviours. This chunk is the two assertions —
`MANDATORY` and `NEVER` — which change nothing and refuse loudly.
[Chunk 12b](12b-supports-and-not-supported.md) is the two that adapt, both of
which have a cost their definitions do not mention.**

## All four, from the javadoc

> **`SUPPORTS`** — *"Support a current transaction, execute non-transactionally
> if none exists. Analogous to EJB transaction attribute of the same name."*
>
> *"Note: For transaction managers with transaction synchronization, `SUPPORTS`
> is slightly different from no transaction at all, as it defines a transaction
> scope that synchronization will apply for. As a consequence, the same resources
> (JDBC Connection, Hibernate Session, etc) will be shared for the entire
> specified scope. Note that this depends on the actual synchronization
> configuration of the transaction manager."*

> **`MANDATORY`** — *"Support a current transaction, throw an exception if none
> exists. Analogous to EJB transaction attribute of the same name."*

> **`NOT_SUPPORTED`** — *"Execute non-transactionally, suspend the current
> transaction if one exists. Analogous to EJB transaction attribute of the same
> name."*
>
> ***"NOTE:** Actual transaction suspension will not work out-of-the-box on all
> transaction managers. This in particular applies to `JtaTransactionManager`,
> which requires the `jakarta.transaction.TransactionManager` to be made
> available to it (which is server-specific in standard Jakarta EE)."*

> **`NEVER`** — *"Execute non-transactionally, throw an exception if a
> transaction exists. Analogous to EJB transaction attribute of the same name."*

## Two behaviours and two assertions

The clean way to hold these is not as four settings but as two pairs.

| | Wants a transaction | Wants none |
|---|---|---|
| **flexible** — adapts to what it finds | `SUPPORTS` | `NOT_SUPPORTED` |
| **strict** — throws if reality differs | `MANDATORY` | `NEVER` |

`MANDATORY` and `NEVER` **do nothing to the transaction**. They inspect the
current state and throw if it is not what the method requires. They are runtime
assertions expressed as annotations, and that is the useful way to read them:
`MANDATORY` means *"my caller is responsible for the boundary and I will not
silently run without one"*; `NEVER` means *"if I am running inside a transaction,
somebody has made a mistake"*.

`SUPPORTS` and `NOT_SUPPORTED` genuinely change behaviour, and `NOT_SUPPORTED`
requires suspension support.

## `MANDATORY` — the one worth using more

```java
@Component
class LedgerWriter {

    @Transactional(propagation = Propagation.MANDATORY)
    public void post(Entry entry) {
        db.sql("INSERT INTO ledger (account, amount) VALUES (?, ?)")
          .params(entry.account(), entry.amount())
          .update();
    }
}
```

This method must never run outside a transaction — a half-written ledger is worse
than a failed one. With plain `REQUIRED`, calling it without a boundary silently
starts its own single-statement transaction and commits. With `MANDATORY`, that
call throws `IllegalTransactionStateException` immediately.

🔴 **This is the propagation that converts a whole class of silent bug into a
loud one**, and it is the single most under-used setting in the enum. Anywhere a
method is only ever meaningful as part of a larger unit of work — a step in a
saga, a ledger entry, one half of a transfer — `MANDATORY` documents that and
enforces it. A test calling it directly fails immediately instead of passing for
the wrong reason.

⚠️ **It does not defend against self-invocation.** If the proxy is bypassed the
annotation is not read at all, so there is nothing to throw —
[chunk 3](03-the-self-invocation-trap.md).

## `NEVER` — the assertion in the other direction

```java
@Transactional(propagation = Propagation.NEVER)
public Report generateHeavyReport(ReportSpec spec) { ... }
```

The use is narrow and real: work that must **not** be inside a transaction,
because being inside one would hold a connection and a snapshot for far too long.
A long analytical read, a report generation, a bulk export. `NEVER` makes an
accidental caller — someone who wraps the call in a `@Transactional` service
method — fail immediately rather than quietly holding a connection for a minute.

The failure is `IllegalTransactionStateException`, and the value is the same as
`MANDATORY`'s: it turns "somebody will notice this in production eventually" into
"this fails the first time anybody does it".

## The trade-off

`MANDATORY` and `NEVER` trade *flexibility* for *loudness*, and that is the only
axis that matters when choosing them over their adaptive counterparts. They
refuse, so they catch the mistake at the first call rather than the first
incident; the price is that a legitimate new call path now has to be considered
rather than just working. **In a domain where a partially completed operation is
expensive, that price is trivially worth paying**, which is why `MANDATORY`
deserves far more use than it gets. The adaptive pair —
[chunk 12b](12b-supports-and-not-supported.md) — buys the opposite, and it is
worth knowing what that costs.

## Gotchas

**⚠️ `MANDATORY` on a method that a scheduled job also calls directly**
**Symptom:** `IllegalTransactionStateException` from a job that used to work.
**Cause:** the job has no boundary; the annotation is doing its job.
**Fix:** give the job a transactional entry point. The exception found a real
gap.

**⚠️ Expecting `MANDATORY` to protect against self-invocation**
**Symptom:** the method runs happily with no transaction and no exception.
**Cause:** the proxy was bypassed, so no propagation of any kind was consulted.
**Fix:** `MANDATORY` asserts about the transaction, not about being reached —
[chunk 3](03-the-self-invocation-trap.md).

**⚠️ `NEVER` on a method also used inside a transaction elsewhere**
**Symptom:** one caller works and another throws.
**Cause:** the two call paths genuinely disagree about whether a transaction
should exist.
**Fix:** that disagreement is the bug. `NEVER` surfaced it; resolve it rather
than removing the annotation.

**⚠️ Reading `MANDATORY` and `NEVER` as doing something to the transaction**
**Symptom:** confusion about what `NEVER` "starts".
**Cause:** they are assertions, not behaviours. Neither begins, joins or suspends
anything.
**Fix:** read them as preconditions on the caller.

**⚠️ Adding `MANDATORY` to a method without checking every caller**
**Symptom:** a new exception in a code path nobody thought about — a controller
that calls the service directly, an admin endpoint, a migration.
**Cause:** the annotation is an assertion about every caller, retroactively.
**Fix:** that is the point, and it is still worth finding the callers first so the
failures arrive in review rather than in production.

**⚠️ Using `MANDATORY` on a method a `@Async` path also reaches**
**Symptom:** the exception fires from the async path only.
**Cause:** a new thread has no bound transaction — [chunk 18](18-threads-and-async.md).
**Fix:** the async path needs its own boundary. `MANDATORY` correctly refuses to
paper over the missing one.

**⚠️ `NEVER` on a method that is transactional-adjacent rather than
transactional**
**Symptom:** an exception from a caller that only happened to be inside a
boundary for unrelated reasons.
**Cause:** `NEVER` asserts about the *ambient* transaction, not about whether
this method touches the database.
**Fix:** if being inside a transaction is merely undesirable rather than wrong,
`NOT_SUPPORTED` — [chunk 12b](12b-supports-and-not-supported.md) — is the milder
tool.

**⚠️ Using `jakarta.transaction.Transactional` and looking for `NESTED`**
**Symptom:** the propagation you wanted is not on the enum.
**Cause:** Jakarta's `TxType` has six values and no `NESTED`.
**Fix:** [chunk 2c](02c-visibility-and-the-interface-question.md). Spring's
annotation has all seven.

## Interview questions

**★ Name all seven propagations and group them usefully.**
`REQUIRED`, `REQUIRES_NEW`, `NESTED`, `SUPPORTS`, `MANDATORY`, `NOT_SUPPORTED`
and `NEVER`. The useful grouping is by what they do rather than alphabetically.
Three of them establish or shape a transaction: `REQUIRED` joins or starts,
`REQUIRES_NEW` always starts an independent one and suspends any existing,
`NESTED` uses savepoints inside the existing one. Two adapt to whatever they
find: `SUPPORTS` joins if there is a transaction and runs without one otherwise,
`NOT_SUPPORTED` suspends any existing transaction and runs without one. And two
are pure assertions that change nothing: `MANDATORY` throws if there is no
transaction, `NEVER` throws if there is one. Reading the last pair as
preconditions rather than behaviours is what makes them useful rather than
obscure.

**★ What is `MANDATORY` for, and why do you say it is under-used?**
It declares that a method is only meaningful as part of a larger unit of work and
refuses to run outside one. The archetype is a step that must never be partially
applied — a ledger entry, one leg of a transfer, one step of a multi-table
process. Under the default `REQUIRED`, calling such a method without a boundary
silently gives it a one-statement transaction of its own and commits, which is
exactly the outcome the design was trying to prevent, and nothing reports it.
`MANDATORY` turns that into an immediate `IllegalTransactionStateException`. It is
under-used because `REQUIRED` always "works", so nobody ever discovers that a call
path was missing a boundary — and it costs nothing to adopt beyond having to think
about which methods own boundaries and which do not, which is a question worth
answering anyway.

**★ You are designing a service where a partially applied operation is very
expensive. How would you use propagation to defend it?**
`MANDATORY` on every step that is only meaningful inside the unit of work, so
that a caller who forgets the boundary fails immediately instead of committing a
fragment. `REQUIRED` on the one method that *is* the unit of work, and nowhere
else, so the boundary is findable by reading. `validateExistingTransaction = true`
on the manager, so that an inner scope's isolation or read-only declaration
disagreeing with the boundary is an error rather than a silent discard
([chunk 8b](08b-whose-settings-win.md)). `REQUIRES_NEW` only for records that must
survive a rollback, sized into the pool. And `NEVER` on anything long-running that
must not be dragged inside the boundary. The pattern in all of it is the same:
choose the propagation that fails when the assumption is violated, rather than the
one that adapts, because adapting is what makes the failure silent.

**★ Which propagations do not touch the transaction at all?**
`MANDATORY` and `NEVER`. Both inspect whether a transaction is currently active
and throw `IllegalTransactionStateException` if the answer is not what the method
requires — `MANDATORY` throws when there is none, `NEVER` throws when there is
one. Neither begins, joins, suspends or commits anything. Reading them as runtime
assertions rather than as behaviours is what makes them useful: `MANDATORY` says
"my caller owns the boundary and I refuse to run without one", `NEVER` says "if I
am inside a transaction, somebody made a mistake". That framing also explains
their limits — an assertion only fires when it is evaluated, so `MANDATORY` gives
no protection at all against self-invocation, where the annotation is never read.

**★ Give a concrete design where `MANDATORY` prevents a real bug.**
A double-entry ledger. `post(Entry)` inserts one leg; a transfer inserts two, and
they must both exist or neither. Under `REQUIRED`, calling `post` on its own —
from a test, an admin tool, a new controller, a migration script — silently
starts a one-statement transaction and commits a single leg, leaving the ledger
permanently unbalanced with nothing reported. Under `MANDATORY` that call throws
immediately, because `post` is declaring that it is a fragment and not an
operation. The same shape covers any multi-step process where the steps are only
meaningful together: a saga step, one side of a stock movement, a status change
that must accompany an event row. The value is that the enforcement is at the
call, not in a comment.

**★ `MANDATORY` will not protect against self-invocation. Does that undermine
it?**
No, but it is worth being precise about what it does and does not cover.
`MANDATORY` is evaluated by the transaction interceptor, so it fires only when
the proxy is in the call path. A self-invocation bypasses the proxy entirely, so
no propagation of any kind is consulted and the method simply runs — untransacted
and unannounced. That is a different failure with a different fix
([chunk 3](03-the-self-invocation-trap.md)), and the two defences compose rather
than compete: an ArchUnit rule catches the self-invocation at build time, and
`MANDATORY` catches the missing boundary at runtime for every call that does go
through the proxy. What would undermine `MANDATORY` is believing it is a complete
guarantee, which is why it is worth knowing the one gap.

**★ Is a `MANDATORY` method's own `isolation`, `timeout` or `readOnly` honoured?**
No — and this surprises people, because `MANDATORY` feels stricter than
`REQUIRED` and therefore feels like it ought to get its own settings. It does not.
`MANDATORY` is an assertion about the caller followed by ordinary participation in
the caller's transaction, so it lands in exactly the same place as `REQUIRED`
joining an existing scope: the reference says "by default, a participating
transaction joins the characteristics of the outer scope, silently ignoring the
local isolation level, timeout value, or read-only flag (if any)". The
`setValidateExistingTransaction` javadoc says the same from the manager's side —
"this outer transaction's characteristics will apply even to the inner
transaction scope" — with the flag defaulting to `false` and "leniently ignoring
inner transaction settings". Turn it to `true` and an incompatible isolation or
read-only declaration on the inner scope is rejected instead of discarded, which
pairs naturally with `MANDATORY`: if you are already insisting the caller owns the
boundary, you probably also want to be told when a method disagrees with the
boundary it got ([chunk 8b](08b-whose-settings-win.md)).

---

← Prev: [11b · Choosing NESTED](11b-choosing-nested.md) · Index: [Spring @Transactional](README.md) · Next → [12b · SUPPORTS and NOT_SUPPORTED](12b-supports-and-not-supported.md)
