---
title: "@CsvFileSource is what you reach for when the table outgrows the annotation — and it changes four defaults, moves your test data out of code review's line of sight, and gives you two different ways to skip a header row"
sidebar_label: "03c · @CsvFileSource"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "@CsvFileSource"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@CsvFileSource` javadoc
> ([docs.junit.org](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/CsvFileSource.html)),
> and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**A `@CsvSource` you have to scroll past is a data file that has not admitted it yet.
`@CsvFileSource` reads that file — from the classpath, from disk, from several at once — with
the same parser and four different defaults. The cost is real and worth stating up front: the
cases are no longer next to the assertion that consumes them, and a reviewer reading the diff
of the test class cannot see that a row changed.**

## The two ways in

```java
@ParameterizedTest
@CsvFileSource(resources = "/two-column.csv", numLinesToSkip = 1)
void testWithCsvFileSourceFromClasspath(String country, int reference) {
    assertNotNull(country);
    assertNotEquals(0, reference);
}

@ParameterizedTest
@CsvFileSource(files = "src/test/resources/two-column.csv", numLinesToSkip = 1)
void testWithCsvFileSourceFromFile(String country, int reference) {
    assertNotNull(country);
    assertNotEquals(0, reference);
}
```

> *"`@CsvFileSource` is a repeatable `ArgumentsSource` which is used to load comma-separated
> value (CSV) files from one or more classpath `resources()` or `files()`."*

The javadoc states the requirement on each: `resources` *"must not be empty unless `files()` is
non-empty"*, and symmetrically for `files`. Both attributes take arrays, so one annotation can
read several files and the records are provided in turn.

**Prefer `resources`.** A classpath resource is found the same way from Maven, Gradle, your
IDE's test runner and a shaded test jar. `files` takes a filesystem path, and in the guide's
own example that path is relative — which in Java resolves against the JVM's working
directory. The documentation does not define a base directory for `files`, and a relative path
that works from the module root will not work from a repository-root runner or an IDE
configured differently. Use `files` only for a file that genuinely is not on the classpath.

## Four defaults that differ from `@CsvSource`

| | `@CsvSource` | `@CsvFileSource` |
|---|---|---|
| Quote character | `'` (single) | `"` (double) |
| Comments | text block only | always |
| Header handling | `useHeadersInDisplayName` only | `numLinesToSkip` **and** `useHeadersInDisplayName` |
| Encoding | n/a — Java source | `encoding`, default `"UTF-8"` |

The quote character is the one that bites:

> *"In contrast to the default syntax used in `@CsvSource`, `@CsvFileSource` uses a double
> quote (`\"`) as the quote character by default, but this can be changed via the
> `quoteCharacter` attribute."*

So a row lifted out of a `.csv` file and pasted into a `@CsvSource` annotation changes meaning
— `"United States of America"` is one quoted cell in the file and a cell containing literal
quote marks in the annotation.

Comments need no text block here:

> *"Any line beginning with the `commentCharacter()` will be interpreted as a comment and will
> be ignored."*

## Two header mechanisms that are not the same thing

> *"The first record may optionally be used to supply CSV headers. You can instruct JUnit to
> ignore the headers via the `numLinesToSkip` attribute. If you would like for the headers to
> be used in the display names, you can set the `useHeadersInDisplayName` attribute to
> `true`."*

- `numLinesToSkip` — *"The number of lines to skip when reading the CSV files. Typically used
  to skip header lines. Defaults to `0`."* The lines are discarded.
- `useHeadersInDisplayName` — the first record is consumed *and used as column names* in the
  invocation display names. Defaults to `false`.

The guide's file:

```
COUNTRY, REFERENCE
Sweden, 1
Poland, 2
"United States of America", 3
France, 700_000
```

With `numLinesToSkip = 1` the report reads:

> ```
> [1] country = "Sweden", reference = "1"
> ```

With `useHeadersInDisplayName = true` (and no `numLinesToSkip`):

> ```
> [1] COUNTRY = "Sweden", REFERENCE = "1"
> ```

🔴 **Setting both is how you delete a test case.** `numLinesToSkip = 1` throws the header line
away, then `useHeadersInDisplayName = true` consumes the first *remaining* record — the Sweden
row — as headers. Four cases become three, nothing warns you, and the report looks plausible
because the column names now read `Sweden` and `1`.

## Everything else is the `@CsvSource` parser

The null/empty/quote rules are word-for-word identical, and they are the rules to have
memorised from [03](03-csvsource.md):

> *"An empty, quoted value (`\"\"`) results in an empty `String` unless the `emptyValue()`
> attribute is set; whereas, an entirely empty value is interpreted as a `null` reference. By
> specifying one or more `nullValues()` a custom value can be interpreted as a `null`
> reference. An `ArgumentConversionException` is thrown if the target type of a `null`
> reference is a primitive type."*
>
> *"**NOTE:** An unquoted empty value will always be converted to a `null` reference
> regardless of any custom values configured via the `nullValues()` attribute."*

`delimiter`/`delimiterString` (mutually exclusive), `ignoreLeadingAndTrailingWhitespace`
(default `true`), and `maxCharsPerColumn` (default 4096) behave exactly as they do in
`@CsvSource`. And the control characters are stricter here:

> *"Note that `delimiter()` (or `delimiterString()`), `quoteCharacter()`, and
> `commentCharacter()` are treated as control characters and must all be distinct."*

Not "only when a text block is used" — always, because a file can always contain comments.

## What JUnit 6.0 changed

🔴 **`lineSeparator` is gone.**

> *"The `lineSeparator` attribute in `@CsvFileSource` has been removed. The line separator is
> now automatically detected, meaning that any of `\r`, `\n`, or `\r\n` is treated as a line
> separator."*

This is a compile break on upgrade, and the fix is deletion — the auto-detection is strictly
better than the attribute was, and it ends the class of bug where a file committed from Windows
parsed as one enormous record.

The same FastCSV migration, stricter closing-quote handling and header-field attribute
application described in [03](03-csvsource.md) apply here too.

## When the move is right, and when it is a mistake

**Right:** the table is genuinely data — a currency rounding matrix, a list of valid and
invalid IBANs per country, a fixture exported from a spec. Dozens of rows. Nobody reads them
individually; they exist so the count is high and the coverage is broad.

**Wrong:** eight rows that a reader needs in order to understand what the method under test
does. Those rows are documentation. Moving them to `src/test/resources` hides them from the
diff of the class they explain, and the next person to change the method will not open the CSV.

There is a middle failure worth naming: a file that grows to hundreds of rows and then nobody
can say why any individual row is there. A CSV file has no room for a *reason*. If a row exists
because of an incident, comment it — the parser supports comments — or it will be deleted by
someone tidying up.

## Gotchas

**★ `numLinesToSkip = 1` together with `useHeadersInDisplayName = true`.** You lose your first
data row. The header is skipped, then the first real record is eaten as headers. Use one or the
other.

**★ `useHeadersInDisplayName = true` on a file with no header row.** Same outcome from the
other direction: row one silently stops being a test case.

**★ Copying a row between `@CsvFileSource` and `@CsvSource`.** The default quote characters
differ — double in files, single in annotations. Cells that were quoted stop being quoted, and
a cell containing a comma silently becomes two cells.

**★ `files` with a relative path.** It resolves against the JVM working directory, which is not
guaranteed to be the module directory and differs between runners. `resources` has no such
ambiguity.

**★ A resource path without the leading slash.** `resources = "/two-column.csv"` and
`resources = "two-column.csv"` are different lookups. The guide's examples show both forms in
different places; pick the absolute form and be consistent, because the failure is "file not
found" at discovery time, which reads like a build problem.

**★ Forgetting the file must be *packaged*.** In a Maven build only `src/test/resources` (and
whatever the build declares) lands on the test classpath. A CSV next to the test class in
`src/test/java` is not a resource unless the build is configured to copy it.

**★ A file saved as UTF-8 with a BOM.** `encoding` defaults to `"UTF-8"`; a byte-order mark is
not part of that and ends up in the first cell of the first record. The symptom is a single
mysteriously-failing first row.

**★ Still setting `lineSeparator`.** Removed in 6.0. Delete it; separators are auto-detected.

**★ Assuming multiple `resources` are somehow zipped together.** They are read in turn and
their records concatenated, exactly as repeated annotations concatenate. There is no pairing
and no cartesian product.

**★ Putting the expected values in the file and the "why" nowhere.** Add comment lines. The
parser ignores any line starting with `#`, and a CSV without them becomes unmaintainable at
about row fifty.

**★ Treating a big CSV as coverage.** Five hundred rows through one code path is one test run
five hundred times. Coverage is about branches, not rows — that argument belongs to
**topic 09 · JaCoCo** *(not written yet)* and its honest counterpart, mutation testing.

## Interview questions

**★ `resources` or `files` — which, and why?**
`resources`, almost always. It is a classpath lookup, so it resolves identically under Maven,
Gradle, an IDE runner and a packaged test artifact. `files` takes a filesystem path; the
documentation does not define a base directory for a relative one, so it resolves against the
JVM working directory and breaks when the runner's working directory changes.

**★ What is the difference between `numLinesToSkip` and `useHeadersInDisplayName`?**
`numLinesToSkip` discards the given number of leading lines — the header is thrown away and
never seen again. `useHeadersInDisplayName` consumes the first record and uses its values as
column names in each invocation's display name. Both consume the first record, which is why
setting both silently costs you a test case.

**★ Which defaults differ from `@CsvSource`?**
The quote character is a double quote rather than a single quote; comments work everywhere
rather than only in a text block; there is an `encoding` attribute defaulting to UTF-8 and a
`numLinesToSkip` attribute defaulting to 0; and the control characters — delimiter, quote,
comment — must always be distinct rather than only when a text block is used.

**★ What happened to `lineSeparator` in JUnit 6?**
Removed. The line separator is auto-detected, and any of `\r`, `\n` or `\r\n` is treated as
one. On upgrade the attribute is a compile error and the fix is to delete it.

**★ When should a table *not* move to a file?**
When the rows are the explanation of the behaviour rather than bulk data. Eight cases that
teach a reader what the method does belong next to the method's test, in a text block, where a
diff shows them. A file is right when the rows are a dataset nobody reads individually.

**★ How do you keep a large CSV maintainable?**
Comment lines — the parser ignores any line starting with the comment character, so each block
of rows can carry the reason it exists. Without that, a row added for an incident three years
ago is indistinguishable from noise and will eventually be deleted by someone tidying up.

{/* FOOTER */}
