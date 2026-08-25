---
title: "Two runtime escape hatches: recovering the proxy from a ThreadLocal, which Spring calls highly discouraged, and abandoning the proxy model with TransactionTemplate"
sidebar_label: "4b · The escape hatches"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Core → AOP →
> Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)),
> *Programmatic transaction management*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html))
> and *Declarative transaction management*
> ([.../transaction/declarative.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 4](04-fixing-self-invocation.md) covered the two fixes that restructure
the call. These two do something else: the first reaches into Spring's AOP
internals to recover the proxy from a `ThreadLocal`, and the second abandons the
proxy model entirely and talks to the transaction manager directly. Their
verdicts are: never, and sometimes.
[Chunk 4c](04c-aspectj-weaving.md) covers the fifth option, which abandons
proxies as an implementation altogether.**

## 3 · `AopContext.currentProxy()` — Spring says do not

```java
@EnableTransactionManagement(exposeProxy = true)      // required, and global
class TxConfig { }

public long placeOrder(NewOrder order) {
    validate(order);
    return ((OrderService) AopContext.currentProxy()).saveOrderAndLines(order);
}
```

The reference shows this and then says, in its own words:

> *"The `AopContext` class … is highly discouraged as it tightly couples your
> code to Spring AOP and it makes the class itself aware of the fact that it is
> being used in an AOP context."*

**Verdict: do not. This is the option you should be able to name in an interview
and never write.**

Three concrete costs beyond the coupling. It requires `exposeProxy = true`, which
is an application-wide setting that makes Spring push every proxy into a
`ThreadLocal` on every advised call — a cost paid by every bean to fix one call
site. The cast is unchecked and will fail at runtime if the proxy is a JDK proxy
and you cast to the class. And `currentProxy()` throws `IllegalStateException`
when there is no currently-executing proxied invocation, so a method that is
sometimes called externally and sometimes not becomes conditionally broken.

## 4 · `TransactionTemplate` — programmatic, and honest about it

```java
@Service
public class OrderService {

    private final JdbcClient db;
    private final TransactionTemplate tx;

    OrderService(JdbcClient db, PlatformTransactionManager txManager) {
        this.db = db;
        this.tx = new TransactionTemplate(txManager);
    }

    public long placeOrder(NewOrder order) {
        validate(order);
        return tx.execute(status -> saveOrderAndLines(order));   // real boundary
    }
}
```

**Verdict: the right answer in three specific situations, and the wrong default.**

There is no proxy involved at all — the template asks the transaction manager
directly — so self-invocation is simply not a concept here. The reference notes
that `TransactionTemplate` instances are **thread-safe**: they maintain no
conversational state, only configuration state, so one instance can be shared, and
`status.setRollbackOnly()` is how you trigger a rollback without throwing.

The three situations where it is genuinely better:

- **The boundary is not a method boundary.** You want a transaction around part of
  a method — the reference is explicit that declarative management "cannot be used
  on arbitrary code blocks", and this is the escape hatch.
- **Initialization code**, where no proxy exists yet.
- **A boundary that varies at runtime** — different propagation or timeout
  depending on the input, which an annotation cannot express.

The cost is the one [chunk 1](01-not-a-language-feature.md) named: the business
class now imports `org.springframework.transaction` and cannot be exercised
without a transaction manager. Use it where it earns that; do not make it the
house style.

⚠️ **Note what the example above does *not* fix.** `saveOrderAndLines` is still
called on `this`, and its `@Transactional` is still ignored. The transaction comes
entirely from the template. Leaving a now-meaningless annotation on the inner
method is worse than removing it, because the next reader will believe it.

## The trade-off

Fix 3 trades a permanent coupling to Spring AOP for keeping one line of code as
it was. Fix 4 trades framework independence for control over the boundary.
Neither makes the ignored annotation start working — like the two fixes in
[chunk 4](04-fixing-self-invocation.md), they move where the transaction is
declared. Only [AspectJ weaving](04c-aspectj-weaving.md) is a genuine repair, and
it is the most expensive option on the list.

## Gotchas

**⚠️ `AopContext.currentProxy()` without `exposeProxy = true`**
**Symptom:** `IllegalStateException: Cannot find current proxy: Set 'exposeProxy'
property on Advised to 'true' to make it available.`
**Cause:** the proxy is only pushed into the `ThreadLocal` when that flag is set.
**Fix:** set the flag — or, better, use a different option entirely.

**⚠️ `AopContext.currentProxy()` cast to the concrete class under a JDK proxy**
**Symptom:** `ClassCastException` at runtime.
**Cause:** a JDK proxy implements the interfaces and is not an instance of your
class.
**Fix:** cast to the interface. And reconsider — this is the third distinct way
this option fails.

**⚠️ `AopContext.currentProxy()` in a method that is sometimes called externally
and sometimes not**
**Symptom:** the method works from the controller and throws from a scheduled
job.
**Cause:** there is only a current proxy when the thread is inside a proxied
invocation.
**Fix:** none that is good. This is the failure mode that makes the option unsafe
rather than merely ugly.

**⚠️ `exposeProxy = true` set to fix one call site**
**Symptom:** a small, permanent, application-wide overhead and a global behaviour
change nobody remembers making.
**Cause:** the flag makes *every* advised invocation push its proxy into a
`ThreadLocal` and pop it afterwards.
**Fix:** treat it as an application-wide decision, exactly like
`proxyTargetClass`.

**⚠️ Wrapping a `TransactionTemplate` around a call and leaving the inner
`@Transactional` in place**
**Symptom:** two developers disagree about where the boundary is, and one of them
adds `REQUIRES_NEW` to the inner annotation expecting a nested transaction.
**Cause:** the inner annotation is dead code; the template supplies the boundary.
**Fix:** delete the annotation when the template takes over.

**⚠️ Creating a new `TransactionTemplate` per call**
**Symptom:** avoidable allocation and, worse, per-call configuration drift.
**Cause:** believing it is stateful.
**Fix:** the reference says instances are thread-safe and hold only configuration
state — build one per configuration and reuse it.

**⚠️ Mutating a shared `TransactionTemplate`'s settings at runtime**
**Symptom:** a timeout or propagation set for one call leaking into concurrent
calls on other threads.
**Cause:** thread-safe means safe to *use* concurrently, not safe to reconfigure
concurrently. The configuration state is shared.
**Fix:** one template per configuration, built once, never mutated after
publication.

**⚠️ Throwing a checked exception from inside `tx.execute(...)`**
**Symptom:** it will not compile inside the lambda.
**Cause:** `TransactionCallback.doInTransaction` does not declare checked
exceptions.
**Fix:** wrap it in an unchecked exception, or use `status.setRollbackOnly()` and
return a result that says what happened — the reference shows both.

**⚠️ Using `TransactionTemplate` and forgetting `TransactionCallbackWithoutResult`
exists**
**Symptom:** `return null;` at the end of every callback.
**Cause:** `execute` is defined to return a value.
**Fix:** `tx.executeWithoutResult(status -> { ... })`, or the
`TransactionCallbackWithoutResult` class the reference documents for the same
purpose.

## Interview questions

**★ Why does Spring document `AopContext.currentProxy()` and then tell you not to
use it?**
Because it exists for cases where nothing else is available — legacy code that
cannot be restructured — and the framework would rather give you a supported
escape hatch than have you invent an unsupported one. The reason it is "highly
discouraged" is stated in the reference itself: it "tightly couples your code to
Spring AOP and it makes the class itself aware of the fact that it is being used
in an AOP context". Beyond the coupling there are three practical failures: it
needs `exposeProxy = true`, which makes every advised call in the application push
its proxy into a `ThreadLocal`; the cast is unchecked and breaks under JDK
proxies; and it throws `IllegalStateException` when the method is called outside
any proxied invocation, so a method with two callers can work for one and fail for
the other.

**★ What does `exposeProxy = true` actually do, and what does it cost?**
It makes Spring's AOP infrastructure push the current proxy onto a `ThreadLocal`
before invoking the target and pop it afterwards, so that code running inside the
target can retrieve it with `AopContext.currentProxy()`. The cost is that this
happens for *every* advised invocation in the application, not just the ones that
read it — a `ThreadLocal` set and unset on every proxied call, plus the ordinary
hazards of thread-local state in an application that hands work to other threads.
It is a global switch, in the same family as `proxyTargetClass`, and enabling it
to fix one call site is the same category of mistake as flipping the proxy
strategy for one bean.

**★ When is `TransactionTemplate` the right answer rather than a workaround?**
When the boundary you need is not a method boundary. The reference is explicit
that declarative transaction management "works at method granularity around a
thread of execution" and "cannot be used on arbitrary code blocks", so if you want
a transaction around the middle third of a method — with an HTTP call before it
and a file write after it deliberately outside — an annotation cannot express that
and the template can. The other two genuine cases are initialization code, where
no proxy exists yet, and a boundary whose propagation or timeout depends on
runtime input, which an annotation's compile-time constants cannot supply. Outside
those, the template is a workaround: it buys you a transaction at the cost of
importing Spring's transaction API into business code, which is exactly the
coupling declarative management exists to avoid.

**★ The reference says `TransactionTemplate` is thread-safe. What does that
actually permit and forbid?**
It permits sharing one instance across threads and calling `execute` on it
concurrently, which is why a template is normally created once in a constructor
or a `@Bean` method and reused. The reference is precise about why: instances
"do not maintain any conversational state" — nothing about a particular
transaction is stored on the template — but they "do maintain configuration
state", meaning the propagation, isolation, timeout and read-only settings live
on the object. So what it forbids is *reconfiguring* a shared instance at
runtime: calling `setTimeout` on a template another thread is currently using
changes that thread's transaction. The rule is one template per configuration,
built once, never mutated after publication.

**★ How do you roll back from inside a `TransactionTemplate` callback without
throwing?**
Call `status.setRollbackOnly()` on the `TransactionStatus` the callback is
handed. The template will still run to completion and `execute` will still
return, but the transaction is marked and will be rolled back rather than
committed at the boundary. This is the programmatic equivalent of the declarative
rollback rules, and it is useful when "this did not work" is a normal outcome you
want to return a value about rather than an exceptional one. The thing to be
aware of is what happens when a *nested* logical scope does the same and the
outer scope does not expect it — that is where `UnexpectedRollbackException`
comes from, and it is [chunk 9](09-marked-rollback-only.md).

**★ Someone uses `TransactionTemplate` throughout a codebase to avoid proxy
surprises. Is that defensible?**
It is defensible as a decision but usually a bad trade. What they are buying is
predictability: no proxies, no self-invocation, no visibility rules, and a
boundary that is exactly the block of code inside the lambda. What they are
paying is that every business class now imports `org.springframework.transaction`
and cannot be constructed or unit-tested without a transaction manager, every
transactional block is one lambda deeper, and the boundary moves from something a
reviewer sees in a signature to something they have to read a method body to
find. The reference's own comparison lists "business objects do not depend on the
transaction infrastructure" as the decisive advantage of declarative management,
and that is precisely what a template-everywhere policy gives up. The better
answer to proxy surprises is to learn the four rules that produce them.

**★ Why can a `TransactionTemplate` callback not throw a checked exception, and what
do you do about it?**
Because `TransactionCallback.doInTransaction` does not declare any checked exception in
its signature, so a lambda implementing it cannot throw one — this is a compile-time
constraint, not a runtime rule, and it catches people migrating a method body into a
template. Three honest responses. Wrap the checked exception in an unchecked one and
let it propagate, which rolls back by default because runtime exceptions are on the
default rollback list. Or catch it inside the callback, call
`status.setRollbackOnly()`, and return a value that expresses the failure — which is
the right shape when "this did not work" is an ordinary outcome rather than an
exceptional one. Or, if the checked exception genuinely has to escape the boundary,
keep the declarative form and use `@Transactional(rollbackFor = ...)`, because the
annotation can name exception types the template's signature cannot. The one thing not
to do is swallow it, which produces a committed transaction over failed work — the
subject of [chunk 14](14-the-caught-exception.md).

---

← Prev: [4 · Fixing self-invocation](04-fixing-self-invocation.md) · Index: [Spring @Transactional](README.md) · Next → [4c · AspectJ weaving](04c-aspectj-weaving.md)
