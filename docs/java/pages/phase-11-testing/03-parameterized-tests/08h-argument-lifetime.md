---
title: "An argument that implements AutoCloseable is closed for you after its invocation, which is exactly right for an object built per row and exactly wrong for a constant shared across rows — so autoCloseArguments is the one attribute a @FieldSource almost always has to change"
sidebar_label: "08h · Argument lifetime"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "AutoCloseable arguments" and "Other
> Extensions"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> and the `@ParameterizedTest.autoCloseArguments`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedTest.html))
> and `@ParameterizedClass.autoCloseArguments`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedClass.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**An argument is not just a value handed to a method; it is an object with a lifetime that the
engine manages. JUnit closes the ones that are closeable, once their invocation finishes, by
default. That is invisible and correct as long as every argument object belongs to exactly one
invocation — and it is a silent corruption the moment one does not, which is precisely the case
for the sources that produce arguments from constants.**

## The default is close

> *"Arguments that implement `java.lang.AutoCloseable` (or `java.io.Closeable` which extends
> `java.lang.AutoCloseable`) will be automatically closed after the parameterized class or test
> invocation."*

So this needs no cleanup code at all:

```java
@ParameterizedTest
@MethodSource("openStreams")
void parses(InputStream in) throws Exception {
    assertThat(parser.parse(in)).isNotNull();
}

static Stream<Arguments> openStreams() {
    return Stream.of(
        arguments(new ByteArrayInputStream(FIRST)),
        arguments(new ByteArrayInputStream(SECOND))
    );
}
```

Each stream is constructed for one invocation and closed after it. The convenience is real, and
so is the assumption baked into it.

## When the default is wrong

> *"To prevent this from happening, set the `autoCloseArguments` attribute in
> `@ParameterizedTest` to `false`. Specifically, if an argument that implements
> `AutoCloseable` is reused for multiple invocations of the same parameterized class or test
> method, you must specify the `autoCloseArguments = false` on the `@ParameterizedClass` or
> `@ParameterizedTest` annotation to ensure that the argument is not closed between
> invocations."*

The javadoc repeats it in capitals, which is unusual enough to notice:

> *"WARNING: if an argument that implements `AutoCloseable` is reused for multiple invocations
> of the same parameterized class, you must set `autoCloseArguments` to `false` to ensure that
> the argument is not closed between invocations."*
>
> *"Defaults to `true`."*

**The reuse case is not exotic.** Three ordinary sources produce it:

```java
// 1. @FieldSource — one static field, one instance, for the life of the JVM.
static List<Arguments> cases = List.of(
    arguments(SHARED_CHANNEL, "first"),
    arguments(SHARED_CHANNEL, "second")     // same object twice
);

// 2. A @MethodSource returning a cached or singleton object.
static Stream<Arguments> cases() {
    return Stream.of("a", "b").map(s -> arguments(Connections.shared(), s));
}

// 3. A @ParameterizedClass, where one argument set feeds several @Test methods.
```

The first is the one to watch, because [04c · `@FieldSource`](04c-fieldsource.md) already warns
that a field holds one instance for the life of the JVM. Add closeability to that and invocation
one closes the object, invocation two gets a closed object, and the failure surfaces inside
whatever the object is — `IOException: closed`, or worse, a silent no-op — with nothing pointing
at the annotation that caused it.

⚠️ Note the third case carefully. A `@ParameterizedClass` invocation covers *several* test
methods, so "closed after the invocation" means after the last test method of that argument set,
not after each one. That is the behaviour you want; it is also a difference from
`@ParameterizedTest` worth holding in mind when converting one into the other
([08c](08c-parameterized-classes.md)).

```java
@ParameterizedTest(autoCloseArguments = false)
@FieldSource("cases")
void usesSharedChannel(Channel channel, String payload) { }
```

`autoCloseArguments` exists identically on both annotations, defaults to `true` on both, and is
one of the five optional elements they share.

## Mutating an argument instead of closing it

The guide's own `@ParameterizedClass` example ([08f](08f-parameterized-class-lifecycle.md))
mutates its argument object in the invocation hook — `textFile.path = Files.writeString(…)` —
rather than constructing a new one. That is legal and idiomatic *because each `TextFile` belongs
to one invocation*. It is the same assumption `autoCloseArguments` makes, stated in a different
form.

The rule underneath both: **an argument object may be written to exactly as often as it is
used.** A source that produces fresh objects per row can be mutated and closed freely. A source
that hands out shared objects can be neither, and neither the framework nor the compiler will
tell you which kind you have.

## What an extension can see

> *"Other extensions can access the parameters and resolved arguments of a parameterized test or
> class by retrieving a `ParameterInfo` object from the `Store`. Please refer to the Javadoc of
> `ParameterInfo` for details."*

That is the supported route for an extension — a `TestWatcher` that records which case failed, a
custom reporter, a listener that attaches the input to a bug report — to see the arguments of
the invocation it is observing. It exists, it is documented, and it is worth being slightly
suspicious of: an extension that reads argument values is coupled to the shape of every case
table it observes, and a display name ([07](07-display-names.md)) usually carries the same
information without the coupling.

## Gotchas

**★ Forgetting that an `AutoCloseable` argument is closed for you.** `autoCloseArguments`
defaults to `true` on both `@ParameterizedTest` and `@ParameterizedClass`. If you also close the
argument in the test body or a teardown, the second close happens on an already-closed object —
harmless for a well-behaved `close()`, and not for the ones that are not idempotent.

**★ A `@FieldSource` supplying a closeable constant.** One static field, one instance, and the
first invocation closes it. Every later invocation — and every later *test class* in the same
JVM — gets the closed object. `autoCloseArguments = false` is mandatory here.

**★ Reusing the same object across two rows of a `@MethodSource`.** Same failure, less visible,
because the factory looks like it is producing fresh values. `Connections.shared()` inside a
`map` is a shared object however many times it appears in the stream.

**★ Setting `autoCloseArguments = false` and then not closing anything.** You have taken over
the responsibility. A parameterized test with fifty rows each opening a file and never closing
it will exhaust descriptors, and the leak is in the test, not in the code under test.

**★ Assuming the attribute is per-argument.** It is per-annotation: all arguments of the method
or class, or none. A row mixing a shared connection with a per-row stream cannot have it both
ways — construct the per-row object inside the test body instead.

**★ Mutating an argument object that more than one invocation uses.** The guide's
initialise-in-the-hook pattern relies on one object per invocation. A shared object turns it
into a write that the next invocation reads.

**★ Expecting `close()` after each test method of a `@ParameterizedClass`.** The documentation
says arguments are closed after the *invocation* — and one invocation of a parameterized class
spans every `@Test` in it. A resource that must be fresh per test method belongs in
`@BeforeEach`, not in an argument.

**★ Relying on close ordering across several closeable arguments.** The documentation states
that closeable arguments are closed; it does not state in what order. **I could not confirm an
ordering guarantee** — if two arguments must be released in a particular order, close them
yourself with `autoCloseArguments = false`.

**★ Reaching into `ParameterInfo` from an extension for ordinary reporting.** It is the
supported API, but an extension that reads argument values is coupled to the shape of every case
table it observes. Prefer the display name, which already exists and already says which case
ran.

## Interview questions

**★ What is `autoCloseArguments` for?**
Arguments implementing `AutoCloseable` — which includes `Closeable` — are closed after their
invocation by default. That is right for an argument constructed per row and wrong for one that
is reused, so `autoCloseArguments = false` is required whenever the same instance serves more
than one invocation. The javadoc states that as a requirement, not a suggestion.

**★ Which argument sources are most likely to need it turned off?**
`@FieldSource` above all, because a static field holds one instance for the life of the JVM. Any
`@MethodSource` factory that returns a cached, pooled or singleton object has the same problem
while looking as if it does not. Sources that build a new object per row — the common
`@MethodSource` shape — are safe with the default.

**★ When exactly is an argument closed in a `@ParameterizedClass`?**
After the invocation of the class, which spans every `@Test` method in that argument set — not
after each test method. If a resource must be fresh for each test method, it is not an argument;
it belongs in `@BeforeEach`.

**★ Can you turn auto-closing off for one argument and leave it on for another?**
No. The attribute is declared on the annotation, so it applies to all arguments of that
parameterized class or method. When one column is shared and another is per-row, set the
attribute to `false` and manage both yourself, or construct the per-row resource inside the test
body where try-with-resources can handle it.

**★ How would an extension find out which argument set it is running under?**
By retrieving a `ParameterInfo` object from the extension `Store`, which the user guide names as
the route for accessing the parameters and resolved arguments of a parameterized test or class.
For reporting purposes the display name is usually a better answer, because it does not couple
the extension to the argument types.

**★ What is the single assumption behind both auto-closing and the guide's mutate-the-argument
pattern?**
That each argument object belongs to exactly one invocation. Given that, closing it afterwards
is safe and writing to it during setup is safe. Break it — with a static field, a cache or a
singleton — and both become cross-invocation corruption, with nothing in the type system or the
annotations to warn you.

{/* FOOTER */}
