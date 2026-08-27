---
title: "Three Spring mechanisms move the transaction boundary away from where the @Transactional annotation appears to put it — propagation, self-invocation and the read-only flag — and each one produces a variant of this exception whose obvious explanation is wrong"
sidebar_label: "04d · The boundary moves"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference, *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Transaction propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> and the Hibernate ORM 7.4 *Introduction* §5.1 on persistence-context lifetime and thread
> confinement and §5.5 on `merge`
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**"Am I in a transaction?" is the wrong question, and answering it correctly is why so many
people get stuck. The question that matters is "is the object in my hand managed by the
persistence context that is currently bound to this thread" — and there are three ordinary
Spring mechanisms that make those two questions have different answers. A `REQUIRES_NEW` call
returns detached objects to a caller that is still inside a transaction. A self-invocation
runs a `@Transactional` method with no transaction at all. And `readOnly = true`, which
everybody adds to read paths, changes nothing about any of this while sounding like it should.
Each produces a `LazyInitializationException` whose obvious explanation is wrong, which is why
they are worth their own page.** Continues
**[04c · What looks safe and is not](04c-what-looks-safe-and-is-not.md)**.

## 1 · `REQUIRES_NEW` detaches inside a transaction

```java
@Service
class ReportService {

    @Transactional
    public Report build(long id) {
        Order order = auditedLoader.loadInNewTx(id);   // REQUIRES_NEW
        return render(order.getLines());               // still inside the OUTER transaction
    }
}

@Service
class AuditedLoader {

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Order loadInNewTx(long id) { … }
}
```

The Spring reference on what `REQUIRES_NEW` does:

> *"`PROPAGATION_REQUIRES_NEW`, in contrast to `PROPAGATION_REQUIRED`, always uses an
> independent physical transaction for each affected transaction scope, never participating in
> an existing transaction for an outer scope."*

and on the resources:

> *"The resources attached to the outer transaction remain bound there while the inner
> transaction acquires its own resources such as a new database connection."*

For JPA that means the inner scope gets its **own `EntityManager`**, and
`JpaTransactionManager` closes it when the inner transaction completes, exactly as it would
for a top-level call. The outer scope's persistence context is suspended for the duration and
restored afterwards.

So `order` was managed by a persistence context that no longer exists, while the caller is
inside a different, open one. `order.getLines()` throws.

🔴 **This is the variant where every instinct is wrong.** The developer checks the caller: it
is `@Transactional`. Checks the callee: also `@Transactional`. Checks whether a session is
bound to the thread: yes, one is. Everything reads correct, and the object is still detached,
because being in *a* persistence context is not the same as being in *this* one.

There is a second, quieter consequence. If the outer context had already loaded that row, you
now hold two Java objects for one database row — one managed, one detached. Writes to the
detached one are not flushed. `==` between them is false. Whether `equals` agrees depends
entirely on how the entity implements it
(**[Topic 06 · 10b · Fixing entity equality](../06-jpa-hibernate-model/10b-fixing-entity-equality.md)**).

`REQUIRES_NEW` is used for exactly the right reasons — an audit row that must survive a
rollback, an outbox write, an idempotency marker. The mistake is not using it; it is returning
an entity from it.

## 2 · Self-invocation removes the transaction entirely

```java
@Service
class OrderService {

    public Order find(long id) {
        return loadInTx(id);          // through `this` — the proxy is bypassed
    }

    @Transactional(readOnly = true)
    public Order loadInTx(long id) {
        return orders.findById(id).orElseThrow();
    }
}
```

Spring's declarative transaction management is proxy-based. The reference is direct about
what that costs:

> *"In proxy mode (which is the default), only external method calls coming in through the
> proxy are intercepted. This means that self-invocation (in effect, a method within the
> target object calling another method of the target object) does not lead to an actual
> transaction at runtime even if the invoked method is marked with `@Transactional`."*

So `loadInTx` runs with whatever transactional context `find` had — which is none. Spring
Data's repository proxy will open its own short transaction for the `findById` call, and
close it, and the entity is detached before `loadInTx` returns.

The same paragraph adds a second case worth knowing, because it fails at startup rather than
under load:

> *"Also, the proxy must be fully initialized to provide the expected behavior, so you should
> not rely on this feature in your initialization code — for example, in a `@PostConstruct`
> method."*

⚠️ **Under open-session-in-view this is invisible**, because a persistence context is bound to
the thread for the whole request regardless of transactions. So a missing transaction can
survive years of code review and then produce a wave of failures on the day the property is
flipped. That is one of the reasons the migration in
**[07 · Turning open-in-view off](07-turning-open-in-view-off.md)** finds things nobody
expected.

## 3 · `readOnly = true` changes nothing here

`@Transactional(readOnly = true)` does two useful things: it lets Hibernate set the flush mode
to manual and skip taking dirty-check snapshots, and it lets Spring mark the JDBC connection
read-only, which some drivers and some replicas act on.

**It does not extend the persistence context past the method return, and it does not make the
returned graph safe.** It is a performance and safety annotation, not a lifetime annotation.
It appears in this topic only because it is regularly proposed as a fix by people who read
that it "avoids dirty checking" and inferred that it changes when the session closes.

## 4 · Merging it back does not restore what you are holding

The reflex when an object is detached is to reattach it. It does not do what people expect:

```java
@Transactional
public void touch(Order detached) {
    Order managed = em.merge(detached);   // a DIFFERENT object
    detached.getLines().size();           // still throws
}
```

The introduction is explicit about the two-object outcome:

> *"In step 3, the original entity instance `e` remains detached, but `merge()` returns a
> distinct instance `f` representing the same row of the database and associated with the new
> persistence context. That is, `merge()` trades a detached instance for a persistent instance
> representing the same row."*

So the reference you were holding is still detached and still throws. Written correctly —
`order = em.merge(order)` — it works, at the cost of a second transaction and a second query
for data you had already queried once, plus the hazards of merging a graph whose collections
are uninitialised proxies:
**[Topic 06 · 13b · Merge returns a copy](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)**.

## What all four have in common

Not one of them is fixed by understanding transactions better. In every case the code was
correct about transactions and wrong about *what it returned*. The object escaped the scope
that gave it meaning, and every mechanism above is just a different way for the scope to end
earlier than the reference does.

One more family of cases behaves the same way without involving `@Transactional` at all:
references that simply outlive the method that made them — a future, a stream, a cache entry,
an HTTP session attribute. Those are
**[04e · References that outlive the method](04e-references-that-outlive-the-method.md)**.

## Gotchas

**★ `REQUIRES_NEW` detaches even though the caller is in a transaction.** Suspension unbinds
the current persistence context and binds a new one for the inner call. The object comes back
belonging to a context that is now closed, while the caller's context — a different one — is
open. "But I *am* in a transaction" is true and irrelevant.

**★ After a `REQUIRES_NEW`, you can hold two objects for one row.** One managed, one detached.
Writes to the detached one silently do nothing, reads from it are stale, and `==` is false.
This is a data-correctness bug hiding behind a lazy-loading symptom.

**★ Self-invocation silently removes the transaction, and open-in-view hides it.** A call
through `this` does not reach the proxy, so `@Transactional` is not applied. With OSIV on, a
context is bound to the thread anyway and everything appears to work — which is how a missing
transaction survives review for years.

**★ Self-invocation also removes `readOnly`, `timeout`, `isolation` and rollback rules.** The
lazy-loading failure is the loudest consequence and the least serious one. A method you
believe is running with `SERIALIZABLE` isolation and a five-second timeout is running with
neither.

**★ `readOnly = true` is not a lifetime setting.** It changes flush behaviour and connection
flags. It does not keep the persistence context open. It is worth having on read paths for its
own reasons and it will never fix this exception.

**★ `merge` returns a different object and does not repair the one you passed.** Reassigning
the result is mandatory; `em.merge(order);` on its own line is nearly always a bug, and static
analysis rarely flags it because the return value is legitimately ignorable in other APIs.

## Interview questions

**★ A method is annotated `@Transactional`, the caller is `@Transactional`, and you still get
this exception. How?**
Two likely causes. Either the inner method is `REQUIRES_NEW`, so its persistence context was a
new one that was closed when it returned while the caller's context is a different, still-open
one; or the inner method was called through `this`, so the proxy was bypassed, its
`@Transactional` never applied, and it ran under whatever context happened to exist. In both
cases the useful question is not "am I in a transaction" but "is this object managed by the
context currently bound to this thread".

**★ Why does self-invocation bypass `@Transactional`?**
Because Spring implements declarative transactions with a proxy that wraps the bean. Callers
outside the bean hold a reference to the proxy, so their calls are intercepted. A call through
`this` inside the bean goes directly to the target object and never touches the proxy, so no
interceptor runs. The reference states this explicitly for proxy mode, which is the default.
The workarounds are to move the method to another bean, to inject a self-reference, or to
switch to AspectJ weaving — and moving the method is almost always the right one, because the
need for a separate transaction usually indicates a separate responsibility.

**★ Does `@Transactional(readOnly = true)` help with lazy loading?**
No. It lets Hibernate skip dirty-check snapshots and lets Spring mark the JDBC connection
read-only, which is worth doing on read paths for its own reasons. It has no effect on when the
persistence context closes, so the returned graph is detached at exactly the same moment either
way.

**★ Why does `merge` not fix a detached entity you are holding?**
Because `merge` does not reattach the instance you pass. It finds or loads a managed instance
for the same identity, copies the detached state onto it, and returns that managed instance.
Your original reference is untouched and still detached, so reading an uninitialised
association through it still throws. The correct use is always `x = em.merge(x)`, and even then
the object you now hold is a different one from the object you had — which matters if anything
else in the request is still holding the old reference.

**★ How do you decide whether a `REQUIRES_NEW` method should return anything at all?**
Prefer that it returns nothing, or an identifier, or a value type. Its whole purpose is to have
an independent lifecycle, and an entity is a reference into a persistence context whose
lifecycle it just ended. If the caller needs data from it, either return a record or return the
id and let the caller load it in its own context — which is also the only version where the
caller's identity map stays consistent.

{/* FOOTER */}
