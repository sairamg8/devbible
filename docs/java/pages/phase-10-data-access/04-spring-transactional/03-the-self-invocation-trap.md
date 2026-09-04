---
title: "A method calling another method of its own class never goes through the proxy, so the annotation on the inner method does nothing at all"
sidebar_label: "3 · The self-invocation trap"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> *Core → AOP → Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html))
> and the `@EnableTransactionManagement` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**This is the code. Read it before the explanation.**

```java
@Service
public class OrderService {

    private final JdbcClient db;

    OrderService(JdbcClient db) { this.db = db; }

    /** Called by the controller. NOT annotated. */
    public long placeOrder(NewOrder order) {
        validate(order);
        return saveOrderAndLines(order);      // ← a plain call on `this`
    }

    /** Annotated. Intended to be all-or-nothing. */
    @Transactional
    public long saveOrderAndLines(NewOrder order) {
        long id = db.sql("INSERT INTO orders (customer_id, total) VALUES (?, ?) RETURNING id")
                    .params(order.customerId(), order.total())
                    .query(Long.class).single();

        for (Line line : order.lines()) {
            db.sql("INSERT INTO order_lines (order_id, sku, qty) VALUES (?, ?, ?)")
              .params(id, line.sku(), line.qty())
              .update();                       // if line 3 of 5 violates a constraint…
        }
        return id;
    }
}
```

**There is no transaction anywhere in that code.** The order row and the first
two lines are committed. The third throws. Rows one and two stay in the database,
the order row stays in the database, and the customer has an order with two of
its five lines. `@Transactional` is on the method that does the work, the bean is
proxied correctly, the transaction manager exists, and none of it matters.

## Why

The controller holds the **proxy**. It calls `placeOrder` on the proxy. The proxy
looks up a transaction attribute for `placeOrder`, finds none — it is not
annotated — and passes the call straight to your real object. From that moment on
`this` is the **target**, not the proxy. The call `saveOrderAndLines(order)` is
compiled as `this.saveOrderAndLines(order)` and dispatched directly on the target
instance. The proxy is not in the call path, so nothing reads the annotation.

```
controller ──▶ PROXY.placeOrder ──▶ target.placeOrder
                  (no attribute,             │
                   straight through)         │  this.saveOrderAndLines(…)
                                             ▼
                                     target.saveOrderAndLines
                                     (annotation never read)
```

The reference states it in one sentence, and it is worth memorising verbatim:

> *"In proxy mode (which is the default), only external method calls coming in
> through the proxy are intercepted. This means that self-invocation (in effect, a
> method within the target object calling another method of the target object)
> does not lead to an actual transaction at runtime even if the invoked method is
> marked with `@Transactional`."*

The `@EnableTransactionManagement` javadoc says the same thing from the other
side: *"Local calls within the same class cannot get intercepted that way; an
`Transactional` annotation on such a method within a local call will be ignored
since Spring's interceptor does not even kick in for such a runtime scenario."*

**"Does not even kick in"** is the precise part. This is not Spring deciding not
to start a transaction. This is Spring never being asked.

## The reference's own minimal example

The AOP chapter demonstrates it without any transaction machinery at all:

```java
public class SimplePojo implements Pojo {

    public void foo() {
        // this next method invocation is a direct call on the 'this' reference
        this.bar();
    }

    public void bar() {
        // some logic...
    }
}
```

Any advice on `bar()` is skipped when `foo()` calls it. **The mechanism has
nothing to do with transactions** — it is how proxies work, and every
proxy-based Spring feature inherits it: `@Cacheable`, `@Async`, `@Retryable`,
`@PreAuthorize`, custom aspects. The transaction case is simply the one that
loses data.

## Why it fails silently

Three things conspire, and each of them individually would be survivable.

1. **The code compiles and starts.** There is nothing to warn about — a method
   calling another method is the most ordinary thing in Java.
2. **The happy path works.** With no transaction, JDBC is in autocommit mode, so
   every statement commits by itself. All five lines insert. All five rows are
   there. The test passes.
3. **The failure only appears when something throws mid-method** — a constraint
   violation, a timeout, a null. That is the path nobody writes a test for.

The reference names this failure mode explicitly, in the context of interface
annotations, and the sentence applies just as well here: *"your transaction
annotations may be silently ignored: Your code might appear to 'work' until you
test a rollback scenario."*

⚠️ **This is why "it works in production" is not evidence.** A missing
transaction is invisible until the first partial failure, and a partial failure
under load is exactly when you least want to be discovering it.

## What it is not

Two things this trap is often confused with, both worth ruling out before you go
looking:

- **It is not about `public` vs `private`.** Making `saveOrderAndLines` public,
  protected or package-private changes nothing; the call still goes to `this`.
  Visibility is [chunk 2c](02c-visibility-and-the-interface-question.md).
- **It is not about the *outer* method being annotated.** If `placeOrder` had
  carried `@Transactional`, everything would have worked — but not because the
  inner annotation started being read. It would have worked because the *outer*
  call went through the proxy and opened a transaction that the inner method
  simply ran inside. The inner annotation would still be ignored, which matters
  the moment somebody sets `propagation = REQUIRES_NEW` on it and expects a
  separate transaction. See [chunk 10](10-requires-new.md).

## The trade-off

Proxy-based AOP is the reason `@Transactional` costs nothing to adopt: no build
step, no agent, no bytecode manipulation, works in any JVM and any IDE. The price
is exactly this — **the boundary is a call through a reference, so it can be
bypassed by writing a call that does not use that reference.** AspectJ weaving
does not have the limitation, and it costs a build-time or load-time weaving
setup; that trade is [chunk 4](04-fixing-self-invocation.md).

The version above is the obvious shape — one method of a class calling another.
Two more chunks cover the shapes that do not look like self-invocation at all:
[chunk 3b](03b-the-initialization-variant.md) is initialization code, which fails
for a second independent reason on top, and
[chunk 3c](03c-bound-receivers.md) is default methods, lambdas and method
references.

## Gotchas

**⚠️ Extracting a method "to make it transactional" and leaving it in the class**
**Symptom:** the refactor that was supposed to add a transaction adds nothing.
**Cause:** the extracted method is called on `this`.
**Fix:** extract it into a *different bean*. Extraction within a class is not a
transaction boundary — [chunk 4](04-fixing-self-invocation.md).

**⚠️ A `@Transactional` helper called from a loop in the same class**
**Symptom:** intended per-item transactions; you get none, and one partial
failure leaves the batch half-applied.
**Cause:** self-invocation on every iteration.
**Fix:** move the per-item method to a collaborator bean and call it through the
injected reference.

**⚠️ A public entry point delegating to an annotated private helper**
**Symptom:** developers "know" private methods cannot be transactional, so they
make the helper public — and it still does not work.
**Cause:** two independent reasons for the same failure. Making it public removes
one and leaves self-invocation untouched.
**Fix:** both must be fixed, and the second one requires a different object.

**⚠️ Believing self-invocation is a transaction-specific problem**
**Symptom:** somebody fixes the transaction case and leaves an `@Async` or
`@Cacheable` self-call two lines away.
**Cause:** the limitation belongs to proxy-based AOP, not to transactions.
**Fix:** audit every proxy-backed annotation in the class at the same time.

**⚠️ A test that constructs the service directly and "proves" the fix**
**Symptom:** a green test for behaviour that is broken in the application.
**Cause:** `new OrderService(db)` has no proxy either way, so the test cannot
distinguish a working boundary from a missing one.
**Fix:** any test about a transaction boundary must obtain the bean from the
application context.

## Interview questions

**★ Why does an internal call bypass `@Transactional`?**
Because the annotation is honoured by a proxy that sits *in front of* the bean,
not by the bean itself. An external caller holds the proxy, so the call passes
through the transaction interceptor. Once the call has been forwarded to your
real object, `this` refers to that object — the target — and any further call on
`this` is an ordinary virtual dispatch on the target instance. There is no
reference to the proxy anywhere in that call, so nothing looks up the
annotation. The reference puts it as "only external method calls coming in
through the proxy are intercepted", and the `@EnableTransactionManagement`
javadoc adds that Spring's interceptor "does not even kick in for such a runtime
scenario" — the interceptor is not making a decision, it is absent.

**★ The inner method is annotated and the outer one is not, and the code seems to
work. Is it fine?**
No, and the reason it seems to work is the dangerous part. Without a transaction
the JDBC connection is in autocommit mode, so each statement commits
individually. Every insert succeeds, every row is present, and any test that only
checks the happy path passes. What has been lost is atomicity: the moment a
statement fails partway through, everything before it is already permanently
committed and there is nothing to roll back. The bug is invisible until the first
partial failure in production, which is why the reference warns that such code
"might appear to 'work' until you test a rollback scenario".

**★ Would making the inner method `public` fix it?**
No. Visibility and reachability are two independent conditions, and
self-invocation fails the second one. A `public` method can be advised — it is
overridable, it appears on the proxy — but a call written as
`this.method()` never reaches the proxy regardless of what modifier the method
carries. Since Spring Framework 6.0 even `protected` and package-private methods
can be advised under class-based proxies, which makes the point sharper: widening
visibility changes what the proxy *could* intercept, not what the proxy is *given
the chance* to intercept.

**★ Is this a design flaw in Spring?**
It is the visible cost of a deliberate design choice. Spring's declarative
transactions are implemented with proxy-based AOP, which requires no build step,
no java agent, no bytecode weaving and no special IDE support — you add a
dependency and an annotation, and it works on any JVM. The whole limitation
follows from the fact that interception happens at a *reference*, and a `this`
call does not go through that reference. Spring documents the alternative that
does not have the problem: AspectJ compile-time or load-time weaving, where the
advice is woven into the method body itself. The reference says plainly that
those modes "do not have this self-invocation issue" — and they cost a weaving
setup, which is why proxy mode is the default.

**★ Suppose the outer method *is* annotated and the inner one asks for
`REQUIRES_NEW`. What actually happens?**
One transaction, and the inner annotation is ignored completely — which is the case
where self-invocation stops being harmless and starts silently changing behaviour. The
outer call went through the proxy, so a transaction was opened and everything the
method does runs inside it, including the inner method's work. But the inner call is
still `this.method()`, so the interceptor never runs for it, `REQUIRES_NEW` is never
read, and no second physical transaction is started and no suspension happens. The
whole point of `REQUIRES_NEW` — that this work commits or fails independently of the
caller — is gone, and the symptom is the opposite of the one in the main example: here
everything is atomic when it was meant not to be, so an audit row or a failure record
that was supposed to survive the outer rollback disappears with it.

**★ Which other Spring features have this same trap, and is the failure equally
severe?**
Every proxy-backed annotation: `@Async`, `@Cacheable` and the rest of the caching
family, `@Retryable`, `@PreAuthorize` and the method-security annotations, `@Validated`,
and any custom aspect you write. The mechanism is identical because the limitation
belongs to proxy-based AOP rather than to transactions, and the reference demonstrates
it with a `SimplePojo` calling `this.bar()` that has nothing to do with either. The
severity differs a lot, though, and it is worth ranking: `@Cacheable` self-invocation
costs you performance and nothing else; `@Async` silently makes the work synchronous,
which usually shows up as a slow request; `@Transactional` loses atomicity, which is
data loss; and `@PreAuthorize` skips an authorization check, which is a security bug.
The last one is the reason to audit the whole class rather than fix the transaction and
move on.

**★ How would you write a test that actually fails on this?**
Not by counting rows on the happy path — that passes either way. Two shapes work. The
direct one is a boundary probe: drive the service from a test that is **not**
`@Transactional`, and from inside the inner method's call stack assert on
`TransactionSynchronizationManager.getCurrentTransactionName()`, which by default is
the fully-qualified class and method name of the boundary that is actually open. Under
a self-invocation it reports the *outer* method, so the assertion fails and names the
bug — see [20f · Asserting the boundary exists](20f-asserting-the-boundary-exists.md).
The indirect one is a rollback test: make the operation fail partway through against a
real database and assert every table it touches is empty afterwards, from outside the
transaction. Both require the bean to come from the application context; a service
built with `new` has no proxy either way and cannot tell the two cases apart.

---

← Prev: [2d · The inheritance rule](02d-the-inheritance-rule.md) · Index: [04 · Spring @Transactional](README.md) · Next → [3b · The initialization variant](03b-the-initialization-variant.md)
