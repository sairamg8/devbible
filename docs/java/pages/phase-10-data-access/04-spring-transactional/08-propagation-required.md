---
title: "Three annotated methods in a call chain produce three logical scopes and exactly one physical transaction, and only the outermost one's settings survive"
sidebar_label: "8 · Propagation REQUIRED"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html))
> and the `TransactionDefinition` javadoc
> ([.../org/springframework/transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**`REQUIRED` is the default, which means most people have never chosen it. Its
javadoc description is one sentence — *"Support a current transaction, create a
new one if none exists"* — and hidden in it is the distinction that explains most
of the confusing behaviour in this topic: a `@Transactional` method creates a
**logical** transaction scope, and several logical scopes map onto **one physical
transaction**. One connection. One commit. This chunk is that distinction;
[chunk 8b](08b-whose-settings-win.md) is its most expensive consequence — the
settings of every scope but the outermost are silently discarded.**

## The code

```java
@Service
class CheckoutService {

    private final OrderWriter orders;
    private final StockWriter stock;

    @Transactional                                   // ← scope 1
    public void checkout(Cart cart) {
        orders.write(cart);
        stock.reserve(cart);
    }
}

@Component
class OrderWriter {
    @Transactional                                   // ← scope 2
    public void write(Cart cart) { ... }
}

@Component
class StockWriter {
    @Transactional                                   // ← scope 3
    public void reserve(Cart cart) { ... }
}
```

**Three annotations. One transaction. One connection. One commit, at the end of
`checkout`.** `write` and `reserve` do not begin anything and do not commit
anything — they join what `checkout` started.

## Logical and physical

The reference states it precisely:

> *"When the propagation setting is `PROPAGATION_REQUIRED`, a logical transaction
> scope is created for each method upon which the setting is applied… In the case
> of standard `PROPAGATION_REQUIRED` behavior, all these scopes are mapped to the
> same physical transaction."*

| | Logical scope | Physical transaction |
|---|---|---|
| created by | each `@Transactional` method entered | the outermost scope only |
| how many here | three | one |
| owns | a rollback-only flag of its own | the connection, the isolation level, the timeout |
| ends with | a return, which commits nothing | the real `COMMIT` or `ROLLBACK` |

```
checkout          scope 1   ← BEGIN here, physical transaction starts
  ├── write       scope 2      (participates — isNewTransaction() == false)
  └── reserve     scope 3      (participates — isNewTransaction() == false)
return            scope 1   ← COMMIT here
```

🔴 **`TransactionStatus.isNewTransaction()` is how you tell them apart.** It is
true only in `checkout`. If you have ever wondered "which of these three methods
actually owns the transaction", that boolean is the answer.

The reference also explains why `REQUIRED` is the right default:

> *"This is a fine default in common call stack arrangements within the same
> thread (for example, a service facade that delegates to several repository
> methods where all the underlying resources have to participate in the
> service-level transaction)."*

## Where the commit actually happens

At the outermost boundary, and only there. Three consequences follow, and each
of them explains a question people ask:

1. **Nothing is durable until `checkout` returns.** A method that writes a row
   and returns has not committed anything; a later failure in the caller undoes
   it. This is usually what you want, and it is why the boundary belongs on the
   unit of business work.
2. **The connection is held for the whole outermost method** — including any
   part of it that touches no database. That is the pool-pressure argument in
   [chunk 7b](07b-getting-the-connection-safely.md).
3. **The commit can fail after every method has returned successfully.** Deferred
   constraints and serialization failures surface there, and so does
   `UnexpectedRollbackException` — [chunk 9](09-marked-rollback-only.md).

⚠️ **An inner scope's return is not a commit and its exception is not
necessarily a rollback either.** Each logical scope keeps its *own* rollback-only
flag, and an inner one setting that flag is what produces the most confusing
failure in the whole topic — again [chunk 9](09-marked-rollback-only.md).

## The trade-off

`REQUIRED` composes: any transactional method can be called from any other and
the result is one coherent unit of work, with no configuration and no thought.
That composability is the reason it is the default and the reason it is almost
always right. What you give up is **local control** — an annotated method cannot
know whether it is the boundary or a participant, so it can make no promise about
its own durability, its own locks, or its own settings.
[Chunk 8b](08b-whose-settings-win.md) is the settings half of that bill.

## Gotchas

**⚠️ Expecting an inner method's success to be durable**
**Symptom:** "the row was definitely written, I saw the method return" — and it
is not there.
**Cause:** the inner method committed nothing; the commit happens at the
outermost boundary and that boundary rolled back.
**Fix:** if the inner work must survive independently, it needs `REQUIRES_NEW` —
[chunk 10](10-requires-new.md) — and that has its own cost.

**⚠️ Annotating every method of every layer "to be safe"**
**Symptom:** no behavioural change and a codebase where nobody can find the real
boundary.
**Cause:** under `REQUIRED` the extra annotations are no-ops whenever an outer
one exists.
**Fix:** annotate the unit of work. An annotation that is only ever a participant
is documentation at best and a lie about isolation and timeout at worst.

**⚠️ Reading `isNewTransaction()` as "is there a transaction"**
**Symptom:** a check that reports false inside a perfectly good transaction.
**Cause:** it means "did *this* scope start the physical transaction", not "does
one exist".
**Fix:** `TransactionSynchronizationManager.isActualTransactionActive()` answers
the other question — [chunk 5b](05b-detecting-a-dead-annotation.md).

**⚠️ Believing "one transaction" means "one lock scope you can reason about
locally"**
**Symptom:** a long outer transaction holding row locks taken by an inner method
minutes earlier.
**Cause:** locks taken anywhere in the physical transaction are held until it
ends, which is the outermost boundary.
**Fix:** the length of the outermost method is the length of every lock inside
it. Keep it short.

**⚠️ Debugging a rollback by looking at the method that threw**
**Symptom:** hours spent on an inner method whose behaviour is entirely correct.
**Cause:** the rollback decision, the commit and the rollback rules all belong to
the outermost scope. The inner method merely propagated an exception.
**Fix:** find the outermost `@Transactional` in the call stack first. That is the
method whose annotation is deciding everything.

**⚠️ Assuming a method behaves the same whether or not it is called from a
transactional caller**
**Symptom:** a method that works standalone and behaves differently in
production, or the reverse.
**Cause:** the same annotated method is the boundary in one call path and a
participant in another, and those are genuinely different situations —
different durability, different isolation, different timeout.
**Fix:** know both paths exist. A method reachable both ways cannot promise
anything about its own transaction.

**⚠️ Calling a transactional method from a non-transactional one and expecting
the caller to be covered**
**Symptom:** work the caller did before the call is not rolled back when the
callee fails.
**Cause:** the physical transaction starts when the *annotated* method is
entered. Anything the caller did earlier was outside it.
**Fix:** move the boundary up to the method that represents the whole unit of
work.

**⚠️ A `@Transactional` method reached by two paths with different outer
boundaries**
**Symptom:** intermittent behaviour that correlates with which endpoint was
called.
**Cause:** in one path it is the outermost scope and its settings apply; in the
other it participates and they do not.
**Fix:** either give it no settings to lose, or split it into two methods with
honest annotations.

## Interview questions

**★ What is the difference between a logical and a physical transaction?**
A logical transaction scope is created every time a `@Transactional` method is
entered; a physical transaction is the real thing on the database — one
connection with autocommit off, one `COMMIT` or `ROLLBACK`. Under the default
`REQUIRED` propagation, the reference says "all these scopes are mapped to the
same physical transaction", so three annotated methods in a call chain produce
three logical scopes and one physical transaction. The outermost scope begins and
ends it; the inner ones participate. The distinction matters because each logical
scope can independently set a rollback-only marker, while only the physical
transaction has a connection, an isolation level, a timeout and a commit. Almost
every surprising behaviour in propagation comes from something being a property
of the physical transaction when people assume it is a property of the scope.

**★ Three methods in a chain are each `@Transactional`. How many commits happen?**
One, at the outermost boundary. The inner methods obtain a `TransactionStatus`
and return normally, but their "commit" is a no-op against a participating logical
scope — nothing reaches the database. The single real `COMMIT` runs when the
outermost method returns. Two consequences are worth stating: an inner method's
work is not durable when it returns, so a later failure in the caller undoes it;
and the connection is held from the start of the outermost method to its end,
including any part that does no database work at all. If you genuinely need inner
work to commit independently, that is `REQUIRES_NEW`, which uses a second
connection and brings a pool-sizing constraint.

**★ Is it good practice to annotate repository methods as well as service
methods?**
Under `REQUIRED` it changes nothing when a service boundary already exists, and
it costs clarity. The extra annotation is a no-op in the normal path, and it
carries a small lie: any isolation, timeout or read-only setting on it is
silently discarded whenever it participates, so a reader who sees
`@Transactional(readOnly = true)` on a repository method reasonably concludes
that the read is read-only and is wrong. There is one defensible argument for it
— a repository method called directly, with no service boundary above it, would
otherwise run in autocommit — and if that is a real path in your application then
annotate it and know why. Blanket-annotating every layer "to be safe" produces a
codebase where the actual boundary cannot be located by reading.

**★ Where do locks taken by an inner method get released?**
At the outermost boundary, with everything else. Row locks taken by an `UPDATE`
inside a participating method are locks of the physical transaction, and a
physical transaction releases its locks when it commits or rolls back — which is
when the outermost annotated method returns. This is the practical reason the
length of the outer boundary matters so much: a method that updates a hot row
early and then spends 800 ms on an HTTP call holds that row's lock for the whole
800 ms, blocking every other transaction that wants it. Reasoning about
contention therefore has to be done at the outermost boundary, never at the
method that took the lock, which is one of the least intuitive consequences of
logical scopes mapping onto one physical transaction.

**★ Why does the reference call `REQUIRED` "a fine default in common call stack
arrangements within the same thread"?**
Because it is the propagation that composes. Any transactional method can call
any other and the result is one coherent unit of work: nothing is durable until
the whole thing succeeds, everything shares one connection, and there is one
commit. The reference gives the shape it has in mind — "a service facade that
delegates to several repository methods where all the underlying resources have
to participate in the service-level transaction" — which is the arrangement most
applications actually have. Note the two qualifications in the sentence. "Common
call stack arrangements" excludes the cases where you deliberately want
independence, which is `REQUIRES_NEW`; and "within the same thread" excludes
anything handed to an executor, because the binding does not cross threads.

**★ The same annotated method is sometimes the boundary and sometimes a
participant. What does that mean for how you write it?**
It means the method cannot make promises about its own transaction. Its isolation,
timeout and read-only settings apply only when it happens to be outermost; its
work is durable on return only when it happens to be outermost; the locks it takes
are released when it returns only when it happens to be outermost. Writing under
`REQUIRED`, the honest posture is that a method declares *"this work needs to be
in a transaction"* and nothing more — which is exactly what the annotation's name
says. Anything stronger belongs on the method that is genuinely the unit of work,
and if a method must behave the same way regardless of caller, `REQUIRES_NEW` is
the propagation that gives that guarantee, at the cost of a second connection.

**★ You are told to "find the outermost `@Transactional` first". How do you do that at
runtime rather than by reading code?**
Ask for the transaction's name. `TransactionSynchronizationManager.getCurrentTransactionName()`
returns the name of the *actual* transaction, and with no name set on the
`TransactionDefinition` the interceptor exposes the fully-qualified class name plus a
dot plus the method name — so from anywhere inside the call chain, at any depth, that
one string names the method that opened the physical transaction. It is the fastest
answer to "whose settings are in force", "whose commit is going to run" and "how long
has this connection been held", because all three belong to that method. The same string
appears in the interceptor's own `TRACE` output as the joinpoint identification, so on a
running system where you cannot add code, turning on
`org.springframework.transaction.interceptor` at `TRACE` gives you the boundary's
identity from the log. Note the contrast with `TransactionStatus.isNewTransaction()`,
which answers the same question only from the boundary itself — it is `false` everywhere
you would actually be standing when you asked.

---

← Prev: [7b · Getting the connection safely](07b-getting-the-connection-safely.md) · Index: [04 · Spring @Transactional](README.md) · Next → [8b · Whose settings win](08b-whose-settings-win.md)
