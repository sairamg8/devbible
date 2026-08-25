---
title: "validateExistingTransaction turns a silently ignored setting into an exception — off by default, and one of the few flags worth switching on unasked"
sidebar_label: "8c · Making the mismatch loud"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `AbstractPlatformTransactionManager` javadoc
> ([.../transaction/support/AbstractPlatformTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html))
> and the PostgreSQL 18 manual *SET TRANSACTION*
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)),
> the `AbstractPlatformTransactionManager` source
> ([github.com/spring-projects/spring-framework/.../AbstractPlatformTransactionManager.java](https://github.com/spring-projects/spring-framework/blob/main/spring-tx/src/main/java/org/springframework/transaction/support/AbstractPlatformTransactionManager.java))
> and the Spring Boot 4.1 `TransactionManagerCustomizer` javadoc
> ([.../boot/transaction/autoconfigure/TransactionManagerCustomizer.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/transaction/autoconfigure/TransactionManagerCustomizer.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**[Chunk 8b](08b-whose-settings-win.md) is the rule: a participating transaction
silently discards its own isolation, timeout and read-only flag. This chunk is the one
switch that turns that silence into an exception. It is off by default, it does not
cover everything, and in a new codebase it is worth switching on before anybody asks for
it.**

## Making the mismatch loud: `validateExistingTransaction`

Spring offers a switch that turns the silence into an error:

```java
@Bean
JdbcTransactionManager transactionManager(DataSource ds) {
    JdbcTransactionManager tm = new JdbcTransactionManager(ds);
    tm.setValidateExistingTransaction(true);      // default is false
    return tm;
}
```

The reference:

> *"Consider switching the `validateExistingTransaction` flag to `true` on your
> transaction manager if you want isolation level declarations to be rejected
> when participating in an existing transaction with a different isolation level.
> This non-lenient mode also rejects read-only mismatches (that is, an inner
> read-write transaction that tries to participate in a read-only outer scope)."*

| | `false` (default) | `true` |
|---|---|---|
| inner isolation differs from outer | ignored | **exception** |
| inner read-write inside read-only outer | ignored | **exception** |
| inner timeout differs | ignored | ignored |

🔴 **It catches isolation and read-only, not timeout.** And note the read-only
direction: it rejects a read-**write** inner scope inside a read-**only** outer
one, which is the genuinely dangerous mismatch — a method that intends to write,
running inside a boundary that told the database it would not.

**Worth turning on in a new codebase.** It converts a class of silent wrongness
into a startup-or-runtime failure, and the cost is that you have to mean the
annotations you write.

## Turning it on without replacing Boot's manager

The example above declares the manager by hand, which works and costs you something:
[chunk 6c](06c-what-boot-picked-for-you.md) notes that declaring your own
`TransactionManager` bean makes auto-configuration back off, so
`spring.transaction.default-timeout` and `rollback-on-commit-failure` stop applying and
future Boot improvements do not reach you. Boot 4 has a callback for exactly this:

```java
@Bean
TransactionManagerCustomizer<AbstractPlatformTransactionManager> validateTransactions() {
    return tm -> tm.setValidateExistingTransaction(true);
}
```

`TransactionManagerCustomizer` is documented as a "Callback interface that can be
implemented by beans wishing to customize a `TransactionManager` to fine-tune its
auto-configuration", with a single `customize(T transactionManager)` method. Typing it
to `AbstractPlatformTransactionManager` is what gives you the setter, and it is the
right level: `validateExistingTransaction` lives on that base class, so the customizer
works whether Boot picked the JDBC manager or the JPA one.

## What the failure actually looks like

Two distinct `IllegalTransactionStateException` messages, both from the participation
path in `AbstractPlatformTransactionManager`, and both worth recognising:

> `Participating transaction with definition [...] specifies isolation level which is
> incompatible with existing transaction: <name of the existing level>`

> `Participating transaction with definition [...] is not marked as read-only but
> existing transaction is`

Two details the source makes precise. The isolation check only fires when the inner
definition names a level at all — `ISOLATION_DEFAULT` is skipped, so an unannotated
inner method never trips it. And the check reads the existing level from
`TransactionSynchronizationManager.getCurrentTransactionIsolationLevel()`, which returns
`null` when the outer boundary did not set one; in that case any inner declaration is a
mismatch and the message ends with `(unknown)`. That is worth expecting, because
"outer sets nothing, inner sets `READ_COMMITTED`" is a very common shape and it now
fails.

## The trade-off

The default is lenient because leniency is what makes `REQUIRED` composable. If a
participating scope rejected every setting it could not honour, a repository
method annotated `readOnly = true` — a perfectly reasonable thing to write —
would break the moment somebody called it from a read-write service. Spring chose
to let the outer scope win quietly, so that composition never fails. The price is
that the annotation and the behaviour disagree, with nothing to tell you.
`validateExistingTransaction` inverts that trade: composition now fails loudly
when the declarations disagree, and you have to mean what you write. For a new
codebase that is the better bargain, and it is the reason the flag exists at all.

## Gotchas

**⚠️ A read-write method called inside a `readOnly = true` boundary**
**Symptom:** with PostgreSQL, an error from the server when the write is
attempted; with a manager that ignores the hint, silent success.
**Cause:** the outer scope told the database the transaction is read-only, and
the inner scope's read-write declaration was ignored.
**Fix:** this is exactly the mismatch `validateExistingTransaction` rejects. Turn
it on and the annotation stops lying.

**⚠️ Turning on `validateExistingTransaction` in an existing codebase without
looking**
**Symptom:** exceptions in production from methods that had worked for years.
**Cause:** it converts every latent mismatch into a failure, and a large codebase
has some.
**Fix:** turn it on in a test environment first and treat the failures as a
worklist. It is finding real bugs; it is just finding all of them at once.

**⚠️ Expecting `validateExistingTransaction` to police timeouts too**
**Symptom:** a timeout mismatch still passes silently after turning the flag on.
**Cause:** the reference names isolation and read-only; timeout is not covered.
**Fix:** treat the timeout as the outermost method's to declare, with no
enforcement available.

## Interview questions

**★ What does `validateExistingTransaction` do, and would you turn it on?**
It makes a participating transaction reject settings it cannot honour instead of
ignoring them. Specifically it rejects an isolation-level declaration that
differs from the existing transaction's, and it rejects a read-write inner scope
participating in a read-only outer scope. It does not police timeouts. I would
turn it on in a new codebase without hesitation, because it converts a whole
class of silent wrongness into an immediate failure, and the only cost is that
you have to mean the annotations you write. In an existing codebase I would turn
it on in a test environment first and treat the resulting failures as a worklist,
because a large application will have accumulated mismatches — every one of which
is a place where somebody believed a setting was in effect and it was not.

**★ Which of the read-only mismatches does `validateExistingTransaction` reject,
and why that direction?**
It rejects an inner **read-write** scope participating in a **read-only** outer
scope. That is the dangerous direction: the outer boundary has already told the
database and the persistence layer that this transaction will not write — with
PostgreSQL that can mean an actual `BEGIN READ ONLY`, under which the write will
be refused by the server — and the inner method's declaration that it intends to
write was discarded. Without the flag you find out when the write fails, or
worse, when a manager that treats read-only as a pure hint lets it through and
the optimisation assumptions elsewhere are quietly wrong. The other direction — a
read-only inner scope inside a read-write outer one — is merely a lost
optimisation, so it is not worth failing over.

**★ How do you enable it in a Boot application without giving up auto-configuration?**
With a `TransactionManagerCustomizer` bean rather than a `TransactionManager` bean. The
distinction matters because declaring the manager yourself makes Boot's
auto-configuration back off entirely, which silently disables
`spring.transaction.default-timeout` and `rollback-on-commit-failure` and leaves the
wiring to the auto-configured `DataSource` as your problem across upgrades. The
customizer is documented as a "Callback interface that can be implemented by beans
wishing to customize a `TransactionManager` to fine-tune its auto-configuration" — so
Boot still builds and configures the manager and then hands it to you for one setter
call. Type the customizer to `AbstractPlatformTransactionManager`, which is where
`validateExistingTransaction` lives, so the same bean works whether the auto-configured
manager turned out to be the JDBC one or the JPA one.

**★ What exception do you get, and what does the message tell you?**
`IllegalTransactionStateException`, with one of two messages depending on which check
fired: "Participating transaction with definition [...] specifies isolation level which
is incompatible with existing transaction: &lt;level&gt;", or "Participating transaction
with definition [...] is not marked as read-only but existing transaction is". The
definition is printed in full, so the message names the *inner* declaration, and the
isolation variant also names the level the *outer* transaction is actually running at —
which between them is the whole diagnosis. Watch for `(unknown)` as that trailing value:
it means the outer boundary set no isolation at all, so the current level came back
`null`. That is the most common way the flag fires on a codebase turning it on for the
first time, and it is not a bug — an inner method declaring a level inside an
outer boundary that declared none is exactly the mismatch the flag exists to surface.

**★ Why does it not police timeouts, when the same rule silently ignores those too?**
Because a timeout mismatch is not a correctness contradiction the way the other two are.
Isolation cannot vary within one physical transaction at all — the database fixes it at
`BEGIN` — so an inner declaration of a different level is a statement that cannot be
satisfied. Read-only is the same shape in the dangerous direction: the outer boundary
may have issued `BEGIN READ ONLY`, and an inner scope declaring read-write is asking for
something the session will refuse. A timeout, by contrast, *is* honoured — just not the
inner one. The outer transaction's deadline lives on the thread-bound resource holder
and applies to every statement the inner method issues, so the inner method runs under
a real, enforced deadline that simply is not the one it asked for. Spring's position is
that a shorter-than-requested budget is a lesser evil than an impossible isolation
level, so it is left lenient and the outermost boundary owns the timeout.

---

← Prev: [8b · Whose settings win](08b-whose-settings-win.md) · Index: [Spring @Transactional](README.md) · Next → [9 · Marked rollback-only](09-marked-rollback-only.md)
