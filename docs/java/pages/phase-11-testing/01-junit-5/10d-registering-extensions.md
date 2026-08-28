---
title: "An extension that does nothing is almost never broken — it is registered somewhere the callbacks it implements are not honoured, and @ExtendWith is the one route with no restrictions at all"
sidebar_label: "10d · Registering extensions"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Registering Extensions"
> ([extensions/registering-extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html));
> javadoc for `@ExtendWith`
> ([ExtendWith](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExtendWith.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[10](10-extensions.md) is the catalogue of extension points and [10b](10b-writing-one.md)
is a finished extension. Neither is any use until the extension actually reaches the
registry — and *where* you register it decides *what* runs. This chunk is the declarative
route, which is the one with no restrictions and therefore the one to reach for first.**

The programmatic route and the `static`/instance rule that silently disables half the API
are [10e · @RegisterExtension](10e-registerextension.md); ordering, auto-detection and
inheritance are [10f · registration order](10f-registration-order.md).

## The routes, in the guide's own words

> *"Extensions can be registered declaratively via `@ExtendWith`, programmatically via
> `@RegisterExtension`, or automatically via Java's `ServiceLoader` mechanism."*

Three routes, plus a fourth thing that is not a route so much as a consequence:
**inheritance**, which propagates all three down a class hierarchy and from class level to
method level.

The choice between them is not stylistic. Each lands the extension at a different point in
the registry, and two of the three restrict which extension APIs are honoured.

## `@ExtendWith` takes a class, and Jupiter owns the instance

That single fact explains both of `@ExtendWith`'s properties: it cannot be configured, and
the test cannot talk to the extension. You supply a class reference; Jupiter builds it.

> *"Developers can register one or more extensions declaratively by annotating a test
> interface, test class, test method, or custom composed annotation with `@ExtendWith(…)`
> and supplying class references for the extensions to register. `@ExtendWith` may also be
> declared on fields or on parameters in test class constructors, in test methods, and in
> `@BeforeAll`, `@AfterAll`, `@BeforeEach`, and `@AfterEach` lifecycle methods."*

Read the list again: **test interface, class, method, composed annotation, field,
parameter.** Six placements, and the javadoc's target set confirms the raw four:

> *"`@Target({ TYPE, METHOD, FIELD, PARAMETER })` … `@Retention(RUNTIME)` … `@Documented` …
> `@Inherited` … `@Repeatable(Extensions.class)`"*

**The test-interface placement is the least known and the most useful.** A test interface
carrying `@ExtendWith` gives a whole family of test classes the same environment through
`implements`, and it composes where a base class does not — Java gives you exactly one
superclass to spend, and the day a second orthogonal test concern wants it, one of them has
to become an interface anyway.

```java
interface RunsAgainstTheRealDatabase {
}
```

with `@ExtendWith(DatabaseExtension.class)` on the interface declaration, is a capability a
test class opts into by name, and it stacks with any other such interface.

## Two spellings, one meaning, one ordering rule

`@ExtendWith` is `@Repeatable(Extensions.class)`, so both of these compile:

```java
@ExtendWith({ DatabaseExtension.class, WebServerExtension.class })
class MyFirstTests {
}
```

```java
@ExtendWith(DatabaseExtension.class)
@ExtendWith(WebServerExtension.class)
class MySecondTests {
}
```

> *"Extensions registered declaratively via `@ExtendWith` at the class level, method level,
> or parameter level will be executed in the order in which they are declared in the source
> code. For example, the execution of tests in both `MyFirstTests` and `MySecondTests` will
> be extended by the `DatabaseExtension` and `WebServerExtension`, in exactly that order."*

The javadoc says the same thing in terms of discovery:

> *"When `@ExtendWith` is present on a test class, test interface, or test method or on a
> parameter in a test method or lifecycle method, the corresponding extensions will be
> registered in the order in which the `@ExtendWith` annotations are discovered."*

**Source order is a real contract at class, method and parameter level.** You may depend on
it, and it is the reason `@ExtendWith({ A.class, B.class })` is a legitimate way to express
"A wraps B".

🔴 It is emphatically **not** the rule for `@ExtendWith` on **fields**. Same annotation,
deliberately weaker guarantee — field registration is *"deterministic but intentionally
nonobvious"* and needs `@Order` ([10f](10f-registration-order.md)). The asymmetry inside one
annotation is the part that catches people.

## Which extension APIs `@ExtendWith` honours

The javadoc prints the list under "Supported Extension APIs", and it is the complete
catalogue: `ExecutionCondition`, `InvocationInterceptor`, `BeforeAllCallback`,
`AfterAllCallback`, `BeforeEachCallback`, `AfterEachCallback`,
`BeforeTestExecutionCallback`, `AfterTestExecutionCallback`, `TestInstanceFactory`,
`TestInstancePostProcessor`, `TestInstancePreConstructCallback`,
`TestInstancePreDestroyCallback`, `ParameterResolver`,
`LifecycleMethodExecutionExceptionHandler`, `TestExecutionExceptionHandler`,
`TestTemplateInvocationContextProvider`, `TestWatcher`.

Nothing is excluded. That is the first reason to treat `@ExtendWith` as the default and
`@RegisterExtension` as the thing you escalate to when you need what only it provides — the
instance-field form of the programmatic route silently drops four of those interfaces
([10e](10e-registerextension.md)).

## The composed annotation

This is the idiom every published extension uses, and the reason you have never typed
`SpringExtension` by hand. `@ExtendWith` as a meta-annotation means the user names a
*capability*, not an implementation class:

```java
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@ExtendWith({ DatabaseExtension.class, WebServerExtension.class })
public @interface DatabaseAndWebServerExtension {
}
```

> *"Then `@DatabaseAndWebServerExtension` can be used in place of
> `@ExtendWith({ DatabaseExtension.class, WebServerExtension.class })`."*

This is how `@SpringBootTest` pulls in `SpringExtension`. It is also how an *injection*
annotation is built — `@Random` from [10b](10b-writing-one.md) is meta-annotated
`@ExtendWith(RandomNumberExtension.class)` with `@Target({ FIELD, PARAMETER })`, so
annotating a field both requests a value and registers the extension that supplies it:

```java
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
@ExtendWith(RandomNumberExtension.class)
public @interface Random {
}
```

The `@Target` set on *your* annotation is what decides where it can be used, and it must be
a subset of the placements `@ExtendWith` itself supports. A `@Random` declared
`@Target(METHOD)` cannot annotate a parameter, and the compiler will tell you — that one is
loud. The retention is the quiet one.

**`RetentionPolicy.RUNTIME` is not optional.** Jupiter discovers extensions by reflecting
over annotations at execution time. At the default `CLASS` retention the annotation is
written into the class file and then discarded by the class loader, so `@ExtendWith`
meta-annotated on it is invisible, the extension never registers, and there is no error —
the field simply keeps its default value.

## Gotchas

**★ A composed annotation left at the default `CLASS` retention.**
`@ExtendWith` as a meta-annotation only works when your annotation carries
`@Retention(RetentionPolicy.RUNTIME)`. Omit it and you get no error, no warning and no
extension. If a custom injection annotation "does nothing", check the retention before you
check anything else.

**★ Assuming source order governs `@ExtendWith` on fields.**
It governs class-, method- and parameter-level `@ExtendWith`. Field-level `@ExtendWith` is
ordered by the deterministic-but-nonobvious algorithm, exactly like `@RegisterExtension`
fields, and needs `@Order` ([10f](10f-registration-order.md)).

**★ Trying to configure an `@ExtendWith` extension with a static setter.**
The usual workaround for "I need to pass a port in" is a `static` mutable field on the
extension set from `@BeforeAll`. That makes the extension order-dependent and unusable under
parallel execution ([12 · parallel execution](12-parallel-execution.md)), and it breaks the
moment two test classes want different values. `@RegisterExtension` exists precisely so you
do not do this.

**★ Spending your one superclass on a base test class.**
`@ExtendWith` is legal on a test interface and a class may implement several. A
`BaseIntegrationTest` that exists only to carry two annotations is a superclass you cannot
get back.

**★ Putting `@ExtendWith` on a method when the extension implements `BeforeAllCallback`.**
Method-level registration happens per test method; a class-level callback registered there
has no class-level context to fire in. The guide does not enumerate this case, so treat it
as "register class-level concerns at class level" rather than as a documented rule — but the
symptom, a callback that never runs, is identical to the instance-field trap in
[10e](10e-registerextension.md).

**★ Forgetting that `@ExtendWith` is `@Inherited`.**
A class-level `@ExtendWith` on an abstract base test class applies to every subclass. That
is usually what you want, and occasionally it means a subclass is silently running an
extension nobody reading it would expect — which is one more reason the base class should be
small enough to read.

## Interview questions

**★ Where can `@ExtendWith` be declared?**
On a test interface, a test class, a test method, a custom composed annotation, a field, and
on parameters of test class constructors, test methods, and `@BeforeAll`, `@AfterAll`,
`@BeforeEach` and `@AfterEach` lifecycle methods. The javadoc's target set is
`{ TYPE, METHOD, FIELD, PARAMETER }` and the annotation is `@Repeatable` and `@Inherited`.
The interface placement is the one worth remembering: it gives a family of test classes a
shared environment without consuming the single inheritance slot.

**★ Why does a custom annotation meta-annotated with `@ExtendWith` need `RUNTIME` retention?**
Because Jupiter finds extensions by reflecting over annotations at execution time. At the
default `CLASS` retention the annotation exists in the class file but is discarded by the
class loader, so the meta-annotation is never seen and the extension never registers. There
is no diagnostic — the annotated field just keeps its default value, which is why this bug
survives review.

**★ In what order do `A` and `B` run under `@ExtendWith({A.class, B.class})`, and is that
guaranteed?**
`A` then `B`, and yes — the guide guarantees source declaration order for `@ExtendWith` at
class, method and parameter level, and the javadoc restates it as discovery order. Since
extensions wrap user code, "A registered first" means A's `before` callbacks run first and
A's `after` callbacks run last. The guarantee does *not* extend to `@ExtendWith` on fields.

**★ Which extension APIs does `@ExtendWith` support?**
All of them. The javadoc lists the full catalogue from `ExecutionCondition` through
`TestWatcher`, with no exclusions. That is the argument for making `@ExtendWith` the default
route: the alternatives either restrict the API set (an instance `@RegisterExtension` field)
or hide the registration from the reader entirely (`ServiceLoader` auto-detection).

**★ Your extension needs a port number chosen by the test class. Can you use `@ExtendWith`?**
Not on its own. `@ExtendWith` supplies a class reference and Jupiter constructs the instance,
so there is nowhere to pass a value in short of a static mutable field, which makes the
extension order-dependent and parallel-hostile. Either express the configuration as
attributes on a custom composed annotation that the extension reads from the element it is
attached to, or register programmatically with `@RegisterExtension`.

{/* FOOTER */}
