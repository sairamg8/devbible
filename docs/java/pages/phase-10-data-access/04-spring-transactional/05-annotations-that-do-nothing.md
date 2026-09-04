---
title: "Nine placements where @Transactional compiles, starts, runs and does absolutely nothing, in the order you should check them"
sidebar_label: "5 · Annotations that do nothing"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)),
> *Core → AOP → Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)),
> the `@EnableTransactionManagement` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html))
> and the `TransactionSynchronizationManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronizationManager.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**Chunks 2 to 4 each explained one reason the annotation can be inert. This chunk
is the consolidated list, in the order you should check it. Every entry produces
the same observable behaviour — the code works, the rows are written, and nothing
rolls back — so a checklist is the whole methodology, and the order of the
checklist is most of its value. [Chunk 5b](05b-detecting-a-dead-annotation.md) is
the other half: how to *detect* which one you have instead of reasoning about
it.**

## The list, in check order

| # | Placement | Advised? | Why |
|---|---|---|---|
| 1 | called from another method of the same class | **no** | the proxy is not in the call path |
| 2 | `private` method | **no** | cannot be overridden, so cannot be advised |
| 3 | `static` method | **no** | no instance dispatch; the proxy is never involved |
| 4 | `final` method under CGLIB | **no** | cannot be overridden |
| 5 | any method of a `final` class under CGLIB | **no** | the class cannot be subclassed |
| 6 | non-public method under a JDK proxy | **no** | not on the proxy at all |
| 7 | public method **not on the interface**, under a JDK proxy | **no** | same |
| 8 | invoked during `@PostConstruct` / a constructor | **no** | the proxy does not exist yet |
| 9 | the object was created with `new`, or unwrapped | **no** | you hold the target |
| — | infrastructure absent (no `@EnableTransactionManagement`, no manager) | **no** | nothing built a proxy |

Numbers 1 and 8 are [chunk 3](03-the-self-invocation-trap.md) and
[chunk 3b](03b-the-initialization-variant.md). Numbers 2 to 7 are
[chunk 2](02-the-proxy.md) and
[chunk 2c](02c-visibility-and-the-interface-question.md). Number 9 and the
infrastructure row are [chunk 1](01-not-a-language-feature.md). What this page
adds is the ordering; [chunk 5b](05b-detecting-a-dead-annotation.md) adds the
detection.

⚠️ **The order matters.** Check reachability (1, 8, 9) before advisability (2–7),
because reachability failures are far more common and do not depend on knowing
the proxy strategy. Check infrastructure last: in a Spring Boot application it is
almost never the answer, and checking it first wastes the most time.

## The 6.0 change, stated precisely

The most commonly repeated wrong rule in this area is "only public methods can be
transactional". The reference:

> *"The `@Transactional` annotation is typically used on methods with `public`
> visibility. As of 6.0, `protected` or package-visible methods can also be made
> transactional for class-based proxies by default. Note that transactional
> methods in interface-based proxies must always be `public` and defined in the
> proxied interface."*

So the correct statement has three parts, and dropping any of them makes it
wrong:

1. Under **class-based (CGLIB) proxies** — Boot's default — `protected` and
   package-private methods **are** transactional.
2. Under **interface-based (JDK) proxies**, a transactional method must be
   `public` **and declared on the proxied interface**. Being public is not
   enough.
3. `private` was never in scope under either, and no setting changes that.

To go back to the old uniform behaviour, register the attribute source with
`publicMethodsOnly`:

```java
@Bean
TransactionAttributeSource transactionAttributeSource() {
    return new AnnotationTransactionAttributeSource(true);   // publicMethodsOnly
}
```

🔴 **That flag only ever removes behaviour.** It makes non-public methods
consistently untransactional across every proxy strategy. It is a way to stop a
future configuration change from silently moving your boundary — not a repair for
anything on the list above.

## The trade-off

Everything on this page exists because Spring chose not to fail fast. It could
refuse to start when it finds `@Transactional` on a `private` method; it does
not, because the same annotation may be meaningful under weaving, or on a
different proxy strategy, and a startup failure over unreachable metadata would
be hostile in a large codebase. The benefit is that adding the annotation is
never risky. The cost is that removing its effect is never noisy — which is why
[chunk 5b](05b-detecting-a-dead-annotation.md) exists at all.

## Gotchas

**⚠️ Quoting "only public methods work"**
**Symptom:** a review rejects a working `protected` method, or accepts a
`private` one on the grounds the rule changed.
**Cause:** the 6.0 change covers `protected` and package-private under
class-based proxies only.
**Fix:** the three-part statement above. The line is overridability, not
publicness.

**⚠️ Checking infrastructure first**
**Symptom:** an hour spent verifying that a `PlatformTransactionManager` bean
exists, in a Spring Boot application where it always does.
**Cause:** checking the least likely cause first.
**Fix:** reachability, then advisability, then infrastructure.

**⚠️ Assuming the proxy strategy without checking it**
**Symptom:** a diagnosis built on JDK-proxy rules in an application that uses
CGLIB, or the reverse.
**Cause:** the Framework default (`proxyTargetClass=false`) and the Boot default
(`spring.aop.proxy-target-class=true`) are opposite, so "the default" means two
different things depending on which document you read.
**Fix:** determine it for the application in hand before applying rows 4 to 7.

**⚠️ Treating `final` as safe because the class has an interface**
**Symptom:** a `final` class with an interface still fails to be proxied in a
Boot application.
**Cause:** Boot's default is CGLIB even when interfaces exist, so the subclass is
still attempted.
**Fix:** remove `final`, or accept an application-wide switch to JDK proxies.

**⚠️ A `@Transactional` on a Kotlin class in a mixed codebase**
**Symptom:** rows 4 and 5 firing on code where nobody wrote `final`.
**Cause:** Kotlin classes and members are final unless declared `open`.
**Fix:** the `kotlin-spring` compiler plugin. Listed here because a Java service
calling into a Kotlin module hits it without warning.

**⚠️ Registering `publicMethodsOnly = true` expecting it to fix something**
**Symptom:** a non-public method that was not transactional still is not, and a
`protected` one that was has stopped.
**Cause:** the flag only ever narrows what is advised.
**Fix:** use it to lock in consistent semantics, never as a repair.

## Interview questions

**★ List every way `@Transactional` can silently do nothing.**
Grouped by cause, there are three families. *Not reached:* the method is called
from another method of the same class (self-invocation, including via a lambda,
a method reference or an interface default method); it is invoked during
`@PostConstruct` or a constructor, before the proxy exists; or the object in hand
was created with `new` or unwrapped from the proxy. *Cannot be advised:* the
method is `private`, `static`, or `final`, or the class is `final` under CGLIB;
or under a JDK proxy the method is non-public or simply not declared on the
proxied interface. *No infrastructure:* there is no transaction manager or no
annotation-driven transaction management in this context, which in Spring Boot
essentially never happens but does in hand-built contexts and narrow test slices.
The important part of the answer is that all three families produce the identical
symptom — the code works until something throws halfway through.

**★ `protected` methods became transactional in 6.0. Does that mean the old
advice was wrong?**
The old advice was right for its time and is now incomplete rather than wrong.
Before 6.0 the attribute source considered only public methods by default, so
"annotate public methods" was correct guidance. Since 6.0, `protected` and
package-visible methods are also considered, but only for class-based proxies —
under interface-based proxies a transactional method must still be public *and*
declared on the proxied interface, which is a stronger condition than merely
being public. `private` was never included and cannot be, because it is not a
policy decision: a private method is not virtual and a generated subclass has no
way to intercept it. The practically useful version of the rule is that the line
is overridability, not visibility, and that the pre-6.0 semantics are still
available via `AnnotationTransactionAttributeSource(true)` if you want them
uniformly.

**★ What is `publicMethodsOnly` for, if it cannot fix anything?**
Consistency, and protection against a future change. Setting it to `true` makes
non-public methods reliably untransactional regardless of proxy strategy, which
matters in two situations. The first is a codebase that grew up before 6.0 and
has non-public methods carrying annotations nobody intended to become live —
upgrading the framework would silently turn them on. The second is an
application where `spring.aop.proxy-target-class` is not firmly under your
control: without the flag, flipping that setting moves the boundary for every
non-public annotated method, and with it, nothing moves. It never makes a method
transactional that was not, so it is never the answer to "why is this not
working".

**★ Why check reachability before advisability?**
Because reachability failures are far more common and far cheaper to establish.
"Who calls this method?" is one search in an IDE and needs no knowledge of the
application's proxy configuration; the answer immediately settles entries 1, 8
and 9, which between them account for most real occurrences. Advisability
questions — is it final, is it on the interface, which proxy kind is in use —
require you to first determine the proxy strategy, which is itself a source of
error because the Framework and Boot defaults are opposite. And infrastructure
goes last because in a Boot application it is essentially always present, so
checking it first is the highest-cost, lowest-yield move available.

**★ You are handed a service where one method is transactional and another is
not, both annotated identically. Where do you look?**
The difference has to be in something that varies per method, so start there.
Check who calls each of them: if the working one is called from a controller and
the broken one from inside the class, that is the whole answer. If both are
external, compare their modifiers — `final`, `static`, or a visibility that a JDK
proxy would exclude. If the application uses interface-based proxies, check
whether both methods are declared on the interface; a public method the
implementation adds beyond the interface cannot be reached through the proxy.
Then, and only then, compare their annotations for a meta-annotation or a
class-level default that applies to one and not the other.

**★ Why does Spring not simply fail at startup when it finds an unreachable
`@Transactional`?**
Because "unreachable" is not a property Spring can determine at startup. Whether
a method is `private` or `final` is knowable, but whether it will ever be called
from outside the class is a call-graph question the container never asks — and an
annotation that is unreachable under proxying may be perfectly meaningful under
AspectJ weaving, or under a different proxy strategy that a later configuration
change enables. Failing the context over metadata that might become live is
hostile, particularly in a large application where the annotation may have been
placed by a library. The design trade is that adding `@Transactional` is never
risky, and the price is that its absence of effect is never announced. That price
is why the detection techniques in the next chunk are worth building into a
project rather than remembering.

**★ Row 9 says "created with `new`, or unwrapped". What does *unwrapped* mean, and how
does it happen by accident?**
Unwrapping means getting hold of the target object that sits inside the proxy, so that
subsequent calls skip every interceptor. The supported way to do it deliberately is
`AopTestUtils.getTargetObject(candidate)`, documented as: "If the supplied `candidate`
is a Spring proxy, the target of the proxy will be returned; otherwise, the `candidate`
will be returned *as is*." It works by casting the proxy to `Advised` and calling
`getTargetSource().getTarget()`, which is also how it happens accidentally — any code
that does that cast, any test helper that reaches for the "real" object to stub a
field on it with reflection, and any `BeanPostProcessor` that returns the raw target
after the auto-proxy creator has run. The tell is that the object works perfectly for
everything except the annotations. `AopTestUtils` also has `getUltimateTargetObject`
for proxies wrapped in proxies, which is worth knowing precisely because a stack of
wrappers is where this gets confusing.

**★ Which of the nine entries could a static analyser catch, and which could it never?**
Rows 2 to 7 are purely structural: `private`, `static`, `final` method, `final` class,
and the two JDK-proxy rules are all decidable from the class file plus one
configuration value, so a Checkstyle, PMD or ArchUnit rule catches them with no false
negatives. Row 1, self-invocation, is decidable in the common case — an invocation
instruction whose owner is the declaring class — which is why an ArchUnit rule for it is
worth having, but it degrades once the call is dispatched through a functional
interface built elsewhere. Row 8 is decidable too, since `@PostConstruct` and
constructors are identifiable. Row 9 and the infrastructure row are the ones that
cannot be caught statically: whether the reference in hand at a given call site is the
proxy or the target is a runtime property, and whether this particular context has
transaction infrastructure depends on which configuration classes were loaded. That
split is exactly why [chunk 5c](05c-proving-it-and-preventing-it.md) pairs build-time
rules with one runtime assertion rather than choosing between them.

**★ Rows 4 and 5 both say "under CGLIB". Is a `final` class safe under JDK proxies?**
Yes, and the asymmetry is worth holding because it is the one place `final` stops
being a problem. A JDK dynamic proxy is a *sibling* — a generated class implementing
the same interfaces — so it never subclasses your type and `final` on the class is
irrelevant; likewise `final` on a method, since interface methods cannot be final. The
condition it imposes instead is stricter in a different direction: the method must be
`public` and declared on a proxied interface. So `final class` plus an interface plus
`spring.aop.proxy-target-class=false` genuinely works. The reason this rarely helps is
that Boot sets that property to `true`, so a Boot application attempts a CGLIB subclass
even when interfaces exist — and reversing that is an application-wide decision to buy
one class its `final` keyword, which is a bad trade.

---

← Prev: [4c · AspectJ weaving](04c-aspectj-weaving.md) · Index: [04 · Spring @Transactional](README.md) · Next → [5b · Detecting a dead annotation](05b-detecting-a-dead-annotation.md)
