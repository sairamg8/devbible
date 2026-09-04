---
title: "@CsvSource turns a list of cases into a table you can read down a column — at the price of learning exactly five rules about quotes, blanks and whitespace that decide whether a cell is an empty string, a null, or a parse error"
sidebar_label: "03 · @CsvSource"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "@CsvSource"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@CsvSource` javadoc
> ([docs.junit.org](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/CsvSource.html)),
> and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**A `@CsvSource` record is a test case and a column is a variable, which makes a table of
cases something a reviewer can scan vertically for a missing combination — the one review
technique that actually finds gaps in test coverage. What you pay for that is a small parser
with precise rules, and every one of those rules is about the difference between "nothing",
"an empty string" and "a `null`".**

## The table

```java
@ParameterizedTest
@CsvSource({
    "apple,         1",
    "banana,        2",
    "'lemon, lime', 0xF1",
    "strawberry,    700_000"
})
void testWithCsvSource(String fruit, int rank) {
    assertNotNull(fruit);
    assertNotEquals(0, rank);
}
```

> *"`@CsvSource` allows you to express argument lists as comma-separated values (i.e., CSV
> `String` literals). Each string provided via the `value` attribute in `@CsvSource`
> represents a CSV record and results in one invocation of the parameterized class or test."*

Column *n* of every record becomes parameter *n* of the method. Every cell arrives as a
`String` and is then converted to the declared parameter type — which is why `0xF1` and
`700_000` are legal `int` cells: those are Java integer literal forms, and implicit conversion
accepts them ([08](08-conversion-and-aggregation.md)).

Aligning the columns with spaces is not cosmetic. It is the whole reason to prefer this source
over four `@MethodSource` rows: a misaligned or missing cell is visible.

## Delimiters

> *"The default delimiter is a comma (`,`), but you can use another character by setting the
> `delimiter` attribute. Alternatively, the `delimiterString` attribute allows you to use a
> `String` delimiter instead of a single character. However, both delimiter attributes cannot
> be set simultaneously."*

```java
@CsvSource(delimiter = '|', value = { "apple | 1", "banana | 2" })
@CsvSource(delimiterString = "::", value = { "apple :: 1" })
```

A pipe is the usual choice the first time a cell legitimately contains a comma. It is also the
usual mistake — quoting the cell is the smaller change and keeps the file readable as CSV.

## The five rules about quotes and blanks

These are the rules worth memorising, quoted from the javadoc:

> *"By default, `@CsvSource` uses a single quote (`'`) as its quote character, but this can be
> changed via `quoteCharacter()`."*
>
> *"An empty, quoted value (`''`) results in an empty `String` unless the `emptyValue()`
> attribute is set; whereas, an entirely empty value is interpreted as a `null` reference."*
>
> *"By specifying one or more `nullValues()` a custom value can be interpreted as a `null`
> reference."*
>
> *"**NOTE:** An unquoted empty value will always be converted to a `null` reference
> regardless of any custom values configured via the `nullValues()` attribute."*
>
> *"An `ArgumentConversionException` is thrown if the target type of a `null` reference is a
> primitive type."*

The user guide's table of consequences, which is the thing to keep open the first few times:

| Input | Resulting argument list |
|---|---|
| `@CsvSource({ "apple, banana" })` | `"apple"`, `"banana"` |
| `@CsvSource({ "apple, 'lemon, lime'" })` | `"apple"`, `"lemon, lime"` |
| `@CsvSource({ "apple, ''" })` | `"apple"`, `""` |
| `@CsvSource({ "apple, " })` | `"apple"`, `null` |
| `@CsvSource(value = { "apple, banana, NIL" }, nullValues = "NIL")` | `"apple"`, `"banana"`, `null` |
| `@CsvSource(value = { " apple , banana" }, ignoreLeadingAndTrailingWhitespace = false)` | `" apple "`, `" banana"` |

Read rows 3 and 4 together until they are automatic. **`''` is an empty string. Nothing at all
is a `null`.** In a hand-aligned table those two look nearly identical and behave completely
differently, and the second one detonates on a primitive parameter.

`emptyValue` changes what `''` produces:

```java
@CsvSource(value = { "apple, ''" }, emptyValue = "BLANK")   // second argument is "BLANK"
```

> *"This value replaces quoted empty strings read from the input. Defaults to `\"\"`."*

`nullValues` lets a visible token stand in for a `null`, which is the honest way to write a
table that contains one:

```java
@ParameterizedTest
@CsvSource(nullValues = "NULL", textBlock = """
    NULL,         false
    '',           false
    '   ',        false
    'Ada Lovelace', true
    """)
void nameValidity(String name, boolean expected) {
    assertThat(validator.isValid(name)).isEqualTo(expected);
}
```

Now the `null` case is a word a reader can see, rather than a gap between two commas.

## Whitespace

> *"Except within a quoted string, leading and trailing whitespace in a CSV column is trimmed
> by default. This behavior can be changed by setting the
> `ignoreLeadingAndTrailingWhitespace` attribute to `true`."*

⚠️ That guide sentence is self-contradictory, and the javadoc settles it:
`ignoreLeadingAndTrailingWhitespace` **defaults to `true`** — you set it to `false` to keep the
whitespace. The guide's own example table above uses `false` to produce `" apple "`, which
confirms the javadoc. Trust the javadoc; the prose is a slip.

> *"Whitespace refers to characters with Unicode code points less than or equal to `U+0020`,
> as defined by `String.trim()`."*

So a test whose case *is* leading whitespace cannot be written by putting spaces in the
record — quote the cell (`'   '`) or set the attribute to `false` for the whole annotation.

## The control characters must be distinct

> *"Note that `delimiter()` (or `delimiterString()`), `quoteCharacter()`, and
> `commentCharacter()` (when `textBlock()` is used) are treated as **control characters**.
> `delimiter()` and `quoteCharacter()` must always be distinct. `commentCharacter()` must be
> distinct from the others only when `textBlock()` is used."*

Setting `delimiter = '\''` in a source that also uses the default quote character is a
configuration failure, not a table that parses oddly.

## Two more attributes worth knowing

**`maxCharsPerColumn`** — *"Must be a positive number or `-1` to allow an unlimited number of
characters. Defaults to `4096`."* A 5 KB JSON payload in a cell fails to parse, and the cause
is not obvious from the record. Raise it or move the payload to a file.

**Newlines** — *"In general, CSV records should not contain explicit newlines (`\n`) unless
they are placed within quoted strings."* A multi-line expected value must be a quoted cell.

## What JUnit 6.0 changed here

🔴 Three changes land on `@CsvSource`, and none of them appear in any tutorial written before
late 2025:

> *"The implementation of `@CsvSource` and `@CsvFileSource` has been migrated from the no
> longer maintained univocity-parsers to FastCSV."*
>
> *"As a result of migrating from univocity-parsers to FastCSV for `@CsvSource` and
> `@CsvFileSource`, root causes and messages of exceptions thrown for malformed CSV input may
> differ in some cases. While the overall parsing behavior remains consistent, this may affect
> custom error handling that relies on specific exception types or messages."*
>
> *"Extra characters after a closing quote are no longer allowed in `@CsvSource` and
> `@CsvFileSource`. For example, if a single quote is used as the quote character, the
> following CSV value `'foo'INVALID,'bar'` will now cause an exception to be thrown. This
> helps ensure that malformed input is not silently accepted or misinterpreted."*
>
> *"Attributes such as `ignoreLeadingAndTrailingWhitespace`, `nullValues`, and others in
> `@CsvSource` and `@CsvFileSource` now apply to header fields as well as to regular
> fields."*

The third one is a genuine upgrade break: a table that was quietly mis-parsing a stray
character now fails. That is the correct outcome and it will still land in your inbox as "the
JUnit upgrade broke a test".

## Gotchas

**★ A trailing comma with nothing after it is a `null`, not an empty string.** `"apple, "` is
two arguments, the second `null`. If parameter two is an `int`, that is an
`ArgumentConversionException` at argument resolution — a failure that looks like a framework
problem and is a punctuation problem.

**★ `nullValues` does not rescue an unquoted blank cell.** The javadoc is emphatic: an
unquoted empty value is *always* `null` regardless of `nullValues`. `nullValues` adds tokens;
it does not remove the built-in rule.

**★ Quoting with `"` by default.** `@CsvSource`'s default quote character is the **single**
quote. `@CsvFileSource`'s is the double quote. Copying a row from a `.csv` file into a
`@CsvSource` annotation therefore changes its meaning — see [03c](03c-csvfilesource.md).

**★ Setting both `delimiter` and `delimiterString`.** Explicitly disallowed. Pick one; use
`delimiterString` only when the delimiter is genuinely more than one character.

**★ Choosing a pipe delimiter, then needing a pipe in a value.** You have moved the problem,
not solved it. Quoting handles a delimiter inside a value at any delimiter setting.

**★ Assuming `ignoreLeadingAndTrailingWhitespace` defaults to `false` because the guide's
prose implies it.** It defaults to `true`. If your test is *about* untrimmed input, quote the
cell or set the attribute to `false`.

**★ Expecting a cell to arrive as its declared type without conversion rules applying.** Every
cell is a `String` first. `"true"` reaching a `boolean` works because there is a converter;
`"TRUE "` inside quotes does not get trimmed and may not.

**★ A cell longer than 4096 characters.** `maxCharsPerColumn` defaults to 4096 and the
resulting failure names the parser, not your record.

**★ An expected value that contains a newline, unquoted.** CSV records must not contain
explicit newlines outside a quoted string. Quote the cell — and if you are using a text block,
quoting is mandatory because the block already ends every physical line with a newline
([03b](03b-csv-text-blocks.md)).

**★ Booleans in the last column, with no header.** `"apple, 1, true, false, true"` is a row
nobody can read six months later. Either name the columns with a text block and
`useHeadersInDisplayName`, or aggregate the row into an object
([08b](08b-aggregation.md)).

**★ Relying on a specific parse-failure message in your own tooling.** 6.0 swapped the CSV
parser; exception types and messages for malformed input may differ from 5.x.

**★ Growing the table past twenty rows or six columns.** Both are signals. Twenty rows wants a
file ([03c](03c-csvfilesource.md)); six columns wants an aggregator or a `@MethodSource`
returning real objects.

## Interview questions

**★ In `@CsvSource`, what is the difference between `''` and nothing at all?**
`''` — a quoted empty value — produces an empty `String`, or whatever `emptyValue` is set to.
An entirely empty, unquoted value produces a `null` reference. The two look almost identical in
an aligned table and behave completely differently, and the `null` one throws an
`ArgumentConversionException` if the target parameter is a primitive.

**★ How do you put a comma inside a cell?**
Quote the cell: `"apple, 'lemon, lime'"` yields two arguments, the second being
`lemon, lime`. The alternative is changing the delimiter, but quoting is local to the row that
needs it and does not change how every other row reads.

**★ What is `nullValues` for, and what does it *not* do?**
It declares tokens — `NIL`, `N/A`, `NULL` — that should be read as `null` references, so a
table can show its `null` cases as visible words. It does not change the rule that an unquoted
empty value is always `null`; that is unconditional.

**★ Is whitespace trimmed?**
Yes, outside quoted strings, by default: `ignoreLeadingAndTrailingWhitespace` defaults to
`true`, where whitespace means code points up to `U+0020` as defined by `String.trim()`. Set
it to `false` to preserve it, or quote the individual cell.

**★ Why is the default quote character a single quote?**
Because the records live inside Java string literals in an annotation, where a double quote
would have to be escaped on every use. `@CsvFileSource` reads real files, so it defaults to
the double quote that actual CSV uses. Both are configurable via `quoteCharacter`.

**★ What changed in `@CsvSource` in JUnit 6?**
The parser was replaced — univocity-parsers is unmaintained, so 6.0 moved to FastCSV. Exception
types and messages for malformed input may differ; extra characters after a closing quote are
now an error instead of being silently accepted; and attributes such as
`ignoreLeadingAndTrailingWhitespace` and `nullValues` now apply to header fields too.

**★ When has a `@CsvSource` become the wrong tool?**
When the cells stop being literals. The moment a case needs a constructed object, a value
computed from another case, or a type with no `String` representation, you are encoding objects
as strings so that a converter can decode them — at which point `@MethodSource` says the same
thing in Java ([04](04-methodsource.md)).

{/* FOOTER */}
