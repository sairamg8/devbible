---
title: "A stray comma turns a value into a 1-tuple and an assertion into a permanent pass — valid programs both, and only one of them warns you"
sidebar_label: "5b · Trailing-comma bugs"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference —
> [Expression lists](https://docs.python.org/3.14/reference/expressions.html#expression-lists)
> and [the `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement);
> [PEP 8](https://peps.python.org/pep-0008/#when-to-use-trailing-commas);
> and CPython 3.14 [`Python/codegen.c`](https://github.com/python/cpython/blob/3.14/Python/codegen.c)
> for the `assert` warning text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**Because the comma builds the tuple, a comma typed in the wrong place does not produce a
syntax error — it produces a *different, valid program*. `x = 1,` is a tuple that will fail
arithmetic three frames away. `assert (cond, "msg")` is an assertion that can never fail.
`RETRIES = 3,` in a class body poisons every `range(RETRIES)` downstream. Exactly one of
these warns you at compile time; the rest are found in production. The related family —
APIs that *require* a tuple, and break when you forget one — is
[5c · When a library requires the tuple](05c-when-a-library-requires-the-tuple.md).**

## 1 · `x = 1,` — the value that quietly became a tuple

```python
timeout = 30,          # <- a comma, not a semicolon typo you will notice
connect(timeout=timeout)
```

`timeout` is `(30,)`. Nothing raises here; it raises three frames down, in whatever code
does arithmetic on it, with a message about `tuple` and `int` that names neither this line
nor the comma.

The rule that makes it legal:

> *"A trailing comma is required only to create a one-item tuple, such as ``1,``; it is
> optional in all other cases. A single expression without a trailing comma doesn't create
> a tuple, but rather yields the value of that expression."* —
> [Expression lists](https://docs.python.org/3.14/reference/expressions.html#expression-lists)

**Where it comes from in real code:** a multi-line list or dict that someone converted to
a single value and left the comma behind; a `return value,` copied from a function that
used to return two things; a `black`-formatted call where a line got merged.

**How to catch it:** a type annotation turns it into a static error rather than a runtime
one.

```python
timeout: int = 30,     # a type checker flags this: tuple[int] is not int
```

## 2 · `assert (cond, "message")` — the assertion that always passes

This is the one Python warns about, and the warning is worth knowing verbatim. CPython
3.14's `codegen_assert()` in `Python/codegen.c` opens with the comment *"Always emit a
warning if the test is a non-zero length tuple"* and emits:

**`SyntaxWarning: assertion is always true, perhaps remove parentheses?`**

```python
# WRONG — a non-empty 2-tuple is always truthy, so this never fails
assert (response.status_code == 200, f"got {response.status_code}")

# RIGHT — the message is the assert statement's second operand
assert response.status_code == 200, f"got {response.status_code}"
```

🔴 **A `SyntaxWarning` is not an error, and warnings are routinely filtered out of CI
output.** A test suite full of these is a test suite that asserts nothing. Turn the warning
into a failure while you clean up:

```bash
python -W error::SyntaxWarning -m pytest
```

⚠️ The warning fires only for a **non-empty** tuple, per that source comment — `assert ()`
is always false and gets no warning, because it is not the mistake this check is for.

## 3 · The stray comma in a class body, config or module constant

```python
class Settings:
    RETRIES = 3,               # (3,) — every `range(RETRIES)` downstream explodes
    TIMEOUT = 30

DEFAULTS = {
    "region": "eu-west-1",
    "retries": 3,
}
REGION = "eu-west-1",          # copied out of the dict, comma came along
```

These survive review because a trailing comma is *correct and encouraged* one line
earlier — inside the dict. PEP 8 draws the line:

> *"Trailing commas are usually optional, except they are mandatory when making a tuple of
> one element. For clarity, it is recommended to surround the latter in (technically
> redundant) parentheses."* —
> [PEP 8 — When to Use Trailing Commas](https://peps.python.org/pep-0008/#when-to-use-trailing-commas)

PEP 8 labels the two spellings explicitly — this is its own example, verbatim:

```python
# Correct:
FILES = ('setup.cfg',)
```
```python
# Wrong:
FILES = 'setup.cfg',
```

Which gives you the review rule: **a lone trailing comma at the end of a scalar assignment
is either a bug or must be parenthesised.** `REGION = ("eu-west-1",)` says "I meant this";
`REGION = "eu-west-1",` says nothing — and PEP 8 calls the second one wrong even when the
1-tuple was intended.

## 4 · Where a trailing comma is harmless

Not every trailing comma is a hazard. Inside a call, a display, or a parameter list, it is
just punctuation — and a formatter will add it deliberately:

```python
register(
    method="POST",
    path="/orders",
    handler=create_order,      # harmless: this is an argument list, not an expression list
)

SCOPES = [
    "read",
    "write",                   # harmless: a list display
]
```

The distinguishing test is one question: **is the comma inside brackets that already mean
something?** Call parentheses, `[]` displays, `{}` displays and parameter lists all consume
the comma as a separator. A bare expression at statement level does not — there, the comma
builds a tuple.

## Gotchas

**★ Symptom: `TypeError: unsupported operand type(s) for -: 'tuple' and 'int'` far away
from any tuple.** Cause: a scalar assignment ended in a stray comma, so the "number" has
been a 1-tuple since it was defined. Fix: delete the comma, and annotate the name so the
type checker catches the next one.

```python
timeout: int = 30            # not `30,`
```

**★ Symptom: a test suite passes with assertions that should be failing.** Cause:
`assert (cond, "message")` asserts a non-empty tuple, which is always truthy. Fix: remove
the parentheses so the message is the assert's second operand — and make the existing
warning fatal so the rest of the suite is audited.

```python
assert response.status_code == 200, f"got {response.status_code}"
```
```bash
python -W error::SyntaxWarning -m pytest
```

**Symptom: a class attribute is a tuple everywhere it is used.** Cause: a trailing comma
copied out of a dict or list literal into a scalar assignment. Fix: delete it, or
parenthesise if a 1-tuple really was intended — PEP 8 asks for exactly that.

```python
RETRIES = 3          # scalar
RETRIES = (3,)       # deliberate 1-tuple, and it looks deliberate
```

**Symptom: `black` or `ruff format` reformatted a function call onto several lines after
you added a comma.** Cause: the *magic trailing comma* convention — a trailing comma in a
call or collection is read as "keep this exploded". This is harmless punctuation inside
brackets, not a tuple. Fix: nothing to fix; just do not carry that habit to a bare
assignment, where the comma changes the value.

**Symptom: an `assert ()` produced no warning and always fails.** Cause: the compiler warns
only for a *non-empty* tuple — CPython's own comment is *"Always emit a warning if the test
is a non-zero length tuple"*. An empty tuple is falsy, so it is not the "always true"
mistake. Fix: whatever you meant; `assert ()` is never it.

## Interview questions

**★ Why does `assert (x == 1, "message")` never fail?**
Because the parentheses make the whole thing one operand — a 2-tuple — and a non-empty
tuple is truthy, so the assertion always passes. The `assert` statement takes a condition
and an *optional second operand* separated by a comma at statement level; putting
parentheses around both collapses them into a single tuple expression. CPython warns about
it — `SyntaxWarning: assertion is always true, perhaps remove parentheses?` — but a
warning is not a failure and CI usually swallows it. Run the suite with
`-W error::SyntaxWarning` once and you will find out whether you have any.

**Why is a trailing comma correct inside a list literal and a bug in an assignment?**
Because the brackets change what the comma means. Inside `[...]`, `{...}`, a call's
parentheses or a parameter list, the comma is a separator and a trailing one is
allowed-and-ignored — which is why formatters add it. At statement level there is no
enclosing construct to consume it, so the rule from the expression-list grammar applies:
*"a trailing comma is required only to create a one-item tuple."* Same character, two
grammars.

**How would you stop this class of bug in a codebase?**
Three cheap mechanisms, in order of effectiveness. Annotate scalars — a type checker
reports `tuple[int]` where `int` was declared, which catches the stray comma at the
definition rather than at the use. Make `SyntaxWarning` fatal in CI, which catches the
`assert` case for the entire repository in one run. And prefer f-strings everywhere except
`logging`, which removes the `%`-formatting case entirely.

**PEP 8 says to parenthesise a one-element tuple. Why, when the parentheses do nothing?**
Because they carry intent to the reader, which the comma alone does not. PEP 8's wording is
*"for clarity, it is recommended to surround the latter in (technically redundant)
parentheses"* — the parser does not need them; the reviewer trying to decide whether the
comma is deliberate does. It converts an ambiguous line into an unambiguous one at zero
runtime cost.

---

← [The comma makes the tuple](05-the-comma-makes-the-tuple.md) · [Topic index](README.md) · Next → [When a library requires the tuple](05c-when-a-library-requires-the-tuple.md)
