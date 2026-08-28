---
title: "An extension is instantiated only once, so a field on it is shared by every test it serves and by every thread running them — the Store exists to replace that field, and the Namespace you key it under is what stops two extensions overwriting each other"
sidebar_label: "10h · Keeping state"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Keeping State in Extensions"
> ([extensions/keeping-state-in-extensions](https://docs.junit.org/6.0.3/extensions/keeping-state-in-extensions.html));
> javadoc for `ExtensionContext`
> ([ExtensionContext](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.html)),
> `ExtensionContext.Store`
> ([Store](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.Store.html))
> and `ExtensionContext.Namespace`
> ([Namespace](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtensionContext.Namespace.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**🔴 An extension must never keep per-test state in its own instance fields. Not "should
not" — the lifetime of an extension instance is not the lifetime you assume, and the guide
opens the topic by saying so in eleven words. The `Store` is the replacement, and this chunk
is why you need it and how you scope it.**

This is the mechanism behind the `TimingExtension` in [10b](10b-writing-one.md), and it is
the problem you create for yourself the moment you fix the `static` registration bug in
[10e](10e-registerextension.md). The hierarchy that makes `Store` lookups inherit, and the
API renamed in JUnit 6, are [10i · the store hierarchy](10i-the-store-hierarchy.md); when a
store dies and what it closes on the way out is
[10j · store cleanup](10j-store-cleanup.md).

## Why a field is wrong

> *"Usually, an extension is instantiated only once. So the question becomes relevant: How
> do you keep the state from one invocation of an extension to the next? The
> `ExtensionContext` API provides a `Store` exactly for this purpose. Extensions may put
> values into a store for later retrieval."*

Unpack "instantiated only once". Register an extension with `@ExtendWith` at class level and
one instance serves **every test method in the class**. Register it on a `static`
`@RegisterExtension` field and one instance serves the class. Register it on a test interface
and one instance serves each implementing class. In none of those cases is there one instance
per test.

So a field holding "the value for the current test" is:

- **wrong across tests** — test two reads what test one wrote, which is precisely the
  order-dependence [11 · execution order](11-execution-order.md) exists to warn about;
- **a data race under parallel execution** — two threads write the same field, and the
  failure is a flake in a test that does not mention the extension
  ([12 · parallel execution](12-parallel-execution.md));
- **invisible in review** — nothing about `private Instant start;` looks dangerous.

```java
// 🔴 wrong: one field, many tests, possibly many threads
public class TimingExtension implements BeforeTestExecutionCallback, AfterTestExecutionCallback {
    private long startTime;

    public void beforeTestExecution(ExtensionContext context) {
        this.startTime = System.currentTimeMillis();
    }

    public void afterTestExecution(ExtensionContext context) {
        long duration = System.currentTimeMillis() - this.startTime;   // whose start?
    }
}
```

The correct version stores the value against the context it belongs to:

```java
public class TimingExtension implements BeforeTestExecutionCallback, AfterTestExecutionCallback {

    private static final String START_TIME = "start time";

    @Override
    public void beforeTestExecution(ExtensionContext context) {
        getStore(context).put(START_TIME, System.currentTimeMillis());
    }

    @Override
    public void afterTestExecution(ExtensionContext context) {
        long startTime = getStore(context).remove(START_TIME, long.class);
        long duration = System.currentTimeMillis() - startTime;
        // report duration for context.getRequiredTestMethod()
    }

    private Store getStore(ExtensionContext context) {
        return context.getStore(Namespace.create(getClass(), context.getRequiredTestMethod()));
    }

}
```

Nothing per-test lives on the extension. **A field on an extension is legitimate only for
immutable configuration** — the `java.util.Random` instance in the guide's
`RandomNumberExtension` ([10b](10b-writing-one.md)) is a `private final` field, and that is
fine because it is configuration, not per-test state. Even there, thread safety is your
problem, not Jupiter's.

## The `Store` is reached through the context, per namespace

```java
ExtensionContext.Store store = context.getStore(Namespace.create(getClass(), someKeyPart));
```

Two independent choices are being made in that one line, and confusing them is the source of
most `Store` bugs:

1. **Which `ExtensionContext` you call `getStore` on** decides the *lifetime* and the
   *visibility* of what you write. Every callback receives a context; the context for a test
   method is a child of the context for its class, which is a child of the engine root.
2. **Which `Namespace` you pass** decides *who else can see it*.

## The `Namespace`

> *"A `Namespace` is used to provide a scope for data saved by extensions within a
> `ExtensionContext.Store`. Storing data in custom namespaces allows extensions to avoid
> accidentally mixing data between extensions or across different invocations within the
> lifecycle of a single extension."*

Two distinct jobs in one sentence: keeping *your* extension's data away from *another*
extension's, and keeping one invocation's data away from another invocation's.

```java
Namespace.create(getClass())                                     // per extension
Namespace.create(getClass(), context.getRequiredTestMethod())    // per extension, per method
```

> *"`create(Object... parts)` … Create a namespace which restricts access to data to all
> extensions which use the same sequence of parts for creating a namespace. The order of the
> parts is significant. Internally the parts are compared using `Object.equals(Object)`."*

**Order is significant and equality is `Object.equals`.** `Namespace.create(A.class, method)`
and `Namespace.create(method, A.class)` are different namespaces. And because the parts are
compared with `equals`, a `String` part is a collision waiting to happen with any other
extension that picked the same string — which is why `getClass()` is the conventional first
part and the only reliable one.

There is also `append`, for deriving a narrower namespace from a broader one:

> *"`append(Object... parts)` … Create a new namespace by appending the supplied parts to the
> existing sequence of parts in this namespace."*

And the escape hatch nobody should reach for casually:

> *"`GLOBAL` … The default, global namespace which allows access to stored data from all
> extensions."*

`Namespace.GLOBAL` is legitimate when the value *is* the shared thing — the guide's own
`HttpServerExtension` uses `Namespace.GLOBAL` on the root context for a server shared by the
whole run ([10j](10j-store-cleanup.md)). It is illegitimate as a default,
because you are then keying on nothing but a `String` and every extension on the classpath is
in the same map.

⚠️ `getParts()` exists on `Namespace` but is annotated `@API(status = INTERNAL, since = "5.13")`.
Do not build on it.

## Gotchas

**★ Keeping per-test state in an instance field of the extension.**
*"Usually, an extension is instantiated only once"* — one instance serves every test the
registration covers, and under parallel execution serves them concurrently. Nothing about
the field looks wrong in review. This is the bug this whole page exists to prevent.

**★ Assuming `@RegisterExtension` on an instance field makes per-test state safe.**
It changes the instance count but not the rule, and it costs you `BeforeAllCallback` and
friends ([10e](10e-registerextension.md)). Use the `Store`, which works for every
registration route.

**★ Using `Namespace.GLOBAL` because it was shorter to type.**
Then your key is a bare `String` in a map every extension on the classpath shares. Use
`Namespace.create(getClass(), …)` unless the value genuinely is meant to be global.

**★ A `String` key in a namespace you did not scope by `getClass()`.**
`"start time"` is a fine key inside `Namespace.create(TimingExtension.class, method)` and a
landmine inside `Namespace.GLOBAL`.

**★ Getting the namespace parts in a different order in two places.**
*"The order of the parts is significant."* `create(getClass(), method)` in `beforeEach` and
`create(method, getClass())` in `afterEach` are two different stores, and the read silently
returns `null` instead of failing.

**★ Building the namespace from something whose `equals` is identity.**
Parts are compared with `Object.equals`. A `Method` and a `Class` are fine. A freshly
constructed key object with no `equals` override gives you a namespace that never matches
itself twice.

## Interview questions

**★ Why must an extension not keep state in its own fields?**
Because the guide states that an extension is usually instantiated only once, so one instance
serves every test its registration covers. A field holding per-test data leaks between tests
— creating exactly the order dependence tests are supposed to be free of — and under parallel
execution it is a plain data race. The `ExtensionContext.Store` exists to replace it.

**★ What is a `Namespace` for, and what should the first part be?**
It scopes stored data so two extensions cannot collide and so one extension's separate
invocations cannot collide. The conventional and reliable first part is `getClass()`, because
the parts are compared with `Object.equals` and their order is significant — a bare `String`
part in `Namespace.GLOBAL` is shared with every other extension on the classpath.

**★ Two different `getStore` calls in the same extension return different stores. Why?**
Because a store is identified by *both* the `ExtensionContext` you asked and the `Namespace`
you passed. Calling `getStore` on the method context in one callback and on the class context
in another gives you two stores; passing `Namespace.create(getClass(), method)` in one place
and `Namespace.create(method, getClass())` in another gives you two more, because the order of
the parts is significant. Neither mistake fails loudly — the read just returns `null`.

**★ Is any field on an extension acceptable?**
Immutable configuration, yes — the guide's own `RandomNumberExtension` holds a `private final
java.util.Random`. Anything that varies per test, per class or per invocation, no. And even
the immutable-configuration case makes thread safety your problem: one instance serves every
test the registration covers, concurrently if the suite runs in parallel.

{/* FOOTER */}
