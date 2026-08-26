---
title: "The read-only win is Hibernate skipping dirty checking and the flush — and the flag is silently ignored on a transaction it did not start"
sidebar_label: "15b · Where read-only pays"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionDefinition` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html)),
> the `HibernateJpaDialect` javadoc
> ([.../orm/jpa/vendor/HibernateJpaDialect.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/jpa/vendor/HibernateJpaDialect.html)),
> the Spring Framework 7.0 reference *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Transaction propagation*
> ([.../declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)).
> JDK 25, Spring Framework 7.0.8, Hibernate ORM 7.4.1, Spring Data JPA 4.1.0.

**Two things about `readOnly` matter more than the four layers in
[15](15-read-only.md). The benefit is almost entirely an ORM benefit — no dirty
checking, no flush. And the flag only takes effect on a boundary that *starts* a
transaction; put it on a method that joins someone else's and it is discarded
without a word.**

## What a persistence context normally does at commit

When you load an entity through JPA, the persistence context keeps it. At flush
time — which happens before the commit, and before most queries — Hibernate walks
every managed entity and compares its current field values against a snapshot
taken at load time. Anything that changed becomes an `UPDATE`. That comparison is
called **dirty checking**, and its cost scales with the number of entities you
loaded, whether or not you changed any of them.

For a read path that loads five thousand rows and returns a projection, that is
five thousand snapshot comparisons and five thousand retained snapshots, to
produce zero writes.

## What `readOnly = true` changes

`HibernateJpaDialect` prepares the session's flush mode for a read-only
transaction:

```java
protected FlushMode prepareFlushMode(Session session, boolean readOnly)
```

and its `beginTransaction` javadoc says the dialect returns

> transaction data for a flush mode reset if necessary

With flushing suppressed, the automatic flush before queries and before commit
does not run, so the dirty-check pass does not run either, and Hibernate does not
need to hold the load-time snapshots that only exist to support it. Fewer objects
retained, no comparison pass, no accidental `UPDATE` produced by a stray setter.

That last one is not a performance point but it is the one that saves you: in a
read-write transaction, mutating a managed entity writes it to the database at
flush time **even if you never call `save`**. That is JPA working as designed and
it surprises people every time. In a read-only transaction the mutation is simply
not written.

The rest of the chain from [15](15-read-only.md) still happens — the connection is
told, and on PostgreSQL the transaction opens `READ ONLY` — but that part costs
nothing and saves nothing on the client side. **The measurable win is the flush
and the dirty check.** Which is also why a `JdbcTemplate` read path sees no
speed-up from the flag: there is no persistence context to optimise.

## The silent-ignore rule

The reference's `@Transactional` settings table gives `readOnly` this
description:

> Read-write versus read-only transaction. Only applicable to values of
> `REQUIRED` or `REQUIRES_NEW`.

Exactly the same note appears on `isolation` and `timeout`, and the reason is the
same for all three: they are *characteristics of a transaction's start*, and a
method that joins an existing transaction is not starting one. From the
propagation reference:

> By default, a participating transaction joins the characteristics of the outer
> scope, silently ignoring the local isolation level, timeout value, or read-only
> flag (if any).

**Silently** is the operative word. There is no warning, no log entry, no
exception. So:

```java
@Transactional                                   // read-write, starts the transaction
public Report buildReport(long id) {
    return reportAssembler.assemble(id);         // different bean
}

@Transactional(readOnly = true)                  // ignored — joins the outer one
public Report assemble(long id) { ... }
```

`assemble` runs in a read-write transaction. The annotation is decorative. And
the same method called directly from a controller *would* be read-only, so it
behaves differently depending on who called it — which is a genuinely hard bug to
reason about from the code.

The escape hatch is the same one isolation gets: set `validateExistingTransaction`
to `true` on the transaction manager, and the mismatch is rejected instead of
ignored. That turns a silent difference into a loud failure, which is usually what
you want in a test suite. See [16 · Isolation](16-isolation.md) for the same
mechanism argued in the setting where it causes correctness bugs rather than
missed optimisations.

## The one exception: `PROPAGATION_SUPPORTS`

The `TransactionDefinition` javadoc is more precise than the reference table, and
the difference is worth knowing:

> The read-only flag applies to any transaction context, whether backed by an
> actual resource transaction (`PROPAGATION_REQUIRED`/`PROPAGATION_REQUIRES_NEW`)
> or operating non-transactionally at the resource level
> (`PROPAGATION_SUPPORTS`). In the latter case, the flag will only apply to
> managed resources within the application, such as a Hibernate Session.

So with `SUPPORTS` and no surrounding transaction there is no resource
transaction to mark read-only — nothing reaches layers 3 and 4 — but layer 2
still applies: the Hibernate `Session` is still put into a read-only flush mode.
You keep the ORM win and lose the database-level enforcement.

That is not a contradiction of the reference table so much as a sharper statement
of it. The table's "only applicable to `REQUIRED` or `REQUIRES_NEW`" is about the
*transaction's* characteristics; the javadoc is about the *managed resource*.
Both are true, and if you need to remember one thing, remember that a
**participating** transaction discards the flag.

## Spring Data's default, which you have been using without noticing

`SimpleJpaRepository` — the implementation behind every Spring Data JPA
repository — is annotated `@Transactional(readOnly = true)` at class level, with
the mutating methods (`save`, `delete`, `deleteById` and friends) overriding it
with a read-write `@Transactional`. So a repository query called with no
surrounding transaction already runs read-only.

Two consequences. A repository call from a service that has no transaction gets
the ORM optimisation for free. And a repository call *inside* your service
transaction inherits **your** boundary's flag, because it is participating — the
repository's own `readOnly = true` is one of the silently-ignored declarations
above. That is the correct behaviour, and it means the flag that matters is the
one on your service method, not the one Spring Data ships.

## The trade-off

Marking read paths read-only trades a little declaration discipline for a real
reduction in per-request work, and it makes an accidental entity mutation
harmless instead of a silent `UPDATE`.

What it costs is a category of confusing bug: a method whose behaviour depends on
whether it was entered directly or through a read-write caller. The same code,
the same annotation, two different flush regimes. There is no way to see that in
the file you are reading — you have to know the call graph — and the only reliable
defence is to put the flag on the outermost boundary of a read path rather than
sprinkling it on inner helpers.

## Gotchas

**⚠️ `readOnly = true` on an inner method called from a read-write one**
**Symptom:** the optimisation never materialises and nothing says why.
**Cause:** the inner method participates in the outer transaction, which silently
discards the local read-only flag.
**Fix:** put the flag on the boundary that starts the transaction. If both are
genuinely needed, `validateExistingTransaction = true` will at least tell you the
declarations disagree.

**⚠️ The same method behaving differently depending on its caller**
**Symptom:** a read path is fast from the controller and slow from another
service, with identical code.
**Cause:** entered directly it starts its own read-only transaction; entered from
a read-write service it joins that one.
**Fix:** decide where the boundary lives and annotate only there. An annotation
on every layer is not defence in depth here — it is ambiguity.

**⚠️ Mutating a managed entity in a read-write transaction and expecting nothing
to happen**
**Symptom:** an `UPDATE` you never asked for, from code that only called a
setter.
**Cause:** dirty checking. In a read-write transaction, a change to a managed
entity is flushed at commit whether or not you called `save`.
**Fix:** this is one of the strongest reasons to mark read paths read-only: the
mutation is simply not written. Do not rely on it as a design, but do take the
protection.

**⚠️ Expecting a speed-up on a `JdbcTemplate` path**
**Symptom:** the flag is added to a JDBC read path and nothing changes.
**Cause:** the win is the suppressed flush and dirty check, which only exist when
there is a persistence context. `DataSourceTransactionManager` has no ORM.
**Fix:** expect the connection- and database-level effects only, which are about
correctness and routing rather than speed.

**⚠️ Calling `flush()` explicitly in a read-only transaction**
**Symptom:** either an exception from the provider, or writes appearing in a
transaction the annotation says is read-only.
**Cause:** suppressing automatic flushing does not delete the manual API.
**Fix:** if the code needs an explicit flush, the transaction is not a read one.
Remove the flag rather than working around it.

**⚠️ Assuming `SUPPORTS` gives you nothing when there is no transaction**
**Symptom:** surprise that a `SUPPORTS` read-only method still avoids dirty
checking.
**Cause:** the javadoc's carve-out — with no resource transaction, the flag still
applies to managed resources such as a Hibernate `Session`.
**Fix:** none needed; know that the ORM half survives and the database half does
not.

**⚠️ A read-only method that fetches through a connection Spring did not give it**
**Symptom:** confusion about which work the flag covers.
**Cause:** the flag applies to the transaction bound to the thread. A connection
obtained outside the framework's machinery is not part of it.
**Fix:** obtain connections through `JdbcTemplate`, an `EntityManager`, or
`DataSourceUtils`, so the thread-bound transaction is the one you are using.

**⚠️ Adding `readOnly = true` to a class-level `@Transactional` on a service that
also writes**
**Symptom:** write methods start failing on PostgreSQL, or silently not flushing
under Hibernate.
**Cause:** class-level attributes apply to every method that does not redeclare
them.
**Fix:** the Spring Data pattern is the model — read-only at class level, an
explicit read-write `@Transactional` on each mutating method. If that feels like a
lot of annotations, it is a sign the class is doing two jobs.

## Interview questions

**★ Where does the performance benefit of `readOnly = true` actually come from?**
From the ORM. With Hibernate, the read-only flag causes the dialect to prepare a
flush mode in which the automatic flush does not run, so the dirty-check pass —
comparing every managed entity against its load-time snapshot — does not run
either, and the snapshots do not need to be retained. On a read that loads
thousands of entities that is a meaningful saving in both CPU and heap. The
connection- and database-level effects are real but cost and save nothing on the
client side, which is why a pure `JdbcTemplate` path gets no speed-up from the
flag at all.

**★ What happens if you put `readOnly = true` on a method that is called from a
read-write transactional method?**
Nothing. The inner method participates in the outer transaction rather than
starting its own, and the propagation reference states that a participating
transaction "joins the characteristics of the outer scope, silently ignoring the
local isolation level, timeout value, or read-only flag (if any)". There is no
warning. The nasty part is that the same method entered directly from a
controller *would* be read-only, so its behaviour depends on the call graph
rather than on anything visible in the file.

**★ How do you make that silent ignore loud?**
Set `validateExistingTransaction` to `true` on the transaction manager. The
declarations are then validated against the transaction actually in progress and
a mismatch is rejected instead of dropped. It is the same switch the
`getIsolationLevel()` javadoc recommends for isolation mismatches, and it is
worth having on in tests even if you would not run it in production, because it
converts a whole class of decorative annotations into failures.

**★ Is `readOnly` ever meaningful without a transaction?**
Yes, with `PROPAGATION_SUPPORTS`. The `TransactionDefinition` javadoc says the
flag "applies to any transaction context, whether backed by an actual resource
transaction… or operating non-transactionally at the resource level
(`PROPAGATION_SUPPORTS`). In the latter case, the flag will only apply to managed
resources within the application, such as a Hibernate Session." So you keep the
flush-mode optimisation and lose the connection- and database-level behaviour,
because there is no resource transaction to mark.

**★ Why does mutating an entity in a read-only transaction not write it?**
Because the write would have happened at flush time via dirty checking, and the
read-only flag suppresses the automatic flush. In a read-write transaction,
changing a field on a managed entity produces an `UPDATE` at commit even though
you never called `save` — the persistence context compares the entity to its
load-time snapshot and writes the difference. Read-only removes that pass, so the
mutation stays in memory and dies with the persistence context. It is a useful
safety property, though the right lesson is to not mutate entities on read paths
rather than to rely on the flag to absorb it.

**★ Spring Data repositories are already read-only by default. Why annotate your
service at all?**
Because the repository's declaration is one of the ones that gets silently
ignored. `SimpleJpaRepository` is annotated `@Transactional(readOnly = true)` at
class level with write methods overriding it, which governs a repository call
made with no surrounding transaction. Once your service opens a transaction, the
repository call participates in it and inherits *your* boundary's flag. So the
annotation that decides the flush regime for a whole request is the one on the
outermost boundary, and that is yours.

**★ A colleague wants `readOnly = true` on every method "just to be safe". What
is wrong with that?**
Two things. On write methods it is actively harmful — on this stack it will fail
at the database, and under Hibernate it can suppress the flush that was supposed
to persist the work. On inner read methods it is noise: they will usually be
participating in an outer transaction that discards the flag, so the annotation
claims a property the method does not have. The useful discipline is the opposite
of blanket application — put the flag on the boundary that starts a read
transaction, and nowhere else.

---

← Prev: [15 · Read-only](15-read-only.md) · Index: [04 · Spring @Transactional](README.md) · Next → [16 · Isolation](16-isolation.md)
