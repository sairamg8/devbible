---
title: "AttributeError covers assignment as well as reference and is exactly what a misspelling produces, ValueError is defined residually as the class for anything without a better class, and Exception includes the AssertionError your test was counting on"
sidebar_label: "06e · Attribute, value and Exception"
sidebar_position: 145
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html) reference —
> the `AttributeError`, `ValueError`, `IndexError` and `Exception` entries, quoted
> verbatim below including their parentheticals. Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**Three classes people catch because they name the thing that went wrong, and one they
catch because they have run out of ideas. Each of the three has a parenthetical in its
reference entry that changes what it covers: `AttributeError` includes *assignment*, so a
read and a write are one class; `IndexError` explicitly routes a wrong-typed index to
`TypeError`, so the obvious handler is incomplete; and `ValueError` is defined as the
class for a bad value *"not described by a more precise exception"*, which makes it the
standard library's shared bucket. `Exception` is the whole non-exiting hierarchy — which
is why adding one to a helper can turn a failing test green.**

## `AttributeError`: read and write are the same class

> *"Raised when an attribute reference (see Attribute references) or assignment fails.
> (When an object does not support attribute references or attribute assignments at all,
> `TypeError` is raised.)"*

Two consequences for width. First, **a failed `obj.x` and a failed `obj.x = v` are
indistinguishable**, so a suite containing both cannot tell a missing attribute from a
frozen or slotted object rejecting a write. Second, `AttributeError` is what a
misspelling produces, so `except AttributeError` around anything but a single deliberate
access is a typo-swallower:

```python
# 🔴 One clause, three accesses, and a misspelling anywhere is "not configured".
try:
    return config.database.replica_host
except AttributeError:
    return config.database.host

# One access, default included, nothing swallowed.
db = config.database                        # a missing `database` is a real error
return getattr(db, "replica_host", db.host)
```

`hasattr` is the LBYL spelling of the same test and has its own approximation problems —
[04 · `hasattr` is EAFP in disguise](04-hasattr-is-eafp-in-disguise.md).

## `ValueError` and `Exception`: the two you almost never want

> `ValueError` — *"Raised when an operation or function receives an argument that has the
> right type but an inappropriate value, and the situation is not described by a more
> precise exception such as `IndexError`."*

Read *"and the situation is not described by a more precise exception"* as a warning
label. `ValueError` is the standard library's default for "your value is wrong", which
means dozens of unrelated functions raise it, and several library-specific classes
subclass it. One `except ValueError` in a suite containing two conversions is axis 3 and
axis 1 at once.

> `Exception` — *"All built-in, non-system-exiting exceptions are derived from this
> class. All user-defined exceptions should also be derived from this class."*

That is the entire hierarchy except the exiting ones — including every `TypeError`,
`NameError` and `AttributeError` your own code can produce. It has exactly one
legitimate use, at a process boundary, and that is
[06g · Width at a boundary](06g-width-at-a-boundary.md). Topic 11's
[04b · The bare `except`](../11-exceptions/04b-the-bare-except.md) is the reference for
the `Exception` / `BaseException` split.

## `TypeError`: the class that means "you called it wrong"

`TypeError` is not on most people's list of broad classes, and it belongs there for a
different reason: it is what Python raises when a *call* is malformed, so catching it
converts your own refactors into data errors. Two entries in the reference make this
concrete without ever mentioning calls.

`IndexError` again:

> *"(Slice indices are silently truncated to fall in the allowed range; if an index is
> not an integer, `TypeError` is raised.)"*

So `items[key]` where `key` is accidentally a `str` raises `TypeError`, **not**
`IndexError` — an `except IndexError` written to mean "the sequence is short" does not
cover the case where the index itself is wrong, and an `except (IndexError, TypeError)`
written to cover it now also owns every other type error in the suite.

`AttributeError` again:

> *"(When an object does not support attribute references or attribute assignments at
> all, `TypeError` is raised.)"*

Same shape. The failure that looks most like "missing attribute" — asking an object that
has no attribute machinery — is a different class.

```python
# 🔴 Written to mean "this row is short". Also owns every signature error below it.
try:
    label = row[index]
    return format_label(label, style=style)
except (IndexError, TypeError):
    return ""
```

If `format_label` loses its `style` parameter in a refactor, the resulting `TypeError`
becomes an empty label in production instead of a failing import-time smoke test. Split
the block, and let the `TypeError` out:

```python
try:
    label = row[index]                  # the one assumption: this row may be short
except IndexError:
    return ""
return format_label(label, style=style)   # a TypeError here is a bug, and should crash
```

## Gotchas

**★ Symptom: an optional attribute lookup swallows a typo in an attribute name.** Cause:
axis 3 — `except AttributeError` cannot tell `settings.retires` (misspelt) from
`settings.retries` (absent), and it covers every attribute access in the suite. Fix: one
access, with the flag form that never raises.

```python
retries = getattr(settings, "retries", 3)     # one access, default included
```

**★ Symptom: `except AttributeError` around a block that both reads and writes an
attribute fires for the write and reports the read.** Cause: the reference is explicit
that the class covers *"an attribute reference … or assignment"*, so both directions are
one class. Fix: separate them; an assignment failure on a slotted or frozen object is a
programming error, not a missing value.

```python
value = getattr(record, "cached_score", None)     # the optional read
record.cached_score = recompute(record)           # the write: let it raise
```

**Symptom: `except ValueError` in a suite with two conversions reports the wrong field.**
Cause: `ValueError` is the standard library's general "wrong value" class — the reference
says it covers cases *"not described by a more precise exception"* — so it is shared by
`int()`, `float()`, `datetime.strptime`, `json.loads` (via its subclass) and many others.
Fix: one conversion per `try`, each with its own message; the worked version is
[06f · Whose exception is it?](06f-whose-exception-is-it.md).

**Symptom: `except Exception` inside a library function, and callers cannot tell success
from failure.** Cause: the widest possible axis-3 defect, in the one place it is never
acceptable — a library has no idea what recovery its caller wants, and `Exception` is
*"all built-in, non-system-exiting exceptions"*. Fix: let it propagate, or translate it
into the library's own class
([07 · Custom exceptions](../11-exceptions/07-custom-exceptions.md)), and never swallow.

**★ Symptom: a test suite went green after `except Exception` was added to a helper.**
Cause: `AssertionError` is a non-system-exiting exception, so it derives from `Exception`
and a broad handler inside code under test swallows the assertion that was supposed to
fail the test. Fix: never catch `Exception` inside library or application code; if a
boundary genuinely needs it, that boundary must not be inside the code the tests
exercise.

```python
# Was: except Exception: return None      # ate the AssertionError from a stubbed callee
try:
    return parser.parse(raw)
except parser.ParseError:                 # the library's own class
    return None
```

**Symptom: `except AttributeError` around a property access hides an `AttributeError`
raised *inside* the property's body.** Cause: a property runs code, and its own failed
attribute lookup is the same class as the property being absent. Fix: this is the same
defect `hasattr` has, and the treatment is in
[04 · `hasattr` is EAFP in disguise](04-hasattr-is-eafp-in-disguise.md) — access the
attribute once, and keep unrelated work out of the guarded suite.

**Symptom: a handler catches `Exception` to "log and re-raise" and the log fills with
duplicates.** Cause: every frame in the call stack did the same thing, so one failure
produces five identical entries and the innermost frame — the only one with context — is
indistinguishable from the outermost. Fix: log once, at the frame that decides what
happens next; topic 11's
[12 · Logging exceptions](../11-exceptions/12-logging-exceptions.md) states the rule and
the calls.

**★ Symptom: `except ValueError` around a config parse hides a bug in a validator the
parse calls.** Cause: `ValueError` is defined residually — *"an argument that has the
right type but an inappropriate value, and the situation is not described by a more
precise exception"* — so anything in the call tree that decided its input was wrong lands
in the same clause. Fix: define the boundary's own class and translate at it.

```python
try:
    port = int(raw_port)
except ValueError as exc:
    raise ConfigError(f"port is not a number: {raw_port!r}") from exc
# validate_port(port) stays outside: its ValueError is a bug, and should escape
```

**Symptom: `except AttributeError` was added to support "objects that might be `None`",
and now a real `None` bug is invisible.** Cause: `None.anything` raises `AttributeError`,
so the handler doubles as a null check — the two are the same class and cannot be
separated. Fix: check for `None` explicitly, which also tells a type checker what is true
afterwards.

```python
if profile is None:
    return DEFAULT_LOCALE
return profile.locale          # an AttributeError here is a real bug, and should escape
```

[`None` and the no-result contract](../14-none-and-no-result/README.md) is where the
contract question belongs.

## Interview questions

**★ Why is `except AttributeError` more dangerous than it looks?**
Two reasons from one sentence in the reference. It covers *"an attribute reference … or
assignment"*, so reads and writes are one class and a suite containing both cannot tell
them apart. And it is exactly what a misspelled attribute name produces, so any
`AttributeError` handler covering more than one deliberate access is a typo-swallower —
`config.databse.host` becomes "not configured" rather than a crash on the line with the
error in it.

**Why does the documentation's `ValueError` entry effectively warn you off catching it?**
Because it defines the class residually: it is raised for a wrong value *"and the
situation is not described by a more precise exception"*. A class defined as "whatever
does not have a better class" is by construction shared across unrelated failures — every
`int()`, every `strptime`, `json.loads` through its subclass. Catching it says "any wrong
value from anything in this block", which is almost never the assumption you meant.

**★ Why is `except TypeError` almost always a bug rather than a handler?**
Because `TypeError` is what Python raises when a call is malformed — wrong argument
count, wrong argument type, an object that does not support the operation at all. A
handler for it converts your own refactors into data errors: remove a parameter from a
callee and the caller reports "invalid input" instead of crashing. The two places the
reference explicitly routes failures to `TypeError` are both traps of this kind — a
non-integer sequence index, and an object with no attribute machinery — and in both, the
right response is to fix the caller, not to catch.

**★ `except Exception` in a helper made a failing test pass. Explain the mechanism.**
`AssertionError` is a non-system-exiting exception, so it derives from `Exception` —
which the reference defines as the base for *"all built-in, non-system-exiting
exceptions"*. A test asserts, the assertion fails, and a broad handler inside the code
under test absorbs it and returns a default, so the test observes a value rather than a
failure. It is the sharpest available demonstration that `except Exception` catches
things that are not errors in your domain at all.

**Why is `except AttributeError` a bad null check, given that `None.x` does raise it?**
Because it cannot distinguish "the object was `None`" from "the object was fine and the
attribute name is wrong" from "the attribute is a property whose body raised". All three
are `AttributeError`, and only the first has the recovery you wrote. An
`if x is None:` says exactly one thing, costs one line, and — unlike a handler — narrows
the type for a checker, which is the one place LBYL has a clean advantage over EAFP.

**What is the one legitimate use of `except Exception`, and what makes it legitimate?**
A process or task boundary whose job is to keep the process alive: an HTTP request
handler, a queue consumer's per-message wrapper, a scheduler's task runner. It is
legitimate because the handler is not *recovering* — it logs the exception object with
its traceback, translates it into a protocol-level response, and moves on. What
disqualifies every other use is that the handler claims to know what to do about a
failure it cannot name. That distinction is
[06g · Width at a boundary](06g-width-at-a-boundary.md).

---

← Prev: [The lookup classes](06d-the-lookup-classes.md) · Index: [EAFP vs LBYL](README.md) · Next → [Whose exception is it?](06f-whose-exception-is-it.md)
