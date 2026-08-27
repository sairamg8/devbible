---
title: "@AutoClose closes a field without an @AfterEach, but when it fires depends on the test instance lifecycle and the order it closes several fields in is documented as deterministic and intentionally nonobvious"
sidebar_label: "09d · @AutoClose"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Built-in Extensions"
> ([built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**The second of Jupiter's two default-registered user-facing extensions. `@AutoClose` is
four lines of documentation and three sharp edges: a `null` field is skipped with only a log
warning, the close *time* changes when you change the test instance lifecycle, and the
close *order* between two fields is explicitly not a contract. The other default-registered
extension, `@TempDir`, is [09](09-tempdir-and-resources.md)–[09c](09c-tempdirfactory-and-autoclose.md).**

## `@AutoClose`

> *"The built-in `AutoCloseExtension` automatically closes resources associated with fields.
> It is registered by default. To use it, annotate a field in a test class with
> `@AutoClose`."*

```java
class AutoCloseDemo {

    @AutoClose
    WebClient webClient = new WebClient();

    String serverUrl = // specify server URL ...

    @Test
    void getProductList() {
        assertEquals(200, webClient.get(serverUrl + "/products").getResponseStatus());
    }

}
```

The rules, each of which answers a question people ask:

> *"`@AutoClose` fields may be either `static` or non-`static`. If the value of an
> `@AutoClose` field is `null` when it is evaluated the field will be ignored, but a
> warning message will be logged to inform you."*

> *"By default, `@AutoClose` expects the value of the annotated field to implement a
> `close()` method that will be invoked to close the resource. However, developers can
> customize the name of the close method via the `value` attribute. For example,
> `@AutoClose("shutdown")` instructs JUnit to look for a `shutdown()` method to close the
> resource."*

Note what that means: the field does **not** have to implement `AutoCloseable`. Any object
with a no-argument method of the right name qualifies, which is how you close a legacy
`shutdown()`, `stop()` or `dispose()` API.

## When `@AutoClose` fires

> *"The `AutoCloseExtension` implements the `AfterAllCallback` and
> `TestInstancePreDestroyCallback` extension APIs. Consequently, a `static` `@AutoClose`
> field will be closed after all tests in the current test class have completed, effectively
> after `@AfterAll` methods have executed for the test class. A non-`static` `@AutoClose`
> field will be closed before the current test class instance is destroyed."*

> *"Specifically, if the test class is configured with `@TestInstance(Lifecycle.PER_METHOD)`
> semantics, a non-`static` `@AutoClose` field will be closed after the execution of each
> test method, test factory method, or test template method. However, if the test class is
> configured with `@TestInstance(Lifecycle.PER_CLASS)` semantics, a non-`static`
> `@AutoClose` field will not be closed until the current test class instance is no longer
> needed, which means after `@AfterAll` methods and after all `static` `@AutoClose` fields
> have been closed."*

So the same annotation on the same field closes **per test method** under the default
lifecycle and **once per class** under `PER_CLASS` ([03b](03b-per-class-lifecycle.md)).
Switching a class to `PER_CLASS` for an unrelated reason silently changes when your
resources are released — and if the resource is a connection with a per-test expectation,
that is a behaviour change, not a performance tweak.

## The ordering rule, and why you must not lean on it

> *"`@AutoClose` fields are inherited from superclasses. Furthermore, `@AutoClose` fields
> from subclasses will be closed before `@AutoClose` fields in superclasses."*

> *"When multiple `@AutoClose` fields exist within a given test class, the order in which
> the resources are closed depends on an algorithm that is deterministic but intentionally
> nonobvious. This ensures that subsequent runs of a test suite close resources in the same
> order, thereby allowing for repeatable builds."*

**Subclass before superclass is guaranteed. Field-to-field order within one class is
not** — it is the same "deterministic but intentionally nonobvious" formula the framework
uses for test methods ([11 · execution order](11-execution-order.md)), and it exists
precisely so that nobody writes a test that depends on it. If closing A before B matters,
they are not two independent resources: close them yourself in `@AfterEach`, or give one
ownership of the other.

## Choosing between the three cleanup mechanisms

| Mechanism | Scope | Use when |
|---|---|---|
| try-with-resources | one statement | the resource is created and finished inside a single test |
| `@AutoClose` field | instance or class, per the lifecycle | the resource is a field several tests use |
| `@AfterEach` / `@AfterAll` | whatever you write | ordering matters, or closing is more than one call |

try-with-resources remains the default answer for anything local — it is plain Java, it is
visible, and it needs no framework. `@AutoClose` earns its place for a field, and mainly
because it cannot be forgotten the way an `@AfterEach` can be when a second resource is
added later.

## Gotchas

**★ A `null` `@AutoClose` field.**
Ignored, with a warning in the log that nobody reads. If the field is assigned in
`@BeforeEach` and the assignment throws, the resource is never closed and the reason is a
log line.

**★ Depending on the order two `@AutoClose` fields are closed in.**
Deterministic, intentionally nonobvious, and not part of the contract. Only
subclass-before-superclass is guaranteed. Order-sensitive shutdown belongs in `@AfterEach`.

**★ Switching a class to `PER_CLASS` and changing when resources close.**
A non-`static` `@AutoClose` field closes after every test method under `PER_METHOD` and
only after `@AfterAll` under `PER_CLASS`. Nothing in the diff mentions the resource.

**★ Assuming `@AutoClose` requires `AutoCloseable`.**
It requires a no-argument method whose name defaults to `close`. `@AutoClose("shutdown")`
covers the legacy APIs, which is most of the reason the annotation exists.
**★ Using `@AutoClose` on a resource that must be closed before an assertion.**
It closes after the test method, not inside it. A test that asserts on a file's contents
after a writer is flushed needs the writer closed explicitly — usually with
try-with-resources inside the test.

**★ Assuming you know what happens when `close()` itself throws.**
The user guide documents when `@AutoClose` fires and in what order, but **does not state
how an exception thrown from the close method is reported** — and I could not settle it
from the documentation. If a resource's `close()` can fail meaningfully, close it in
`@AfterEach` where you control the handling.

## Interview questions

**★ When exactly does `@AutoClose` close a non-static field?**
Before the test class instance is destroyed — which under the default `PER_METHOD`
lifecycle is after each test method, and under `PER_CLASS` is after `@AfterAll` and after
all `static` `@AutoClose` fields have been closed. `static` fields close after all tests in
the class, effectively after `@AfterAll`.

**★ In what order are several `@AutoClose` fields closed?**
Subclass fields before superclass fields — that part is documented. Within one class the
order is "deterministic but intentionally nonobvious", which is the framework's way of
saying it is repeatable but not a contract. If order matters, close them explicitly.

**★ Does `@AutoClose` require the field to implement `AutoCloseable`?**
No. It looks for a no-argument method named `close` by default, and the name is
configurable via the annotation's `value` — `@AutoClose("shutdown")`. A `null` field is
skipped with a logged warning.

{/* FOOTER */}