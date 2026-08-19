---
title: "Registering configuration properties"
sidebar_label: "7 · Registering and prefixes"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · Type-safe Configuration Properties* (docs.spring.io/spring-boot/reference
> — `@EnableConfigurationProperties`, `@ConfigurationPropertiesScan` and its
> default scan package, `@Component` and `@Bean` registration, third-party
> configuration, the `<prefix>-<fqn>` bean-naming rule, the `@Name` annotation
> for reserved keywords, and configuration metadata generation), plus the
> Spring Boot 4.0 release notes for `@ConfigurationPropertiesSource`. Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`@ConfigurationProperties` on a class does nothing on its own. It is a
description of a binding, and something else has to decide that this particular
type should become a bean and be bound — which is why the annotation that looks
like the whole feature is only half of it. There are four ways to make that
decision, they are not interchangeable, and two of them quietly disable
constructor binding.**

## The prefix

The annotation's single argument is the prefix that every property in the type
hangs under:

```java
@ConfigurationProperties("my.service")
public record MyProperties(String host, int port, Duration readTimeout) {}
```

binds `my.service.host`, `my.service.port` and `my.service.read-timeout`.

Two rules about the prefix and they are both easy to get wrong:

- **The prefix is written in canonical form** — lowercase, kebab-case,
  dot-separated. `@ConfigurationProperties("myService")` is not an error and not
  what you want; it makes the properties `myservice.*` and nothing you write in
  a file will look like it.
- **The prefix is not repeated in the property names.** A field called
  `serviceHost` inside `@ConfigurationProperties("my.service")` binds
  `my.service.service-host`, which is the sort of thing that survives review and
  then reads badly in every deployment manifest forever.

## The four ways to register a type

| Route | Constructor binding? | Use it for |
|---|---|---|
| `@EnableConfigurationProperties(X.class)` | ✅ yes | library and starter code, explicit opt-in |
| `@ConfigurationPropertiesScan` | ✅ yes | application code — the default choice |
| `@Component` on the type | ❌ no | legacy JavaBean-style types |
| `@Bean` method + `@ConfigurationProperties` | ❌ no | third-party types you do not own |

**`@EnableConfigurationProperties`** names the types explicitly:

```java
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SomeProperties.class)
public class MyConfiguration { }
```

This is the right route inside a starter or a shared library, because the
properties type becomes a bean only when someone opts into the configuration
that enables it. Nothing is registered by accident on a consumer's classpath.

**`@ConfigurationPropertiesScan`** is the application-code equivalent of
component scanning:

```java
@SpringBootApplication
@ConfigurationPropertiesScan
public class MyApplication { }
```

It scans from the package of the declaring class downwards, and accepts explicit
packages when the types live elsewhere:

```java
@ConfigurationPropertiesScan({ "com.example.app", "com.example.another" })
```

⚠️ **`@SpringBootApplication` does not include it.** Component scanning and
configuration-properties scanning are separate switches, which is why a record
annotated `@ConfigurationProperties` in a scanned package can still fail to
appear as a bean.

**`@Component`** works and costs you constructor binding:

```java
@Component
@ConfigurationProperties("my.service")
public class MyProperties { /* getters and setters */ }
```

The container constructs the bean by dependency injection, so the `Binder` is
not the caller and only JavaBean binding is available
([chunk 5](05-constructor-binding-and-validation.md)). It is a legitimate choice
for an existing mutable type and the wrong default for new code.

**A `@Bean` method** is the route for a type you do not own:

```java
@Configuration(proxyBeanMethods = false)
public class ThirdPartyConfiguration {

    @Bean
    @ConfigurationProperties("another")
    public AnotherComponent anotherComponent() {
        return new AnotherComponent();
    }
}
```

Boot creates the object through your method and then binds `another.*` onto it
with setters. This is how a client library's own configuration object gets
populated from `application.yml` without wrapping it in a properties class of
your own — and, again, it is JavaBean binding, because the instance already
exists by the time the binder sees it.

## Bean naming, and why you rarely care

A registered configuration-properties bean is named
**`<prefix>-<fully qualified class name>`**. For
`@ConfigurationProperties("some.properties")` on `com.example.app.SomeProperties`
the bean name is `some.properties-com.example.app.SomeProperties`; with no
prefix, the fully qualified name alone.

That deliberate ugliness has a purpose. The name is unique per prefix-and-type
pair, so **registering the same type twice — once by scan and once by
`@EnableConfigurationProperties` — produces one bean rather than a conflict**,
and nobody is tempted to inject it by name. You inject it by type like any other
bean:

```java
@Service
public class MyService {

    private final MyProperties properties;

    public MyService(MyProperties properties) {
        this.properties = properties;
    }
}
```

## Metadata, and why your IDE completes some keys and not others

The `spring-boot-configuration-processor` annotation processor reads your
`@ConfigurationProperties` types at compile time and emits a metadata file
describing every key, its type, its default and its Javadoc. That file is what
gives IDE completion and inline documentation for your own properties, exactly
as it does for Boot's.

🔴 **Boot 4 adds `@ConfigurationPropertiesSource`** for the case that used to
produce silence: a properties type that refers to a type living in a *different
module*. The processor cannot see into that module's sources, so the nested
type's keys were absent from the metadata. Adding the annotation processor to
that module and flagging the type with `@ConfigurationPropertiesSource` makes
its metadata available to the module that binds it.

Metadata is optional in the sense that binding works without it, and not
optional in the sense that anyone maintaining the application will judge the
configuration by whether their editor knows about it.

## The trade-off

Four registration routes is more surface than a feature like this deserves, and
the reason they all exist is that they answer different questions: who opts in
(library versus application), and who constructs the object (the binder versus
the container). The cost of that flexibility is a failure mode with no message —
a type annotated correctly, registered by nobody, injected nowhere, and
therefore never noticed until someone wonders why a setting has no effect.

The mitigation is a convention rather than a mechanism: **`@ConfigurationPropertiesScan`
once, at the application class, and `@EnableConfigurationProperties` in library
code.** Two routes, chosen by which kind of code you are writing, and the other
two reserved for the cases that force them.

## Gotchas

**Symptom:** a `@ConfigurationProperties` record in a scanned package never becomes a bean
**Cause:** `@SpringBootApplication` enables component scanning, not configuration-properties scanning; the two are separate switches
**Fix:** add the scan explicitly:
```java
@SpringBootApplication
@ConfigurationPropertiesScan
public class MyApplication { }
```

**Symptom:** properties bind under `myservice.*` although the annotation says `myService`
**Cause:** the prefix is normalised to canonical form, and camelCase in a prefix simply lowercases
**Fix:** write the prefix in kebab-case — `@ConfigurationProperties("my-service")` or `@ConfigurationProperties("my.service")` — so the file and the annotation agree

**Symptom:** every key reads as `my.service.service-*` in deployment manifests
**Cause:** the prefix was repeated in the field names — `serviceHost` inside prefix `my.service`
**Fix:** drop the redundant word from the field; the prefix already supplies it

**Symptom:** the same properties type is registered by a scan and by `@EnableConfigurationProperties`, and nothing fails
**Cause:** the bean name is derived from prefix plus fully qualified class name, so both registrations resolve to one bean
**Fix:** nothing is broken — but remove the redundant one, because a reader cannot tell which registration is load-bearing

**Symptom:** a third-party client object ignores `application.yml`
**Cause:** it has no `@ConfigurationProperties` annotation of its own and nothing bound it
**Fix:** bind it where you create it:
```java
@Bean
@ConfigurationProperties("another")
public AnotherComponent anotherComponent() { return new AnotherComponent(); }
```

**Symptom:** the IDE completes Boot's properties but not your own
**Cause:** `spring-boot-configuration-processor` is not on the build's annotation-processor path — or, in a multi-module build, the nested type lives in a module the processor cannot see
**Fix:** add the processor, and in the cross-module case flag the shared type with `@ConfigurationPropertiesSource` so its metadata is exported

**Symptom:** a library's properties type appears as a bean in every application that puts the library on its classpath
**Cause:** it is annotated `@Component`, so ordinary component scanning picks it up wherever the package is scanned
**Fix:** register it from the library's own `@Configuration` with `@EnableConfigurationProperties`, so it exists only when the consumer opts into that configuration

## Interview questions

**★ What are the ways to register a `@ConfigurationProperties` type, and how do you choose?**
Four. `@EnableConfigurationProperties(X.class)` names types explicitly and is
the right choice inside a library or starter, because nothing is registered
unless a consumer opts into the configuration that enables it.
`@ConfigurationPropertiesScan` scans from its declaring class's package and is
the default for application code. `@Component` on the type works but forces
JavaBean binding. A `@Bean` method annotated `@ConfigurationProperties` binds a
third-party object you did not write. The first two support constructor binding;
the last two do not, because on those routes the container constructs the object
rather than the binder.

**★ Does `@SpringBootApplication` enable configuration-properties scanning?**
No, and this catches people regularly. `@SpringBootApplication` bundles
`@ComponentScan`, `@EnableAutoConfiguration` and `@Configuration` —
`@ConfigurationPropertiesScan` is a separate annotation you add yourself. The
symptom is a correctly annotated record that never becomes a bean and produces
no error, because nothing was ever asked to register it.

**★ How is a configuration-properties bean named, and does it matter?**
It is named `<prefix>-<fully qualified class name>` — for example
`some.properties-com.example.app.SomeProperties`. It matters for exactly one
reason: the name is a deterministic function of the prefix and the type, so
registering the same type through two routes yields one bean instead of a
conflict. Otherwise the name is deliberately unusable, which is a hint that you
should inject the type rather than the name.

**★ How do you bind configuration onto a class you do not own?**
Create it in a `@Bean` method and put `@ConfigurationProperties` on that method.
Boot constructs the object through your factory method and then binds the
properties under the prefix onto it via setters. It is the standard way to drive
a third-party client's own settings object from `application.yml` rather than
mirroring every field into a class of your own — and it is necessarily JavaBean
binding, since the instance exists before the binder sees it.

**★ Why does the prefix have to be kebab-case?**
Because the prefix participates in the canonical name, and the canonical name is
the one form every property source can express. A camelCase prefix is not
rejected — it is lowercased — so `@ConfigurationProperties("myService")` silently
becomes `myservice.*`, and every file, environment variable and manifest written
against `my-service` or `my.service` then binds nothing.

**★ What is the configuration metadata processor for, and what changed in Boot 4?**
`spring-boot-configuration-processor` reads your `@ConfigurationProperties` types
at compile time and emits a descriptor of every key, its type, its default and
its Javadoc, which is what drives IDE completion and inline documentation for
your own settings. Boot 4 adds `@ConfigurationPropertiesSource` for the
multi-module case: when a properties type refers to a type from another module,
the processor cannot see that module's sources, so its keys were missing from
the metadata. Flagging the shared type exports it.

**★ A colleague puts `@Component` on every properties class. What do you tell them?**
That it works and costs them the thing they probably wanted. `@Component` makes
the container construct the bean by dependency injection, so constructor binding
is unavailable and the type has to be a mutable JavaBean with setters. It also
registers the type anywhere the package is scanned, which is the wrong behaviour
for a library. The two-route convention is simpler and better:
`@ConfigurationPropertiesScan` once in an application, `@EnableConfigurationProperties`
in library code.

---

← Prev: [Defaults, absence and validation](06-defaults-and-validation.md) · Index: [Configuration and profiles](README.md) · Next → [Typed properties versus `@Value`](08-typed-properties-vs-value.md)
