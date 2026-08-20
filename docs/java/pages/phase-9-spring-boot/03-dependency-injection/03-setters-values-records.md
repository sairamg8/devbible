---
title: "Setters, `@Value` and records"
sidebar_label: "3 · Setters, @Value, records"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Constructor-based
> or setter-based DI*
> (docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html
> — the scoping of setter injection to optional dependencies, the JMX
> re-injection case, the "constructors for mandatory, setters for optional" rule
> of thumb, and the constructor-argument-count code smell) and *Using
> `@Autowired`* (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — `required = false` semantics). Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**The three remaining injection questions all resolve the same way: the
mechanism exists, the documentation scopes it narrowly, and the trouble starts
when people read the mechanism as permission. Setter injection is for optional
dependencies *that carry a default*. `@Value` is for one or two stray values,
not for configuration. And a record makes a perfectly good bean precisely
because it is a constructor with final fields — which is the point the previous
chunk spent its length on.**

## Setter injection, and its one honest use

The docs do not ban setter injection. They scope it:

> *"Setter injection should primarily only be used for optional dependencies
> that can be assigned reasonable default values within the class. Otherwise,
> not-null checks must be performed everywhere the code uses the dependency."*

and:

> *"One benefit of setter injection is that setter methods make objects of that
> class amenable to reconfiguration or re-injection later. Management through
> JMX MBeans is therefore a compelling use case for setter injection."*

So the legitimate shape is *optional, with a default*:

```java
@Service
public class NotificationService {

    private final EmailSender email;                 // mandatory → constructor
    private SmsSender sms = SmsSender.disabled();    // optional → sensible default

    public NotificationService(EmailSender email) {
        this.email = email;
    }

    @Autowired(required = false)                     // called only if a bean exists
    public void setSmsSender(SmsSender sms) {
        this.sms = sms;
    }
}
```

Note the default assignment. Without it you have re-created the null problem
with extra steps — and the documentation's summary rule is exactly this split:
*"use constructors for mandatory dependencies and setter methods or
configuration methods for optional dependencies."*

There is a second, narrower case the docs name: **re-injection at runtime**, as
with a JMX-managed bean whose collaborator is swapped by an operator. That is
rare and it is deliberate. It is not a licence for setters generally.

## `@Value` on a constructor parameter

Configuration values inject the same way, and the same reasoning applies:

```java
@Service
public class PricingClient {

    private final String baseUrl;
    private final Duration timeout;

    public PricingClient(@Value("${pricing.base-url}") String baseUrl,
                         @Value("${pricing.timeout:2s}") Duration timeout) {
        this.baseUrl = baseUrl;
        this.timeout = timeout;
    }
}
```

`${...:default}` supplies a fallback, and Spring converts to `Duration`,
`DataSize` and friends for you. **This is still the wrong default for anything
more than one or two values** — scattered `@Value` strings are unvalidated,
untyped at the declaration site, and impossible to enumerate. The typed
alternative, `@ConfigurationProperties`, is
**[Topic 06 — Configuration and profiles](../06-configuration-and-profiles/README.md)**, and that is where
this belongs.

## Records as beans

A record is a constructor plus final fields, which is the shape this chunk has
been arguing for, so it works exactly as you would hope:

```java
@Service
public record InvoiceService(PricingClient pricing, InvoiceRepository repository) {

    public Invoice raise(OrderId id) { /* ... */ }
}
```

The canonical constructor is the sole constructor, so no `@Autowired` is
needed. Whether you *should* is a style question — records advertise value
semantics, and a service is not a value — but the mechanism is sound, and it is
a neat demonstration that a Spring bean needs nothing from Spring to be
constructed ([records](../../phase-2-classes-objects/08-records/README.md)).

## The trade-off

Constructor injection's cost is real and it is almost always misdiagnosed.

**The cost is verbosity in exactly one situation: a class with many
dependencies.** Six parameters means six lines of assignment and a long
signature, and this is genuinely annoying. The mistake is to treat the
annoyance as a problem with constructor injection rather than as the signal the
docs say it is — *"a large number of constructor arguments is a bad code
smell."* Switching to field injection makes the signature short and the class
exactly as overloaded as it was.

Lombok's `@RequiredArgsConstructor` removes the boilerplate without removing
the signal, since the constructor still exists and still lists everything. It
is a reasonable answer to the verbosity. It is not an answer to nine
dependencies.

## Gotchas

**Symptom:** an optional collaborator is setter-injected and NPEs in production but
not in the environment where the optional bean exists
**Cause:** the setter was used for an optional dependency without assigning a default,
so the field is null exactly when the bean is absent — the case it was made optional for
**Fix:** initialise the field to a no-op implementation at declaration, as the docs
prescribe (`private SmsSender sms = SmsSender.disabled();`), so there is no null state
to check for

**Symptom:** `@Autowired(required = false)` on a setter, and the setter is simply never
called — no error, no log, the field keeps whatever it was
**Cause:** that is the documented behaviour: *"a non-required method will not be called
if its dependency is not available"*. Absence is silent by design
**Fix:** rely on it deliberately by giving the field a default at declaration. If you
actually wanted to know whether the bean was present, inject `ObjectProvider<T>` and
ask — see [Optional, plural and deferred](08-optional-and-deferred.md)

**Symptom:** `@Value("${pricing.timeout}")` fails at startup with a placeholder
resolution error in one environment only
**Cause:** the property is absent there and `@Value` without a default is mandatory
**Fix:** either supply a default in the expression (`${pricing.timeout:2s}`) or, better,
move the whole group to typed `@ConfigurationProperties` where the absence is a
validation error naming the property

**Symptom:** `@Value` count grows past a dozen across a handful of classes and nobody
can answer "what configuration does this service take?"
**Cause:** `@Value` puts the property name in a string literal at the point of use, so
the set of properties is not enumerable from anywhere
**Fix:** one `@ConfigurationProperties` record per concern. The type becomes the
answer to the question, and it can be validated — **[Topic 06 — Configuration and
profiles](../06-configuration-and-profiles/README.md)**

**Symptom:** a record annotated `@Service` works, but a colleague objects in review
**Cause:** the objection is about signalling, not mechanics — records advertise value
semantics and a service is not a value
**Fix:** it is a style call, so settle it as one. The mechanism is sound; if the team
prefers records for data only, use a class with a constructor and the behaviour is
identical

**Symptom:** Lombok's `@RequiredArgsConstructor` is added, and a newly-added `final`
field silently joins the constructor signature without anyone reviewing it
**Cause:** the constructor is generated, so adding a dependency is a one-line diff
rather than a visible change to a signature
**Fix:** accept it as the trade — it is still far better than field injection, because
the constructor genuinely exists and tests can call it — but watch the field count in
review, since the count is the design signal and it is now less prominent

**Symptom:** `@Value` on a `static` field is always null
**Cause:** injection works on instances; Spring populates fields of the bean instance
and does not write static fields
**Fix:** make it an instance field, or if the value really must be static, assign it
from a `@Value`-annotated setter or from `@PostConstruct` — and treat the need as a
sign that the consumer should have been a bean

**Symptom:** a `@Value` expression using `#{...}` silently produces the literal string
or fails in a confusing way
**Cause:** `#{...}` is SpEL and `${...}` is a property placeholder — they are different
resolvers, and the wrong one does not read your configuration at all
**Fix:** use `${property.name:default}` for configuration. Reserve `#{...}` for the rare
case that genuinely needs an expression

## Interview questions

**★ When is setter injection the right answer?**
When the dependency is genuinely optional *and* the class can supply a sensible
default for it — the docs' exact scoping — because otherwise you have moved the
null check to every use site. The second documented case is re-injection or
reconfiguration at runtime, with JMX-managed beans named as the compelling
example. Both are narrow. The summary rule the reference gives is constructors
for mandatory dependencies, setters or configuration methods for optional ones.

**★ What exactly does `@Autowired(required = false)` do on a setter?**
It makes the injection point non-mandatory, and the documented consequence is
that the *method is not called at all* when no candidate bean exists. That is
the subtlety: it does not pass null, it skips the call. So the field keeps
whatever the declaration gave it, which is why the pattern only works if you
assigned a real default there. If you leave the field uninitialised you have
built a null that appears in exactly one environment.

**★ Why not use `@Value` for all configuration?**
Because it puts the property name in a string literal at the point of use, so
nothing can enumerate, validate or document the configuration a service takes.
Type conversion happens per-injection-point, defaults are per-expression, and a
typo surfaces as a placeholder-resolution failure at startup at best. Typed
`@ConfigurationProperties` makes the configuration a class — enumerable,
validatable with Bean Validation, bindable in one place. `@Value` is fine for
one or two strays.

**★ `${...}` versus `#{...}` in `@Value` — what is the difference?**
`${...}` is a *property placeholder*: it is resolved against the `Environment`,
so it reads from `application.yml`, environment variables, command-line
arguments and every other property source, and it supports a default after a
colon — `${pricing.timeout:2s}`. `#{...}` is a *SpEL expression*, evaluated by the
Spring Expression Language, which can call methods, read other beans and do
arithmetic. The practical guidance is that configuration should be `${...}`;
reaching for `#{...}` usually means logic has drifted into an annotation string
where nothing can test it.

**★ How do records interact with `@ConfigurationProperties`?**
Very well, and it is the reason the pairing is worth knowing: a record's
canonical constructor gives Boot exactly the constructor binding it wants, so the
configuration object comes out immutable, fully populated, and with every
property visible in one declaration. That is precisely the property `@Value`
cannot offer, since `@Value` scatters the property names through string literals
at each use site. So the honest split is `@Value` for a stray value or two, and a
`@ConfigurationProperties` record for anything that is genuinely a group of
settings.

**★ Can a record be a Spring bean? Should it?**
It can, and cleanly — a record's canonical constructor is its sole constructor,
so component scanning wires it with no `@Autowired` and every field is final by
construction. Whether it should is a design call: records signal value
semantics and a service is not a value, so most teams keep records for DTOs and
domain data. It is a useful demonstration though, because it shows a Spring bean
requires nothing from Spring in order to be constructed.

**★ What is the actual cost of constructor injection, and is Lombok a legitimate answer to it?**
The cost is verbosity, and only in classes with many dependencies — a long
signature plus one assignment per field. There is no runtime penalty; after
startup an injected collaborator is an ordinary final field.
`@RequiredArgsConstructor` is a legitimate answer to the typing, because the
constructor still exists and tests can still call it directly, which is the
property that matters. It is not an answer to nine dependencies — that is the
design smell the reference names, and generating the constructor only makes the
smell less visible.

---

← Prev: [Constructor injection is the default](02-constructor-injection.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Why field injection is flagged](04-field-injection.md)
