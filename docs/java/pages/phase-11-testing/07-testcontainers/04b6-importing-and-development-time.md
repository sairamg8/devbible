---
title: "@ImportTestcontainers lifts container declarations you already have into a Spring context, and once containers are Spring beans you can attach them to the real application's main method and run the whole service against real dependencies with no test in sight"
sidebar_label: "04b6 · Importing, and dev time"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.1** reference at tag `v4.1.0` —
> [`features/dev-services.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/features/dev-services.adoc)
> ("Using Testcontainers at Development Time", "Importing Testcontainers Declaration Classes",
> "Using DevTools with Testcontainers at Development Time") and
> [`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc)
> ("Importing Container Configuration Interfaces"), with every Java sample taken from those pages'
> `include-code` files; plus the
> [`ImportTestcontainers`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/context/ImportTestcontainers.java)
> javadoc at the same tag.
> Version spine: JDK 25, Spring Boot 4.1.1, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**[04b5](04b5-containers-as-beans.md) argued that Spring should own the container's lifecycle. Two
things follow from that, and the second one is the part of Spring Boot most working developers have
never used. First: if you already have container declarations as static fields on an interface, you
do not have to rewrite them as `@Bean` methods — `@ImportTestcontainers` lifts them across. Second:
a container configuration that is a Spring bean is not test-specific at all, so Boot lets you
attach it to your real application's `main` and run the service, on its real port, against freshly
started containers.**

## `@ImportTestcontainers`, for declarations you already have

The common pre-existing shape is containers on an interface that test classes implement:

```java
public interface MyContainers {

    @Container
    @ServiceConnection
    MongoDBContainer mongoContainer = new MongoDBContainer("mongo:5.0");

    @Container
    @ServiceConnection
    Neo4jContainer neo4jContainer = new Neo4jContainer("neo4j:5");
}
```

(Interface fields are implicitly `public static final`, which is why this pattern exists at all.)
`@ImportTestcontainers` pulls those declarations into a Spring context without the test class
having to implement the interface:

```java
@TestConfiguration(proxyBeanMethods = false)
@ImportTestcontainers(MyContainers.class)
public class MyContainersConfiguration {
}
```

Its javadoc states exactly what it looks at, and it is two things, not one:

> *"Imports idiomatic Testcontainers declaration classes into the Spring `ApplicationContext`. The
> following elements will be considered from the imported classes: All static fields that declare
> `Container` values. All `@DynamicPropertySource` annotated methods."*

So a declaration class can carry its property registration with it — see
[04c](04c-dynamicpropertysource.md). And `value()` defaults to `{}`, in which case *"the class that
declares the `@ImportTestcontainers` annotation will be searched"*, so you can put the fields
directly on the configuration class.

The reference adds the escape hatch for people who do not want service connections at all:

> *"If you don't intend to use the service connections feature but want to use
> `@DynamicPropertySource` instead, remove the `@ServiceConnection` annotation from the `Container`
> fields."*

## The part almost nobody uses: containers at development time

Once containers are Spring beans, nothing about them is test-specific. Boot lets you launch the
**real** application with that configuration attached, from the test classpath:

> *"To use Testcontainers at development time you need to launch your application using your 'test'
> classpath rather than 'main'. This will allow you to access all declared test dependencies and
> give you a natural place to write your test configuration."*

You write one extra class in `src/test/java`, next to your real one:

```java
// src/test/java/com/example/TestMyApplication.java
public class TestMyApplication {

    public static void main(String[] args) {
        SpringApplication.from(MyApplication::main)
                .with(MyContainersConfiguration.class)
                .run(args);
    }
}
```

`SpringApplication.from(MyApplication::main)` runs your actual `main` — same auto-configuration,
same beans, same everything — and `.with(...)` layers the container configuration on top. Run
`TestMyApplication` and you get the application, on its real port, talking to freshly started
containers, with no `docker compose up` and no local Postgres install.

> *"You can use the Maven goal `spring-boot:test-run` or the Gradle task `bootTestRun` to do this
> from the command line."*

> *"The lifecycle of `Container` beans is automatically managed by Spring Boot. Containers will be
> started and stopped automatically."*

### Keeping the data across a devtools restart

A restart normally rebuilds the context, which would destroy and recreate the containers — losing
every row you just inserted by hand. `@RestartScope` prevents that:

```java
@TestConfiguration(proxyBeanMethods = false)
public class MyContainersConfiguration {

    @Bean
    @RestartScope
    @ServiceConnection
    public MongoDBContainer mongoDbContainer() {
        return new MongoDBContainer("mongo:5.0");
    }
}
```

> *"When using devtools, you can annotate beans and bean methods with `@RestartScope`. Such beans
> won't be recreated when the devtools restart the application. This is especially useful for
> `Container` beans, as they keep their state despite the application restart."*

⚠️ Gradle needs one more change, and it is easy to miss:

> *"If you're using Gradle and want to use this feature, you need to change the configuration of the
> `spring-boot-devtools` dependency from `developmentOnly` to `testAndDevelopmentOnly`. With the
> default scope of `developmentOnly`, the `bootTestRun` task will not pick up changes in your code,
> as the devtools are not active."*


## Contributing properties at development time too

`@ServiceConnection` covers the catalogue. For anything outside it, the dev-time configuration can
carry a `DynamicPropertyRegistrar` bean, and the reference is precise about *why* the container is
injected as a method parameter rather than referenced from a field:

> *"If you want to contribute dynamic properties at development time from your `Container` `@Bean`
> methods, define an additional `DynamicPropertyRegistrar` bean. The registrar should be defined
> using a `@Bean` method that **injects the container from which the properties will be sourced as
> a parameter**. This arrangement ensures that container has been started before the properties are
> used."*

```java
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

Boot states the preference plainly, and it is the right default:

> *"Using a `@ServiceConnection` is recommended whenever possible, however, dynamic properties can
> be a useful fallback for technologies that don't yet have `@ServiceConnection` support."*

The registrar API itself — how it differs from `@DynamicPropertySource`, and the eager
initialisation it forces — is [04c](04c-dynamicpropertysource.md).

## Gotchas

**★ `@ImportTestcontainers` also imports `@DynamicPropertySource` methods, which you may not want.**
Its javadoc lists both static `Container` fields *and* `@DynamicPropertySource` methods. Importing a
declaration class to get one container can bring property registrations with it.

**★ `@ImportTestcontainers` with no value searches the annotated class itself.**
`value()` defaults to `{}`. If you annotate a configuration class and forget the argument, it does
not fail — it looks for container fields on that class and quietly finds none.

**★ Fields on an interface are `public static final` whether you write it or not.**
That is why the interface-declaration pattern works, and also why a "container declared on an
interface" is a JVM-wide singleton per class loader with all the sharing consequences that implies.

**★ `TestMyApplication` must live in `src/test/java`, not `src/main/java`.**
It depends on `spring-boot-testcontainers`, the Testcontainers modules and your test configuration,
all of which are test-scoped. Putting it in `src/main` either fails to compile or ships container
code in your production jar.

**★ Without `@RestartScope`, a devtools restart destroys your containers and their data.**
The containers are ordinary beans, and a restart rebuilds the context. Any data you inserted by
hand while poking at the running app is gone.

**★ On Gradle, `@RestartScope` needs `testAndDevelopmentOnly` for devtools.**
With the default `developmentOnly` scope, devtools is not on the `bootTestRun` classpath at all, so
restarts do not happen and the annotation has nothing to do. Nothing reports this.

**★ A `DynamicPropertyRegistrar` bean must take the container as a *parameter*, not read a field.**
The reference's reason is explicit: injecting it *"ensures that container has been started before
the properties are used"*. A registrar that closes over a field it looks up itself gives up that
guarantee and can read a host and port from a container that has not started.

**★ `spring-boot:test-run` and `bootTestRun` are not the same as `spring-boot:run` / `bootRun`.**
The `test` variants launch from the test classpath, which is the entire point — the container
declarations live there. Running the ordinary goal starts the application with no containers and
whatever `application.yml` says.

**★ Dev-time containers are not reused between runs unless you make them.**
Every `bootTestRun` starts fresh containers and destroys them at exit. `@RestartScope` only survives
a *devtools restart* inside one run, not a new JVM. Surviving across runs is what container reuse is
for — **05b · Reuse** *(not written yet)*.


## Interview questions

**★ What is `@ImportTestcontainers` for?**
For reusing container declarations that already exist as static fields on an interface or a parent
class, without making every test class implement or extend it. It brings across the static
`Container` fields *and* any `@DynamicPropertySource` methods on the imported class, and with no
`value` it searches the annotated class itself.

**★ How do you run your application — not a test — against Testcontainers?**
Put a launcher in `src/test/java` that calls
`SpringApplication.from(MyApplication::main).with(MyContainersConfiguration.class).run(args)`. That
runs the real application's `main` with the container configuration layered on. From the command
line it is the Maven goal `spring-boot:test-run` or the Gradle task `bootTestRun`.

**★ Why does that launcher have to be on the test classpath?**
Because the container declarations, `spring-boot-testcontainers` and the Testcontainers modules are
all test dependencies. Boot's reference frames it as a feature rather than a constraint: launching
from the test classpath *"will allow you to access all declared test dependencies and give you a
natural place to write your test configuration"*.

**★ What does `@RestartScope` do and why does it matter here?**
It tells devtools not to recreate the bean when it restarts the application. On a container bean
that means the container — and everything in it — survives a code change, so the data you inserted
by hand is still there. On Gradle you must also move `spring-boot-devtools` from `developmentOnly`
to `testAndDevelopmentOnly`, or devtools is not active under `bootTestRun` at all.

**★ How is this different from Boot's Docker Compose support?**
Docker Compose support reads a `compose.yml` you maintain separately and is disabled in tests by
default; Testcontainers at development time keeps the configuration in Java on the test classpath
and is the same declaration your tests use. The comparison in full is
[04b4](04b4-ssl-and-the-other-catalogue.md).

{/* FOOTER */}
