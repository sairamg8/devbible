---
title: "The textBlock attribute is what makes @CsvSource worth using: it buys column alignment the compiler preserves, comment lines, and header names in the test report — and it introduces three whitespace rules that decide whether your table parses"
sidebar_label: "03b · CSV text blocks and headers"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "@CsvSource" and "Customizing
> Display Names"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@CsvSource` javadoc
> ([docs.junit.org](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/CsvSource.html)),
> and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**A `String[]` of CSV records is a table with quotation marks and commas in the way. A text
block is the same table with nothing in the way — and it unlocks two things the array form
cannot have: comment lines, and a header row that ends up in the test report. This is the form
to write by default.**

## Same cases, readable

> *"If the programming language you are using supports Java text blocks or equivalent
> multi-line string literals, you can alternatively use the `textBlock` attribute of
> `@CsvSource`. Each record within a text block represents a CSV record and results in one
> invocation of the parameterized class or test."*

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
    // ...
}
```

> *"Defaults to an empty string. You therefore must supply CSV content via this attribute or
> the `value()` attribute."*

One or the other, never both as a strategy — if a table is worth writing, write it once.

## Comments — the thing the array form cannot do

> *"In contrast to CSV records supplied via the `value` attribute, a text block can contain
> comments. Any line beginning with the value of the `commentCharacter` attribute (`#` by
> default) will be treated as a comment and ignored. Note that there is one exception to this
> rule: if the comment character appears within a quoted field, it loses its special
> meaning."*

⚠️ The `commentCharacter` **attribute** is new and still settling: the javadoc marks it
`@API(status = EXPERIMENTAL, since = "6.0.1")`, `@since 6.0.1`. The `#` behaviour itself is
older; what 6.0.1 added is the ability to change the character. Treat the default as stable and
a custom comment character as a feature that may still move.

Placement is strict:

> *"The comment character must be the first character on the line without any leading
> whitespace. It is therefore recommended that the closing text block delimiter (`\"\"\"`) be
> placed either at the end of the last line of input or on the following line, left aligned
> with the rest of the input."*

That recommendation is not stylistic. Java's text block strips *incidental* whitespace based
on the least-indented line — including the closing delimiter's line. Indent the closing
`"""` one space further than your comment lines and every line keeps a leading space, at which
point the comment lines are no longer comments and become malformed records.

The guide's fully drawn table, which is the format worth stealing:

```java
@ParameterizedTest
@CsvSource(delimiter = '|', quoteCharacter = '"', textBlock = """
    #-----------------------------
    #    FRUIT     |     RANK
    #-----------------------------
         apple     |      1
    #-----------------------------
         banana    |      2
    #-----------------------------
      "lemon lime" |     0xF1
    #-----------------------------
       strawberry  |    700_000
    #-----------------------------
    """)
void testWithCsvSource(String fruit, int rank) {
    // ...
}
```

Note what that example also demonstrates: `quoteCharacter = '"'` is the reason the
attribute exists — *"the primary use case is to allow you to use double quotes in
`textBlock()`"*. Inside a text block a double quote needs no escaping, so the CSV can look
like real CSV.

## Header names in the report

> *"Configures whether the first CSV record should be treated as header names for columns.
> When set to `true`, the header names will be used in the generated display name for each
> `@ParameterizedClass` or `@ParameterizedTest` invocation."*

The guide shows what the header version produces:

> ```
> [1] FRUIT = "apple", RANK = "1"
> [2] FRUIT = "banana", RANK = "2"
> [3] FRUIT = "lemon, lime", RANK = "0xF1"
> [4] FRUIT = "strawberry", RANK = "700_000"
> ```

Two things to notice. First, the header row is consumed — it is not also a test case. Second,
the values are the **source strings**, before conversion: `RANK = "0xF1"`, not `241`. The
guide is explicit about why:

> *"The original source arguments are quoted when generating a display name, and this occurs
> before any implicit or explicit argument conversion is performed."*

### The `{arguments}` caveat, and its 6.0 resolution

The javadoc for `useHeadersInDisplayName` still carries this instruction:

> *"When using this feature, you must ensure that the display name pattern for
> `@ParameterizedClass` or `@ParameterizedTest` includes `\"{arguments}\"` instead of
> `\"{argumentsWithNames}\"`"*

— with an example that sets `name = "[{index}] {arguments}"` explicitly. The 6.0.0 release
notes, however, list this under bug fixes:

> *"CSV headers are now properly supported with the default display name pattern and the
> explicit `{argumentsWithNames}` display name pattern for parameterized tests that utilize
> the `useHeadersInDisplayName` flag in `@CsvSource` and `@CsvFileSource`. Specifically, the
> parameter name is no longer duplicated in the display name when a CSV header is desired
> instead."*

⚠️ **These two documents disagree, and I could not find a statement reconciling them.** The
release note is the later and more specific of the two, and the user guide's own header
examples carry no `name` attribute at all — consistent with the default pattern now working.
The safe reading: on 6.0.3 you do not need to set `name` to get headers, and the javadoc's
instruction is guidance left over from 5.x. If a header name shows up duplicated in your
report, set `name = "[{index}] {arguments}"` and move on.

## Three whitespace rules

1. **Java strips incidental whitespace; other JVM languages do not.**
   > *"Java's text block feature automatically removes incidental whitespace when the code is
   > compiled. However other JVM languages such as Groovy and Kotlin do not. Thus, if you are
   > using a programming language other than Java and your text block contains comments or new
   > lines within quoted strings, you will need to ensure that there is no leading whitespace
   > within your text block."*

2. **Trailing whitespace inside a cell is trimmed unless quoted** — the same
   `ignoreLeadingAndTrailingWhitespace` rule as the array form, defaulting to `true`
   ([03](03-csvsource.md)).

3. **Every physical line ends with a newline, so a wrapped column must be quoted.**
   > *"Note that CSV records supplied via `textBlock()` will implicitly contain newlines at the
   > end of each physical line within the text block. Thus, if a CSV column wraps across a new
   > line in a text block, the column must be a quoted string."*

## Gotchas

**★ Indenting the closing `"""` differently from the records.** Java computes incidental
whitespace across all lines including the closing delimiter, so this silently prefixes every
record with spaces. Records survive it (whitespace is trimmed); comment lines do not, because
`#` must be the first character with no leading whitespace.

**★ A `#` inside a quoted cell that you expected to be a comment, or vice versa.** Inside a
quoted field the comment character loses its special meaning. A colour code `'#FF0000'` in a
cell is data; the same token unquoted at line start is a discarded line.

**★ Using `#` as data at the start of a value.** Quote it or change `commentCharacter`. And if
you change it, remember it must be distinct from the delimiter and the quote character.

**★ `useHeadersInDisplayName = true` without a header row.** The first data record is consumed
as headers and that case never runs. It fails quietly — you get N−1 invocations and no error.

**★ Forgetting the header row is not a case.** The reverse of the above: adding
`useHeadersInDisplayName` to an existing table without adding a header line silently deletes a
test case.

**★ Expecting converted values in the display name.** The name shows the source strings. A
`0xF1` cell reads as `"0xF1"`, not `241`. That is deliberate — the display name identifies the
input you wrote, not the value the method received.

**★ Writing the table in Kotlin and keeping the pretty indentation.** Kotlin's `trimIndent()`
is a runtime call on a string, not the compile-time incidental-whitespace removal an
annotation value needs. The docs say plainly: no leading whitespace in a non-Java text block
that uses comments or quoted newlines.

**★ A blank line in the middle of a text block.** The array form's javadoc requires each value
to be non-blank; the text-block form's behaviour for a stray blank line is not spelled out in
the documentation, and I did not confirm it. Do not use blank lines as visual separators —
use comment lines, which are documented.

**★ Escaping quotes as if you were still in a `String[]`.** Inside a text block `"` needs no
escape, which is precisely why `quoteCharacter = '"'` is worth setting. Carrying over `\"`
from the array form produces a cell containing a backslash.

## Interview questions

**★ Why prefer `textBlock` over the `value` array?**
Three concrete reasons: the columns can be aligned without escaping or quotation marks; the
block can contain comment lines, which the array form cannot; and it reads as the table it is,
so a missing combination is visible on inspection. There is no behavioural downside — both
attributes feed the same parser.

**★ How do comments work, and what is the one exception?**
Any line whose first character is the `commentCharacter` — `#` by default, configurable since
6.0.1 — is ignored. The exception is that inside a quoted field the character loses its special
meaning, so a quoted `'#FF0000'` is data. The character must be the first character on the line
with no leading whitespace.

**★ What does `useHeadersInDisplayName` actually do?**
It consumes the first record as column names and uses them in each invocation's display name —
`FRUIT = "apple", RANK = "1"`. The header row stops being a test case. The values shown are the
raw source strings, because display names are generated before argument conversion.

**★ Why does the closing `"""` position matter?**
Because Java strips incidental whitespace relative to the least-indented line, and the closing
delimiter's line participates. Placing it further right than the content leaves a leading space
on every line, which breaks comment detection since `#` must be the first character.

**★ Does any of this work in Kotlin?**
The parsing does; the whitespace does not. Kotlin and Groovy do not remove incidental
whitespace at compile time, so the documentation requires that a non-Java text block containing
comments or quoted newlines have no leading whitespace at all. In practice, Kotlin test tables
end up left-aligned and ugly.

**★ A column value needs to span two lines. What do you do?**
Quote it. A text block puts a real newline at the end of every physical line, so an unquoted
wrapped column becomes two malformed records. A quoted cell may contain the newline.

{/* FOOTER */}
