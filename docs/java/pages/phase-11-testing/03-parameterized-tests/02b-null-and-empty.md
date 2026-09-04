---
title: "@NullSource and @EmptySource exist because Java annotations cannot hold a null and because 'empty' means eleven different things — the two cases where your validation code actually breaks"
sidebar_label: "02b · Null and empty sources"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Null and Empty Sources"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html))
> and the `@NullSource`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/NullSource.html))
> and `@EmptySource`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/EmptySource.html))
> pages. JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**Three annotations, no attributes, and they cover the two inputs that break more production
code than every other input combined. They exist as separate annotations for a concrete
language reason: `@ValueSource` cannot express `null`, because a Java annotation element value
cannot be `null`. `@EmptySource` exists for a subtler reason — "empty" is not one value, it is
eleven, and the engine has to know your parameter's type to produce the right one.**

## The three

> *"`@NullSource`: provides a single `null` argument to the annotated `@ParameterizedClass`
> or `@ParameterizedTest`."*
>
> *"`@EmptySource`: provides a single empty argument to the annotated `@ParameterizedClass`
> or `@ParameterizedTest` for parameters of the following types: `java.lang.String`,
> `java.util.Collection` (and concrete subtypes with a public no-arg constructor),
> `java.util.List`, `java.util.Set`, `java.util.SortedSet`, `java.util.NavigableSet`,
> `java.util.Map` (and concrete subtypes with a public no-arg constructor),
> `java.util.SortedMap`, `java.util.NavigableMap`, primitive arrays (e.g., `int[]`,
> `char[][]`, etc.), object arrays (e.g., `String[]`, `Integer[][]`, etc.)."*
>
> *"`@NullAndEmptySource`: a composed annotation that combines the functionality of
> `@NullSource` and `@EmptySource`."*

Each is meta-annotated `@ArgumentsSource(...)` like every other source, so any one of them on
its own satisfies the "at least one source" requirement. A method annotated only
`@ParameterizedTest` and `@NullSource` is a legal, one-invocation test.

## The idiom

```java
@ParameterizedTest
@NullAndEmptySource
@ValueSource(strings = { " ", "   ", "\t", "\n" })
void blankNamesAreRejected(String name) {
    assertThatThrownBy(() -> new Customer(name))
        .isInstanceOf(IllegalArgumentException.class);
}
```

Six invocations: `null`, `""`, and four flavours of whitespace. The guide spells the count
out for its own version of this method — *"1 for `null`, 1 for the empty string, and 4 for
the explicit blank strings supplied via `@ValueSource`"* — and it is worth internalising that
these three annotations **concatenate**. They do not interact, they do not pair up, and their
order in the source file is the order of the invocations.

The guide also states the division of labour between them and `@ValueSource` explicitly:

> *"If you need to supply multiple varying types of blank strings to a parameterized class or
> test, you can achieve that using `@ValueSource` — for example,
> `@ValueSource(strings = {" ", "   ", "\t", "\n"})`."*

There is no `@BlankSource`. Blankness is culture-specific and open-ended; JUnit supplies the
two values it can define exactly and leaves the rest to you.

## `null` and primitives

> *"Note that `@NullSource` cannot be used for an argument that has a primitive type, unless
> the argument is converted to a corresponding wrapper type with an `ArgumentConverter`."*

`void rejectsBadQuantity(int quantity)` with `@NullSource` cannot work: there is nothing to
pass. Change the parameter to `Integer`, or supply a converter — [08](08-conversion-and-aggregation.md).
This is the same rule that governs an unquoted empty CSV column landing on an `int`
parameter, which throws an `ArgumentConversionException`; see
[03 · `@CsvSource`](03-csvsource.md).

## What `@EmptySource` gives each type

The engine picks the empty value from the *declared parameter type*, not from anything in the
annotation:

| Parameter type | Argument supplied |
|---|---|
| `String` | `""` |
| `List`, `Set`, `SortedSet`, `NavigableSet`, `Collection` | an empty instance of that type |
| a concrete `Collection` subtype with a public no-arg constructor | an empty instance of *that* class |
| `Map`, `SortedMap`, `NavigableMap` | an empty instance of that type |
| a concrete `Map` subtype with a public no-arg constructor | an empty instance of *that* class |
| a primitive array — `int[]`, `char[][]` | a zero-length array |
| an object array — `String[]`, `Integer[][]` | a zero-length array |

That is the whole list. `Optional` is not on it. `Stream` is not on it. A record with no
components is not on it. ⚠️ **The documentation lists the supported types but does not state
what happens for an unsupported one — I could not confirm the exact exception type from the
user guide or the javadoc.** What is documented is that no empty argument is provided, so do
not build a test on the assumption that it silently produces `null`.

The "public no-arg constructor" clause is the trap in that table. A parameter declared as
`ArrayList<String>` is supported because `ArrayList` has one. A parameter declared as some
project-specific `ImmutableList` with only static factories is not.

## Why this matters more than it looks

Almost every defect in input handling lives in one of three states — absent, present but
empty, present but blank — and almost every hand-written test uses a plausible non-empty
value. The value of these annotations is not brevity, it is that they make the missing cases
*visible in the annotation block*, where a reviewer can see they are absent.

In a Spring service the three cases also fail in three different layers: `null` typically
trips Bean Validation or a `NullPointerException` in your own guard, `""` usually passes
`@NotNull` and fails `@NotBlank`, and `"   "` passes both unless someone remembered to trim.
A test that only covers `null` proves nothing about the other two.

## Display names in JUnit 6

⚠️ 6.0's quoting change is most visible here. The guide shows what the canonical
null/empty/blank method now produces:

> ```
> [1] text = null
> [2] text = ""
> [3] text = " "
> [4] text = "   "
> [5] text = "\t"
> [6] text = "\n"
> ```

Under 5.x, invocations 2, 5 and 6 were visually indistinguishable in most reports. This is the
single most useful thing 6.0 changed for parameterized tests, and it is why a report from an
old CI job looks different from a local run after the upgrade.

## Gotchas

**★ `@NullSource` on a primitive parameter.** There is no `null` `int`. Widen the parameter to
`Integer` or convert with an `ArgumentConverter`. Nothing about the annotation hints at the
restriction; the javadoc is the only place it is stated.

**★ `@NullAndEmptySource` on a primitive parameter.** Same failure, half-hidden: the empty half
was never going to apply to a primitive either, so the annotation looks like it does nothing
useful rather than like an error.

**★ `@EmptySource` on `Optional`, `Stream`, or your own collection type.** Not in the
supported list. A concrete collection or map subtype only qualifies if it has a public no-arg
constructor.

**★ Assuming `@EmptySource` means `""` regardless of parameter type.** It resolves against the
declared type. Change the parameter from `String` to `List<String>` during a refactor and the
supplied value changes with it — usually what you wanted, occasionally a test that now proves
something else.

**★ Testing `null` and calling the blank cases covered.** `""` and `"   "` reach different
branches in almost every validator. `@NullSource` alone is one third of the job.

**★ Adding these to a method that takes two parameters.** All three are single-argument
sources. On a two-parameter method the second parameter has no argument, and you get an
argument-count failure rather than a `null` in the first position.

**★ Expecting the empty value to be mutable or shared.** The guide does not promise either
way, and mutating an argument inside a test is a bad habit regardless. Treat every supplied
argument as read-only.

**★ Reaching for `@ValueSource(strings = "")` instead of `@EmptySource`.** It works for
`String` and only for `String`, and it reads as "a case someone happened to add" rather than
"the empty case, deliberately". Use the annotation that names the intent.

## Interview questions

**★ Why does `@NullSource` need to exist at all — why not `@ValueSource(strings = null)`?**
Because the Java Language Specification does not allow an annotation element value to be
`null`; `strings = { null }` will not compile. The only way to get a `null` argument out of an
annotation-based source is an annotation that supplies one unconditionally, which is exactly
what `@NullSource` is.

**★ What types does `@EmptySource` support?**
`String`; `Collection`, `List`, `Set`, `SortedSet`, `NavigableSet`; `Map`, `SortedMap`,
`NavigableMap`; concrete `Collection` and `Map` subtypes that have a public no-arg
constructor; and primitive and object arrays of any dimension. Nothing else — notably not
`Optional`.

**★ Can you use `@NullSource` on an `int` parameter?**
Not directly. The javadoc says it cannot be used for a primitive-typed argument unless an
`ArgumentConverter` converts it to the wrapper type. In practice you change the parameter to
`Integer`.

**★ How would you cover null, empty and blank in one test?**
`@NullAndEmptySource` for the first two, plus `@ValueSource(strings = { " ", "   ", "\t",
"\n" })` for the blank variants. Six invocations, three annotations, and the reviewer can see
all three categories in the annotation block.

**★ Do stacked source annotations multiply?**
No — they concatenate, in declaration order. `@NullSource` plus a four-element `@ValueSource`
is five invocations, not four `null`-paired ones. There is no cartesian-product source in
`junit-jupiter-params`; if you need one you build it in a `@MethodSource` factory.

**★ Why are `null` and `""` worth separate cases when both "look empty"?**
Because they take different paths. `null` reaches your null guard or Bean Validation's
`@NotNull`; `""` passes `@NotNull` and is caught only by `@NotBlank` or an explicit length
check; `"   "` passes both unless something trims. Three inputs, three branches, and code that
handles one of them handles neither of the others by accident.

{/* FOOTER */}
