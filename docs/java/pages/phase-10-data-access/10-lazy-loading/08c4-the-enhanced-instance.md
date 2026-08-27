---
title: "Enhancement stops using proxies for non-polymorphic associations, which fixes instanceof and getClass and simultaneously blinds every tool that recognised laziness by looking for a HibernateProxy — including Jackson's Hibernate module"
sidebar_label: "08c4 · The enhanced instance"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `org.hibernate.Hibernate` class javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> the Hibernate ORM 7.4 *Introduction* §9.15 *Using the bytecode enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `7.4` branch source of `EnhancementAsProxyLazinessInterceptor` and `EnhancerImpl`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/bytecode/enhance/spi/interceptor/EnhancementAsProxyLazinessInterceptor.java)),
> and the `2.x` source of `Hibernate7Serializers`, `Hibernate7SerializerModifier` and
> `Hibernate7AnnotationIntrospector` in jackson-datatype-hibernate
> ([github.com/FasterXML/jackson-datatype-hibernate](https://github.com/FasterXML/jackson-datatype-hibernate/blob/2.x/hibernate7/src/main/java/com/fasterxml/jackson/datatype/hibernate7/Hibernate7Serializers.java)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**The first three chunks in this series were about one field. This one is about the object.
Enhancement does not only add attribute-level laziness — it changes the representation Hibernate
uses for lazy *associations* in the same module, and that is a change nobody asks for and almost
nobody anticipates. It makes `instanceof` and `getClass()` start behaving, which sounds like a
straight improvement, and in the same stroke it makes every tool that recognised an unfetched
association by testing for `HibernateProxy` stop recognising anything. Jackson's Hibernate module
is one of those tools.**

## An association under enhancement is not a proxy

The `org.hibernate.Hibernate` javadoc states both models side by side. Without enhancement:

> *"When bytecode enhancement is **not** used, an unfetched lazy association is represented by a
> *proxy object* which holds the identifier (foreign key) of the associated entity instance. …
> The proxy does not have the same concrete type as the proxied delegate, and so
> `getClass(Object)` must be used in place of `Object.getClass()`, and this method fetches the
> entity by side effect."*

With it:

> *"When bytecode enhancement **is** used, there is no such indirection, but the associated entity
> instance is initially in an unloaded state, with only its identifier field set.
> The identifier field of an unloaded entity instance is set when the unloaded instance is
> instantiated. The program may obtain the identifier of an unloaded entity, without triggering
> lazy loading, by accessing the field containing the identifier.
> The remaining non-lazy state of the entity instance is loaded lazily when any other field is
> accessed.
> **Typecasts, the Java `instanceof` operator, and `Object.getClass()` may be used as normal.**"*

The introduction says the same thing from the other side: *"interception lets us implement lazy
fetching for non-polymorphic associations without the need for a separate proxy object."*

So the object in the field is a real `Customer`, not a `Customer$HibernateProxy$xyz`. Every
workaround this topic documents for proxies changes status at once:

| | Unenhanced | Enhanced, non-polymorphic |
|---|---|---|
| `o instanceof Customer` | may be `false` on a proxy for a subclass; never throws | correct |
| `o.getClass()` | the generated subclass | `Customer` |
| `Hibernate.getClass(o)` | initialises by side effect | returns `o.getClass()` — no fetch, because there is no `LazyInitializer` to extract |
| `Hibernate.unproxy(o)` | throws if uninitialised and detached | returns `o` unchanged |
| Reading the identifier | free | free — the javadoc says the id field is set at instantiation |
| Reading any other field | fetches, or throws detached | fetches, or throws detached |
| `Hibernate.isInitialized(o)` | correct | correct — it also checks for `EnhancementAsProxyLazinessInterceptor` |

The last row is the one to hold onto: **`Hibernate.isInitialized` is the API that survives the
switch**, because its implementation asks two questions — is there a `LazyInitializer`, and is
there an `EnhancementAsProxyLazinessInterceptor` — rather than testing the runtime type. Anything
you wrote against `instanceof HibernateProxy` is testing the runtime type.

⚠️ The exception message from an unloaded enhanced instance is the same one
[08c](08c-when-enhancement-is-on.md) documents: `EnhancementAsProxyLazinessInterceptor.handleRead`
routes through `EnhancementHelper.performWork`, so touching a non-identifier field of an unloaded
enhanced association on a detached graph produces `Unable to perform requested lazy initialization
[Customer.name] - no session and settings disallow loading outside the Session` — not `Could not
initialize proxy`. **The message you get for a lazy `@ManyToOne` changes when you enable
enhancement**, which is a genuinely surprising thing to discover from a log.

## Except when the association is polymorphic

Both documents carve out the same exception, and the javadoc's wording is the blunter one:

> *"As an exception to the above rules, **polymorphic** associations always work as if bytecode
> enhancement was not enabled."*

The introduction gives the reason: *"if an association is polymorphic, that is, if the target
entity type has subclasses, then a proxy is still required"* — Hibernate cannot know the concrete
type before fetching, so it cannot instantiate the right class.

**This is the worst possible shape for a behavioural rule, because it is invisible at the call
site.** In one service class, `order.getCustomer()` is a real `Customer` and `order.getPayment()`
is a proxy, because somebody added a `CardPayment extends Payment` two years ago. `instanceof`
works on one and lies on the other. Adding the first subclass to an entity that previously had
none silently converts every lazy association pointing at it back to the proxy representation,
with no mapping change and no warning — and any `instanceof` you wrote while it was enhanced
starts returning `false`.

## Writing to an unloaded enhanced instance is not the same as writing a lazy attribute

[08c2](08c2-writes-and-checks.md) established that writing a lazy *attribute* never touches the
session. The unloaded *association* is a different interceptor with different rules, and
`EnhancementAsProxyLazinessInterceptor.handleWrite` has two special cases worth knowing:

- **Writing the identifier is rejected outright.** The source comment explains why the check is
  here rather than at flush: *"it is illegal for the identifier value to be changed. Normally
  Hibernate validates this during flush. However, here it's dangerous to just allow the new value
  to be set and continue on waiting for the flush for validation because this interceptor manages
  the entity's entry in the PC itself."* Setting it to a different value throws
  `HibernateException: identifier of an instance of com.acme.Customer was altered from 1 to 2` —
  a plain `HibernateException`, not a `LazyInitializationException`. Setting it to the *same*
  value is passed through.
- **Writing a collection attribute forces the instance to initialise first**, because the fetch
  group the attribute belongs to has to be loaded before the write can be applied. So a setter
  that looks like a pure assignment issues a `select` — and on a detached instance throws.

**So "writes are free" is true for lazy basic attributes and false for an unloaded enhanced
association.** Two different interceptors, two different contracts, one annotation family.

The rules for proxies remain what [01b · Type questions are fetches](01b-type-questions-are-fetches.md)
and [04c · What looks safe and is not](04c-what-looks-safe-and-is-not.md) say. **Keep writing code
that is correct for proxies**, because you cannot see from the call site which representation you
have.

## What this breaks: the Jackson Hibernate module

This is the concrete, checkable consequence, and it is the reason this chunk exists rather than
being a paragraph in [08c](08c-when-enhancement-is-on.md).

The module in [06c · Jackson and the Hibernate module](06c-jackson-and-the-hibernate-module.md)
finds things to special-case by type. `Hibernate7Serializers.findSerializer` is four lines of
logic:

```java
Class<?> raw = type.getRawClass();
if (HibernateProxy.class.isAssignableFrom(raw)) {
    return new Hibernate7ProxySerializer(_forceLoading, _serializeIdentifiers,
            _nullMissingEntities, _wrappedIdentifier, _mapping);
}
return null;
```

`Hibernate7SerializerModifier` adds `PersistentCollectionSerializer` for `CollectionType` and
`MapType`, and `Hibernate7AnnotationIntrospector` treats `jakarta.persistence.Transient` as an
ignore marker. **That is the module's entire surface: `HibernateProxy`, persistent collections,
and `@Transient`.** Two consequences follow directly.

**1 · The module has never protected lazy basic attributes.** A lazy `String` column is not a
`HibernateProxy` and not a collection; it is a `String` on a real object, reached through a getter
that the serialiser calls like any other. Registering the module does nothing for it. Serialising
an enhanced entity after the transaction closed throws `LazyInitializationException` from inside
the serialiser, exactly as [02b · Where it fires](02b-where-it-fires.md) describes — the module is
simply not in that path.

**2 · Enabling enhancement silently removes the module's cover from non-polymorphic
associations too.** They stop being `HibernateProxy` instances, so `findSerializer` returns
`null`, so Jackson uses the ordinary bean serialiser, so it calls the getters, so the fetch
happens or the exception is thrown. The `"customer": null` behaviour that the module was
registered to produce quietly stops happening — for exactly the associations enhancement
optimised, and not for the polymorphic ones, so it stops happening *inconsistently*.

If you have been relying on the module as a safety net, **enabling the enhancement plugin removes
most of the net and leaves the frame**. That is a strong argument for the position
[05 · The DTO boundary](05-the-dto-boundary.md) takes anyway: a serialisation-time workaround is
coupled to a representation detail that a build plugin can change.

## Gotchas

**★ Enabling enhancement changes the exception message for lazy *associations*, not just for
columns.** A non-polymorphic `@ManyToOne` stops being a proxy, so it fails through
`EnhancementHelper` with `Unable to perform requested lazy initialization [Entity.field]` instead
of `Could not initialize proxy [Entity#id]`. A team that has learned to recognise one string
suddenly stops recognising its own most common failure.

**★ The Jackson Hibernate module does nothing for lazy basic attributes.** Its serialiser lookup
tests for `HibernateProxy`, and its modifier covers collections and maps. A lazy `String` is
neither. If the module is registered as the answer to lazy-loading failures, enabling column
laziness produces failures it was never able to catch.

**★ Enabling enhancement removes the Jackson module's cover from non-polymorphic associations.**
They are no longer `HibernateProxy` instances, so `findSerializer` returns `null` and Jackson
serialises them as ordinary beans — calling the getters, and therefore fetching or throwing. This
is a behaviour change in the JSON your API emits, caused by a build plugin.

**★ Setting the identifier on an unloaded enhanced association throws a plain
`HibernateException`, not a `LazyInitializationException`.** `identifier of an instance of X was
altered from A to B`, raised at the moment of the write rather than at flush, because the
interceptor owns that instance's persistence-context entry. Setting it to the value it already has
is allowed.

**★ Whether an association is a proxy now depends on whether its target has subclasses.** Adding
the first subclass to an entity converts every lazy association pointing at it back to a proxy,
across the whole application, with no mapping change. Any `instanceof` written against the
enhanced behaviour starts returning `false`.

**★ Do not write "we have enhancement, so `instanceof` is safe" into a coding standard.** It is
true for exactly the associations whose targets have no subclasses today, and neither the call
site nor the type declaration tells you which those are. Keep using the proxy-safe idioms from
[01b](01b-type-questions-are-fetches.md).

**★ `Hibernate.isInitialized` is the check that survives both representations.** It tests for a
`LazyInitializer` *and* for an enhancement interceptor. `instanceof HibernateProxy` tests for one
of the two and silently answers `false` for the other.

**★ The enhanced class is not the class in your source, and reflective tooling sees the enhanced
one.** Extra fields, extra interfaces, rewritten accessors, possibly an added constructor. Any
tool that reflects over entities — a mapper, an equality helper, a schema generator, a serialiser
— sees that shape at runtime. Assertions about an entity's declared fields written from reading
the source will not match.

## Interview questions

**★ Does bytecode enhancement change how lazy *associations* work, or only lazy columns?**
Both. For non-polymorphic associations enhancement removes the proxy entirely: the javadoc says
the associated instance is a real instance of the entity class in an unloaded state with only the
identifier field set, and that typecasts, `instanceof` and `Object.getClass()` may be used as
normal. Polymorphic associations — where the target type has subclasses — are explicitly carved
out and *"always work as if bytecode enhancement was not enabled"*, because Hibernate cannot know
the concrete type without fetching. So one application can have both representations at once, and
the call site does not tell you which. The practical rule is to keep writing proxy-safe code, since
the safe idioms are also correct for the enhanced representation.

**★ Your team registered the Jackson Hibernate module to stop `LazyInitializationException` from
the serialiser. What happens when you enable enhancement?**
Most of the protection disappears without warning. The module recognises unfetched data by type:
its serialiser lookup tests for `HibernateProxy` and its bean-serialiser modifier wraps collection
and map serialisers. Under enhancement a non-polymorphic lazy association is no longer a
`HibernateProxy`, so the lookup returns null and Jackson falls back to the ordinary bean
serialiser, which calls the getters and therefore fetches or throws. Collections still work,
because a persistent collection is still a persistent collection, and polymorphic associations
still work, because they are still proxies. So the endpoint that returned `"customer": null`
yesterday throws today, and the one next to it does not. That inconsistency is the argument for
not making serialisation the place laziness is handled at all.

**★ Why does `Hibernate.isInitialized` keep working when `instanceof HibernateProxy` stops?**
Because it asks about state rather than about type. Its implementation extracts a `LazyInitializer`
if there is one and asks whether it is uninitialised; failing that, it checks whether the object is
attribute-interceptable and holds an `EnhancementAsProxyLazinessInterceptor` that reports itself
uninitialised; failing both, it answers `true`. That covers the proxy representation, the enhanced
representation and plain objects with one call. `instanceof HibernateProxy` covers exactly one of
the three and answers `false` — meaning "fully loaded" to most code that calls it — for the other
two.

**★ Under enhancement, do you still need `Hibernate.unproxy` and `Hibernate.getClass`?**
For non-polymorphic associations, no — and calling them is harmless rather than helpful. Both
begin by extracting a `LazyInitializer` from the argument; an enhanced unloaded instance is not a
`HibernateProxy`, so there is nothing to extract, and both fall through to returning the object or
its `getClass()` unchanged, with no fetch. So the calls become no-ops rather than errors. The
reason to keep them is the polymorphic case, which is still served by a proxy and where
`Object.getClass()` still returns a generated subclass and `instanceof` against a concrete subtype
still answers `false`. Since nothing at the call site distinguishes the two, the defensible
position is to keep using the proxy-safe idioms everywhere and treat enhancement as something that
makes them unnecessary in cases you cannot identify.

**Where the enhancer does and does not apply, and what happens to an enhanced instance that
leaves the JVM, continue in
[08c5 · Serialising an enhanced instance](08c5-serialising-an-enhanced-instance.md).**

{/* FOOTER */}
