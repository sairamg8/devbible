---
title: "Mockito can mock static methods since 3.4.0, and the API's shape is itself the warning: the mock is thread-local, it is scoped, and it must be closed — because a static method you need to mock is a dependency your class never declared, and the framework can only pretend it did for as long as you hold the scope open"
sidebar_label: "11 · Static and final"
sidebar_position: 48
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 48 (*"Mocking static methods"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> the `Mockito.mockStatic(Class)` javadoc, the
> [`MockedStatic`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/MockedStatic.java)
> and
> [`ScopedMock`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ScopedMock.java)
> interfaces, the
> [`@Mock`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mock.java)
> javadoc, and `InlineDelegateByteBuddyMockMaker.createStaticMock`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Static mocking is the only feature in Mockito whose API forces you to acknowledge what it is
doing. `mock(Foo.class)` hands you an object; `mockStatic(Foo.class)` hands you a resource with
a lifetime, bound to one thread, that you are responsible for releasing. That design is not
awkwardness — it is the honest consequence of globally rewriting a class's behaviour for a
while. This page is the mechanism, the scope rule and the ways a leaked scope breaks other
tests. [11b · Static mocking as a design signal](11b-static-mocking-as-a-design-signal.md) is
what needing it says about the code and the injected alternative that removes it;
[11c · Mocking construction](11c-mocking-construction.md) is the `new`-operator equivalent; and
[11d · Final, enums and the unmockable](11d-final-enums-and-the-unmockable.md) is what the
inline mock maker still refuses.**

## It needs the inline mock maker

Section 48 opens with the precondition:

> *"When using the inline mock maker, it is possible to mock static method invocations within
> the current thread and a user-defined scope."*

Since Mockito 5.0.0 the inline maker is the default, so on the Boot 4.1 spine this works out of
the box — subject to the Java agent question that [02b · The inline mock
maker](02b-the-inline-mock-maker.md) covers, and to the maker you selected in
[02c · Choosing a mock maker](02c-choosing-a-mock-maker.md). Switch a module to
`mock-maker-subclass` or `mock-maker-proxy` and every `mockStatic` in it stops working.

## The API

```java
assertEquals("foo", Foo.method());
try (MockedStatic<Foo> mocked = mockStatic(Foo.class)) {
    mocked.when(Foo::method).thenReturn("bar");
    assertEquals("bar", Foo.method());
    mocked.verify(Foo::method);
}
assertEquals("foo", Foo.method());
```

That is section 48's own example, and every part of it is load-bearing.

- **`mockStatic` returns a controller, not a mock.** You never hold an instance of `Foo`;
  `MockedStatic<Foo>` is a handle on the *rewriting*.
- **Stubbing and verification go through the controller**, not through `Mockito.when` /
  `Mockito.verify`. `mocked.when(...)`, `mocked.verify(...)`.
- **The argument is a `MockedStatic.Verification`** — a functional interface whose single
  method is `void apply() throws Throwable`. That is why you write `Foo::method` or
  `() -> Foo.parse("x")` rather than passing a value.
- **Outside the block, `Foo.method()` is real again.** Section 48: *"Due to the defined scope
  of the static mock, it returns to its original behavior once the scope is released."*

`MockedStatic` also carries `reset()`, `clearInvocations()`, `verifyNoMoreInteractions()` and
`verifyNoInteractions()`, each documented as *"See `Mockito#…`"* — the same operations, aimed at
the static rewriting instead of at an object.

## 🔴 The scope rule, and it is thread-local

This is the sentence to read twice. From `MockedStatic`'s type javadoc, verbatim:

> *"Represents an active mock of a type's static methods. The mocking only affects the thread
> on which this static mock was created and it is not safe to use this object from another
> thread. The static mock is released when this object's `MockedStatic#close()` method is
> invoked. **If this object is never closed, the static mock will remain active on the
> initiating thread.** It is therefore recommended to create this object within a
> try-with-resources statement unless when managed explicitly, for example by using a JUnit
> rule or extension."*

And `Mockito.mockStatic(Class)` says the same from the other side:

> *"Creates a thread-local mock controller for all static methods of the given class or
> interface. The returned object's `MockedStatic#close()` method must be called upon completing
> the test or the mock will remain active on the current thread."*

Three consequences follow, and each is a different failure.

**1 · A leaked scope poisons later tests on the same thread.** JUnit reuses threads. A test
that opens a static mock and does not close it leaves `Foo.method()` returning `"bar"` for
every subsequent test that runs on that worker. The failure surfaces in an unrelated test
class, at a line that never mentions Mockito, and it moves when you reorder tests or change
parallelism — see [01-junit-5/12-parallel-execution.md](../01-junit-5/12-parallel-execution.md)
for what decides which thread runs what.

**2 · The mock does not apply to code running on another thread.** If the code under test
submits work to an executor, that work sees the *real* static. A test that stubs
`Foo.method()` and asserts on the result of an asynchronous task will fail for a reason that
looks like a race and is not one.

**3 · The object itself is not safe to share.** *"it is not safe to use this object from
another thread"* — so a `MockedStatic` held in a `static` field, or opened in `@BeforeAll` and
used by parallel tests, is undefined behaviour rather than a slow test.

### `ScopedMock`: `close`, `closeOnDemand`, `isClosed`

`MockedStatic` extends `ScopedMock`, which is where the lifecycle actually lives:

> *"Represents a mock with a thread-local explicit scope. Scoped mocks must be closed by the
> entity that activates the scoped mock."*

Three methods, with a distinction that matters:

| Method | Behaviour, verbatim |
|---|---|
| `close()` | *"Closes this scoped mock and throws an exception if already closed."* |
| `closeOnDemand()` | *"Releases this scoped mock and is non-operational if already released."* |
| `isClosed()` | *"Checks if this mock is closed."* |

`close()` is deliberately strict — double-closing is a bug and it tells you. `closeOnDemand()`
is the idempotent variant for cleanup code that cannot know whether the scope survived. In an
`@AfterEach` that must run whatever happened, `closeOnDemand()` is the correct call.

## The annotation form

You do not have to write the try-with-resources yourself. From the `@Mock` javadoc, in the list
of what the annotation does:

> *"Automatically detects static mocks of type `MockedStatic` and infers the static mock type
> of the type parameter."*

and from `MockedStatic`:

> *"If the `Mock` annotation is used on fields or method parameters of this type, a static mock
> is created instead of a regular mock. The static mock is activated and released upon
> completing any relevant test."*

```java
@ExtendWith(MockitoExtension.class)
class LegacyIdsTest {

    @Mock MockedStatic<LegacyIdGenerator> ids;      // scope == this test method

    @Test
    void the_generated_id_is_carried_into_the_receipt() {
        ids.when(LegacyIdGenerator::newId).thenReturn("ID-1");
        assertThat(service.confirm(ORDER_ID).reference()).isEqualTo("ID-1");
    }
}
```

The extension opens and closes the scope around the test, so the leak in failure mode 1 cannot
happen. **Prefer this form** whenever the whole test needs the static mocked; keep
try-with-resources for the case where only part of a test should see it. The parameter form —
a `MockedStatic<T>` parameter on the test method — works the same way and scopes even more
tightly.

## What static mocking refuses outright

The mock maker rejects a handful of types by name, and the reasons are in its own source. From
`InlineDelegateByteBuddyMockMaker.createStaticMock`, the thrown messages are:

> *"It is not possible to mock static methods of ConcurrentHashMap to avoid infinitive loops
> within Mockito's implementation of static mock handling"*

and, for `Thread`, `System`, `Arrays` and anything assignable to `ClassLoader`:

> *"It is not possible to mock static methods of &lt;type&gt; to avoid interfering with class
> loading what leads to infinite loops"*

So `System.currentTimeMillis()`, `Thread.sleep(...)` and `Arrays.asList(...)` are out — which
happens to remove the three static calls people most often want to mock. The `mockStatic`
javadoc adds a general recommendation on top:

> *"**Note**: We recommend against mocking static methods of classes in the standard library or
> classes used by custom class loaders used to execute the block with the mocked class. A mock
> maker might forbid mocking static methods of know classes that are known to cause problems.
> Also, if a static method is a JVM-intrinsic, it cannot typically be mocked even if not
> explicitly forbidden."*

⚠️ **What I could not confirm from the documentation:** which methods count as JVM-intrinsic in
a given JDK build. The javadoc states the limitation without enumerating it, and the set is a
HotSpot implementation detail rather than a Mockito one. Treat "this static will not stub and I
cannot see why" as a possible intrinsic and route around it rather than fighting it.

Everything above is the mechanism. The question a reviewer should ask — *why does this test need
a scoped, thread-local exemption at all?* — is
[11b · Static mocking as a design signal](11b-static-mocking-as-a-design-signal.md).

## Gotchas

**★ A `MockedStatic` that is never closed leaves the static mocked for the rest of the thread.**
Verbatim: *"If this object is never closed, the static mock will remain active on the initiating
thread."* JUnit reuses worker threads, so the damage lands in a later, unrelated test class and
looks like flakiness. Use try-with-resources or the `@Mock MockedStatic<T>` field form; never a
bare `MockedStatic<Foo> m = mockStatic(Foo.class);` in a `@BeforeEach` with no matching close.

**★ Opening a static mock in `@BeforeAll` or holding one in a `static` field.**
The scope is thread-local and the object is *"not safe to use … from another thread"*. With
parallel execution, or simply with a different worker thread running a later test in the class,
the behaviour is undefined rather than merely wrong.

**★ The static mock does not apply inside an executor, a `CompletableFuture` or a new thread.**
Mocking *"only affects the thread on which this static mock was created"*. Code the SUT runs
asynchronously sees the real static, so the assertion fails in a way that looks like a timing
problem.

**★ Calling `close()` twice.**
`close()` *"throws an exception if already closed"*. In cleanup paths that may run after a
try-with-resources has already released the scope, use `closeOnDemand()`, which *"is
non-operational if already released"*.

**★ Using `Mockito.when(...)` instead of `mocked.when(...)`.**
`when(Foo.method())` evaluates the static call and hands Mockito a value; the stubbing belongs
to the controller and takes a `Verification` lambda. The static-mocking API is deliberately not
the instance-mocking API.

**★ Mocking `System`, `Thread`, `Arrays` or a `ClassLoader` subtype.**
Rejected by the mock maker with *"to avoid interfering with class loading what leads to
infinite loops"*, and `ConcurrentHashMap` with *"to avoid infinitive loops within Mockito's
implementation"*. If you wanted `System.currentTimeMillis()`, you wanted a `Clock` —
[10f · Mocking JDK types](10f-mocking-jdk-types.md).

**★ Assuming a static mock is scoped to the class you are testing.**
It is scoped to the *thread*, and it rewrites the static for every caller on that thread —
including framework code, logging, and anything else that happens to call the same method
during the block. Keep the block as small as the assertion allows.

**★ A `mockStatic` block wrapped around the whole test method out of habit.**
The wider the block, the more unrelated code runs against a rewritten class. Open it
immediately before the call under test and close it immediately after when you are using
try-with-resources.

**★ Static state left mutated by the stubbed call's absence.**
If the real static had side effects — populating a cache, registering a listener — stubbing it
out means those side effects do not happen, and later code that assumes them fails. A mocked
static is not a no-op; it is a different implementation, and the difference includes everything
the real one did on the way.

**★ Switching mock maker and breaking every static mock in the module.**
`mockStatic` is an inline-mock-maker feature. A per-project `mock-maker-subclass` or
`mock-maker-proxy` extension file — the escape hatch in
[02c](02c-choosing-a-mock-maker.md) — removes it silently for everything in that module.


## Interview questions

**★ How do you mock a static method in Mockito 5?**
`Mockito.mockStatic(Foo.class)` returns a `MockedStatic<Foo>` controller. Stub with
`mocked.when(Foo::method).thenReturn(...)` and verify with `mocked.verify(Foo::method)`. It
requires the inline mock maker — the default since 5.0.0 — and the controller is a scoped
resource, so it belongs in a try-with-resources block or in a `@Mock MockedStatic<Foo>` field
that the Mockito extension opens and closes for you.

**★ What exactly is the scope of a static mock?**
One thread, and the lifetime of the controller. The javadoc is explicit: *"The mocking only
affects the thread on which this static mock was created and it is not safe to use this object
from another thread"*, and *"If this object is never closed, the static mock will remain active
on the initiating thread."* So it does not reach code the SUT runs asynchronously, and a leaked
controller corrupts every later test on that worker thread.

**★ What happens if you forget to close a `MockedStatic`?**
The rewriting stays in place on that thread. Since test frameworks reuse threads, subsequent
tests — usually in a different class — see the stubbed behaviour, fail confusingly, and the
failure moves around when the execution order or parallelism changes. It is the classic
"passes alone, fails in the suite" shape.

**★ What is the difference between `close()` and `closeOnDemand()`?**
`close()` *"throws an exception if already closed"*; `closeOnDemand()` *"is non-operational if
already released"*. Use `close()` where double-closing would be a bug you want reported, and
`closeOnDemand()` in cleanup that may run after the scope has already ended.

**★ Which statics can Mockito not mock, and why?**
`ConcurrentHashMap`, because static mock handling itself uses one and it would recurse; and
`Thread`, `System`, `Arrays` and any `ClassLoader` subtype, because rewriting them *"interferes
with class loading"* and loops. Beyond that, the javadoc recommends against mocking standard
library statics in general, and notes that a JVM-intrinsic method typically cannot be mocked
even when not explicitly forbidden.

**★ Why does the static-mocking API use lambdas instead of the normal `when(mock.method())`
form?**
Because there is no mock object to call a method on. `MockedStatic.when` takes a
`MockedStatic.Verification`, a functional interface whose single method is
`void apply() throws Throwable`, so the stubbing is expressed as `Foo::method` or
`() -> Foo.parse("x")`. The API shape follows from the fact that the thing being mocked is a
class, not an instance.

{/* FOOTER */}
