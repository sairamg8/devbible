---
title: "A store is bound to its extension context's lifecycle and closes AutoCloseable values in the inverse order they were added, which turns the choice of which context you stored something in into the choice of when it gets shut down"
sidebar_label: "10j · Store cleanup"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Keeping State in Extensions"
> ([extensions/keeping-state-in-extensions](https://docs.junit.org/6.0.3/extensions/keeping-state-in-extensions.html));
> javadoc for `ExtensionContext.Store`
> ([Store](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.Store.html)),
> `ExtensionContext.Store.CloseableResource`
> ([CloseableResource](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.Store.CloseableResource.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**The `Store` is not just a place to put things — it is a place things get *closed*. Store an
`AutoCloseable` in a method-level store and it closes after that test; store the same object
in the root store and it closes at the end of the run. There is no `@AfterAll` involved and
no cleanup code to forget. This chunk is the lifecycle rule, the close order, the JUnit 6
change to the interface.**

[10h](10h-keeping-state.md) is why state goes in the store; [10i](10i-the-store-hierarchy.md)
is how lookups traverse it; the scopes that reach beyond the engine entirely are
[10k · StoreScope](10k-storescope.md).

## The lifecycle rule

> *"An extension context store is bound to its extension context lifecycle. When an extension
> context lifecycle ends it closes its associated store."*

One sentence, and it converts a storage decision into a resource-management decision:

| Store obtained from | Closed when |
|---|---|
| the test method's context | that test finishes |
| the test class's context | that class finishes |
| a `@Nested` class's context | that nested class finishes |
| `context.getRoot()` | the engine run finishes |

**Which context you call `getStore` on is therefore your `try`-with-resources scope.** There
is no separate deregistration and no `AfterEachCallback` to write; put the object in the right
store and the shutdown is decided.

## What gets closed, and in what order

> *"All stored values that are instances of `AutoCloseable` are notified by an invocation of
> their `close()` method in the inverse order they were added in (unless the
> `junit.jupiter.extensions.store.close.autocloseable.enabled` configuration parameter is set
> to `false`)."*

Three separate facts in that sentence.

**1 · The trigger is `AutoCloseable`.** Not a marker interface of Jupiter's own, not an
annotation — the JDK interface. Anything you store that happens to be `AutoCloseable` will be
closed. That is convenient and occasionally surprising: a `Connection`, a `Stream`, an
`ExecutorService` wrapper or a Testcontainers container parked in a store is closed by
Jupiter, whether or not that is what you intended.

**2 · Inverse insertion order.** Last in, first out — the same discipline as nested
`try`-with-resources, and for the same reason: if B was created after A, B may depend on A, so
B must go first. It is a real guarantee, unlike `@AutoClose` field order
([09d](09d-autoclose.md)), which is deterministic but intentionally nonobvious.

**3 · There is a kill switch.** Setting
`junit.jupiter.extensions.store.close.autocloseable.enabled` to `false` disables the automatic
`AutoCloseable` handling. The reason it exists is the surprise in fact 1 — a codebase that
stores `AutoCloseable` objects it does not want closed needed a way out when 5.13 broadened the
trigger. Set it deliberately, or not at all.

⚠️ I could not find this parameter listed on the guide's own "Configuration Parameters" page;
it is documented in the "Keeping State in Extensions" text and repeated in the `Store`
javadoc's method descriptions, which is what the quotes above come from.

## The JUnit 6 change: `CloseableResource` is deprecated

Before 5.13, automatic closing required Jupiter's own nested interface. The javadoc now reads:

> *"`ExtensionContext.Store.CloseableResource` — Deprecated. Please extend `AutoCloseable`
> directly."*

and the guide states the version boundary:

> *"Versions prior to 5.13 only supported `CloseableResource`, which is deprecated but still
> available for backward compatibility."*

If you write an extension for one JUnit version, implement `AutoCloseable` and stop. If you
publish an extension that must work on both sides of 5.13, the guide gives the exact
double-implementation:

```java
public class MyResource implements Store.CloseableResource, AutoCloseable {
    @Override
    public void close() throws Exception {
        // Resource cleanup code
    }
}
```

> *"This ensures that your resource will be properly closed regardless of which JUnit Jupiter
> version is being used."*

One `close()` method satisfies both interfaces, because `CloseableResource.close()` has the
same erasure. It is not elegant and it is the documented answer.

## The worked example: one server for the whole run

The guide's `HttpServerResource` is an ordinary `AutoCloseable` — no Jupiter types at all:

```java
class HttpServerResource implements AutoCloseable {

    private final HttpServer httpServer;

    HttpServerResource(int port) throws IOException {
        InetAddress loopbackAddress = InetAddress.getLoopbackAddress();
        this.httpServer = HttpServer.create(new InetSocketAddress(loopbackAddress, port), 0);
    }

    HttpServer getHttpServer() {
        return httpServer;
    }

    void start() {
        httpServer.createContext("/example", exchange -> {
            String body = "This is a test";
            exchange.sendResponseHeaders(200, body.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body.getBytes(UTF_8));
            }
        });
        httpServer.setExecutor(null);
        httpServer.start();
    }

    @Override
    public void close() {
        httpServer.stop(0);
    }
}
```

and the extension parks it in the **root** store, lazily:

```java
public class HttpServerExtension implements ParameterResolver {

    @Override
    public boolean supportsParameter(ParameterContext parameterContext, ExtensionContext extensionContext) {
        return HttpServer.class.equals(parameterContext.getParameter().getType());
    }

    @Override
    public Object resolveParameter(ParameterContext parameterContext, ExtensionContext extensionContext) {

        ExtensionContext rootContext = extensionContext.getRoot();
        ExtensionContext.Store store = rootContext.getStore(Namespace.GLOBAL);
        Class<HttpServerResource> key = HttpServerResource.class;
        HttpServerResource resource = store.computeIfAbsent(key, __ -> {
            try {
                HttpServerResource serverResource = new HttpServerResource(0);
                serverResource.start();
                return serverResource;
            }
            catch (IOException e) {
                throw new UncheckedIOException("Failed to create HttpServerResource", e);
            }
        }, HttpServerResource.class);
        return resource.getHttpServer();
    }
}
```

The guide's own justification for the placement:

> *"It may be stored at class or method level, if desired, but this may add unnecessary
> overhead for this type of resource. For this example it might be prudent to store it at root
> level and instantiate it lazily to ensure it's only created once per test run and reused
> across different test classes and methods."*

Everything about the shape is deliberate: `getRoot()` for the lifetime, `computeIfAbsent` for
the "once" ([10i](10i-the-store-hierarchy.md)), a port of `0` so the OS picks a free one
rather than a fixed port that collides ([14 · flaky tests](14-flaky-tests.md)), and
`AutoCloseable` so nothing has to remember to stop it.

Note `Namespace.GLOBAL` here is defensible for the reason [10h](10h-keeping-state.md) gives:
the key is a `Class` object, not a `String`, and the value genuinely is meant to be shared.

## Gotchas

**★ Storing something in the method-level store and expecting it to survive the test.**
The store closes when its context's lifecycle ends. A method-level store dies with the test
method, taking your `AutoCloseable` with it — which is correct, and is also why the "expensive
resource created per test" bug is usually a store-scope bug, not a `computeIfAbsent` bug.

**★ Storing an `AutoCloseable` you did not want closed.**
The trigger is the JDK interface, not an opt-in. Park a `Connection` or a container you manage
yourself in a store and Jupiter closes it for you at the end of the context. If that is wrong,
either wrap it in a non-`AutoCloseable` holder or set
`junit.jupiter.extensions.store.close.autocloseable.enabled=false` — the first is local and the
second is module-wide.

**★ Implementing `CloseableResource` on JUnit 6.**
Deprecated since 5.13 in favour of extending `AutoCloseable` directly. It still works. It is
the tell of an extension written against an old guide, and it will not survive forever.

**★ Implementing only `AutoCloseable` in a library that must support pre-5.13 Jupiter.**
Before 5.13 only `CloseableResource` was honoured, so your `close()` is never called on those
versions and the resource leaks silently. The documented fix is to implement both interfaces
with one method.

**★ Relying on close order between two independently stored objects.**
Inverse insertion order is guaranteed, so it is only "independent" if you cannot say which was
inserted first — and with `computeIfAbsent` the insertion happens on first *use*, which may not
be the order you wrote the code in. If B must close before A, make sure B is created after A,
or make A close B.

**★ Expecting a close failure to be attributed to a test.**
A store closes when its *context* ends. An exception from `close()` on a root-level store
surfaces at engine level, not against any test method — the same shape as the class-level
failure problem in [10](10-extensions.md), where a `TestWatcher` sees nothing.

**★ Putting a resource in the root store and forgetting it is shared.**
Root means every test class in the run, including ones written by other people. State the
resource leaves behind — a table, a file, a bound port — is now cross-class shared state, and
it is exactly the category [14 · flaky tests](14-flaky-tests.md) covers.

**★ Assuming the close switch is per-store.**
`junit.jupiter.extensions.store.close.autocloseable.enabled` is a configuration parameter,
which means it applies to the whole run. Turning it off to protect one object disables the
automatic cleanup that every other extension in the build is relying on.

## Interview questions

**★ How does something stored in an extension's `Store` get cleaned up?**
By implementing `AutoCloseable`. A store is bound to its extension context's lifecycle, and
when that lifecycle ends the store closes, invoking `close()` on every stored `AutoCloseable`
in the inverse order they were added. There is no cleanup callback to write — the choice of
which context you stored the value in *is* the choice of when it is closed.

**★ You need one Testcontainers container for the entire suite. Where do you store it?**
In the store of `context.getRoot()`, created with `computeIfAbsent` so it is made exactly once
even under parallel execution, and implementing `AutoCloseable` so the root store stops it at
the end of the run. That is the shape of the guide's own `HttpServerExtension`, and it is the
supported alternative to a static singleton with a shutdown hook.

**★ What changed about store cleanup in Jupiter 5.13, and why does it matter to an extension
author?**
Before 5.13 only values implementing `ExtensionContext.Store.CloseableResource` were closed
automatically; from 5.13 any `AutoCloseable` is. `CloseableResource` is deprecated in favour of
extending `AutoCloseable` directly. An extension that must run on both sides of that line
implements both interfaces with a single `close()` method, which the guide spells out.

**★ In what order are stored resources closed?**
The inverse of the order they were added — last in, first out, like nested
`try`-with-resources — so a resource created later, which may depend on an earlier one, is
closed first. That is a genuine guarantee, unlike `@AutoClose` field ordering, which the
documentation deliberately leaves nonobvious.

**★ Is there a way to stop Jupiter closing something you stored?**
Yes — `junit.jupiter.extensions.store.close.autocloseable.enabled=false` — but it is a
configuration parameter and therefore applies to the entire run, disabling the behaviour every
other extension depends on. The local fix is better: store a wrapper that is not
`AutoCloseable`, so nothing about your object matches the trigger.

{/* FOOTER */}
