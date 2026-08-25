---
title: "\"My @Transactional did nothing\" — the eight checks, in the order that finds it fastest"
sidebar_label: "22 · The debugging order"
sidebar_position: 64
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> *Rolling back a declarative transaction*
> ([.../declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)),
> *Proxying mechanisms*
> ([.../core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)),
> the `TransactionAspectSupport` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/TransactionAspectSupport.html))
> and the `TransactionSynchronizationManager` javadoc
> ([.../transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, PostgreSQL 18.

**Almost every failure in this topic is silent. There is no exception, no warning
and no log line — only data that should not exist. So the diagnosis has to be a
checklist rather than a search, and the order matters: the checks are arranged so
that the cheapest and most common causes come first.**

## The two questions underneath everything

Every report of "the transaction did not work" resolves into exactly one of two
findings:

1. **There was no transaction.** The annotation was never in effect.
2. **There was a transaction and it decided to commit.** The annotation was in
   effect and the rules said commit.

They are indistinguishable from the database's side — the row is there either way —
and they have completely different fixes. Checks 1 to 5 below settle the first;
checks 6 to 8 settle the second.

## The eight checks

### 1 · Was the call external?

The most common cause by a wide margin. The reference:

> In proxy mode (which is the default), only external method calls coming in
> through the proxy are intercepted. This means that self-invocation (in effect, a
> method within the target object calling another method of the target object) does
> not lead to an actual transaction at runtime even if the invoked method is marked
> with `@Transactional`.

So `this.doWork()` — including an unqualified `doWork()` — starts nothing. Look at
who calls the annotated method. Detail: **03 · The self-invocation trap** *(not
written yet)*.

### 2 · Is the method visible and overridable?

A proxy intercepts by overriding, so the method must be overridable.
`private`, `final` and `static` methods cannot be advised, and under an
interface-based proxy the method must be `public` and declared on the proxied
interface. Since 6.0, `protected` and package-visible methods can be advised for
class-based proxies. Detail: **05 · Annotations that do nothing** *(not written
yet)*.

### 3 · Is the object in hand actually the proxy?

`new MyService()` in a test or a helper gives you the target, not the proxy.
Likewise a bean unwrapped from its proxy, or an object created by a factory that
bypassed the container. If it did not come out of the `ApplicationContext`, it is
not advised. Detail: **[02 · The proxy](02-the-proxy.md)**.

### 4 · Is transaction management switched on, with a manager?

> the mere presence of the `@Transactional` annotation is not enough to activate
> the transactional behavior … merely metadata

In Spring Boot this is auto-configured and almost never the problem; in a plain
Framework application, a missing `@EnableTransactionManagement` or a missing
`PlatformTransactionManager` bean makes every annotation inert. Detail:
**[01 · Not a language feature](01-not-a-language-feature.md)**.

### 5 · Is another thread involved?

The transaction is bound to a `ThreadLocal`. `new Thread`, an executor, a parallel
stream, a `CompletableFuture` continuation and `@Async` all leave it behind, and
work on the other thread runs on its own autocommit connection. This one is easy
to miss because the annotated method *does* have a transaction — just not the one
the work is running under. Detail:
[18 · Threads and `@Async`](18-threads-and-async.md).

**A fast, definitive probe for checks 1 to 5**, from inside the method:

```java
TransactionSynchronizationManager.isActualTransactionActive();   // is there one?
TransactionSynchronizationManager.getCurrentTransactionName();   // which one?
```

`false` settles it: there is no transaction, and the cause is one of the five
above. If it is `true`, stop looking here and go to check 6.

### 6 · Did something catch the exception?

If the method catches its own failure and does not rethrow, no exception reaches
the interceptor, no rule is consulted, and the transaction commits. This includes a
`catch` in an intermediate frame, and a `catch` in a caller that is itself the
boundary. Detail: [14 · The caught exception](14-the-caught-exception.md).

### 7 · Was the exception checked?

> Any `RuntimeException` or `Error` triggers rollback, and any checked `Exception`
> does not.

A checked exception escaping a transactional method commits by default. Detail:
[13 · Rollback rules](13-rollback-rules.md).

### 8 · Is the setting one that only applies to a new transaction?

`isolation`, `timeout` and `readOnly` are "Only applicable to values of `REQUIRED`
or `REQUIRES_NEW`". A method entered while a transaction already exists does not
start one, so those three declarations are dropped without a word. This is the
check for "the transaction exists but does not have the properties I declared".
Detail: [16 · Isolation](16-isolation.md) and
[15b · Where read-only pays](15b-where-read-only-pays.md).

## Why this order

Checks 1 to 3 are the proxy mechanics, and together they account for most reports.
They are also the cheapest to verify — you read the call site and the method
signature, and you are done.

Check 4 is rare in Boot but catastrophic when it applies, and it is a single
look at the context, so it is worth doing before anything harder.

Check 5 catches the case that looks like a proxy problem and is not, which is why
it belongs at the end of the "was there a transaction" group rather than the
beginning.

Checks 6 to 8 only make sense once you know a transaction existed, and 6 comes
before 7 because a `catch` makes the exception's type irrelevant. There is no point
reasoning about checked versus unchecked if nothing ever escaped.

## The one loud failure

Almost everything here is silent, with one exception worth remembering because it
is diagnostic:

```java
TransactionAspectSupport.currentTransactionStatus();
```

throws `NoTransactionException` "if the transaction info cannot be found, because
the method was invoked outside an AOP invocation context". If you call it from a
method and it throws, checks 1 to 3 have already been answered: the annotation is
not in effect. It is the closest thing this topic has to an assertion.

## The trade-off

A checklist is a poor substitute for a mechanism that fails loudly, and it is fair
to ask why the framework does not just warn. The answer is that Spring cannot
distinguish an inert `@Transactional` from a deliberate one — a `private` helper
carrying the annotation might be documentation, a self-invocation might be
intentional, and warning on every case would produce noise that teams would learn
to ignore.

What you can do is buy back some of the loudness. `validateExistingTransaction =
true` turns check 8 into an exception. Integration tests that assert on data after
a forced rollback turn checks 5 to 7 into failures. And an architecture test that
forbids `@Transactional` on non-public methods turns check 2 into a build error.
Each is a small investment that converts a silent class of bug into a visible one.

## Gotchas

**⚠️ Debugging the rollback rules before establishing there was a transaction**
**Symptom:** hours spent on `rollbackFor` when the annotation was never in effect.
**Cause:** the two findings look identical from the database.
**Fix:** run the `isActualTransactionActive()` probe first. It is one line and it
halves the search space.

**⚠️ Concluding from a log line that a transaction existed**
**Symptom:** a diagnosis based on debug logging that turns out to be about a
different boundary.
**Cause:** transaction debug logs are per manager and per boundary; a log line
proves *some* transaction began, not that yours did.
**Fix:** the probe reports what is bound to *this* thread at *this* point.

**⚠️ Fixing the symptom at the wrong layer**
**Symptom:** `@Commit` added to a test, or a `try`/`catch` widened, to make a
failure go away.
**Cause:** treating the diagnosis as an inconvenience.
**Fix:** each of the eight checks has a specific fix. None of them is "suppress the
evidence".

**⚠️ Assuming Boot's auto-configuration covers check 4 in every context**
**Symptom:** an inert annotation in a module or a test slice with a trimmed
context.
**Cause:** a sliced test context may not include the transaction auto-configuration
or a `DataSource`.
**Fix:** check what the context actually contains before concluding the code is
wrong.

**⚠️ A method that passes all eight checks and still misbehaves**
**Symptom:** everything is correct and the data is still wrong.
**Cause:** the problem is probably not the boundary but its *scope* — the
transaction is real, but the wrong work is inside or outside it. Or the work is
committing in a second transaction: `REQUIRES_NEW`, an event listener, a repository
call on a path you had not considered.
**Fix:** stop checking the annotation and start tracing which transaction each
write actually belongs to.

**⚠️ Only checking the failing method**
**Symptom:** a fix that does not hold, because a sibling method has the same
defect.
**Cause:** these mistakes come from habits, so they cluster. A self-invocation in
one method usually means the class is written that way throughout.
**Fix:** when a check finds something, apply that same check to the rest of the
class before moving on.

## Interview questions

**★ Somebody says "`@Transactional` isn't working". What do you ask first?**
Whether the method was called from outside the bean. Self-invocation is the single
most common cause, and the reference states it directly: in proxy mode "only
external method calls coming in through the proxy are intercepted", so a call from
another method of the same object "does not lead to an actual transaction at
runtime even if the invoked method is marked with `@Transactional`". It is also the
cheapest thing to check — you read the call site.

**★ How do you tell "there was no transaction" from "there was one and it
committed"?**
`TransactionSynchronizationManager.isActualTransactionActive()` inside the method,
or `TransactionAspectSupport.currentTransactionStatus()`, which throws
`NoTransactionException` when the method "was invoked outside an AOP invocation
context". That single check splits the problem in half: `false` sends you to the
proxy and threading causes, `true` sends you to the rollback rules and the caught
exception. Without it you are guessing, because the database looks the same either
way.

**★ Give me the ordered checklist.**
Was the call external; is the method non-private, non-final, non-static and visible
on the proxied interface if there is one; is the object actually the proxy rather
than a `new`-ed instance; is transaction management enabled with a manager bean; is
another thread involved. Then, once you know a transaction existed: did something
catch the exception; was the exception checked; and is the setting you declared one
that only applies to a newly started transaction. The order runs cheapest and most
common first, and puts the "was there a transaction" group entirely before the "what
did it decide" group.

**★ Why is "did something catch it" before "was the exception checked"?**
Because a `catch` makes the type irrelevant. If nothing escapes the method, no rule
is consulted at all, and reasoning about `rollbackFor` or checked versus unchecked
is wasted effort. The `catch` also hides the evidence you would use for the later
check, so finding it first often explains the whole report.

**★ What would you add to a codebase to make these failures louder?**
Three things, cheapest first. `validateExistingTransaction = true` on the
transaction manager, at least in tests, so a dropped isolation or read-only
declaration throws instead of being ignored. Integration tests that force a failure
and then assert the database is unchanged, which is the only assertion that
distinguishes a rollback from a commit. And an architecture test forbidding
`@Transactional` on private or final methods, which turns a silent no-op into a
build failure. None of them is expensive, and each removes a category of silent
bug.

**★ A method passes every check and the data is still wrong. Now what?**
The boundary is fine and the *scope* is wrong. Either work that should be inside
the transaction is outside it — another thread, a second transaction from a
`REQUIRES_NEW` boundary or an event listener — or work that should be outside is
inside, which is the long-transaction problem rather than a correctness one. At that
point I stop looking at annotations and start tracing which transaction each
individual write belongs to, because the question has changed from "is there a
boundary" to "is the boundary in the right place".

---

← Prev: [21b · Shaping the work](21b-shaping-the-work.md) · Index: [Spring @Transactional](README.md) · Next → [22b · Reviewing a service](22b-reviewing-a-service.md)
