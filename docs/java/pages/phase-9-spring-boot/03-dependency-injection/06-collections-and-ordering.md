---
title: "Collections, ordering and self-injection"
sidebar_label: "6 · Collections and ordering"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Using
> `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — array/`Set`/`List`/`Map<String,T>` injection with bean names as map keys,
> `Ordered`/`@Order`/`@Priority` ordering for arrays and lists, the note that
> `@Order` on a `@Configuration` class does not affect its `@Bean` methods, and
> the self-injection rules) and *Fine-tuning Annotation-based Autowiring with
> Qualifiers*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html
> — qualifiers on typed collections as filtering criteria that need not be
> unique). Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The previous chunk treated several candidates for one type as a problem to
narrow away. This one treats it as the answer: declare the injection point as a
collection and "ambiguous" becomes "all of them", which is how every plugin,
strategy table and processing chain in a Spring codebase is actually built.
Two beans of one type is only an error when you asked for one bean.**

## Injecting all of them

This is where "narrowing, not naming" pays off. Ask for a collection and you get
every match, which turns ambiguity from an error into the feature:

```java
@Service
class NotificationDispatcher {
    private final List<Notifier> notifiers;      // every Notifier bean

    NotificationDispatcher(List<Notifier> notifiers) {
        this.notifiers = notifiers;
    }
}
```

Arrays, `List`, `Set` and `Map<String, T>` are all supported. For the map, *"map
keys are bean names; values are beans of the expected type"* — which is the
clean way to build a strategy lookup:

```java
@Service
class PaymentRouter {
    private final Map<String, PaymentGateway> gateways;   // "stripeGateway" -> bean

    PaymentRouter(Map<String, PaymentGateway> gateways) {
        this.gateways = gateways;
    }
}
```

And a qualifier on a collection injection point *filters* rather than
disambiguates — the docs say qualifiers here *"constitute filtering criteria"*
and explicitly *"do not have to be unique"*:

```java
@Autowired @Qualifier("regional")
private Set<PaymentGateway> regionalGateways;   // every bean qualified "regional"
```

### Ordering the collection

A `List` has an order and it matters for chains — validators, enrichers,
filters. Target beans can implement `org.springframework.core.Ordered` or carry
`@Order` (or standard `@Priority`):

```java
@Component @Order(10) class FraudCheck    implements Notifier { }
@Component @Order(20) class EmailNotifier implements Notifier { }
```

Lower runs first. Two traps here, both documented:

- **`@Order` on a `@Configuration` class does not reach its `@Bean` methods.** It
  influences evaluation order among configuration classes only; *"for bean-level
  ordering, each `@Bean` method needs its own `@Order` annotation."*
- **`Map` injection has no documented ordering guarantee from `@Order`** — the
  reference describes ordering for arrays, collections and lists. If you need
  both keys and order, inject the `List` and index it yourself, or use
  `ObjectProvider.orderedStream()` ([next chunk](07-optional-and-deferred.md)).

## Self-injection

`@Autowired` will consider a reference back to the bean being injected, but the
docs are firm about its status: self references *"do not participate in regular
autowiring candidate selection and are therefore never primary, always ending up
as lowest precedence"*, and — quoted directly — *"in practice, you should use
self references as a last resort only — for example, for calling other methods
on the same instance through the bean's transactional proxy."*

That example is the whole use case: an internal call to `this.method()` bypasses
the proxy, so `@Transactional` or `@Cacheable` on that method does nothing.
Injecting yourself gets you the proxied reference. It is a workaround for
proxy-based AOP, covered in **Topic 10 — The request pipeline** *(not written
yet)*, and the better fix is usually to move the method to a collaborator.

## Gotchas

**Symptom:** `@Order` is added to a `@Configuration` class and its `@Bean`s still come
out in the wrong order
**Cause:** documented behaviour — `@Order` on a configuration class affects evaluation
order among configuration classes, not the beans it defines
**Fix:** annotate each `@Bean` method with its own `@Order`

**Symptom:** a `Map<String, Handler>` is iterated and the order differs between
environments
**Cause:** the map's keys are bean names, and the reference describes `@Order` for
arrays, collections and lists — it does not promise map ordering
**Fix:** inject `List<Handler>` for the ordered chain and derive the lookup from it:

```java
PaymentRouter(List<PaymentGateway> ordered) {
    this.chain   = ordered;                                    // order guaranteed
    this.lookup  = ordered.stream()
        .collect(toMap(PaymentGateway::code, identity()));     // key from the bean
}
```

**Symptom:** a `List<Notifier>` injection point fails at startup because no `Notifier`
bean exists yet, in a module where the feature is optional
**Cause:** a collection injection point with zero candidates is treated as an
unsatisfied dependency by default
**Fix:** mark it `@Autowired(required = false)`, or inject
`ObjectProvider<Notifier>` and call `stream()`, which yields an empty stream instead
of failing — see [the next chunk](07-optional-and-deferred.md)

**Symptom:** a new implementation is added to a chain and silently never runs
**Cause:** it was not annotated as a component, or it was added to a `Map` lookup keyed
by bean name while the router keys on something else
**Fix:** key the lookup on a value the bean itself declares (a `code()` method) rather
than on its bean name, so the mapping is visible in the implementation instead of
depending on a class name

**Symptom:** `@Transactional` on a method has no effect when that method is called from
another method of the same class
**Cause:** the internal call goes through `this`, not through the proxy carrying the
advice
**Fix:** move the method to a collaborating bean. Self-injection also works and the
docs name this exact case, but they call it a last resort

## Interview questions

**★ How do you inject every implementation of an interface?**
Declare the injection point as an array, `List`, `Set`, or `Map<String, T>`; for
the map, the keys are bean names and the values are the beans. This is the
idiomatic way to build a strategy table or a processing chain, and it turns the
`NoUniqueBeanDefinitionException` case into the intended one — several
candidates is only an error when you asked for a single bean.

**★ How is a `List` injection point ordered, and what are the traps?**
Target beans implement `org.springframework.core.Ordered` or carry `@Order` or
standard `@Priority`, and lower values come first. Two documented traps: `@Order`
on a `@Configuration` class influences evaluation order among configuration
classes and does *not* propagate to its `@Bean` methods, so each method needs its
own; and the ordering guarantee is stated for arrays, collections and lists, not
for `Map` injection — so do not rely on map iteration order.

**★ What does a `@Qualifier` on a collection injection point do?**
It filters rather than disambiguates. The reference says qualifiers on typed
collections *"constitute filtering criteria"* and explicitly *"do not have to be
unique"*, so `@Qualifier("regional") Set<PaymentGateway>` injects every gateway
carrying that qualifier. This is the cleanest reading of the whole qualifier
mechanism: it always narrows a set of type matches, and whether the narrowed set
must have exactly one element depends only on whether the injection point is
single-valued.

**★ You need both a lookup by key and a guaranteed order. What do you inject?**
Inject the `List`, because that is the form with a documented ordering
guarantee, then build the map from it in the constructor — keying on something
the bean declares about itself rather than on its bean name, so the key is
visible in the implementation and survives a class rename. Injecting the `Map`
directly gives you keys but no promised order.

**★ What happens when a collection injection point has no candidates at all?**
By default it is an unsatisfied dependency and the context fails to start, which
is usually what you want. When zero really is valid — an optional extension
point — mark it `@Autowired(required = false)`, or inject `ObjectProvider<T>` and
use `stream()`, which simply yields nothing.

**★ What is self-injection, when is it legitimate, and what is the better fix?**
It is a bean injecting a reference to itself, which Spring permits as a
fallback — self references never participate in normal candidate selection, are
never primary, and rank lowest. The one case the docs name is calling another
method on the same instance *through the bean's proxy*, because an internal
`this.method()` call bypasses the proxy and therefore bypasses `@Transactional`,
`@Cacheable` and similar advice. The better fix is nearly always to move that
method onto a collaborating bean, so the call crosses a real proxy boundary.

---

← Prev: [Resolving ambiguity](05-resolving-ambiguity.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Optional, plural and deferred](07-optional-and-deferred.md)
