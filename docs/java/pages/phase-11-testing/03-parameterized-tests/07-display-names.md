---
title: "The only thing a parameterized failure gives you that a copy-pasted test does not is a name identifying which case broke — so the name attribute, the MessageFormat rules it obeys, and the compiler flag that makes parameter names exist at all are not cosmetics, they are the deliverable"
sidebar_label: "07 · Display names"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Customizing Display Names"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@ParameterizedTest`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedTest.html))
> and `ParameterizedInvocationConstants`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedInvocationConstants.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**Ten copy-pasted `@Test` methods each have a name that says what they check. One
`@ParameterizedTest` with ten rows has one method name and ten invocations, and the only thing
standing between "IbanValidatorTest.rejects — FAILED" and "which of the ten IBANs?" is the
invocation display name. Every argument for parameterizing a test assumes the report stays
readable; this chunk is where that assumption is either paid for or quietly defaulted away.**

## What you get if you set nothing

> *"By default, the display name of a parameterized class or test invocation contains the
> invocation index and a comma-separated list of the String representations of all arguments
> for that specific invocation. If parameter names are present in the bytecode, each argument
> will be preceded by its parameter name and an equals sign (unless the argument is only
> available via an `ArgumentsAccessor` or `ArgumentAggregator`) – for example,
> `firstName = "Jane"`."*

The `name` attribute is not empty by default — it holds a *flag*, and the javadoc spells out
what the flag resolves to:

> *"Defaults to `"{default_display_name}"`. If the default display name flag
> (`"{default_display_name}"`) is not overridden, JUnit will: Look up the
> `"junit.jupiter.params.displayname.default"` configuration parameter and use it if
> available. […] Otherwise, `"[{index}] {argumentSetNameOrArgumentsWithNames}"` will be
> used."*
>
> *"Note that `"{default_display_name}"` is a flag rather than a placeholder."*

That distinction matters: you cannot embed the flag in a larger pattern. Writing
`name = "case {default_display_name}"` is not documented to work, because a flag is checked
for equality with the whole attribute value, not substituted into it. Build the pattern out of
real placeholders instead. The two-step fallback behind it — configuration parameter, then
constant — is [07d](07d-project-wide-display-names.md).

The resolved default is documented as a constant, and the constant carries a warning worth
reading twice:

> *"Default display name pattern for the current invocation of a `@ParameterizedTest` method:
> `"[{index}] {argumentSetNameOrArgumentsWithNames}"`"*
>
> *"Note that the default pattern does not include the display name of the
> `@ParameterizedTest` method."*

So the invocation node in the tree is `[3] iban = "DE89"`, and the *method* name is on the
parent node. A CI report that flattens the tree and prints only leaf display names loses the
method entirely — which is the usual reason a build server's failure list is a wall of
`[7] ...` with nothing saying what was under test. Fix that with `{displayName}` in the
pattern, not by giving up on parameterization.

## `-parameters`, or your report says `arg0`

This is the highest-value line in the chunk and the one most projects have never set:

> *"To ensure that parameter names are present in the bytecode, test code must be compiled
> with the `-parameters` compiler flag for Java or with the `-java-parameters` compiler flag
> for Kotlin."*

The `{argumentsWithNames}` placeholder — which the default pattern reaches through
`{argumentSetNameOrArgumentsWithNames}` — is explicit about where the names come from:

> *"Argument names will be retrieved via the `Parameter.getName()` API if the byte code
> contains parameter names — for example, if the code was compiled with the `-parameters`
> command line argument for `javac`."*

Without the flag, the JVM's reflective parameter names are synthetic (`arg0`, `arg1`), so a
four-column CSV table reports as `arg0 = …, arg1 = …` and the table's whole readability
argument evaporates at exactly the moment it matters. Turn it on project-wide:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <parameters>true</parameters>
  </configuration>
</plugin>
```

```groovy
tasks.withType(JavaCompile).configureEach {
    options.compilerArgs << '-parameters'
}
```

⚠️ Spring Boot's parent POM has set `<parameters>true</parameters>` for a long time, so a
Boot-parented project usually already has it — and a project that moved off the parent POM to
a plain `spring-boot-dependencies` import usually silently lost it. If your test names show
`arg0`, that is the first place to look.

## Writing your own pattern

```java
@DisplayName("Display name of container")
@ParameterizedTest(name = "{index} ==> the rank of {0} is {1}")
@CsvSource({ "apple, 1", "banana, 2", "'lemon, lime', 3" })
void testWithCustomDisplayNames(String fruit, int rank) {
}
```

The user guide prints the tree this produces under the `ConsoleLauncher` — quoted here from
the documentation, not from a run:

> ```
> Display name of container ✔
> ├─ 1 ==> the rank of "apple" is "1" ✔
> ├─ 2 ==> the rank of "banana" is "2" ✔
> └─ 3 ==> the rank of "lemon, lime" is "3" ✔
> ```

Two things to read out of that listing. The container node carries the `@DisplayName` and the
children carry the `name` pattern — separate annotations doing separate jobs, and a test class
usually wants both. And `rank`, declared `int`, appears as `"1"` in quotes, because quoting is
applied to the *source* argument before conversion — [07b](07b-quoted-arguments.md)
is entirely about that.

## The placeholders

| Placeholder | Description |
|---|---|
| `{displayName}` | *"the display name of the method"* |
| `{index}` | *"the current invocation index (1-based)"* |
| `{arguments}` | *"the complete, comma-separated arguments list"* |
| `{argumentsWithNames}` | *"the complete, comma-separated arguments list with parameter names"* |
| `{argumentSetName}` | *"the name of the argument set"* |
| `{argumentSetNameOrArgumentsWithNames}` | *"`{argumentSetName}` or `{argumentsWithNames}`, depending on how the arguments are supplied"* |
| `{0}`, `{1}`, … | *"an individual argument"* |

The javadoc adds the detail the guide's table omits, and it is the one people get wrong:

> *"`"{0}"`, `"{1}"`, etc.: an individual argument (0-based)"*

**`{index}` is 1-based and `{0}` is 0-based, in the same pattern.** `"{index}: {0}"` on the
first invocation reads `1: apple`. That is not a bug; they are two different numbering systems
that happen to sit next to each other.

Three patterns worth having as reflexes:

```java
// The method name back on every leaf — makes a flattened CI report readable.
@ParameterizedTest(name = "{displayName} [{index}] {argumentsWithNames}")

// A sentence, when the arguments alone do not say what the case means.
@ParameterizedTest(name = "{0} is rejected because it is {1}")

// The index alone, when arguments are large objects with unhelpful toString().
@ParameterizedTest(name = "[{index}]")
```

The third is the honest choice for a `@MethodSource` producing domain objects with no
`toString()` — but it is strictly worse than fixing the naming, which is what `named()` and
`argumentSet()` exist for ([07c](07c-naming-arguments.md)).

## It is a `MessageFormat` pattern, with everything that implies

> *"Please note that `name` is a `MessageFormat` pattern. Thus, a single quote (`'`) needs to
> be represented as a doubled single quote (`''`) in order to be displayed."*

So `name = "{0} isn't valid"` does not print an apostrophe — `MessageFormat` treats `'` as the
start of a quoted (literal) section, and everything after it up to the next `'` is emitted
verbatim rather than substituted. The correct form is `name = "{0} isn''t valid"`. This is the
single most common way a display-name pattern misbehaves, and because it *silently* changes
what the rest of the pattern means rather than throwing, the symptom people report is "my
placeholders stopped substituting", not "my apostrophe vanished".

The same mechanism gives you formatting for free:

> *"For the latter, you may use `MessageFormat` patterns to customize formatting (for example,
> `{0,number,#.###}`). Please note that the original arguments are passed when formatting,
> regardless of any implicit or explicit argument conversions."*

```java
@ParameterizedTest(name = "{index}: {0,number,#.###} EUR rounds to {1,number,#.##}")
@ValueSource(doubles = { 1.23456, 2.99999 })
void rounds(double input) { }
```

⚠️ Read that second documented sentence again, because it collides with the formatting: **the
original argument is what gets formatted.** If the same test were driven by
`@CsvSource({ "1.23456, 1.23" })`, the values handed to `MessageFormat` would be the *strings*
`"1.23456"` and `"1.23"`, not the `BigDecimal` or `double` the method receives. A `number`
format applied to a `String` is not a combination the documentation covers, and I could not
confirm what it produces — so treat numeric `MessageFormat` formats as reliable only when the
source supplies a real number (`@ValueSource(doubles = …)`, `@MethodSource`), not when it
supplies a CSV cell.

## Gotchas

**★ Not compiling with `-parameters`, and blaming JUnit for `arg0`.** Parameter names are not
in the class file unless the compiler was told to put them there. The default display name
pattern reaches for them and falls back to synthetic names. One line of build config fixes
every parameterized test in the project at once.

**★ An apostrophe in the `name` pattern.** `name` is a `MessageFormat` pattern, so `'` opens a
literal section and swallows the placeholders after it. Double it: `''`. The symptom is
placeholders that stop substituting, not a missing apostrophe, so the cause is rarely the
first suspect.

**★ Assuming `{index}` and `{0}` use the same base.** `{index}` is documented as 1-based;
`{0}` is the 0-based argument index. In one pattern they will disagree by one, forever, by
design.

**★ Expecting the default display name to include the method name.** The javadoc says
explicitly that it does not. In a tree view the parent node supplies it; in a flattened report
it is simply gone. Add `{displayName}` if anything downstream flattens.

**★ Trying to compose `{default_display_name}` into a larger pattern.** It is documented as a
flag, not a placeholder — it is recognised as the whole attribute value. Compose from
`{index}` and `{argumentsWithNames}` instead.

**★ Applying a `MessageFormat` number or date format to a CSV cell.** The documentation states
that the *original* arguments are passed to the formatter, before any implicit or explicit
conversion. A CSV cell is a `String` at that point, whatever the parameter is declared as.

**★ Using `{0}` when the parameter is an aggregated object.** The guide notes that an argument
*"only available via an `ArgumentsAccessor` or `ArgumentAggregator`"* is not preceded by a
parameter name in the default rendering. Aggregated parameters are not indexed parameters
([08b](08b-aggregation.md)), so the positional placeholders address the raw source arguments
underneath, not the aggregated object.

**★ Writing a pattern that repeats what the arguments already say.** `name = "test with {0}"`
adds four words and no information. The pattern earns its keep when it explains the *meaning*
of a column — `"{0} is rejected: {1}"` — or when the raw arguments are unreadable.

**★ Putting a comma inside a literal part of the pattern and then reading the report as CSV.**
Display names are prose. Anything that parses them positionally is coupled to a presentation
format the JUnit team changes between majors, and did change in 6.0
([07b](07b-quoted-arguments.md)).

**★ A `name` that is blank or whitespace-only.** Both javadocs say the display name is *"never
blank or consisting solely of whitespace"* — it is a constraint on what you may supply, not a
promise the framework will fix it for you.

## Interview questions

**★ What does a parameterized test invocation get called if you set nothing?**
`[{index}] {argumentSetNameOrArgumentsWithNames}` — a 1-based index in brackets, then either
the argument-set name if the arguments came from `argumentSet(…)`, or the comma-separated
argument list with parameter names. The method's own display name is deliberately not part of
it; it lives on the parent node in the test tree.

**★ Why do some projects' reports show `arg0 = …` instead of the parameter name?**
Because the test code was not compiled with `-parameters` (or `-java-parameters` for Kotlin),
so the parameter names are not in the bytecode and reflection returns synthetic names. JUnit
retrieves them via `Parameter.getName()`; it cannot invent what the compiler discarded.

**★ Why did adding an apostrophe to a `name` pattern break the placeholders?**
Because `name` is a `java.text.MessageFormat` pattern, in which a single quote begins a
literal section. Everything from the apostrophe onwards is emitted verbatim instead of being
substituted. Doubling it — `''` — escapes it back to a printed apostrophe.

**★ Is `{index}` zero-based?**
No — `{index}` is documented as 1-based, while the positional placeholders `{0}`, `{1}` are
0-based argument indices. The first invocation of a two-argument test therefore renders
`{index}` as `1` and `{0}` as the first argument.

**★ Can you format a number in a display name?**
Yes — the whole `MessageFormat` syntax is available, so `{0,number,#.###}` works. The catch is
documented: the *original* source arguments are passed to the formatter, before implicit or
explicit conversion. That makes numeric formats dependable for sources that supply real
numbers and unreliable for CSV sources, where the argument is still a `String` at formatting
time.

**★ What is the difference between `@DisplayName` and the `name` attribute?**
`@DisplayName` names the container — the method node under which the invocations hang. `name`
names each invocation. They coexist; the guide's own example sets both and the resulting tree
shows the container name once and the pattern once per row.

**★ Why is the display name worth this much attention at all?**
Because it is the entire difference between a parameterized test and the copy-pasted methods
it replaced. Ten `@Test` methods encode their case in the method name and the failure names it
for free. One `@ParameterizedTest` with ten rows has one method name, so case identity exists
only in the invocation display name. Default it away and you have traded ten diagnosable
failures for one ambiguous one.

{/* FOOTER */}
