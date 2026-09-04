---
title: "mockConstruction intercepts the new operator itself, which makes it the most powerful and the most alarming thing in Mockito's API — it is scoped and thread-local for the same reasons mockStatic is, and needing it means a class is building its own collaborators, which a factory parameter fixes permanently"
sidebar_label: "11c · Mocking construction"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 49 (*"Mocking object construction"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> the `Mockito.mockConstruction(...)` and `Mockito.mockConstructionWithAnswer(...)` javadocs,
> and the
> [`MockedConstruction`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/MockedConstruction.java)
> and
> [`ScopedMock`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ScopedMock.java)
> interfaces. Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[11](11-static-and-final.md) rewrites what a class's static methods do; this rewrites what
`new` produces. Inside the scope, every construction of the named type yields a mock instead of
an object — which is genuinely the only way to reach some legacy code, and is also a statement
that the class under test builds its own collaborators. The scope rules are identical to the
static case and the failure modes are the same. The design reading is
[11b](11b-static-mocking-as-a-design-signal.md)'s, pointed at a constructor.**

## The API

Section 49's own example:

```java
assertEquals("foo", new Foo().method());
try (MockedConstruction<Foo> mocked = mockConstruction(Foo.class)) {
    Foo foo = new Foo();
    when(foo.method()).thenReturn("bar");
    assertEquals("bar", foo.method());
    verify(foo).method();
}
assertEquals("foo", new Foo().method());
```

Note what is different from `mockStatic`: **the objects you get back are ordinary mocks**, so
you stub and verify them with plain `when` and `verify`, not through the controller. The
controller's job is only to define the window and to hand you the instances.

Like the static case, the preconditions and the lifetime are stated in the first two sentences
of the javadoc:

> *"When using the inline mock maker, it is possible to generate mocks on constructor
> invocations within the current thread and a user-defined scope. This way, Mockito assures
> that concurrently and sequentially running tests do not interfere."*

> *"Creates a thread-local mock controller for all constructions of the given class. The
> returned object's `MockedConstruction#close()` method must be called upon completing the test
> or the mock will remain active on the current thread."*

`MockedConstruction` extends `ScopedMock`, so `close()`, `closeOnDemand()` and `isClosed()`
behave exactly as described in [11](11-static-and-final.md), with the same consequence for a
leaked scope: `new Foo()` keeps returning mocks for everything else that runs on that thread.

And the parameter accepts only *"non-abstract class of which constructions should be mocked"* —
an abstract type has no constructor call to intercept.

## Reaching the instances: `constructed()`

The controller keeps them, in order:

> *"Get the constructed mocks."* — `List<T> constructed();`

```java
try (MockedConstruction<HttpExporter> mocked = mockConstruction(HttpExporter.class)) {
    service.exportAll();                                  // constructs one internally

    assertThat(mocked.constructed()).hasSize(1);
    verify(mocked.constructed().get(0)).send(any());
}
```

This is the only handle you get, and it is positional. A method that constructs two of the same
type gives you a two-element list distinguished by nothing but order — which is a good reason
to keep the scope narrow.

## Configuring the mocks as they are born: `MockInitializer`

You usually need the mock stubbed *before* the code under test uses it, and the code under test
is the thing doing the constructing. The initializer callback is how:

```java
try (MockedConstruction<HttpExporter> mocked = mockConstruction(HttpExporter.class,
        (mock, context) -> {
            when(mock.send(any())).thenReturn(ExportResult.ACCEPTED);
        })) {
    assertThat(service.exportAll()).isEqualTo(Status.OK);
}
```

`MockInitializer` is documented as *"Functional interface that consumes a newly created mock and
the mock context… Used to attach behaviours to new mocks."*, with
`void prepare(T mock, Context context) throws Throwable`.

### The `Context` is where the constructor arguments are

`MockedConstruction.Context` carries three things, and they are the only way to assert on what
the code under test passed to `new`:

| Method | Javadoc |
|---|---|
| `int getCount()` | ⚠️ carries **no javadoc** on the interface. Its 1-based meaning is readable from `Mockito.mockConstructionWithAnswer`, which branches on `context.getCount() == 1` for the first construction and indexes `additionalAnswers[context.getCount() - 2]` thereafter — read from the source, not from prose. |
| `Constructor<?> constructor()` | *"Get the constructor that is invoked during the mock creation."* |
| `List<?> arguments()` | *"Get the arguments that were passed to the constructor, as a list."* |

```java
List<Object> firstCallArgs = new ArrayList<>();
try (MockedConstruction<HttpExporter> mocked = mockConstruction(HttpExporter.class,
        (mock, context) -> {
            if (context.getCount() == 1) {
                firstCallArgs.addAll(context.arguments());
            }
            when(mock.send(any())).thenReturn(ExportResult.ACCEPTED);
        })) {
    service.exportAll();
}
assertThat(firstCallArgs).containsExactly(URI.create("https://sink.example/v1"), Duration.ofSeconds(2));
```

That is the constructor-argument equivalent of an `ArgumentCaptor`
([06 · Argument captors](06-argument-captors.md)) — and note that it needs the surrounding
mutable list, because there is no captor API for constructors.

`getCount()` also lets you give the first and second construction different *default answers*,
which is what `mockConstructionWithAnswer(Class, Answer, Answer...)` packages up. Its own
`@param` text is the specification:

> *"`defaultAnswer` — the default answer for the first created mock."*
> *"`additionalAnswers` — the default answer for all additional mocks. For any access mocks,
> the last answer is used. If this array is empty, the `defaultAnswer` is used."*

Note that these are **default answers** ([03f · Default answers](03f-default-answers.md)), not
per-call stubbings — this API changes what an unstubbed method returns on the nth constructed
mock, which is a narrower thing than the `MockInitializer` gives you.

## What it is genuinely for

One case, and it is a real one: **a class that constructs a collaborator internally and that you
cannot change yet.**

```java
public class ReportJob {
    public Status run(Config config) {
        HttpExporter exporter = new HttpExporter(config.uri(), config.timeout());  // hidden
        return exporter.send(buildReport()) == ACCEPTED ? Status.OK : Status.FAILED;
    }
}
```

There is no seam. No parameter, no setter, no field — the collaborator comes into existence
inside the method. `mockConstruction` manufactures a seam where the language provides none,
which is why it exists and why it is the tool of choice for characterising legacy code before
changing it.

## The design reading, and the fix

`new` inside a method is a hard-coded dependency in the most literal sense: the class name is
compiled into the method body. The refactor is
[10c](10c-the-refactor-that-removes-the-need.md) again, with a factory:

```java
// After — the collaborator arrives through a factory the caller supplies
public interface ExporterFactory {
    Exporter create(Config config);
}

public class ReportJob {
    private final ExporterFactory exporters;

    public ReportJob(ExporterFactory exporters) { this.exporters = exporters; }

    public Status run(Config config) {
        return exporters.create(config).send(buildReport()) == ACCEPTED
                ? Status.OK : Status.FAILED;
    }
}
```

```java
// The test: two ordinary mocks, no scope, no thread-local, no inline mock maker requirement.
@Mock ExporterFactory exporters;
@Mock Exporter exporter;

when(exporters.create(any())).thenReturn(exporter);
when(exporter.send(any())).thenReturn(ACCEPTED);
```

And often you do not even need the factory — if the collaborator's lifetime matches the
service's, inject the `Exporter` itself and delete the factory interface. The factory earns its
place only when a new instance per call is genuinely required.

Compare what each version can express. With `mockConstruction`, asserting on the constructor
arguments needs a `MockInitializer`, a captured `Context`, and an external mutable list. With
the factory, it is `verify(exporters).create(expectedConfig)` — one line, using the machinery
the rest of the topic already covers.

## Gotchas

**★ A leaked `MockedConstruction` makes `new Foo()` return a mock for the rest of the thread.**
Same rule as the static case: *"the mock will remain active on the current thread"* if you never
close it. Everything that constructs that type afterwards — including framework code and later
test classes on the same worker — gets a mock with default answers, and the failure appears
somewhere that never mentions Mockito.

**★ Stubbing through the controller instead of on the instance.**
`MockedConstruction` has no `when`. The constructed objects are plain mocks, so you stub them
with `Mockito.when` — either inside the `MockInitializer` or on an element of `constructed()`.
This is the opposite convention from `MockedStatic`, and mixing them up is the most common
first mistake.

**★ Trying to stub after the code under test has already used the instance.**
`service.exportAll()` constructs, uses and discards the collaborator inside one call. Stubbing
`constructed().get(0)` afterwards is too late; the behaviour has to be attached in the
`MockInitializer`, which runs at construction time.

**★ `constructed()` is positional and gives you nothing else.**
Two constructions of the same type are distinguished only by index. If the method builds a
primary and a fallback exporter, the test now depends on the order in which they are
constructed — a real coupling to implementation detail, and a strong argument for the factory
refactor.

**★ `mockConstruction` on an abstract class.**
The parameter is documented as *"non-abstract class of which constructions should be mocked"*.
There is no constructor invocation of an abstract type to intercept; the concrete subclass is
what gets constructed and what you must name.

**★ Every construction in the scope is intercepted, not just the one you meant.**
If the type is constructed by a library, a logger or a nested call during the same window, those
become mocks too. Keep the try-with-resources block down to the single call under test.

**★ Name the concrete type that is actually constructed.**
The parameter is the *"non-abstract class of which constructions should be mocked"*, so the
type you pass is the type whose constructor is intercepted. ⚠️ **I could not confirm from the
documentation** whether constructing a subclass of the named type is intercepted as well — the
javadoc does not say either way. Do not rely on either behaviour: pass the exact class the code
under test writes after `new`.

**★ Assuming it works on another thread.**
*"within the current thread and a user-defined scope"* — a collaborator constructed inside an
executor task is a real one. This is the same trap as the static case and it produces the same
misleading "flaky" diagnosis.

**★ Using it because the constructor is expensive rather than because there is no seam.**
An expensive constructor is a reason to inject the object, not to intercept its construction.
Interception keeps the expense in production and hides it only from the test.

**★ Leaving `mockConstruction` in place after the refactor that made it unnecessary.**
Once the factory exists, the scope is dead weight that still carries the leak risk and still
requires the inline mock maker. Delete it in the same commit.

## Interview questions

**★ What does `mockConstruction` do?**
Within a thread-local scope, it makes every `new` of the named non-abstract class produce a
Mockito mock instead of a real instance. The returned `MockedConstruction<T>` is a `ScopedMock`
you must close — normally with try-with-resources — and it exposes `constructed()`, the list of
mocks that were produced, plus an optional `MockInitializer` callback for stubbing each one at
the moment it is created.

**★ How do you stub an object that the code under test constructs internally?**
Through the `MockInitializer` passed to `mockConstruction`, because by the time the call returns
the object has already been used. The initializer receives the new mock and a `Context`, so you
can both attach behaviour and read the constructor arguments the code passed.

**★ How do you assert on the arguments passed to a constructor?**
`MockedConstruction.Context.arguments()` inside the initializer — *"Get the arguments that were
passed to the constructor, as a list."* There is no `ArgumentCaptor` for constructors, so the
usual shape is to copy them into a list declared outside the try-with-resources and assert after
the block. Which is also a decent argument for injecting a factory instead, where the assertion
becomes an ordinary `verify`.

**★ How does `mockConstruction` differ from `mockStatic` in how you use it?**
`MockedStatic` is the stubbing and verification surface — you call `mocked.when(...)` and
`mocked.verify(...)` on the controller. `MockedConstruction` is only a scope and a registry: the
things it produces are normal mocks, so you use `Mockito.when` and `Mockito.verify` on them
directly. The lifecycle rules — thread-local, must be closed, inline mock maker required — are
identical.

**★ What does needing `mockConstruction` say about the class under test?**
That it builds its own collaborators, so the class name is compiled into the method body and no
caller can substitute anything. The fix is to pass the collaborator in, or a factory for it if a
fresh instance per call is genuinely required. After that the test is two ordinary mocks and the
constructor-argument assertion becomes `verify(factory).create(...)`.

**★ When is it legitimate?**
When there is no seam and you cannot yet create one: legacy code you are characterising before
changing it, or a class whose construction happens inside a framework you do not own. It is the
strongest tool in the API for getting a first test around untestable code, and the first thing
to delete once that test has enabled the refactor.

{/* FOOTER */}
