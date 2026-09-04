---
title: "JUnit 6 rewrote how an argument renders inside a display name — text is quoted, control characters are escaped then replaced, name-value pairs got a space, and everything is rendered from the source argument before conversion, which is deliberate and which broke every tool that parsed display names"
sidebar_label: "07b · Quoted arguments"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Quoted Text-based Arguments"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> "Display Names"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/display-names.html)), the
> `@ParameterizedTest.quoteTextArguments`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedTest.html))
> and `@ParameterizedClass.quoteTextArguments`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedClass.html))
> pages, and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**[07](07-display-names.md) covered the pattern. This chunk covers what the pattern renders
*into* it — and that changed in 6.0 in three separate ways, all of which are improvements and
all of which break anything downstream that was parsing display names out of a report.**

## 🔴 Text arguments are quoted now

> *"As of JUnit Jupiter 6.0, text-based arguments in display names for parameterized tests are
> quoted by default. In this context, any `CharSequence` (such as a `String`) or `Character`
> is considered text. A `CharSequence` is wrapped in double quotes (`"`), and a `Character` is
> wrapped in single quotes (`'`)."*
>
> *"Special characters will be escaped in the quoted text. For example, carriage returns and
> line feeds will be escaped as `\\r` and `\\n`, respectively."*

The javadoc adds one rule the guide leaves out: *"In addition, any ISO control character will
be represented as a question mark (`?`) in the quoted text."*

The point of the change is the case `@ValueSource(strings = …)` and `@NullSource` /
`@EmptySource` produce most often. The guide prints the display names generated for its own
`nullEmptyAndBlankStrings(String text)` example — quoted here from the documentation, not from
a run:

> ```
> [1] text = null
> [2] text = ""
> [3] text = " "
> [4] text = "   "
> [5] text = "\t"
> [6] text = "\n"
> ```

Before 6.0, rows 2 through 6 were five visually near-identical lines. A test that failed on
"the tab one" was indistinguishable in the report from one that failed on "the empty one", and
the only way to tell was to count. That is the entire justification for the feature and it is
a good one — [02b · null and empty](02b-null-and-empty.md) is exactly the source that
generates those rows.

Note also that `null` is *not* quoted: it is not a `CharSequence`, so it renders bare. That is
the one rendering that reliably distinguishes a `null` argument from the string `"null"`,
which is the distinction [03 · `@CsvSource`](03-csvsource.md) spends five rules on.

## Quoting happens before conversion

This is the surprising half, and the documentation states it twice because it surprises
people:

> *"The original source arguments are quoted when generating a display name, and this occurs
> before any implicit or explicit argument conversion is performed."*
>
> *"For example, if a parameterized test accepts `3.14` as a `float` argument that was
> converted from `"3.14"` as an input string, `"3.14"` will be present in the display name
> instead of `3.14`."*

Which is why the guide's own `@CsvSource` example renders an `int` parameter in quotes:

> ```
> [1] fruit = "apple", rank = "1"
> [2] fruit = "banana", rank = "2"
> [3] fruit = "lemon, lime", rank = "0xF1"
> [4] fruit = "strawberry", rank = "700_000"
> ```

`rank` is declared `int`. The display name shows `"0xF1"` and `"700_000"` because those are
the CSV cells, and the cells are `String` until conversion runs. **This is a feature, not a
leak**: the report tells you what the *table* said, which is what you need in order to find
the offending row. A report saying `rank = 241` would send you looking for a row that does not
textually exist ([08 · conversion](08-conversion-and-aggregation.md) explains why `0xF1` is
241).

The same rule is why the `MessageFormat` number formats in [07](07-display-names.md) are
unreliable over a CSV source: both facilities see the pre-conversion argument.

Turn quoting off per method when a downstream consumer depends on the old shape:

```java
@ParameterizedTest(quoteTextArguments = false)
@CsvSource({ "apple, 1", "banana, 2" })
void legacyReportShape(String fruit, int rank) { }
```

The attribute exists on both `@ParameterizedTest` and `@ParameterizedClass`, defaults to
`true`, and is itself marked `@API(status = EXPERIMENTAL, since = "6.0")` — so the *switch*
may still move, even though the behaviour it disables is the new default.

## Control characters that survive escaping

Escaping handles the text arguments. Anything left over — a control character in a
`@DisplayName`, or in the `toString()` of a non-text argument — is replaced at the
display-name level, one layer further out:

| Original | Replacement | Description |
|---|---|---|
| `\r` | `<CR>` | *"Textual representation of a carriage return"* |
| `\n` | `<LF>` | *"Textual representation of a line feed"* |
| Other control character | U+FFFD | *"Unicode replacement character (U+FFFD)"* |

> *"Control characters in text-based arguments in display names for parameterized tests are
> escaped by default. […] Any remaining ISO control characters in a display name will be
> replaced as follows."*

The two layers do different things and it is worth keeping them apart. A `String` argument's
newline becomes the escape sequence `\n` inside double quotes, by the quoting rule. A newline
arriving any other way — inside an object's `toString()`, or inside a literal `@DisplayName` —
becomes the token `<LF>`, by the replacement rule. The release notes list the second as a
6.0 feature: *"Non-printable control characters in display names are now replaced with
alternative representations."*

## Truncation at 512 characters

> *"When including arguments in display names, their string representations are truncated if
> they exceed the configured maximum length. The limit is configurable via the
> `junit.jupiter.params.displayname.argument.maxlength` configuration parameter and defaults
> to 512 characters."*

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.params.displayname.argument.maxlength = 120
```

A parameterized test fed a JSON payload has a display name that is a wall of braces; lowering
the limit is more often the right move than raising it. If the full payload matters for
diagnosis it belongs in the failure message, not in the node name. And note the failure mode
of truncation: several rows sharing a long common prefix render *identically*, silently
undoing the one thing the display name is for.

## Name-value spacing changed too

> *"Display names for `@ParameterizedClass` and `@ParameterizedTest` now consistently style
> name-value pairs for arguments using `name = value` formatting – for example,
> `fruit = apple` instead of `fruit=apple`."*

Three rendering changes in one release — quoting, control characters, spacing — is why any
tool that greps display names out of a JUnit XML report needed work on this upgrade. That is
the tool's design fault rather than JUnit's: display names are presentation, and the report
format carries structured fields for anything a machine should read.

## Gotchas

**★ Expecting the display name to show the converted value.** It shows the source argument. An
`int` parameter fed from a CSV cell renders as a quoted string, and a `LocalDate` parameter fed
`"2017-03-14"` renders as `"2017-03-14"`. Documented twice, and correct — the report names the
row, not the object.

**★ A downstream script that parses display names.** 6.0 changed quoting, control-character
handling and `name=value` spacing. Anything grepping JUnit XML display names broke on the
upgrade. Read structured data out of the report's own fields instead.

**★ Turning off `quoteTextArguments` to "clean up" the report.** You are re-merging the empty
string, the blank string and the tab into one indistinguishable rendering — the exact defect
the feature exists to fix. Disable it only for a concrete downstream consumer, and only on the
methods that consumer reads.

**★ Assuming `quoteTextArguments` is stable API.** The attribute is
`@API(status = EXPERIMENTAL, since = "6.0")` on both annotations. The default behaviour is
here to stay; the switch that disables it has not been committed to.

**★ A 4 KB argument in the display name.** Truncation at 512 characters happens silently, so
the report shows a prefix that may be identical across several rows. Lower
`junit.jupiter.params.displayname.argument.maxlength`, or name the argument set instead of
rendering the payload ([07c](07c-naming-arguments.md)).

**★ Relying on the escaped form to be reversible.** `\n` in a display name may be an escaped
newline in a text argument or two literal characters that were already there. The rendering is
lossy on purpose; it is for a human reading a tree.

**★ Reading `?` in a report as a character-encoding problem.** For a quoted text argument it is
documented behaviour: an ISO control character with no textual representation is rendered as a
question mark. Chasing a `file.encoding` bug is a wasted afternoon.

**★ Assuming a bare `null` in a report means the string `"null"`.** The opposite: text is
quoted, so `text = "null"` is the four-character string and `text = null` is a genuine `null`
reference. Before 6.0 those two rendered the same way.

## Interview questions

**★ What changed about display names in JUnit 6?**
Three things. Text-based arguments — any `CharSequence` or `Character` — are quoted by
default, with special characters escaped and ISO control characters shown as `?`.
Non-printable control characters remaining anywhere in a display name are replaced with
`<CR>`, `<LF>` or U+FFFD. And name-value pairs are styled `name = value` with spaces instead
of `name=value`.

**★ Why does an `int` parameter appear in quotes in the report?**
Because quoting is applied to the original source argument before conversion. A `@CsvSource`
cell is a `String` at that moment, so it is quoted as text. The documentation calls this out
explicitly with the `"3.14"` to `float` example. It is deliberate: the display name identifies
the row in your table, which is what you need in order to find it.

**★ Why did the empty string and the tab case used to look identical in a report?**
Because the argument was rendered with no quoting, so `""`, `" "` and `"\t"` all produced
either nothing or invisible whitespace after `text = `. 6.0's quoting wraps them in double
quotes and escapes the control characters, which turns the null case, the empty case, the
blank cases and the tab case into six visibly different lines.

**★ How long can an argument be in a display name?**
512 characters by default, then it is truncated;
`junit.jupiter.params.displayname.argument.maxlength` configures the limit. Truncation is
silent, so several long rows can render identically — a reason to name the argument set rather
than raise the limit.

**★ Should you turn `quoteTextArguments` off?**
Only for a specific downstream consumer that parses the old shape, and only on the methods it
reads — and the better fix is to stop parsing display names. The attribute is still
`EXPERIMENTAL`, so code depending on it depends on an escape hatch the project has not
committed to keeping.

**★ There are two different mechanisms handling control characters. What is the difference?**
Quoting escapes control characters *inside a text argument* — a newline in a `String` argument
becomes `\n` within the double quotes. Replacement operates on whatever ISO control characters
remain *anywhere in the finished display name*, including ones that came from an object's
`toString()` or from a literal `@DisplayName`, and maps them to `<CR>`, `<LF>` or the Unicode
replacement character.

{/* FOOTER */}
