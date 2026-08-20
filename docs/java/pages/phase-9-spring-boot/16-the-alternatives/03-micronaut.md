---
title: "Micronaut: dependency injection with the reflection taken out"
sidebar_label: "3 · Micronaut"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the Micronaut user guide
> (docs.micronaut.io/latest/guide/) — *Inversion of Control*, *Bean
> Introspection*, *Aspect Oriented Programming* and *Using Project Lombok* —
> and the release announcements for Micronaut Framework 5.0.0
> (micronaut.io/2026/05/20/) and 5.1.0 (micronaut.io/2026/07/27/). Spring Boot
> 4.1.0 is the comparison baseline; JDK 25.

**Micronaut is the framework a Spring developer can read on sight and get
wrong the fastest. Its annotations rhyme with Spring's, its project layout
rhymes with Spring Boot's, and underneath it is a completely different machine:
every bean definition, every AOP proxy and every HTTP client is a class written
by an annotation processor during `javac`, and the running application performs
no classpath scan and no reflective wiring at all. The guide states the design
goals as rules — "Use reflection as a last resort", "Avoid runtime-generated
proxies", "No runtime bytecode generation" — and almost everything surprising
about Micronaut is one of those three rules being enforced somewhere you did
not expect.**

## The mechanism: an annotation processor that writes your container

Micronaut's DI is implemented by a standard `javax.annotation.processing`
annotation processor (plus AST transformations for Groovy and KSP for Kotlin).
For each bean it emits a class implementing `BeanDefinition`, holding the
constructor arguments, the injection points and the annotation metadata as
*compiled data* rather than as something to be discovered.

```java
@Singleton
public class OrderService {

    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }
}
```

You get a generated `BeanDefinition` alongside `OrderService.class` in your
build output. Micronaut 5.0 went further and added *precomputed bean indexes*
and compile-time `@Replaces` handling, explicitly to reduce what remains at
runtime.

The guide makes the memory argument directly, and it is the sharpest one-line
statement of the difference anywhere in this topic: reflection-based frameworks
*"load and cache reflection data for every single field, method, and
constructor in your code. Thus, as your code grows in size so do your memory
requirements, whilst with Micronaut this is not the case."*

🔴 **Read that carefully — it is a claim about *scaling*, not about a constant.**
The argument is that Spring's metadata cost grows with your codebase and
Micronaut's does not, because the metadata is compiled artifacts rather than
runtime caches. That is a much more defensible claim than any startup number,
and it is the one to reach for in an argument.

## `@Introspected`: reflection-free bean introspection

Removing reflection from wiring is not enough, because serialisation, validation
and configuration binding all need to read your properties. Micronaut's answer
is `BeanIntrospection`, generated at compile time from `@Introspected`:

```java
@Introspected
public record OrderRequest(String sku, int quantity) { }
```

That annotation is what makes the type readable — by the JSON layer, by the
validator, by anything that needs property metadata — without
`java.lang.reflect`. Micronaut 5.0 pushed this further again: serializers and
deserializers are now *generated at build time* with SourceGen rather than
resolved at runtime.

🔴 **This is the single most common "why doesn't my DTO work" cause in
Micronaut, and it has no Spring equivalent** — in Spring, Jackson simply
reflects and it works. Here, a type with no introspection has no properties as
far as the framework is concerned. Note that types you *own* and annotate are
easy; the awkward case is a class from a dependency, which is what
`@Introspected(classes = { ThirdPartyThing.class })` on a configuration class
exists for.

## AOP without a runtime proxy

Micronaut has full AOP — `@Around` advice, `@Introduction` advice, the usual
shapes — but the proxy classes are generated during compilation, not written
into the heap by cglib at refresh time.

The practical consequences:

- The proxy is a real class you can see in your build output and step through.
- Advice is applied by annotation, at compile time, so an interception you did
  not expect is traceable to a generated file rather than to a
  `BeanPostProcessor` you have to reason about.
- ⚠️ **Self-invocation still does not go through the proxy.** This is not a
  Spring quirk that Micronaut fixed; it is what proxy-based interception means
  in both frameworks. The picture in
  [Topic 02 — Proxies and self-invocation](../02-the-ioc-container/05-proxies-and-self-invocation.md)
  transfers directly.

`@Introduction` advice is the mechanism behind the declarative HTTP client — you
declare an interface annotated `@Client` and the implementation is generated at
build time. Structurally this is the same idea as Spring Framework 7's
`@ImportHttpServices` and HTTP service interfaces, arrived at from the other
direction.

## Why it feels like Spring, and where that hurts

The overlap is real and deliberate. `@Singleton`, `@Inject`, `@Controller`,
`@ConfigurationProperties`, `@Value`, constructor injection, a
`src/main/resources/application.yml`. A Spring developer is productive quickly.
That is the selling point.

The confusion is that identical-looking annotations have different resolution
rules, because one set is resolved at compile time and the other at runtime:

| You expect (Spring) | Micronaut |
|---|---|
| A bean is found because it is on the classpath under a scanned package | A bean exists because a `BeanDefinition` was *generated for it* — if the processor did not run, it does not exist |
| Conditional beans decided from the live `Environment` | Much is decided at compile time; runtime conditions exist but are a narrower tool |
| Jackson reflects over any POJO | Nothing is readable without `@Introspected` metadata |
| Proxies materialise at refresh | Proxies are files in `build/classes` |
| Adding a JAR can change behaviour | Adding a JAR changes nothing until something is recompiled |

## Micronaut versions, as of writing

| Release | Date | What it carried |
|---|---|---|
| **Micronaut Framework 5.0.0** | **20 May 2026** | **JDK 25 baseline**, Apache Groovy 5, Kotlin 2.3; precomputed bean indexes; compile-time `@Replaces`; JSpecify `@NullMarked` across the API; build-time serde generation via SourceGen; GraalVM updated to 25.0.3 |
| **Micronaut Framework 5.1.0** | **27 July 2026** | Explicit `@Introspected.Property`, sequenced-collection injection, CDI integration hooks, configuration-based logger levels, per-service client SSL on by default |
| 4.10.x | maintained alongside | the previous line |

Note the JDK 25 baseline — that is *higher* than Spring Boot 4.1's JDK 17
baseline, and for a team on an older JDK it is a hard gate rather than a
preference.

## Gotchas

**⚠️ The annotation processor is not configured, and nothing exists**
**Symptom:** `NoSuchBeanException` for a class that is obviously annotated
`@Singleton`, or the application starts with an empty context.
**Cause:** No processor run means no `BeanDefinition` was generated. This is the
defining failure mode of every compile-time-DI framework.
**Fix:** Declare the processor in the build — `annotationProcessor` in Gradle,
`annotationProcessorPaths` in the `maven-compiler-plugin` configuration — and
confirm generated classes actually appear in `build/classes` or `target/classes`
before debugging anything else.

**⚠️ Your IDE disagrees with your build tool**
**Symptom:** It runs from Gradle or Maven and fails when launched from the IDE,
or vice versa.
**Cause:** IDEs have their own annotation-processing switch and it is often off
or stale.
**Fix:** Enable annotation processing in the IDE and point it at the same
processor path; when in doubt, delete the output directory and do a full build
rather than an incremental one.

**⚠️ Stale generated classes after a rename**
**Symptom:** A bean that no longer exists in source is still being injected, or
an old constructor signature is used.
**Cause:** Incremental compilation left the previous generated class behind.
**Fix:** Clean the build. This is worth learning as a reflex — in a
compile-time framework, "have I actually recompiled" is a legitimate first
diagnostic step in a way it never is with Spring.

**⚠️ A DTO serialises as `{}`**
**Symptom:** A response body is empty, or request binding leaves every field
null.
**Cause:** The type has no `@Introspected` metadata, so the framework can see no
properties.
**Fix:** Annotate the type `@Introspected`, or for a type you do not own,
register it from a class you do:
`@Introspected(classes = { ThirdPartyThing.class })`.

**⚠️ Lombok and the Micronaut processor in the same compilation**
**Symptom:** Beans or properties are missing for Lombok-generated members.
**Cause:** Two annotation processors in one `javac` run, and the order in which
they see the source matters.
**Fix:** Follow the user guide's dedicated **Using Project Lombok** section
(*Language Support* chapter) — it exists precisely because this combination
needs specific build configuration. ⚠️ I have not reproduced the exact ordering
here and will not guess at it; read that section rather than copying a snippet
from a blog post.

**⚠️ Assuming a runtime property can turn a bean on and off**
**Symptom:** A conditional-bean pattern ported from Spring does not behave the
same way.
**Cause:** Micronaut resolves much of the graph at compile time; the runtime
conditional surface is deliberately narrower than Spring's.
**Fix:** Model the choice as *which implementation is injected* — an interface
with implementations selected by `@Requires` — rather than as a bean that
conditionally does not exist, and verify the specific condition annotation you
need is supported before designing around it.

## Interview questions

**★ Micronaut says it avoids runtime-generated proxies, but it has full AOP. How do both things hold?**
Because the proxies are generated at compile time by the annotation processor
and shipped as ordinary classes in the artifact. The claim is about *when* the
bytecode is written, not about whether proxying happens. Practically this means
the proxy is a file you can open, decompile and step through, and that GraalVM's
static analysis can see it — which is the whole reason it matters. It also
means the self-invocation limitation is unchanged: calling an advised method
from inside the same object still bypasses the proxy, exactly as in Spring.

**★ What is `@Introspected` for, and why does Spring not need an equivalent?**
It generates compile-time metadata about a type's properties and constructors
so the framework can read and write them without `java.lang.reflect`. Spring
does not need one because Spring is happy to reflect — Jackson, the validator
and the configuration binder all just reflect over whatever POJO you hand them.
Micronaut's whole position is that reflection metadata is a cost that grows with
your codebase, so it makes you declare the types that need introspection. The
price is that a type you forget to annotate is invisible, which produces empty
JSON rather than an exception, and that is the failure mode to recognise.

**★ Micronaut's annotations look like Spring's. Is that good or bad?**
Both, and I would say it out loud when onboarding. It is good because the
learning curve for a Spring team is genuinely short and most code reads
correctly on first sight. It is bad because identical annotations have
different resolution semantics — a bean exists because a processor generated a
definition, not because a class is on a scanned classpath — and that difference
does not show up until something does not work. The specific traps are: nothing
exists if the processor did not run, nothing is serialisable without
introspection metadata, and runtime conditionals are a narrower tool than
Spring's.

**★ Why does the "reflection metadata grows with your codebase" argument matter more than a startup benchmark?**
Because it is a claim about a mechanism rather than a measurement of one
application on one machine. A startup number depends on the dependency set, the
bean count, the JDK, the CPU and whether anyone warmed the page cache, so it
transfers to nothing. "Reflection caches scale with the number of fields,
methods and constructors in your code" is a structural property you can check
against your own situation: a small service will not notice it, and a
monolith with thousands of beans might. Arguments that survive being applied to
someone else's codebase are the ones worth making.

**★ Your team is on JDK 21. Does that affect the Micronaut conversation?**
Yes, materially. Micronaut Framework 5.0 moved to a JDK 25 baseline, so the
current line is not an option until the platform moves — you would be choosing
the 4.10.x line and inheriting its support window. Spring Boot 4.1 still has a
JDK 17 baseline, so the same constraint does not apply there. That is exactly
the kind of unglamorous fact that decides a framework choice in practice, and
it is worth establishing before anyone discusses architecture.

**★ A Micronaut application fails with `NoSuchBeanException` for a class that is clearly `@Singleton`. How do you diagnose it?**
I would not start in the source at all — I would look in `build/classes` or
`target/classes` for the generated `BeanDefinition` companion. If it is not
there, the annotation processor did not run for that compilation unit, and the
cause is almost always build configuration: a missing `annotationProcessor`
entry in Gradle or `annotationProcessorPaths` in the Maven compiler plugin, an
IDE with annotation processing switched off, or an incremental build that left
stale output. If the definition *is* there, then it is a real resolution problem
— a qualifier, a `@Requires` condition, or an ambiguity — and that is a
different investigation. Separating "was it generated" from "was it resolved" is
the whole diagnostic, and it is a step Spring has no equivalent of.

---

← Prev: [Quarkus](02-quarkus.md) · Index: [16 · The alternatives](README.md) · Next → [Helidon, and the rest of the field](04-helidon-and-the-rest.md)
