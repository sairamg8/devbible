---
title: "RETURNS_SMART_NULLS, RETURNS_MOCKS, CALLS_REAL_METHODS, RETURNS_SELF and RETURNS_DEEP_STUBS all exist to rescue legacy code, and reaching for one in a new test is almost always a way of making a null go away rather than making a behaviour testable"
sidebar_label: "03f · Default answers"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the `RETURNS_SMART_NULLS`, `RETURNS_MOCKS`, `CALLS_REAL_METHODS`, `RETURNS_SELF` and
> `RETURNS_DEEP_STUBS` field javadocs and sections 14 and 32 of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> plus
> [`ReturnsSmartNulls`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/stubbing/defaultanswers/ReturnsSmartNulls.java),
> [`ReturnsMoreEmptyValues`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/stubbing/defaultanswers/ReturnsMoreEmptyValues.java)
> and
> [`ReturnsDeepStubs`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/stubbing/defaultanswers/ReturnsDeepStubs.java).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[03e · Unstubbed defaults](03e-unstubbed-defaults.md) described the answer every mock gets
for free. This chunk is the other five you can ask for instead — and the thing they have in
common, stated by Mockito itself, is that they are for legacy code. Each of them makes some
`null` stop being a problem, and each of them makes the test prove less than it did. Knowing
what each one actually does is how you tell the two cases apart.**

## The family, and the framing

Section 14 frames the whole family:

> *"You can create a mock with specified strategy for its return values. It's quite an advanced
> feature and typically you don't need it to write decent tests. However, it can be helpful for
> working with **legacy systems**. … It is the default answer so it will be used **only when
> you don't** stub the method call."*

```java
Foo mock = mock(Foo.class, Mockito.RETURNS_SMART_NULLS);
Foo mockTwo = mock(Foo.class, new YourOwnAnswer());
```

### `RETURNS_SMART_NULLS`

> *"Un-stubbed methods often return null. If your code uses the object returned by an
> un-stubbed call, you get a NullPointerException. This implementation of Answer **returns
> SmartNull instead of null**. `SmartNull` gives nicer exception messages than NPEs, because it
> points out the line where the un-stubbed method was called. You just click on the stack
> trace."*
>
> *"`ReturnsSmartNulls` first tries to return ordinary values (zeros, empty collections, empty
> string, etc.) then it tries to return SmartNull. If the return type is final then plain
> `null` is returned."*

```java
Foo mock = mock(Foo.class, RETURNS_SMART_NULLS);

// calling un-stubbed method here:
Stuff stuff = mock.getStuff();

// using object returned by un-stubbed call:
stuff.doSomething();

// Above doesn't yield NullPointerException this time!
// Instead, SmartNullPointerException is thrown.
// Exception's cause links to un-stubbed mock.getStuff() - just click on the stack trace.
```

Two things the source adds to that description. The *"ordinary values"* layer is
`ReturnsMoreEmptyValues`, which is `ReturnsEmptyValues` **plus** `""` for `String` and an empty
array for array types — so `RETURNS_SMART_NULLS` genuinely does change what an unstubbed
`String` method returns. And the fallback object is a mock whose default answer throws
`SmartNullPointerException`, so it is a real object right up until you touch it.

⚠️ On a strict-stubs test this is largely redundant: `PotentialStubbingProblem` already tells
you a mock was called with unmatched arguments. `RETURNS_SMART_NULLS` earns its keep in legacy
tests without strictness. See [07 · Strictness](07-strictness.md).

### `RETURNS_MOCKS`

> *"ReturnsMocks first tries to return ordinary values (zeros, empty collections, empty string,
> etc.) then it tries to return mocks. If the return type cannot be mocked (e.g. is final) then
> plain `null` is returned."*
>
> *"**Note:** Since Java 15, abstract enums are declared sealed, which prevents mocking.
> Attempting to return a mock for such types will throw a
> `org.mockito.exceptions.base.MockitoException` instead of returning `null`. You can still
> return an existing enum literal from a stubbed method call."*

### `CALLS_REAL_METHODS`

The partial-mock answer, with Mockito's standard warning attached:

> *"Object oriented programming is more-or-less tackling complexity by dividing the complexity
> into separate, specific, SRPy objects. How does partial mock fit into this paradigm? Well, it
> just doesn't... Partial mock usually means that the complexity has been moved to a different
> method on the same object. In most cases, this is not the way you want to design your
> application."*

and, importantly for the mechanism in [03 · Stubbing](03-stubbing.md):

> *"**Note 1:** Stubbing partial mocks using `when(mock.getSomething()).thenReturn(fakeValue)`
> syntax will call the real method. For partial mock it's recommended to use `doReturn`
> syntax."*

Covered fully in [08d · Stubbing a spy](08d-stubbing-a-spy.md), and `doCallRealMethod` in
[03g · Stubbing voids](03g-stubbing-voids.md).

### `RETURNS_SELF`

For fluent builders:

> *"Allows Builder mocks to return itself whenever a method is invoked that returns a Type equal
> to the class or a superclass."*
>
> *"**Keep in mind this answer uses the return type of a method. If this type is assignable to
> the class of the mock, it will return the mock. Therefore if you have a method returning a
> superclass (for example `Object`) it will match and return the mock.**"*

That caveat is sharp: any method declared to return `Object` will hand back the mock instead of
`null`, because `Object` is assignable from the mock's class.

## 🔴 `RETURNS_DEEP_STUBS`, and why it is a design smell

```java
Foo mock = mock(Foo.class, RETURNS_DEEP_STUBS);

// note that we're stubbing a chain of methods here: getBar().getName()
when(mock.getBar().getName()).thenReturn("deep");

// note that we're chaining method calls: getBar().getName()
assertEquals("deep", mock.getBar().getName());
```

Mockito's own verdict, in bold in its own javadoc:

> ***WARNING:*** *This feature should rarely be required for regular clean code! Leave it for
> legacy code. Mocking a mock to return a mock, to return a mock, (...), to return something
> meaningful hints at violation of Law of Demeter or mocking a value object (a well known
> anti-pattern).*
>
> *Good quote I've seen one day on the web: **every time a mock returns a mock a fairy dies**.*

**What it actually does**, from the javadoc:

```java
// this:
Foo mock = mock(Foo.class, RETURNS_DEEP_STUBS);
when(mock.getBar().getName(), "deep");

// is equivalent of
Foo foo = mock(Foo.class);
Bar bar = mock(Bar.class);
when(foo.getBar()).thenReturn(bar);
when(bar.getName()).thenReturn("deep");
```

So the convenience is that it writes the intermediate mocks for you. The cost is that **the
test now knows the shape of a path through three objects.** `service.getConfig().getRetry().getMaxAttempts()`
in a test is a statement that the production code walks that exact chain — change
`getRetry()` to return a value object instead of a config node and the test breaks, though
nothing observable changed.

Two facts that matter if you must use it:

- **The returned mocks are stable.** *"this answer will return existing mocks that matches the
  stub. This behavior is ok with deep stubs and allows verification to work on the last mock of
  the chain."* So `mock.getBar(anyString()).getThingy()` gives the same object each time, and
  you can `verify` on it.
- **Verification only works on the last mock in the chain**, and you have to name it by
  re-walking the chain: *"note that we are actually referring to the very last mock in the
  stubbing chain."*

And two limits:

- *"This feature will not work when any return type of methods included in the chain cannot be
  mocked (for example: is a primitive or a final class). This is because of java type system."*
- Generic erasure is handled but not magically. `ReturnsDeepStubs` returns `null` rather than a
  mock when the erased raw type is `Object` — the source comment explains why: *"At this point,
  there is nothing to salvage for Mockito. Instead of trying to be smart and generate a mock
  that would potentially match the return signature, instead return `null`. This is valid per
  the CheckCast JVM instruction and is better than causing a ClassCastException on runtime."*

Section 32 does show the one case where it reads well — a typed subclass of a generic
collection:

```java
class Lines extends List<Line> {
    // ...
}

lines = mock(Lines.class, RETURNS_DEEP_STUBS);

// Now Mockito understand this is not an Object but a Line
Line line = lines.iterator().next();
```

and then immediately adds: *"Please note that in most scenarios a mock returning a mock is
wrong."*

**The alternative, when you find yourself reaching for it:** stub the boundary you actually
depend on, not the path to it. If the code needs `maxAttempts`, pass `maxAttempts` — or a small
value object — into the collaborator rather than making the test navigate a graph. If the graph
is real and unavoidable (a third-party client with a builder-shaped API), build the object for
real; it is usually cheaper than three nested mocks.


## Gotchas

**★ Reaching for `RETURNS_SMART_NULLS` on a strict-stubs test.**
Largely redundant — strictness already reports the unmatched invocation with a location. Smart
nulls are for legacy suites that cannot turn strictness on.

**★ `RETURNS_SELF` on a builder with an `Object`-returning method.**
Documented: the answer matches on assignability, so anything declared to return `Object`
returns the mock. That includes `clone()` on many builders, and any generic method erased to
`Object`.

**★ `RETURNS_DEEP_STUBS` to reach through a chain of getters.**
Mockito calls it a hint of a *"violation of Law of Demeter or mocking a value object (a well
known anti-pattern)"* and says to *"Leave it for legacy code"*. The test ends up asserting the
shape of a path through three objects rather than a behaviour.

**★ Deep stubs on a chain containing a primitive or a final class.**
*"This feature will not work when any return type of methods included in the chain cannot be
mocked … This is because of java type system."* The chain stops there.

**★ Deep stubs on an erased generic returning `Object`.**
`ReturnsDeepStubs` returns `null` in that case rather than guessing a type — the source says so,
and calls it *"better than causing a ClassCastException on runtime"*. So the deep stub silently
becomes a plain `null` and the next call NPEs.

**★ Changing the default answer to hide a `null`.**
`RETURNS_MOCKS` or `RETURNS_DEEP_STUBS` will make an NPE go away, and will make the test prove
much less. Section 14 is explicit that these are *"helpful for working with **legacy
systems**"*, not a general tool: *"typically you don't need it to write decent tests."*

**★ `RETURNS_MOCKS` on a type that cannot be mocked.**
The javadoc says a non-mockable return type yields plain `null` — except for abstract enums,
which since Java 15 are sealed and therefore throw a `MockitoException` instead. So the same
answer can give you `null` in one place and an exception in another.

**★ `CALLS_REAL_METHODS` stubbed with `when(...)`.**
Note 1 in the javadoc: *"Stubbing partial mocks using `when(mock.getSomething()).thenReturn(fakeValue)`
syntax will call the real method."* The real body runs during stubbing. Use `doReturn`.

**★ `CALLS_REAL_METHODS` on a class whose constructor never ran.**
`mock(...)` does not construct the object, so every field is `null` or zero when the real
method executes. `spy(new Thing(...))` is the recommended form precisely because you built it.

**★ A global default answer set in a Mockito configuration.**
`RETURNS_DEFAULTS` *"first tries the global configuration"*. A project-wide override changes
what every unstubbed call returns in every test, and nothing at the call site says so.

## Interview questions

**★ What does `RETURNS_SMART_NULLS` buy you over the default?**
Instead of `null`, an unstubbed reference-returning call gives back an object that throws
`SmartNullPointerException` when used, and the exception points at the line where the unstubbed
method was called. It also fills in `""` for `String` and empty arrays, because its first layer
is `ReturnsMoreEmptyValues` rather than `ReturnsEmptyValues`. It is aimed at legacy code; with
strict stubs on, you mostly get the same information from `PotentialStubbingProblem`.

**★ What is `RETURNS_DEEP_STUBS` and when would you use it?**
It makes each unstubbed call in a chain return another deep-stubbed mock, so
`when(mock.getBar().getName())` works. Mockito's own javadoc warns that it *"should rarely be
required for regular clean code"* and that a mock returning a mock *"hints at violation of Law
of Demeter or mocking a value object"*. The honest answer in an interview is: for legacy code
with a getter chain you cannot change, and never as a way of making a new test compile.

**★ You need `when(config.getRetry().getMaxAttempts()).thenReturn(3)`. What is the better
design?**
Pass the value the code needs instead of the path to it — inject `maxAttempts`, or a small
`RetryPolicy` value object built for real in the test. The deep stub encodes a three-object
navigation into the test, so a refactor that replaces `getRetry()` with a record breaks a test
that was never about that.

**★ What can deep stubs not do?**
Chain through a primitive or a final return type — *"This is because of java type system"* —
and they give up on an erased generic whose raw type is `Object`, returning `null` rather than
guessing, which the source justifies as *"better than causing a ClassCastException on
runtime"*.

{/* FOOTER */}

**★ What does `CALLS_REAL_METHODS` do, and what is Mockito's own opinion of it?**
Unstubbed methods delegate to the real implementation, making a partial mock. The javadoc
attaches its standard warning: partial mocking *"usually means that the complexity has been
moved to a different method on the same object"*, and *"In most cases, this is not the way you
want to design your application."* It allows the rare legacy case — third-party interfaces,
interim refactoring — and recommends `spy()` over it, because a spy is built from an object you
constructed yourself.

**★ Why can a `RETURNS_SELF` builder mock return the mock from a method you did not expect?**
Because it matches on assignability of the *return type*, not on the method: *"If this type is
assignable to the class of the mock, it will return the mock. Therefore if you have a method
returning a superclass (for example `Object`) it will match and return the mock."* Any
`Object`-returning method on the builder is caught by that rule.

{/* FOOTER */}
