---
title: "Spring's AOT processing generates your bean definitions as ordinary Java source at build time, and it works on a plain JVM — you activate it with a Maven profile confusingly named native and a system property, and it composes with the JVM's AOT cache rather than competing with it"
sidebar_label: "06 · Spring AOT processing"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference**, "Packaging → Ahead-of-Time Processing
> With the JVM" ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot.html))
> and "Packaging → GraalVM Native Images → Introducing GraalVM Native Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/introducing-graalvm-native-images.html));
> and the **Spring Framework reference**, "Core Technologies → Ahead of Time Optimizations"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/aot.html)). Documented at
> Spring Boot 4.1.x / Spring Framework 7.0.x. 🔴 **No sandbox** — the one log fragment below is
> **quoted from the Spring Boot reference** and the generated Java is **quoted from the Spring Boot
> reference**; nothing here was built or run. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Two completely different things in this topic are called AOT and they are routinely confused. The
**AOT cache** ([05d](05d-the-aot-cache.md)) is a JVM feature that stores the *results* of work a
training run did. **Spring's AOT processing** is a build-time step that replaces some of that work
with generated source code, so it never happens at all. They are independent, they compose, and
Spring Boot says so in one sentence: *"AOT cache and Spring's AOT can be combined to further improve
startup time."***

## What it is

Spring Framework's own framing is the clearest statement of the idea:

> *"Spring's support for AOT optimizations is meant to inspect an `ApplicationContext` at build time
> and apply decisions and discovery logic that usually happens at runtime. Doing so allows building
> an application startup arrangement that is more straightforward and focused on a fixed set of
> features based mainly on the classpath and the `Environment`."*

🔴 **"Decisions and discovery logic that usually happens at runtime"** is the whole subject. A Boot
application's start-up is dominated by *deciding what to do*: scanning the classpath, parsing
`@Configuration` classes, evaluating `@Conditional`s, resolving `@Profile`s, generating proxies.
None of that changes between two runs of the same jar with the same properties — so it can be done
once, at build time, and written down.

What comes out is described precisely:

> *"A Spring AOT processed application typically generates:*
> - *Java source code*
> - *Bytecode (usually for dynamic proxies)*
> - *`RuntimeHints` for the use of reflection, resource loading, serialization, and JDK proxies"*

The hints are for GraalVM (topic 11). **The source code is useful on a plain JVM**, and that is what
this chunk is about.

## What the generated code looks like

Spring Boot's reference documents the transformation with a worked example. From this
`@Configuration` class:

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class MyConfiguration {

	@Bean
	public MyBean myBean() {
		return new MyBean();
	}
}
```

the AOT engine generates — the reference's own words are *"The Spring AOT process would convert the
configuration class above to code like this"*:

```java
import org.springframework.beans.factory.aot.BeanInstanceSupplier;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.support.RootBeanDefinition;

/**
 * Bean definitions for {@link MyConfiguration}.
 */
public class MyConfiguration__BeanDefinitions {

	/**
	 * Get the bean definition for 'myConfiguration'.
	 */
	public static BeanDefinition getMyConfigurationBeanDefinition() {
		Class<?> beanType = MyConfiguration.class;
		RootBeanDefinition beanDefinition = new RootBeanDefinition(beanType);
		beanDefinition.setInstanceSupplier(MyConfiguration::new);
		return beanDefinition;
	}

	/**
	 * Get the bean instance supplier for 'myBean'.
	 */
	private static BeanInstanceSupplier<MyBean> getMyBeanInstanceSupplier() {
		return BeanInstanceSupplier.<MyBean>forFactoryMethod(MyConfiguration.class, "myBean")
			.withGenerator((registeredBean) -> registeredBean.getBeanFactory().getBean(MyConfiguration.class).myBean());
	}

	/**
	 * Get the bean definition for 'myBean'.
	 */
	public static BeanDefinition getMyBeanBeanDefinition() {
		Class<?> beanType = MyBean.class;
		RootBeanDefinition beanDefinition = new RootBeanDefinition(beanType);
		beanDefinition.setInstanceSupplier(getMyBeanInstanceSupplier());
		return beanDefinition;
	}
}
```

The reference is careful to add *"The exact code generated may differ depending on the nature of
your bean definitions."*

🔴 **Read what has disappeared.** There is no annotation scanning, no `@Configuration` parsing, no
reflective invocation of `myBean()`. There is a direct method reference and a lambda. The comparison
the reference draws is explicit:

> *"When running on the JVM, `@Configuration` class parsing happens when your application starts and
> `@Bean` methods are invoked using reflection."*

versus, after AOT processing, generated code that creates *"equivalent bean definitions to the
`@Configuration` class, but in a direct way"*.

There is one more generated artefact that ties it together:

> *"An `ApplicationContextInitializer` will also be generated which will be used by Spring Boot to
> initialize the `ApplicationContext` when an AOT processed application is actually run."*

And the generated code is not hidden:

> *"Although AOT generated source code can be verbose, it is quite readable and can be helpful when
> debugging an application. Generated source files can be found in `target/spring-aot/main/sources`
> when using Maven and `build/generated/aotSources` with Gradle."*

⚠️ **Go and read that directory once.** It is the single best way to understand what your
auto-configuration actually decided, and it is a genuinely useful debugging artefact independent of
whether you ship it.

## Bean *definitions*, not bean *instances*

This distinction decides what AOT processing can and cannot do, and both references state it:

> *"During Spring AOT processing, your application is started up to the point that bean definitions
> are available. Bean instances are not created during the AOT processing phase."*

and, from the framework side, describing `refreshForAotProcessing`:

> *"Refresh an `ApplicationContext` for AOT processing. Contrary to a traditional refresh, this
> version only creates bean definitions, not bean instances."*

🔴 **So AOT processing runs your configuration but not your application.** Your `@Configuration`
classes are parsed and your conditions are evaluated at build time; your `@PostConstruct` methods,
your connection pools and your migrations are not run. That is why the build does not need a
database — and it is also why AOT processing does *not* remove any of the start-up costs listed in
[05f](05f-when-the-cache-helps.md). It removes *discovery*, not *initialisation*.

Note also that condition evaluation happens here:

> *"If bean definitions are guarded by conditions (such as `@Profile`), these are evaluated, and bean
> definitions that don't match their conditions are discarded at this stage."*

**Discarded at build time.** That is the source of every restriction in
[06b](06b-what-aot-processing-gives-up.md), and it is worth pausing on: the set of beans your
application can have is now a property of the artefact, not of the environment it runs in.

## What comes next

[06b](06b-enabling-spring-aot-on-the-jvm.md) is how you switch this on for a JVM deployment and how
it layers with the AOT cache. [06c](06c-what-aot-processing-gives-up.md) is the bill: every
restriction that follows from evaluating conditions at build time.

## Gotchas

**★ "Spring AOT" and "the AOT cache" are different things sharing a word.** One generates source
code at build time; the other stores classes, heap objects and profiles from a training run. They
compose. Almost every confused conversation about start-up optimisation in a Spring shop is this
collision, and the fastest way to end it is to ask which of the two artefacts the speaker means.

**★ AOT processing removes discovery, not initialisation.** *"Bean instances are not created during
the AOT processing phase."* Your connection pool still opens connections at start-up, your
migrations still run, your caches still warm. If those dominate your start-up budget, this changes
little — see [05f](05f-when-the-cache-helps.md) for the budget.

**★ Conditions are evaluated at build time and non-matching definitions are discarded.** *"bean
definitions that don't match their conditions are discarded at this stage."* The set of beans your
application can have becomes a property of the artefact rather than of the environment. That single
sentence generates every restriction in [06c](06c-what-aot-processing-gives-up.md).

**★ Read `target/spring-aot/main/sources` at least once.** The reference calls the generated code
*"quite readable"* and *"helpful when debugging"*. It is the most direct answer available to "what
did auto-configuration actually decide for this application", and it is useful even if you never
ship an AOT-processed build.

**★ The generated bytecode is for dynamic proxies.** *"Bytecode (usually for dynamic proxies)"* —
so anything relying on proxy creation at runtime now relies on something decided at build time.
That covers `@Transactional`, `@Async`, `@Cacheable` and Spring Security's method security.

**★ Generated hint files are for GraalVM and are inert on the JVM.** `RuntimeHints` become JSON
under `META-INF/native-image/...`. They cost a few kilobytes in a JVM deployment and do nothing
there. Do not go looking for a JVM effect from them, and do not delete them either — they are how
the same artefact stays buildable as a native image.

**★ AOT processing runs your configuration at build time, so the build now needs your properties.**
It does not need a live database — instances are not created — but conditions read the
`Environment`, so the build must supply enough configuration for the right decisions to be made.
Same constraint as the AOT-cache training run ([05c](05c-the-training-run.md)), same solution: a
build-time profile with inert but valid values.

**★ `proxyBeanMethods = false` in the example is not incidental.** The documented sample
configuration class uses it, and it is the configuration style AOT processing is designed around —
one fewer runtime proxy to generate. Reviewing your own `@Configuration` classes for it is a cheap
preparatory step.

**★ The generated class name is derived, not stable API.** `MyConfiguration__BeanDefinitions` is
what the reference shows, with the caveat that *"The exact code generated may differ depending on
the nature of your bean definitions."* Read it, do not depend on it, and never reference it from
hand-written code.

## Interview questions

**★ What is the difference between Spring's AOT processing and the JVM's AOT cache?**
Spring's AOT processing is a build-time source-generation step: it inspects the `ApplicationContext`
at build time and writes the bean definitions out as ordinary Java, so scanning, `@Configuration`
parsing and condition evaluation do not happen at runtime. The AOT cache is a JVM feature that
stores loaded and linked classes, heap objects and method profiles from a training run. One removes
work; the other caches the result of doing it. Spring Boot documents that they *"can be combined"*.

**★ What does the AOT engine actually generate, and what does it replace?**
Java source code for bean definitions, bytecode for dynamic proxies, and `RuntimeHints`. It replaces
runtime `@Configuration` parsing and reflective `@Bean` invocation with a `RootBeanDefinition` whose
instance supplier is a direct method reference or lambda — the reference's example shows
`beanDefinition.setInstanceSupplier(MyConfiguration::new)` where the JVM would otherwise have used
reflection.

**★ Why does AOT processing not need a database at build time?**
Because it builds bean *definitions*, not bean *instances*. The framework reference says the AOT
refresh *"only creates bean definitions, not bean instances"*, and Boot's says *"Bean instances are
not created during the AOT processing phase."* Configuration classes are parsed and conditions are
evaluated; `@PostConstruct` methods never run and no pool is opened.

**★ If a service's start-up is five seconds, how much of it can Spring AOT processing address?**
Only the discovery portion: classpath scanning, configuration parsing, condition evaluation and
proxy generation. Nothing for connection pool creation, schema migration, remote configuration
fetches or work deferred to the first request. For a large Boot application the discovery portion is
often substantial, but it is never the whole number — measure the budget before promising a figure.

**★ Why is the distinction between a bean definition and a bean instance central here?**
Because it is exactly the line AOT processing draws. Definitions are metadata: what the bean is,
how to make one. Instances are the objects. AOT processing computes all the metadata at build time
and leaves instantiation entirely at runtime — which is why it is safe to run in a build, and also
why it cannot help with anything that happens during instantiation.

**★ What would you look at first to understand why an AOT-processed application behaves
differently from the same jar without AOT?**
The generated sources, in `target/spring-aot/main/sources` for Maven or `build/generated/aotSources`
for Gradle. The differences are almost always about which bean definitions survived condition
evaluation at build time, and the generated code is a direct, readable record of that decision.

{/* FOOTER */}
