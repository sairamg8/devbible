---
title: "No display-name pattern can rescue an argument whose toString() is a hash code, which is why named() names one argument, argumentSet() names a whole row, and useHeadersInDisplayName names the columns of a CSV table — three APIs that move the naming to where the data is"
sidebar_label: "07c · Naming arguments"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Customizing Display Names",
> "@CsvSource" and "@CsvFileSource"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `Arguments`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/Arguments.html)),
> `Named`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Named.html))
> and `ParameterizedInvocationConstants`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedInvocationConstants.html))
> pages, and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**`{0}` renders an argument by calling `toString()` on it. For a `String`, a `File` or an enum
that is fine. For the `Order` your `@MethodSource` built with a test data builder it is
`com.acme.Order@6d06d69c`, and no pattern you write in the annotation can fix that — the
problem is at the source, so the fix is at the source. Three APIs put it there, and choosing
between them is choosing what unit of the test case has a meaning worth naming.**

## `named()` — a name for one argument

```java
@DisplayName("A parameterized test with named arguments")
@ParameterizedTest(name = "{index}: {0}")
@MethodSource("namedArguments")
void testWithNamedArguments(File file) {
}

static Stream<Arguments> namedArguments() {
    return Stream.of(
        arguments(named("An important file", new File("path1"))),
        arguments(named("Another file", new File("path2")))
    );
}
```

The guide's documented tree for that method — quoted from the documentation, not from a run:

> ```
> A parameterized test with named arguments ✔
> ├─ 1: An important file ✔
> └─ 2: Another file ✔
> ```

> *"Note that `arguments(Object…)` is a static factory method defined in the
> `org.junit.jupiter.params.provider.Arguments` interface. Similarly, `named(String, Object)`
> is a static factory method defined in the `org.junit.jupiter.api.Named` interface."*

⚠️ Two different packages, and `named` is in `org.junit.jupiter.api` — **not** in `…params`.
`Named` is a general Jupiter concept (dynamic tests use it too), which is why it lives one
package up:

```java
import static org.junit.jupiter.api.Named.named;
import static org.junit.jupiter.params.provider.Arguments.arguments;
```

The payload reaches the test method unwrapped: the parameter is declared `File`, not
`Named<File>`. The javadoc is blunt about what the type is — *"`Named` is a container that
associates a name with a given payload"* — with `getName()` and `getPayload()`. The engine
reads the name for the report and hands the payload to the method.

Name selectively. In a three-argument row where two arguments are readable booleans and one is
an entity, wrap only the entity; the other two still render as themselves.

## `argumentSet()` — a name for the whole row

When it is the *combination* that has a meaning, name the set rather than the members:

```java
@DisplayName("A parameterized test with named argument sets")
@ParameterizedTest
@FieldSource("argumentSets")
void testWithArgumentSets(File file1, File file2) {
}

static List<Arguments> argumentSets = Arrays.asList(
    argumentSet("Important files", new File("path1"), new File("path2")),
    argumentSet("Other files", new File("path3"), new File("path4"))
);
```

The guide's documented tree:

> ```
> A parameterized test with named argument sets ✔
> ├─ [1] Important files ✔
> └─ [2] Other files ✔
> ```

**No `name` attribute was set.** The *default* pattern rendered the set names, because the
default is `[{index}] {argumentSetNameOrArgumentsWithNames}` and that placeholder is documented
as *"either `ARGUMENT_SET_NAME_PLACEHOLDER` or `ARGUMENTS_WITH_NAMES_PLACEHOLDER`, depending on
whether the current set of arguments was created via `argumentSet()`"*. Switching a
`@MethodSource` from `arguments(...)` to `argumentSet("...", ...)` therefore improves the
report without touching the annotation at all — which makes it the cheapest readability fix
available on an existing suite.

> *"Favor this method over `Arguments.of(...)` and `arguments(...)` when you wish to assign a
> name to the entire set of arguments."*
>
> *"name — the name of the argument set; must not be null or blank"*
>
> *"This method is well suited to be used as a static import — for example, via:
> `import static org.junit.jupiter.params.provider.Arguments.argumentSet;`"*

`argumentSet` is `@API(status = MAINTAINED, since = "5.13.3")`, returns an
`Arguments.ArgumentSet`, and lives on `Arguments` — the same interface as `of` and `arguments`,
so one import site, unlike `named`.

## Which of the two

`named()` when **one column** is unreadable and the rest are fine — a `Clock`, a `Path`, a
builder-built entity sitting next to two self-explanatory flags. The other columns keep
rendering, and `{argumentsWithNames}` still shows the parameter names.

`argumentSet()` when **the row is a scenario**:

```java
static Stream<Arguments> cancellationCases() {
    return Stream.of(
        argumentSet("expired card, retry enabled",  expiredCard(), true,  RETRY),
        argumentSet("expired card, retry disabled", expiredCard(), false, FAIL),
        argumentSet("stolen card",                  stolenCard(),  true,  BLOCK)
    );
}
```

Nothing in that table reads well argument by argument, and every row has an obvious English
name. Naming the set discards the per-argument rendering entirely, which is precisely what you
want when the individual values mean nothing on their own.

⚠️ Both APIs are only available where **you** build the `Arguments` — `@MethodSource`,
`@FieldSource` and `@ArgumentsSource`. A `@CsvSource` row is cells; there is nowhere to attach
a name. That is what CSV headers are for.

## CSV headers as column names

```java
@ParameterizedTest
@CsvSource(useHeadersInDisplayName = true, textBlock = """
    FRUIT,         RANK
    apple,         1
    banana,        2
    'lemon, lime', 0xF1
    strawberry,    700_000
    """)
void testWithCsvSource(String fruit, int rank) {
}
```

> *"The first record may optionally be used to supply CSV headers by setting the
> `useHeadersInDisplayName` attribute to `true`"*
>
> *"The generated display names for the previous example include the CSV header names."*
>
> ```
> [1] FRUIT = "apple", RANK = "1"
> [2] FRUIT = "banana", RANK = "2"
> [3] FRUIT = "lemon, lime", RANK = "0xF1"
> [4] FRUIT = "strawberry", RANK = "700_000"
> ```

This is the CSV equivalent of `named()`: it replaces the *parameter* name with the *column*
name in the report. It is worth it when the header says something the parameter name cannot —
`EXPECTED_HTTP_STATUS` against a parameter called `expected` — and it is a lateral move when
the two say the same thing.

For `@CsvFileSource` the header is a property of the file, and you choose what to do with it:

> *"The first record may optionally be used to supply CSV headers. You can instruct JUnit to
> ignore the headers via the `numLinesToSkip` attribute. If you would like for the headers to
> be used in the display names, you can set the `useHeadersInDisplayName` attribute to
> `true`."*

Those are two different attributes solving two halves of the same problem — see
[03c · `@CsvFileSource`](03c-csvfilesource.md).

🔴 6.0 fixed a real defect here, and it decides which side of the upgrade you are on:

> *"CSV headers are now properly supported with the default display name pattern and the
> explicit `{argumentsWithNames}` display name pattern for parameterized tests that utilize
> the `useHeadersInDisplayName` flag in `@CsvSource` and `@CsvFileSource`. Specifically, the
> parameter name is no longer duplicated in the display name when a CSV header is desired
> instead."*

If a 5.x project turned `useHeadersInDisplayName` off because the names came out doubled, turn
it back on after the upgrade.

## Gotchas

**★ Importing `named` from `org.junit.jupiter.params.provider`.** It is in
`org.junit.jupiter.api.Named`, while `arguments` and `argumentSet` are on
`org.junit.jupiter.params.provider.Arguments`. Two static imports, two packages, and the
mistake looks like "the method does not exist".

**★ Declaring the parameter as `Named<File>`.** The engine unwraps the container; the method
parameter takes the payload type. Declaring the wrapper gives you a parameter whose type the
argument does not match.

**★ Passing a blank or computed name to `argumentSet`.** The javadoc says it *"must not be null
or blank"*. A name derived from data — `argumentSet(order.reference(), order)` — will
eventually be blank for some row and turn a data problem into a configuration failure at
discovery time.

**★ Reaching for `named()` on a `@CsvSource`.** There is nowhere to put it. Use
`useHeadersInDisplayName` for column names, or move the cases to `@MethodSource` if the row
needs a title.

**★ Two argument sets with the same name.** They produce two report nodes differing only by
index — exactly the ambiguity `argumentSet` was meant to remove. The names are documentation;
make them distinct, and prefer names that describe the *case* rather than the data.

**★ Naming argument sets and then wondering where the values went.** Once a set has a name, the
default pattern shows the name *instead of* the arguments, because
`{argumentSetNameOrArgumentsWithNames}` is an either/or. If you want both, set the pattern
explicitly: `name = "[{index}] {argumentSetName}: {argumentsWithNames}"`.

**★ Using `{argumentSetName}` on a source that does not build argument sets.** The placeholder
has nothing to resolve. The documentation does not state what it renders in that case and I
could not confirm it — use `{argumentSetNameOrArgumentsWithNames}`, which is designed for
exactly that uncertainty and is what the default pattern uses.

**★ Naming the arguments instead of fixing `toString()`.** If a domain object is unreadable in
every test report, in every log line and in every debugger, a `toString()` on the object is one
change that fixes all three. `named()` is right for a value that is meaningful only in this
test's terms — "a card that expired yesterday" — not as a substitute for a type that should be
printable.

**★ Turning on `useHeadersInDisplayName` while also skipping the header line.** For
`@CsvFileSource` these are opposite intents on the same first record. Pick one; the guide
presents `numLinesToSkip` and `useHeadersInDisplayName` as the two alternatives for what to do
with the header.

**★ Assuming header-based names avoid the `-parameters` problem.** They do — headers come from
the data, not the bytecode — but only for CSV sources. Every other source still needs
`-parameters` for `{argumentsWithNames}` to say anything ([07](07-display-names.md)).

## Interview questions

**★ How do you make a report readable when the argument is a domain object?**
Wrap it with `Named.named("a description", object)` inside `arguments(...)`, or name the whole
row with `Arguments.argumentSet("scenario name", a, b, c)`. The first keeps the other arguments
rendering normally; the second replaces the whole rendering with one name. Neither changes the
method signature — the payload is unwrapped before the invocation.

**★ When does `{argumentSetName}` actually produce anything?**
Only when the arguments for that invocation were built with `Arguments.argumentSet(...)`, which
means only for `@MethodSource`, `@FieldSource` and `@ArgumentsSource`. The default pattern uses
`{argumentSetNameOrArgumentsWithNames}` precisely so that a source which does not use argument
sets still renders something useful.

**★ You switched a `@MethodSource` from `arguments(...)` to `argumentSet(...)` and never
touched the annotation. Why did the report change?**
Because the default display name pattern is
`[{index}] {argumentSetNameOrArgumentsWithNames}`, and that placeholder resolves to the set
name when the arguments came from `argumentSet()` and to the named argument list otherwise.
The behaviour is built into the default, which is what makes it the cheapest readability
improvement available.

**★ `named()` or `argumentSet()`?**
`named()` when one argument out of several is unreadable — you keep the rest rendering and you
keep the parameter names. `argumentSet()` when the row taken as a whole is a scenario with an
English name and the individual values mean nothing in isolation. Mixing them is legal but
pointless: once the set has a name, the default pattern will not show the individual arguments
anyway.

**★ How do you name columns in a `@CsvSource` table?**
Put a header record first and set `useHeadersInDisplayName = true`; the display names then use
the header names instead of the parameter names. For `@CsvFileSource` the same attribute
displays the file's header, while `numLinesToSkip` is the alternative that discards it.

**★ Why is `Named` in `org.junit.jupiter.api` rather than in the params module?**
Because it is not a parameterized-test concept. It is a general container associating a name
with a payload, used by dynamic tests as well. `Arguments`, `arguments` and `argumentSet` are
params-specific, so they live in `org.junit.jupiter.params.provider`.

**★ What did JUnit 6 fix about CSV headers in display names?**
Before 6.0, using `useHeadersInDisplayName` with the default pattern or with
`{argumentsWithNames}` duplicated the parameter name alongside the header. 6.0 made the header
replace the parameter name, as intended — so a project that disabled the flag to avoid the
doubling should re-enable it after upgrading.

{/* FOOTER */}
