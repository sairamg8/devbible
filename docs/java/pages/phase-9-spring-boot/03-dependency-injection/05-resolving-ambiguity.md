---
title: "Resolving ambiguity: narrowing the type match"
sidebar_label: "5 · Resolving ambiguity"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Fine-tuning
> Annotation-based Autowiring with Qualifiers*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html
> — narrowing semantics, and the bean-name fallback with its `-parameters`
> requirement since 6.1 and the 6.2 shortcut resolution), *Using Generics as
> Autowiring Qualifiers*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/generics-as-qualifiers.html
> — the `Store<String>` / `Store<Integer>` example and generic filtering of
> collections) and *Using `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — the `@Resource` name-based vs `@Autowired` type-based comparison). Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Autowiring is matching by *type*, and the moment two beans satisfy one type
the container refuses to guess. This chunk is about narrowing that match *at the
injection point* — and the most important thing to understand is that a qualifier
is **not** a bean id. The reference is unambiguous: qualifier values *"always
have narrowing semantics within the set of type matches. They do not
semantically express a reference to a unique bean `id`."* Once you read
`@Qualifier` as a filter rather than a name, the collection behaviour stops
being surprising. And before any annotation, check the mechanism people forget:
if the two beans differ by a generic type argument, the type system has already
narrowed the match for you and the compiler is checking it.**

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
`@Qualifier` when the choice matters.## The qualifier you already wrote: the generic type

Before reaching for any annotation, check whether the type system has already
said what you mean. The reference treats **generic type arguments as an implicit
form of qualification** — no `@Qualifier`, no bean names, no configuration:

```java
class StringStore  implements Store<String>  { }
class IntegerStore implements Store<Integer> { }

@Configuration
class StoreConfig {
    @Bean Store<String>  stringStore()  { return new StringStore(); }
    @Bean Store<Integer> integerStore() { return new IntegerStore(); }
}
```

```java
@Autowired Store<String>  s1;   // <String>  qualifies — injects stringStore
@Autowired Store<Integer> s2;   // <Integer> qualifies — injects integerStore
```

Two beans of the raw type `Store` exist, and neither injection point is
ambiguous, because the type arguments differ. This is the single cleanest way to
resolve ambiguity when it applies, for the reason that runs through this whole
topic: **the compiler checks it.** A `@Qualifier("stringStore")` is a string
that nothing verifies; `Store<String>` is a type that fails the build when you
get it wrong.

It filters collections the same way:

```java
@Autowired List<Store<Integer>> integerStores;   // Store<String> beans are excluded
```

The filtering is automatic. There is no annotation to forget and no name to keep
in sync.

**Where it applies and where it does not.** It only helps when the axis you are
choosing along is genuinely expressible as a type parameter —
`EventHandler<OrderPlaced>` versus `EventHandler<OrderShipped>`,
`Validator<Invoice>` versus `Validator<Customer>`, a repository per aggregate.
It does nothing for two beans of the *same* parameterisation: two
`PaymentGateway` implementations are both `PaymentGateway`, and no generic
signature distinguishes Stripe from Adyen because the difference is not a type
difference. That is what the rest of this chunk, and the next one, are for.

⚠️ **This depends on the generic information being reachable.** Spring resolves
it from the declared type of the `@Bean` method or the class's implemented
interface. Declare the method as `Store<String> stringStore()`, not
`StringStore stringStore()` returning a raw-typed variable, and never widen the
declaration to raw `Store` — the moment the type argument is erased from the
*declaration*, the implicit qualifier goes with it and you are back to an
ambiguity error that looks inexplicable.

## Gotchas

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
qualifier ([next chunk](06-primary-fallback-and-custom-qualifiers.md)), or accept
plurality and inject `List<PaymentGateway>`
([chunk 7](07-collections-and-ordering.md))

**Symptom:** `Store<String>` and `Store<Integer>` beans resolve fine from a
`@Configuration` class but become ambiguous after a refactor that "simplified" the
`@Bean` method signatures
**Cause:** the `@Bean` method return type was narrowed to the concrete class or widened
to the raw type, and the generic argument is no longer visible on the declaration
**Fix:** declare `@Bean` methods with the parameterised interface type —
`Store<String> stringStore()` — because that declaration *is* the qualifier

**Symptom:** a `@Qualifier` is added to fix ambiguity between two handlers that
differ only in the event they handle
**Cause:** the difference was a type difference all along and was being expressed as
a string instead
**Fix:** parameterise — `EventHandler<OrderPlaced>` — and delete the qualifier; the
compiler now enforces what the string was asserting

**Symptom:** two beans differ only by qualifier and every consumer names one, so the
qualifier strings are duplicated across a dozen files
**Cause:** the choice is per-consumer and expressed with an untyped literal
**Fix:** a custom qualifier annotation with an enum attribute
([next chunk](06-primary-fallback-and-custom-qualifiers.md)) — one place to rename,
and the compiler follows

## Interview questions

**★ Is `@Qualifier("stripeGateway")` naming a bean?**
No, and the reference is explicit about it: qualifier values have narrowing
semantics within the set of type matches and *"do not semantically express a
reference to a unique bean id."* A bean's name merely acts as a fallback
qualifier value, which is why using the bean name usually works. The practical
consequence is that a qualifier can match several beans — on a single-valued
injection point that is still an ambiguity error, and on a collection injection
point it is a filter that returns all of them.

**★ Two beans implement `Store<T>` with different type arguments. Do you need a qualifier?**
No. Generic type arguments are an implicit qualifier: `Store<String>` resolves to
the `Store<String>` bean and `Store<Integer>` to the other, with no annotation at
all. It is the best available answer when it applies, because it is the only
narrowing mechanism the compiler checks — a wrong type argument is a build
failure, whereas a wrong qualifier string is a runtime one. It also filters
collections, so `List<Store<Integer>>` excludes the `String` stores
automatically.

**★ When does the generic-qualifier mechanism stop helping?**
When the distinction is not a type distinction. Two `PaymentGateway`
implementations are both exactly `PaymentGateway`; Stripe and Adyen differ by
vendor, not by type parameter, so there is no signature that separates them and
you need `@Primary`, a qualifier, or plurality. The mechanism also disappears if
the generic argument is erased from the *declaration* — a `@Bean` method declared
as raw `Store` or as the concrete `StringStore` no longer advertises the type
argument Spring matches on.

**★ Why does the bean-name fallback break in one build and not another?**
Because it needs the parameter name to still exist in the bytecode. Since
Framework 6.1 that requires the `-parameters` compiler flag, which Spring Boot's
Maven and Gradle plugins add for you and a hand-rolled build may not. The failure
mode is unpleasant: it does not fall back to something reasonable, it falls back
to ambiguity, so the application starts in one environment and fails at startup in
another with an error that points at the injection point rather than at the
compiler configuration. Framework 6.2 also added a fast shortcut when the
parameter name matches a bean name — a performance detail, but it underlines that
this is a supported mechanism rather than an accident. Depend on it for
convenience, never for correctness.

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

**★ Rank the ways of narrowing a type match, best first, and say why.**
Generic type arguments, because the compiler enforces them. Then a custom
`@Qualifier`-meta-annotated annotation with an enum attribute, because it is
compiler-checked and refactorable even though the matching itself is at runtime.
Then a string `@Qualifier`, which works and is honest about intent but is checked
by nothing. Then `@Primary`, which is not really narrowing at all — it is picking
a default for everybody, and it is the right tool only when there genuinely is a
default. Last, the bean-name fallback, which is implicit, invisible at the
injection point and dependent on a compiler flag.

---

← Prev: [Why field injection is flagged](04-field-injection.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [`@Primary`, `@Fallback` and custom qualifiers](06-primary-fallback-and-custom-qualifiers.md)
