---
title: "AOT processing evaluates your conditions at build time, which means the set of beans your application can have stops being a property of the environment and becomes a property of the artefact — so @Profile is baked in, @ConditionalOnProperty stops responding, and 'build once, deploy everywhere' quietly ends"
sidebar_label: "06c · What AOT gives up"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Framework reference**, "Core Technologies → Ahead of
> Time Optimizations" ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/aot.html));
> the **Spring Boot reference**, "Packaging → Ahead-of-Time Processing With the JVM"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot.html)) and
> "Packaging → GraalVM Native Images → Introducing GraalVM Native Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/introducing-graalvm-native-images.html));
> and the **Spring Boot Maven plugin** reference, "Ahead-of-Time Processing"
> ([docs.spring.io](https://docs.spring.io/spring-boot/maven-plugin/aot.html)). Documented at Spring
> Boot 4.1.x / Spring Framework 7.0.x. 🔴 **No sandbox** — nothing here was built or run. JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[06](06-spring-boot-aot-processing.md) and [06b](06b-enabling-spring-aot-on-the-jvm.md) were about
what AOT processing does and how to switch it on. This chunk is the invoice. Every restriction below
follows from one sentence — conditions are evaluated at build time — and together they change what
your build artefact *is*. That is a deployment-model decision, and it deserves a conversation rather
than a flag in a `pom.xml`.**

## The one sentence everything follows from

The Spring Boot Maven plugin documentation states it in operational terms, which is the version to
quote in a design review:

> *"As the `BeanFactory` is fully prepared at build-time, conditions are also evaluated. This has an
> important difference compared to what a regular Spring Boot application does at runtime. For
> instance, if you want to opt-in or opt-out for certain features, you need to configure the
> environment used at build time to do so. The `process-aot` goal shares a number of properties with
> the `run` goal for that reason."*

and the framework reference states the effect on the definitions:

> *"If bean definitions are guarded by conditions (such as `@Profile`), these are evaluated, and bean
> definitions that don't match their conditions are discarded at this stage."*

🔴 **"Discarded" is permanent.** A bean definition that did not survive build-time condition
evaluation does not exist in the artefact. No runtime property can bring it back, because there is
nothing left to bring back.

## The documented restrictions, in full

Spring Boot's packaging reference:

> *"Beware that using the ahead-of-time processing has drawbacks. It implies the following
> restrictions:*
> - *The classpath is fixed and fully defined at build time*
> - *The beans defined in your application cannot change at runtime, meaning:*
>   - *The Spring `@Profile` annotation and profile-specific configuration have limitations.*
>   - *Properties that change if a bean is created are not supported (for example,
>     `@ConditionalOnProperty` and `.enabled` properties)."*

Spring Framework's reference adds three more that Boot's summary omits:

> *"`@Profile`, in particular profile-specific configuration, needs to be chosen at build time and is
> automatically enabled at runtime when AOT is enabled."*

> *"`Environment` properties that impact the presence of a bean (`@Conditional`) are only considered
> at build time."*

> *"Bean definitions with instance suppliers (lambdas or method references) cannot be transformed
> ahead of time."*

> *"Beans registered as singletons (using `registerSingleton`, typically from
> `ConfigurableListableBeanFactory`) cannot be transformed ahead of time either. As we cannot rely on
> the instance, make sure that the bean type is as precise as possible."*

## Restriction 1 — the profile is baked in and self-activating

This is the largest one and the one most often discovered late:

> *"`@Profile`, in particular profile-specific configuration, needs to be chosen at build time and is
> **automatically enabled at runtime when AOT is enabled**."*

🔴 **Read the second half.** The profile is not merely fixed — it turns itself on. The artefact
carries a decision about which profile it is, and asserts it at start-up.

The consequence is a direct contradiction of the deployment principle most teams operate under.
"Build one artefact, promote it through staging to production, changing only configuration" stops
being available for anything expressed as a profile. If `staging` and `prod` differ in which beans
exist, you now need **one build per environment** — the same source, the same commit, different
artefacts. That is a supply-chain change: your staging tests no longer exercise the bytes that go to
production.

⚠️ **The mitigation is to stop expressing environment differences as bean presence.** Configuration
*values* — endpoints, credentials, pool sizes, timeouts — are still read at runtime; it is only bean
*presence* that is frozen. Restructuring a `@Profile("prod")` configuration class into one always-
present bean whose behaviour is driven by injected properties makes the application AOT-compatible
and is better design regardless. That inference follows from the documented restriction being
specifically about *"properties that change if a bean is created"*; properties that change what an
existing bean does are not in scope.

## Restriction 2 — `@ConditionalOnProperty` stops responding

> *"Properties that change if a bean is created are not supported (for example,
> `@ConditionalOnProperty` and `.enabled` properties)."*

The pattern this breaks is extremely common: a feature flag implemented as
`@ConditionalOnProperty("feature.x.enabled")`. Under AOT processing that property is read **once, in
your build**, and the answer is compiled in.

Everything built on the same mechanism is affected, including a great deal of Spring Boot's own
auto-configuration — `.enabled` properties appear throughout Actuator, the metrics exporters, the
messaging starters and the security auto-configuration. **Turning something on in production by
setting a property becomes a rebuild.**

The Maven plugin documentation is the practical instruction here: *"if you want to opt-in or opt-out
for certain features, you need to configure the environment used at build time to do so"*, which is
why *"The `process-aot` goal shares a number of properties with the `run` goal."*

## Restriction 3 — the classpath is fixed

> *"The classpath is fixed and fully defined at build time"*

For a container image this is barely a restriction — the classpath was fixed the moment the image
was built. It matters for anything that adds jars at run time: a plugin directory, a customer-
supplied extension, a JDBC driver dropped in by an operator. Those patterns stop working, and they
tend to exist in exactly the kinds of long-lived internal platforms where nobody remembers they are
load-bearing.

## Restriction 4 — programmatic registration that AOT cannot see

Two forms of bean registration are documented as untransformable:

> *"Bean definitions with instance suppliers (lambdas or method references) cannot be transformed
> ahead of time."*

> *"Beans registered as singletons (using `registerSingleton`, typically from
> `ConfigurableListableBeanFactory`) cannot be transformed ahead of time either. As we cannot rely on
> the instance, make sure that the bean type is as precise as possible."*

⚠️ **The `registerSingleton` case has a subtle instruction attached.** Because AOT processing cannot
inspect the *instance*, the declared type is all it has — so *"make sure that the bean type is as
precise as possible."* Registering something as `Object` or as a broad interface, which works fine at
runtime because Spring can inspect the actual object, degrades what AOT can reason about.

The framework reference also gives the positive form of this rule for custom registration:

> *"If custom code needs to register extra beans programmatically, make sure that custom registration
> code uses `BeanDefinitionRegistry` instead of `BeanFactory` as only bean definitions are taken into
> account. A good pattern is to implement `ImportBeanDefinitionRegistrar`"*

🔴 **That is an actionable refactor**, and it is the reason the phrase "only bean definitions are
taken into account" is worth memorising: AOT sees definitions, never instances.

## Why these restrictions exist at all

They are native image's restrictions. Spring Boot's own explanation is explicit:

> *"Typical Spring Boot applications are quite dynamic and configuration is performed at runtime. In
> fact, the concept of Spring Boot auto-configuration depends heavily on reacting to the state of the
> runtime in order to configure things correctly. Although it would be possible to tell GraalVM about
> these dynamic aspects of the application, doing so would undo most of the benefit of static
> analysis. So instead, when using Spring Boot to create native images, a closed-world is assumed and
> the dynamic aspects of the application are restricted."*

⚠️ **So on the JVM you are accepting a closed-world assumption you do not technically need.** The JVM
can still load classes dynamically and evaluate conditions at runtime; you are opting out of that to
get the generated bean definitions. That is a defensible trade — but it is a much better trade if
you are heading for native image (topic 11) anyway, where the restrictions are non-negotiable.

## Gotchas

**★ `@Profile` is chosen at build time *and automatically enabled at runtime*.** Not just frozen —
self-asserting. An AOT-processed artefact declares which profile it is. "One artefact, many
environments" ends here for anything expressed as a profile.

**★ You now need one build per environment, or no profile-scoped beans.** Those are the two options.
The second is better: express environment differences as configuration *values* on beans that always
exist, not as bean presence.

**★ `@ConditionalOnProperty` becomes a build-time switch.** Feature flags implemented this way stop
being flags. Turning a feature on in production becomes a rebuild and a redeploy, which is a
materially different incident-response capability.

**★ `.enabled` properties throughout Boot's own auto-configuration are affected too.** This is not
only about your code. Actuator endpoints, exporters and starters use the same mechanism, so their
behaviour is fixed at build time as well.

**★ The build environment now determines the application's feature set.** *"you need to configure
the environment used at build time"*. Your CI configuration has become production configuration, and
it should be reviewed with the same seriousness — which most CI configuration is not.

**★ Values still work; only bean presence is frozen.** Properties injected into beans that exist are
read at runtime as usual. The documented restriction is specifically about *"properties that change
if a bean is created"*. This is the escape route, and the refactor it implies is good design anyway.

**★ `registerSingleton` beans cannot be transformed, and their declared type matters.** *"As we
cannot rely on the instance, make sure that the bean type is as precise as possible."* Registering as
a broad type works at runtime and hurts under AOT.

**★ Lambda and method-reference instance suppliers cannot be transformed.** A `BeanDefinition` whose
supplier is a lambda is opaque to build-time processing. Prefer `@Bean` methods or
`ImportBeanDefinitionRegistrar`.

**★ Programmatic registration must use `BeanDefinitionRegistry`, not `BeanFactory`.** *"only bean
definitions are taken into account."* Code that registers directly against the `BeanFactory` is
invisible to AOT processing and will simply be missing.

**★ The classpath cannot change at runtime.** Plugin directories, operator-dropped drivers and
customer extensions stop working. In a container this is usually already true; on a long-lived
internal platform it may not be.

**★ These are GraalVM's restrictions, adopted voluntarily on the JVM.** Boot's own explanation is
that a closed world *"is assumed"* for native images because telling GraalVM about the dynamism
*"would undo most of the benefit of static analysis"*. On the JVM you take the restrictions to get
the generated code. Fine — but know that is what you are doing.

**★ Testing must cover the AOT-processed artefact, not the plain one.** Since conditions were
evaluated at build time, the AOT build is a genuinely different application. A green test suite
against the non-AOT jar proves nothing about it — the same lesson as the `jlink` module set in
[04b](04b-jdeps-and-the-module-set.md).

## Interview questions

**★ What is the single most consequential restriction Spring AOT processing imposes, and why?**
That conditions are evaluated at build time and non-matching bean definitions are *"discarded at this
stage"*. Everything else follows. The set of beans becomes a property of the artefact rather than of
the environment, which breaks the "build once, promote everywhere" model for anything expressed as
`@Profile` or `@ConditionalOnProperty`.

**★ What exactly happens to `@Profile` under AOT?**
It *"needs to be chosen at build time and is automatically enabled at runtime when AOT is enabled."*
Two separate facts: the choice is frozen into the artefact, and the artefact asserts that profile
when it starts. So you cannot build one jar and select the profile at deploy time; you build one
artefact per profile, or you stop using profiles to control bean presence.

**★ Your feature flags are `@ConditionalOnProperty`. What breaks and what do you do about it?**
They stop being runtime flags — the property is read during the build and the answer is compiled in.
The fix is to make the bean unconditional and put the flag inside it, so the property controls
*behaviour* rather than *presence*. Configuration values are still read at runtime; only bean
presence is frozen. That refactor is also better design, because a flag that requires a rebuild is
not a flag.

**★ Why does the Maven plugin's `process-aot` goal share properties with the `run` goal?**
Because AOT processing starts an `ApplicationContext` and evaluates conditions against an
`Environment`, so it needs the same configuration a run would. The documentation is direct: *"if you
want to opt-in or opt-out for certain features, you need to configure the environment used at build
time to do so."* Your CI configuration has become part of your production configuration.

**★ Why can't AOT processing transform a bean registered with `registerSingleton`?**
Because it works on bean *definitions*, and a registered singleton is an *instance*. The reference
says *"we cannot rely on the instance"* and instructs you to make the declared type *"as precise as
possible"*, since the declared type is the only information available. The same reasoning covers bean
definitions whose instance supplier is a lambda.

**★ Are these restrictions inherent to the JVM path, or inherited?**
Inherited. They are the closed-world assumption GraalVM needs; Boot explains that telling GraalVM
about Spring's dynamism *"would undo most of the benefit of static analysis"*, so a closed world *"is
assumed"* instead. On the JVM you could keep the dynamism — you are giving it up to get the generated
bean definitions. Which makes the trade far more attractive if native image is where you are heading.

**★ How should you test an application that uses AOT processing?**
Against the AOT-processed artefact. Conditions were evaluated at build time, so the AOT build is a
different application from the plain jar, with a different set of beans. Running the suite against
the non-AOT build and shipping the AOT one is the same category of mistake as validating a `jlink`ed
runtime by running the tests on a full JDK.

{/* FOOTER */}
