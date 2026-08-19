---
title: "`@Primary`, `@Fallback` and custom qualifiers"
sidebar_label: "6 · Primary, fallback, custom qualifiers"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Fine-tuning
> Annotation-based Autowiring with Qualifiers*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html
> — custom qualifier annotations, multi-attribute qualifiers, and the pairing of
> `@Primary` and `@Fallback`) and *Using `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — the note that `jakarta.annotation.Priority` cannot be declared on `@Bean`
> methods and that its semantics are modelled with `@Order` plus `@Primary` or
> `@Fallback`). `@Fallback` was introduced in Framework 6.2. Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**The previous chunk narrowed the match at each injection point. This one moves
the decision to the *definition*: one bean declares itself the default and every
unqualified consumer gets it. That is a different kind of choice, and it is the
one that goes wrong quietly — `@Primary` added to silence an ambiguity error is
how the wrong payment gateway reaches production, because the error was the last
thing that was going to ask you which one you meant. The rule that keeps it
honest: `@Primary` is for when there genuinely is a default, `@Fallback` is for
when you are the library and the application should win, and a custom qualifier
annotation is for when neither is true and you want the compiler to check the
choice.**

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

The cost is that the decision becomes invisible at the place it takes effect. A
constructor parameter of type `PaymentGateway` tells the reader nothing about
which implementation arrives; you have to go and find the `@Primary`. That is an
acceptable trade when the default is genuinely uncontroversial and a bad one
when it is a business choice.

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

**Why this annotation had to exist.** Before it, a library that wanted to provide
an overridable default had two bad options. Mark it `@Primary`, and an
application defining its own bean gets the *library's* — its override is silently
ignored, which is the worse failure because nothing breaks. Mark it nothing, and
an application defining its own gets an ambiguity error at startup and has to
annotate its own bean `@Primary` to fix a problem it did not create.
`@Fallback` makes "define your own and it just wins" the behaviour, which is what
every user expected all along.

## What about `jakarta.annotation.Priority`?

`@Priority` participates in ordering, and it is tempting to reach for it as a
third way of picking a winner. Two limits are worth knowing before you do.

First, the reference states plainly that it **cannot be used on `@Bean`
methods**: *"the standard `jakarta.annotation.Priority` annotation is not
available at the `@Bean` level, since it cannot be declared on methods."* It is
a type-level annotation, so it only reaches beans declared by component scanning.

Second, the docs give the replacement rather than a workaround: *"its semantics
can be modeled through `@Order` values in combination with `@Primary` or
`@Fallback` on a single bean for each type."* In other words, the ordering half
is `@Order`'s job and the winner-selection half is `@Primary`/`@Fallback`'s job,
and the framework would rather you said the two things separately. Ordering of
injected collections is the next chunk's subject.

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
two-dimensional, like provider plus region.

Note what is and is not checked. The compiler verifies that `STRIPE` is a member
of the enum, so a typo is a build error rather than a startup one. It does **not**
verify that a bean carrying `@Gateway(STRIPE)` exists — that is still resolved at
startup, and a missing one is still a startup failure. The gain is real but it is
about the *value*, not about the wiring.

## The trade-off

Every mechanism here buys convenience at the cost of locality. `@Primary` means
a consumer's declaration no longer tells you what it receives. `@Fallback` means
the winner depends on what else is on the classpath, which is exactly right for
a library and disorienting inside one application. Custom qualifiers cost a file
and some ceremony, and pay it back only when the same choice is made in several
places or the values are easy to get wrong.

The honest default for application code is: prefer a distinguishing generic type
if one exists ([previous chunk](05-resolving-ambiguity.md)); otherwise
`@Qualifier` at the injection points, promoted to a custom annotation once the
string appears in more than two or three files; `@Primary` only when a default is
genuinely uncontroversial; and `@Fallback` when you are writing something other
people will extend.

## Gotchas

**Symptom:** `NoUniqueBeanDefinitionException` appears the moment a second
implementation is added, in a codebase that worked for a year
**Cause:** the single-candidate case never needed narrowing, so nothing declared the
intent; adding a bean of the same type made the existing injection point ambiguous
**Fix:** decide deliberately — `@Primary` if one is genuinely the default,
`@Qualifier` at each site if not. Do not delete the second bean to make it go away

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

**Symptom:** two beans are both marked `@Primary` and startup fails
**Cause:** `@Primary` selects *one* winner; two of them is the same ambiguity the
annotation was meant to resolve, now stated twice
**Fix:** exactly one `@Primary` per type. If two candidates both feel like defaults,
they are not defaults — qualify at the injection points instead

**Symptom:** `@Primary` is added to fix a startup failure and the application runs,
but a downstream feature starts using the wrong implementation
**Cause:** `@Primary` answers the container's question for *every* unqualified
consumer, including ones you were not thinking about
**Fix:** treat an ambiguity error as a question about each consumer, not about the
bean definitions. Qualify the sites you know about before declaring a global default

**Symptom:** `@Priority` is added to a `@Bean` method and the compiler rejects it
**Cause:** documented — `@Priority` cannot be declared on methods, so it is unavailable
at the `@Bean` level
**Fix:** use `@Order` for the ordering intent and `@Primary` or `@Fallback` for the
selection intent, which is the substitution the reference itself prescribes

**Symptom:** a custom qualifier annotation compiles and the application still fails
with no matching bean
**Cause:** the compiler checked the enum value, not the existence of a bean carrying it
**Fix:** remember the annotation buys compile-time checking of the *value* only; the
wiring is still resolved at startup, so a renamed or removed bean fails there

## Interview questions

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

**★ Before `@Fallback` existed, what did a library have to do, and why was it bad?**
Either mark its default `@Primary`, in which case an application defining its own
bean silently kept getting the library's — an override that fails without any
error at all, which is the worst kind. Or mark nothing, in which case the
application got a `NoUniqueBeanDefinitionException` at startup and had to
annotate its own bean `@Primary` to fix a problem the library created.
`@Fallback` makes the expected behaviour — define your own and it wins — the
default one.

**★ Why would you write a custom qualifier annotation instead of a string?**
Because a string qualifier is untyped: a typo is a startup failure at best and a
silent wrong match at worst, refactoring is a text search, and nothing completes
it in the IDE. A `@Qualifier`-meta-annotated annotation with an enum attribute is
compiler-checked and refactorable. The docs also support multi-attribute
qualifiers, where all attributes must match — worth using when the choice is
genuinely two-dimensional, like provider plus region.

**★ What exactly does a custom qualifier annotation get checked at compile time?**
The attribute value, and nothing else. `@Gateway(STRIPE)` fails the build if
`STRIPE` is not a member of the enum, which removes the whole class of typo bugs
that string qualifiers have. It does not verify that any bean carries that
qualifier — resolution still happens when the container starts, and a missing or
renamed bean is still a startup failure. It is a smaller guarantee than it looks,
but it covers the failure that actually happens.

**★ Can you use `jakarta.annotation.Priority` to pick the winner among candidates?**
Only in a limited way, and the docs steer you elsewhere. `@Priority` cannot be
declared on a method, so it is simply unavailable on `@Bean` methods — it only
reaches scanned components. The reference's own guidance is to model its
semantics with `@Order` values combined with `@Primary` or `@Fallback` on a
single bean per type: `@Order` expresses ordering, `@Primary`/`@Fallback`
expresses selection, and keeping those two intents in separate annotations is the
point.

**★ Two beans are both `@Primary`. What happens, and what does that tell you?**
Startup fails with the same ambiguity the annotation exists to resolve — the
container cannot pick a unique primary candidate either. What it tells you is
that the model is wrong: if two implementations both feel like the default, there
is no default, and the honest answer is to qualify at each injection point or to
recognise that the consumer wants both and should inject a collection.

**★ What happens if you resolve ambiguity by just deleting one of the beans?**
You have answered the container's question by removing the capability, which is
only correct if the second implementation was genuinely dead. The ambiguity error
is information: it says two things now satisfy one type and nobody has said which
consumers want which. The useful responses are `@Primary`, a qualifier per site,
or — often the best one — recognising that the consumer wants *all* of them and
should be injecting a collection.

---

← Prev: [Resolving ambiguity: narrowing the type match](05-resolving-ambiguity.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Collections, ordering and self-injection](07-collections-and-ordering.md)
