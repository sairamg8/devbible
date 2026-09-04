---
title: "Collections, ordering and self-injection"
sidebar_label: "7 · Collections and ordering"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Using
> `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — array/`Set`/`List`/`Map<String,T>` injection with bean names as map keys,
> `Ordered`/`@Order`/`@Priority` ordering for arrays and lists, the fallback to
> bean-definition registration order, the statement that `@Order` values do not
> influence singleton startup order, the note that
> `@Order` on a `@Configuration` class does not affect its `@Bean` methods, and
> the self-injection rules) and *Fine-tuning Annotation-based Autowiring with
> Qualifiers*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html
> — qualifiers on typed collections as filtering criteria that need not be
> unique). Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

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
  `ObjectProvider.orderedStream()` ([next chunk](08-optional-and-deferred.md)).
- 🔴 **`@Order` does not control the order the beans are *created* in.** This is
  the one that costs real debugging time, because the annotation looks like it
  ought to. The reference is explicit: `@Order` values *"may influence priorities
  at injection points, but be aware that they do not influence singleton startup
  order, which is an orthogonal concern determined by dependency relationships
  and `@DependsOn` declarations."* So `@Order(1)` on a bean whose
  `@PostConstruct` must run before another's changes nothing at all. Startup
  order follows the dependency graph; if you need to force an edge that is not
  expressed by an injection, that is what `@DependsOn` is for — and needing it is
  usually a sign the dependency should have been a constructor parameter.

### `Ordered`, `@Order` and `@Priority` — three spellings, not three mechanisms

For sorting an injected array or list, the reference treats all three the same
way: target beans *"can implement the `org.springframework.core.Ordered`
interface or use the `@Order` or standard `@Priority` annotation"*, and without
any of them the order *"follows the registration order of the corresponding
target bean definitions in the container"* — which is a real order, but one that
changes when someone renames a class or reorders a `@Configuration`, so relying
on it is relying on an accident.

Choose between them like this:

- **`Ordered`** when the order is part of the type's contract and a caller might
  want to read it — the value is a method, so it can be computed.
- **`@Order`** for everything else. It is declarative, it works on classes and on
  `@Bean` methods, and it is what the rest of Spring uses.
- **`@Priority`** only if you are already committed to the Jakarta annotations.
  It cannot go on a `@Bean` method at all (see
  [chunk 6](06-primary-fallback-and-custom-qualifiers.md)), so it is the least
  useful of the three in a Boot application, where most beans that need ordering
  are declared in configuration classes.

⚠️ **Lower value first, and the constants are not what you would guess.**
`Ordered.HIGHEST_PRECEDENCE` is `Integer.MIN_VALUE` and `LOWEST_PRECEDENCE` is
`Integer.MAX_VALUE`. "Highest precedence" therefore means the *smallest* number
and runs *first*. Leave gaps — `@Order(100)`, `@Order(200)` — so a bean can be
inserted later without renumbering the chain.

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
of failing — see [the next chunk](08-optional-and-deferred.md)

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

**Symptom:** `@Order(1)` is put on a bean so its `@PostConstruct` runs before another
bean's, and the order is unchanged
**Cause:** documented — `@Order` influences priorities at injection points and does not
influence singleton startup order, which is determined by dependency relationships and
`@DependsOn`
**Fix:** express the real dependency (inject the other bean, so the container must build
it first) or, when there is genuinely no injection to express, `@DependsOn`

**Symptom:** a `List<Validator>` chain runs in the right order for a year, then silently
reorders after an unrelated refactor
**Cause:** no `@Order` anywhere, so the list followed the registration order of the bean
definitions, which changed when a class was renamed or a configuration reordered
**Fix:** state the order — `@Order` on each participant, with gaps between the values so
a new one can be slotted in

**Symptom:** `@Order(1)` and `@Order(2)` are read as "first and second" and someone adds
`@Order(0)` expecting it to run last
**Cause:** lower values have *higher* precedence; `HIGHEST_PRECEDENCE` is
`Integer.MIN_VALUE`
**Fix:** read `@Order` as "position in the queue, lowest first", and space values out
rather than using consecutive integers

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

**★ Does `@Order` control the order beans are created in?**
No, and this is the trap worth remembering verbatim. The reference says `@Order`
values *"may influence priorities at injection points, but be aware that they do
not influence singleton startup order, which is an orthogonal concern determined
by dependency relationships and `@DependsOn` declarations."* So `@Order` decides
where a bean sits in an injected `List`; it decides nothing about when the object
is constructed or when its `@PostConstruct` runs. If initialisation order
matters, express it as a dependency — inject the bean you need built first — and
fall back to `@DependsOn` only for an edge that no injection expresses, which is
usually a hint that the design is hiding a real dependency.

**★ `Ordered`, `@Order` and `@Priority` — when would you pick each?**
For sorting an injected array or list they are three spellings of one mechanism,
so the choice is about fit rather than behaviour. `Ordered` is the interface, so
use it when the ordering is part of the type's contract or has to be computed.
`@Order` is the declarative default and works on both classes and `@Bean`
methods, which makes it the right answer almost always in a Boot application.
`@Priority` is the Jakarta annotation and carries a real limitation — it cannot
be declared on a `@Bean` method — so it only reaches scanned components, and the
reference suggests modelling what you wanted with `@Order` plus `@Primary` or
`@Fallback` instead.

**★ You inject a `List<Handler>` and never annotate anything. Is the order defined?**
It is defined but not specified in any way you should depend on: the reference
says the order follows the registration order of the corresponding bean
definitions in the container. That is deterministic for a given build, which is
exactly what makes it dangerous — it works, so nobody notices the chain has no
declared order until a rename, a package move or a change in configuration class
evaluation reorders it and a validator starts running after the step that needed
it. If order matters, say so.

**★ Why does a `Map<String, Handler>` not give you an ordered chain?**
Because the map's contract is lookup by bean name, not sequence: the reference
describes the keys as the bean names and describes `@Order` for arrays and lists.
Nothing promises a `Map` injection point respects `@Order`, and the concrete map
type you receive is not part of the contract either. When you need both — a
chain to run and a lookup by key — inject the `List`, which carries the order,
and build the map from it yourself, or take `ObjectProvider` and call
`orderedStream()`.

---

← Prev: [`@Primary`, `@Fallback` and custom qualifiers](06-primary-fallback-and-custom-qualifiers.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Optional, plural and deferred](08-optional-and-deferred.md)
