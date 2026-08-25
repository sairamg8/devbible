---
title: "A class-level @Transactional flows down to subclasses and never up to ancestors — which is why moving a method to a base class silently removes its transaction"
sidebar_label: "2d · The inheritance rule"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Core → AOP → Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 2b](02b-where-the-annotation-lives.md) established that the interceptor asks
for a transaction attribute per method, per call. This chunk is the single rule about
that lookup that most often produces an untransactional method in real code, and it is
the opposite of what almost everyone assumes: a class-level annotation is a default for
the methods the class *declares* and for its subclasses. It does not reach up to
methods the class merely inherited.**

## The inheritance rule that surprises everyone

> *"Note that a class-level annotation does not apply to ancestor classes up the
> class hierarchy; in such a scenario, inherited methods need to be locally
> redeclared in order to participate in a subclass-level annotation."*

Read that twice, because it is the opposite of the intuition. A class-level
annotation is a default for the methods **declared in that class** and for its
**subclasses** — it does not reach *upward* to methods your class merely
inherited.

```java
public abstract class BaseRepository {
    public void save(Entity e) { ... }        // declared HERE, no annotation
}

@Repository
@Transactional                                 // does NOT cover the inherited save()
public class OrderRepository extends BaseRepository {
    public void archive(long id) { ... }       // covered
}
```

`orderRepository.archive(id)` is transactional. `orderRepository.save(e)` is
**not**, because `save` is declared on `BaseRepository`, which carries no
annotation. The fix the reference names is to redeclare it:

```java
@Repository
@Transactional
public class OrderRepository extends BaseRepository {
    @Override
    public void save(Entity e) { super.save(e); }   // now locally declared → covered
}
```

## Gotchas

**⚠️ Expecting a subclass annotation to cover inherited methods**
**Symptom:** a base-class `save()` runs without a transaction even though the
subclass is annotated at class level, and rows from a failed batch survive.
**Cause:** class-level annotations do not apply to ancestor classes.
**Fix:** redeclare (override) the method in the subclass, or annotate the base
class.

**⚠️ `@Transactional` on an abstract method**
**Symptom:** nothing is advised.
**Cause:** the attribute lookup uses the invoked method and the *target class*;
the implementation in the concrete class is what runs, and it carries no
annotation of its own unless the class-level default covers it.
**Fix:** annotate the concrete class or the overriding method.

**⚠️ Moving a method to a base class during a refactor**
**Symptom:** a transaction that worked last release does not this release, with
no code change to the method itself.
**Cause:** the method moved out of the annotated class and into an ancestor; the
lookup now finds nothing.
**Fix:** annotate the base class, or redeclare the method. This is the single
most common way the ancestor rule bites in practice — nobody deletes an
annotation, they move a method.

**⚠️ A bridge method from generics**
**Symptom:** a `@Transactional` override of a generic base method behaves
inconsistently.
**Cause:** the compiler generates a synthetic *bridge* method for the erased
signature, and the invoked method may be the bridge rather than your override.
Spring resolves bridges back to the declaring method, but only because it is
given the target class — which is why the lookup takes both.
**Fix:** nothing to do in normal code; know the mechanism so that a stack trace
containing a method you did not write does not send you down the wrong path.

## Interview questions

**★ A class is annotated `@Transactional` and extends a base class with a `save`
method. Is `save` transactional?**
No, and this is the inheritance rule people get backwards. A class-level
annotation is a default for methods declared in that class and for its
subclasses; the reference states that it "does not apply to ancestor classes up
the class hierarchy". `save` is declared on the ancestor, which carries no
annotation, so the attribute lookup finds nothing and the call passes straight
through the interceptor. The documented fix is to redeclare the inherited method
locally — an `@Override` that delegates to `super` is enough — or to annotate the
base class itself. It is worth knowing because template-method base repositories
are exactly where this shape occurs.

**★ Is `@Transactional` an `@Inherited` annotation? Does a subclass of an annotated
class get the boundary?**
The annotation is not meta-annotated `@Inherited` in the JDK sense, and it does not
need to be, because Spring's attribute source walks the hierarchy itself. The reference
describes a class-level annotation as a default "for all methods of the declaring class
(as well as its subclasses)", so a subclass of an annotated class does get the boundary
for the methods it declares — without anything being annotated on the subclass. What
does *not* happen is the reverse direction: the same paragraph says a class-level
annotation "does not apply to ancestor classes up the class hierarchy". So the rule is
directional and easy to state once you see it that way — a class-level annotation flows
**down** to subclasses and **never up** to the ancestors whose methods you inherited.
Getting the direction backwards is what produces the untransactional base-class `save`.

**★ Why not just annotate the abstract base class and be done with it?**
It works, and it is the other fix the reference implies, but understand what you have
bought. A class-level `@Transactional` on the base is a default for every method the
base declares *and* for every subclass — so every repository extending it becomes
transactional everywhere, including the trivial reads and the methods you had
deliberately left outside a boundary. In a template-method hierarchy that is often
five or six classes you did not review. Redeclaring the one method in the subclass is
narrower and visible at the place it applies; annotating the base is a decision about
a whole hierarchy and should be made as one. If the base genuinely is "every method
here is a unit of work", annotate it.

**★ Can you put `@Transactional` on an abstract method and have the override pick it
up?**
No, and the reason is a JDK rule rather than a Spring one. `@Inherited` — the only
mechanism by which an annotation flows down a hierarchy at all — is documented to have
"no effect if the annotated type is used to annotate anything other than a class", so
annotations on *methods* are never inherited by overrides, in any framework. The
attribute lookup resolves the most specific method for the target class, which is the
concrete override, and that method carries nothing. What can still save you is the
class-level default on the concrete class, which is a different rule doing a different
job. The reliable placement is on the concrete method or the concrete class.

**★ A stack trace in a generic repository hierarchy shows a method signature you never
wrote. What is it, and does it affect the transaction?**
A bridge method. When a class overrides a generic superclass method with a narrowed
type — `save(Order)` overriding `save(T)` — javac generates a synthetic method with the
erased signature that casts and delegates, so that virtual dispatch still works through
the raw type. That synthetic method is what appears in the trace, and it is also what
can be the *invoked* method at the proxy. It does not affect the transaction, because
Spring resolves the bridge back to the method that actually declares the metadata —
which is one of the reasons the attribute lookup is given the target class as well as
the method. The practical value of knowing this is purely diagnostic: a frame for a
method that is not in your source is not evidence of anything being wrong.

---

← Prev: [2c · Visibility and interfaces](02c-visibility-and-the-interface-question.md) · Index: [Spring @Transactional](README.md) · Next → [3 · The self-invocation trap](03-the-self-invocation-trap.md)
