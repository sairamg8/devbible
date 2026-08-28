---
title: "A logical line is not a physical line: bracket continuation, the backslash and its four restrictions, and the semicolon that binds tighter than the colon"
sidebar_label: "1e · Line joining and semicolons"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 Language Reference
> [§2.1 Line structure](https://docs.python.org/3.14/reference/lexical_analysis.html#line-structure),
> [§8 Compound statements](https://docs.python.org/3.14/reference/compound_stmts.html),
> [PEP 8](https://peps.python.org/pep-0008/), and CPython 3.14's
> [`Parser/pegen_errors.c`](https://github.com/python/cpython/blob/3.14/Parser/pegen_errors.c).
> Target: **CPython 3.14**.

**One statement, many physical lines: Python offers two mechanisms and they are not
equivalent. The backslash joins lines by deleting a character, which makes it
fragile in a way you cannot see — one trailing space kills it. Brackets suppress the
`NEWLINE` token entirely, which makes them robust, comment-friendly and
indentation-agnostic, and is why PEP 8 names them as the preferred form. The same
suppression is what makes a missing closing bracket report its error dozens of lines
away from the mistake.**

## Explicit line joining with a backslash

> *"Two or more physical lines may be joined into logical lines using backslash
> characters (`\`), as follows: when a physical line ends in a backslash that is not
> part of a string literal or comment, it is joined with the following forming a
> single logical line, deleting the backslash and the following end-of-line
> character."*

And the four restrictions, all in one paragraph of the reference:

> *"A line ending in a backslash cannot carry a comment. A backslash does not
> continue a comment. A backslash does not continue a token except for string
> literals (i.e., tokens other than string literals cannot be split across physical
> lines using a backslash). A backslash is illegal elsewhere on a line outside a
> string literal."*

The backslash must be the final character on the line. A single trailing space after
it makes it not a continuation, and CPython reports
`unexpected character after line continuation character` (the `E_LINECONT` code in
`Parser/pegen_errors.c`) — an error whose cause is invisible in every editor that
does not show trailing whitespace.

There is also a rule specific to indentation, from §2.1.8:

> *"Indentation cannot be split over multiple physical lines using backslashes; the
> whitespace up to the first backslash determines the indentation."*

## Implicit line joining, and why it is the default

> *"Expressions in parentheses, square brackets or curly braces can be split over
> more than one physical line without using backslashes."*

> *"Implicitly continued lines can carry comments. The indentation of the
> continuation lines is not important. Blank continuation lines are allowed. There is
> no NEWLINE token between implicit continuation lines. Implicitly continued lines
> can also occur within triple-quoted strings (see below); in that case they cannot
> carry comments."*

Every clause in that quote is a capability the backslash form lacks: comments
allowed, blank lines allowed, no fragile trailing character. PEP 8 draws the
conclusion:

> *"The preferred way of wrapping long lines is by using Python's implied line
> continuation inside parentheses, brackets and braces."*

> *"Backslashes may still be appropriate at times. For example, long, multiple
> `with`-statements could not use implicit continuation before Python 3.10, so
> backslashes were acceptable for that case."*

Since 3.10 the parenthesised `with` closes that gap:

```python
with (
    open("in.csv", encoding="utf-8") as src,
    open("out.csv", "w", encoding="utf-8") as dst,
):
    dst.write(src.read())
```

The remaining honest use of a backslash is `assert`, whose two operands cannot be
wrapped in one pair of parentheses without turning them into a tuple — a tuple that
is always truthy, so the assertion silently never fires:

```python
assert response.status_code == 200, \
    f"unexpected status {response.status_code}"

# NEVER this — a non-empty tuple is always truthy, so the assert can never fail:
assert (response.status_code == 200,
        f"unexpected status {response.status_code}")
```

When an expression is not already bracketed, add brackets rather than a backslash:

```python
# Redundant parentheses purely to enable continuation — this is idiomatic.
is_eligible = (
    account.is_active
    and account.balance > 0
    and not account.is_frozen
)
```

PEP 8's guidance on how to indent the continuation lines:

> *"Continuation lines should align wrapped elements either vertically using
> Python's implicit line joining inside parentheses, brackets and braces, or using a
> hanging indent."*

> *"[When using a hanging indent] there should be no arguments on the first line and
> further indentation should be used to clearly distinguish itself as a continuation
> line."*

## Semicolons and same-line suites

Both are legal, and both are discouraged by PEP 8: *"Compound statements (multiple
statements on the same line) are generally discouraged."*

The suite grammar permits a header and body on one line —
`suite: stmt_list NEWLINE | ...` — but only for simple statements, and the reference
pins down the precedence:

> *"The semicolon binds tighter than the colon in this context, so that in the
> following example, either all or none of the `print()` calls are executed:"*
>
> ```python
> if x < y < z: print(x); print(y); print(z)
> ```

That is worth knowing precisely because the C-brained reading is wrong: the second
and third `print` are *inside* the `if`, not after it.

The place a one-line suite genuinely earns its keep is a guard clause in a `.pyi`
stub or an interactive `python -c`:

```bash
python -c "import sys; print(sys.version_info)"
```

In a real module, write it out.

## Gotchas

### An unclosed bracket reports the error at the wrong line — or the right one

**Symptom.** A `SyntaxError` on the first line of the *next* function, forty lines
below the mistake.
**Cause.** Inside brackets there is no `NEWLINE` token, so the tokenizer keeps
consuming lines as one logical line until something cannot possibly continue the
expression. The first impossible token is where it complains.
**Fix.** Modern CPython also reports the *opening* bracket. `Parser/pegen_errors.c`
has a dedicated `raise_unclosed_parentheses_error` producing `'%c' was never
closed`, located at the opening bracket's line and column. When you see that
message, trust its location over the one in a stale mental model — and when you see
a plain `invalid syntax` on a line that looks fine, look *upwards* for a bracket.

### `assert` with a parenthesised message never fails

**Symptom.** A test suite that passes no matter what.
**Cause.** `assert (cond, "msg")` asserts a two-element tuple, which is always
truthy. This is the single most expensive consequence of reaching for parentheses to
continue a line.
**Fix.** Use a backslash, or restructure. The compiler does warn: CPython's
`codegen_assert` emits a `SyntaxWarning` reading `assertion is always true, perhaps
remove parentheses?` whenever the assert's test is a non-empty tuple literal — so do
not silence warnings in test runs.

```python
assert cond, "msg"                      # correct
assert (
    cond
), "msg"                                # also correct: parens around the condition only
```

### A backslash inside a string is not a line continuation

**Symptom.** A regex or Windows path silently gains a joined line.
**Cause.** The reference excludes backslashes that are *part of a string literal*
from the joining rule — but a backslash at the end of a line *inside* a string is an
escape of the newline, which removes that newline from the value.
**Fix.** Know which you want, and use a raw string when the backslash is data.

```python
sql = """\
SELECT 1
"""                       # the leading \ removes the newline after the opening quotes

pattern = r"\d+\s*"       # raw: the backslashes are regex syntax, not escapes
```

### Reindenting inside a triple-quoted string changes the string

**Symptom.** A docstring or SQL literal gains or loses leading spaces after you move
a function into a class, and the output changes.
**Cause.** Indentation is only computed *at the beginning of a logical line*, and a
triple-quoted string body is not the beginning of a logical line — those spaces are
string content, and your editor's block-reindent happily rewrites them.
**Fix.** Strip the indentation at use time rather than relying on the source layout.

```python
import inspect
import textwrap

QUERY = textwrap.dedent("""\
    SELECT id, email
    FROM users
    WHERE active = true
""")

def f():
    """First line.

    Indented body — read this with inspect.getdoc(f), which applies
    inspect.cleandoc and removes the common leading whitespace.
    """

doc = inspect.getdoc(f)
```

### A trailing comma plus a missing operator makes a tuple, not an error

**Symptom.** A function receives a tuple where it expected a string, with no syntax
error anywhere.
**Cause.** Implicit continuation makes it easy to drop a `+` or a `,` between two
bracketed items; adjacent string literals concatenate silently, and a stray comma
builds a tuple.
**Fix.** Nothing in the grammar will catch it — this is what `ruff`'s
flake8-implicit-str-concat rules are for: `ISC001` for two literals on one line,
`ISC002` for the multi-line form above.

```python
paths = [
    "/var/log/app",
    "/var/log/db"       # missing comma: this concatenates with the next line
    "/var/log/cache",
]
# paths is now ["/var/log/app", "/var/log/db/var/log/cache"]
```

### A backslash cannot carry a comment, and cannot split a token

**Symptom.** `SyntaxError` when you annotate a continued line, or when you try to
wrap a very long name or number.
**Cause.** The reference is explicit on both: *"A line ending in a backslash cannot
carry a comment"*, and *"A backslash does not continue a token except for string
literals"*. The backslash joins *lines*, not lexemes.
**Fix.** Use brackets, which the reference says *can* carry comments on continuation
lines; and split long string data using adjacent-literal concatenation inside
brackets rather than mid-token.

```python
total = (
    subtotal        # comment here is fine
    + tax
)

message = (
    "the first half of a long sentence "
    "and the second half"          # adjacent literals concatenate at compile time
)
```

## Interview questions

**What are the two ways to continue a statement across lines, and which do you
choose?**
Explicit joining with a trailing backslash, and implicit joining inside `()`, `[]`
or `{}`. Implicit, essentially always: it allows comments and blank lines on the
continuation, imposes no requirement on the continuation lines' indentation, and has
no invisible failure mode. A backslash breaks if a single space follows it. PEP 8
names implicit continuation as preferred and gives the multi-`with` case as the
historical exception, which the parenthesised `with` closed in 3.10; `assert` with a
message is the remaining honest use.

**Why does an unclosed bracket produce an error on a line that looks correct?**
Because there is no `NEWLINE` token between implicitly continued lines. The
tokenizer keeps joining physical lines into one logical line for as long as the
bracket nesting level is above zero, so the parser only notices when it hits a token
that cannot appear in that expression — often a `def` or `return` well below. Recent
CPython mitigates this with a dedicated `'(' was never closed` error located at the
opening bracket.

**Is `if cond: do_a(); do_b()` running `do_b()` conditionally?**
Yes. The reference says the semicolon binds tighter than the colon, so both calls
form the suite and either both run or neither does. It reads like the opposite to
anyone coming from C, which is exactly why PEP 8 discourages the form.

**Can a statement span lines without brackets or a backslash?**
Only through a triple-quoted string, which the reference lists as a third form of
implicit continuation (with the restriction that those lines cannot carry comments).
Otherwise no: a logical line ends at the first physical newline that is not joined by
one of the two rules.

---

← Prev: [Statements vs expressions](01d-statements-vs-expressions.md) · Index: [Syntax and indentation](README.md) · Next → [Comments and encoding](01f-comments-and-encoding.md)
