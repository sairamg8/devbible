---
title: "@Transactional is metadata on a method, not an instruction to the JVM — and something has to be listening for it to mean anything"
sidebar_label: "1 · Not a language feature"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Transaction Management → Declarative transaction management*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html)),
> *Using `@Transactional`*
> ([.../declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and the `@EnableTransactionManagement` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, PostgreSQL 18.

**`@Transactional` looks like `synchronized`. It is not. `synchronized` is a
keyword the compiler turns into bytecode, and it works wherever you write it.
`@Transactional` is an annotation — a note attached to a method that changes
nothing on its own. The Spring reference says it plainly: the annotation "is
merely metadata that can be consumed by corresponding runtime infrastructure."
Something else has to read that note at startup, wrap your object, and open a
database transaction before your method body runs. Every strange behaviour in
this topic — the annotation that silently does nothing, the propagation setting
that is ignored, the `readOnly` that does not prevent writes — follows from that
one fact: a *different object* is doing the transaction work, and it only gets a
turn when a call actually reaches it.**

## The shape of the thing

Here is the code most services contain:

```java
@Service
public class OrderService {

    private final JdbcClient db;

    OrderService(JdbcClient db) { this.db = db; }

    @Transactional
    public long placeOrder(NewOrder order) {
        long id = db.sql("INSERT INTO orders (customer_id, total) VALUES (?, ?) RETURNING id")
                    .params(order.customerId(), order.total())
                    .query(Long.class).single();
        for (Line line : order.lines()) {
            db.sql("INSERT INTO order_lines (order_id, sku, qty) VALUES (?, ?, ?)")
              .params(id, line.sku(), line.qty())
              .update();
        }
        return id;
    }
}
```

The intent is obvious: the order row and its lines land together or not at all.
What is *not* obvious is that nothing in the method body mentions a transaction,
a connection, a commit or a rollback. The method issues four or five statements
and returns a number. Everything else happens **around** it.

## What "around it" means

Spring's transaction support is built on Spring AOP — aspect-oriented
programming, which for our purposes means one thing: **advice** (code that runs
around a method) attached to a **join point** (a method call), applied by
**wrapping** the object in a proxy. The reference is explicit that "the Spring
Framework's declarative transaction management is made possible through Spring
aspect-oriented programming (AOP)."

So the sequence at startup is:

1. Spring creates your `OrderService` bean.
2. A post-processor notices the class carries `@Transactional` somewhere.
3. It creates a **proxy** — a second object that looks like an `OrderService`.
4. **The proxy is what gets injected everywhere.** Your controller does not hold
   your object; it holds the proxy.

And at runtime, when the controller calls `placeOrder`:

| Step | Who | What |
|---|---|---|
| 1 | controller | calls `placeOrder` on the **proxy** |
| 2 | proxy | hands the call to the transaction interceptor |
| 3 | interceptor | reads the `@Transactional` metadata for this method |
| 4 | transaction manager | starts a transaction, binds a connection to the thread |
| 5 | **your method** | runs — sees the bound connection through `JdbcClient` |
| 6 | interceptor | commits, or rolls back if the rules say so |
| 7 | proxy | returns the value to the controller |

Steps 2, 3, 4, 6 are somebody else's code, running on either side of yours. That
is the whole mechanism, and the next chunk is about the object doing it.

## Nothing happens without the infrastructure switched on

The reference is blunt about this: "the mere presence of the `@Transactional`
annotation is not enough to activate the transactional behavior." Two things
must exist:

- **A transaction manager bean** — the object that knows how to begin and end a
  transaction against your resource.
- **`@EnableTransactionManagement`** on a `@Configuration` class, or the
  equivalent `<tx:annotation-driven/>` in XML, which registers the post-processor
  that builds the proxies.

In a Spring Boot application you write neither. Boot's auto-configuration
supplies a transaction manager as soon as it sees a `DataSource` (or an
`EntityManagerFactory`), and enables annotation-driven transaction management for
you. **This is convenient and it is also the reason people believe the annotation
is a language feature.** If you have only ever used Boot, you have never seen the
switch, so you have no reason to suspect there is one.

⚠️ **In a plain `spring-context` application, or a test slice that does not
import the transaction infrastructure, `@Transactional` genuinely compiles and
genuinely does nothing.** No warning, no error. Your writes still work, because
JDBC's autocommit mode commits each statement — they just are not atomic.

## Declarative and programmatic are two different tools

Spring offers two ways to control a transaction, and they are not
interchangeable.

| | Declarative — `@Transactional` | Programmatic — `TransactionTemplate` |
|---|---|---|
| Boundary | a whole method | any block you choose |
| Written in | an annotation | the method body |
| Coupling | business code has no Spring imports | business code calls Spring API |
| Composability | one transaction per method call | as many, as small, as you like |

The reference names the limitation of the declarative form exactly, and it is
worth memorising because it explains half of the workarounds later in this topic:

> *"declarative transaction management works at **method granularity around a
> thread of execution**. It cannot be used on arbitrary code blocks."*

**Method granularity** means the boundary is a method call, so if you want a
smaller boundary you must extract a method — and, as chunk 3 shows, extracting it
into the *same class* does not work. **Around a thread of execution** means the
transaction lives in a `ThreadLocal`, so work handed to another thread is outside
it, which is chunk 18.

## Why declarative is still the default choice

Nothing above is an argument for writing `TransactionTemplate` everywhere. The
reference's own comparison favours declarative management on four counts: it
works in any environment, applies to any class, supports declarative rollback
rules, and — the one that matters most in practice — "business objects do not
depend on the transaction infrastructure." A repository that imports
`org.springframework.transaction` is a repository you cannot unit-test without
Spring.

The honest position is: **use `@Transactional` for the ordinary case and know
exactly what it cannot do**, rather than avoiding it because it once surprised
you. The rest of this topic is that knowledge.

## Gotchas

**⚠️ Believing the annotation compiled means it is active**
**Symptom:** a method annotated `@Transactional` that commits its first insert
and leaves the failure half-written.
**Cause:** no `@EnableTransactionManagement` (or no auto-configuration) in this
context, so no proxy was ever created. The annotation is inert metadata.
**Fix:** confirm the infrastructure exists. In Boot it does; in a hand-rolled
`AnnotationConfigApplicationContext` or a narrow test context it may not.

**⚠️ Reading `@Transactional` as "this block is atomic"**
**Symptom:** a developer adds the annotation to a long method and assumes the
half of it that calls a payment API is covered too.
**Cause:** the annotation covers a *database* transaction. An HTTP call inside it
is not transactional and cannot be rolled back.
**Fix:** chunk 21 — decide deliberately what belongs inside the boundary.

**⚠️ Assuming `@Transactional` creates the transaction**
**Symptom:** confusion when propagation `REQUIRED` produces one transaction
across three annotated methods.
**Cause:** the annotation declares a *requirement*, not a *creation*. The default
propagation joins an existing transaction if there is one.
**Fix:** read the annotation as "this work must happen in a transaction", and
chunk 8 for what happens when one already exists.

**⚠️ Putting `@Transactional` on a controller**
**Symptom:** transactions that stay open for the duration of view rendering or
JSON serialisation, and pool exhaustion under moderate load.
**Cause:** the boundary is now the whole request.
**Fix:** the boundary belongs on the service method that represents one unit of
business work — the thing that must be all-or-nothing.

**⚠️ Two transaction managers and no qualifier**
**Symptom:** startup failure, or work committing against the wrong database.
**Cause:** with more than one `TransactionManager` bean, Spring cannot pick.
**Fix:** name it — `@Transactional("orders")` — using the `value` /
`transactionManager` attribute, or implement `TransactionManagementConfigurer`.

## Interview questions

**★ What does `@Transactional` actually do at compile time?**
Nothing beyond recording metadata in the class file. Annotations with
`RUNTIME` retention are stored in the bytecode and are readable by reflection;
they generate no code and change no instruction. The javac compiler does not
know what a transaction is. All the behaviour comes from Spring reading that
metadata during context startup and building a proxy around the bean, then from
that proxy intercepting calls at runtime. This is why the same annotation on the
same method behaves differently depending on how the object was obtained and who
called it — facts that would be impossible if it were a language feature.

**★ Why does the reference say declarative transactions work "at method
granularity around a thread of execution"?**
Two separate constraints in one sentence. *Method granularity*: the interception
point is a method invocation, so the smallest transaction you can declare is one
whole method — you cannot annotate a `for` loop or an `if` branch, and narrowing
the boundary means extracting a method into a different bean. *Around a thread of
execution*: the transaction manager binds its resources to a `ThreadLocal`, so
"the current transaction" means "the transaction on this thread". Any work that
moves to another thread — an `@Async` method, a parallel stream, an executor —
runs outside it and will not be rolled back with it.

**★ A colleague says "we do not need `@EnableTransactionManagement`, Boot does
it". Are they right, and does it matter?**
They are right about Boot and it still matters. Boot's auto-configuration
registers annotation-driven transaction management and a transaction manager when
it finds the relevant classes and beans on the classpath, so an ordinary Boot
application needs no annotation. It matters because the moment you build a
context yourself — a plain `AnnotationConfigApplicationContext`, a library, a
narrow test slice that excludes the auto-configuration — the annotation goes back
to being inert. Knowing which piece supplies the behaviour tells you what to
check when a transaction inexplicably is not there.

**★ If declarative transactions are so limited, why not use `TransactionTemplate`
everywhere?**
Because the limitation you are buying your way out of is smaller than the one you
are buying into. `TransactionTemplate` couples every method that uses it to
`org.springframework.transaction`, turns each transactional method into a lambda
one level deeper, and moves the boundary decision from something a reviewer can
see at a glance into the body of the method. The reference's own list of
declarative advantages ends with the one that matters — business objects do not
depend on the transaction infrastructure. The right split is: declarative by
default, `TransactionTemplate` where you genuinely need a boundary that is not a
method boundary, which in practice is a handful of places per service.

**★ What is the difference between "the annotation is ignored" and "the
transaction did not roll back"?**
They are different failures with different diagnostics, and conflating them
wastes hours. *Ignored* means no proxy interception happened at all: no
transaction was ever started, every statement ran in autocommit, and there was
nothing to roll back. Causes are structural — self-invocation, a private method,
missing infrastructure, `new`-ing the object. *Did not roll back* means the
transaction existed and the interceptor decided to commit it: the exception was a
checked one, or it was caught inside the method, or the rollback rules said so.
Causes are about exceptions, not proxies. The first question to ask is therefore
"was there a transaction?", not "why did it commit?".

**★ If the annotation was inert and no transaction was ever started, why did the
`INSERT` still work?**
Because JDBC's default is to commit every statement on its own. The `Connection`
javadoc states it directly — the default is for new connections to be in auto-commit
mode — and connection pools hand out connections in that state; HikariCP's
`autoCommit` property defaults to `true` for exactly that reason. So a method whose
`@Transactional` did nothing still writes successfully: each `INSERT` is its own
one-statement transaction, committed the moment it returns. What you lose is
atomicity, not persistence. This is precisely why the failure is silent — an inert
annotation produces working code that is wrong only when something fails halfway, and
the first sign of it is a half-written order in production. It is also what the
transaction manager changes: starting a transaction means setting autocommit to
`false` on the bound connection and taking responsibility for the commit yourself.

**★ You have two `DataSource`s. How does the interceptor decide which transaction
manager to use, and what happens if you do not tell it?**
By qualifier, and if you do not say, it fails or guesses wrong. With a single
`TransactionManager` bean the interceptor simply takes it. With more than one there is
no default, so you name it on the annotation — `@Transactional("orders")` using the
`value` attribute, which is an alias for `transactionManager` — or you implement
`TransactionManagementConfigurer` on a `@Configuration` class to nominate the default
once for the whole application. The failure mode when you skip it is worth
anticipating: either the context fails to start because the required bean is
ambiguous, or, if one manager is marked `@Primary`, everything quietly commits against
that one — including the methods that were meant to write to the other database. The
second is far worse, because it works.

---

Index: [04 · Spring @Transactional](README.md) · Next → [2 · The proxy](02-the-proxy.md)
