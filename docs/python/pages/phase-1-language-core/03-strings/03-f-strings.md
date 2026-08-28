---
title: "f-strings: interpolation that is compiled, not parsed — and the one place you must not use them"
sidebar_label: "3 · f-strings"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference
> §2.4.3 [f-strings](https://docs.python.org/3.14/reference/lexical_analysis.html#f-strings),
> [PEP 498](https://peps.python.org/pep-0498/) (literal string interpolation),
> [PEP 701](https://peps.python.org/pep-0701/) (syntactic formalisation, 3.12),
> [What's New in Python 3.8](https://docs.python.org/3.14/whatsnew/3.8.html)
> (the `=` debug specifier), and the
> [`logging`](https://docs.python.org/3.14/library/logging.html) documentation.
> Target: **CPython 3.14**.

**An f-string is not a string with placeholders — it is syntax. The expressions
inside the braces are compiled into the surrounding code and evaluated where
the literal appears, which is why f-strings are the fastest interpolation
Python has, why they cannot be stored in a config file and filled in later, and
why passing one to `logging` or to a database cursor is a bug rather than a
style choice. Everything good and everything dangerous about them follows from
"it is compiled, not parsed".**

## The basic form

```python
name = "Ada"
count = 3
f"{name} has {count} messages"        # "Ada has 3 messages"
f"{count * 2}"                        # any expression, not just a name
f"{user.email}"                       # attribute access
f"{items[0]}"                         # subscription
f"{fetch_total():.2f}"                # a call, plus a format spec
```

Prefixes are case-insensitive and combinable: `f`, `F`, `rf`, `fr`, `Rf` are
all valid. `rf"..."` gives you a raw f-string, which is what you want for
regular expressions with interpolated parts.

A literal brace is doubled:

```python
f"{{literal braces}} and {name}"      # "{literal braces} and Ada"
```

Adjacent literals still concatenate, and an f-string may sit next to a plain
one — the f-ness applies per literal:

```python
msg = ("Dear " f"{name},\n"
       "Your order shipped.")
```

## The three optional parts of a replacement field

After the expression, a replacement field may carry — in this order — a **debug
specifier**, a **conversion**, and a **format spec**:

```python
f"{value = !r:>10}"
#       ^   ^    ^
#       |   |    format spec  → passed to format()
#       |   conversion        → !s (str), !r (repr), !a (ascii)
#       debug specifier       → prints "value = " before the result
```

### `=` — self-documenting expressions (3.8)

```python
total = 42.5
f"{total=}"              # "total=42.5"
f"{total = }"            # "total = 42.5"  — whitespace is preserved verbatim
f"{total*2 = }"          # "total*2 = 85.0" — the source text, then the value
```

The text left of the `=` is the *source* of the expression, reproduced exactly
as written. This is the fastest debugging tool in the language and belongs in
throwaway prints, not in user-facing output. Note that `=` defaults the
conversion to `!r` when no format spec is given — which is what you want, since
it makes `""` and `" "` distinguishable.

### `!s`, `!r`, `!a` — conversions

```python
s = "line\n"
f"{s}"                   # the raw value, newline and all
f"{s!r}"                 # "'line\\n'" — quoted, escapes visible
f"{s!a}"                 # like !r but escapes non-ASCII too
```

`!r` is the right default for **anything untrusted in a log line**. A value of
`""` or `"  "` or `"admin\n[INFO] fake line"` is invisible or actively
misleading without it.

### `:spec` — the format spec

Everything after the colon is handed to `format()` as the format spec — the
mini-language covered in [the next chunk](03c-the-format-spec-mini-language.md).
The spec may itself contain a replacement field, which is how you compute a
width at runtime:

```python
width = 12
f"{name:>{width}}"       # right-aligned in a width chosen at run time
f"{value:.{places}f}"    # precision from a variable
```

## What PEP 701 changed in 3.12

Before 3.12 an f-string was parsed by a separate, restricted mini-parser. The
docs record the change: *"Many restrictions on expressions within f-strings have
been removed. Notably, nested strings, comments, and backslashes are now
permitted."*

```python
# All of these are syntax errors before 3.12 and legal from 3.12 onward:
f"{d["key"]}"                    # same quote type inside the expression
f"{'\n'.join(lines)}"            # a backslash escape inside the expression
f"{value  # why this value
  }"                             # a comment inside a replacement field
```

Two consequences worth holding:

- **The old workaround is still correct code.** `f"{d['key']}"` with the inner
  quotes swapped works on every version, and is what you write if the file must
  run on 3.11 or older. Do not "modernise" a library's f-strings unless its
  minimum supported version is 3.12.
- **Nesting is unbounded in CPython** but the docs advise portability limits:
  *"Portable Python programs should not use more than 5 levels of nesting."*
  Any f-string approaching that is unreadable anyway.

Newlines inside a replacement field are allowed in both single- and
triple-quoted f-strings since 3.12, and *"Everything that comes after a `#`
inside a replacement field is a comment (even closing braces and quotes)"* —
which means an unterminated comment inside a brace swallows the rest of the
expression.

## The walrus inside an f-string

An assignment expression works, and needs its own parentheses — this is a
documented example:

```python
f'{(half := 1/2)}, {half * 42}'      # '0.5, 21.0'
```

Useful for printing a value you also want to keep; a smell if the reader has to
hunt inside a string to find where a name was bound. See
[Truthiness and the walrus](../05-truthiness.md).

## Gotchas

### The pre-3.12 quote collision
**Symptom.** `SyntaxError: f-string: unmatched '['` on 3.11 for code that runs
on 3.12.
**Cause.** Reusing the outer quote type inside a replacement field became legal
only in 3.12 (PEP 701).
**Fix.** Swap the inner quotes — `f"{d['key']}"` — which is valid everywhere.

### A `#` inside a replacement field
**Symptom.** An f-string that looks complete raises a syntax error about an
unterminated literal.
**Cause.** Since 3.12, everything after `#` inside a replacement field is a
comment *including closing braces and quotes*, so the field never closes.
**Fix.** Put the comment outside the string, or delete it.

### `f"{x}"` where `str(x)` would do
**Symptom.** Review noise; occasionally a subtle difference.
**Cause.** `f"{x}"` calls `format(x, "")`, which is `x.__format__("")` — not
`str(x)`. For most types these agree, but a class with a custom `__format__`
can differ, and for `Decimal` the empty spec goes through `__format__`.
**Fix.** Use `str(x)` when you mean `str(x)`; use the f-string when you are
building a larger string.

### An f-string with no replacement field
**Symptom.** `ruff` flags `F541`.
**Cause.** `f"hello"` is just `"hello"` with a prefix that misleads the next
reader into thinking something is interpolated.
**Fix.** Drop the `f`.

## Interview questions

**Q: What is an f-string, mechanically?**
Syntax, not a string method. The expressions inside braces are compiled into
the surrounding code and evaluated at the point the literal appears, then
passed through `format()` with the given spec. There is no runtime parse of the
literal, which is why it is the fastest form and why it cannot be deferred.

**Q: What did PEP 701 change, and in which version?**
Python 3.12. f-strings became part of the ordinary grammar rather than being
handled by a separate parser, which legalised reusing the outer quote type
inside a replacement field, backslashes in the expression, comments, newlines
in single-quoted f-strings, and arbitrary nesting.

**Q: What does `f"{value=}"` do and when was it added?**
Python 3.8. It emits the *source text* of the expression, then `=`, then the
value — defaulting to `!r` when no format spec is given, so whitespace and
empty strings stay visible. It is a debugging tool.

**Q: `!s`, `!r`, `!a` — what are they and which belongs in a log line?**
Conversions applied before formatting: `str()`, `repr()` and `ascii()`
respectively. `!r` belongs in log lines carrying untrusted values, so that an
empty string, trailing whitespace or an embedded newline is visible instead of
silently reshaping the log.

**Q: Can a format spec be computed at runtime?**
Yes — the spec may contain replacement fields: `f"{name:>{width}}"` and
`f"{x:.{places}f}"`.

**Q: Is `f"{x}"` the same as `str(x)`?**
Not quite. `f"{x}"` is `format(x, "")`, which calls `x.__format__("")`. For
types with a custom `__format__` the two can differ. `str(x)` calls
`__str__`.

**Q: How do you put a literal brace in an f-string?**
Double it: `f"{{}}"` produces `{}`.

**Q: Why does `f"{'\n'.join(x)}"` fail on 3.11?**
Backslashes were not permitted inside replacement fields before 3.12. The
portable workaround is to bind the separator first:
`sep = "\n"` then `f"{sep.join(x)}"`.

---

← Prev: [Replacing, case and classification](02b-replacing-case-and-classification.md) · Index: [Strings](README.md) · Next → [When not to use an f-string](03b-when-not-to-use-an-f-string.md)
