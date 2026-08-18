---
title: "Text blocks"
sidebar_label: "07 · Text blocks"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against JEP 378 (Text Blocks, final in 15), JLS §3.10.6,
> and the JDK 25 `String` Javadoc (`stripIndent`, `translateEscapes`,
> `formatted`).

**A text block is a multi-line string literal that keeps its content readable:
`"""` delimiters, no `\n` soup, no `\"` escapes around embedded quotes, and a
compiler-defined rule that strips the indentation your source formatting added
while keeping the indentation your *content* means. SQL, JSON and HTML in
Java stopped being punctuation exercises in Java 15 — and the one thing text
blocks deliberately do not do is interpolation.**

## The syntax and the one rule that matters

```java
String query = """
        SELECT o.id, o.total
        FROM orders o
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
        """;
```

Opening delimiter `"""` must be followed by a line terminator — content
starts on the next line. The interesting rule is **incidental vs essential
whitespace**: the compiler finds the minimum indentation across all content
lines *and the line holding the closing delimiter*, and strips exactly that
much from every line.

The practical control this gives you:

- **Closing `"""` flush with the content** → content has zero leading
  indentation. The Java-source indentation was "incidental" — formatting for
  the reader of the *code* — and disappears.
- **Closing `"""` moved left of the content** → the difference stays, as
  real ("essential") indentation in the string. This is how you keep
  indented JSON indented.

```java
String json = """
        {
          "sku": "A-1",
          "qty": 2
        }
        """;      // inner two-space indent preserved; outer stripped
```

Trailing spaces on each line are stripped; each line ends with `\n`; the
final newline before the closing delimiter is part of the content (put the
closing delimiter at the end of the last content line to omit it).

## The escapes you stop and start needing

Inside a text block, `"` needs no escape (only a run of three quotes does —
escape one of them: `\"""`), and literal newlines replace `\n`. Two new
escapes exist *only* in text blocks:

- `\` at end of line — join with the next line, emitting no newline: long
  strings wrapped for source readability without becoming multi-line content.
- `\s` — an explicit space that survives trailing-whitespace stripping:
  needed only when a line must end in significant spaces.

Everything else (`\t`, `\\`, unicode escapes) works as in ordinary literals.
A text block **is a `String`** — same type, same pool and constant-folding
behaviour ([topic 06](06-strings/01-immutability-pool-equality.md)), same
methods, usable anywhere a string literal is.

## No interpolation — on purpose

There is no `${...}` in a text block. Java's string-template preview (JEP
430/459) was **withdrawn** — Java 25 has no interpolation syntax at all
(the [release-model page](../phase-0-platform-jvm/03-release-model.md) tells
that story). The composition options:

```java
String page = """
        <h1>%s</h1>
        <p>%d items</p>
        """.formatted(title, count);
```

`formatted` reads best directly on the block. For SQL, the right answer is
never interpolation anyway — `?` placeholders and a `PreparedStatement`
(**Phase 10's JDBC topic** *(not written yet)*), which is both the injection
defence and the reason SQL text blocks stay static.

## Where they earn their keep

- **SQL in repositories and tests** — real query formatting, copy-pastable
  to and from `psql`.
- **JSON fixtures in tests** — expected payloads readable next to the
  assertion, no quote-escape noise (pairs with Jackson,
  [Phase 7's JSON topic](../phase-7-io-time-stdlib/05-json-jackson/README.md)).
- **Golden files inlined** — small expected outputs, error-message
  templates, HTML snippets.
- Anywhere you previously concatenated lines with `+ "\n"` — that idiom is
  now a review comment.

## Gotchas

**Symptom:** the string arrives with unexpected leading spaces on every line
**Cause:** the closing delimiter sits further left than intended — or one content line is indented less than the rest, making *its* indent the minimum and everyone else's "essential"
**Fix:** align the closing `"""` with the content for zero-indent output; check for a stray under-indented line (often a blank line with spaces). The IDE's text-block highlighting shows the strip margin

**Symptom:** content mixes tabs and spaces and the stripping behaves "randomly"
**Cause:** incidental-whitespace math counts characters, not columns — a tab is one character regardless of display width
**Fix:** don't mix; let the formatter own the file. If a mixed block arrives by paste, normalize it

**Symptom:** the string has a trailing newline the consumer didn't want (a failing exact-match assertion, an extra blank log line)
**Cause:** the closing delimiter on its own line puts a final `\n` in the content
**Fix:** end the last content line with the closing delimiter itself, or `.strip()` when trailing layout is irrelevant to the consumer

**Symptom:** a line that must end in spaces keeps losing them
**Cause:** trailing whitespace is stripped from every text-block line by specification
**Fix:** end the line with `\s` — the escape exists for exactly this

**Symptom:** `${name}` appears verbatim in output
**Cause:** expecting interpolation — other languages' habit; Java's template preview was withdrawn, and text blocks never interpolated
**Fix:** `.formatted(...)`/`String.format`, concatenation, or a real template engine for documents. For SQL: placeholders, never interpolation

**Symptom:** four or more `"` characters needed inside the content break the block
**Cause:** three consecutive unescaped quotes terminate it
**Fix:** escape one quote in the run (`\"""` renders three quotes). Rare outside documents *about* text blocks — but that is exactly what documentation generators emit

## Interview questions

**★ How does Java decide which indentation to remove from a text block?**
The compiler computes the minimum leading whitespace over all non-blank
content lines *plus the closing-delimiter line*, and strips that amount from
each line — that minimum is "incidental" (source formatting); the remainder
is "essential" (content). Moving the closing delimiter left is the standard
way to force extra indentation to survive.

**★ How do you interpolate variables into a text block?**
You don't — no such syntax exists (the string-template preview was withdrawn
without shipping). Use `.formatted(...)` on the block, `String.format`, or
a template engine. For SQL specifically, interpolation is the wrong tool
regardless: `?` placeholders with `PreparedStatement`.

**★ Is a text block a different type from a string?**
No — it is a `String` literal with alternative syntax, a compile-time
constant like any literal: pooled, foldable in constant expressions, and
indistinguishable at run time from the equivalent escaped single-line
literal.

**What do `\` at line end and `\s` do — and why do they exist only in text blocks?**
`\` joins the next line without a newline (wrap long content in source
without changing the string); `\s` is a space that survives the mandatory
trailing-whitespace strip. Both address problems created by text-block line
structure, so ordinary literals never needed them.

**Why do SQL strings and text blocks pair so well in repositories?**
The query reads exactly as it runs — indentation, line breaks, no escape
noise — so it can be copied to a database console and back unchanged. With
placeholders carrying the data, the block stays a static constant, which is
also the injection-safe shape.

**How do you write a text block whose output has no trailing newline?**
Put the closing `"""` at the end of the last content line rather than on its
own line. On its own line, the preceding newline belongs to the content —
the detail exact-match tests discover first.

---

← Prev: [Strings](06-strings/README.md) · Next → [Control flow and `switch` expressions](08-control-flow-switch/README.md)
