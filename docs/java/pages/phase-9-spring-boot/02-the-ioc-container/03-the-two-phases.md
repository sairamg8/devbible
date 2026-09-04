---
title: "Two phases: definition, then instantiation"
sidebar_label: "3 · The two phases"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *The IoC
> Container → Container Extension Points* and *Bean Overview*
> (docs.spring.io/spring-framework/reference/core/beans/ —
> `BeanFactoryPostProcessor`, `BeanPostProcessor`, `BeanDefinition` contents,
> the ordering guarantees), and the Framework 7.0.9 Javadoc for
> `org.springframework.context.support.AbstractApplicationContext#refresh`,
> `BeanFactoryPostProcessor` and `BeanPostProcessor`.
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**The single most useful thing to know about the Spring container is that it
works in two completely separate passes, and almost every confusing behaviour
in the framework is a consequence of which pass something happens in. First it
collects and finalises *descriptions* of beans — no objects exist yet, and the
descriptions can still be rewritten. Then it creates objects from those
descriptions, in dependency order, wrapping them as it goes. Auto-configuration,
`@Conditional`, property placeholder resolution, `@Transactional` proxying and
the entire class of "my bean was not registered" problems all become obvious
once you can say which phase you are asking about.**

## The two passes

```
PHASE 1 — DEFINITION                    PHASE 2 — INSTANTIATION
────────────────────────                ───────────────────────
scan / read @Bean methods               for each singleton definition:
        ↓                                   resolve constructor args
BeanDefinition objects registered           construct the object
        ↓                                   inject remaining dependencies
BeanFactoryPostProcessor runs               BeanPostProcessor.before…
  (may ADD, REMOVE or EDIT definitions)     @PostConstruct / InitializingBean
        ↓                                   BeanPostProcessor.after…
definitions are now final                     (this is where proxies appear)
                                                    ↓
                                            the context is ready
```

The boundary between them is hard. **Nothing in phase 1 has an object to look
at; nothing in phase 2 can change what beans exist.**

## What a `BeanDefinition` holds

It is worth knowing what the normalised model actually contains, because every
configuration mechanism in Spring ultimately manipulates these fields:

- the **class** (or a factory method that produces the object)
- the **scope** — `singleton`, `prototype`, `request`, `session`
- **constructor arguments** and **property values**
- **autowiring** mode and candidate status, `primary`, `fallback`
- **lazy-init**, `depends-on`
- **init** and **destroy** method names

`@Lazy` sets a flag on this object. `@Primary` sets a flag on this object.
`@Scope("prototype")` sets a field. Once you see annotations as a notation for
populating `BeanDefinition` fields, the framework stops looking like a
collection of unrelated features.

## Phase 1's hook: `BeanFactoryPostProcessor`

A `BeanFactoryPostProcessor` runs after every definition has been registered
and before any bean is instantiated. It receives the
`ConfigurableListableBeanFactory` — the registry itself — and may add, remove
or modify definitions:

```java
@Component
class RedactSecretsPostProcessor implements BeanFactoryPostProcessor {

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory bf) {
        for (String name : bf.getBeanDefinitionNames()) {
            BeanDefinition def = bf.getBeanDefinition(name);   // ✅ a description
            if (def.getBeanClassName() != null
                    && def.getBeanClassName().endsWith("DebugEndpoint")) {
                def.setLazyInit(true);      // rewriting metadata, not an object
            }
        }
    }
}
```

You have almost certainly used one without knowing:
`PropertySourcesPlaceholderConfigurer` is a `BeanFactoryPostProcessor`, and it
is what resolves `${...}` placeholders in definitions. That is *why* placeholder
resolution works in a `@Value` on a bean that has not been created yet — the
substitution happens in the definitions, before anything exists.

⚠️ **A `BeanFactoryPostProcessor` must not cause beans to be instantiated.**
Calling `bf.getBean(...)` inside one forces early creation, before the other
post-processors have run — which means the bean skips proxying and silently
loses `@Transactional`, `@Async` and `@Cacheable`. This is the classic reason a
transaction "just does not start" on one particular bean.

## Why the split explains auto-configuration

`@Conditional` — and therefore every `@ConditionalOnClass`,
`@ConditionalOnMissingBean` and `@ConditionalOnProperty` in Spring Boot —
is evaluated in **phase 1**, while definitions are being registered. That is
what makes it possible at all: the condition decides whether a definition is
*registered*, so by the time anything is created the question is already
settled.

It also explains the ordering rule people trip over.
`@ConditionalOnMissingBean` asks "has a definition of this type been registered
yet?", and user configuration is processed *before* auto-configuration for
exactly this reason. Declare your own `ObjectMapper` and Boot's backs off; the
mechanism is definition ordering in phase 1, not magic. That is
**[Topic 05 — Boot auto-configuration](../05-auto-configuration/README.md)**.

## Gotchas

### Injecting a dependency into a `BeanFactoryPostProcessor`

**Symptom.** A bean mysteriously loses `@Transactional`, or a log warns that a
bean is "not eligible for getting processed by all BeanPostProcessors".

**Cause.** The post-processor declared a dependency, so the container had to
create that dependency during phase 1 — before the `BeanPostProcessor`
infrastructure was in place. The dependency exists but was never proxied.

**Fix.** Make `BeanFactoryPostProcessor` beans `static` `@Bean` methods with no
dependencies, and read configuration from the `Environment` rather than from
another bean:

```java
@Configuration
class Config {
    @Bean
    static BeanFactoryPostProcessor tweaks() {   // ✅ static: no instance needed
        return bf -> { /* read Environment, edit definitions */ };
    }
}
```

The `static` matters: a non-static `@Bean` method forces its enclosing
`@Configuration` class to be instantiated early, dragging its dependencies with
it.

## Interview questions

**★ What does a `BeanDefinition` actually contain?**
The bean class or the factory method that produces the object; the scope; the
constructor arguments and property values; autowiring metadata including
whether the bean is a candidate, primary or a fallback; lazy-init and
`depends-on`; and the init and destroy method names. Every configuration
annotation is a notation for populating these fields — `@Lazy` sets a flag,
`@Primary` sets a flag, `@Scope` sets a field. Seeing it this way is what makes
`BeanFactoryPostProcessor` comprehensible: it is a hook that runs after all the
definitions are built and before any object is created, so it can rewrite these
fields.

**★ Describe the two phases of container startup and why the distinction matters.**
Phase one registers `BeanDefinition`s — from scanning, `@Bean` methods, XML,
imports and auto-configuration — and then runs every
`BeanFactoryPostProcessor`, which may add, remove or edit those definitions. No
bean instances exist during this phase. Phase two instantiates the singletons
in dependency order, injecting collaborators and running `BeanPostProcessor`
callbacks around each bean's initialisation. The distinction matters because it
tells you which questions are answerable when: "should this bean exist" is a
phase-one question, decided by `@Conditional`; "what object do I actually get"
is a phase-two question, decided by the post-processors that may replace it
with a proxy. Most confusing Spring behaviour resolves to getting these two
mixed up.

**★ What is a `BeanFactoryPostProcessor` and what must it not do?**
It is the phase-one extension point: it runs after all definitions are
registered and before any bean is created, receiving the bean factory itself so
it can modify metadata — change a scope, set lazy-init, add or remove
definitions. `PropertySourcesPlaceholderConfigurer` is the one everybody uses
without noticing, and it is why `${...}` placeholders are resolved in
definitions before any object exists. What it must not do is trigger bean
instantiation, for example by calling `getBean`. Doing so creates beans before
the `BeanPostProcessor` infrastructure is ready, so those beans skip proxying
and silently lose `@Transactional`, `@Async` and `@Cacheable`.

**★ Why does `@ConditionalOnMissingBean` work at all, given that beans are created later?**
Because conditions are evaluated in phase one, against the set of *definitions*
registered so far, not against instantiated objects. `@ConditionalOnMissingBean`
asks whether a definition of that type has been registered yet, and Spring Boot
deliberately processes user configuration before auto-configuration so that
your own `@Bean` wins and Boot's backs off. If conditions ran in phase two the
mechanism would be circular and unusable — you would need the bean to exist to
decide whether to define it.


---

← Prev: [The container and its metadata](02-the-container-and-metadata.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Instantiation and post-processors](04-instantiation-and-post-processors.md)
