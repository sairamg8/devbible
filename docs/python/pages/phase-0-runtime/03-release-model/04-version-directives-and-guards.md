---
title: "Version directives and guards: the documentation defaults to a Python you are not running, and a runtime check cannot save you from new syntax"
sidebar_label: "4 · Version directives and guards"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [`sys.version_info` and `sys.implementation`](https://docs.python.org/3.14/library/sys.html),
> [`itertools`](https://docs.python.org/3.14/library/itertools.html),
> [`tomllib`](https://docs.python.org/3.14/library/tomllib.html) and the
> [Expressions reference](https://docs.python.org/3.14/reference/expressions.html)
> on sequence comparison.
> Version spine: **Python 3.14.7**; docs.python.org/3/ currently serves the
> 3.14.7 documentation.

**The standard library documentation you are reading defaults to the newest
release, not to the Python you deploy on, and the difference between those two
is expressed in three small grey admonitions that are easy to scroll past. This
chunk is about reading those admonitions against your actual target, expressing
the same question in code with `sys.version_info`, and knowing the one case a
runtime guard cannot help with at all — new syntax, which fails at compile time,
before your guard has a chance to run.**
## The docs you are reading are for the newest version

`https://docs.python.org/3/` is not "Python 3 in general". It redirects to the
current stable release — today that serves the 3.14.7 documentation. Every
example, every signature and every default value on that page is 3.14's.

If your service runs 3.12, the URL you want is
`https://docs.python.org/3.12/...`. The version selector in the sidebar changes
it, and the change is worth making a habit: a signature that gained a keyword
argument in 3.13 looks identical on both pages except for one line of small grey
text underneath it.

## The three version directives, and what each one is warning you about

The standard library docs carry short admonitions that are the entire mechanism
for expressing version differences. There are three, and they answer different
questions:

- **`Added in version 3.12.`** — this name did not exist before 3.12. On 3.11
  you get `AttributeError` or `ImportError`.
- **`Changed in version 3.13: Added the strict option.`** — the name existed
  earlier, but *this part* of it did not. This is the dangerous one, because the
  import succeeds and the failure moves to the call site.
- **`Deprecated since version 3.13, will be removed in version 3.15.`** — you
  have a deadline, and it is written down.

`itertools.batched` is a compact demonstration of the second kind. The 3.14 docs
give its signature as `itertools.batched(iterable, n, *, strict=False)` and then
carry both directives:

> *"Added in version 3.12."*

> *"Changed in version 3.13: Added the strict option."*

So this code:

```python
from itertools import batched

for chunk in batched(rows, 100, strict=True):
    process(chunk)
```

…imports cleanly on 3.12, and raises `TypeError` at the first call, because on
3.12 `batched` takes no `strict` keyword. The import-time check you might have
relied on to catch a version problem does not fire. **Read the "Changed in
version" lines, not only the "Added in" line.**

The habit that removes this class of bug entirely: when you use something you
have not used before, look at the version directives under it and compare them
to the lowest interpreter you support — which should be written down in your
`requires-python`, not held in someone's head.

## `sys.version_info` and the guard idiom

`sys.version_info` is the machine-readable form of the same question:

> *"A tuple containing the five components of the version number: major, minor,
> micro, releaselevel, and serial. All values except releaselevel are integers;
> the release level is 'alpha', 'beta', 'candidate', or 'final'. … The
> components can also be accessed by name, so sys.version_info[0] is equivalent
> to sys.version_info.major and so on."*

Because it is a tuple of integers, it compares correctly — including the case
that trips string comparison:

```python
import sys

if sys.version_info >= (3, 12):
    from itertools import batched
else:
    from ._compat import batched          # your own backport
```

Compare against a **tuple**, never against `sys.version` (a free-form string
whose docs say *"Do not extract version information out of it"*) and never
against a string form of the number — `"3.9" > "3.10"` is True, because string
comparison compares `9` against `1`. That single mistake has shipped in a lot of
setup scripts.

Two further rules for guards:

**Guard on the feature, not the version, when you can.** A version check encodes
an assumption about which interpreter has which feature; a feature check asks
directly, and keeps working on alternative implementations and backports:

```python
try:
    import tomllib                        # stdlib from 3.11
except ImportError:
    import tomli as tomllib               # the backport, on older interpreters
```

```python
# a keyword that appeared later than the function itself
import inspect
from itertools import batched

if "strict" in inspect.signature(batched).parameters:
    batches = batched(rows, 100, strict=True)
else:
    batches = batched(rows, 100)
```

**Put the guard where it is cheap.** A `sys.version_info` check at import time
runs once; the same check inside a hot loop runs every iteration for a value
that cannot change.

**`sys.version_info` is the language version, not the implementation version.**
On CPython they coincide; elsewhere they do not, and the `sys` docs give the
example:

> *"for PyPy 1.8 sys.implementation.version might be sys.version_info(1, 8, 0,
> 'final', 0), whereas sys.version_info would be sys.version_info(2, 7, 2,
> 'final', 0). For CPython they are the same value, since it is the reference
> implementation."*

If you are asking "does this interpreter have the 3.12 syntax", you want
`sys.version_info`. If you are asking "is this CPython 3.14 specifically", you
want `sys.implementation.name` as well.


## The one thing a runtime guard cannot do: new syntax

This looks like a version guard and is not one:

```python
import sys

if sys.version_info >= (3, 10):
    def handle(event):
        match event:                 # SyntaxError on 3.9 — at compile time
            case {"type": "ping"}:
                return "pong"
```

The module never runs on 3.9. As [01 · What Python
is](../01-what-python-is/02-source-to-bytecode.md) covers, the whole file is
parsed and compiled to bytecode *before* the first statement executes, so a
`SyntaxError` anywhere in the file aborts the import regardless of what any `if`
around it says. The guard is dead code that never gets the chance to be false.

Syntax-level features have to be isolated behind an **import**, so the parser
only ever sees the new syntax on an interpreter that understands it:

```python
# _handler_modern.py  — imported only on 3.10+, never parsed on 3.9
def handle(event):
    match event:
        case {"type": "ping"}:
            return "pong"
```

```python
# handler.py
import sys

if sys.version_info >= (3, 10):
    from ._handler_modern import handle
else:
    from ._handler_legacy import handle
```

The same applies to PEP 695 type-parameter syntax, `except*`, and any future
grammar addition. Runtime guards protect against missing *names*; only separate
modules protect against missing *grammar*.

## Gotchas

**Symptom:** the docs show a parameter that your production interpreter rejects with `TypeError`
**Cause:** docs.python.org/3/ serves the newest release. The parameter has a "Changed in version" directive you did not scroll to
**Fix:** read the docs at your deploy version's URL, and check the version directives under any signature you are relying on. `itertools.batched` is the canonical example: the function is 3.12, its `strict` keyword is 3.13

**Symptom:** a version comparison behaves backwards on 3.10
**Cause:** comparing version *strings* — `"3.9" > "3.10"` is True because `"9" > "1"` character-wise
**Fix:** compare `sys.version_info` against a tuple of integers: `sys.version_info >= (3, 10)`

**Symptom:** you parsed `sys.version` to get the version number and it broke on a different build
**Cause:** `sys.version` is a free-form string that also carries build and compiler information; the docs say *"Do not extract version information out of it"*
**Fix:** `sys.version_info` for the language version, `sys.implementation` for the implementation, `platform.python_version()` if you need a display string

**Symptom:** a `sys.version_info` guard around new syntax still raises `SyntaxError`
**Cause:** the file is compiled in full before any of it executes. A guard is a runtime construct; a grammar error is a compile-time one
**Fix:** move the new-syntax code into its own module and select the module with the guard, so the parser never sees the newer grammar on the older interpreter

**Symptom:** `sys.version_info >= (3, 12)` is True on a 3.12 alpha that does not have the feature yet
**Cause:** tuple comparison compares element by element and then by length, so `(3, 12, 0, 'alpha', 1)` is greater than the two-element `(3, 12)`. Every pre-release of 3.12 satisfies the guard
**Fix:** feature-detect instead, or add `sys.version_info.releaselevel == 'final'` to the condition if you genuinely need to exclude pre-releases

**Symptom:** a compatibility shim silently prefers the third-party backport over the standard library module
**Cause:** the `try/except ImportError` was written the wrong way round, importing the PyPI package first
**Fix:** always try the standard library name first and fall back to the backport; the stdlib version is the one that is maintained with your interpreter

**Symptom:** a guard on `sys.version_info[0]` (the major version)
**Cause:** a leftover Python-2 habit. Every supported interpreter reports major `3`, so the check is always True and hides the fact that nobody re-examined it
**Fix:** guard on `(major, minor)` — the minor number is where Python's breaking changes live

**Symptom:** `sys.version_info` says 3.11 on an interpreter whose own version is something else entirely
**Cause:** you are on a non-CPython implementation. `sys.version_info` reports the *language* version conformed to, not the implementation's own version
**Fix:** use `sys.implementation.name` and `sys.implementation.version` when the question is really "which interpreter is this"

## Interview questions

**★ You read a function's docs and it works locally but fails in production. What do you check first?**
The version directives under the signature, against the interpreter that
production actually runs — because docs.python.org/3/ serves the newest release,
not mine. The subtle case is "Changed in version X: added the Y option", where
the function exists on the older interpreter and only the keyword is missing, so
the import succeeds and the failure appears at the call site as a `TypeError`.

**★ Why can't you protect new syntax with an `if sys.version_info >= (3, 10):` guard?**
Because the guard runs at runtime and the syntax error happens at compile time.
Python parses and compiles the entire module before executing any of it, so a
`match` statement inside a false branch still aborts the import on 3.9. The
working pattern is to put the new-syntax code in a separate module and let the
version check decide which module to import — then the older parser never sees
the newer grammar.

**How do you write code that runs on two Python versions with different APIs?**
Prefer feature detection to version detection: `try: import tomllib / except
ImportError: import tomli as tomllib` asks the real question and keeps working
on backports and other implementations. When feature detection is awkward, guard
on `sys.version_info` compared against a tuple of integers, at import time rather
than inside a loop. Never compare version strings — `"3.9" > "3.10"` is True.

**What are the three version admonitions in the standard library docs, and which is the dangerous one?**
"Added in version X" (the name did not exist before X), "Changed in version X"
(the name existed, but this behaviour or parameter did not), and "Deprecated
since version X, will be removed in version Y". The dangerous one is *Changed*,
because the import succeeds on the older interpreter and the failure is deferred
to the call site — often to a code path that only runs in production.

**What is the difference between `sys.version_info` and `sys.implementation.version`?**
`sys.version_info` is the version of the Python *language* the running
interpreter conforms to; `sys.implementation.version` is the version of the
implementation itself. On CPython they are identical, since it is the reference
implementation. The `sys` docs use PyPy as the illustration: PyPy 1.8 conforming
to Python 2.7.2 reports `(1, 8, 0, 'final', 0)` for the implementation and
`(2, 7, 2, 'final', 0)` for the language.

**Where should a version guard live in a module, and why?**
At import time, at module level, so it evaluates once and the rest of the module
is written against a single resolved name. A guard inside a function body — or
worse, inside a loop — re-evaluates a value that cannot change, and it scatters
the compatibility logic across the file instead of concentrating it in one block
you can delete on the day you drop the old version.

---

← Prev: [Feature freeze and the free-threaded build](03-feature-freeze.md) · Index: [The release model](README.md) · Next → [The deprecation policy](05-the-deprecation-policy.md)
