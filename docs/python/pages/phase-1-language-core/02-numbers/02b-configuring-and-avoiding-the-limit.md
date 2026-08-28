---
title: "Configuring the digit limit is a process-wide security decision, and converting through a power-of-two base is almost always the better answer"
sidebar_label: "2b · Configuring and avoiding it"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 library reference
> [Configuring the limit](https://docs.python.org/3.14/library/stdtypes.html#configuring-the-limit),
> [`sys.set_int_max_str_digits`](https://docs.python.org/3.14/library/sys.html#sys.set_int_max_str_digits),
> [`sys.int_info`](https://docs.python.org/3.14/library/sys.html#sys.int_info),
> and [`PYTHONINTMAXSTRDIGITS`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONINTMAXSTRDIGITS).
> Version spine: **Python 3.14.7**.

**There are three ways to change the integer string conversion limit, they have
a defined precedence, and every one of them changes it for the whole
interpreter — not for a module, not for a thread, not for an async task. That
makes raising the limit a security decision rather than a local fix, which is
why the better answer is nearly always to convert through a base that is
already exempt. And lowering the limit has a failure mode the docs warn about
explicitly: a long decimal literal in any dependency's source becomes a
parse-time error.**

## Three ways, one precedence rule

Before the interpreter starts:

```bash
PYTHONINTMAXSTRDIGITS=640 python3 app.py     # raise or lower it
PYTHONINTMAXSTRDIGITS=0   python3 app.py     # disable the limitation
python3 -X int_max_str_digits=640 app.py
```

The reference resolves the conflict and tells you how to inspect it:

> *"`sys.flags.int_max_str_digits` contains the value of
> `PYTHONINTMAXSTRDIGITS` or `-X int_max_str_digits`. If both the env var and
> the `-X` option are set, the `-X` option takes precedence. A value of `-1`
> indicates that both were unset, thus a value of
> `sys.int_info.default_max_str_digits` was used during initialization."*

From code:

```python
import sys

sys.set_int_max_str_digits(100_000)
```

> *"`sys.get_int_max_str_digits()` and `sys.set_int_max_str_digits()` are a
> getter and setter for the **interpreter-wide** limit. Subinterpreters have
> their own limit."*

Interpreter-wide is the load-bearing word. There is no thread-local scope, no
context variable, no module scope. A library that raises the limit at import
time has raised it for your request handlers too.

## Scoping it in time, since you cannot scope it in space

```python
import contextlib
import sys


@contextlib.contextmanager
def int_max_str_digits(n: int):
    """Temporarily widen (n) or disable (0) the base-10 conversion limit."""
    previous = sys.get_int_max_str_digits()
    sys.set_int_max_str_digits(n)
    try:
        yield
    finally:
        sys.set_int_max_str_digits(previous)


with int_max_str_digits(0):
    digits = str(factorial_of_100_000)
```

Be honest about what this buys: it narrows the window in *time*, not in scope.
Under threads or `asyncio`, any other task that runs during the block sees the
raised limit. If the point of the limit is to protect a request handler from
untrusted input, a concurrent handler is exactly what is unprotected.

## Avoiding it instead — the exemptions are the design

If you need to move a huge integer around, move it in a base whose conversion is
linear:

```python
# Exact, exempt, linear — the right way to serialise a bignum.
width = (n.bit_length() + 7) // 8 or 1
blob = n.to_bytes(width, "big")
n2 = int.from_bytes(blob, "big")
assert n2 == n

# Human-inspectable and still exempt:
text = format(n, "x")            # or hex(n) for the 0x prefix
n3 = int(text, 16)
assert n3 == n
```

If the input is user-controlled decimal text of unbounded length, either bound
the string before parsing or parse it into a type whose conversion is exempt:

```python
from decimal import Decimal

MAX_DIGITS = 100

def parse_quantity(raw: str) -> int:
    if len(raw) > MAX_DIGITS:            # policy at the boundary
        raise ValueError("quantity too long")
    return int(raw)


def parse_unbounded_decimal(raw: str) -> Decimal:
    return Decimal(raw)                  # str → Decimal is explicitly exempt
```

Bounding the string is better engineering than raising the limit: the policy
sits where the untrusted data arrives, the error message can be a 400 rather
than a stack trace, and the bignum is never allocated.

## Lowering the limit: the warning the docs give

> *"Setting a low limit can lead to problems. While rare, code exists that
> contains integer constants in decimal in their source that exceed the minimum
> threshold. A consequence of setting the limit is that Python source code
> containing decimal integer literals longer than the limit will encounter an
> error during parsing, usually at startup time or import time or even at
> installation time."*

A precomputed prime or lookup table written as a long decimal literal in a
dependency becomes a *parse-time* failure — during `pip install`, if that
dependency compiles its sources. The same constant written as `0x…` is immune,
because hexadecimal literals are not subject to the limit.

There is also a floor:

> *"`sys.int_info.str_digits_check_threshold` is the lowest accepted value for
> the limit (other than 0 which disables it)."*

It is 640. `sys.set_int_max_str_digits(100)` raises `ValueError`. The floor
exists so that the mitigation cannot itself be weaponised into making ordinary
numbers unprintable.

## A policy that actually holds

```python
# app/__main__.py — after all imports, before serving.
import sys

sys.set_int_max_str_digits(sys.int_info.default_max_str_digits)
```

Setting it explicitly at startup, *after* imports, means any dependency that
widened it during import is overridden by your policy rather than silently
winning. In tests, restore it in a fixture:

```python
import pytest
import sys


@pytest.fixture(autouse=True)
def _restore_int_digit_limit():
    previous = sys.get_int_max_str_digits()
    yield
    sys.set_int_max_str_digits(previous)
```

## Gotchas

### A dependency raises the limit for your whole process
**Symptom.** A mitigation you were relying on is silently gone; or a test that
asserts the `ValueError` passes alone and fails in the full suite.
**Cause.** `sys.set_int_max_str_digits` is interpreter-wide, and import order
decides who wins.
**Fix.** Re-assert your limit at startup after imports (above), and restore it
in an autouse test fixture so one test cannot leak it into another.

### `PYTHONINTMAXSTRDIGITS` appears to be ignored
**Symptom.** The variable is set and `sys.get_int_max_str_digits()` reports
something else.
**Cause.** Either `-X int_max_str_digits` is also set and takes precedence, or
the variable was exported after the interpreter started — it is read only at
initialisation.
**Fix.** Check `sys.flags.int_max_str_digits`; `-1` means neither was supplied.
Set the variable in the launcher (Dockerfile `ENV`, systemd unit, supervisor
config), and use `sys.set_int_max_str_digits` for anything at runtime.

### Setting the limit below 640
**Symptom.** `sys.set_int_max_str_digits(100)` raises `ValueError`.
**Cause.** 640 is `sys.int_info.str_digits_check_threshold`, the minimum
non-zero value.
**Fix.** Use `0` to disable the limitation entirely, or any value ≥ 640.

### `pip install` fails with a `SyntaxError` after hardening a container
**Symptom.** A build that worked yesterday breaks after
`PYTHONINTMAXSTRDIGITS=640` was added to the image.
**Cause.** A dependency contains a decimal integer literal longer than the
limit, and compiling its sources now fails at parse time.
**Fix.** Do not set a low global limit for build steps; apply it to the runtime
process only. If you control the source, rewrite the constant in hexadecimal.

### A context manager that "scopes" the limit under asyncio
**Symptom.** A concurrency-safety review flags the mitigation as bypassable.
**Cause.** The limit has no per-task scope; a `with` block widens it for every
task that runs during the block.
**Fix.** Prefer the exempt conversion path (`to_bytes`, `hex`) so the limit
never needs to move. If a wide limit is genuinely required, isolate the work in
a separate process or a subinterpreter, which has *"their own limit"*.

### Raising the limit to "fix" a serialisation problem
**Symptom.** `sys.set_int_max_str_digits(0)` appears in a commit whose message
mentions exporting keys.
**Cause.** The author needed `str(n)` and reached for the setting named in the
error message.
**Fix.** `n.to_bytes(...)` or `format(n, "x")`. Both are exact, linear and
exempt, and neither changes a process-wide security setting.

## Interview questions

**How do you serialise a 50 000-digit integer to disk?**
`n.to_bytes((n.bit_length() + 7) // 8, "big")`, or `format(n, "x")` if it must
be text. Both are exempt from the digit limit, both are exact, and both are
linear. Raising the limit with `sys.set_int_max_str_digits` would also work, but
it changes a process-wide security setting to solve a serialisation problem.

**A dependency calls `sys.set_int_max_str_digits(0)` at import time. What are
the consequences, and what do you do?**
The DoS mitigation is disabled for the entire interpreter — it is not thread-,
task- or module-scoped — so every endpoint that parses untrusted decimal text is
exposed again. Subinterpreters have their own limit; threads and asyncio tasks
do not. Re-assert the limit explicitly in your application's startup path after
imports, and add a test that asserts `sys.get_int_max_str_digits()` at boot.

**Why is there a floor of 640 on the configurable limit?**
So the mitigation cannot become its own denial of service. The docs warn that
source files can legitimately contain long decimal literals and that a too-low
limit makes them fail at parse time — at import, or even during installation.
640 digits is comfortably above any realistic literal and far below the size at
which conversion cost matters.

**What is the precedence between `PYTHONINTMAXSTRDIGITS` and
`-X int_max_str_digits`?**
`-X` wins. `sys.flags.int_max_str_digits` reports the effective startup value,
and `-1` means neither was set, so the compiled-in
`sys.int_info.default_max_str_digits` was used. Both are read only at
interpreter initialisation; setting the environment variable from inside a
running process does nothing.

**Can you scope the limit to one function safely?**
Not really. A context manager can save and restore it, which is correct in a
single-threaded program, but the limit is interpreter-wide, so any concurrent
thread or asyncio task running inside the block also sees the widened value. If
the isolation genuinely matters, do the work in a subprocess or subinterpreter —
or, far more simply, use a conversion base that is already exempt.

---

← Prev: [The int↔str digit limit](02-the-int-str-conversion-limit.md) · Index: [Numbers](README.md) · Next → [Numeric literals](03-numeric-literals.md)
