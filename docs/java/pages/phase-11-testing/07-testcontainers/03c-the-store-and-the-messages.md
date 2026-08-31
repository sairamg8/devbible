---
title: "The extension never stops a container in afterAll — it puts each one in JUnit's Store as a CloseableResource and lets JUnit close it, which is the single fact that explains reverse teardown order, the per-subclass restart, and every one of the six messages you can get out of this module"
sidebar_label: "03c · The Store and the messages"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 sources** at
> [tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5) —
> [`TestcontainersExtension`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/TestcontainersExtension.java),
> [`GenericContainer`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/core/src/main/java/org/testcontainers/containers/GenericContainer.java),
> [`ContainerState`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/core/src/main/java/org/testcontainers/containers/ContainerState.java)
> and the module's `WrongAnnotationUsageTests` — plus the **JUnit 6.0.3**
> [`ExtensionContext`](https://github.com/junit-team/junit-framework/blob/r6.0.3/junit-jupiter-api/src/main/java/org/junit/jupiter/api/extension/ExtensionContext.java)
> source at tag `r6.0.3`, and the
> [Testcontainers 2.0.0 release notes](https://github.com/testcontainers/testcontainers-java/releases/tag/2.0.0).
> Version spine: JDK 25, Spring Boot 4.1.0, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — only source that was read and documentation that was quoted.

**[03b](03b-static-versus-instance.md) said a static container is stopped "when the class ends" and
an instance container "when the method ends". Those phrasings are convenient but they are not what
the code does, and the difference is the whole reason Boot 4.1 has an opinion about this extension
([03d](03d-the-lifecycle-argument.md)). The container is stopped by JUnit closing a `Store`. Once you
know that, three otherwise-arbitrary behaviours become obvious — and so does every error message
this module can produce.**

## How a container is actually stopped — and why it is not `afterAll`

This is the part that is not in any tutorial and that explains the Spring interaction in
[03d](03d-the-lifecycle-argument.md). The extension does **not** stop containers in its
`afterAll`/`afterEach` methods. It registers them in JUnit's `Store` and lets JUnit close them:

```java
private static class StoreAdapter implements CloseableResource, AutoCloseable {

    private String key;
    private Startable container;

    private StoreAdapter(Class<?> declaringClass, String fieldName, Startable container) {
        this.key = declaringClass.getName() + "." + fieldName;
        this.container = container;
    }

    private StoreAdapter start() {
        container.start();
        return this;
    }

    @Override
    public void close() {
        container.stop();
    }
}
```

and `beforeAll` puts it in the store:

```java
storeAdapters.forEach(adapter -> store.getOrComputeIfAbsent(adapter.getKey(), k -> adapter.start()));
```

JUnit's contract for that store, verbatim from the `ExtensionContext` javadoc at `r6.0.3`:

> *"A store is bound to its extension context lifecycle. When an extension context lifecycle ends
> it closes its associated store. All stored values that are instances of
> `ExtensionContext.Store.CloseableResource` are notified by invoking their `close()` methods."*

and, on ordering:

> *"The resources stored in a `Store` are closed in the inverse order they were added in."*

Three consequences worth banking:

1. **The container's lifetime is exactly the extension context's lifetime.** `beforeAll` uses the
   class-level context, so a static container dies with the class context. `beforeEach` uses the
   method-level context, so an instance container dies with the method context.
2. **Multiple containers stop in reverse declaration order.** If a `Kafka` container was declared
   after the `PostgreSQL` one, Kafka stops first. If you have containers with a real dependency
   between them, declare the dependency with `dependsOn` rather than relying on field order.
3. **`Store.CloseableResource` is deprecated in JUnit** (`@Deprecated(since = "5.13")`, *"Please
   extend `AutoCloseable` directly"*) but still present and still honoured at 6.0.3. The adapter
   hedges by implementing both interfaces, which is why the module works on Jupiter 6 despite
   compiling against a 5.x BOM.

### `start()` and `stop()` are idempotent, on state

```java
public void start() {
    if (containerId != null) {
        return;
    }
    Startables.deepStart(dependencies).get();
    dockerClient.authConfig();
    doStart();
}

public void stop() {
    if (containerId == null) {
        return;
    }
    try {
        // ... stopAndRemoveContainer ...
    } finally {
        containerId = null;
        containerInfo = null;
    }
}
```

`GenericContainer.start()` returns immediately if the container is already up, and `stop()` nulls
`containerId` so a subsequent `start()` will start a **new** container. This pair is what makes the
singleton pattern work — a container started outside the extension is not restarted by it — and it
is also what makes a static container in a shared abstract base class restart once per subclass,
because each subclass has its own class-level extension context and therefore its own store. See
[05 · The singleton pattern](05-the-singleton-pattern.md).

## Every message this module can throw at you

All five below are `ExtensionConfigurationException`, and each one is diagnosable on sight once you
know which line of the extension produced it.

| Message | Where it comes from | What you actually did |
|---|---|---|
| `Container <fieldName> needs to be initialized` | `getContainerInstance`, when `field.get(...)` returns `null` | Declared the field but never assigned it — or assigned it in `@BeforeAll`, a constructor or an initialiser that runs *after* the extension reads the field. The extension reads static fields in `beforeAll`, which runs before your `@BeforeAll`. |
| `FieldName: <name> does not implement Startable` | the `isContainer()` predicate | Put `@Container` on something that is not `Startable` — a `String`, a `DataSource`, a JDBC URL, a `DockerImageName`. The module's `WrongAnnotationUsageTests` does this deliberately with a `String`. |
| `@Testcontainers not found` | `evaluateExecutionCondition` | Registered `TestcontainersExtension` by hand via `@ExtendWith(TestcontainersExtension.class)` or `@RegisterExtension` without `@Testcontainers` anywhere up the extension-context chain. The condition needs the annotation to read `disabledWithoutDocker` from. |
| `Can not access container defined in field <name>` | the `IllegalAccessException` branch of `getContainerInstance` | `setAccessible(true)` was refused — a module system or security configuration blocking reflective access to your test class. |
| `TestcontainersExtension is only supported for classes.` | `beforeAll`, when `context.getTestClass()` is empty | The extension was registered somewhere that is not a test class container. |

And one that is *not* thrown by the extension at all, which is the important one:

| `Mapped port can only be obtained after the container is started` | `ContainerState.getMappedPort`, a `Preconditions.checkState` on `getContainerId() != null` | You have `@Container` on a field and **no `@Testcontainers` on the class**. Nothing registered the extension, so nothing started the container, and the first `getMappedPort` / `getJdbcUrl` call fails. There is no warning before this point. |

That last row is the failure mode you will actually hit, because `@Container` on its own compiles
perfectly and reads perfectly. `@Container` without `@Testcontainers` is silent.

## 🔴 JUnit 4 support is gone, and the docs site still says otherwise

The 2.0.0 release notes are one line: *"Removed JUnit 4 support"*. There is no `org.junit.rules`
anywhere in `core/src/main` at 2.0.5. `@Rule`, `@ClassRule` and `PostgreSQLContainer` as a
`TestRule` do not exist.

⚠️ **Two pages on the Testcontainers docs site still document it**: the Prerequisites section of
`docs/index.md` lists JUnit 4, and `docs/test_framework_integration/junit_4.md` still ships in the
2.0.5 tree. Do not trust either. This matters more than a normal doc staleness bug because
`@Rule`-based samples are the majority of Testcontainers material written before 2024, and search
engines rank them well.

The migration is not subtle — it is a different mechanism, not a different annotation:

```java
// 1.x, JUnit 4 — does not exist at 2.0.5
@ClassRule
public static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18-alpine");

// 2.0.5, JUnit 5
@Testcontainers
class Tests {
    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
}
```

Note the generic disappearing as well as the annotation changing — that is
[02](02-what-testcontainers-is.md)'s subject and it will bite in the same edit.

## Gotchas

**★ Nothing stops your container in `afterAll` — so nothing stops it if the store is not closed.**
`TestcontainersExtension.afterAll` only signals `TestLifecycleAware` containers. The actual `stop()`
comes from JUnit closing the extension context's store. That is normally reliable, and it is
precisely why a JVM killed mid-run leaves containers behind — which is Ryuk's job, not the
extension's ([05a2 · Ryuk and cleanup](05a2-ryuk-and-cleanup.md)).

**★ Multiple containers stop in reverse declaration order, not declaration order.**
JUnit closes store resources *"in the inverse order they were added in"*, and the extension adds them
in `HierarchyTraversalMode.TOP_DOWN` field order. If a container declared second must outlive one
declared first, field order is the wrong lever — express it with `dependsOn` so `getDependencies()`
carries the relationship.

**★ A superclass container is added to the store before the subclass's own.**
`TOP_DOWN` traversal means base-class fields are discovered first, therefore added first, therefore
closed **last**. That is usually what you want, and it is worth knowing because it is the opposite of
what "reverse order" sounds like when you only think about one class.

**★ `stop()` nulls `containerId`, so a "restart" is a brand-new container.**
`GenericContainer.stop()` ends with `containerId = null; containerInfo = null;` in a `finally` block,
and `start()` short-circuits only while `containerId != null`. There is no pause/resume. Anything you
wrote to the old container is gone, and the mapped host port will be different.

**★ `start()` being a no-op on a running container is what the singleton pattern relies on.**
If a container is already running when the extension calls `start()`, nothing happens — the method
returns at the `containerId != null` guard. That is the mechanism that lets a container started once
in a static holder be handed to `@Container` (or to Spring) without being restarted. It is also why
you must not assume `@Container` implies "this extension started it".

**★ `@Container` without `@Testcontainers` fails with a message about ports.**
`IllegalStateException: Mapped port can only be obtained after the container is started` is a
`Preconditions.checkState` in `ContainerState.getMappedPort`, and it says nothing about the missing
annotation. If you see it on a field you believe is managed, check the class-level annotation first.

**★ `ExtensionConfigurationException` is thrown from a JUnit callback, so the whole class fails.**
All four of the extension's configuration exceptions surface as a container-level failure, not as a
single failing test. In a CI report that looks like "the class did not run", which sends people
looking at the build rather than at the one annotated field that is wrong.

**★ Believing the docs site about JUnit 4.**
Two pages in the 2.0.5 tree still document removed support: `docs/index.md`'s Prerequisites and
`docs/test_framework_integration/junit_4.md`. There is no `org.junit.rules` code in `core/src/main`.
Trust the source over the site while a library is mid-major-version.

**★ `Store.CloseableResource` is deprecated in JUnit, so this mechanism will move.**
It is `@Deprecated(since = "5.13")` with *"Please extend `AutoCloseable` directly"*, still honoured at
6.0.3. The adapter implements both interfaces so it keeps working, but any extension you write
yourself should implement `AutoCloseable` only.

## Interview questions

**★ How does the Testcontainers JUnit extension actually stop a container?**
Not in `afterAll`. It wraps each container in a private `StoreAdapter` that implements JUnit's
`ExtensionContext.Store.CloseableResource` (and `AutoCloseable`), whose `close()` calls
`container.stop()`, and puts it in the extension context's `Store` keyed by
`declaringClass.getName() + "." + fieldName`. JUnit's contract is that *"a store is bound to its
extension context lifecycle… all stored values that are instances of `CloseableResource` are
notified by invoking their `close()` methods"*. So the container's lifetime is exactly the lifetime
of the extension context that registered it — class-level for static fields, method-level for
instance fields.

**★ Why does that distinction matter rather than being an implementation detail?**
Because it fixes the container's lifetime to a JUnit-owned scope that nothing else can extend. Spring's
TestContext framework caches an `ApplicationContext` across test classes; JUnit closes the class-level
store when the class ends. The two scopes are not related, and when the cached context outlives the
store the context holds a `DataSource` aimed at a container that no longer exists. That is exactly the
failure Boot 4.1 documents — [03d](03d-the-lifecycle-argument.md).

**★ In what order are two `@Container` fields stopped?**
Reverse of the order they were added, because JUnit closes store resources *"in the inverse order they
were added in"*. Fields are added in `HierarchyTraversalMode.TOP_DOWN` order, so superclass fields are
added first and therefore closed last, and within a class the last-declared container stops first. If
ordering matters, model it as a dependency rather than as field order.

**★ Is `GenericContainer.start()` idempotent?**
Yes, on state. `start()` returns immediately if `containerId != null`, so calling it on a running
container does nothing. `stop()` is the mirror: it returns immediately if `containerId == null`, and
otherwise nulls both `containerId` and `containerInfo` in a `finally` block. There is no suspend or
resume — a container that was stopped and started again is a different container with a different
mapped port.

**★ You get `ExtensionConfigurationException: Container pg needs to be initialized`. What happened?**
The field annotated `@Container` was `null` when the extension read it. Almost always that is a field
assigned inside `@BeforeAll`, a constructor or a lifecycle method, because JUnit runs every
`BeforeAllCallback` extension before user `@BeforeAll` code. Assign the container at its declaration.

**★ You get `FieldName: url does not implement Startable`. What happened?**
`@Container` was put on something that is not a `Startable` — typically the JDBC URL string or the
`DataSource` derived from a container rather than the container itself. `@Target(FIELD)` accepts any
field type, so this only fails at runtime, when the extension evaluates
`Startable.class.isAssignableFrom(field.getType())`.

**★ When would you ever see `@Testcontainers not found`?**
When `TestcontainersExtension` was registered without the annotation — via
`@ExtendWith(TestcontainersExtension.class)` or `@RegisterExtension` — and the extension's
`ExecutionCondition` walks the extension-context chain looking for `@Testcontainers` to read
`disabledWithoutDocker()` from, and finds nothing. The fix is to use the annotation; it is the
supported registration form.

**★ Can you still use `@Rule` or `@ClassRule` with Testcontainers?**
No. The 2.0.0 release notes state *"Removed JUnit 4 support"* and there is no `org.junit.rules` code
in `core/src/main` at 2.0.5. Two pages on the docs site still describe it and are stale. The
replacement is not a renamed annotation but a different extension model, and the same edit will also
hit the removed self-type generic on the module container classes
([02](02-what-testcontainers-is.md)).

**★ Why does a `static @Container` in a shared abstract base class not give you one container?**
Because the store is per extension context, not per field. Each subclass has its own class-level
extension context and therefore its own store, so the adapter is registered and closed once per
subclass — started, stopped, started again. The key includes the declaring class, but the *store* it
goes into does not span classes. One container across the JVM needs a different mechanism:
[05 · The singleton pattern](05-the-singleton-pattern.md).

{/* FOOTER */}
