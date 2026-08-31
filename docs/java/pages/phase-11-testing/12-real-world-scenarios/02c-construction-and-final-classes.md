---
title: "A collaborator constructed inside the method and a final class from a jar are the two shapes where Mockito's answer works perfectly and still leaves you with a worse test than the ten-line refactor would have"
sidebar_label: "02c · Construction and final classes"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc — §39 *"Mocking final types,
> enums and final methods"*, §49 *"Mocking object construction (since 3.5.0)"*, §56
> *"Mocking singletons (like Java enums) (Since 5.22.0)"* — read from
> `mockito-core-5.23.0-javadoc.jar` on Maven Central.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[02b](02b-when-the-collaborator-is-hard-to-mock.md) covered the static call and stated
the rule: use the trick when you cannot change the code, use the refactor when you can.
This chunk does the next two shapes. Both are interesting because Mockito's answer is not
merely adequate — `mockConstruction` and final-class mocking both just work — and the
argument for refactoring anyway is entirely about what the resulting test can and cannot
say. One of them makes your test assert something no user can observe; the other makes it
assert something you have no right to claim.**

## Shape 2 · A `new` inside the method

```java
public class ReportService {

    private final ReportConfig config;

    public byte[] build(ReportQuery query) {
        PdfRenderer renderer = new PdfRenderer(config);   // heavy: fonts, temp files
        return renderer.render(query);
    }
}
```

The collaborator exists only inside the method, so the constructor tells you nothing and
there is nowhere to hand a double in.

### The trick

`mockConstruction`, documented since Mockito 3.5.0 with the same scoping guarantees:

> *"When using the inline mock maker, it is possible to generate mocks on constructor
> invocations within the current thread and a user-defined scope. […] Due to the defined
> scope of the mocked construction, object construction returns to its original behavior
> once the scope is released."*

```java
@Test
void buildsThePdfFromTheQuery() {
    try (MockedConstruction<PdfRenderer> renderers =
                 mockConstruction(PdfRenderer.class,
                         (mock, ctx) -> given(mock.render(any())).willReturn(new byte[]{1, 2}))) {

        byte[] pdf = new ReportService(config).build(aQuery());

        assertThat(pdf).containsExactly(1, 2);
        assertThat(renderers.constructed()).hasSize(1);
    }
}
```

It works, and it has a specific smell: the test now asserts *how many `PdfRenderer`s were
constructed*, which is an implementation detail with no user-visible meaning. That
assertion will be the thing that breaks when somebody caches the renderer.

### The refactor, and how to choose between its two forms

**If the collaborator is reusable and thread-safe, inject the instance.** This is the
common case and the simplest one:

```java
public ReportService(PdfRenderer renderer) { this.renderer = renderer; }
```

**If a fresh one is genuinely needed per call** — it is stateful, it holds an open
handle, it is configured from the request — inject a factory:

```java
public interface PdfRendererFactory {
    PdfRenderer create(ReportConfig config);
}
```

```java
public class ReportService {

    private final PdfRendererFactory renderers;
    private final ReportConfig config;

    public ReportService(PdfRendererFactory renderers, ReportConfig config) {
        this.renderers = renderers;
        this.config = config;
    }

    public byte[] build(ReportQuery query) {
        return renderers.create(config).render(query);
    }
}
```

```java
@Bean PdfRendererFactory pdfRendererFactory() { return PdfRenderer::new; }
```

Again the production adapter is a constructor reference. And again the test stops asserting
construction counts and starts asserting the thing that matters:

```java
@Test
void buildsThePdfFromTheQuery() {
    given(renderers.create(config)).willReturn(renderer);
    given(renderer.render(query)).willReturn(new byte[]{1, 2});

    assertThat(new ReportService(renderers, config).build(query)).containsExactly(1, 2);
}
```

The rule for choosing: **inject the instance unless a fresh one per call is part of the
behaviour.** A factory that always returns the same thing is a singleton with extra
indirection, and it makes every test one stub longer than it needs to be.

## Shape 3 · A final class or a final method

Since Mockito 5.0.0 this mostly is not a problem any more. The javadoc, §39:

> *"Our ambition is that Mockito 'just works' with final classes and methods. Previously
> they were considered unmockable, preventing the user from mocking. Since 5.0.0, this
> feature is enabled by default."*

So `mock(SomeFinalClass.class)` works out of the box, with documented exclusions:

> *"Mocking final types and enums is incompatible with mock settings like: explicitly
> serialization support `withSettings().serializable()`, extra-interfaces
> `withSettings().extraInterfaces()`"*

> *"Some methods cannot be mocked: Package-visible methods of `java.*`, native methods"*

That is the trick, and it is nearly free. The reason to refactor anyway is not
capability — it is [01](01-what-to-mock-and-what-to-let-run.md)'s ownership clause. A
final class from a vendor jar is exactly the case where your stub encodes a belief about
somebody else's behaviour that nothing checks. Being *able* to mock it does not make the
stub true.

Two sub-cases with different answers:

- **A final class you own.** Delete the `final`, or extract an interface. Neither is a
  concession — if the class is a value type, you should not be mocking it at all
  ([01](01-what-to-mock-and-what-to-let-run.md)), and if it is a collaborator, an interface
  is what you wanted anyway.
- **A final class you do not own.** Wrap it. That is
  [04 · A third-party SDK](04-a-third-party-sdk.md).

There is also a third case worth knowing exists: an **enum** or another singleton you
cannot construct. Mockito 5.22.0 added `mockSingleton(Object)` for it, described as
*"thread-local mocking of singleton objects for which you don't control initialization,
assignment, or access. Java enums are a good example."* Reach for it in legacy code; do
not design towards it.

## Where this connects

- The rule, and the static-method shape: [02b](02b-when-the-collaborator-is-hard-to-mock.md).
- The forty-method vendor client, and the private method:
  [02d · Vendor clients and private methods](02d-vendor-clients-and-private-methods.md).
- Why both tricks on this page cost more on JDK 21 and later, and the table that decides
  trick-versus-refactor per shape:
  [02e · The agent tax and the decision table](02e-the-agent-tax-and-the-decision-table.md).
- Why a mockable vendor type is still not a type you should mock:
  [01 · What to mock and what to let run](01-what-to-mock-and-what-to-let-run.md).
- The full treatment of the vendor case: [04 · A third-party SDK](04-a-third-party-sdk.md)
  and [04b](04b-the-adapter-and-the-three-test-populations.md).
- `mockConstruction`, `MockedConstruction` and the mock-maker plumbing belong to **topic
  04 · Mockito**.

## Gotchas

**★ `mockConstruction` makes your test assert how many objects were constructed, which is not a behaviour.**
`renderers.constructed()` is the natural assertion because it is the only thing the API offers, and it is a pure implementation detail — it changes if someone adds a cache, reuses an instance, or moves the construction up a level, none of which a user can observe. If you find that assertion carrying the weight of a test, the test has no behavioural claim left in it.

**★ A factory interface that always returns the same instance is a singleton with extra steps and an extra stub in every test.**
`given(renderers.create(config)).willReturn(renderer)` is a line you pay in every test in the class. If nothing about the production code needs a *fresh* renderer per call, inject the renderer. The factory earns its place only when per-call state, an open resource, or request-derived configuration is genuinely part of the behaviour.

**★ Method references make the "adapter" for a static or a constructor nine characters long, and people write a whole class instead.**
`@Bean IdSource idSource() { return IdGenerator::next; }` and `@Bean PdfRendererFactory f() { return PdfRenderer::new; }` are the entire production side of both refactors. Teams routinely reject the refactor on the grounds that it means "writing wrappers", having pictured a hand-written class with a delegating method. If the interface has one method, the wrapper is a method reference.

**★ Being able to mock a final vendor class does not make the stub true.**
Mockito 5 removed the technical obstacle, and people read that as permission. The obstacle was never the point: the reason not to mock `CreateShipmentResponse` is that its contract is the vendor's, so your stub is an unverified belief about their behaviour, exactly as it was when the class was unmockable. The capability changed; the ownership argument in [01](01-what-to-mock-and-what-to-let-run.md) did not.
**★ Mocking final types silently disables two mock settings, and the failure looks unrelated.**
The javadoc lists them: `withSettings().serializable()` and `withSettings().extraInterfaces()` are *"incompatible"* with mocking final types and enums. A test that worked on a non-final class and then breaks after the class is marked `final` upstream, with a message about serialization, is this. So is a mock that is supposed to implement a marker interface and does not.
**★ You cannot mock package-visible methods of `java.*` or native methods, and no amount of configuration changes that.**
This is stated as a limitation of the inline mock maker, not a bug. It bites when someone tries to intercept something deep in the JDK — a `String` internal, a `Thread` native, a `System` intrinsic. If you find yourself there, the design question was skipped several steps earlier.
**★ `mockConstruction` intercepts *every* construction of that type in the scope, including ones inside library code.**
The interception is by type, not by call site. If anything else on the stack — a message converter, a logging appender, a library helper — constructs a `PdfRenderer` while your scope is open, it silently receives a mock with default answers. Most of the time nothing depends on it and nothing visible happens; occasionally a library gets a `null` where it expected an object and throws from somewhere that has nothing to do with your test. An injected factory intercepts exactly one call site.

**★ The mock supplied by `mockConstruction` is created *after* the real constructor's arguments are evaluated but the real constructor body never runs.**
Any side effect the constructor was performing — registering a listener, validating arguments, opening a handle, incrementing a counter — does not happen. If the class under test relies on constructor validation to reject bad input, the test with `mockConstruction` will accept input production would reject, and the test that "covers" that validation is green while the validation is bypassed.

**★ A `final` class that is also a value type is the one case where you should notice the mock is the problem, not the finality.**
Vendors mark response DTOs `final` all the time. Mockito 5 will happily mock them, so the obstacle that used to force you to construct a real one is gone — and constructing a real one was the right thing. If the type has no behaviour, build it (or its JSON) and let the real deserialization run; a mocked response object means your test never exercises the mapping code that is the entire job of the adapter.

## Interview questions

**★ How do you decide between injecting an instance and injecting a factory when the method currently does `new`?**
I inject the instance unless a fresh one per call is part of the behaviour. Most objects constructed inside a method are stateless or safely reusable, and injecting the instance produces the shortest production code and the shortest test. A factory is right when the object is stateful, holds a resource, or is configured from something only known at call time — a renderer that accumulates pages, a connection scoped to a request, a builder parameterised by the incoming query. The tell that I have chosen wrong is a factory whose stub says `willReturn(theSameThingEveryTime)` in every test: that is a singleton with an extra line of ceremony in every arrangement.

**★ Your colleague's test uses `mockConstruction` and asserts `constructed()).hasSize(1)`. What would you say in review?**
That the assertion has no behavioural meaning, and that it is the only assertion the technique offers, which is the problem. How many `PdfRenderer` objects got built is not something any user can observe; it changes the moment someone adds a cache or hoists the construction, both of which are improvements the test would block. I would ask what the test is actually trying to prove — presumably that the returned bytes come from rendering the query — and then move the construction into the constructor or a factory so the test can stub `render` and assert the bytes. If the class genuinely cannot be changed, I would keep `mockConstruction` but drop the `constructed()` assertion and assert on the output, so at least the test fails for a reason someone cares about.

**★ Mockito 5 can mock final classes by default. Does that change your view on mocking a vendor's types?**
No, because the argument was never that it was technically impossible. A mock is a second specification of the collaborator's behaviour, written by me and verified by nothing, and that stays true whether the class is final or not. When the type belongs to a vendor, my stub encodes a belief about their behaviour — which exception a 409 produces, whether a field can be null, how pagination terminates — and no part of my build tells me when the belief is wrong. What Mockito 5 changed is that I can no longer use "the class is final" as the reason to introduce an anti-corruption interface; I have to use the real reason, which is ownership.
**★ Mockito can mock a `final` response DTO from a vendor SDK. Why might you still construct a real one?**
Because the adapter's whole job is turning the vendor's representation into mine, and a mocked DTO removes exactly that work from the test. If I stub `response.shipment().trackingNumber()` to return `"T1"`, I have proved that my code copies a string out of an object graph I described — not that the vendor's JSON deserializes into that graph, not that the field is where I think it is, not that a null in an unexpected place is handled. Constructing the real DTO, or better, letting the SDK deserialize a captured real payload, exercises the mapping. Mockito 5 removed the technical excuse for the shortcut, which means the decision is now purely about what I want the test to be able to catch.

{/* FOOTER */}
