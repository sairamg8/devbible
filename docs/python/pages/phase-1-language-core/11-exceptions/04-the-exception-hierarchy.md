---
title: "`BaseException` has four direct children besides `Exception`, and every one of them is there specifically so `except Exception:` cannot swallow it"
sidebar_label: "4 · The exception hierarchy"
sidebar_position: 119
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html)
> including the [Exception hierarchy](https://docs.python.org/3.14/library/exceptions.html#exception-hierarchy),
> the Language Reference
> [`except` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-clause),
> and [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations).
> The `__mro__` relationships stated below were checked against CPython 3.14.4.
> Target: **CPython 3.14**.

**The hierarchy is not an accident of implementation; the split between
`BaseException` and `Exception` is a deliberate design decision made so that
`except Exception:` — the broadest handler ordinary code should ever write —
still lets the interpreter be interrupted and still lets the program exit. Every
class that sits directly under `BaseException` is there because catching it is
almost always wrong. Learn those four names and the shape of `Exception`'s
subtree, and you can pick the right clause without looking anything up.**

## The two roots

> *"`BaseException` — The base class for all built-in exceptions. It is not meant
> to be directly inherited by user-defined classes (for that, use `Exception`)."*

> *"`Exception` — All built-in, non-system-exiting exceptions are derived from
> this class. All user-defined exceptions should also be derived from this
> class."*

The phrase to hold onto is **"non-system-exiting"**. `Exception` is the subtree
of *things that went wrong inside your program*. `BaseException` additionally
covers *things that are telling your program to stop*.

## The four direct children of `BaseException`

On CPython 3.14, `BaseException.__subclasses__()` is exactly
`BaseExceptionGroup`, `Exception`, `GeneratorExit`, `KeyboardInterrupt`,
`SystemExit`. Setting `Exception` aside, the docs give a reason for each of the
others in its own entry.

**`KeyboardInterrupt`:**

> *"Raised when the user hits the interrupt key (normally Control-C or Delete).
> During execution, a check for interrupts is made regularly. The exception
> inherits from `BaseException` so as to not be accidentally caught by code that
> catches `Exception` and thus prevent the interpreter from exiting."*

**`SystemExit`:**

> *"This exception is raised by the `sys.exit()` function. It inherits from
> `BaseException` instead of `Exception` so that it is not accidentally caught by
> code that catches `Exception`."*

**`GeneratorExit`:**

> *"Raised when a generator or coroutine is closed … It directly inherits from
> `BaseException` instead of `Exception` since it is technically not an error."*

**`BaseExceptionGroup`:**

> *"The difference between the two classes is that `BaseExceptionGroup` extends
> `BaseException` and it can wrap any exception, while `ExceptionGroup` extends
> `Exception` and it can only wrap subclasses of `Exception`. This design is so
> that `except Exception` catches an `ExceptionGroup` but not
> `BaseExceptionGroup`."*

Read those four together and the rule is one sentence: **the position of a class
in the hierarchy encodes whether `except Exception:` should see it.** The group
classes are the clearest evidence — the whole reason there are *two* group types
is to preserve exactly this property when a group contains a `KeyboardInterrupt`.

## The tree, with the parts worth memorising

```text
BaseException
 ├── BaseExceptionGroup
 ├── GeneratorExit
 ├── KeyboardInterrupt
 ├── SystemExit
 └── Exception
      ├── ArithmeticError ── ZeroDivisionError, OverflowError, FloatingPointError
      ├── AssertionError
      ├── AttributeError
      ├── ExceptionGroup            (also inherits BaseExceptionGroup)
      ├── ImportError ── ModuleNotFoundError
      ├── LookupError ── IndexError, KeyError
      ├── NameError ── UnboundLocalError
      ├── OSError ── FileNotFoundError, PermissionError, TimeoutError, …
      ├── RuntimeError ── NotImplementedError, RecursionError,
      │                   PythonFinalizationError
      ├── StopIteration, StopAsyncIteration
      ├── SyntaxError ── IndentationError ── TabError
      ├── TypeError
      ├── ValueError ── UnicodeError ── UnicodeDecodeError, UnicodeEncodeError
      └── Warning ── DeprecationWarning, SyntaxWarning, …
```

Five groupings that pay for themselves:

- **`LookupError`** is the common base of `IndexError` and `KeyError`. `except
  LookupError:` is the honest handler for "I indexed something that was not
  there", regardless of whether the container was a `list` or a `dict`.
- **`OSError`** absorbed the old zoo in Python 3.3: `IOError`,
  `EnvironmentError`, `WindowsError`, `socket.error`, `select.error` and
  `mmap.error` are all aliases of `OSError` now — `IOError is OSError` is `True`.
  Its subclasses (`FileNotFoundError`, `PermissionError`, `IsADirectoryError`,
  `ConnectionResetError`, `TimeoutError`, …) replace the `errno` comparisons you
  will still see in old code.
- **`UnicodeDecodeError` is a `ValueError`.** Full chain:
  `UnicodeDecodeError` → `UnicodeError` → `ValueError`. So `except ValueError:`
  around a decode catches it — usually accidentally. See
  [bytes and encoding](../04-bytes-and-encoding/README.md).
- **`ExceptionGroup` has two bases**: `BaseExceptionGroup` *and* `Exception`.
  That dual inheritance is what makes `except Exception:` catch it.
- **`Warning` is an `Exception`.** Warnings are exception *classes* even though
  they are normally not raised; `warnings.simplefilter("error")` turns them into
  real raises, at which point `except Exception:` catches them. See
  **11 · Warnings versus exceptions** *(not written yet)*.

## `StopIteration` lives under `Exception`, and that has consequences

`StopIteration` is an `Exception`, not a `BaseException` — it is a normal control
signal that happens to be an exception. Inside a generator this is a real hazard:
a `StopIteration` that escapes a generator's frame used to silently end the
generator. PEP 479 (default since Python 3.7) changed that: a `StopIteration`
propagating out of a generator body is converted into a `RuntimeError`. The
practical rule is unchanged — never let `next()` be called bare inside a
generator without a default or a handler:

```python
def pairs(it):
    it = iter(it)
    for a in it:
        try:
            b = next(it)
        except StopIteration:
            return                     # explicit, not accidental
        yield a, b
```

## "Non-virtual base class" — ABC registration does not count

The `except` clause matching rule has a word in it that most readers skip:

> *"The raised exception matches an `except` clause whose expression evaluates to
> the class or a **non-virtual base class** of the exception object, or to a tuple
> that contains such a class."*

*Virtual* base classes are the ones you get from `abc`'s `register()` and
`__subclasshook__` — the mechanism that makes `isinstance(x, Iterable)` true for
a class that never inherited from `Iterable`. Exception matching does **not**
consult that machinery: it walks the real MRO. So you cannot register a class as
a virtual subclass of your library's error base and have `except MyLibError:`
catch it. Exception hierarchies must be real inheritance hierarchies.

## Where to draw your own handlers

| Clause | What it catches | When it is right |
|---|---|---|
| `except SpecificError:` | one failure mode | almost always |
| `except (A, B):` | two named failure modes | almost always |
| `except SomeBase:` | a family (`LookupError`, `OSError`, your package's base) | when the family is the unit you can recover from |
| `except Exception:` | everything that went wrong *in the program* | at a top-level boundary that logs and re-raises or converts |
| `except BaseException:` | that, plus exit and interrupt | essentially never — see [04b](04b-the-bare-except.md) |
| `except:` | the same as `BaseException` | never |

## Gotchas

**★ Symptom — Ctrl-C does not stop a script; it prints an error and keeps
going.** Cause: a handler broad enough to catch `KeyboardInterrupt` — a bare
`except:` or `except BaseException:` — usually inside a loop, so each interrupt is
caught and the loop continues. Fix: `except Exception:`. The docs say
`KeyboardInterrupt` inherits from `BaseException` precisely *"so as to not be
accidentally caught by code that catches `Exception`"*.

**★ Symptom — `sys.exit()` does not exit; the program carries on and eventually
returns success.** Cause: `SystemExit` is a `BaseException` and something
upstream catches `BaseException` or uses a bare `except:`. Fix: narrow the
handler. If a top-level handler must be that broad, re-raise `SystemExit` and
`KeyboardInterrupt` explicitly before handling anything else.

**★ Symptom — a custom exception is not caught by `except MyLibError:` even
though it "is" one.** Cause: it was registered as a *virtual* subclass via `abc`
rather than actually inheriting; exception matching uses non-virtual bases only.
Fix: inherit for real.

**Symptom — `except ValueError:` around a `.decode()` call swallows an encoding
bug.** Cause: `UnicodeDecodeError` is a `UnicodeError` is a `ValueError`. Fix:
catch `UnicodeDecodeError` when that is what you mean; `ValueError` is far wider
than it looks.

**Symptom — old code catches `IOError` and new code catches `OSError` and they
behave identically, confusing a reviewer.** Cause: they are the same object since
Python 3.3 — `IOError is OSError` is `True`, as are `EnvironmentError` and
`os.error`. Fix: use `OSError` (or a specific subclass) in new code, and prefer
`except FileNotFoundError:` over `except OSError:` plus an `errno` test.

**Symptom — a generator ends early and silently instead of raising.** Cause: a
bare `next()` inside the generator raised `StopIteration`, which used to be
absorbed as "generator finished". Fix: since PEP 479 it becomes a `RuntimeError`
instead of being silent, but the correct code is still `next(it, default)` or an
explicit `except StopIteration:`.

**Symptom — `except Exception:` in an async task does not catch a
cancellation.** Cause: `asyncio.CancelledError` inherits from `BaseException`
since Python 3.8, for the same reason as the others — cancellation must not be
swallowed by application error handling. Fix: do not try to catch it; if you must
observe it, catch it explicitly and re-raise.

**Symptom — a `finally` or `except` in a generator does something odd when the
generator is closed.** Cause: `close()` throws `GeneratorExit`, which is a
`BaseException` *"since it is technically not an error"*. `except Exception:`
inside the generator does not see it — which is the design. Fix: nothing, unless
you were relying on catching it; then catch `GeneratorExit` by name, and re-raise
or return rather than yielding again.

## Interview questions

**★ Q: What is the difference between `BaseException` and `Exception`?**
`Exception` is the base of *"all built-in, non-system-exiting exceptions"* — the
things that went wrong inside your program. `BaseException` additionally covers
the classes that mean *stop the program*: `SystemExit`, `KeyboardInterrupt`,
`GeneratorExit` and `BaseExceptionGroup`. The split exists so that
`except Exception:` — the broadest handler application code should use — cannot
prevent the interpreter from exiting or being interrupted.

**★ Q: Why do `KeyboardInterrupt` and `SystemExit` not inherit from
`Exception`?**
The docs state the reason for both in the same words: so they are *"not
accidentally caught by code that catches `Exception`"*, and for
`KeyboardInterrupt` specifically so that catching `Exception` does not *"prevent
the interpreter from exiting"*. If they were under `Exception`, every
`except Exception:` in every library on your stack would eat Ctrl-C.

**★ Q: Why are there two exception group classes?**
So the `BaseException`/`Exception` property survives grouping. `ExceptionGroup`
extends `Exception` and may only wrap `Exception` instances; `BaseExceptionGroup`
extends `BaseException` and may wrap anything. The docs say it directly: *"This
design is so that `except Exception` catches an `ExceptionGroup` but not
`BaseExceptionGroup`."* A group containing a `KeyboardInterrupt` is therefore not
catchable by `except Exception:`.

**Q: Should your custom exceptions inherit from `BaseException`?**
No. PEP 8: *"Derive exceptions from `Exception` rather than `BaseException`.
Direct inheritance from `BaseException` is reserved for exceptions where catching
them is almost always the wrong thing to do."* The built-in docs say the same:
`BaseException` *"is not meant to be directly inherited by user-defined
classes"*.

**Q: What is a "non-virtual base class" in the `except` matching rule?**
A real base in the MRO, as opposed to one established by `abc.register()` or
`__subclasshook__`. Exception matching ignores virtual subclassing entirely, so
an ABC-registered relationship will not make `except SomeBase:` fire. Exception
hierarchies must be built with genuine inheritance.

**Q: Which built-in exception would you catch to handle a missing key or a bad
index uniformly?**
`LookupError` — the common base of `KeyError` and `IndexError`. It is the right
handler when the container type is an implementation detail of the code you are
guarding.

**Q: Is `TimeoutError` an `OSError`?**
Yes — since Python 3.3's `OSError` merge, the built-in `TimeoutError` is an
`OSError` subclass, alongside `FileNotFoundError`, `PermissionError` and the
`ConnectionError` family. Note that `asyncio.TimeoutError` was a separate class
historically and became an alias of the built-in in 3.11; library-specific
timeout classes (`requests`, `httpx`) are usually *not* `OSError` subclasses, so
check before writing `except OSError:` around a network call.

**Q: What does the position of `Warning` in the hierarchy tell you?**
That warnings are ordinary exception classes under `Exception`, and that turning
warnings into errors (`-W error`, `warnings.simplefilter("error")`) produces
exceptions your existing `except Exception:` handlers will catch — which is why
a warnings-as-errors run can silently change behaviour rather than failing loudly.

---

← Prev: [When `finally` does not run](03g-when-finally-does-not-run.md) · Index: [Exceptions](README.md) · Next → [The bare `except:`](04b-the-bare-except.md)
