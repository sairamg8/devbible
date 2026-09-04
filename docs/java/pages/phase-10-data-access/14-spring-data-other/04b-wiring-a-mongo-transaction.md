---
title: "Without a `MongoTransactionManager` bean, `@Transactional` on a MongoDB service is not an error and not a transaction — it is nothing, silently"
sidebar_label: "04b · Wiring a Mongo transaction"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *MongoDB Sessions and
> Transactions*
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/client-session-transactions.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/client-session-transactions.html)),
> the `MongoTransactionManager` javadoc
> ([docs.spring.io/spring-data/mongodb/docs/current/api/…/MongoTransactionManager.html](https://docs.spring.io/spring-data/mongodb/docs/current/api/org/springframework/data/mongodb/MongoTransactionManager.html))
> and the Spring Boot 4.1 auto-configuration-classes appendix for `spring-boot-data-mongodb`
> ([docs.spring.io/spring-boot/appendix/auto-configuration-classes/spring-boot-data-mongodb.html](https://docs.spring.io/spring-boot/appendix/auto-configuration-classes/spring-boot-data-mongodb.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data MongoDB 5.1.0, MongoDB 8.

**The previous chunk was about whether the server can give you a transaction. This one is
about whether your application ever asks for one. With JPA on the classpath Boot gives you
a `JpaTransactionManager` and `@Transactional` means what you expect. With MongoDB it does
not: the reference states in bold that transaction support is DISABLED unless you put a
`MongoTransactionManager` in the context, and an annotation with no manager behind it
throws nothing. Every write in the method still succeeds, independently, in whatever order
they were issued.**

## The bean you have to declare

Boot's auto-configuration for `spring-boot-data-mongodb` is four classes —
`DataMongoAutoConfiguration`, `DataMongoReactiveAutoConfiguration`,
`DataMongoRepositoriesAutoConfiguration`, `DataMongoReactiveRepositoriesAutoConfiguration`
— and none of them is a transaction-manager auto-configuration. The reference shows you
declaring it:

```java
@Bean
MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
    return new MongoTransactionManager(dbFactory);
}
```

> *"Also, make sure to use the same `MongoDatabaseFactory` when creating `MongoTemplate` to
> participate in transactions in the scope of the same `MongoDatabaseFactory`."*

And the sentence that makes this chunk necessary:

> *"Unless you specify a `MongoTransactionManager` within your application context,
> transaction support is **DISABLED**."*

⚠️ Read the failure mode carefully. It is not "`@Transactional` throws". It is
"`@Transactional` on a MongoDB service does nothing, and the writes happen one at a time".
The method returns successfully after a partial failure, because there was nothing to roll
back. There is no log line and no startup check — the exact shape of the dead-annotation
problem in
[05 · Annotations that do nothing](../04-spring-transactional/05-annotations-that-do-nothing.md),
arriving by a different route.

Once the bean exists, everything you know about `@Transactional` applies: it is still a
proxy, self-invocation still bypasses it, propagation still works the way
[04 · Spring `@Transactional`](../04-spring-transactional/README.md) describes. The manager
is different; the machinery around it is not.

`MongoTransactionManager` has constructors taking a `MongoDatabaseFactory` alone, a factory
plus `TransactionOptions`, and (since 4.3) a factory plus a
`MongoTransactionOptionsResolver` and default options. None of them is deprecated in the
5.1 API.

## The session underneath

A MongoDB transaction is carried by a `ClientSession`. `MongoTransactionManager` binds one
to the thread; `MongoTemplate` notices it and attaches it to every command it sends. You
can also drive a session yourself:

> *"Obtain a new session from the server."* … *"Use `MongoOperation` methods as before. The
> `ClientSession` gets applied automatically."* … *"Make sure to close the `ClientSession`."*

> *"When dealing with `DBRef` instances, especially lazily loaded ones, it is essential to
> **not** close the `ClientSession` before all data is loaded. Otherwise, lazy fetch
> fails."*

That last one is the closest thing MongoDB has to a `LazyInitializationException`: a lazy
`DBRef` resolved after the session closed fails, for the same structural reason a lazy
association fails after the persistence context closes. The mechanisms are unrelated; the
lesson — **do not let a lazily-resolved handle outlive the thing that resolves it** — is
identical, and [10 · Lazy loading](../10-lazy-loading/01-what-a-proxy-actually-is.md) is
the same story in JPA.

For reactive code the manager is `ReactiveMongoTransactionManager` and the session lives in
the Reactor context rather than a `ThreadLocal`, which is the only sane place for it when
there is no thread affinity to bind to.

## `count()` becomes an aggregation inside a transaction

This is the most surprising documented behaviour on the page:

> *"Once `MongoTemplate` detects an active transaction, all exposed `count()` methods are
> converted and delegated to the aggregation framework using `$match` and `$count`
> operators, preserving `Query` settings, such as `collation`."*

The reason is a server restriction on `count` inside a transaction; Spring Data works
around it by rewriting. The rewrite has consequences you must handle in your own query
code:

> *"Restrictions apply when using geo commands inside of the aggregation count helper. The
> following operators cannot be used and must be replaced with a different operator:
> `$where` → `$expr`, `$near` → `$geoWithin` with `$center`, `$nearSphere` → `$geoWithin`
> with `$centerSphere`"*

> *"Queries using `Criteria.near(…)` and `Criteria.nearSphere(…)` must be rewritten to
> `Criteria.within(…)` respective `Criteria.withinSphere(…)`. Same applies for the `near`
> query keyword in repository query methods that must be changed to `within`."*

So a `countByLocationNear(…)` repository method works outside a transaction and fails
inside one. The behaviour of a query depends on whether a transaction happens to be active
in the caller — which is not a property any other store in this phase has.

## Transaction options are labels, not attributes

There is no `@Transactional(readConcern = …)`. Spring Data reads options out of the
generic `label` attribute:

> *"Transactional service methods can require specific transaction options to run a
> transaction. Spring Data MongoDB's transaction managers support evaluation of transaction
> labels such as `@Transactional(label = { "mongo:readConcern=available" })`."*

> *"By default, the label namespace using the `mongo:` prefix is evaluated by
> `MongoTransactionOptionsResolver` that is configured by default."*

The four documented options:

| Label | Values |
|---|---|
| `mongo:readConcern=` | `LOCAL` `MAJORITY` `LINEARIZABLE` `SNAPSHOT` `AVAILABLE` |
| `mongo:writeConcern=` | `ACKNOWLEDGED` `W1` `W2` `W3` `UNACKNOWLEDGED` `JOURNALED` `MAJORITY` |
| `mongo:readPreference=` | `PRIMARY` `SECONDARY` `SECONDARY_PREFERRED` `PRIMARY_PREFERRED` `NEAREST` |
| `mongo:maxCommitTime=` | an ISO-8601 duration, e.g. `PT1S` |

```java
@Transactional(label = { "mongo:readConcern=majority", "mongo:maxCommitTime=PT2S" })
public void settle(String orderId) { … }
```

Because these are strings in a general-purpose attribute, **a typo is not a compile error
and, being outside the `mongo:` namespace or misspelled inside it, may simply not apply**.
The durability guarantee you thought you configured is the one thing you cannot see in the
type system.

## `readOnly` still starts a transaction

> *"`@Transactional(readOnly = true)` advises `MongoTransactionManager` to also start a
> transaction that adds the `ClientSession` to outgoing requests."*

This is the opposite of the intuition JPA builds, where `readOnly = true` is a hint that
can skip flushing and dirty checking. Here it does not avoid the transaction — so it does
not avoid the deployment requirement, the cost, or the `count()` rewrite. A read-only
MongoDB service method annotated out of habit has *acquired* a transaction, not avoided one.

## `TransactionTemplate` and the synchronization switch

If you use a `TransactionTemplate`, or want the template to join a transaction managed by
something other than `MongoTransactionManager`:

> *"You can use `setSessionSynchronization(ALWAYS)` to participate in ongoing non-native
> MongoDB transactions."*

Set it during configuration, not at runtime:

> *"Changing state of `MongoTemplate` during runtime … can cause threading and visibility
> issues."*

## Retrying: the reference names the library

> *"MongoDB can add special labels to errors raised during transactional operations. Those
> may indicate transient failures that might vanish by merely retrying the operation. We
> highly recommend Spring Retry for those purposes."*

A transient transaction error is expected traffic on a replica set, not an incident, and
the retry has to be **outside** the transaction boundary — a retry inside the same
transaction retries nothing. That is the same placement rule as
[03 · Retrying safely](../03-jdbc-transactions/14-retrying-safely.md), and the same
requirement that the retried unit of work be idempotent.

## Gotchas

**★ No `MongoTransactionManager` bean means `@Transactional` does nothing, silently.** Not
an exception, not a warning. The writes happen individually and a mid-method failure leaves
the earlier ones committed.

**★ Boot does not auto-configure the manager.** The four MongoDB auto-configuration classes
do not include one. This is the difference from JPA that catches everyone who has only ever
used JPA with Boot.

**★ `MongoTemplate` and `MongoTransactionManager` built on different
`MongoDatabaseFactory` instances do not share a transaction.** The reference says to use
the same factory. Two factories is a plausible arrangement in a multi-database application
and it produces a manager that manages nothing your template does.

**★ `@Transactional(readOnly = true)` starts a transaction here.** It does not opt out of
anything. On a standalone deployment it turns a working read-only method into a failing
one.

**★ `count()` inside a transaction is silently a different query.** It becomes a
`$match`/`$count` aggregation. Same answer in the normal case, different operator support,
different performance profile, and different failure modes for geo queries.

**★ A `Near` repository query breaks inside a transaction and works outside it.** The
reference says `near` must become `within` and `nearSphere` must become `withinSphere` for
the count helper. The caller's transactional state changes what the query method can do.

**★ Transaction options are strings in a `label` array.** A misspelled label is not a
compile error, and a write concern you believed you had set is the hardest kind of missing
configuration to notice.

**★ Closing a `ClientSession` before lazy `DBRef` resolution fails the fetch.** Manual
session management has a lifetime obligation exactly like a persistence context, and the
same class of bug.

**★ Implicit collection creation inside a transaction fails, so the manager makes
first-run behaviour worse.** Adding a transaction manager to an application can break tests
that used to pass on an empty database.

**★ Transient errors are normal and need a retry outside the boundary.** Retrying inside
the transaction re-runs the operations in an already-doomed transaction. The retry has to
restart the whole unit of work.

**★ A JPA transaction manager and a Mongo transaction manager in the same application do
not compose.** There is no two-phase commit here. A method transactional against one store
is not transactional against the other, and with two managers in the context an unqualified
`@Transactional` resolves to whichever one is primary — see
[04 · Which manager you have](../04-spring-transactional/06b-which-manager-you-have.md).

**★ Setting `sessionSynchronization` at runtime is a threading bug.** The reference warns
about visibility explicitly. It is configuration-time state.

## Interview questions

**★ What happens if you annotate a MongoDB service method `@Transactional` with no
transaction manager configured?**
Nothing happens. The reference states transaction support is disabled unless a
`MongoTransactionManager` is in the context, and there is no error — the writes proceed
individually. A partial failure leaves partial data and the method looks like it worked.

**★ Why does Boot configure a transaction manager for JPA and not for MongoDB?**
Because a JPA `EntityManagerFactory` always supports transactions and a MongoDB deployment
may not. Auto-configuring a manager that cannot work against a standalone server would turn
every write into a startup-time promise the deployment cannot keep. Declaring it is an
explicit statement that your deployment supports transactions.

**★ Why does `count()` behave differently inside a transaction?**
Because the server does not allow the `count` command inside one, so `MongoTemplate`
rewrites every `count()` to a `$match`/`$count` aggregation. That rewrite does not support
`$where`, `$near` or `$nearSphere`, which is why geo criteria must be expressed as
`within`/`withinSphere` in transactional code.

**★ How do you set a read concern or a write concern for one transactional method?**
Through transaction labels: `@Transactional(label = { "mongo:readConcern=majority" })`,
resolved by the `MongoTransactionOptionsResolver` that is configured by default. There is
no dedicated annotation attribute, and the labels are unchecked strings.

**★ Is `@Transactional(readOnly = true)` a way to avoid the replica-set requirement?**
No. The reference says it advises the manager to start a transaction anyway and attach the
`ClientSession` to outgoing requests. It changes nothing about whether a transaction is
started.

**★ How should transient transaction errors be handled?**
Retry the whole unit of work from outside the transaction boundary — the reference
recommends Spring Retry. Retrying inside the transaction accomplishes nothing, and the
retried operation has to be idempotent because you cannot know whether a commit that
reported a failure actually applied.

**★ Can one transaction span Postgres and MongoDB?**
No. Two `PlatformTransactionManager` implementations do not compose into a distributed
transaction here, and a method transactional against one is simply not transactional
against the other. Making two stores consistent is an application-level problem — an outbox
or a compensating action — not an annotation.

**★ What is the MongoDB equivalent of `LazyInitializationException`?**
Resolving a lazy `DBRef` after the `ClientSession` has been closed. The reference warns
against it directly. Different mechanism, identical lesson about handles that outlive their
context.

{/* FOOTER */}
