---
title: "Three ways to ask the running application whether a transaction is actually there, because reading the code only tells you what somebody intended"
sidebar_label: "5b · Detecting a dead annotation"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `TransactionSynchronizationManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html)),
> the `TransactionDefinition` javadoc
> ([.../org/springframework/transaction/TransactionDefinition.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionDefinition.html)),
> the Spring Framework 7.0 reference *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Transaction management in the TestContext framework*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 5](05-annotations-that-do-nothing.md) listed the nine placements. This
one answers the question that actually comes up: you are looking at a method with
`@Transactional` on it and you do not know whether it works. Reading the code
tells you what somebody meant; these three techniques tell you what is happening
in the running application. They diagnose. They do not prevent —
[chunk 5c](05c-proving-it-and-preventing-it.md) is the half that does.**

## Detection 1 · ask the runtime, not the code

The reliable check is to ask Spring whether a transaction is actually active at
the point you care about. `TransactionSynchronizationManager` is described in its
javadoc as a *"Central delegate that manages resources and transaction
synchronizations per thread"*, and it answers exactly this question:

```java
@Transactional
public long saveOrderAndLines(NewOrder order) {
    assert TransactionSynchronizationManager.isActualTransactionActive()
            : "no transaction — the annotation is not being honoured";
    ...
}
```

`isActualTransactionActive()` returns true only when a real physical transaction
is in progress, which is precisely the fact every entry on the list turns off.
Two companions are worth knowing:

- `getCurrentTransactionName()` — the boundary's name, which by default is the
  fully qualified class name plus `.` plus the method name. **This tells you
  *which* method opened the transaction**, which distinguishes "no transaction"
  from "a transaction, but the outer one, so my settings were ignored".
- `isCurrentTransactionReadOnly()` — whether the read-only hint is in force.

⚠️ **The javadoc says this class is "to be used by resource management code but
not by typical application code".** That is a design instruction, and it is
right: do not build behaviour on these calls. As a temporary assertion or a
diagnostic log line while you are finding a dead annotation, it is the fastest
tool available.

## Detection 2 · ask whether the bean is proxied at all

```java
@Autowired ApplicationContext ctx;

// in a test or a diagnostic endpoint
Object bean = ctx.getBean(OrderService.class);
boolean proxied = AopUtils.isAopProxy(bean);          // false → nothing is advised
boolean cglib   = AopUtils.isCglibProxy(bean);        // which kind
Class<?> target = AopUtils.getTargetClass(bean);      // the real class behind it
```

This separates two very different situations that look identical from the
outside: *the bean is not proxied at all* — infrastructure missing, or a `final`
class — versus *the bean is proxied and this one method is not advised*. The
first has one cause; the second sends you to the visibility and reachability
rules.

## Detection 3 · enable the interceptor's own logging

Spring's transaction interceptor logs at `TRACE` when it enters and exits a
transactional method:

```properties
logging.level.org.springframework.transaction.interceptor=TRACE
```

Absence of a line for your method is the signal. This is the least precise of the
four — a missing log line has many explanations, including a logging
misconfiguration — but it is the only one that requires no code change, which
makes it the right first move on a running system.

⚠️ **Do not reason from the presence of a `DataSourceTransactionManager` bean.**
Its existence proves the infrastructure was configured, not that any particular
method reaches it.

## Which one to reach for

| Situation | Technique |
|---|---|
| a running system, no deploy available | 3 · `TRACE` logging |
| a debugger and one suspect method | 1 · `isActualTransactionActive()` |
| "is this bean advised at all?" | 2 · `AopUtils` |
| proving the boundary works, permanently | [chunk 5c](05c-proving-it-and-preventing-it.md) |
| stopping it happening again | [chunk 5c](05c-proving-it-and-preventing-it.md) |

All three techniques here answer "is it broken now". None of them stops it
recurring.

## The trade-off

Every technique on this page reads Spring internals, and the javadoc for the
central one says plainly that it is "to be used by resource management code but
not by typical application code". That instruction is right, and the trade is
worth stating: these are **diagnostics you add, use and remove**, not APIs to
build behaviour on. A codebase where business logic branches on
`isActualTransactionActive()` has turned a debugging tool into a dependency on
framework internals, and the next framework upgrade owns you. The two techniques
that belong permanently in a project are the ones that read no internals at all,
and they are in [chunk 5c](05c-proving-it-and-preventing-it.md).

## Gotchas

**⚠️ Asserting on `isActualTransactionActive()` and leaving it in production
code**
**Symptom:** business logic branching on whether a transaction exists.
**Cause:** a diagnostic became a feature.
**Fix:** the javadoc is explicit that the class is "not [for] typical application
code". Use it to find the bug and delete it.

**⚠️ Confusing `isSynchronizationActive()` with `isActualTransactionActive()`**
**Symptom:** a check that reports a transaction where there is none.
**Cause:** synchronization can be active without a real transaction — notably
under `PROPAGATION_SUPPORTS`, which defines a synchronization scope with no
physical transaction.
**Fix:** `isActualTransactionActive()` is the one that answers "is there a real
transaction". See [chunk 12](12-the-other-propagations.md).

**⚠️ Reading `AopUtils.isAopProxy` as "this method is advised"**
**Symptom:** confidence that the boundary works because the bean is proxied.
**Cause:** the bean being a proxy says nothing about whether *this* method has a
transaction attribute or is reachable through the proxy.
**Fix:** it is a first cut, not an answer. Follow it with technique 1.

**⚠️ Believing a `TRACE` log line means your settings applied**
**Symptom:** the interceptor logs an entry, and the isolation level you set is
still not in effect.
**Cause:** the method was intercepted and *joined* an outer transaction, whose
settings win.
**Fix:** `getCurrentTransactionName()` tells you which method actually opened the
boundary — [chunk 8](08-propagation-required.md).

**⚠️ Leaving `TRACE` on**
**Symptom:** log volume that dwarfs everything else, and a measurable slowdown on
a busy service.
**Cause:** the interceptor logs on entry and exit of *every* transactional method
in the application.
**Fix:** scope the level to the one package you are investigating and turn it off
afterwards.

**⚠️ Calling `getCurrentTransactionName()` outside a transaction**
**Symptom:** `null`, read as "something went wrong with the diagnostic".
**Cause:** there is no current transaction name when there is no transaction.
**Fix:** `null` *is* the answer — it means no boundary is open on this thread.

**⚠️ Reasoning from the presence of a transaction manager bean**
**Symptom:** "the infrastructure is configured, so the annotation must work."
**Cause:** the manager's existence proves configuration, not that any particular
method reaches it.
**Fix:** none of the nine placements in
[chunk 5](05-annotations-that-do-nothing.md) is affected by whether a manager
exists.

## Interview questions

**★ How do you actually prove, at runtime, that a method is transactional?**
Ask `TransactionSynchronizationManager.isActualTransactionActive()` inside the
method. It returns true only when a real physical transaction is in progress,
which is exactly the fact every failure mode removes.
`getCurrentTransactionName()` is the useful companion, because it names the class
and method that opened the boundary — so it distinguishes "there is no
transaction" from "there is one, but it belongs to an outer method and my
settings were silently ignored". Both are diagnostics, not API: the javadoc says
the class is "to be used by resource management code but not by typical
application code", so they go in an assertion or a temporary log line and come
back out. The complementary check is `AopUtils.isAopProxy(bean)`, which separates
"this bean is not proxied at all" from "this bean is proxied and this method is
not advised".

**★ What is the difference between `isSynchronizationActive()` and
`isActualTransactionActive()`, and why does it matter?**
`isActualTransactionActive()` is true only when a real physical transaction has
been started — the thing that will be committed or rolled back.
`isSynchronizationActive()` is true whenever a transaction *synchronization
scope* has been opened, which can happen without any physical transaction at all.
The clearest case is `PROPAGATION_SUPPORTS`, which the `Propagation` javadoc
describes as "slightly different from no transaction at all, as it defines a
transaction scope that synchronization will apply for" — resources are shared
across the scope, but nothing is committed. So using the synchronization check to
answer "am I in a transaction?" gives a false positive in exactly the situation
where the distinction is doing real work.

**★ Why is `getCurrentTransactionName()` more useful than a boolean?**
Because the interesting failures are not "no transaction" but "the wrong
transaction". `getCurrentTransactionName()` returns the fully qualified class
name plus a dot plus the method name of whichever method opened the boundary, per
the `TransactionDefinition` javadoc. If you call it inside a method you believe
starts its own transaction and it names some outer service method, you have
learned in one step that your propagation joined an existing scope and that your
isolation, timeout and read-only settings were silently ignored — which is a
completely different bug from the annotation not being read at all, and one a
boolean cannot distinguish.

**★ You can only change configuration, not code, on a running system. How do you
find out whether the boundary is there?**
Turn on `TRACE` for `org.springframework.transaction.interceptor` and look for
entry and exit lines around the method. It requires no deploy, which is its
entire advantage, and it is the least precise of the techniques: a missing line
has several explanations including a logging misconfiguration, and a present line
proves only that the interceptor ran, not that it started a new transaction
rather than joining one. If the platform also exposes a way to run arbitrary code
— a scripting endpoint, a debugger, an attached JMX operation — reading
`getCurrentTransactionName()` from inside the method is strictly better, because
it names the boundary rather than merely evidencing one.

**★ What does `AopUtils.isAopProxy` tell you that the other checks do not?**
It separates two failures that are indistinguishable from inside a method: the
bean is not proxied at all, versus the bean is proxied and this particular method
is not advised. The first has a small set of causes — no transaction
infrastructure in this context, or a `final` class that CGLIB could not subclass
— and they are all about configuration or the class as a whole. The second sends
you to the per-method rules: visibility, `final`, `static`, whether the method is
on the proxied interface, and whether the call reached the proxy at all.
`isCglibProxy` and `getTargetClass` from the same utility class complete the
picture by telling you which proxy strategy is actually in use, which you need
before you can apply the JDK-versus-CGLIB rows of the checklist rather than
guessing from documentation defaults that differ between Framework and Boot.

**★ These are all read-only checks. When would you reach for a debugger instead?**
When you need to know not whether a transaction exists but *where it began* and
*what it decided*. A breakpoint in `TransactionInterceptor` — or in the
transaction manager's `getTransaction` — shows you the resolved
`TransactionAttribute` for the call, which answers questions the runtime helpers
cannot: which annotation won the precedence contest, what propagation and
isolation were actually resolved, and whether `getTransaction` started a new
physical transaction or returned a participating one. It is more work than a log
line, and it is the right tool once the cheap checks have told you *that*
something is wrong and you need to know *what*.

**★ What exactly does the `TRACE` line say, and how much can you read off it?**
More than people expect, which is what makes technique 3 worth more than its
reputation. `TransactionAspectSupport` logs `Getting transaction for [<joinpoint>]` on
entry and `Completing transaction for [<joinpoint>]` on exit, where the joinpoint
identification is the same fully-qualified `Class.method` string that
`getCurrentTransactionName()` would return. So the log gives you the boundary's
identity for free, with no code change — which means it answers the "wrong
transaction" question and not merely the "no transaction" one. It also emits
`No need to create transaction for [<joinpoint>]` when the attribute lookup found
nothing, which is the single most useful line on this page: it is Spring telling you
in plain words that the method was reached and had no transaction attribute. Seeing
that line narrows the diagnosis from nine possibilities to the advisability family in
one step.

**★ You add the assertion, it passes, and the bug is still there. What did the
assertion not cover?**
That a transaction exists is a weaker claim than that *your* transaction exists with
*your* settings. `isActualTransactionActive()` returns true when the method has joined
an outer boundary under the default `REQUIRED` propagation, so a method whose
`REQUIRES_NEW`, `isolation` or `timeout` was silently ignored passes the assertion
happily — the outer transaction is real and active. It is also true throughout a
`@Transactional` test, which is why an assertion of this shape inside a test-managed
transaction proves nothing at all. Both cases need the name rather than the boolean:
compare `getCurrentTransactionName()` against the method you expected to open the
boundary. And if the suspicion is about settings rather than existence,
`isCurrentTransactionReadOnly()` and `getCurrentTransactionIsolationLevel()` report the
*actual* transaction's values, which is what makes them able to catch an inner
declaration that lost to an outer one.

---

← Prev: [5 · Annotations that do nothing](05-annotations-that-do-nothing.md) · Index: [04 · Spring @Transactional](README.md) · Next → [5c · Proving it and preventing it](05c-proving-it-and-preventing-it.md)
