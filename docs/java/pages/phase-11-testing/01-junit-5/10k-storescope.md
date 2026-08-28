---
title: "StoreScope widens an extension's store past the engine, which makes it the supported replacement for the static singleton container and its shutdown hook — and it is marked EXPERIMENTAL, so knowing that matters as much as knowing the API"
sidebar_label: "10k · StoreScope"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Keeping State in Extensions"
> ([extensions/keeping-state-in-extensions](https://docs.junit.org/6.0.3/extensions/keeping-state-in-extensions.html));
> javadoc for `ExtensionContext.StoreScope`
> ([StoreScope](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.StoreScope.html)),
> `LauncherSession`
> ([LauncherSession](https://docs.junit.org/6.0.3/api/org.junit.platform.launcher/org/junit/platform/launcher/LauncherSession.html))
> and `LauncherSessionListener`
> ([LauncherSessionListener](https://docs.junit.org/6.0.3/api/org.junit.platform.launcher/org/junit/platform/launcher/LauncherSessionListener.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**The root extension context ([10j](10j-store-cleanup.md)) is the widest thing *inside* one
engine. `StoreScope` goes wider than that — to the launcher's execution request, and to the
launcher session itself. That is the difference between "one container per Jupiter run" and
"one container for everything the build launches", and it is the mechanism the singleton
Testcontainers pattern has been faking with static fields for years.**

## The overload

Since 6.0 `ExtensionContext` carries a second `getStore`:

```java
ExtensionContext.Store getStore(ExtensionContext.StoreScope scope, ExtensionContext.Namespace namespace);
```

alongside the familiar `getStore(Namespace)`. The guide introduces it as the step past the
root context:

> *"The `StoreScope` enum allows to go beyond even that and access the stores on the level of
> the current `LauncherExecutionRequest` or `LauncherSession` which can be used to share data
> across test engines or inject data from a registered `LauncherSessionListener`,
> respectively. Please consult the Javadoc of `ExtensionContext`, `Store`, and `StoreScope`
> for details."*

## The three scopes

| Constant | Scope, in the javadoc's own words |
|---|---|
| `EXTENSION_CONTEXT` | *"The store is scoped to the current `ExtensionContext`. Any data that is stored in a `Store` with this scope will be bound to the current extension context lifecycle."* |
| `EXECUTION_REQUEST` | *"The store is scoped to the current `ExecutionRequest` of the JUnit Platform `Launcher`. Any data that is stored in a `Store` with this scope will be available for the duration of the current execution request. Therefore, it may be used to share data across multiple engines."* |
| `LAUNCHER_SESSION` | *"The store is scoped to the current `LauncherSession`. Any data that is stored in a `Store` with this scope will be available throughout the entire launcher session. Therefore, it may be used to inject values from registered `LauncherSessionListener` implementations, to share data across multiple executions of the Jupiter engine within the same session, or even to share data across multiple engines."* |

`EXTENSION_CONTEXT` is what `getStore(Namespace)` already gives you — the enum exists so the
default has a name, not because you need to pass it.

The ladder, widest last: one test method → one class → one engine root →
one `ExecutionRequest` → one `LauncherSession`.

## Why the two wide scopes exist

A `LauncherSession` is not a JUnit-internal detail; it is the API a build tool holds open:

> *"The `LauncherSession` API is the main entry point for client code that wishes to
> repeatedly discover and execute tests using one or more test engines."*

**"Repeatedly"** and **"one or more test engines"** are the two words that matter. A Gradle
test task, an IDE's test runner, or a tool that runs Jupiter and then a second engine, all sit
inside one session and may issue several execution requests within it. The root
`ExtensionContext` is per-engine-run; anything above that was previously unreachable from an
extension, which is why the workaround was a `static` field and `Runtime.addShutdownHook`.

`LauncherSession` is itself `AutoCloseable`:

> *"`public interface LauncherSession extends AutoCloseable` … `close()` — Close this session
> and notify all registered `LauncherSessionListeners`."*

so the session-scoped store has a real end, and — by the same rule as every other store
([10j](10j-store-cleanup.md)) — closing it closes the `AutoCloseable` values in it. That is
the whole point: a session-scoped container is shut down by the framework rather than by a
shutdown hook that may or may not run.

## Injecting from a `LauncherSessionListener`

The other half of the feature is that a listener can *put* something in before any test runs.

> *"Register an implementation of this interface to be notified when a `LauncherSession` is
> opened and closed. A `LauncherSessionListener` can be registered programmatically with the
> `LauncherConfig` passed to the `LauncherFactory` or automatically via Java's `ServiceLoader`
> mechanism."*

> *"`launcherSessionOpened(LauncherSession session)` — Called when a launcher session was
> opened."*

and `LauncherSession` exposes its store:

> *"`NamespacedHierarchicalStore<Namespace> getStore()` — Get the `NamespacedHierarchicalStore`
> associated with this session."*

So the shape is: a listener registered through `ServiceLoader` starts the expensive thing in
`launcherSessionOpened`, puts it in the session store, and any extension in any engine reads
it with `getStore(StoreScope.LAUNCHER_SESSION, namespace)`. Nothing static, nothing global,
and one documented owner of the lifetime.

⚠️ Note the type difference: `LauncherSession.getStore()` returns a
`NamespacedHierarchicalStore<Namespace>` from the Platform's commons, not
`ExtensionContext.Store`. The extension side sees an `ExtensionContext.Store`; the listener
side does not. They are two views, and the javadoc does not spell out the mapping in a single
sentence — **I could not confirm from the documentation exactly how the namespaces on the two
sides correspond, so verify that against your own runtime before relying on it.**

## 🔴 It is `EXPERIMENTAL`

> *"`@API(status = EXPERIMENTAL, since = "6.0")` public static enum `ExtensionContext.StoreScope`"*

with a `Since: 5.13` tag on the type itself — the type arrived in 5.13, and the API status
annotation is dated 6.0. `EXPERIMENTAL` in the JUnit `@API` guardian vocabulary means the
element may be changed or removed without the deprecation cycle a `STABLE` element gets.

That does not make it unusable. It makes it unsuitable for a **published** extension that other
teams depend on, unless you say so in your own documentation — and it means pinning your JUnit
version is part of the decision.

## Gotchas

**★ Using `StoreScope.LAUNCHER_SESSION` in a published extension without flagging it.**
`EXPERIMENTAL` since 6.0. It is the right mechanism for cross-engine sharing and it is not a
stability guarantee — consumers who upgrade JUnit may find it changed.

**★ Reaching for `LAUNCHER_SESSION` when `getRoot()` would do.**
The root extension context already gives you one instance for the whole engine run, which is
the whole test task in the overwhelming majority of builds. `LAUNCHER_SESSION` only buys
something when there are genuinely multiple engines or multiple execution requests in one
session. Start at the root and widen only with a reason.

**★ Assuming a session-scoped value is shared across JVMs.**
It is not. A session lives in one JVM. A build that forks — Surefire's `forkCount`, Gradle's
`maxParallelForks` — has one session per fork, so "once per session" is once per fork and not
once per build ([14 · flaky tests](14-flaky-tests.md)).

**★ Expecting `EXECUTION_REQUEST` scope to survive to the next execution request.**
It is scoped to *the current* request. A session that runs Jupiter twice gets two
execution-request stores and one session store. Choose by which of those two lifetimes you
actually meant.

**★ Treating `EXTENSION_CONTEXT` as something you need to pass.**
It is the default. `getStore(namespace)` and `getStore(StoreScope.EXTENSION_CONTEXT, namespace)`
express the same intent; the enum constant exists so the default has a name in the API, not
because you should start writing it out.

**★ Putting mutable per-test data in a session-scoped store.**
Everything wrong with a `static` field is wrong here too, only with a wider blast radius: it
is shared across classes, across engines and across executions within the session, and
concurrent access is your problem. Wide scopes are for immutable or self-synchronising
resources.

**★ Relying on a shutdown hook alongside a session-scoped `AutoCloseable`.**
The session closes its store, so the resource is closed once already. A belt-and-braces
shutdown hook that closes it again is a double-close on an object whose `close()` you may not
control.

## Interview questions

**★ What is `StoreScope` for?**
It widens an extension's store beyond the extension-context tree. `EXTENSION_CONTEXT` is the
existing behaviour; `EXECUTION_REQUEST` scopes a value to the current launcher execution
request and can share it across engines; `LAUNCHER_SESSION` scopes it to the whole launcher
session, which is how a `LauncherSessionListener` can inject a value that every engine and
every execution in that session reads. It is `EXPERIMENTAL` as of 6.0.

**★ How is a launcher-session-scoped store better than a static singleton with a shutdown
hook?**
The lifetime has a documented owner. `LauncherSession` is `AutoCloseable` and closing it
notifies its listeners and closes its store, which closes the `AutoCloseable` values in it — so
shutdown is part of the framework's contract rather than dependent on a hook that a hard kill
skips. It is also visible: the value is reachable through an API instead of through a class you
have to know the name of.

**★ You want one Testcontainers container for a build that runs two engines. Which scope, and
what is the catch?**
`LAUNCHER_SESSION`, populated from a `LauncherSessionListener` registered via `ServiceLoader`,
because a session spans multiple engines and multiple execution requests. The catches are that
the API is `EXPERIMENTAL`, and that a session is per-JVM — a forking build gets one container
per fork, not one per build.

**★ If `EXTENSION_CONTEXT` is the default, why does the enum constant exist?**
Because the widened `getStore(StoreScope, Namespace)` overload needs a way to express "the
behaviour I already had". It is the identity element of the new API, not a new capability, and
code that does not need the other two scopes should keep calling `getStore(Namespace)`.

**★ What does `EXPERIMENTAL` mean in JUnit's `@API` annotation, and how should it change what
you write?**
It means the element may be changed or removed without the deprecation cycle a `STABLE` element
receives. In application test code that is usually acceptable, because you upgrade JUnit
deliberately and fix the call site. In a library other teams consume it is a commitment you are
making on their behalf, so it belongs in your own release notes, and it argues for pinning the
JUnit version rather than resolving it transitively.

{/* FOOTER */}
