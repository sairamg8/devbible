---
title: "Validation beyond the controller"
sidebar_label: "13 · Beyond the controller"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Java Bean
> Validation*, *Spring-driven Method Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html
> — `MethodValidationPostProcessor`, the `@Validated` type-level requirement,
> the note that method validation *"relies on AOP proxies around the target
> classes, either JDK dynamic proxies for methods on interfaces or CGLIB
> proxies"*, `ConstraintViolationException` by default and
> `setAdaptConstraintViolations(true)` for `MethodValidationException`) and the
> Spring Boot reference *Validation*
> (docs.spring.io/spring-boot/reference/io/validation.html — method validation
> being enabled automatically when a JSR-303 implementation is on the
> classpath, and the `@Validated` type-level example). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**The same constraint annotations work on any Spring bean's methods, and on
configuration properties at startup. Both are genuinely useful and both are
easy to over-apply: method validation on a service is a proxy plus an exception
with no HTTP meaning, and it is worth it exactly where the boundary cannot be
trusted — which, if you validated at the edge, is not most places.**

## `@Validated` on a service enables method validation

```java
@Service
@Validated                                    // ← required, at the type level
public class ArchiveService {

    public Archive findByCodeAndAuthor(@Size(min = 8, max = 10) String code,
                                       @NotNull Author author) {
        …
    }

    @NotNull                                  // ← constrains the return value
    public Archive mustFind(@NotBlank String code) {
        …
    }
}
```

Boot enables this automatically once a Bean Validation provider is on the
classpath — the starter from [chunk 2](02-the-constraints.md) — by registering
a `MethodValidationPostProcessor`. **The class must carry `@Validated` at the
type level** for its methods to be searched for constraint annotations; the
annotations alone do nothing.

Three mechanical facts follow from *how* it works.

**It relies on AOP proxies** — JDK dynamic proxies for interface methods, CGLIB
otherwise. So every caveat of Spring proxies applies, most importantly that
**a call from one method of the bean to another is not intercepted**: internal
self-invocation bypasses validation entirely. This is the same mechanism and
the same trap as
[proxies and self-invocation](../02-the-ioc-container/05-proxies-and-self-invocation.md).

**The failure is `ConstraintViolationException`**, which has no web semantics
and is not in Spring MVC's exception-to-status table — so it surfaces as a
**500** unless something handles it ([chunk 7](07-the-failure.md)). That is
arguably the right outcome: a service-layer violation means the boundary let
bad data through, which is a bug in your code and not in the client's request.

**You can ask for a friendlier exception.** Configuring the post-processor with
`setAdaptConstraintViolations(true)` produces `MethodValidationException`
instead, whose `ParameterValidationResult`s group errors by parameter and, for
cascaded `@Valid` parameters, expose `ParameterErrors` implementing `Errors` —
the same shape as [chunk 8](08-reading-the-errors.md). It also routes messages
through `MessageSource` with codes like `Size.person.name`, which is the hook
described in [chunk 16](16-message-codes.md).

```java
@Bean
static MethodValidationPostProcessor validationPostProcessor() {
    MethodValidationPostProcessor processor = new MethodValidationPostProcessor();
    processor.setAdaptConstraintViolations(true);
    return processor;
}
```

Note the `static` — a `BeanPostProcessor` is created very early, and a
non-static factory method forces its `@Configuration` class to be instantiated
early with it, which can quietly break other beans' post-processing.

## When it is worth it, and when it is noise

**Worth it** where the caller is not your controller and the boundary
guarantees do not apply:

- a **library or shared module** whose callers you do not control;
- a **message consumer** or **scheduled job**, which has no `@Valid` boundary
  of its own — these are entry points too, and the annotations give them one;
- a **public API of an internal service** where a wrong argument is expensive
  and the constraint documents the contract in the signature.

**Noise** where the only caller is a controller you already validated. There
you pay a proxy, a second evaluation of the same rules, an exception with no
HTTP meaning, and a `@Validated` annotation that a future reader has to reason
about — for a check that has already passed. **Validating the same DTO twice is
not defence in depth; it is duplicated policy that will drift**, because
somebody will tighten one and not the other.

Two smaller costs that are easy to miss: proxying a class that was not
otherwise proxied changes `this`-based reasoning and can break `final` methods
under CGLIB; and constraints in a signature are not visible to the compiler, so
a caller learns about them at runtime.

## `@ConfigurationProperties` — fail at startup, not at 3 a.m.

The best use of validation outside the controller is not a service at all:

```java
@ConfigurationProperties(prefix = "billing")
@Validated                                        // ← turns the binding into a checked one
public record BillingProperties(
        @NotBlank String apiKey,
        @NotNull @Positive Duration timeout,
        @NotEmpty List<@NotBlank String> supportedCurrencies) { }
```

With `@Validated`, invalid configuration fails **during startup**, with a bind
error naming the property, rather than producing a `null` API key that surfaces
as a confusing failure on the first billing request in production. This is the
single highest-value place to spend a validation annotation, because the
alternative failure happens later, further away, and to a user.

It composes with everything else in this topic: nested `@Valid` on a
sub-record, container element constraints on a list, custom constraints for
domain formats. The property source and precedence rules are
[topic 06](../06-configuration-and-profiles/01-the-environment-and-precedence.md).

⚠️ Two details. The properties class needs `@Validated` — the constraints alone
do not trigger binding validation. And a `@ConfigurationProperties` bean is
created and validated when the context starts, so a failure is a startup
failure: excellent in a container orchestrator that will not route traffic to a
pod that never became ready, and something to be deliberate about in a process
that must start degraded.

## Programmatic validation, when you need it

Sometimes the trigger is neither an argument nor a property — a value arrives
from a CSV row, a queue message, or a step in a batch:

```java
@Service
public class ImportService {

    private final Validator validator;               // jakarta.validation.Validator

    public ImportService(Validator validator) { this.validator = validator; }

    public ImportReport importRows(List<RowDto> rows) {
        for (RowDto row : rows) {
            Set<ConstraintViolation<RowDto>> violations = validator.validate(row);
            if (!violations.isEmpty()) {
                // record and continue — one bad row must not fail the batch
            }
        }
        …
    }
}
```

`LocalValidatorFactoryBean` implements `jakarta.validation.Validator`, so it
injects directly. This is the right tool whenever the *policy on failure* is
something other than "reject the whole request" — per-row reporting, partial
acceptance, a dead-letter queue — because an exception-based mechanism cannot
express "collect and carry on".

## The trade-off

Every mechanism in this chunk moves a check away from the edge, and each has to
justify that.

- **Method validation on a service** costs a proxy, an unmapped exception and a
  duplicate rule; it earns its place when the caller is not a validated
  boundary. Applying it to every `@Service` "for safety" is the anti-pattern —
  it is the domain-littered-with-defensive-checks problem from
  [chunk 1](01-why-validate-at-the-edge.md), wearing annotations.
- **`@Validated` on `@ConfigurationProperties`** costs a startup failure mode
  and buys a class of production incident disappearing. Almost always correct.
- **Programmatic validation** costs explicit code and buys control over what
  happens next; it is the only option when failure is not fatal.

## Gotchas

**Symptom** · Constraints on service method parameters are ignored.
**Cause** · The class is missing type-level `@Validated`; annotations on
parameters alone do nothing.
**Fix** · `@Validated` on the class.

**Symptom** · Method validation works from a controller but not when the
service calls its own method.
**Cause** · Self-invocation does not pass through the AOP proxy.
**Fix** · Call through an injected reference to the bean, or restructure so the
validated method is the external entry point. This is a proxy property, not a
validation one.

**Symptom** · A service-layer violation returns 500.
**Cause** · `ConstraintViolationException` is not a Spring MVC exception.
**Fix** · Usually leave it — it is a programming error. If a 400 is genuinely
right, the failure belongs at the controller boundary instead.

**Symptom** · Adding `@Validated` to a service breaks other beans or throws
about proxying.
**Cause** · The class is now proxied — `final` methods are not intercepted
under CGLIB, and any code depending on the concrete class identity may be
surprised.
**Fix** · Validate at the boundary instead, or make the service an interface
implementation so a JDK proxy suffices.

**Symptom** · A `MethodValidationPostProcessor` `@Bean` method causes odd
early-initialisation warnings.
**Cause** · The factory method is not `static`, so its configuration class is
instantiated before post-processing is fully set up.
**Fix** · Declare the `@Bean` method `static`.

**Symptom** · Invalid configuration is accepted and the failure appears later
as a `NullPointerException` deep in a request.
**Cause** · `@ConfigurationProperties` without `@Validated`.
**Fix** · Add `@Validated` to the properties type so binding fails at startup.

**Symptom** · A batch import fails entirely because one row was invalid.
**Cause** · An exception-based validation mechanism where the requirement was
per-row reporting.
**Fix** · Inject `jakarta.validation.Validator` and call `validate` per row,
collecting violations.

## Interview questions

**★ How do you validate the arguments of a plain service method?**
Put constraint annotations on the parameters and `@Validated` on the class at
type level. Boot registers a `MethodValidationPostProcessor` automatically once
a provider is on the classpath, which proxies the bean and validates on the way
in. The type-level annotation is required — parameter annotations alone are
inert.

**★ What are the mechanical consequences of that being AOP-based?**
Everything true of Spring proxies: a self-invocation inside the bean is not
intercepted and therefore not validated; `final` methods are not intercepted
under CGLIB; and the bean's runtime type is a proxy. It is also why Framework
6.1 added a non-AOP path for controllers — the proxy was buying nothing there.

**★ Should every service be `@Validated`?**
No. Where the only caller is a controller that already validated the same DTO,
you are paying a proxy and an unmapped exception to re-check something that
passed, and maintaining two copies of a rule that will drift. Use it where the
caller is not a validated boundary: shared libraries, message consumers,
scheduled jobs.

**★ What exception does service-level method validation throw, and what status
does it produce?**
`ConstraintViolationException` by default, which is not in Spring MVC's
exception-to-status table and therefore produces a 500. That is defensible —
it means the boundary let bad data through, which is your bug rather than the
client's. Configuring `setAdaptConstraintViolations(true)` gives
`MethodValidationException` instead, with errors grouped per parameter and
messages resolved through `MessageSource`.

**★ What is the highest-value use of validation outside a controller?**
`@Validated` on `@ConfigurationProperties`. It converts a class of production
incident — a missing or malformed setting discovered at the worst possible
moment — into a startup failure that names the property. In an orchestrated
deployment the pod never becomes ready and traffic never reaches it.

**★ When would you call a `Validator` programmatically instead of annotating?**
When failure is not fatal: importing a file where bad rows are reported and
good rows are processed, consuming a queue where an invalid message goes to a
dead-letter topic, or any flow that must collect problems rather than abort.
Exception-based validation cannot express "collect and carry on";
`validator.validate(obj)` returns the violations and leaves the policy to you.

**★ Why must a `MethodValidationPostProcessor` `@Bean` method be `static`?**
Because it is a `BeanPostProcessor` and must be created very early. A
non-static factory method forces its enclosing `@Configuration` class to be
instantiated ahead of the post-processing infrastructure, which can leave other
beans in that class un-post-processed. It is a general rule for
`BeanPostProcessor`/`BeanFactoryPostProcessor` beans, not specific to
validation.

---

← Prev: [Validation groups](12-validation-groups.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Messages and interpolation](14-messages-and-interpolation.md)
