---
title: "The enhancer's bookkeeping is transient, so a Java-serialisation round trip replaces the lazy-loading exception with a null — and the interfaces it adds are not transient, so an enhanced class does not hash to the same default serialVersionUID as the one you compiled yesterday"
sidebar_label: "08c5 · Serialising an enhanced instance"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `org.hibernate.Hibernate` class javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> the Hibernate ORM 7.4 *User Guide* §29.1 *Bytecode Enhancement*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §9.15
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `7.4` branch source of `EnhancerImpl`, `LazyAttributeLoadingInterceptor`,
> `org.hibernate.engine.spi.ManagedEntity` / `PersistentAttributeInterceptable` /
> `SelfDirtinessTracker`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/bytecode/enhance/internal/bytebuddy/EnhancerImpl.java)),
> the `java.io.Serializable` javadoc
> ([docs.oracle.com/en/java/javase/25/](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/Serializable.html))
> and the *Java Object Serialization Specification* §4.6 *Stream Unique Identifiers*
> ([docs.oracle.com/en/java/javase/25/docs/specs/serialization/](https://docs.oracle.com/en/java/javase/25/docs/specs/serialization/class.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**[08c4](08c4-the-enhanced-instance.md) was about what an enhanced instance is while it is in
memory. This chunk is about what happens to it when it leaves — through an `ObjectOutputStream`,
an HTTP session, a distributed cache or a message payload — and about the one boundary question
that decides whether any of this applies to a given class at all. The serialisation answer is
worse than the in-memory one, because the failure mode inverts: instead of throwing, the object
starts lying.**

## Two different kinds of transient, doing two different jobs

The members the enhancer adds are declared `private transient` **and** annotated with
`jakarta.persistence.Transient` — `EnhancerImpl` defines each field with a private-transient
modifier and attaches the annotation in the same call. The two are not redundant:

- **`@Transient`** keeps them out of the JPA metamodel, and out of anything that reads JPA
  annotations — including Jackson's `Hibernate7AnnotationIntrospector`, whose entire job is
  *"adds support for using `Transient` to denote ignorable fields"*.
- **`transient`** keeps them out of Java serialization.

None of them are JavaBean getters either. Every generated member is prefixed `$$_hibernate_`, so
`$$_hibernate_getInterceptor` is not `getInterceptor`, and bean-naming introspection does not
expose it as a property. The bookkeeping is invisible to your mapper and your serialiser by
design.

## The round trip that turns an exception into a wrong value

The `transient` modifier has a consequence the design did not intend for application code.
**The interceptor field *is* the loaded/not-loaded bookkeeping**, and `transient` means it does
not survive an `ObjectOutputStream`/`ObjectInputStream` round trip.

Put that next to the generated reader from [08c](08c-when-enhancement-is-on.md):

```java
String $$_hibernate_read_fullText() {
    if ( this.$$_hibernate_getInterceptor() != null ) {  // ← null after deserialisation
        …
    }
    return this.fullText;                                // ← null, because it was never fetched
}
```

After a round trip the guard is false, so the reader returns the raw field, and for an attribute
that was never fetched the raw field is `null` — or `0`, or `false`, for a primitive.
**`LazyInitializationException` is replaced by a value that is simply wrong.**

That is strictly worse than the exception, and it is the same objection
[06c · Jackson and the Hibernate module](06c-jackson-and-the-hibernate-module.md) raises against
serialising unfetched associations as `null`, arriving by a completely different route: a missing
field is a bug report, a null field is a rendering decision on the client.

Hibernate does have a supported serialisation path here and it is not this one.
`LazyAttributeLoadingInterceptor` carries explicit `serialize(ObjectOutputStream)` and
`deserialize(ObjectInputStream, EntityHolder, SharedSessionContractImplementor)` methods, which
write the set of initialised lazy field names and rebuild the interceptor **against a session**.
That machinery serialises a persistence context; it is not involved when application code writes a
lone detached entity to a stream.

Everything [04f · References that get stored](04f-references-that-get-stored.md) says about
putting entities in an HTTP session, a cache or a message applies here with the failure mode
changed from loud to silent.

## The `serialVersionUID` problem, which is a deployment problem

This one follows from putting two specifications side by side rather than from any single
sentence, and it is worth spelling out because it bites during a rollout rather than in a test.

The *Java Object Serialization Specification*, §4.6:

> *"The stream-unique identifier is a 64-bit hash of the class name, interface class names,
> methods, and fields."*

and, on what is included:

> *"The name of each interface sorted by name. For each field of the class sorted by field name
> (**except `private static` and `private transient` fields**) …"*

So the enhancer's added *fields* are excluded from the hash — they are `private transient`, which
is exactly the exclusion. But the enhancer also makes the class implement
`org.hibernate.engine.spi.ManagedEntity`, `PersistentAttributeInterceptable` and, with dirty
tracking, `SelfDirtinessTracker`, and it adds the public methods those interfaces require. **Both
interface names and methods are in the hash.**

`java.io.Serializable`'s javadoc states the consequence of a mismatch:

> *"If the receiver has loaded a class for the object that has a different `serialVersionUID` than
> that of the corresponding sender's class, then deserialization will result in an
> `InvalidClassException`."*

⚠️ I could not find a statement in the Hibernate documentation addressing this directly, so treat
the conclusion as a deduction from the two specifications rather than as documented behaviour: an
entity class with no explicit `serialVersionUID` should not be expected to have the same default
one before and after enhancement. Where that matters is a rolling deploy with session replication
or a shared serialised cache, where enhanced and unenhanced instances of "the same" class are
present at once.

The fix is the one the javadoc recommends for every serialisable class anyway:

> *"it is strongly recommended that all serializable classes other than enum types explicitly
> declare `serialVersionUID` values, since the default `serialVersionUID` computation is highly
> sensitive to class details that may vary depending on compiler implementations."*

An entity that is ever Java-serialised should declare `private static final long
serialVersionUID`. An entity that is never Java-serialised — which is the position this topic
argues for — does not have the problem at all.

## What the javadoc admits about amputated graphs

Two sentences from the `Hibernate` class javadoc frame the general problem, and they are worth
having because they are the documentation's own acknowledgement that this is awkward:

> *"Graphs of Hibernate entities obtained from a `Session` are usually in an amputated form, with
> associations and collections replaced by proxies and lazy collections. … These objects are fully
> serializable using Java serialization, but can cause discomfort when working with custom
> serialization libraries."*

and, on the two tools it provides for it — `Hibernate.createDetachedProxy(SessionFactory, Class,
Object)` and `CollectionInterface.createDetachedInstance()`:

> *"…intended for use by generic code that must materialize an 'amputated' graph of Hibernate
> entities. (For example, a library which deserializes entities from JSON.)"*

Note what those are for: rebuilding the amputated shape on the way *back in*. They are
framework-author APIs. Reaching for them in application code is a sign that an entity is being
used as a wire format, which is the mistake [05 · The DTO boundary](05-the-dto-boundary.md) is
about — and a DTO has none of the problems on this page, because there is nothing in it for the
enhancer to have rewritten.

## Where the enhancer does and does not apply

**Only annotated classes.** The user guide, §29.1: *"At the moment, only annotated classes are
supported for enhancement."* An entity mapped in `orm.xml` is not enhanced, so its lazy basic
mapping is ignored — in an application whose build file clearly applies the plugin, and alongside
sibling entities where it works.

**Only the module being compiled.** Enhancement is a build-time transformation of class files, so
entities compiled in a shared library and consumed as a jar are the unenhanced ones. Apply the
plugin where the entity classes are compiled, not where they are used —
[Topic 08 · 13c](../08-the-n-plus-1-problem/13c-bytecode-enhancement.md).

**It will add a constructor you did not write.** The introduction: *"use of the bytecode enhancer
relaxes the usual requirement that entity and embeddable classes have default constructors. If a
class annotated `@Entity`, `@MappedSuperclass`, or `@Embeddable` has no default constructor, the
bytecode enhancer will add it."* Convenient, and a dependency: an entity that only works because
the enhancer supplied its default constructor cannot be instantiated by Hibernate in any module or
build where the enhancer did not run, and the error will name the missing constructor rather than
the missing plugin.

## Gotchas

**★ Java-serialising a detached enhanced entity loses the loaded/not-loaded bookkeeping.** The
interceptor field is `transient` and the generated reader's guard is a null check on it, so after
a round trip an unfetched lazy attribute reads as `null` instead of throwing. A loud failure
becomes a quiet wrong value. Anything that puts entities in an HTTP session, a distributed cache
or a message payload ([04f](04f-references-that-get-stored.md)) is on this path.

**★ The wrong value is indistinguishable from a legitimate null.** A `String` column that was
never fetched and a `String` column that is genuinely `NULL` in the row deserialise identically.
There is no marker left in the object to tell them apart, because the marker was the interceptor.

**★ An entity with no explicit `serialVersionUID` is a rolling-deploy hazard once enhancement is
introduced.** The enhancer adds interfaces and public methods, and both go into the default hash;
only the added fields are excluded, because they are `private transient`. Declare
`serialVersionUID` explicitly on any entity that is ever serialised — or stop serialising
entities.

**★ `@Transient` and `transient` are both present and are not interchangeable.** One hides the
generated state from JPA and from annotation-driven serialisers; the other hides it from Java
serialization. Code that strips `@Transient` properties is not thereby safe for Java
serialization, and vice versa.

**★ An `orm.xml`-mapped entity is not enhanced at all.** The user guide says only annotated
classes are supported. The build file says the plugin is applied. Both statements are true at the
same time, which is why this one survives a long argument about the build.

**★ The default constructor the enhancer adds is a dependency, not a convenience.** An entity with
no no-arg constructor works in the enhanced module and fails to instantiate wherever the enhancer
did not run — and the error names the constructor, so nobody looks at the plugin.

**★ `Hibernate.createDetachedProxy` is not an application API.** Its javadoc scopes it to generic
code materialising an amputated graph, such as a library deserialising entities from JSON. If you
are calling it from a service, the design question is why entities are crossing that boundary at
all.

## Interview questions

**★ What happens if you Java-serialise a detached enhanced entity and read it back?**
The state that was loaded survives; the bookkeeping about what was *not* loaded does not. The
interceptor is held in a field the enhancer declares `private transient`, so it is absent after
deserialisation, and the generated field reader is guarded by a null check on exactly that field.
An attribute that was never fetched therefore reads as whatever is in the raw field — `null`, or
zero for a primitive — instead of throwing. That converts a loud, diagnosable failure into a
silently wrong value, which is strictly worse, and it applies to anything that round-trips entities
through storage: an HTTP session, a distributed cache, a message payload. Hibernate does have
supported serialisation for the persistence context itself, with explicit interceptor
serialise/deserialise logic that reattaches to a session, but that is not what happens when
application code serialises a lone entity.

**★ Could enabling enhancement break session replication during a rolling deploy?**
It plausibly can, and the mechanism is `serialVersionUID` rather than anything Hibernate-specific.
The serialization specification computes the default identifier from the class name, the interface
names, the methods and the non-`private transient` fields. The enhancer's added fields are
`private transient` and so are excluded, but it also makes the class implement `ManagedEntity`,
`PersistentAttributeInterceptable` and `SelfDirtinessTracker`, and adds the public methods those
require — and interfaces and methods are both in the hash. So an enhanced and an unenhanced build
of the same source class should not be assumed to agree on a default `serialVersionUID`, and a
mismatch is an `InvalidClassException` on deserialisation. I have not seen this addressed in
Hibernate's documentation, so I would treat it as a risk to test rather than a certainty — and the
mitigation is the one the `Serializable` javadoc recommends for every serialisable class anyway:
declare the value explicitly.

**★ You applied the plugin, the build is green, and one entity's lazy column is still eager. What
is left to check once you have ruled out the Gradle brace trap and the module boundary?**
Whether that entity is mapped by annotations at all. The user guide says only annotated classes are
supported for enhancement, so an entity declared in `orm.xml` is skipped even in a module where the
plugin ran and every other entity was rewritten. After that, whether something reads the attribute
unconditionally — a `@PostLoad`, a `toString` on a log path, an `equals` over all fields
([08c3](08c3-the-entitys-own-methods.md)) — and whether another attribute in the same default lazy
group is being read instead ([08b](08b-the-lob-reflex-and-the-group.md)).

**★ An entity has no no-arg constructor and the application starts fine. Should you add one?**
Yes, unless you are certain the enhancer runs everywhere that class is loaded. The introduction says
the enhancer relaxes the default-constructor requirement and will add the constructor itself for a
class annotated `@Entity`, `@MappedSuperclass` or `@Embeddable` that lacks one. That means the class
compiles and runs in the enhanced module and fails to be instantiated anywhere the plugin did not
run — a second module, a test source set configured differently, a shared jar. The failure names a
missing constructor, so nobody connects it to the build plugin. Writing the constructor costs one
line and removes a dependency on a build step.

**★ Does any of this apply if the service returns DTOs?**
Almost none of it. A DTO is not an entity, so the enhancer never touched it: no interceptor, no
added interfaces, no rewritten field access, no `serialVersionUID` shift, nothing that can be
`null` because it was not fetched. Every value in it was read inside the transaction that produced
it. That is the same conclusion [05](05-the-dto-boundary.md) reaches for associations, and it is
the reason this whole `08c` series reads as a list of costs rather than a list of features: the
costs land on codebases that let entities leave the transaction, and enhancement is a genuine
optimisation for the write paths that keep them inside it.

{/* FOOTER */}
