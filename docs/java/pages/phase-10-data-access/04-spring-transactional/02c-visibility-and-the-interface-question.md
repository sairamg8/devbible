---
title: "Whether a method can be advised at all comes down to two things the compiler decided for you: its visibility and where it was declared"
sidebar_label: "2c · Visibility and interfaces"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Core → AOP → Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**[Chunk 2b](02b-where-the-annotation-lives.md) was about which annotation the
interceptor finds. This one is about the methods it cannot reach even when the
annotation is right there. Two independent things decide it: the method's
**visibility**, whose rules changed in Spring Framework 6.0 and are still widely
misquoted, and **where the method was declared** — on the concrete class or on an
interface — which the Spring team have an opinion about, expressed in language
strong enough to quote. Both failures are silent, and both produce code that
passes every happy-path test.**

## Why the Spring team say: annotate the class, not the interface

Annotating the interface works today for both proxy kinds. The reference still
tells you not to, and the reason is precise:

> *"The Spring team recommends that you annotate methods of concrete classes with
> the `@Transactional` annotation, rather than relying on annotated methods in
> interfaces, even if the latter does work for interface-based and target-class
> proxies as of 5.0. Since Java annotations are not inherited from interfaces,
> interface-declared annotations are still not recognized by the weaving
> infrastructure when using AspectJ mode, so the aspect does not get applied. As
> a consequence, your transaction annotations may be silently ignored: Your code
> might appear to 'work' until you test a rollback scenario."*

**"Silently ignored" is the operative phrase.** The failure has no symptom under
happy-path testing, because autocommit still writes every row. It appears the
first time something throws halfway through.

The underlying Java fact is worth stating on its own, because it explains more
than this one rule: **annotations are never inherited from an interface to an
implementing class.** `@Inherited` — the JDK meta-annotation that makes
annotations flow down a hierarchy at all — applies only to *superclasses*, and
even then only to class-level annotations. Spring's attribute source works around
this by explicitly searching the interface method as part of its lookup. An
AspectJ weaver, working on bytecode with no such lookup, does not.

So the practical rule is: **annotating the interface makes your transaction
boundary depend on Spring's lookup behaviour rather than on the annotation
itself.** Annotating the concrete class makes it depend on nothing.

## Visibility: the rule changed in 6.0

Old advice ("only public methods") is now half-wrong, and the exact wording
matters:

> *"The `@Transactional` annotation is typically used on methods with `public`
> visibility. As of 6.0, `protected` or package-visible methods can also be made
> transactional for class-based proxies by default. Note that transactional
> methods in interface-based proxies must always be `public` and defined in the
> proxied interface."*

| Modifier | CGLIB (Boot default) | JDK proxy |
|---|---|---|
| `public` | advised | advised **if on the interface** |
| `protected` | advised (since 6.0) | not on the proxy at all |
| package-private | advised (since 6.0) | not on the proxy at all |
| `private` | **never** | **never** |
| `static` | **never** | **never** |
| `final` | **never** | n/a (interface methods are not final) |

Two of those rows are not policy choices — they are consequences of how the JVM
dispatches a call, spelled out in [chunk 2](02-the-proxy.md). A `private` or
`final` method cannot be overridden, so a generated subclass has nowhere to put
the advice. A `static` method never touches an instance, so the proxy is not in
the call path at all.

To restore the pre-5.3 behaviour of ignoring every non-public method uniformly,
the reference shows the bean to register:

```java
/**
 * Register a custom AnnotationTransactionAttributeSource with the
 * publicMethodsOnly flag set to true to consistently ignore non-public methods.
 */
@Bean
TransactionAttributeSource transactionAttributeSource() {
    return new AnnotationTransactionAttributeSource(true);
}
```

⚠️ **That bean is not a fix — it is a consistency choice.** Setting
`publicMethodsOnly` to `true` makes non-public methods *reliably* untransactional
under every proxy strategy, which is useful if your codebase depends on the old
behaviour or if you want the same semantics whether or not somebody flips
`spring.aop.proxy-target-class`. It makes nothing work that did not work before.

⚠️ **Widened visibility does not widen reachability.** A `protected` method being
*advisable* does not help if the only caller is another method of the same class
— that is self-invocation, and it is [chunk 3](03-the-self-invocation-trap.md).

## The other annotation with the same name

> *"The standard `jakarta.transaction.Transactional` annotation is also supported
> as a drop-in replacement for Spring's own annotation."*

Both work. They are not identical: Spring's carries `readOnly`, `timeoutString`,
`label` and the `rollbackFor` family; the Jakarta one carries `rollbackOn` /
`dontRollbackOn` and its own `TxType` enum. ⚠️ **An IDE auto-import that picks
`jakarta.transaction.Transactional` when you wanted `readOnly = true` produces a
compile error, which is the good case — but picking it when you wanted Spring's
propagation names produces working code with subtly different attributes.** Check
the import when the attribute you expected is not offered.

| | `org.springframework.transaction.annotation` | `jakarta.transaction` |
|---|---|---|
| propagation | `Propagation` enum, 7 values | `TxType` enum, 6 values — **no `NESTED`** |
| isolation | `Isolation` enum | — |
| read-only hint | `readOnly` | — |
| timeout | `timeout`, `timeoutString` | — |
| rollback rules | `rollbackFor`, `rollbackForClassName`, `noRollbackFor`, `noRollbackForClassName` | `rollbackOn`, `dontRollbackOn` |
| manager selection | `value` / `transactionManager` | — |
| descriptive label | `label` | — |

🔴 **`TxType` has no `NESTED`.** If you have written `@Transactional(propagation
= Propagation.NESTED)` and an auto-import swapped the annotation, the code will
not compile — again the good case. The bad case is the reverse direction, where
everything you wrote happens to exist on both and the defaults differ.

## The trade-off

Everything on this page is Spring choosing **silence over failure**. Spring could
refuse to start when it finds `@Transactional` on a `private` method; it does
not, because the same annotation might be meaningful under a different proxy
strategy or a weaving setup, and because a startup failure over metadata that is
merely unreachable would be hostile in a large codebase. What you get instead is
an application that starts cleanly and a transaction that is not there. The cost
of that design is that **placement correctness is entirely on you**, and
[chunk 5](05-annotations-that-do-nothing.md) is the catalogue of ways to get it
wrong plus the ways to detect it.

## Gotchas

**⚠️ Assuming an interface annotation is safe because it currently works**
**Symptom:** transactions vanish after a migration to AspectJ weaving, or after a
refactor that changes how the bean is proxied.
**Cause:** Java does not inherit annotations from interfaces; the weaver never
sees them.
**Fix:** annotate the concrete class, as the reference recommends.

**⚠️ The wrong `Transactional` import**
**Symptom:** `readOnly` or `propagation` will not compile; or `rollbackFor` is
missing.
**Cause:** `jakarta.transaction.Transactional` was imported instead of
`org.springframework.transaction.annotation.Transactional`.
**Fix:** fix the import. Standardise on Spring's in a Spring codebase — the extra
attributes are the ones you actually use.

**⚠️ Annotating a package-private method and switching to JDK proxies later**
**Symptom:** a working transaction disappears when somebody sets
`spring.aop.proxy-target-class=false`.
**Cause:** non-public methods are not on a JDK proxy at all.
**Fix:** keep transactional entry points `public` if the proxy strategy is not
under your control.

**⚠️ Quoting "only public methods work" from a pre-6.0 blog post**
**Symptom:** a code review that rejects a working `protected` transactional
method, or — worse — one that accepts a `private` one on the grounds that "the
visibility rule changed".
**Cause:** the rule changed for `protected` and package-private under
class-based proxies only. `private` was never in scope and still is not.
**Fix:** read the table above. The dividing line is *overridability*, not
*publicness*.

**⚠️ Registering `publicMethodsOnly = true` and expecting it to fix something**
**Symptom:** a non-public method that was not transactional is still not
transactional, and now a `protected` one that *was* has stopped.
**Cause:** the flag only ever narrows what is advised.
**Fix:** use it to lock in consistent semantics, never as a repair.

**⚠️ A `public` method that is not on the proxied interface, under a JDK proxy**
**Symptom:** one method of a service is untransactional; the rest are fine; the
method is public and correctly annotated.
**Cause:** a JDK proxy only has the interface's methods. A public method the
implementation adds beyond the interface does not exist on the proxy — and the
caller could not have reached it through an interface-typed reference anyway.
**Fix:** add it to the interface, or use CGLIB proxies (Boot's default).

## Interview questions

**★ The annotation is on the interface and everything works. Why is that still
wrong?**
Because it works by accident of the current proxying strategy. Java annotations
are not inherited from interfaces to implementing classes, so any mechanism that
inspects the class rather than the invoked interface method will not see it. The
reference calls this out for AspectJ mode specifically: the weaver does not
recognise interface-declared annotations, so the aspect is not applied and "your
transaction annotations may be silently ignored." The failure mode is the worst
kind — the code appears to work until somebody tests a rollback, or until a build
switches to weaving. Annotating the concrete class costs nothing and removes the
question entirely.

**★ Is `@Transactional` on a `protected` method ignored?**
Not any more, and the answer depends on the proxy type. Since Spring Framework
6.0, `protected` and package-visible methods can be made transactional for
class-based (CGLIB) proxies by default — the normal case in Spring Boot. For
interface-based (JDK) proxies the method must be `public` and declared on the
proxied interface, because those are the only methods that exist on the proxy at
all. `private` is never advised under either mechanism. If you want the pre-6.0
behaviour of ignoring every non-public method uniformly, register an
`AnnotationTransactionAttributeSource` with `publicMethodsOnly` set to true. And
note that being advisable is not the same as being reached — a protected method
called only from inside its own class is still bypassing the proxy.

**★ Spring's `@Transactional` and `jakarta.transaction.Transactional` — when does
the difference matter?**
Spring supports the Jakarta annotation as a drop-in replacement, and for the
ordinary "wrap this method in a transaction" case they behave the same. The
difference matters when you need an attribute only one of them has. Spring's
carries `readOnly`, `timeout`/`timeoutString`, `label`, and the
`rollbackFor`/`noRollbackFor` family with their class-name pattern variants; the
Jakarta annotation instead offers `rollbackOn`/`dontRollbackOn` and a `TxType`
enum for propagation that has no `NESTED` value at all. In practice the trap is
an IDE auto-import: you write `@Transactional(readOnly = true)`, the wrong import
is chosen, and you get a compile error — which is lucky, because the version that
just quietly compiles with different semantics is much harder to notice.

**★ Why is `private` still excluded when `protected` was allowed in 6.0?**
Because they fail for different reasons. Allowing `protected` was a *policy*
change in the attribute source: those methods were always overridable by a CGLIB
subclass, Spring simply chose not to consider them. `private` is not a policy
question — a private method is not virtual, cannot be overridden by a generated
subclass, and is invoked with `invokespecial` rather than dynamic dispatch. There
is no place to insert advice, so no configuration flag could enable it. The same
argument covers `final` and `static`. The useful mental model is: the 6.0 change
moved the line from *visible to callers* to *overridable by a subclass*, and
`private` is on the wrong side of both.

**★ Under what circumstances does the choice between class and interface
annotation actually change runtime behaviour today?**
Three that are real. Under AspectJ compile-time or load-time weaving, an
interface annotation is not seen at all and the aspect is not applied. Under a
JDK proxy, an annotation on a concrete-class method that is not declared on the
interface can never be reached, because that method is not on the proxy. And
under any strategy, an interface annotation applies to *every* implementation of
that interface — including a test double, an in-memory stub, or a decorator you
add later — which may be more or fewer beans than you intended. On a plain
CGLIB-proxied Boot service with one implementation, the two placements behave
identically, which is exactly why the wrong one survives so long.

**★ How would you make the visibility rules consistent across a large codebase
rather than relying on everyone remembering them?**
Two levers, and they work at different points. At build time, an ArchUnit or
Checkstyle rule that forbids `@Transactional` on anything `private`, `static` or
`final` catches the unreachable placements before they ship, which is where they
belong — Spring will never tell you. At runtime, registering an
`AnnotationTransactionAttributeSource` with `publicMethodsOnly = true` fixes the
semantics to one rule regardless of proxy strategy, so a later change to
`spring.aop.proxy-target-class` cannot quietly move the boundary. Neither is a
substitute for annotating concrete classes with public entry points, which is the
arrangement none of these rules has anything to say about.

**★ The table says package-private methods are advised since 6.0. Is that
unconditional?**
No, and the exception is worth carrying because it is invisible in the source. The
6.0 change made the attribute source *consider* package-visible methods; whether one
can actually be advised still comes down to whether the generated subclass can override
it, and a package-private method is only overridable from within the same package. The
proxying reference states the consequence directly: "Methods that are not visible — for
example, package-private methods in a parent class from a different package — cannot be
advised because they are effectively private." So a package-private method declared on
the class being proxied is advised, and the identically-declared method inherited from a
base class in a different package is not. Nothing in either file distinguishes them, and
neither placement produces a warning. It is a good reason to keep transactional entry
points `public` when a class hierarchy spans packages.

---

← Prev: [2b · Where the annotation lives](02b-where-the-annotation-lives.md) · Index: [04 · Spring @Transactional](README.md) · Next → [2d · The inheritance rule](02d-the-inheritance-rule.md)
