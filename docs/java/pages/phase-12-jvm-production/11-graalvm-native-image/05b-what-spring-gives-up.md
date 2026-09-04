---
title: "On the JVM, Spring's AOT restrictions are opt-in; in a native image they are mandatory — the set of beans becomes a property of the artefact, so @Profile and @ConditionalOnProperty stop being runtime switches and 'build once, deploy everywhere' quietly ends"
sidebar_label: "05b · What Spring gives up"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **Spring Boot reference** — "Introducing GraalVM Native Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/introducing-graalvm-native-images.html))
> and "Ahead-of-Time Processing With the JVM"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot.html));
> the **GraalVM Native Image reference**, "Native Image Basics"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/basics/)).
> The full JVM-side restriction inventory, including the three the Framework reference adds, is in topic 10 at
> [`06c-what-aot-processing-gives-up.md`](../10-packaging-for-deploy/06c-what-aot-processing-gives-up.md) — quoted there, not repeated here.
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.1 / Spring Framework 7.0.9**.
> Documentation-validated; **no sandbox run**.

**Every restriction Spring's AOT engine imposes on the JVM applies in a native image, with one difference that changes the whole conversation: on the JVM you chose them and can un-choose them by dropping a profile, and in a native image they are the price of the artefact existing. Add GraalVM's own closed-world rules on top — no runtime classpath, no lazy class loading, no dynamic class definition — and you get a deployment model where the set of beans, the active profile and the enabled features are all decided by whoever ran the build.**

## The restriction list, from Boot's native-image page

Boot states it as a consequence of assuming a closed world:

> *"A closed-world assumption implies, besides the limitations created by GraalVM itself, the following restrictions:*
> *- The beans defined in your application cannot change at runtime, meaning:*
>   *- The Spring `@Profile` annotation and profile-specific configuration have limitations.*
>   *- Properties that change if a bean is created are not supported (for example, `@ConditionalOnProperty` and `.enabled` properties)."*

and the AOT page adds the classpath clause:

> *"- The classpath is fixed and fully defined at build time"*

🔴 **"Cannot change at runtime" is not "changes with difficulty".** Conditions were evaluated during the build; the bean definitions that lost are not in the artefact. There is nothing to re-enable.

## The difference from the JVM AOT path

| | Spring AOT on the JVM (topic 10) | Spring AOT for a native image (here) |
|---|---|---|
| Is it optional? | Yes — build without `-Pnative`, or run without `spring.aot.enabled` | **No.** The native build cannot be produced without it |
| Can you fall back at run time? | Yes — the same jar runs normally when the property is unset | **No.** There is no other code path in the binary |
| Classpath at run time | Fixed by AOT's assumption, but a JVM is still underneath | **There is none.** `System.getProperty("java.class.path")` is `null` |
| Lazy class loading | Yes, the JVM still loads on first use | **No.** *"everything shipped in the executables will be loaded in memory on startup"* |
| Dynamic proxies, new classes | Possible outside AOT-processed definitions | **No mechanism exists** |
| Devtools | Works | Excluded by the `native` profile; the restart classloader cannot work |

That third and fourth row are GraalVM's, not Spring's — which is why "we already run with `spring.aot.enabled=true`, so native will be easy" is only two-thirds true. It is genuine evidence that the *Spring* half works. It says nothing about your dependencies' reflection.

## What actually changes in your deployment model

**Property *values* still work. Bean *presence* does not.**

```java
// FINE in a native image: the bean exists; its behaviour is driven by a runtime property.
@Component
public class PaymentGateway {

    private final Duration timeout;

    public PaymentGateway(@Value("${payments.timeout:PT5S}") Duration timeout) {
        this.timeout = timeout;
    }
}
```

```java
// BROKEN as a runtime switch: whether this bean exists was decided during the build.
@Component
@ConditionalOnProperty(name = "payments.provider", havingValue = "stripe")
public class StripeGateway implements PaymentGateway { }
```

The second form is the standard Boot feature-flag idiom and it stops being a flag. If `payments.provider` was not `stripe` on the build machine, `StripeGateway` is not in the binary.

**The fix is to move the choice from bean presence to bean selection.** Ship every implementation, and select at run time:

```java
@Configuration(proxyBeanMethods = false)
public class PaymentConfiguration {

    // Both beans always exist in the artefact — no condition is evaluated at build time.
    @Bean
    StripeGateway stripeGateway(StripeProperties properties) {
        return new StripeGateway(properties);
    }

    @Bean
    AdyenGateway adyenGateway(AdyenProperties properties) {
        return new AdyenGateway(properties);
    }

    // The runtime property selects between them, and this bean is what everything injects.
    @Bean
    PaymentGateway paymentGateway(@Value("${payments.provider}") String provider,
                                  StripeGateway stripe,
                                  AdyenGateway adyen) {
        return switch (provider) {
            case "stripe" -> stripe;
            case "adyen"  -> adyen;
            default -> throw new IllegalStateException("Unknown payments.provider: " + provider);
        };
    }
}
```

⚠️ **This costs image size** — both implementations are now reachable, and with no lazy class loading both are resident from start-up. That is the honest trade: **runtime flexibility is paid for in bytes**, and the closed world makes the price explicit where the JVM hid it.

**The alternative is one build per environment**, which is a real and sometimes correct answer — it is just a decision that has to be made deliberately, because it changes what "promote the artefact from staging to production" means. If the staging and production builds differ, you did not test the artefact you shipped.

## `@Profile` specifically

Boot links to its own how-to for the details and describes profiles as having *"limitations"* rather than as broken. The practical shape:

- **Profile-scoped bean definitions** are evaluated at build time. A `@Profile("production")` bean survives only if the build's environment activated that profile.
- **Profile-specific property files** (`application-production.yaml`) are a *property* mechanism, and properties still resolve at run time — so the values in them are not the problem. Bean presence is.
- 🔴 **So the failure is asymmetric and confusing:** your production property file applies, but the production-only bean it was written for may not exist. Do not reason about profiles as a single feature here; separate "which properties are loaded" from "which beans are defined".

The safest posture for a native artefact is: **no profile-scoped bean definitions at all.** Use profiles for property values only, and make every structural difference a property-driven selection like the one above.

## The GraalVM restrictions Spring inherits

These are not Spring's to fix and no configuration removes them:

- **No runtime classpath.** Anything that scans it — a plugin loader, a `PathMatchingResourcePatternResolver` over an unknown pattern, a library that walks `java.class.path` — finds nothing. See [02](02-the-closed-world-assumption.md).
- **No lazy class loading.** Boot: *"There is no lazy class loading, everything shipped in the executables will be loaded in memory on startup."* `spring.main.lazy-initialization` still delays bean *instantiation*, but the classes are resident either way, so the footprint argument for it disappears.
- **No dynamic class definition.** Anything that generates bytecode at run time — some mocking frameworks, some ORMs' runtime enhancement, some scripting integrations — needs a build-time equivalent or has to go.
- **Devtools cannot work.** Its restart mechanism is a second classloader over a changing classpath. The starter parent's `native` profile excludes it from the Native Build Tools configuration for exactly this reason.

## What you should stop doing before you migrate

A short list that converts most of the pain into ordinary refactoring, and that is worth doing even if you never ship a native image:

1. **Stop expressing feature flags as bean presence.** `@ConditionalOnProperty` on your own beans becomes a build-time switch; use runtime selection instead.
2. **Stop defining beans per `@Profile`.** Keep profiles for property values.
3. **Stop reading the classpath at run time.** Enumerate instead.
4. **Stop putting environmental reads in static initialisers.** [04](04-build-time-vs-run-time-initialisation.md).
5. **Stop relying on `catch (ClassNotFoundException)` to detect optional dependencies.** `@ConditionalOnClass` is evaluated at build time and produces the right artefact; a run-time probe throws an `Error` you cannot catch ([03](03-what-breaks.md)).
6. **Prefer `proxyBeanMethods = false`.** Fewer build-time proxies, and the style AOT is designed around.

## Gotchas

**★ Symptom: a feature flag set in production has no effect.** Cause: it was `@ConditionalOnProperty`, evaluated at build time, so the bean is absent from the artefact. Fix: ship both beans and select between them at run time, as in the `PaymentConfiguration` example above. Accept the image-size cost, or accept one build per environment — those are the two options and there is no third.

**★ Symptom: the production profile's properties apply but a production-only bean is missing.** Cause: properties resolve at run time, bean definitions were resolved at build time. They are different mechanisms and the closed world separates them. Fix: stop defining beans per profile; keep profiles for values only.

**★ Symptom: an Actuator endpoint or an auto-configuration is missing in the native image only.** Cause: a `.enabled` property or a `@ConditionalOn*` condition evaluated against the build environment rather than the production one. Fix: set that property in the build environment too — Boot's AOT documentation is explicit that the build's environment determines the artefact's feature set — and record it, because it is now a build input, not a deployment input.

**★ Symptom: "we run with `spring.aot.enabled=true` already, so the native build will just work."** Cause: conflating the Spring half with the GraalVM half. Fix: the property proves the AOT-generated context is correct. It does not exercise your dependencies' reflection, resources or proxies, because on a JVM those still work dynamically. You still need the metadata work ([03b](03b-reachability-metadata.md)) and a native test run (**08 · Testing a native image** *(not written yet)*).

**★ Symptom: `spring.main.lazy-initialization=true` no longer reduces memory.** Cause: it defers bean *instantiation*, not class loading, and in a native image *"everything shipped in the executables will be loaded in memory on startup."* Fix: reduce what is *reachable* instead — drop unused starters and dependencies. Reachability, not laziness, is the footprint lever here.

**★ Symptom: staging and production behave differently and the artefacts are "the same version".** Cause: two builds with different build-time environments produce different bean sets. Fix: either build once and make every environmental difference a runtime property, or make the per-environment build explicit in the pipeline and test each artefact separately. A version number is no longer sufficient identity for a native artefact.

**★ Symptom: a library that enhances entities or generates classes at run time fails only in native.** Cause: no dynamic class definition. Fix: check whether the library has a build-time mode — many ORMs and mappers do — and use it. If it has none, this dependency and native image are incompatible, and saying so early is cheaper than discovering it in week three.

**★ Symptom: devtools is on the classpath and the native build behaves oddly.** Cause: the restart classloader has no meaning in a closed world. Fix: the starter parent's `native` profile already excludes it; if you configure the plugins yourself, reproduce that exclusion rather than hoping.

## Interview questions

**★ Why are Spring's AOT restrictions harsher in a native image than on the JVM, given that they are the same restrictions?**
Because on the JVM they are optional and reversible: the same jar runs without `spring.aot.enabled` and behaves dynamically, so a mistake is a configuration change away from being fixed. In a native image the AOT-processed context is the only one in the binary, and there is no JVM underneath to fall back to. Add GraalVM's own rules — no runtime classpath, no lazy class loading, no dynamic class definition — and the artefact's behaviour is fully determined by the build. The restrictions are identical; the blast radius is not.

**★ Which still work in a native Boot application, properties or conditions?**
Properties. Values are resolved at run time exactly as before, so `@Value`, `@ConfigurationProperties` binding and environment-driven behaviour inside an existing bean all work. Conditions do not: they were evaluated during the build, and bean definitions that did not match were discarded. The confusing consequence is that a profile-specific *property file* still applies while the profile-specific *bean* it was written for may not exist.

**★ Show the migration for a feature flag implemented as `@ConditionalOnProperty`.**
Delete the condition, define every implementation unconditionally, and add a selector bean that reads the property at run time and returns the chosen implementation — a `switch` over the property value, throwing on an unknown value. Everything else injects the selector's type, not the implementations. The cost is that all implementations are now reachable, and with no lazy class loading they are resident from start-up, so the image is larger. That trade — flexibility paid for in bytes — is the honest summary of the whole restriction set.

**★ A team wants "build once, deploy everywhere" with a native image. Is it possible?**
Yes, but only if no structural difference between environments is expressed as bean presence. Every difference has to be a runtime property acting on beans that always exist. That is achievable and often a better design anyway, but it has to be an explicit rule with review enforcement, because a single `@ConditionalOnProperty` added later silently breaks it. The alternative — one build per environment — is legitimate, provided everyone understands that promotion between environments now means promoting a *rebuild*, and that the artefact tested in staging is not the artefact running in production.

**★ Why does `spring.main.lazy-initialization` lose most of its value in a native image?**
Because it defers bean instantiation, and the memory it used to save was largely class loading and the objects created during eager initialisation. In a native image there is no lazy class loading at all — Boot: *"everything shipped in the executables will be loaded in memory on startup"* — so the classes are resident regardless. It still delays constructor work, which can matter for start-up, but the footprint argument moves entirely to reducing what is *reachable*: fewer starters, fewer dependencies, fewer unconditional bean definitions.

**★ You must keep an optional integration that only some customers enable. How do you handle it in a native artefact?**
Three options, in order of preference. First, ship it always and gate it at run time on a property, accepting the size cost — simplest, one artefact, testable. Second, build two artefacts with different build-time conditions, and treat them as two products with two test runs. Third, if the integration is genuinely large and rarely used, move it out of the process entirely — a separate service or a sidecar — which sidesteps the closed world rather than fighting it. What does not work is `@ConditionalOnProperty` plus a hope that the customer's configuration will be read at start-up.

{/* FOOTER */}
