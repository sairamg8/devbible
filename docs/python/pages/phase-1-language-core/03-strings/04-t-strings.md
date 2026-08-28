---
title: "t-strings: interpolation that hands you the pieces before they are joined"
sidebar_label: "4 · t-strings (3.14)"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [PEP 750 — Template Strings](https://peps.python.org/pep-0750/),
> the Python 3.14 Language Reference
> §2.4.4 [t-strings](https://docs.python.org/3.14/reference/lexical_analysis.html#t-strings),
> and the
> [`string.templatelib`](https://docs.python.org/3.14/library/string.templatelib.html)
> library documentation. Target: **CPython 3.14** — this feature does not exist
> before 3.14.

**New in Python 3.14. A t-string looks exactly like an f-string with a `t`
prefix, and evaluates to something else entirely: not a `str`, but a
`string.templatelib.Template` holding the literal text and the interpolated
values as separate objects. That separation is the whole feature. Every
injection bug in the previous chunks — SQL, HTML, shell — exists because an
f-string joins trusted template and untrusted value into one indistinguishable
string before any library can tell them apart. A t-string hands the library the
pieces.**

## The syntax is the f-string syntax

```python
name = "world"
f"Hello {name}"            # str: "Hello world"
t"Hello {name}"            # Template: the pieces, not the result
```

Everything an f-string's replacement field accepts, a t-string accepts:
expressions, the `=` debug specifier, `!r`/`!s`/`!a` conversions, and format
specs. What differs is only what the literal evaluates *to*.

The PEP is explicit: *"Template strings evaluate to an instance of a new
immutable type, `string.templatelib.Template`."*

## What a `Template` holds

Iterating a `Template` yields the static string pieces and `Interpolation`
objects in source order. Each `Interpolation` carries four attributes:

| Attribute | Holds |
|---|---|
| `value` | The evaluated result of the expression |
| `expression` | The original source text of the expression |
| `conversion` | `"r"`, `"s"`, `"a"` or `None` |
| `format_spec` | The text after the colon, as a string |

The canonical processing example from the PEP:

```python
from string.templatelib import Template, Interpolation

def lower_upper(template: Template) -> str:
    """Render static parts lowercased and interpolations uppercased."""
    parts: list[str] = []
    for item in template:
        if isinstance(item, Interpolation):
            parts.append(str(item.value).upper())
        else:
            parts.append(item.lower())
    return "".join(parts)

name = "world"
assert lower_upper(t"HELLO {name}") == "hello WORLD"
```

The key move is `isinstance(item, Interpolation)`. The function knows, for
every fragment, whether it came from the programmer's source or from a value —
which is precisely the knowledge an f-string destroys.

## Why this exists

PEP 750's motivation is blunt about the gap: *"f-strings provide no way to
intercept and transform interpolated values before they are combined into a
final string."* The consequence it names is injection — "SQL injection" and
"cross-site scripting (XSS)" — because a library receiving an f-string's output
has no way to escape only the parts that needed escaping.

Consider the shape of the problem:

```python
# f-string: the library receives one string and cannot tell the halves apart
query = f"SELECT * FROM users WHERE email = '{email}'"
run(query)

# t-string: the library receives the template and the value separately
run(t"SELECT * FROM users WHERE email = {email}")
```

In the second form a database library can walk the `Template`, emit the static
text verbatim, and turn each `Interpolation` into a bound parameter — producing
a parameterised query from syntax that reads like interpolation. The same
pattern gives an HTML library autoescaping that cannot be forgotten, because
the escaping decision is made by the library rather than by the author of each
call site.

## What a `Template` is not

- **It is not a `str`.** `print(t"hi {name}")` does not print `"hi world"`, and
  `t"..." + "..."` is not string concatenation. A `Template` must be *processed*
  by a function that understands it.
- **There is no `str()` shortcut on purpose.** Making `str(template)` render
  the naive joined form would reintroduce exactly the hazard the type exists to
  prevent, and would let a `Template` slip into an f-string unnoticed.
- **It is not a replacement for f-strings.** For a log message, a filename, a
  human-readable line — anywhere the result is text and stays text — the
  f-string is still the right and faster tool.

## Where it stands in 2026

t-strings are the *language* half of the feature. The ecosystem half — database
drivers, HTML template engines and shell wrappers that accept a `Template` — is
what makes them useful, and that adoption is in progress rather than complete.
Treat this chunk at **recognition level**: know what a `t` prefix means when you
see one, know why it is not an f-string, and know that a library asking for a
`Template` is asking for the safe form. Do not rewrite working parameterised
queries into t-strings until the driver you use documents support.

Anything that must run on 3.13 or earlier cannot use them at all: a `t` prefix
is a `SyntaxError` there, and a `SyntaxError` is raised at *import* time, so it
cannot be guarded with a version check inside the module. Isolate the code in a
separate module imported conditionally if you ever need both.

## Gotchas

### Expecting a t-string to be a string
**Symptom.** `TypeError` when concatenating, or a `Template` object appearing
in output where text was expected.
**Cause.** `t"..."` evaluates to `string.templatelib.Template`, not `str`. It
has no implicit text rendering — deliberately.
**Fix.** Use an f-string when you want text; pass the `Template` to a function
that processes it when you want safety.
```python
message = f"Hello {name}"                   # text
run_query(t"SELECT ... WHERE id = {id}")    # processed by the driver
```

### Reaching for a t-string with a library that does not accept one
**Symptom.** The driver stringifies the `Template` or raises, and either way the
safety you were reaching for is not there.
**Cause.** t-strings are a language feature; the escaping lives in whichever
library consumes the `Template`. A driver that has not adopted PEP 750 gains
nothing.
**Fix.** Keep using the library's own parameter binding until it documents
`Template` support.

### A `t` prefix in code that must run on 3.13
**Symptom.** `SyntaxError` on import, on a machine that never runs the affected
function.
**Cause.** Syntax errors are raised when the module is compiled, not when the
line executes, so `if sys.version_info >= (3, 14):` around the code does not
help.
**Fix.** Put the 3.14-only code in its own module and import it conditionally.

## Interview questions

**Q: What does a t-string evaluate to?**
An instance of `string.templatelib.Template` — an immutable object holding the
static string pieces and the interpolations separately. Not a `str`.

**Q: What does an `Interpolation` carry?**
Four attributes: `value` (the evaluated expression), `expression` (its source
text), `conversion` (`"r"`, `"s"`, `"a"` or `None`) and `format_spec` (the text
after the colon).

**Q: Why was PEP 750 accepted — what problem does it solve that f-strings
cannot?**
f-strings join the trusted template and the untrusted values into one string
before any library sees them, so escaping has to be done correctly at every
call site by hand. That is the mechanism behind SQL injection and XSS. A
t-string defers the join, so the consuming library can escape or bind exactly
the interpolated parts and emit the static text verbatim.

**Q: Can you `print()` a t-string?**
You can, but you get the `Template`'s repr, not the interpolated text. There is
no automatic rendering, and that omission is intentional — an implicit `str()`
would let a `Template` silently degrade into the unsafe form.

**Q: Should you replace your f-strings with t-strings?**
No. Use t-strings only where the result is embedded in another language and the
consuming library supports them. For text that stays text, f-strings remain
correct and faster.

**Q: How do you write code using t-strings that also runs on 3.13?**
You cannot, in the same module — a `t` prefix is a `SyntaxError` at compile
time, so a runtime version guard is too late. Isolate it in a separate module
and import it conditionally.

**Q: In one sentence, how does a database driver use a `Template`?**
It iterates the template, appends the static pieces to the SQL text and each
`Interpolation.value` to the parameter list with a placeholder in its position,
producing a parameterised query from interpolation-shaped syntax.

---

← Prev: [`__format__`, the protocol behind the spec](03d-the-format-protocol.md) · Index: [Strings](README.md) · Next → [`bytes` vs `str`](../04-bytes-and-encoding.md)
