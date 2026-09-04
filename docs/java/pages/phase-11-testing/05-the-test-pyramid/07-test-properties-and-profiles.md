---
title: "Test properties have a documented precedence order and a documented trap in the same paragraph — the values win over everything the application configured, and the exact characters you typed become part of the context cache key, so two spellings of one property build two applications"
sidebar_label: "07 · Test properties"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Context Management → Context Configuration with Test Property Sources*
> ([property-sources](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/property-sources.html));
> the precedence list, the key/value syntaxes, the default-file convention, the inheritance
> attributes and the cache warning are all read from that page.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> **No sandbox** — Java source and configuration only.

**Test properties are how a test says "in this context, the world is configured like *this*" —
a different database URL, a feature flag on, a timeout short enough to assert on. The mechanism is
simple. What is not simple is that it sits directly on top of the context cache
([05](05-the-context-cache.md)), so the way you *write* a property matters as much as what it
says.**

## `@TestPropertySource`, two ways

**From a file:**

```java
@ContextConfiguration
@TestPropertySource("/test.properties")
class MyIntegrationTests { }
```

Paths are flexible: a plain path like `"test.properties"` is a classpath resource relative to the
test class's package; a leading `/` makes it classpath-absolute; `classpath:`, `file:` and `http:`
prefixes work; and since Spring 6.1 resource *patterns* like `"classpath*:/config/*.properties"`
are supported.

**Inline:**

```java
@ContextConfiguration
@TestPropertySource(properties = {"timezone = GMT", "port = 4242"})
class MyIntegrationTests { }
```

Three key/value syntaxes are accepted — `key=value`, `key:value` and `key value` — and since
Spring 6.1 a text block reads much better for more than two:

```java
@TestPropertySource(properties = """
    timezone = GMT
    port = 4242
    """)
```

In Spring Boot you will more often write `@SpringBootTest(properties = …)`, which is the same
mechanism reached through Boot's annotation.

## 🔴 The precedence order

Highest wins:

1. **`@DynamicPropertySource` properties** — see [07b · Profiles and dynamic properties](07b-profiles-and-dynamic-properties.md)
2. **Inlined properties** — the `properties` attribute
3. **Properties from resource locations** — the `locations` attribute
4. Operating system environment variables
5. Java system properties
6. Application properties — `@PropertySource`, or added programmatically

Two useful readings of that list:

- **Inlined beats file.** In
  `@TestPropertySource(locations = "/test.properties", properties = "port = 4242")`, the inlined
  `port` wins. That is the right way round: the annotation on *this* test is more specific than
  the shared file.
- **Everything above beats your application's own configuration.** Test properties are not merged
  politely with `application.yml`; they sit on top of it. Which is the point, and also why a
  property set in a test can mask a misconfiguration that would break production.

## The empty-annotation convention

```java
@TestPropertySource
@ContextConfiguration
class MyTest { }
```

A bare `@TestPropertySource` makes Spring look for a default file next to the test class —
`classpath:com/example/MyTest.properties`. **If it is not there, you get an
`IllegalStateException`**, not a silent skip. That is a good failure: a convention that fails
loudly when unmet is safe to rely on.

## Inheritance — on by default, in both directions

Two boolean attributes, both defaulting to **`true`**:

- **`inheritLocations`** — inherit resource locations from superclasses
- **`inheritProperties`** — inherit inlined properties from superclasses

```java
@TestPropertySource("base.properties")
class BaseTest { }

@TestPropertySource("extended.properties")
class ExtendedTest extends BaseTest { }        // loads BOTH files
```

Set the attribute to `false` to load only your own:

```java
@TestPropertySource(locations = "extended.properties", inheritLocations = false)
class ExtendedTest extends BaseTest { }        // loads ONLY extended.properties
```

Inheriting by default is usually what you want — a shared base test class carrying common
configuration is the pattern [06b](06b-overriding-changes-the-cache-key.md) recommends for cache
reasons — but it means a subclass can be affected by a property it does not mention and cannot see
without opening the parent.

`@TestPropertySource` is also **repeatable**, with later declarations overriding earlier ones, and
directly-present annotations take precedence over meta-present ones (those coming from a composed
annotation).

## 🔴 The cache warning, again and in full

> *"the exact strings you provide for inlined properties are used to determine the context cache
> key. To benefit from context caching, define inlined properties consistently throughout your
> test suite."*

The reference even shows the shape of the mistake:

```java
@TestPropertySource(properties = "key = value")   // one context
@TestPropertySource(properties = "key= value")    // a second context
@TestPropertySource(properties = "key=value")     // a third
```

**Three contexts, one property, one value.** Nothing warns you; the only symptom is a slow suite.

Two habits that remove this entirely:

1. **Pick one spelling and enforce it.** `key = value` or `key=value` — the choice does not
   matter, the consistency does. It is a good checkstyle rule and a good review reflex.
2. **Prefer a shared file or profile to per-class inlining.** A `@TestPropertySource("/test.properties")`
   referenced by fifty classes is one location string and therefore one key component; fifty
   inlined blocks are fifty chances to diverge.

## Which mechanism, when

| Situation | Use |
|---|---|
| Configuration shared by most tests | `application-test.yml` + `@ActiveProfiles("test")` |
| Configuration for one class, static | `@SpringBootTest(properties = "…")`, spelled consistently |
| Configuration for several related classes | A file, or a shared base class |
| A value not known until runtime (a container's port) | `@DynamicPropertySource` — [07b](07b-profiles-and-dynamic-properties.md) |
| A value that must come from another bean | A `DynamicPropertyRegistrar` bean — [07b](07b-profiles-and-dynamic-properties.md) |

## Gotchas and pitfalls

**★ Inconsistent whitespace in inlined properties.**
`key=value` and `key = value` are different strings, therefore different cache keys, therefore
different application contexts. The most invisible performance bug in a Spring test suite.

**★ Expecting a file location to beat an inlined property.**
It does not — inlined properties sit above `locations` in the precedence order. If a file's value
is being ignored, look for an inlined one on the class or a superclass.

**★ Forgetting properties are inherited by default.**
`inheritLocations` and `inheritProperties` are both `true`. A subclass silently gets the parent's
configuration; if you meant to replace rather than add, say so explicitly.

**★ A bare `@TestPropertySource` with no matching file.**
Throws `IllegalStateException`. This is deliberate and good — but it surprises people who expected
an empty annotation to be a no-op.

**★ Using a test property to work around a configuration problem.**
Test properties override everything the application configured. That means they can make a test
pass against a configuration nothing in production has, which is one of the few ways a green
integration test can be actively misleading.

**★ Adding a per-class property to an otherwise shared `@SpringBootTest`.**
It is a cache-key component. That class now has its own application context, exactly as a
`@MockitoBean` would ([06b](06b-overriding-changes-the-cache-key.md)).

**★ Assuming `@ActiveProfiles` and properties are the same lever.**
They are different key components, and profiles select whole configurations rather than individual
values. [07b](07b-profiles-and-dynamic-properties.md).

**★ Using `key value` syntax and confusing the next reader.**
It is valid — the reference lists `key=value`, `key:value` and `key value` — but a space-separated
pair reads like a mistake. Consistency again.

## Interview questions

**★ What is the precedence order of test properties?**
Highest first: `@DynamicPropertySource` properties, then inlined properties from the `properties`
attribute, then properties from `locations`, then OS environment variables, then Java system
properties, then application property sources such as `@PropertySource`. So a test's inlined value
beats its own properties file, and both beat anything the application configured.

**★ Why can two test classes setting the same property end up with two contexts?**
Because inlined properties are compared as the exact strings you wrote — they are part of the
context cache key. `key=value` and `key = value` are different strings, so they produce different
keys and Spring builds two application contexts for one logical configuration.

**★ What does a bare `@TestPropertySource` with no arguments do?**
It looks for a default properties file next to the test class — `classpath:com/example/MyTest.properties`
for `com.example.MyTest` — and throws `IllegalStateException` if it cannot find one. It is a
convention that fails loudly rather than silently.

**★ Are test property sources inherited?**
Yes, by default. `inheritLocations` and `inheritProperties` both default to `true`, so a subclass
loads its superclass's locations and inlined properties in addition to its own. Set either to
`false` to load only the subclass's.

**★ How do you configure most of a suite without fragmenting the context cache?**
Put shared configuration in a profile-specific file — `application-test.yml` with
`@ActiveProfiles("test")` — or in one properties file referenced by location. One location string
is one key component shared by every class; fifty inlined blocks are fifty chances to diverge by a
character.

**★ Can a test property mask a real misconfiguration?**
Yes, and it is one of the few ways an integration test misleads you. Test properties sit above the
application's own property sources, so a value set in the test can make the context start with a
configuration that production does not have and cannot produce.

**★ What syntaxes are accepted for an inlined key/value pair?**
`key=value`, `key:value` and `key value`. Since Spring 6.1 you can also use a text block for
multiple properties, which is much more readable — and, since the strings become the cache key,
also easier to keep consistent.

{/* FOOTER */}
