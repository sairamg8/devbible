---
title: "You can change the rollback rule on one method or on the whole application — and Spring's own javadoc tells you which one you probably want"
sidebar_label: "13b · Changing the rule"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `@Transactional` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)),
> the `@EnableTransactionManagement` javadoc
> ([.../annotation/EnableTransactionManagement.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html)),
> the Spring Framework 7.0 reference *Rolling back a declarative transaction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html))
> and the Spring Boot 4.1 `TransactionProperties` javadoc
> ([docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html](https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**There are two levers. `rollbackFor` and `noRollbackFor` change one method;
`@EnableTransactionManagement(rollbackOn = ALL_EXCEPTIONS)` changes the default
for everything. Spring's javadoc recommends the second one, in writing, unless
you deliberately rely on EJB business-exception semantics.**

## Four attributes, in two pairs

```java
@Transactional(rollbackFor = InsufficientStockException.class)
public void placeOrder(NewOrder cmd) throws InsufficientStockException { ... }
```

`rollbackFor` names exception types that **must** roll back, on top of the
default. `noRollbackFor` names types that **must not**, even though the default
would have.

```java
@Transactional(noRollbackFor = QuoteStaleException.class)
public void refreshQuote(long id) { ... }
```

Both take arrays, so several types can be listed:

```java
@Transactional(rollbackFor = { IOException.class, TimeoutException.class })
public void syncCatalogue() throws IOException, TimeoutException { ... }
```

Each has a string-valued twin — `rollbackForClassName` and
`noRollbackForClassName` — taking exception **name patterns** rather than `Class`
objects:

```java
@Transactional(rollbackForClassName = "com.acme.billing.LedgerWriteException")
public void postLedgerEntry(Entry e) { ... }
```

Those exist for the case where you cannot import the type — it lives in a module
you do not depend on at compile time, or it is generated. They match by a rule
that is not the obvious one, and that rule gets its own page:
[13c · How a rule is matched](13c-how-a-rule-is-matched.md).

The javadoc states the preference plainly, on both `rollbackFor` and
`noRollbackFor`:

> This is the preferred way to construct a rollback rule (in contrast to
> `rollbackForClassName()`), matching the exception type and its subclasses in a
> type-safe manner.

The practical reason is failure mode. A typo in `rollbackFor = Fooo.class` does
not compile. A typo in `rollbackForClassName = "Fooo"` compiles, deploys, matches
nothing, and commits your half-written data in production.

## The global switch

Since Framework **6.2** — so it is available throughout 7.0.x — the default
itself can be changed:

```java
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.annotation.RollbackOn;

@Configuration
@EnableTransactionManagement(rollbackOn = RollbackOn.ALL_EXCEPTIONS)
class TransactionConfig { }
```

The javadoc for the attribute:

> Indicate the rollback behavior for rule-based transactions without custom
> rollback rules: default is rollback on unchecked exception, this can be
> switched to rollback on any exception (including checked).
>
> Note that transaction-specific rollback rules override the default behavior but
> retain the chosen default for unspecified exceptions. This is the case for
> Spring's `Transactional` as well as JTA's `Transactional` when used with Spring
> here.

And then, unusually for a javadoc, an outright recommendation:

> Unless you rely on EJB-style business exceptions with commit behavior, it is
> advisable to switch to `RollbackOn.ALL_EXCEPTIONS` for a consistent rollback
> even in case of a (potentially accidental) checked exception. Also, it is
> advisable to make that switch for Kotlin-based applications where there is no
> enforcement of checked exceptions at all.

Read *potentially accidental* carefully. Spring's own documentation is saying the
checked-exception carve-out is more often an accident than a design. And the
Kotlin sentence generalises further than Kotlin: the rule keys on a distinction
the JVM does not enforce at all — `throws` is a compiler fiction, erased at
runtime — so any code reaching your service through a language, a proxy or a
generated adapter that does not honour it gets behaviour nobody chose.

The second paragraph is the part people miss. Turning the global switch on does
**not** disable `noRollbackFor`. Per-method rules still win; the global setting
only decides the fate of exception types no explicit rule mentions. So the
recommended arrangement is:

1. `rollbackOn = ALL_EXCEPTIONS` globally, so the safe behaviour is the default.
2. `noRollbackFor = TheOneBusinessException.class` on the handful of methods that
   genuinely want to fail and keep their work.

Now the deliberate exceptions are visible in the code, and the accidental ones
are safe. The stock configuration is the other way round.

## In Spring Boot, where you never wrote `@EnableTransactionManagement`

Boot's auto-configuration supplies transaction management, so most applications
never write the annotation at all. To set `rollbackOn` you declare it yourself on
a `@Configuration` class, exactly as above, and Boot's auto-configuration backs
off because the annotation is now present in the context.

There is **no property** for it. Boot 4.1's `spring.transaction.*` namespace
maps to `TransactionProperties`, whose javadoc describes it as

> Configuration properties that can be applied to an
> `AbstractPlatformTransactionManager`

and which exposes exactly two settings: `default-timeout` (a `Duration`) and
`rollback-on-commit-failure` (a `Boolean`). Neither is the rollback rule. Note
also that in Boot 4 this class moved package, to
`org.springframework.boot.transaction.autoconfigure` — a search that lands on the
Boot 3 package name is looking at the wrong version.

## Reading the rules back at runtime

If you want to see what rule set a method actually ended up with, the object to
look at is `org.springframework.transaction.interceptor.RuleBasedTransactionAttribute`
and its list of `RollbackRuleAttribute` entries; the base behaviour lives in
`DefaultTransactionAttribute.rollbackOn(Throwable)`, which the `rollbackFor`
javadoc points at for "a detailed explanation". This matters mostly when
annotations come from several places at once and you want to confirm which
declaration won.

## The trade-off

Switching to `ALL_EXCEPTIONS` gives up the free EJB semantics. Any method that
was relying on a checked exception to fail-and-keep now needs an explicit
`noRollbackFor`, and somebody has to notice those methods before the switch ships
rather than after. In a large codebase that is a real piece of review work: you
are changing the behaviour of every transactional method that throws a checked
exception, all at once.

The counterweight is that you are trading a *bounded, findable* cost — grep for
transactional methods with `throws` clauses — against an *unbounded, silent* one,
because the default's failure mode produces no exception, no log line and no
alert. It only produces wrong data, discovered later by a human.

If the switch feels too large to make in one go, the intermediate step is to
apply `rollbackFor = Exception.class` to the packages that write, and leave
read-only paths alone. That is more code and more places to forget, but it is
reviewable module by module.

## Gotchas

**⚠️ `rollbackFor` on a type that was already unchecked**
**Symptom:** an attribute that looks defensive and changes nothing.
**Cause:** the type was already covered by the default rule.
**Fix:** delete it. An attribute that does not change behaviour teaches the next
reader a wrong rule, and someone will copy it onto a checked exception's method
believing the two cases are symmetrical.

**⚠️ `rollbackFor = RuntimeException.class` written "to be explicit"**
**Symptom:** reviewers argue about whether it drops `Error`, unresolvably.
**Cause:** the rule does not match an `Error` — but no other rule does either, and
an exception matching no rule falls back to the default, which is
`RuntimeException` **or** `Error`. Behaviour is unchanged; the annotation is a
no-op that reads like a decision ([13d](13d-the-matching-algorithm.md)).
**Fix:** for everything including `Error`, `rollbackFor = Throwable.class`; for
every exception but not `Error`, `Exception.class`; for the default, write nothing.

**⚠️ Both `rollbackFor` and `noRollbackFor` naming types in the same hierarchy**
**Symptom:** the outcome is not what either annotation appears to say.
**Cause:** when more than one rule matches, Spring picks the most specific one,
not the first one written. 13c covers exactly how.
**Fix:** do not encode intent in the ordering of the attributes; it is ignored.

**⚠️ Adding `@EnableTransactionManagement` to a Boot app and losing other settings**
**Symptom:** proxy behaviour changes across the whole application after adding
the annotation for `rollbackOn`.
**Cause:** the annotation carries other attributes with Framework-level defaults
— notably `proxyTargetClass`, which defaults to `false` at the Framework level
while Boot sets `spring.aop.proxy-target-class` to `true`. Declaring the
annotation yourself puts you in charge of the whole set.
**Fix:** check what your application depended on before adding it, and state the
attributes you need explicitly rather than assuming the Boot defaults follow.

**⚠️ Expecting a property to exist**
**Symptom:** time lost looking for `spring.transaction.rollback-on` in the Boot
reference.
**Cause:** there is no such property. `spring.transaction.*` has two keys,
neither related.
**Fix:** use the annotation.

**⚠️ Mixing in `jakarta.transaction.Transactional`**
**Symptom:** `rollbackFor` on a method is ignored, or an IDE completion offers
attributes that do not exist.
**Cause:** the Jakarta annotation is a different annotation, supported by Spring
as a drop-in, whose equivalent attributes are named `rollbackOn` and
`dontRollbackOn`. Spring's `rollbackOn` on `@EnableTransactionManagement` applies
to both, but the per-method attribute names do not converge.
**Fix:** standardise the import across the codebase, and check the import first
when a rule mysteriously does nothing.

**⚠️ Applying the switch and forgetting the tests**
**Symptom:** a test suite that was green stays green, and the behaviour change
ships unverified.
**Cause:** most transaction tests assert on the exception, not on the database
state after the boundary closed.
**Fix:** for each method you were relying on to commit-and-throw, add a test that
reads the row back after the transaction ended. That is the only assertion that
distinguishes the two behaviours.

## Interview questions

**★ How do you change the rollback rule for one method, and for the whole
application?**
For one method, `@Transactional(rollbackFor = Foo.class)` to add a type that must
roll back, or `noRollbackFor` to exempt one the default would have rolled back;
each has a string-pattern twin for types you cannot import. For the whole
application, since Framework 6.2,
`@EnableTransactionManagement(rollbackOn = RollbackOn.ALL_EXCEPTIONS)`. The two
compose: per-method rules override the global default, and the global default
governs every exception type no rule mentions.

**★ Spring's javadoc gives an actual recommendation here. What is it, and why?**
That unless you rely on EJB-style business exceptions with commit behaviour, you
should switch to `ALL_EXCEPTIONS` "for a consistent rollback even in case of a
(potentially accidental) checked exception", and that the switch is especially
advisable for Kotlin, "where there is no enforcement of checked exceptions at
all". The reasoning is that checked-versus-unchecked is a compiler-level
distinction the JVM does not enforce, so keying transactional correctness to it
means the outcome can change because of an unrelated `throws` clause, a
generated wrapper, or a caller written in another JVM language. The default
optimises for a semantics almost nobody actually uses, and its failure mode is
silent data corruption.

**★ You turn on `ALL_EXCEPTIONS` in a large codebase. What is your review plan?**
Find every transactional method with a `throws` clause naming a checked type, and
for each, decide whether the current commit-on-throw behaviour was intended.
Where it was — the audit-then-reject shapes — add `noRollbackFor` before the
switch lands, so behaviour does not change for those. Everywhere else the switch
is the fix. Then, for the methods you exempted, add tests that read the database
back after the boundary closed, because a test asserting only on the exception
cannot tell the two behaviours apart. The work is bounded and greppable, which is
the point: the cost of the switch is findable, and the cost of leaving it alone
is not.

**★ Does `rollbackOn = ALL_EXCEPTIONS` make `noRollbackFor` useless?**
No, and the javadoc says so directly: "transaction-specific rollback rules
override the default behavior but retain the chosen default for unspecified
exceptions". The global setting decides only what happens to types no rule
mentions. That is what makes the recommended arrangement work — safe by default,
with the deliberate exceptions written down at the methods that want them.

**★ Why is there no Spring Boot property for this?**
Because it is not a property of the transaction manager. Boot's
`spring.transaction.*` namespace binds to `TransactionProperties`, described in
its javadoc as settings "that can be applied to an
`AbstractPlatformTransactionManager`", and it holds exactly two: a default
timeout and `rollback-on-commit-failure`. The rollback rule is decided by the
transaction *attribute source* wired up by `@EnableTransactionManagement`, which
is configuration of the AOP infrastructure rather than of the manager. So you
declare the annotation. Adding it in a Boot application also makes you responsible
for its other attributes, which is worth knowing before you do it.

**★ What is the difference between `rollbackFor` and `rollbackForClassName`, and
when would you ever choose the string form?**
`rollbackFor` takes `Class` objects and matches by type identity or subclass;
`rollbackForClassName` takes name patterns and matches by name. The javadoc
prefers the first as type-safe, and the failure modes are why: a bad class
reference will not compile, whereas a bad string compiles and silently matches
nothing. The string form earns its place when you cannot reference the type at
compile time — an optional dependency, a type behind a module boundary, a
generated client class — or when you genuinely want to match a family of names
across unrelated hierarchies. That second use is where its substring matching
becomes both the feature and the hazard.

---

← Prev: [13 · Rollback rules](13-rollback-rules.md) · Index: [04 · Spring @Transactional](README.md) · Next → [13c · How a rule is matched](13c-how-a-rule-is-matched.md)
