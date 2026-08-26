---
title: "the third honest option moves the catch outside the boundary entirely — which buys independence and pays for it in atomicity, deliberately"
sidebar_label: "14b2 · Its own transaction"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Transaction Management → Transaction propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> *Rolling back a declarative transaction*
> ([.../declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)),
> the `TransactionAspectSupport` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html))
> and the PostgreSQL 18 manual *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18.


**[14b](14b-three-honest-options.md) covered the two options that keep the `catch`
inside one boundary. The third moves the boundary instead: each item gets its own
transaction, so a failure is contained by construction rather than by remembering to
mark anything. It is the shape a batch import wants, and the one people reach for when
they should have taken option 1.**

## 3 · Give the failing part its own transaction

This is the only design where "skip the bad row and keep going" is correct, and
it requires the per-item work to run in a **separate physical transaction**. Two
shapes work, and one of them is much better than the other.

**Shape A — an outer method with no transaction, calling a transactional one.**

```java
@Service
class ImportService {

    private final RowImporter importer;      // a different bean

    ImportReport importBatch(List<Row> rows) {          // NOT @Transactional
        var report = new ImportReport();
        for (Row row : rows) {
            try {
                importer.importOne(row);                // its own transaction
                report.ok(row.id());
            } catch (RuntimeException ex) {
                report.failed(row.id(), ex.getMessage());
            }
        }
        return report;
    }
}

@Service
class RowImporter {
    @Transactional
    void importOne(Row row) {
        productRepository.save(Product.from(row));
        auditRepository.save(AuditEntry.imported(row.id()));
    }
}
```

Each row commits or rolls back on its own. The `catch` sits **outside** every
transactional boundary, which is why it is safe here and unsafe in the version at
the top of [14](14-the-caught-exception.md). One connection is in use at a time.
Note that `importer` is a *different bean* — calling `this.importOne(row)` would
be a self-invocation and no transaction would start at all.

**Shape B — a `REQUIRES_NEW` boundary inside an outer transaction.** Same
per-item independence, but the outer transaction stays open while each inner one
runs, and the propagation reference is blunt about the consequence:

> The resources attached to the outer transaction will remain bound there while
> the inner transaction acquires its own resources such as a new database
> connection. This may lead to exhaustion of the connection pool and potentially
> to a deadlock… Do not use `PROPAGATION_REQUIRES_NEW` unless your connection
> pool is appropriately sized, exceeding the number of concurrent threads by at
> least 1.

Prefer shape A. Reach for `REQUIRES_NEW` only when the outer transaction genuinely
must exist at the same time — the classic case being an audit record that has to
survive the outer rollback. Detail in **[10 · REQUIRES\_NEW](10-requires-new.md)**.

## What all three have in common

The `catch` is never between a write and the boundary that owns it. Either there is no
`catch` ([option 1](14b-three-honest-options.md)), or the `catch` explicitly tells the
boundary to roll back ([option 2](14b-three-honest-options.md)),
or the `catch` is outside the boundary entirely (option 3). Any `catch` that sits inside
a boundary and does not mark it is a commit. `NESTED` is a fourth shape: a savepoint that
skips a failed step inside one atomic transaction ([14c](14c-what-the-database-did.md)).

## The trade-off

Per-item transactions buy independence and cost atomicity. After a partial
failure the database holds a genuinely partial batch — but a *deliberately*
partial one, with a report saying exactly which items are in it, rather than an
accidental one nobody can reconstruct. They also cost a transaction and a
connection round-trip per item, which for a large import is the dominant cost;
batching items into groups of a few hundred, each group its own transaction, is
the usual compromise and it moves the failure granularity to the group.

Option 1 costs you nothing and gives you nothing to negotiate with: the whole
batch fails on one bad row. For most operations that is exactly right, and the
instinct to make it "more robust" is what produces the corrupt-data bugs.

## Gotchas

**⚠️ Calling the transactional per-item method on `this`**
**Symptom:** shape A compiles, reads correctly, and every row shares one
non-existent transaction.
**Cause:** a self-invocation never passes through the proxy, so `@Transactional`
on `importOne` does nothing — see **03 · The self-invocation trap** *(not written
yet)*.
**Fix:** the per-item method must live on a different bean, injected. This is the
single most common way shape A is got wrong.

**⚠️ Making the outer loop method `@Transactional` "just in case"**
**Symptom:** shape A silently degrades into the original bug — one transaction
around everything, and the inner boundaries merely participate in it.
**Cause:** the default propagation is `REQUIRED`, so the inner method joins the
outer transaction instead of starting its own.
**Fix:** the outer method must have no transaction, or the inner one must be
`REQUIRES_NEW`. Half of this arrangement does not work.

**⚠️ Per-item transactions with a batch that must be all-or-nothing**
**Symptom:** an import that leaves half a ledger posted.
**Cause:** somebody applied option 3 to an operation whose whole point was
atomicity, because "skip bad rows" sounded more robust.
**Fix:** ask what the caller does with a partial result. If there is no sensible
answer, option 1 is the design and the batch should fail.

## Interview questions

**★ You are asked to "skip bad rows and import the rest". How do you implement
it?**
Not with a `try`/`catch` inside a single transactional method — that commits
whatever happened to succeed, in a state nobody designed. Each row has to be its
own unit of work, so each row needs its own physical transaction. The shape I
would reach for is an outer loop method with **no** transaction that calls a
transactional per-row method on a different bean, catching per row outside every
boundary. The alternative, `REQUIRES_NEW` on the per-row method inside an outer
transaction, gives the same independence but holds the outer transaction's
connection open while each inner one takes a second, which the propagation
reference warns can exhaust the pool and deadlock. I would also make the skipped
rows a returned report rather than only a log line.

**★ Why is shape A better than `REQUIRES_NEW` for a batch import?**
Because it uses one connection at a time. In shape A the outer method holds no
transaction, so when the inner one runs it is the only transaction on the thread
and the only connection checked out. With `REQUIRES_NEW`, the outer transaction's
connection stays bound to the thread while the inner transaction acquires a
second one — for the duration of every item. With enough concurrent threads doing
this, the pool runs out and the threads holding an outer connection are waiting
for an inner one that will never come. The propagation reference states the
requirement directly: the pool must exceed the number of concurrent threads by at
least one. Shape A does not need that condition to hold.

**★ Someone argues that catching per row inside one big transaction is fine
because "the failures are rare". What do you say?**
That rarity is what makes it dangerous rather than what makes it acceptable. A
failure mode that fires rarely is one that is never exercised in testing, has no
alerting around it, and produces its damage — a half-imported batch — at a moment
nobody is watching. The cost of doing it properly is one extra bean and a report
object. The cost of getting it wrong is data that has to be reconciled by hand,
and nobody can reconstruct which rows made it because the only evidence is a
warning in a log that has since rotated.

---

← Prev: [14b · Three honest options](14b-three-honest-options.md) · Index: [04 · Spring @Transactional](README.md) · Next → [14c · What the database did](14c-what-the-database-did.md)
