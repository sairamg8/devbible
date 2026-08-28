---
title: "There are three base classes for an argument converter and almost every mistake in writing one is picking the wrong rung of the ladder — taking Object in and Object out when the framework was ready to do the type checking for you"
sidebar_label: "08m · Writing a converter"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Explicit Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> and the javadocs for `ArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/ArgumentConverter.html)),
> `SimpleArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/SimpleArgumentConverter.html))
> and `TypedArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/TypedArgumentConverter.html)),
> plus the 6.0.1 entry in the release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**[08l](08l-explicit-conversion.md) argued *why* you name a converter and settled how it must be
declared and instantiated. This chunk is the class you plug into the annotation. There are three
base types, they differ in exactly one dimension — how much the framework has already done for
you before your method is called — and choosing the wrong one is how converters end up with
casts, `Object` parameters and a type check somebody eventually deletes.**

## `ArgumentConverter` — the raw interface

```java
Object convert(Object source, ParameterContext context) throws ArgumentConversionException;

// @since 6.0, @API(status = EXPERIMENTAL):
default Object convert(Object source, FieldContext context) throws ArgumentConversionException;
```

The javadoc describes it as *"an abstraction that allows an input object to be converted to an
instance of a different class"*. The `ParameterContext` gives you the
`java.lang.reflect.Parameter`, its index, the target instance and the parameter's other
annotations — everything the two convenience base classes deliberately hide. Implement this
interface directly only when you need that context; the javadoc itself steers you to the other
two otherwise.

🔴 The `FieldContext` overload is `@since 6.0` and marked **`EXPERIMENTAL`**, while the
`ParameterContext` method is `STABLE`. That overload is what lets one converter serve both a
method parameter and a `@ParameterizedClass` field
([08e](08e-parameterized-class-field-injection.md)). If you implement the interface raw and
override only the `ParameterContext` method, the field path takes the inherited `default` — check
what that default does before relying on it, and remember that an `EXPERIMENTAL` method may change
shape in a minor release.

## `SimpleArgumentConverter` — you need the target type, not the context

> *"`SimpleArgumentConverter` is an abstract base class for `ArgumentConverter` implementations
> that only need to know the target type and do not need access to the `ParameterContext` to
> perform the conversion."*

The user guide's example, verbatim:

```java
public class ToStringArgumentConverter extends SimpleArgumentConverter {

	@Override
	protected Object convert(Object source, Class<?> targetType) {
		assertEquals(String.class, targetType, "Can only convert to String");
		if (source instanceof Enum<?> constant) {
			return constant.name();
		}
		return String.valueOf(source);
	}

}
```

```java
@ParameterizedTest
@EnumSource(ChronoUnit.class)
void testWithExplicitArgumentConversion(
		@ConvertWith(ToStringArgumentConverter.class) String argument) {

	assertNotNull(ChronoUnit.valueOf(argument));
}
```

Read the first line of the body twice. That `assertEquals(String.class, targetType, …)` is not
decoration. `SimpleArgumentConverter` hands you `Object` in and `Object` out, so the converter is
itself responsible for checking that the parameter it has been attached to is a type it can
actually produce. Delete that line and `@ConvertWith(ToStringArgumentConverter.class) int n`
compiles, runs, and blows up somewhere downstream of the parameter it was attached to — with a
message about `String` and `Integer` and nothing about the annotation that caused it.

Note also that this example converts *from an enum*, not from a `String`. Explicit conversion is
not restricted to string sources: `@EnumSource` supplies `ChronoUnit` constants and the converter
turns each into its name. Implicit conversion and the fallback are both string-to-object;
`@ConvertWith` is object-to-object.

`@since 5.0`, `@API(status = STABLE, since = "5.7")`. It is not deprecated, and its javadoc does
not say the typed class supersedes it.

## `TypedArgumentConverter` — the one you almost always want

> *"If the converter is only meant to convert one type to another, you can extend
> `TypedArgumentConverter` to avoid boilerplate type checks."*

```java
public class ToLengthArgumentConverter extends TypedArgumentConverter<String, Integer> {

	protected ToLengthArgumentConverter() {
		super(String.class, Integer.class);
	}

	@Override
	protected Integer convert(String source) {
		return (source != null ? source.length() : 0);
	}

}
```

The type parameters are documented as *"S — the type of the source argument to convert"* and
*"T — the type of the target object to create from the source"*, and the `protected` constructor
takes both as class literals, neither of which may be `null`. That pair is what replaces the
hand-written assertion in the `SimpleArgumentConverter` example: the base class performs the
checking the guide calls *"boilerplate type checks"*, and your own method signature becomes
`Integer convert(String)` with no cast anywhere in it.

Two details in that four-line example are load-bearing and easy to skim past. The constructor is
`protected`, not `public` — a converter's no-argument constructor does not have to be public
([08l](08l-explicit-conversion.md)). And `convert` handles `null` explicitly rather than
propagating it, which is the subject of [08n](08n-null-and-conversion-failure.md).

`@since 5.7`, `@API(status = STABLE, since = "5.10")`. In **6.0.1** the constructor got easier to
call for nullable targets:

> *"Allow calling the `TypedArgumentConverter` constructor for `@Nullable T` target types without
> having to cast class literals to `Class<@Nullable T>`."*

That is a JSpecify-era ergonomics fix rather than a behaviour change — but if you are on exactly
6.0.0 and a `@Nullable` target type will not compile without a cast, that entry is why.

## Choosing a rung

| You need… | Extend | Your method signature |
|---|---|---|
| one source type → one target type | `TypedArgumentConverter<S, T>` | `T convert(S source)` |
| to branch on the requested target type | `SimpleArgumentConverter` | `Object convert(Object, Class<?>)` |
| the `Parameter`, its index, or its other annotations | `ArgumentConverter` directly | `Object convert(Object, ParameterContext)` |
| to read a value off an annotation you also wrote | `AnnotationBasedArgumentConverter<A>` | `Object convert(Object, Class<?>, A)` |

Work down that table, not up. Every rung below the first costs you a cast, a check, or an
`EXPERIMENTAL` API, and the reason to pay is always a specific capability — not "the interface
was the first thing autocomplete offered".

The fourth rung, `AnnotationBasedArgumentConverter`, only makes sense alongside the composed
annotation that feeds it, so it lives in [08o](08o-annotation-driven-converters.md).

## Gotchas

**★ Extending `SimpleArgumentConverter` and not checking `targetType`.** The base class exists
precisely because it hands you the target type; ignore it and the converter will be attached
happily to a parameter it cannot produce, failing with a cast far from the annotation. The
guide's own example asserts on `targetType` in its first line, and that is not incidental.

**★ Using `SimpleArgumentConverter` where `TypedArgumentConverter` fits.** With exactly one source
type and one target type, the typed base class removes both the cast and the check. Choosing the
simple one means hand-writing what the framework would have done — and the hand-written version is
what gets deleted a year later by someone who reads it as a redundant assertion.

**★ Implementing the raw interface because it was the first result.** `ArgumentConverter` is an
interface, so it is the thing IDE completion offers first, and a lambda-shaped mind reaches for
it. If your body never touches `context`, you have taken on an `Object` signature and a cast for
nothing.

**★ Overriding only the `ParameterContext` method on the raw interface.** The `FieldContext`
overload is a `default` method added in 6.0. A converter reached from a `@ParameterizedClass`
field takes that path, not the one you wrote, so the field silently gets the inherited behaviour.

**★ Building on the `FieldContext` overload as if it were stable.** It is `EXPERIMENTAL` while the
`ParameterContext` method beside it is `STABLE`. If your converters must survive minor upgrades
untouched, extend `SimpleArgumentConverter` or `TypedArgumentConverter`, whose subclass hooks do
not mention either context type at all.

**★ Assuming explicit conversion only applies to strings.** The guide's own `SimpleArgumentConverter`
example is fed by `@EnumSource` and converts `ChronoUnit → String`. `@ConvertWith` sits between
*any* argument and its parameter; the string-only mechanisms are implicit conversion and the
fallback.

**★ Forgetting that `TypedArgumentConverter`'s constructor arguments are the contract.** The two
class literals are not documentation — they are what the base class checks against. Passing
`Object.class` as the source type to "make it flexible" reinstates exactly the untyped situation
the class exists to remove.

**★ Making the no-argument constructor `public` out of habit, then adding a second one.** The
guide's example is `protected` and takes no arguments. The rule is a no-argument constructor *or*
a single unambiguous one ([08l](08l-explicit-conversion.md)); a converter with two constructors
does not satisfy either branch.

**★ Assuming `convert` runs once per row.** It runs once per annotated argument per invocation,
and possibly on a different converter instance each time — the javadoc refuses to promise how
often implementations are instantiated. Anything expensive inside `convert` multiplies by rows
times annotated parameters.

## Interview questions

**★ Which base class would you extend, and why?**
`TypedArgumentConverter<S, T>` in almost every case: you declare source and target types in the
constructor, implement `T convert(S source)`, and the framework performs what the guide calls the
*"boilerplate type checks"*. `SimpleArgumentConverter` is for a converter that genuinely must
branch on the requested target type — and it then owes an explicit check of that type, as the
guide's own example shows. The raw `ArgumentConverter` interface is only for when you need the
`ParameterContext` itself: the `Parameter` object, its index, or its other annotations.

**★ Is `SimpleArgumentConverter` deprecated in favour of `TypedArgumentConverter`?**
No. Both are `STABLE` — `SimpleArgumentConverter` since 5.7, `TypedArgumentConverter` since 5.10
— and neither javadoc says the other supersedes it. They answer different questions: "what type am
I being asked to produce?" versus "here is exactly one source type and one target type".

**★ What does `TypedArgumentConverter`'s constructor actually do for you?**
It records the source and target `Class` literals, and the base class uses them to perform the
type checking a `SimpleArgumentConverter` implementation has to write by hand. That is why the
subclass hook is `T convert(S source)` — strongly typed, no cast, and no `targetType` argument to
inspect.

**★ Does `@ConvertWith` only convert from `String`?**
No. Implicit conversion and the fallback are both string-to-object, but an explicit converter sits
between any argument and its parameter. The user guide demonstrates exactly this: its
`ToStringArgumentConverter` example is driven by `@EnumSource(ChronoUnit.class)` and converts enum
constants to their names.

**★ What is the status of the `FieldContext` overload on `ArgumentConverter`?**
It was added in 6.0 as a `default` method and is annotated `EXPERIMENTAL`, while the
`ParameterContext` method on the same interface is `STABLE`. It exists so a converter can serve a
`@Parameter`-annotated field of a `@ParameterizedClass` as well as a method parameter. Writing
against it is fine; writing against it *and* expecting no source-compatible changes in a minor
release is not.

**★ Your converter needs the parameter's name to build its message. What do you extend?**
`ArgumentConverter` directly, because that is the only rung that receives the `ParameterContext`
— and therefore the `java.lang.reflect.Parameter` and its index. Neither convenience base class
exposes it, by design: they exist for converters whose behaviour depends on nothing but the value
and its target type.

{/* FOOTER */}
