---
title: "Resolving ambiguity: qualifiers, primary, collections"
sidebar_label: "5 · Resolving ambiguity"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Fine-tuning
> Annotation-based Autowiring with Qualifiers*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html
> — narrowing semantics, the bean-name fallback and its `-parameters` requirement
> since 6.1, custom qualifier annotations, qualifiers as filtering criteria on
> collections, and `@Primary`/`@Fallback`) and *Using `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — array/`Set`/`List`/`Map` injection, and the `@Resource` name-based vs `@Autowired` type-based comparison, `@Order`/`Ordered`/`@Priority` ordering, and
> the note that `@Order` on a `@Configuration` class does not propagate to its
> `@Bean` methods). `@Fallback` was introduced in Framework 6.2. Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Autowiring is matching by *type*, and the moment two beans satisfy one type
the container refuses to guess. Everything in this chunk is a way of narrowing
that match — and the most important thing to understand is that a qualifier is
**not** a bean id. The reference is unambiguous: qualifier values *"always have
narrowing semantics within the set of type matches. They do not semantically
express a reference to a unique bean `id`."* Once you read `@Qualifier` as a
filter rather than a name, the collection behaviour stops being surprising.**

## The failure you are resolving

```java
@Configuration
class PaymentConfig {
    @Bean PaymentGateway stripeGateway()   { return new StripeGateway(); }
    @Bean PaymentGateway adyenGateway()    { return new AdyenGateway(); }
}

@Service
class CheckoutService {
    CheckoutService(PaymentGateway gateway) { /* which one? */ }
}
```

Two candidates for one injection point. The container throws
`NoUniqueBeanDefinitionException` at startup, naming the type and listing the
candidates. This is the wiring-mistakes-are-startup-failures property from
chunk 1 doing its job — the alternative would be a coin flip that ships.

There are four ways out, and they are not interchangeable.

## `@Qualifier` — narrowing at the injection point

```java
@Service
class CheckoutService {
    private final PaymentGateway gateway;

    CheckoutService(@Qualifier("stripeGateway") PaymentGateway gateway) {
        this.gateway = gateway;
    }
}
```

On a field it goes alongside `@Autowired`; on a constructor or method parameter
it goes on the parameter, which is the form you want, since that is where
constructor injection puts things.

`@Qualifier` names a *qualifier value*, and a bean's name is used as a fallback
qualifier value — which is why `"stripeGateway"` works above. But the semantics
stay narrowing: if three beans carry the qualifier `"regional"`, then
`@Qualifier("regional")` on a single-valued injection point is still ambiguous,
and on a `List` injection point it means *all three*.

## The bean-name fallback with no annotation at all

The docs describe a resolution step people rely on without realising:

> *"If there is no other resolution indicator... Spring matches the injection
> point name (that is, the field name or parameter name) against the target
> bean names and chooses the same-named candidate, if any."*

```java
// no @Qualifier — the PARAMETER NAME does the narrowing
CheckoutService(PaymentGateway adyenGateway) { ... }
```

⚠️ **Since Framework 6.1 this requires the `-parameters` compiler flag**, because
without it parameter names are not in the bytecode. Spring Boot's Maven and
Gradle plugins configure `-parameters` for you, so it works in a Boot project
and breaks in a plain one — and it breaks by falling back to ambiguity, i.e. a
startup failure in an environment that compiles differently. It is a real
mechanism but a fragile thing to depend on deliberately; prefer the explicit
`@Qualifier` when the choice matters.

## `@Primary` — a default chosen at the definition

```java
@Configuration
class PaymentConfig {
    @Bean @Primary PaymentGateway stripeGateway() { return new StripeGateway(); }
    @Bean          PaymentGateway adyenGateway()  { return new AdyenGateway(); }
}
```

Now an unqualified `PaymentGateway` injection point gets Stripe, and anyone
wanting Adyen asks by qualifier. The difference from `@Qualifier` is *where the
decision lives*: `@Primary` decides once at the definition for every consumer,
`@Qualifier` decides per injection point. Use `@Primary` when there is a real
default and the exceptions are few; use qualifiers when every consumer has an
opinion.

## `@Fallback` — the inverse, since Framework 6.2

`@Fallback` marks a bean as the one to use *only when nothing else matches*:

```java
@Bean @Fallback PaymentGateway noopGateway() { return new NoopGateway(); }
```

It is the natural fit for auto-configuration and for library defaults: ship a
`@Fallback` implementation, and the moment an application defines its own, the
application's wins without anyone marking anything `@Primary`. The docs group
the two together — *"`@Primary` and `@Fallback` are effective ways to use
autowiring by type with several instances when one primary (or non-fallback)
candidate can be determined."*

Think of it as: `@Primary` says "prefer me"; `@Fallback` says "prefer anyone
else".

## Custom qualifier annotations

A string qualifier is untyped and untypo-checked. The reference shows the
alternative: a meta-annotated annotation.

```java
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier
public @interface Gateway {
    Provider value();
    enum Provider { STRIPE, ADYEN }
}
```

```java
@Bean @Gateway(STRIPE) PaymentGateway stripeGateway() { ... }

CheckoutService(@Gateway(STRIPE) PaymentGateway gateway) { ... }
```

Now the compiler checks it, the IDE completes it, and renaming is a refactor
rather than a search. The docs also show qualifiers with **several attributes**
(`@MovieQualifier(format=Format.VHS, genre="Action")`), and matching then
requires all attributes to agree — useful when the axis of choice is genuinely
two-dimensional.

## Gotchas

**Symptom:** `NoUniqueBeanDefinitionException` appears the moment a second
implementation is added, in a codebase that worked for a year
**Cause:** the single-candidate case never needed narrowing, so nothing declared the
intent; adding a bean of the same type made the existing injection point ambiguous
**Fix:** decide deliberately — `@Primary` if one is genuinely the default,
`@Qualifier` at each site if not. Do not delete the second bean to make it go away

**Symptom:** injection by parameter name works locally and fails in another build
**Cause:** the bean-name fallback needs parameter names in the bytecode, which since
Framework 6.1 requires the `-parameters` compiler flag; Boot's build plugins add it
and a plain build may not
**Fix:** add `-parameters` to the compiler configuration, and prefer an explicit
`@Qualifier` where the choice is load-bearing rather than depending on a name

**Symptom:** `@Qualifier("regional")` on a single `PaymentGateway` still throws
ambiguity even though the qualifier looks "specific"
**Cause:** qualifiers narrow, they do not name — three beans can share one qualifier
value, and the docs say qualifiers do not have to be unique
**Fix:** narrow further with a distinct qualifier value or a multi-attribute custom
qualifier, or accept plurality and inject `List<PaymentGateway>`
([next chunk](06-collections-and-ordering.md))

**Symptom:** a library's default implementation is silently used even though the
application defined its own
**Cause:** the library marked its default `@Primary`, which outranks an unmarked
application bean
**Fix:** the library should mark it `@Fallback` (Framework 6.2+) instead, which means
"prefer anyone else" and lets an application override by simply existing

**Symptom:** a string qualifier is renamed on the bean but not at one injection point,
and the failure only shows up in the environment that activates that configuration
**Cause:** string qualifiers are not checked by anything at compile time
**Fix:** use a custom `@Qualifier`-meta-annotated annotation with an enum attribute, so
renaming is a refactor the compiler follows

## Interview questions

**★ Is `@Qualifier("stripeGateway")` naming a bean?**
No, and the reference is explicit about it: qualifier values have narrowing
semantics within the set of type matches and *"do not semantically express a
reference to a unique bean id."* A bean's name merely acts as a fallback
qualifier value, which is why using the bean name usually works. The practical
consequence is that a qualifier can match several beans — on a single-valued
injection point that is still an ambiguity error, and on a collection injection
point it is a filter that returns all of them.

**★ `@Primary` versus `@Qualifier` — how do you choose?**
By where the decision belongs. `@Primary` is declared once at the bean
definition and applies to every unqualified consumer, so it fits the case where
one implementation genuinely is the default and exceptions are rare.
`@Qualifier` is declared at each injection point, so it fits the case where
consumers legitimately differ and no default is honest. Using `@Primary` to
silence an ambiguity you have not thought about is how the wrong gateway ends up
in production.

**★ What is `@Fallback` for, and how does it relate to `@Primary`?**
`@Fallback`, added in Framework 6.2, marks a bean as the one to use only when no
non-fallback candidate exists — effectively "prefer anyone else", the inverse of
`@Primary`'s "prefer me". It is aimed squarely at libraries and
auto-configuration: ship a fallback implementation and an application overrides
it just by defining its own bean, with no `@Primary` needed and no ambiguity
error in between. The docs pair the two as the ways to make type-based
autowiring work when several instances exist.

**★ Why would you write a custom qualifier annotation instead of a string?**
Because a string qualifier is untyped: a typo is a startup failure at best and a
silent wrong match at worst, refactoring is a text search, and nothing completes
it in the IDE. A `@Qualifier`-meta-annotated annotation with an enum attribute is
compiler-checked and refactorable. The docs also support multi-attribute
qualifiers, where all attributes must match — worth using when the choice is
genuinely two-dimensional, like provider plus region.

**★ `@Resource` versus `@Autowired` — do they resolve the same way?**
No, and the reference draws the line sharply. `@Resource` is *"semantically
defined to identify a specific target component by its unique name, with the
declared type being irrelevant for the matching process"* — it is name-based.
`@Autowired` selects candidates **by type** first and only then applies a
qualifier value within that type-matched set. There is also a scope difference
that decides the practical answer: `@Autowired` works on fields, constructors
and multi-argument methods, whereas `@Resource` is supported only on fields and
single-argument setters. Since constructor injection is the default, the docs'
own conclusion applies — *"stick with qualifiers if your injection target is a
constructor or a multi-argument method."*

**★ What happens if you resolve ambiguity by just deleting one of the beans?**
You have answered the container's question by removing the capability, which is
only correct if the second implementation was genuinely dead. The ambiguity error
is information: it says two things now satisfy one type and nobody has said which
consumers want which. The useful responses are `@Primary`, a qualifier per site,
or — often the best one — recognising that the consumer wants *all* of them and
should be injecting a collection.

---

← Prev: [Why field injection is flagged](04-field-injection.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Collections, ordering and self-injection](06-collections-and-ordering.md)
