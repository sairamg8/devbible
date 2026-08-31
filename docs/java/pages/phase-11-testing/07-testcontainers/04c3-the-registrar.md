---
title: "DynamicPropertyRegistrar is the bean-shaped form of @DynamicPropertySource, and it exists because a static method cannot see a bean — which is precisely the situation you are in the moment your containers become @Bean methods"
sidebar_label: "04c3 · DynamicPropertyRegistrar"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.8** reference —
> [Context Configuration with Dynamic Property Sources](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/dynamic-property-sources.adoc)
> and [Context Caching](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/caching.adoc) —
> and the `spring-test` sources at the same tag, read directly:
> [`DynamicPropertyRegistrar`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/context/DynamicPropertyRegistrar.java),
> [`DynamicPropertiesContextCustomizer`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/context/support/DynamicPropertiesContextCustomizer.java)
> and `DynamicPropertiesContextCustomizerFactory`. Boot's dev-time registrar sample is from the
> **Spring Boot 4.1.0** reference at `v4.1.0`.
> Version spine: JDK 25, Spring Boot 4.1.0 / Spring Framework 7.0.8, **Testcontainers 2.0.5**,
> JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**`DynamicPropertyRegistrar`, added in Spring Framework 6.2, does what `@DynamicPropertySource` does
but as a bean. That is not a cosmetic difference. `@DynamicPropertySource` requires a `static`
method ([04c](04c-dynamicpropertysource.md)), a static method cannot see a bean, and
[04b5](04b5-containers-as-beans.md) argued that your containers should be beans — so the two
recommendations were in direct conflict until this interface closed the gap. It is also the form
Boot's own development-time documentation uses. The context-cache behaviour that both mechanisms
share is [04c4](04c4-dynamic-properties-and-the-cache.md).**

## `DynamicPropertyRegistrar`: the same idea, as a bean

```java
@FunctionalInterface
public interface DynamicPropertyRegistrar {

    void accept(DynamicPropertyRegistry registry);
}
```

That is the whole interface. Because it is a `@FunctionalInterface`, a `@Bean` method returning one
is a lambda:

```java
@Configuration
class TestConfig {

    @Bean
    ApiServer apiServer() {
        return new ApiServer();
    }

    @Bean
    DynamicPropertyRegistrar apiPropertiesRegistrar(ApiServer apiServer) {
        return registry -> registry.add("api.url", apiServer::getUrl);
    }
}
```

The javadoc states both the detection rule and the reason to prefer it:

> *"Any bean in a test's `ApplicationContext` that implements the `DynamicPropertyRegistrar`
> interface will be automatically detected and **eagerly initialized before the singleton
> pre-instantiation phase**, and the `accept` methods of such beans will be invoked with a
> `DynamicPropertyRegistry` that performs the actual dynamic property registration on behalf of the
> registrar."*

> *"This is an alternative to implementing `@DynamicPropertySource` methods in integration test
> classes and supports additional use cases that are not possible with a `@DynamicPropertySource`
> method. For example, since a `DynamicPropertyRegistrar` is itself a bean in the
> `ApplicationContext`, it can interact with other beans in the context and register dynamic
> properties that are sourced from those beans."*

With one warning attached, in the documentation's own emphasis:

> *"**WARNING:** Any interaction with other beans results in eager initialization of those other
> beans and their dependencies."*

Which is the price. A registrar that injects a container forces that container bean — and its
dependencies — to be created and started before the rest of the singletons. For a container that is
exactly what you want; for a heavyweight service bean it is a startup cost you did not ask for.

## Side by side

```java
// (a) @DynamicPropertySource — static method, static container, test class
@Testcontainers
@SpringBootTest
class MyIntegrationTests {

    @Container
    static MongoDBContainer mongo = new MongoDBContainer("mongo:5.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.host", mongo::getHost);
        registry.add("spring.mongodb.port", mongo::getFirstMappedPort);
    }
}
```

```java
// (b) DynamicPropertyRegistrar — bean method, bean container, configuration class
@TestConfiguration(proxyBeanMethods = false)
public class MyContainersConfiguration {

    @Bean
    public MongoDBContainer mongoDbContainer() {
        return new MongoDBContainer("mongo:5.0");
    }

    @Bean
    public DynamicPropertyRegistrar mongoDbProperties(MongoDBContainer container) {
        return (properties) -> {
            properties.add("spring.mongodb.host", container::getHost);
            properties.add("spring.mongodb.port", container::getFirstMappedPort);
        };
    }
}
```

(b) is Boot's own dev-time sample, verbatim. Its reference is precise about why the container is a
*parameter* rather than something the lambda looks up:

> *"The registrar should be defined using a `@Bean` method that injects the container from which the
> properties will be sourced as a parameter. This arrangement ensures that container has been
> started before the properties are used."*

**Which to reach for:** if the container is a `@Bean`, use a registrar — `@DynamicPropertySource`
cannot see beans, and forcing it to via a static holder field reintroduces the shared static state
that [04b5](04b5-containers-as-beans.md) argues against. If the container is a `static` field in the
test class, either works and `@DynamicPropertySource` is less machinery. If you are already using
`@ServiceConnection` for the container and only need one extra property, a registrar keeps
everything in the same configuration class.

## The registrar infrastructure is always present

A detail from `DynamicPropertiesContextCustomizer.customizeContext` that explains why registrars
work in contexts with no `@DynamicPropertySource` method anywhere:

```java
if (!beanDefinitionRegistry.containsBeanDefinition(DynamicPropertyRegistrarBeanInitializer.BEAN_NAME)) {
    BeanDefinition beanDefinition = new RootBeanDefinition(DynamicPropertyRegistrarBeanInitializer.class);
    beanDefinition.setRole(BeanDefinition.ROLE_INFRASTRUCTURE);
    beanDefinitionRegistry.registerBeanDefinition(DynamicPropertyRegistrarBeanInitializer.BEAN_NAME, beanDefinition);
}

if (!this.methods.isEmpty()) {
    // ... invoke the @DynamicPropertySource methods ...
}
```

The initializer is registered **unconditionally**; only the method invocation is guarded by
`methods.isEmpty()`. And `DynamicPropertiesContextCustomizerFactory` returns a customizer even when
it finds no methods at all. So every Spring test context can host registrar beans, whether or not
anything in the hierarchy declares a `@DynamicPropertySource`.

## Gotchas


**★ A `DynamicPropertyRegistrar` forces eager initialization of everything it injects.**
The javadoc's own warning. Injecting a container is fine — you wanted it started. Injecting a
service bean drags that bean and its whole dependency graph into pre-instantiation, ahead of
everything else.

**★ `@DynamicPropertySource` cannot see a `@Bean` container, and a static holder is not the fix.**
The method must be static, so the only way to reach a bean is a static field someone assigns — which
puts the container's lifetime back outside Spring's control and reintroduces the problem
[04b5](04b5-containers-as-beans.md) describes. Use a registrar.

**★ The registrar infrastructure is registered even in contexts with no dynamic properties at all.**
`DynamicPropertyRegistrarBeanInitializer` is added unconditionally by the customizer. So a
`DynamicPropertyRegistrar` bean works in any Spring test context — but it also means the customizer
is always present, which is why an "empty" customizer must still compare equal to another empty one
for caching to work.

**★ Registrar beans do not add anything special to the cache key.**
They contribute through the configuration class that declares them, exactly like any other bean.
Two test classes importing the same `@TestConfiguration` share the context and the containers — the
special-cased behaviour that catches people out belongs to `@DynamicPropertySource`, and it is
[04c4](04c4-dynamic-properties-and-the-cache.md).

**★ The method is called `accept`, not `register`.**
`DynamicPropertyRegistrar` is a `@FunctionalInterface` whose single method is
`void accept(DynamicPropertyRegistry registry)`. If you implement it as a named class rather than a
lambda, that is the method to override; `@Override` on anything else will not compile, which is the
good outcome.

**★ Boot 4's Mongo property is `spring.mongodb.host`, not `spring.data.mongodb.host`.**
Boot 4.1's own dev-time registrar sample registers `spring.mongodb.host` and `spring.mongodb.port`.
Property names moved in Boot 4, and hand-registered property names are precisely the thing a
`@ServiceConnection` would have saved you from owning — which is the argument for reaching for the
annotation first whenever the container is in the catalogue.

**★ A registrar can source a property from any bean, not just a container.**
The Framework's own example registers `api.url` from an `ApiServer` bean with no container in sight.
The interface is not Testcontainers-specific — the documentation says the dynamic-property
infrastructure *"may be used with any form of external resource whose lifecycle is managed outside
the test's `ApplicationContext` or with beans whose lifecycle is managed by the test's
`ApplicationContext`"*.

## Interview questions


**★ What is `DynamicPropertyRegistrar` and why was it added?**
A `@FunctionalInterface` with one method, `accept(DynamicPropertyRegistry)`, introduced in Spring
Framework 6.2. Any bean implementing it is detected and eagerly initialized before the singleton
pre-instantiation phase, and its `accept` method is called with a registry. It exists because
`@DynamicPropertySource` methods must be static and therefore cannot see beans — so there was no way
to register a property sourced from a bean, which is exactly what you need when your containers are
`@Bean` methods.

**★ What is the cost of a registrar?**
Eager initialization. The javadoc warns that *"any interaction with other beans results in eager
initialization of those other beans and their dependencies"*. Injecting a container is harmless
because you wanted it started first anyway; injecting a general application bean pulls its whole
graph forward.

**★ Why does Boot's sample inject the container as a method parameter rather than calling the container `@Bean` method?**
Because, in the reference's words, *"this arrangement ensures that container has been started before
the properties are used"*. Taking it as a parameter makes the dependency explicit to the container,
so Spring orders the two correctly. Reaching for it another way gives up that ordering.

**★ Is `DynamicPropertyRegistrar` only for Testcontainers?**
No. The Framework's own example sources `api.url` from an `ApiServer` bean, and the documentation is
explicit that the dynamic-property infrastructure, though *"originally designed to allow properties
from Testcontainers based tests to be exposed easily"*, *"may be used with any form of external
resource whose lifecycle is managed outside the test's `ApplicationContext` or with beans whose
lifecycle is managed by the test's `ApplicationContext`"*. A registrar sourcing a value from a
WireMock server bean or an embedded broker bean is the same pattern.

**★ When would you choose `@DynamicPropertySource` over a registrar, given the registrar is newer?**
When the container is already a `static` field in the test class and nothing else needs it. The
annotation is less machinery — one method, no bean, no configuration class — and it does not force
eager initialization of anything. The registrar earns its keep when the container is a bean, when
the value comes from another bean, or when you want the registration to live next to the container
declaration rather than in the test class.

{/* FOOTER */}
