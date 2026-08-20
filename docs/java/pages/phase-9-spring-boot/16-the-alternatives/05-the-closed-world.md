---
title: "Native image: the closed world, and what it makes you declare"
sidebar_label: "5 · The closed world"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the GraalVM Native Image reference *Reachability
> Metadata* (graalvm.org/latest/reference-manual/native-image/metadata/) and the
> Spring Boot reference *Introducing GraalVM Native Images* and *Advanced Native
> Images Topics* (docs.spring.io/spring-boot/reference/packaging/native-image/).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Native image is the most oversold technology in the Java ecosystem and the
one most worth understanding accurately, because the pitch — instant startup,
small footprint — is true, and the cost is paid somewhere the pitch never
mentions. This chunk is the mechanism: what the closed-world assumption
forbids, what Spring forbids on top of it, and what you have to declare by hand
to get anything dynamic working. The next chunk is the bill.**

## The closed-world assumption is the whole thing

`native-image` performs static analysis starting from `main` and compiles only
what it proves reachable. Spring Boot's reference lists the consequences
directly:

- Static analysis is performed **at build time, from the `main` entry point**.
- **Unreachable code is removed** and will not be in the executable.
- GraalVM **must be explicitly told** about reflection, resources,
  serialization and dynamic proxies.
- The **classpath is fixed at build time and cannot change**.
- There is **no lazy class loading** — everything in the executable is loaded
  into memory at startup.
- **Some Java features are not fully supported.**

Read the third and fourth points together and you have the actual problem.
Every dynamic mechanism the Java ecosystem is built on — a JPA provider
reflecting over your entities, Jackson binding a class it discovered at
runtime, a logging framework loading an implementation by name, a JDBC driver
found by `ServiceLoader` — is invisible to static analysis and has to be
declared.

## Spring's additional restrictions on top

Spring does not merely inherit GraalVM's limits; it adds its own, and the
documentation is unusually blunt about them. Under the closed-world assumption:

- **Beans defined in your application cannot change at runtime.**
- **`@Profile` has limitations**, and profile-specific configuration is
  restricted.
- **Properties that affect bean creation are unsupported** — the documentation
  names `@ConditionalOnProperty` and `.enabled` properties specifically.

🔴 **That third bullet deletes a pattern most Spring codebases use.** A
`feature.x.enabled=false` flag that removes a bean is ordinary Spring, it is how
much of the auto-configuration in your application already works
([Topic 05 chunk 6](../05-auto-configuration/06-property-and-environment-conditions.md)),
and it does not survive the transition. This is not a bug to be fixed later; it
is the closed-world assumption doing exactly what it says. Audit your
conditionals *before* you estimate a native migration, not after.

## Reachability metadata, and the errors it prevents

GraalVM's own documentation explains why the metadata exists: *"determining
dynamically-accessed application elements via static analysis is infeasible as
reachability of those elements depends on data that is available only at run
time."*

| Dynamic feature | What happens without metadata |
|---|---|
| **Reflection** | `Class.forName()` and friends throw `MissingReflectionRegistrationError` |
| **JNI** | native code accessing Java members throws `MissingJNIRegistrationError` |
| **Dynamic proxies** | `java.lang.reflect.Proxy` needs its interface list declared up front |
| **Resources** | classpath files and resource bundles must be registered to be embedded |
| **Serialization** | `Serializable` types need metadata for reflective access |

Three ways to supply it:

1. **JSON files under `META-INF/native-image/`** — hand-written or generated.
2. **The tracing agent**, which observes a *running* application and writes the
   configuration out:
   ```bash
   java -agentlib:native-image-agent=config-output-dir=src/main/resources/META-INF/native-image \
        -jar my-app.jar
   ```
3. **The GraalVM Reachability Metadata Repository** — a central repository of
   prebuilt metadata for popular libraries, which Spring's documentation names
   as what it relies on for third-party support.

🔴 **The tracing agent's flaw is structural and you must internalise it.** It
records the code paths that *actually executed during that run*. A reflective
call on an error path you did not exercise produces no metadata, the build
succeeds, and the failure appears in production on the day that path is taken.
The mitigation is to run the agent over your full test suite rather than over a
happy-path smoke test — and to accept that your metadata is only as complete as
your coverage.

## What Spring AOT generates, and where to look for it

`spring-boot-maven-plugin`'s AOT processing is what makes a Spring application
analysable at all. It produces three kinds of artifact.

**1. Generated source** — `@Configuration` classes become explicit bean
definitions:

```java
// You wrote this
@Configuration(proxyBeanMethods = false)
public class MyConfiguration {
    @Bean
    public MyBean myBean() { return new MyBean(); }
}

// Spring AOT generates this
public class MyConfiguration__BeanDefinitions {
    public static BeanDefinition getMyBeanBeanDefinition() {
        RootBeanDefinition beanDefinition = new RootBeanDefinition(MyBean.class);
        beanDefinition.setInstanceSupplier(getMyBeanInstanceSupplier());
        return beanDefinition;
    }
}
```

**2. GraalVM hint files** in `META-INF/native-image/{groupId}/{artifactId}/` —
`reflect-config.json`, `resource-config.json`, `serialization-config.json`,
`proxy-config.json`, `jni-config.json`.

**3. Proxy classes** — the cglib bytecode that would normally have been
generated in the heap, written to disk instead.

Where they land:

| | Maven | Gradle |
|---|---|---|
| sources | `target/spring-aot/main/sources` | `build/generated/aotSources` |
| resources (hints) | `target/spring-aot/main/resources` | `build/generated/aotResources` |
| classes (proxies) | `target/spring-aot/main/classes` | `build/generated/aotClasses` |

**Read those directories when a native build misbehaves.** They are the single
most useful debugging artifact in the whole flow and almost nobody opens them.

## Writing and testing your own hints

When the generated hints are not enough, you supply them yourself:

```java
public class MyHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.resources().registerPattern("config/app.json");
    }
}

@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(MyHints.class)
class MyConfig { }
```

`@RegisterReflectionForBinding` covers the common JSON-binding case, and
`RuntimeHintsPredicates` lets you *test* that a hint was registered — which is
the only way to catch a missing hint without a full native build.

One documented trap worth naming on its own: nested configuration properties
that are **not** inner classes must be annotated `@NestedConfigurationProperty`
to be bindable in a native image.

```java
@ConfigurationProperties("my.properties")
public class MyProperties {
    @NestedConfigurationProperty
    private final Nested nested = new Nested();
}
```

## Gotchas

**⚠️ The tracing agent produced metadata and it still fails in production**
**Symptom:** `MissingReflectionRegistrationError` on a code path that has been
live for weeks.
**Cause:** The agent only recorded what ran during the training run. Error
handlers, admin endpoints and rare branches were never exercised.
**Fix:** Run the agent across the full test suite rather than a smoke test, then
convert what it finds into explicit `RuntimeHintsRegistrar` code and assert it
with `RuntimeHintsPredicates` in a unit test, so a later refactor cannot
silently drop an entry.

**⚠️ `@ConditionalOnProperty` silently stops working**
**Symptom:** A feature flag that removed a bean on the JVM has no effect in the
native binary.
**Cause:** Documented and expected — properties that affect bean creation are
unsupported under the closed-world assumption.
**Fix:** Move the decision inside the bean (inject the flag and branch on it), or
select the implementation at build time with a Maven or Gradle profile. Do not
try to make the condition work; it cannot.

**⚠️ Configuration properties bind to null**
**Symptom:** A nested properties object is empty in native and populated on the
JVM.
**Cause:** The nested type is not an inner class and carries no
`@NestedConfigurationProperty`.
**Fix:** Annotate it, exactly as shown above. This one is documented,
mechanical, and still catches people because the JVM run gives no warning at
all.

**⚠️ `@Profile`-based configuration behaves differently**
**Symptom:** A profile that swapped an implementation on the JVM does not swap
it in the binary.
**Cause:** Spring's native documentation states `@Profile` has limitations and
profile-specific configuration is restricted under the closed world.
**Fix:** Treat profiles as a JVM-time convenience and move genuine build-variant
decisions into the build — a separate Maven profile producing a separate
artifact is explicit, analysable, and does not depend on runtime evaluation.

## Interview questions

**★ Explain the closed-world assumption and one thing it takes away from you.**
`native-image` compiles only the code it can prove reachable by static analysis
from `main`, with the classpath fixed at build time and no lazy class loading.
Anything found dynamically — reflection, resource lookups, JDK proxies,
serialization — is invisible to that analysis and must be declared as
reachability metadata. The thing it takes away that surprises Spring developers
most is property-driven bean creation: Spring's documentation states that
properties affecting bean creation, including `@ConditionalOnProperty` and
`.enabled` properties, are unsupported. A feature flag that removes a bean is a
pattern you redesign, not a setting you fix.

**★ What does Spring AOT actually produce, and why does it exist?**
Three things: generated Java source that turns `@Configuration` classes and
`@Bean` methods into explicit `BeanDefinition` code a static analyser can
follow; JSON hint files under `META-INF/native-image/` covering reflection,
resources, serialization, proxies and JNI; and the cglib proxy classes written
to disk instead of generated into the heap. It exists because Spring's normal
mechanisms — scanning, reflection, runtime proxies — are precisely what native
image cannot see, so AOT reconstructs a statically analysable equivalent of the
container. It is worth knowing the output directories, because reading
`target/spring-aot/main/` is the fastest way to diagnose a native build.

**★ Why is the tracing agent not a complete solution?**
Because it is a recording of one execution, not an analysis of the program. It
captures the reflection, resource access and proxy creation that actually
happened during the run, so any path you did not exercise contributes nothing.
That makes your reachability metadata a function of your test coverage, and it
means the characteristic native-image production incident is a rare error path
failing with `MissingReflectionRegistrationError` long after release. It is a
good starting point and a bad final answer — what it generates should be
reviewed and turned into explicit, tested hints.

**★ How do you catch a missing hint without doing a full native build every time?**
Test the hints directly. `RuntimeHintsPredicates` builds assertions against a
`RuntimeHints` instance, so a plain unit test can assert that the reflection or
resource registration you rely on is present. That turns a class of failure that
otherwise only appears after a multi-minute native compile — or worse, in
production — into a fast, ordinary test failure. It is the highest-leverage
practice in the whole native workflow and it is routinely skipped.

---

← Prev: [Helidon and the rest](04-helidon-and-the-rest.md) · Index: [16 · The alternatives](README.md) · Next → [What native image costs](06-what-native-image-costs.md)
