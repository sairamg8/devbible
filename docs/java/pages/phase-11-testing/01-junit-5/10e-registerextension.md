---
title: "@RegisterExtension exists so you can hold a reference to a configured extension instance, and the price is one keyword — a non-static field silently drops BeforeAllCallback, AfterAllCallback, TestInstanceFactory and TestInstancePostProcessor"
sidebar_label: "10e · @RegisterExtension"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Registering Extensions"
> ([extensions/registering-extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html));
> javadoc for `@RegisterExtension`
> ([RegisterExtension](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/RegisterExtension.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**`@ExtendWith` ([10d](10d-registering-extensions.md)) hands a class reference to Jupiter,
which constructs the instance and never gives it back. `@RegisterExtension` inverts that:
you build the instance, so you can configure it and you can call it from the test body. The
whole of this page is that trade, and the one keyword that decides whether half the
extension API is honoured.**

## The justification, in one sentence

> *"When an extension is registered declaratively via `@ExtendWith`, it can typically only
> be configured via annotations. In contrast, when an extension is registered via
> `@RegisterExtension`, it can be configured programmatically — for example, in order to
> pass arguments to the extension's constructor, a static factory method, or a builder
> API."*

Two things follow, and the second is the one that actually decides which annotation you
reach for. First, you can **configure** the instance. Second, you **hold a reference to
it**:

```java
class WebServerDemo {

    @RegisterExtension
    static WebServerExtension server = WebServerExtension.builder()
        .enableSecurity(false)
        .build();

    @Test
    void getProductList() {
        WebClient webClient = new WebClient();
        String serverUrl = server.getServerUrl();
        assertEquals(200, webClient.get(serverUrl + "/products").getResponseStatus());
    }

}
```

`server.getServerUrl()` is the point of the whole example. Under
`@ExtendWith(WebServerExtension.class)` the instance belongs to Jupiter, and the only way to
get the URL into the test is to implement a `ParameterResolver` and inject it
([10c](10c-resolving-parameters.md)). Under `@RegisterExtension` the field *is* the
extension.

That is worth stating as a trade rather than a preference. `@RegisterExtension` buys
configurability and a handle. It pays with a field the reader has to understand, with the
`static` rule below, and — if you get the rule wrong — with an extension that does nothing.

The javadoc is explicit about the target and about `null`:

> *"`@Target(FIELD)` … `@RegisterExtension` fields must not be `null` (when evaluated) but
> may be either `static` or non-`static`."*

Fields only. There is no class-level `@RegisterExtension`.

## `static` versus instance — the most expensive choice in the extension model

**`static` field — no restrictions at all:**

> *"If a `@RegisterExtension` field is `static`, the extension will be registered after
> extensions that are registered at the class level via `@ExtendWith`. Such static
> extensions are not limited in which extension APIs they can implement. Extensions
> registered via static fields may therefore implement class-level and instance-level
> extension APIs such as `BeforeAllCallback`, `AfterAllCallback`, `TestInstanceFactory`,
> `TestInstancePostProcessor` and `TestInstancePreDestroyCallback` as well as method-level
> extension APIs such as `BeforeEachCallback`, etc."*

**Instance field — four APIs are dropped:**

> *"If a `@RegisterExtension` field is non-static (i.e., an instance field), the extension
> will be registered after the test class has been instantiated and after all
> `TestInstancePostProcessors` have been given a chance to post-process the test instance
> (potentially injecting the instance of the extension to be used into the annotated field).
> Thus, if such an instance extension implements class-level or instance-level extension
> APIs such as `BeforeAllCallback`, `AfterAllCallback`, `TestInstanceFactory`, or
> `TestInstancePostProcessor` those APIs will not be honored."*

**"will not be honored"** — no exception, no warning, no log line. Your `beforeAll` method is
simply never called, and the build is green because the extension's own setup never happened
and the test happened not to need it yet.

### Why, mechanically

An instance field does not exist until the test instance is constructed, and the test
instance is constructed **long after** `@BeforeAll` time ([03](03-the-lifecycle.md)). There
is literally nothing to register at the moment `BeforeAllCallback` would have to fire.

`TestInstancePostProcessor` is excluded for the same reason turned inside out: the
registration happens *after* all post-processors have already been given their chance, so an
instance extension implementing that interface has missed its own hook. `TestInstanceFactory`
is excluded because the instance it would have created is the very instance whose existence
caused the registration.

The fix is the keyword `static`. The test for whether you may apply it is whether the
extension's configuration depends on per-instance state — and if it does, you have a design
problem rather than a registration problem, because `@BeforeAll`-scoped behaviour cannot
depend on per-test data.

### When an instance field is right

The guide's instance-field example is deliberately a *method-level* extension:

```java
class DocumentationDemo {

    static Path lookUpDocsDir() {
        // return path to docs dir
    }

    @RegisterExtension
    DocumentationExtension docs = DocumentationExtension.forPath(lookUpDocsDir());

    @Test
    void generateDocumentation() {
        // use this.docs ...
    }
}
```

A fresh `DocumentationExtension` per test instance is correct here — a fresh instance per
test is what isolation means. A fresh `WebServerExtension` per test instance would start a
web server per test, which is exactly why the server example above is `static` and this one
is not.

The rule of thumb that falls out: **if the extension owns something expensive or shared, it
is `static`; if it owns something per-test, it is an instance field.** That is the same
decision as `@BeforeAll` versus `@BeforeEach`, and it should have the same answer for the
same reasons.

## 🔴 One place where the guide and the javadoc disagree

On where an *instance* extension sits relative to method-level `@ExtendWith`, the two
primary sources for 6.0.3 do not say the same thing.

The user guide:

> *"Instance extensions will be registered before extensions that are registered at the
> method level via `@ExtendWith`."*

The `@RegisterExtension` javadoc:

> *"By default, an instance extension will be registered after extensions that are
> registered at the method level via `@ExtendWith`; however, if the test class is configured
> with `@TestInstance(Lifecycle.PER_CLASS)` semantics, an instance extension will be
> registered before extensions that are registered at the method level via `@ExtendWith`."*

The javadoc is the more specific statement, and it makes *before* the `PER_CLASS` case —
which the guide's flat sentence presents as the general rule. **I could not settle which is
authoritative from the documentation alone, and no test was run to find out.**

Treat the relative order of an instance `@RegisterExtension` and a method-level
`@ExtendWith` as unspecified. If you need one before the other, put both on fields and use
`@Order` ([10f](10f-registration-order.md)), which is documented unambiguously in both
sources.

What both sources *do* agree on, and what you may build on: the class-level and
instance-level APIs are not honoured on an instance field, and `static` removes every
restriction.

## The `TestWatcher` corollary

The same mechanism produces the trap named in [10](10-extensions.md). A `TestWatcher`
registered on an instance field under the default `PER_METHOD` lifecycle receives **no
events for `@TestTemplate` methods**, so it silently misses every `@RepeatedTest` and every
`@ParameterizedTest` — which, in a suite that leans on parameterized tests
([03 · parameterized tests](../03-parameterized-tests/01-one-test-many-cases.md)), can be
most of the suite. The guide's recommendation is explicit: register a `TestWatcher` at class
level with `@ExtendWith`, or on a `static` field.

## Gotchas

**★ `@RegisterExtension` on an instance field, expecting `BeforeAllCallback` to fire.**
Documented as *"will not be honored"*, silently, along with `AfterAllCallback`,
`TestInstanceFactory` and `TestInstancePostProcessor`. Add `static`. This is the single most
common "my extension does nothing" report in the entire extension model, and it produces no
diagnostic of any kind.

**★ A heavyweight extension on an instance field.**
Instance registration happens once per test instance, and under the default lifecycle that
is once per test method. A container, a server or a connection pool built in an
instance-field initialiser is built per test. `static` here is not a micro-optimisation; it
is the difference between one server and fifty.

**★ A `TestWatcher` on an instance field.**
Under `PER_METHOD` it never sees `@TestTemplate` executions, so every `@ParameterizedTest`
and `@RepeatedTest` is missing from whatever you are recording. Register at class level, or
on a `static` field.

**★ A `null` `@RegisterExtension` field.**
*"must not be `null` (when evaluated)"*. A field initialised from a helper that returns
`null` under some profile fails at registration time rather than disabling the extension
quietly — which is the good outcome, but it surfaces as an extension error and not as a test
failure, so read the message rather than looking for a broken assertion.

**★ Depending on whether an instance extension runs before or after method-level
`@ExtendWith`.**
The 6.0.3 user guide and the `@RegisterExtension` javadoc give opposite defaults for that
one relationship. Do not build on either sentence; express the order with `@Order` on two
fields.

**★ Making the field `static` and then keeping per-test state in the extension's fields.**
Fixing the registration problem creates the state problem: one `static`-registered extension
instance serves every test in the class, and under parallel execution serves them
concurrently. Per-test state belongs in the `Store`
([10h · keeping state](10h-keeping-state.md)).

**★ Kotlin: `@RegisterExtension` in a companion object without `@JvmField` or `@JvmStatic`.**
The guide flags this explicitly. Kotlin has no static fields; unless the compiler is told to
emit one, the field registers as an *instance* field and every class-level callback is
silently dropped. The documented spellings are `@JvmField` for a public static field and
`@JvmStatic` for a private one.

**★ Reaching for `@RegisterExtension` as the default.**
`@ExtendWith` honours the full list of extension APIs, needs no field, and can be hidden
behind a composed annotation so the reader sees a capability rather than a class. Escalate
to `@RegisterExtension` when you must configure the instance or must call it from the test —
not because it looks more explicit.

**★ Exposing extension internals through the field.**
Because the field is the extension, everything public on it is now part of your test's
vocabulary. `server.getServerUrl()` is a good API; `server.getInternalRegistry()` invites
tests to reach into machinery, and those tests break on every refactor of the extension.

## Interview questions

**★ When would you choose `@RegisterExtension` over `@ExtendWith`?**
When the extension needs configuration that annotations cannot express — constructor
arguments, a static factory method, a builder — or when the test body needs to talk to the
extension instance, for example to ask a started server which port it bound. `@ExtendWith`
hands a class reference to Jupiter, which owns the instance and never returns it;
`@RegisterExtension` means the field you declared *is* the extension.

**★ An extension registered with `@RegisterExtension` implements `BeforeAllCallback` and it
never runs. Why, and what is the fix?**
The field is not `static`. An instance field is only registered after the test class has
been instantiated and after all `TestInstancePostProcessor`s have run — far past `@BeforeAll`
time — so `BeforeAllCallback`, `AfterAllCallback`, `TestInstanceFactory` and
`TestInstancePostProcessor` are documented as not honoured. Nothing is logged. Making the
field `static` fixes it, and a `static` field is explicitly unrestricted in which APIs it may
implement.

**★ You want one shared web server for a whole test class, and the test needs its URL.
Sketch the registration.**
A `static` field annotated `@RegisterExtension`, holding an instance built through the
extension's builder, with the extension implementing `BeforeAllCallback` and
`AfterAllCallback` to start and stop the server. `static` is required twice over: for the
callbacks to be honoured at all, and so that one server serves the class rather than one per
test instance. The test then reads the URL straight off the field, with no `ParameterResolver`
in the picture.

**★ What is the one thing each annotation can do that the other cannot?**
`@ExtendWith` can be placed on types, methods and parameters and can be meta-annotated onto a
custom annotation, so an extension can be applied with no field anywhere in sight and with
the full extension API honoured. `@RegisterExtension` targets fields only, but it registers
an instance *you* constructed, which is the only way to configure an extension
programmatically and the only way to hold a reference to it.

**★ You made the field `static` and the callbacks now fire. What new problem have you
created?**
State. One instance now serves every test in the class — and every thread, if the class runs
concurrently. Anything the extension remembers between callbacks must move out of its own
fields and into the `ExtensionContext.Store`, keyed by a namespace and by the context it
belongs to. That is the subject of [10h](10h-keeping-state.md), and it is the direct
consequence of the fix on this page.

{/* FOOTER */}
