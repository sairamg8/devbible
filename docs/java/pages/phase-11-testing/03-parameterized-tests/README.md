---
title: "Parameterized tests: the table of cases is the deliverable, and every rule in this topic is really about whether a red row can name itself and whether a green row could have been green for the wrong reason"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 / 2026-08-28 against the JUnit **6.0.3** User Guide, "Parameterized
> Classes and Tests"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `org.junit.jupiter.params` javadocs
> ([docs.junit.org/6.0.3/api](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/module-summary.html))
> and the JUnit 6 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **JUnit Jupiter 6.0.3**, AssertJ 3.27.7. 🔴 **JUnit is at 6, not 5** — several rules here
> changed in 6.0 and every page says which. **No sandbox** — these pages carry Java source and
> sentences quoted from the documentation, never a fabricated test run.

**A copy-pasted test method is the problem this feature solves, and a table of rows is the
solution — but only while every row means the same thing. The engine expands one annotated
method into N independent tests, each with its own lifecycle and its own line in the report, so
the table's real output is not the assertion, it is the *name* of whichever row went red. Almost
everything in this topic follows from that.**

The two defects unique to tables are both invisible in a diff. A **red row that cannot name
itself** — because the arguments render as hash codes, or a positional placeholder now points at
the wrong column, or the case is distinguished by a branch the report cannot show. And a **green
row that is green for the wrong reason** — because a filter matched nothing, an extra column was
silently discarded, a converter swallowed a parse error, or the expected value was computed from
the input by the same rule the code implements. Neither shows up in a build. Both show up in
[10 · The review checklist](10-the-checklist.md).

**37 chunks.** Read in order; each chunk links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[One test, many cases](01-one-test-many-cases.md)** | <span className="db-tier t-understand">Understand</span> | Not a loop in a method — N independent tests, each with its own name and result |
| 2 | **[@ValueSource](02-valuesource.md)** | <span className="db-tier t-understand">Understand</span> | The fewest moving parts and the most rules — and no way at all to say `null` |
| 3 | **[Null and empty sources](02b-null-and-empty.md)** | <span className="db-tier t-understand">Understand</span> | Annotations cannot hold a `null`, and "empty" means eleven different things |
| 4 | **[@CsvSource](03-csvsource.md)** | <span className="db-tier t-understand">Understand</span> | Five rules about quotes, blanks and whitespace decide whether a cell is `""`, `null` or an error |
| 5 | **[CSV text blocks and headers](03b-csv-text-blocks.md)** | <span className="db-tier t-understand">Understand</span> | Column alignment the compiler preserves, comments, and header names in the report |
| 6 | **[@CsvFileSource](03c-csvfilesource.md)** | <span className="db-tier t-understand">Understand</span> | When the table outgrows the annotation — four changed defaults and two ways to skip a header |
| 7 | **[@MethodSource](04-methodsource.md)** | <span className="db-tier t-understand">Understand</span> | No type limits, paid for with a `static` requirement and a factory name the compiler never checks |
| 8 | **[@MethodSource return types](04b-methodsource-return-types.md)** | <span className="db-tier t-understand">Understand</span> | What spreads into parameters, what does not, and the stream JUnit closes for you |
| 9 | **[@FieldSource](04c-fieldsource.md)** | <span className="db-tier t-understand">Understand</span> | A constant instead of a call — and why a field may not be a `Stream` |
| 10 | **[@EnumSource](05-enumsource.md)** | <span className="db-tier t-understand">Understand</span> | The only source that updates itself when someone adds a constant |
| 11 | **[@ArgumentsSource](06-argumentssource.md)** | <span className="db-tier t-understand">Understand</span> | Every built-in source is one; the 6.0 signature change is the trap |
| 12 | **[Display names](07-display-names.md)** | <span className="db-tier t-understand">Understand</span> | The name identifying the broken case is the deliverable, not a cosmetic |
| 13 | **[Quoted arguments](07b-quoted-arguments.md)** | <span className="db-tier t-understand">Understand</span> | 6.0 rewrote how an argument renders — and broke every tool that parsed display names |
| 14 | **[Naming arguments](07c-naming-arguments.md)** | <span className="db-tier t-understand">Understand</span> | `named`, `argumentSet` and CSV headers move the naming to where the data is |
| 15 | **[Project-wide defaults](07d-project-wide-display-names.md)** | <span className="db-tier t-understand">Understand</span> | One properties line improves every legacy parameterized test in the repository |
| 16 | **[Implicit conversion](08-conversion-and-aggregation.md)** | <span className="db-tier t-understand">Understand</span> | Widening and a fixed table of ~30 converters, driven by the declared parameter type |
| 17 | **[Aggregation](08b-aggregation.md)** | <span className="db-tier t-understand">Understand</span> | `ArgumentsAccessor` collapses a seven-column row — and stops being an indexed parameter |
| 18 | **[Parameterized classes](08c-parameterized-classes.md)** | <span className="db-tier t-understand">Understand</span> | Every `@Test` in a class against every row — experimental in 6.0.3, and in a surprising package |
| 19 | **[Constructor injection](08d-parameterized-class-injection.md)** | <span className="db-tier t-understand">Understand</span> | One annotated field anywhere in the hierarchy throws the switch, silently |
| 20 | **[Field injection](08e-parameterized-class-field-injection.md)** | <span className="db-tier t-understand">Understand</span> | Required under `PER_CLASS`, and its index bookkeeping reaches across the hierarchy |
| 21 | **[Parameterized class lifecycle](08f-parameterized-class-lifecycle.md)** | <span className="db-tier t-understand">Understand</span> | The only hooks that can see the argument set they are setting up for |
| 22 | **[Invocation hook ordering](08g-invocation-hook-ordering.md)** | <span className="db-tier t-understand">Understand</span> | Deliberately non-obvious, explicitly unpaired, and inverted for superclasses |
| 23 | **[Argument lifetime](08h-argument-lifetime.md)** | <span className="db-tier t-understand">Understand</span> | An `AutoCloseable` argument is closed for you — right per row, wrong for a constant |
| 24 | **[Custom aggregators](08i-custom-aggregators.md)** | <span className="db-tier t-understand">Understand</span> | Extract the unpacking once — and the class changed shape in JUnit 6 |
| 25 | **[Argument count validation](08j-argument-count-validation.md)** | <span className="db-tier t-understand">Understand</span> | Extra arguments are discarded by default; the properties line that fixes it is the topic's best setting |
| 26 | **[Fallback conversion](08k-fallback-conversion.md)** | <span className="db-tier t-understand">Understand</span> | JUnit reaches into your production code — and a second overload switches it off |
| 27 | **[Explicit conversion](08l-explicit-conversion.md)** | <span className="db-tier t-understand">Understand</span> | The only conversion visible at the call site, plus the declaration and instantiation rules |
| 28 | **[Writing a converter](08m-writing-a-converter.md)** | <span className="db-tier t-understand">Understand</span> | Three base classes; almost every mistake is picking the wrong rung |
| 29 | **[Null and conversion failure](08n-null-and-conversion-failure.md)** | <span className="db-tier t-understand">Understand</span> | A converter is handed `null` on purpose, and its message is the whole report |
| 30 | **[Annotation-driven converters](08o-annotation-driven-converters.md)** | <span className="db-tier t-understand">Understand</span> | `@ConvertWith` on your own annotation — how JUnit ships its only built-in converter |
| 31 | **[When not to parameterize](09-when-not-to-parameterize.md)** | <span className="db-tier t-understand">Understand</span> | A branch-selecting column, and the `expected` cell that means "and this one throws" |
| 32 | **[When the table stops being data](09b-when-the-table-stops-being-data.md)** | <span className="db-tier t-understand">Understand</span> | A column of prose and a column of dashes — separate rules sharing a signature |
| 33 | **[The source that grew logic](09c-the-source-that-grew-logic.md)** | <span className="db-tier t-understand">Understand</span> | A loop, a filter, a computed expectation, and an index that means nothing |
| 34 | **[Setup drift and computed expectations](09d-setup-drift-and-computed-expectations.md)** | <span className="db-tier t-understand">Understand</span> | A column of lambdas, and the test that re-implements the code it checks |
| 35 | **[When a big table is right](09e-when-a-big-table-is-right.md)** | <span className="db-tier t-understand">Understand</span> | The honest counter-case — four questions, and five places a long table wins |
| 36 | **[The review checklist](10-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | The report, the rows that pass wrongly, and the source |
| 37 | **[Checklist: data and shape](10b-checklist-data-and-shape.md)** | <span className="db-tier t-understand">Understand</span> | Null and empty, silent conversions, selection-not-data, and the two-minute pass |

## The six things this topic is really about

1. **The name of the failing row is the product.** A parameterized failure that says
   `[4] com.acme.Order@6d06d69c` has cost the reader more than a copy-pasted test would have.
   `named`, `argumentSet` and CSV headers exist for exactly that ([07c](07c-naming-arguments.md)).
2. **Silent discarding.** Extra arguments a method does not declare are dropped without a word, so
   deleting a parameter leaves a green test that no longer checks what it carried
   ([08j](08j-argument-count-validation.md)).
3. **Conversion happens three ways and only one is visible.** The implicit table, the reflective
   fallback into *your production code*, and `@ConvertWith`. The middle one is the only mechanism
   in Jupiter that somebody else's refactoring can switch off ([08k](08k-fallback-conversion.md),
   [08l](08l-explicit-conversion.md)).
4. **`null` and `""` are not the same, and neither is `"   "`.** An unquoted empty CSV cell is
   `null`; a quoted one is an empty string; blank strings you list yourself
   ([03](03-csvsource.md), [02b](02b-null-and-empty.md)).
5. **A column that steers the method body is a test name.** Six distinct shapes of this, each with
   the rewrite shown ([09](09-when-not-to-parameterize.md) onwards).
6. **Length is never the finding.** A two-hundred-row conformance table with written-down
   expectations is the best test in the file, and splitting it is a real way to do damage
   ([09e](09e-when-a-big-table-is-right.md)).

## What changed in JUnit 6 — the pages that say so

- **Display-name rendering** was rewritten: arguments are quoted, control characters escaped, and
  rendering happens *before* conversion ([07b](07b-quoted-arguments.md)).
- **`ArgumentsProvider`'s signature changed** ([06](06-argumentssource.md)).
- **`ArgumentsAggregator` grew a `FieldContext` overload**, and so did `ArgumentConverter` —
  `EXPERIMENTAL` in both cases ([08i](08i-custom-aggregators.md),
  [08m](08m-writing-a-converter.md)).
- **Fallback conversion now accepts `CharSequence` factories**, which can *remove* a conversion
  that worked under 5.x ([08k](08k-fallback-conversion.md)).
- **`@CsvSource` moved from univocity-parsers to FastCSV**, tightening several parse rules
  ([03](03-csvsource.md)).
- **`Locale` conversion changed** ([08](08-conversion-and-aggregation.md)).

## Where this connects

- **01 · JUnit 5** *(topic index not written yet)* owns the engine — lifecycle, assertions,
  `assertThrows`, extensions and parallel execution. It names `@ParameterizedTest` and hands off
  here.
- **[02 · AssertJ](../02-assertj/README.md)** owns assertion style. Its argument that the failure
  message is the product is the same argument this topic makes about display names, one level up.
- **04 · Mockito** *(topic index not written yet)* owns mocking. A table of stubbed responses is a
  common and often correct use of this topic.
- **08 · Test data patterns** *(not written yet)* owns builders, object mothers and fixtures —
  which is what replaces a sparse table's `null` columns
  ([09b](09b-when-the-table-stops-being-data.md)).
- **10 · Property-based testing** *(not written yet)* is where "generated inputs, invariant
  assertions" becomes a discipline rather than an exception
  ([09c](09c-the-source-that-grew-logic.md)).

{/* FOOTER */}
