---
title: "Jackson's Hibernate module is the most defensible entry on the list and still not a fix — it teaches the serialiser to write null where the data was not fetched, which converts a loud failure into a response whose shape depends on what happened to be loaded"
sidebar_label: "06c · Jackson and the module"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 reference *JSON* chapter — Jackson 3 as the
> preferred and default library and the auto-configured `JsonMapper`
> ([docs.spring.io/spring-boot/reference/features/json.html](https://docs.spring.io/spring-boot/reference/features/json.html)),
> the Boot `4.1.x` source of `org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration`,
> which collects `ObjectProvider<JacksonModule>` and calls `builder.addModules(...)`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-jackson/src/main/java/org/springframework/boot/jackson/autoconfigure/JacksonAutoConfiguration.java)),
> the published coordinates on Maven Central for
> `tools.jackson.datatype:jackson-datatype-hibernate7` (3.2.2) and
> `com.fasterxml.jackson.datatype:jackson-datatype-hibernate7` (2.22.2)
> ([repo1.maven.org](https://repo1.maven.org/maven2/tools/jackson/datatype/jackson-datatype-hibernate7/)),
> and the `3.x` source of `Hibernate7Module`, `Hibernate7ProxySerializer` and
> `PersistentCollectionSerializer`
> ([github.com/FasterXML/jackson-datatype-hibernate](https://github.com/FasterXML/jackson-datatype-hibernate/blob/3.x/hibernate7/src/main/java/tools/jackson/datatype/hibernate7/Hibernate7Module.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**This is the most defensible entry in the whole "not a fix" series, and the one worth
understanding in detail, because it is genuinely the right tool for the situation it was built
for — a serialiser that will inevitably meet Hibernate types and must not explode. What it
does is teach Jackson that an uninitialised proxy serialises as `null`, or as its identifier.
What that means for your API is that the presence of a field in the response now depends on
what your query happened to fetch, which is a contract nobody can write down. And its one
setting that fetches instead of nulling is the one that cannot work at the place people apply
it.**

## First: which module, on Spring Boot 4.1

🔴 **Boot 4 changed the Jackson line, so the coordinates most people have memorised are the
wrong ones.** The reference:

> *"Jackson 3 is the preferred and default library."*

> *"Support for Jackson 2 is deprecated and will be removed in a future Spring Boot 4.x
> release. It is provided purely to ease the migration from Jackson 2 to Jackson 3 and should
> not be relied up in the longer term."*

> *"When Jackson is on the classpath a `JsonMapper` bean is automatically configured."*

So the auto-configured bean is a `tools.jackson.databind.json.JsonMapper`, not a
`com.fasterxml.jackson.databind.ObjectMapper`, and the module must be from the matching line:

| Jackson line | Group and artifact | Version seen on Maven Central |
|---|---|---|
| Jackson 3 — **Boot 4.1's default** | `tools.jackson.datatype:jackson-datatype-hibernate7` | 3.2.2 |
| Jackson 2 — deprecated in Boot 4 | `com.fasterxml.jackson.datatype:jackson-datatype-hibernate7` | 2.22.2 |

The class is `tools.jackson.datatype.hibernate7.Hibernate7Module`, and it extends
`tools.jackson.databind.JacksonModule`. There is a `hibernate7` artifact because the module is
versioned against the ORM: `hibernate5` had a separate `-jakarta` variant, and the 6 and 7
artifacts are Jakarta-only.

⚠️ Mixing the lines is a silent failure: a `com.fasterxml…Module` bean is not a
`tools.jackson.databind.JacksonModule`, so Boot's Jackson 3 auto-configuration will not pick it
up and nothing will say so.

## Registering it

Boot 4.1's `JacksonAutoConfiguration` builds its `JsonMapper` through a customizer constructed
with `ObjectProvider<JacksonModule> modules`, and applies them with `builder.addModules(...)`.
So a bean is enough:

```java
@Configuration
class JacksonHibernateConfig {

    @Bean
    Hibernate7Module hibernate7Module() {
        return new Hibernate7Module();
    }
}
```

## What it actually does, from the source

Reading `Hibernate7ProxySerializer`, for an uninitialised proxy with `FORCE_LAZY_LOADING`
off:

- if `SERIALIZE_IDENTIFIER_FOR_LAZY_NOT_LOADED_OBJECTS` is on, it writes the identifier —
  wrapped in an object by default, because `WRAP_IDENTIFIER_IN_OBJECT` defaults to `true`;
- otherwise it writes **`null`**.

`PersistentCollectionSerializer` does the equivalent: an uninitialised collection with
`FORCE_LAZY_LOADING` off serialises as `null`.

The features and their defaults, from the module's own javadoc:

| Feature | Default | What the javadoc says |
|---|---|---|
| `FORCE_LAZY_LOADING` | `false` | *"Whether lazy-loaded object should be forced to be loaded and then serialized (true); or serialized as nulls (false)."* |
| `USE_TRANSIENT_ANNOTATION` | `true` | *"if true, will consider `@Transient` to mean that property is to be ignored"* |
| `SERIALIZE_IDENTIFIER_FOR_LAZY_NOT_LOADED_OBJECTS` | `false` | *"serializes uninitialized lazy loading proxies as `{"identifierName":"identifierValue"}` rather than `null`"* |
| `REQUIRE_EXPLICIT_LAZY_LOADING_MARKER` | `false` | laziness is assumed to be the default for unannotated collections |
| `REPLACE_PERSISTENT_COLLECTIONS` | `false` | replaces Hibernate collection types with JDK ones, *"to prevent issues with polymorphic handling"* |
| `WRITE_MISSING_ENTITIES_AS_NULL` | `false` | *"Using `FORCE_LAZY_LOADING` may result in `jakarta.persistence.EntityNotFoundException`. This flag configures Jackson to ignore the error and serialize a `null`."* |
| `WRAP_IDENTIFIER_IN_OBJECT` | `true` | emit the id as an object rather than a bare value |

## Why the default behaviour is not a fix

**The response shape becomes a function of the fetch plan.** `"customer": null` in the JSON now
means one of two entirely different things: the order has no customer, or the query did not
fetch the customer. The client cannot tell, the OpenAPI schema cannot express it, and the same
endpoint can produce both meanings for two rows in one list.

**Silently wrong data is worse than a 500.** A missing field is a bug report; a `null` field is
a rendering decision on the client. The failure has been converted from something monitoring
catches into something a customer notices six weeks later.

**It is a global setting for a per-endpoint question.** Once the module is registered, every
endpoint in the application serialises unfetched associations as null, including the ones that
would rather have failed loudly.

**Adding an association to the entity still changes every response.** The whole point of the
DTO argument is that the API stops tracking the mapping. With the module registered, the
mapping is still the API — it just fails quietly now.

## 🔴 `FORCE_LAZY_LOADING` is the option that cannot work where it is applied

The obvious next thought is "then turn on `FORCE_LAZY_LOADING` and get the real data". Reading
the source:

- For a **proxy**, the serializer calls `init.getImplementation()`. That is a fetch, and a
  fetch needs a live session. Serialisation of a controller's return value happens after the
  transaction has completed, so with open-session-in-view off this throws
  `LazyInitializationException` — the very exception the module was registered to prevent.
- For a **collection**, if the module was constructed with a `SessionFactory`, it opens a
  **temporary session** to load it. The source comment on that line is, verbatim,
  `// 08-Feb-2017, tatu: and not closing this is not problematic... ?` — question mark
  included.

So `FORCE_LAZY_LOADING` either requires OSIV, in which case you have the full N+1 during
response writing described in
**[Topic 08 · 04c · Serialisation and logging](../08-the-n-plus-1-problem/04c-serialization-and-logging.md)**,
or it opens ad-hoc sessions with the same consistency problems as
`enable_lazy_load_no_trans` in
**[06b2 · Turning it off](06b2-turning-the-exception-off.md)**. And `WRITE_MISSING_ENTITIES_AS_NULL`
exists precisely because forcing the load can raise `EntityNotFoundException`, so the option to
suppress *that* is a documented part of the design.

## `@JsonIgnore` on the association

```java
@ManyToOne(fetch = FetchType.LAZY)
@JsonIgnore
private Customer customer;
```

**What it genuinely does.** It removes the field from serialisation, so the walk never reaches
the proxy and nothing throws. For a back-reference in a bidirectional association it is often
the right call, and it is cheap.

**Why it is not a fix.**

- **It puts a serialisation decision in the persistence model.** `Customer` is now excluded
  from *every* JSON representation of an `Order`, everywhere, because one endpoint's walk
  reached it.
- **Two endpoints cannot disagree.** The detail view that wants the customer and the list view
  that does not are served by one annotation, and it can only say one thing.
- **It confirms that the entity is the API.** Every `@JsonIgnore` is a line of evidence that
  the response contract is being edited by annotating the table mapping.
- **It does not help any other reader.** A template, a mapper, an event payload or a log line
  reaching the same association still throws; `@JsonIgnore` is understood by exactly one
  consumer.

The cycle-breaking annotations that live next to it — `@JsonManagedReference`,
`@JsonBackReference`, `@JsonIdentityInfo` — are a different problem with the same root, and
they are worked through in
**[Topic 07 · 16 · Serialising an entity graph](../07-relationships-fetch/16-serialising-an-entity-graph.md)**.

## When the module is genuinely the right answer

Being fair to it, because it is a good library:

- **An application that has decided to serialise entities and is not going to stop.** Then a
  `null` is better than a 500 and the module is the correct way to get one.
- **A migration.** Register it, turn open-in-view off, and use the resulting nulls as a map of
  every place a fetch plan is missing — then convert those endpoints and remove the module.
- **Tooling and diagnostics.** An admin console or a debug endpoint that dumps entities is
  exactly the case the module was written for.

What it is not is a way to make serialising an entity correct, because the thing it fixes is a
symptom of serialising an entity.

## The root mistake

Every entry on this page and its two predecessors is downstream of one decision: **the object
handed to the serialiser was an entity.** A record has no proxies, so it needs no module, no
`@JsonIgnore`, no reference annotations, no `FORCE_LAZY_LOADING`, and no argument about what
`null` means — a field that is absent from the record is absent from the API, by construction.
**[05 · The DTO boundary](05-the-dto-boundary.md)**.

## Gotchas

**★ Boot 4.1 is Jackson 3, so the group id changed.** The module you want is
`tools.jackson.datatype:jackson-datatype-hibernate7`, not the `com.fasterxml.jackson.datatype`
one. Registering the Jackson 2 module in a Jackson 3 application is a silent no-op — the bean is
not a `tools.jackson.databind.JacksonModule`, so the auto-configuration never sees it.

**★ The auto-configured bean is a `JsonMapper`, not an `ObjectMapper`.** Code and tests that
inject `ObjectMapper` are on the deprecated Jackson 2 path, which Boot's reference says "should
not be relied up in the longer term".

**★ With the module registered, `null` in the response is ambiguous.** It means either "no
associated row" or "not fetched", and there is no way for a client to distinguish them. Your
API now has a value whose meaning depends on a repository method.

**★ `FORCE_LAZY_LOADING` throws for proxies when the session is closed.** It calls
`getImplementation()`, which is a fetch. So the feature that looks like the "do it properly"
option is the one that reintroduces the exception unless open-in-view is on.

**★ `FORCE_LAZY_LOADING` on collections opens a temporary session** when the module is
constructed with a `SessionFactory` — the same one-unit-of-work-per-access behaviour as
Hibernate's `@Unsafe` escape hatch, with the same consistency consequences.

**★ `WRITE_MISSING_ENTITIES_AS_NULL` exists because forcing loads can raise
`EntityNotFoundException`.** Its javadoc says so outright. If you find yourself enabling it, you
have layered a second suppression on top of the first.

**★ `WRAP_IDENTIFIER_IN_OBJECT` defaults to `true`,** so turning on identifier serialisation
gives you `"customer": {"id": 7}` rather than `"customer": 7`. That is a JSON shape change, and
it is easy to enable one feature and be surprised by the other.

**★ With `NON_NULL` or `NON_EMPTY` inclusion, the field disappears entirely.** The proxy
serializer reports an uninitialised proxy as empty, so a response can be missing a key
altogether depending on the fetch plan. Schema validation on the client side will fail
intermittently and look like a network problem.

**★ `@JsonIgnore` on a mapped association makes a serialisation decision in the persistence
model.** One annotation, one answer, all endpoints — and it tells you nothing about the
template, the mapper or the log statement that reaches the same field.

**★ The module and `@JsonIgnore` only ever help Jackson.** Every other reader of the entity is
untouched. A Thymeleaf template, a MapStruct mapper, a Kafka payload builder and a `toString`
all still fail.

**★ Registering the module removes your migration signal.** If you are moving to DTOs, the
exceptions are the to-do list. Turning them into nulls first means you no longer know where the
work is.

## Interview questions

**★ Which Jackson Hibernate module does a Spring Boot 4.1 application need, and why is that a
trap?**
`tools.jackson.datatype:jackson-datatype-hibernate7`, because Boot 4 makes Jackson 3 the
preferred and default library and auto-configures a `JsonMapper` from `tools.jackson`. The trap
is that almost every existing article names
`com.fasterxml.jackson.datatype:jackson-datatype-hibernate7`, which is the Jackson 2 artifact.
Registering it as a bean in a Jackson 3 application does nothing at all: Boot's
auto-configuration collects `tools.jackson.databind.JacksonModule` beans, and the Jackson 2
module is not one, so the registration fails silently and the exception continues.

**★ What does the module do by default when it meets an uninitialised proxy?**
It writes `null`, unless `SERIALIZE_IDENTIFIER_FOR_LAZY_NOT_LOADED_OBJECTS` is enabled, in
which case it writes the identifier — wrapped in an object, since `WRAP_IDENTIFIER_IN_OBJECT`
defaults to `true`. Uninitialised persistent collections are handled the same way. Nothing is
fetched, so nothing throws, and the response is smaller than the schema says it can be.

**★ Why is turning a `LazyInitializationException` into a `null` not obviously an improvement?**
Because it changes a detectable failure into an undetectable one. `"customer": null` is
indistinguishable from a genuinely absent customer, so the client renders a blank, monitoring
records a 200, and the missing fetch plan is invisible. The exception was information: it named
the entity and the association and told you where the gap was.

**★ Why does `FORCE_LAZY_LOADING` not solve that?**
Because for a proxy it calls `getImplementation()`, which is a fetch, and serialisation runs
after the transaction has completed. With open-in-view off it throws the same exception the
module was added to prevent; with open-in-view on it works and issues one query per
association during response writing, which is the N+1-in-the-serialiser case. For collections
the module can open a temporary session instead, which has the same per-access transaction
semantics as Hibernate's `@Unsafe` escape hatch. And `WRITE_MISSING_ENTITIES_AS_NULL` exists
because forcing the load can raise `EntityNotFoundException` — a suppression for a problem
created by a suppression.

**★ Is `@JsonIgnore` ever the right answer?**
For breaking a bidirectional cycle in a codebase that has decided to serialise entities, yes —
it is the standard tool and it works. As a fix for lazy loading it is not, because it makes a
per-endpoint decision globally, in the persistence model, for one consumer. The list view and
the detail view get the same answer, and the template that reads the same association is not
covered at all.

**★ When would you actually register this module?**
Three cases. An application that serialises entities as a deliberate, accepted choice and needs
robustness rather than correctness. A migration, where the nulls it produces are a survey of
missing fetch plans — register it, turn open-in-view off, collect the list, then convert the
endpoints and remove the module. And diagnostic tooling that dumps entity state, which is what
it was written for. Outside those, its presence is a signal that entities are crossing a
boundary they should not cross.

**★ What is the single sentence that makes this whole page unnecessary?**
Do not hand an entity to a serialiser. Every feature flag, annotation and artifact discussed
here exists to manage the consequences of that one decision, and none of them removes it.

{/* FOOTER */}
