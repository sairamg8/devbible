---
title: "Pick the narrowest class whose failures your handler can actually answer — and if the distinction lives in an attribute, re-raise the ones that are not yours"
sidebar_label: "5b · Choosing the type"
sidebar_position: 122
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/#programming-recommendations),
> the Python 3.14 Language Reference
> [`except` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-clause),
> and the Library Reference
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html)
> and [`OSError`](https://docs.python.org/3.14/library/exceptions.html#OSError).
> Class identities (`asyncio.TimeoutError is TimeoutError`) checked against
> CPython 3.14.4.
> Target: **CPython 3.14**.

**[05](05-catching-specific-types.md) covered how matching works. This is the
harder question: which class do you name? "As specific as possible" is the
advice everyone repeats and it is subtly wrong — the target is the narrowest
class *whose members all deserve the same response*, which is sometimes a leaf
class, sometimes a family like `LookupError`, and sometimes `Exception` at a
boundary. And when the distinction you need is not in the class at all but in an
attribute, there is exactly one correct shape, and its most important line is a
bare `raise`.**

## Separate clauses versus one tuple

Use a tuple when the *response* is the same:

```python
except (ValueError, TypeError):
    raise BadPayload(raw) from None
```

Use separate clauses when the responses differ, even if the code looks
repetitive:

```python
except ValueError:
    metrics.incr("payload.malformed")
    raise BadPayload(raw)
except TimeoutError:
    metrics.incr("payload.timeout")
    raise Retryable(raw)
```

The anti-pattern is catching broadly and re-dispatching by hand:

```python
# WRONG — reimplements the language's own dispatch, badly
except Exception as e:
    if isinstance(e, ValueError):
        ...
    elif isinstance(e, TimeoutError):
        ...
    else:
        raise
```

That version catches things it does not handle (however briefly), gets the
ordering semantics wrong the moment two branches overlap, and hides from every
reader and linter what is actually being caught.

## Choosing the type: three questions

**1 · What is the narrowest class that describes the failure I can recover
from?** Not the narrowest class that can be raised — the narrowest one whose
recovery is the same. `FileNotFoundError` and `PermissionError` are both
`OSError`, but "create a default" is only right for the first.

**2 · Am I catching a family on purpose?** `LookupError` for
`KeyError`-or-`IndexError`, `ArithmeticError` for the numeric ones, `OSError` for
"the operating system said no", and your own package's base class for "this
library failed" — see [07 · Custom exceptions](07-custom-exceptions.md).

**3 · Is the distinction I need actually in the type, or in an attribute?**
Sometimes the type is right and the discrimination is data:

```python
except OSError as e:
    if e.errno != errno.ENOSPC:
        raise                 # not our case — put it back
    handle_disk_full()
```

The `raise` in the negative branch is what makes this correct: a handler that
inspects an attribute must re-raise when the attribute says the exception was not
for it. Forgetting it is the same swallow-everything bug in a subtler costume.
The equivalent for an HTTP client:

```python
except httpx.HTTPStatusError as e:
    if e.response.status_code != 404:
        raise
    return None
```

## PEP 8's rule, again, from the other side

> *"When catching exceptions, mention specific exceptions whenever possible
> instead of using a bare `except:` clause."*

The general form of "as specific as possible" is not "as narrow as syntactically
possible" — it is *"the class whose failures this handler genuinely knows how to
answer"*. A handler that catches `KeyError` and responds by returning a default
is specific and correct. A handler that catches `Exception` at a request boundary
and logs it is broad and also correct. A handler that catches `Exception` around
`int(value)` because "it might fail somehow" is neither.

## Naming the class from the right module

`except TimeoutError:` looks unambiguous and is not. Some facts, checked against
CPython 3.14.4:

- The built-in `TimeoutError` is an `OSError` subclass.
- `asyncio.TimeoutError` **is** the built-in `TimeoutError` — the same object,
  since Python 3.11.
- `IOError`, `EnvironmentError` and `os.error` are all the built-in `OSError` —
  the same object, since Python 3.3.
- Third-party timeout classes usually are **not**: `requests.exceptions.Timeout`,
  `httpx.TimeoutException` and `redis.TimeoutError` are their own hierarchies.

So `except TimeoutError:` around a `requests` call catches nothing that
`requests` raises. Import the class from the library that raises it, and prefer
that library's documented base class when you want the family:

```python
import httpx

try:
    r = client.get(url)
except httpx.TimeoutException:        # not the built-in TimeoutError
    return cached(url)
except httpx.HTTPError:               # httpx's own family base
    raise UpstreamUnavailable(url)
```

## Catch what the callee documents, not what it happens to raise

A function's exceptions are part of its interface only if they are documented.
Catching a type you observed empirically — `KeyError` from a library that will
switch to a dataclass next release — is coupling to an implementation detail. Two
defences:

- Prefer the library's documented base class over an observed leaf class.
- At your own module boundaries, convert: catch the library's exception and raise
  your own, with `from` so the original survives. See
  [06b · Exception chaining](06b-exception-chaining.md) and
  [07 · Custom exceptions](07-custom-exceptions.md).

## PEP 8's rule, from the other side

> *"When catching exceptions, mention specific exceptions whenever possible
> instead of using a bare `except:` clause."*

The general form of "as specific as possible" is not "as narrow as syntactically
possible" — it is *the class whose failures this handler genuinely knows how to
answer*. A handler that catches `KeyError` and returns a default is specific and
correct. A handler that catches `Exception` at a request boundary and logs the
traceback is broad and also correct. A handler that catches `Exception` around
`int(value)` because "it might fail somehow" is neither: it is broad *and* not at
a boundary, so it converts every bug in reach into a fallback value.

## Gotchas

**★ Symptom — a handler that filters on `e.errno` or an HTTP status code
swallows everything else.** Cause: the negative branch falls off the end of the
handler instead of re-raising, and reaching the end of a handler means *handled*.
Fix: `if not mine: raise` as the first line of the body — before any logging,
before any state change.

**★ Symptom — `except TimeoutError:` around a `requests` or `httpx` call never
fires.** Cause: those libraries raise their own timeout classes, which are not
subclasses of the built-in. Fix: import the class from the library that raises
it. Note that `asyncio.TimeoutError` *is* the built-in since 3.11, which makes
the general assumption feel safer than it is.

**★ Symptom — `except Exception:` wrapped around a single conversion call
returns a fallback for what is actually a typo in the surrounding code.** Cause:
a broad handler in the middle of business logic rather than at a boundary. Fix:
name the type — `except ValueError:` for `int()`, `except KeyError:` for a
lookup — and let everything else propagate.

**Symptom — an upgrade of a dependency breaks a handler that used to work.**
Cause: the code caught an undocumented leaf exception the library happened to
raise. Fix: catch the library's documented base class, and convert to your own
exception type at your module boundary so the coupling exists in one place.

**Symptom — `except Exception as e:` followed by an `isinstance` chain
mis-dispatches after a refactor.** Cause: the hand-written chain and the
exception hierarchy have diverged; the `elif` order no longer matches
first-match-wins semantics. Fix: separate `except` clauses, which the interpreter
orders for you and a linter can check.

**Symptom — a handler for a family (`OSError`, `LookupError`) responds correctly
to one member and disastrously to another.** Cause: the family was chosen for
convenience, not because every member deserves the same response. Fix: split it —
`FileNotFoundError` gets a default, other `OSError`s propagate.

**Symptom — catching `except ArithmeticError:` does not catch a `decimal`
error.** Cause: `decimal.DivisionByZero` derives from `decimal.DecimalException`
(and `ArithmeticError`), but many `decimal` conditions are signals rather than
raises depending on the context's traps. Fix: check the `decimal` context's trap
configuration; do not assume all numeric failure surfaces as `ArithmeticError`.
See [numbers](../02-numbers/README.md).

## Interview questions

**★ Q: A handler catches `OSError` and only wants `ENOSPC`. How do you write
it?**
Catch `OSError as e`, and make the *first* line of the handler `if e.errno !=
errno.ENOSPC: raise`. Reaching the end of a handler counts as having handled the
exception, so a filter without a re-raise silently swallows everything the filter
rejected. The same shape applies to an HTTP status check or any other
attribute-based discrimination.

**★ Q: How do you decide which exception type to catch?**
The narrowest class whose members all deserve the *same response* — not the
narrowest class that can be raised. If a default value is right for a missing
file but wrong for a permissions error, `FileNotFoundError` is the type, not
`OSError`. If any lookup miss means the same thing, `LookupError` is the type,
not `KeyError` plus `IndexError`.

**★ Q: Why is `except Exception as e:` followed by `isinstance` checks worse
than multiple `except` clauses?**
It reimplements the interpreter's own first-match dispatch by hand; it catches
exceptions it does not intend to handle before deciding to re-raise them; the
`elif` order diverges from the hierarchy the moment two branches overlap; and
neither a reader nor a linter can see what the `try` is actually guarding.

**Q: Is `except TimeoutError:` enough to catch a network timeout?**
Only if the raiser uses the built-in. `asyncio.TimeoutError` is the built-in
since 3.11, but `requests`, `httpx` and most drivers raise their own classes that
do not inherit from it. Import the class from the library that raises it.

**Q: A library raises `KeyError` from an internal dict lookup and you catch it.
What is the risk?**
You have coupled to an undocumented implementation detail; the next release can
raise something else without it being a breaking change. Catch the library's
documented base class instead, and convert to your own exception type at your
module boundary using `raise ... from` so the original is preserved.

**Q: When is catching a *family* like `OSError` the right call?**
When the recovery is genuinely identical for every member — for instance, a
config loader that treats any operating-system failure to read the file as
"unreadable, use defaults, log loudly". The moment one member needs a different
response, the family is the wrong unit and you need the specific class above it.

---

← Prev: [Catching specific types](05-catching-specific-types.md) · Index: [Exceptions](README.md) · Next → [`except ... as e` and the deleted name](05c-the-as-target-is-deleted.md)
