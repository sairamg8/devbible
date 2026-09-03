---
title: "A custom exception is a class with a name, a base and sometimes an attribute — and the moment it gets a custom `__init__` it can stop surviving `pickle`"
sidebar_label: "7 · Custom exceptions"
sidebar_position: 126
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html)
> (`Exception`, `BaseException.args`, the user-defined-exceptions note),
> the [Tutorial — user-defined exceptions](https://docs.python.org/3.14/tutorial/errors.html#tut-userexceptions),
> [`pickle`](https://docs.python.org/3.14/library/pickle.html#object.__reduce__),
> [`concurrent.futures`](https://docs.python.org/3.14/library/concurrent.futures.html),
> and [PEP 678](https://peps.python.org/pep-0678/).
> Target: **CPython 3.14**.

Defining an exception is three lines and no ceremony, which is exactly why the
mistakes here are design mistakes rather than syntax ones: the wrong base, a
hierarchy nobody can catch usefully, or a constructor that breaks the moment the
exception has to cross a process boundary.

## The default shape

```python
class StorageError(Exception):
    """Base for every failure in the storage layer."""
```

That is a complete, correct, useful exception. The tutorial's rules are short:

> Exceptions should typically be derived from the `Exception` class, either
> directly or indirectly.

> Most exceptions are defined with names that end in "Error", similar to the
> naming of the standard exceptions.

> Many standard modules define their own exceptions to report errors that may
> occur in functions they define.

And the library reference is blunt about the base:

> programmers are encouraged to derive new exceptions from the `Exception`
> class or one of its subclasses, and not from `BaseException`

The reason is the whole point of
[the hierarchy](04-the-exception-hierarchy.md): `BaseException`'s other children
exist so that `except Exception:` cannot swallow them. An application exception
under `BaseException` inherits that unstoppability, and the symptom is a service
that dies through every handler you wrote.

## One base per package, then narrow

The pattern every well-behaved library uses:

```python
class PaymentError(Exception):
    """Anything this package could not do."""

class CardDeclined(PaymentError):
    def __init__(self, code, message="card declined"):
        super().__init__(message)     # keeps args, str() and pickling intact
        self.code = code

class GatewayUnavailable(PaymentError):
    """The gateway did not answer. Retryable."""
```

That gives callers three levels of precision and they choose:

```python
except CardDeclined as exc:      ...   # act on this specific failure
except PaymentError:             ...   # anything from this package
except Exception:                ...   # the last-resort boundary
```

🔴 **The test for a hierarchy is whether a caller can catch a useful subset.**
An exception class per error *message* fails it — twenty sibling classes with no
shared base force callers into a twenty-name tuple, and the twenty-first release
adds one they do not catch. One base plus the distinctions callers actually
branch on is the whole design.

## `args`, `str()` and the constructor trap

`BaseException.args` is *"the tuple of arguments given to the exception
constructor"*, and the default `__str__` is built from it. A single string
argument prints as that string; two arguments print as a tuple, which is where
`str(exc)` starts looking wrong:

```python
raise StorageError("cannot write", path)     # str() -> ('cannot write', '/tmp/x')
raise StorageError(f"cannot write {path}")   # str() -> 'cannot write /tmp/x'
```

The deeper trap is a custom `__init__` whose signature does not match what
`args` will replay. Exceptions are reconstructed by calling the class with
`args`, so `copy`, `pickle`, `multiprocessing` and `concurrent.futures` — which
must move an exception from a worker back to the parent — all depend on that
round-trip:

```python
class CardDeclined(PaymentError):
    def __init__(self, code):          # args == (code,) — round-trips fine
        super().__init__(code)
        self.code = code
```

```python
class CardDeclined(PaymentError):
    def __init__(self, code, *, retryable):    # keyword-only: args == () after super()
        super().__init__(f"declined: {code}")  # unpickling calls CardDeclined(msg) -> TypeError
        self.code, self.retryable = code, retryable
```

Two ways out. Keep every constructor argument positional and pass them all to
`super().__init__(...)` so `args` reproduces the call, or define `__reduce__`
when the signature genuinely cannot be flattened:

```python
def __reduce__(self):
    return (self.__class__, (self.code,), {"retryable": self.retryable})
```

The failure only appears where the exception crosses a boundary, which is why it
reaches production: it never fires in the unit tests that raise and catch it in
one process.

## What to put on the exception

Attributes the **handler** will branch on, and nothing else:

```python
class HTTPError(Exception):
    def __init__(self, status, url):
        super().__init__(f"{status} for {url}")
        self.status = status
        self.url = url
```

`exc.status` lets a caller retry a 503 and give up on a 404 without parsing the
message — the alternative is `if "503" in str(exc)`, which is how a log format
change breaks retry logic. See
[choosing the exception type](05b-choosing-the-exception-type.md) for the
attribute-versus-subclass decision.

What not to attach: a live database session, an open file, a request object, or
anything else whose lifetime you care about. The exception is referenced by its
traceback and by anything that chained it, so whatever it holds stays alive for
as long as the chain does.

For a fact you only learned at the catch site, `add_note` beats an attribute —
see [exception chaining](06b-exception-chaining.md).

## When the builtin is the right answer

A custom class earns its place when callers need to distinguish *your* failure
from everyone else's. When they do not, the builtin is better because every
caller already knows it:

| Situation | Use |
|---|---|
| A caller passed a value of the right type with an impossible value | `ValueError` |
| A caller passed the wrong type | `TypeError` |
| A key or index is not there | `KeyError` / `IndexError` (or `LookupError`) |
| The feature is not implemented in this subclass | `NotImplementedError` |
| A file, socket or OS call failed | the `OSError` subclass the OS gave you |
| Your library's own domain rule was violated | **a custom subclass** |

Subclassing a builtin is the compatibility move: `class ConfigError(ValueError)`
keeps working for every caller that already catches `ValueError` while letting
new code be specific. The cost is that it is now caught by handlers that never
heard of you — which is either the feature or the bug, depending on which
handler.

🔴 **Subclass exactly one exception type.** The library reference:

> It's recommended to only subclass one exception type at a time to avoid any
> possible conflicts between how the bases handle the `args` attribute, as well
> as due to possible memory layout incompatibilities.

`class WeirdError(ValueError, OSError)` is how you meet
`TypeError: multiple bases have instance lay-out conflict` — at import time, on
someone else's machine.

## Gotchas

**★ Symptom — `TypeError: __init__() missing 1 required positional argument` from
inside `pickle`, `multiprocessing`, or a `concurrent.futures` worker returning a
result.** Cause: a custom `__init__` whose parameters are not reproduced by
`args`, so reconstruction calls the class with the wrong arguments. Fix: pass
every constructor argument to `super().__init__()`, or implement `__reduce__`.

```python
class JobFailed(Exception):
    def __init__(self, job_id, reason):
        super().__init__(job_id, reason)     # args round-trips
        self.job_id, self.reason = job_id, reason
```

**★ Symptom — `str(exc)` prints a tuple, and the log line reads
`('cannot write', '/tmp/x')`.** Cause: several positional arguments, so `args`
has several elements and the default `__str__` formats the tuple. Fix: one
formatted message to `super().__init__()`, and the parts as attributes.

**★ Symptom — a custom exception passes straight through
`except Exception:` and kills the worker.** Cause: it derives from
`BaseException` — usually copied from a snippet, occasionally from the belief
that it makes the error "more serious". Fix: derive from `Exception`. Only
`SystemExit`, `KeyboardInterrupt` and `GeneratorExit` belong outside it, and
none of them are yours to imitate.

**★ Symptom — `TypeError: multiple bases have instance lay-out conflict` at
import.** Cause: an exception class with two exception bases. Fix: pick one
base; if you needed the second for compatibility, catch-and-translate at the
boundary instead of inheriting both.

**★ Symptom — callers of a library end up writing a ten-name `except (…)`
tuple, and still miss a new one after an upgrade.** Cause: no common base — a
class per message. Fix: one package base every exception derives from, and
subclasses only for distinctions callers branch on.

**★ Symptom — a retry decorator retries a validation error forever.** Cause:
the hierarchy encodes *what happened* but not *whether it can be retried*, so
the decorator catches the base. Fix: make retryability a structural fact — a
`TransientError` base, or a `retryable` attribute the decorator reads.

```python
class TransientError(ServiceError): ...      # the decorator catches this one
class PermanentError(ServiceError): ...
```

**★ Symptom — memory grows in a service that logs and stores exceptions.**
Cause: exceptions holding request objects, sessions or large payloads, kept
alive by tracebacks and chains. Fix: store identifiers, not objects, and let the
formatter do the rest.

**★ Symptom — an exception hierarchy is perfect and the API still returns 500
for a not-found.** Cause: the mapping from domain exception to transport lives
nowhere. Fix: one place at the edge — a handler that maps `NotFound` → 404,
`ValidationError` → 422, everything else → 500 — and keep status codes out of
the domain classes.

## Interview questions

**★ Q: Why derive from `Exception` rather than `BaseException`?**
Because `BaseException`'s other direct children — `SystemExit`,
`KeyboardInterrupt`, `GeneratorExit` — exist precisely so `except Exception:`
cannot catch them. Putting an application error there means every ordinary
handler and every `except Exception:` boundary misses it, and the process dies
on something that should have been recoverable. The library reference recommends
`Exception` explicitly.

**★ Q: How would you design the exception hierarchy for a library?**
One base class for the package so callers can catch everything from it, and
subclasses only where a caller would branch. Distinctions that do not change
behaviour go in attributes, not classes. Names end in `Error`. If the package
replaces something that used to raise a builtin, derive the base from that
builtin so existing handlers keep working.

**★ Q: You add a custom `__init__` to an exception. What can break?**
Reconstruction. Exceptions are rebuilt by calling the class with `args`, so
`copy`, `pickle`, `multiprocessing` and `concurrent.futures` fail with a
`TypeError` if the signature does not match. Pass all constructor arguments to
`super().__init__()`, or write `__reduce__`. The bug never shows up in
single-process tests.

**Q: Custom exception or builtin?**
Builtin when the failure is a category every Python programmer already knows —
a bad value is a `ValueError`, a missing key a `KeyError`. Custom when a caller
needs to tell your failure apart from the same builtin raised by anything else
in the call stack, which is almost always true at a package boundary.

**Q: Should the exception carry an HTTP status code?**
The domain exception should not; the mapping should. A domain that knows about
404 cannot be reused off the web, and two callers may want different codes for
the same failure. Map once at the transport edge.

**Q: What is the argument against subclassing a builtin like `ValueError`?**
It is caught by handlers that know nothing about your library — including broad
`except ValueError:` blocks written years earlier for a different purpose. That
is the same property that makes it a good migration path, so it is a deliberate
trade, not a default.

---

← Prev: [Exception chaining](06b-exception-chaining.md) · Index: [Exceptions](README.md) · Next → [Exception groups](08-exception-groups.md)
