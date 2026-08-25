---
title: "The interceptor asks one question per call — 'does this method have a transaction attribute?' — and inheritance answers it in ways nobody expects"
sidebar_label: "2b · Where the annotation lives"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Declarative transaction management*
> ([.../transaction/declarative.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**The proxy from [chunk 2](02-the-proxy.md) does not "apply transactions to the
bean". Per call, it asks a `TransactionAttributeSource` whether *this specific
method* has a transaction attribute, and does nothing if the answer is no. Where
the annotation may sit, which one wins when several apply, and — the one that
catches everybody — the fact that class-level annotations do not travel *up* the
class hierarchy, all follow from that single lookup. This chunk is the lookup and
the precedence rules; [chunk 2d](02d-the-inheritance-rule.md) is the inheritance rule
they produce, and [chunk 2c](02c-visibility-and-the-interface-question.md) is what the
lookup refuses to find.**

## What the interceptor does around your method

Stripped to essentials. This is not Spring's source; it is the shape of it, and
every later chunk in this topic is an elaboration of one of these lines:

```java
// conceptual: the transaction interceptor around a proxied method call
TransactionAttribute attr =
        attributeSource.getTransactionAttribute(method, targetClass);

if (attr == null) {
    return method.invoke(target, args);        // not transactional: straight through
}

TransactionStatus status = txManager.getTransaction(attr);   // begin OR join
Object result;
try {
    result = method.invoke(target, args);      // YOUR method body runs here
} catch (Throwable ex) {
    if (attr.rollbackOn(ex)) txManager.rollback(status);
    else                     txManager.commit(status);
    throw ex;
}
txManager.commit(status);                      // this call can itself throw
return result;
```

Five things to take from it:

1. **The lookup is per method, per call**, keyed on the invoked method and the
   target class. No attribute means no transaction and no overhead.
2. **`getTransaction` may begin a physical transaction or join one that already
   exists**, according to propagation — chunks 8 to 12.
3. **`rollbackOn(ex)` is a decision made from the exception's *type*** — chunk 13
   — and it only ever sees exceptions that *escape* your method — chunk 14.
4. **The commit is a call that can fail**, which is where
   `UnexpectedRollbackException` comes from —
   [chunk 9](09-marked-rollback-only.md).
5. **Nothing here is aware of anything except this thread.** The declarative
   model, in the reference's words, "works at method granularity around a thread
   of execution."

## Where the annotation may live, and which one wins

| Placement | Effect |
|---|---|
| **method, concrete class** | applies to that method; wins over everything else |
| **class, concrete class** | a default "for all methods of the declaring class (as well as its subclasses)" |
| **method or type, interface** | works for both proxy kinds since 5.0 — and is discouraged |
| **a meta-annotation** | a custom annotation itself annotated `@Transactional` works |

The tie-break rule is one sentence: *"The most derived location takes precedence
when evaluating the transactional settings for a method."* The reference's own
example is the shape you will write most often — a read-only default on the class
with specific methods opting out:

```java
@Transactional(readOnly = true)
public class DefaultFooService implements FooService {

    public Foo getFoo(String fooName) {
        // inherits readOnly = true from the class
    }

    // these settings have precedence for this method
    @Transactional(readOnly = false, propagation = Propagation.REQUIRES_NEW)
    public void updateFoo(Foo foo) {
        // ...
    }
}
```

⚠️ **"Most derived" is about location, not about merging.** The method-level
annotation is not blended with the class-level one; it *replaces* it. In
`updateFoo` above, every attribute that is not written out — propagation aside —
falls back to the annotation's own defaults, not to the class's. If the class had
declared `timeout = 5`, `updateFoo` would not have it.

## The trade-off

A per-method attribute lookup is what makes the annotation cheap — a bean with
one transactional method out of forty pays nothing on the other thirty-nine. The
price is that **"has no attribute" and "was never asked" produce identical
runtime behaviour**: the call goes straight through. There is no third state for
"this looks transactional but I could not use it", so a misplaced annotation and
a deliberately untransactional method are indistinguishable from the outside.
Every gotcha below is a variation on that one missing diagnostic.

## Gotchas

**⚠️ Believing a method-level annotation inherits the class-level attributes**
**Symptom:** a method annotated only `@Transactional(propagation = REQUIRES_NEW)`
inside a `@Transactional(readOnly = true)` class turns out to be read-write; or a
class-level `timeout` silently stops applying to one method.
**Cause:** the most derived annotation replaces the outer one wholesale.
**Fix:** restate every attribute you still want on the method-level annotation.

**⚠️ A custom meta-annotation that loses attributes**
**Symptom:** `@BusinessTransaction` compiles and applies, but its `timeout` is
ignored.
**Cause:** a meta-annotation's own attributes are not automatically aliased onto
the annotation it meta-annotates.
**Fix:** declare the values on the `@Transactional` in the meta-annotation
itself, or wire them with `@AliasFor`.

**⚠️ A class-level `@Transactional` that quietly makes everything transactional**
**Symptom:** a `@Transactional` on a service class opens a transaction for
`getVersion()`, `healthCheck()` and every other trivial read, holding a
connection for each.
**Cause:** the class-level annotation is a default for *every* method the class
declares, not only the ones that touch the database.
**Fix:** annotate methods, or accept the class-level default deliberately and
know that a no-op method now costs a connection checkout.

**⚠️ Two annotations that both apply, and the wrong one wins**
**Symptom:** a method annotated on the interface with `readOnly = true` is
read-write at runtime, because the implementation class carries a bare
`@Transactional`.
**Cause:** the most derived location wins, and the concrete class is more derived
than the interface it implements. The interface annotation is not merged in; it
is simply outranked.
**Fix:** put the settings where the winner is — the concrete class or method.
Declaring the same attribute in two places is a latent contradiction either way.

## Interview questions

**★ What exactly does the transaction interceptor do around your method?**
It asks a `TransactionAttributeSource` for the transaction attribute of the
invoked method against the target class — if there is none, the call passes
through untouched. If there is one, it asks the transaction manager for a
`TransactionStatus`, which either starts a physical transaction or joins an
existing one according to the propagation setting. It then invokes your method.
On a normal return it commits. On a `Throwable` it consults the rollback rules
for that exception type and either rolls back or commits, then rethrows in either
case. Two consequences fall out of that shape immediately: only exceptions that
*escape* your method are ever seen, and the commit itself is a call that can
fail.

**★ If a method-level `@Transactional` overrides a class-level one, what happens
to the attributes you did not restate?**
They revert to the annotation's own defaults, not to the class's values. The
resolution rule is that the most derived *location* wins, and it selects one
annotation rather than merging several. So a class declaring
`@Transactional(readOnly = true, timeout = 5)` and a method declaring
`@Transactional(propagation = REQUIRES_NEW)` gives that method a read-write
transaction with the system default timeout — both class-level settings are gone.
This is a common source of a read-only intent quietly becoming read-write, and
the defence is to restate every attribute you still want whenever you add a
method-level annotation.

**★ Why is the attribute lookup keyed on the target class and not just the
method?**
Because the invoked method and the method that carries the metadata are often
different objects. Under a JDK proxy the invoked method is the *interface*
method; under CGLIB it is the generated subclass's override. Neither of those is
where you wrote the annotation. Passing the target class lets the attribute
source walk from the invoked method to the most specific declaration that
actually applies — the implementation method, then its declaring class, then the
interface method, then the interface — and pick the most derived one. It is also
why the same interface method can be transactional on one implementation and not
on another: the attribute depends on the class in hand, not on the signature.

**★ You add `@Transactional` to a service class and connection usage doubles.
What happened?**
A class-level annotation is a default for every method the class declares, so
methods that never touch the database now open a transaction, check out a
connection, and commit an empty one. If the class also has cheap accessors,
health probes, or mapping helpers called in a loop, each of those is now a pool
checkout. The fix is to be deliberate about the boundary: annotate the methods
that represent one unit of business work rather than blanket-annotating the
class, and if you do keep the class-level default, make sure the class contains
only methods that deserve it.

**★ Does a meta-annotation carry its own attributes through to `@Transactional`?**
Not by itself. Writing a custom `@BusinessTransaction` annotated with
`@Transactional` gives every method it marks a transaction, because Spring's
attribute source searches meta-annotations. But an attribute you declare on your
own annotation — a `timeout()` method, say — is not automatically connected to
`@Transactional`'s `timeout`. You either fix the values on the `@Transactional`
inside the meta-annotation, which makes it a named preset rather than a
parameterised one, or you declare the attribute with `@AliasFor` pointing at the
target attribute. The failure without that wiring is silent: the annotation
applies, the attribute does not.

**★ The pseudocode shows `txManager.commit(status)` after your method returns. What
follows from the fact that the commit is a method call?**
That your method can complete successfully and the caller still gets an exception, from
code that is not yours. Several real failures live in that one line: the flush that JPA
defers to commit time can raise a constraint violation; a `DEFERRABLE INITIALLY
DEFERRED` constraint is evaluated there; and if anything inside the boundary marked the
transaction rollback-only, the commit turns into a rollback and throws
`UnexpectedRollbackException` — [chunk 9](09-marked-rollback-only.md). It also explains
a diagnostic that confuses people: the stack trace has no frame from your service
method, because that frame has already returned. When an exception's stack trace starts
inside the transaction interceptor rather than in your code, the commit is where to
look.

---

← Prev: [2 · The proxy](02-the-proxy.md) · Index: [Spring @Transactional](README.md) · Next → [2c · Visibility and interfaces](02c-visibility-and-the-interface-question.md)
