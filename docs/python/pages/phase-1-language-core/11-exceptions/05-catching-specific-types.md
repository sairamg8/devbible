---
title: "Handler search is linear and first-match-wins, so `except` clause order is program logic — and 3.14 finally let you drop the parentheses"
sidebar_label: "5 · Catching specific types"
sidebar_position: 121
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [`except` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-clause),
> [PEP 758](https://peps.python.org/pep-0758/),
> [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations),
> and the Library Reference
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html).
> Syntax acceptance and `SyntaxError` texts checked against CPython 3.14.4.
> Target: **CPython 3.14**.

**A `try` statement's `except` clauses are searched top to bottom and the first
one that matches wins — so ordering them is not formatting, it is control flow. A
base class written above its subclass makes the subclass clause unreachable, and
because matching walks the real MRO, "base class" includes some relationships you
did not think of (`UnicodeDecodeError` is a `ValueError`; `FileNotFoundError` is
an `OSError`). This chunk is the matching rule, the ordering
consequences and the syntax for combining types;
[05b](05b-choosing-the-exception-type.md) is how to decide which type to name in
the first place.**

## The matching rule

> *"For an `except` clause with an expression, the expression must evaluate to an
> exception type or a tuple of exception types. … The raised exception matches an
> `except` clause whose expression evaluates to the class or a non-virtual base
> class of the exception object, or to a tuple that contains such a class."*

and

> *"This search inspects the `except` clauses in turn until one is found that
> matches the exception."*

Two consequences:

- **A clause naming a base catches every subclass.** `except OSError:` catches
  `FileNotFoundError`, `PermissionError`, `TimeoutError` and a dozen others.
- **The search stops at the first match.** Anything below a clause that already
  matches is dead code.

## Ordering: specific first

```python
# WRONG — the second clause can never run
try:
    load(path)
except OSError:
    ...
except FileNotFoundError:      # unreachable: FileNotFoundError IS an OSError
    ...
```

```python
# RIGHT
try:
    load(path)
except FileNotFoundError:
    create_default(path)
except OSError:
    raise ConfigUnreadable(path)
```

Python does not reject the wrong version — the reference makes no ordering
requirement beyond the bare `except:` having to be last — so this is a silent
logic error. `ruff` catches the common case as `B014`
(*redundant exception types*) and the duplicated-clause case as `B025`.

The rule generalises: **write clauses in order of narrowing scope**, and read the
list as an `if`/`elif` chain, because that is exactly what it is.

## Combining types

Two syntaxes for "any of these", and as of Python 3.14 a third:

```python
except (ValueError, TypeError):        # tuple — works on every version
except (ValueError, TypeError) as e:   # tuple — REQUIRED when using `as`
except ValueError, TypeError:          # 3.14+ only (PEP 758), no `as`
```

PEP 758's abstract states the rule exactly:

> *"This PEP proposes to allow unparenthesized `except` and `except*` blocks in
> Python's exception handling syntax only when not using the `as` clause."*

Writing `except ValueError, TypeError as e:` on 3.14.4 is a `SyntaxError` whose
message is `multiple exception types must be parenthesized when using 'as'`.

Two practical notes. First, if your code must run on anything before 3.14, keep
the parentheses — the unparenthesized form is a hard `SyntaxError` there, and
worse, on Python 2 it meant `except ValueError as TypeError`, so the shape has a
history of meaning something else. Second, parentheses cost nothing and make the
`as` and no-`as` forms look the same; the honest recommendation is to keep using
them until 3.14 is your floor.

You can also hold the tuple in a name, which is the right move when the same set
is caught in several places:

```python
RETRYABLE = (ConnectionError, TimeoutError, ServiceUnavailable)

try:
    call()
except RETRYABLE:
    backoff_and_retry()
```

Keep that a module-level constant. An `except` header that has to *compute* the
tuple is a hazard — if the expression raises, [the handler search is cancelled
entirely](01-the-four-clauses.md).

An empty tuple is legal and matches nothing:

```python
except ():          # valid syntax; catches no exception at all
    ...
```

That is occasionally useful when the tuple is configuration-driven — a
`RETRYABLE = ()` setting disables retrying without a special case — but it is a
trap if a filtering expression can produce an empty tuple by accident.

## Gotchas

**★ Symptom — an `except` clause never runs, with no error and no warning.**
Cause: an earlier clause names a base class of it, and the search stops at the
first match. Fix: order specific-to-general. `ruff` `B014` flags the common
shapes; nothing in the interpreter will.

**★ Symptom — `except ValueError:` catches a decoding failure you meant to let
through.** Cause: `UnicodeDecodeError` → `UnicodeError` → `ValueError`. Fix: know
the chain for the types you catch — `IndexError`/`KeyError` under `LookupError`,
`FileNotFoundError`/`TimeoutError` under `OSError`, the `Unicode*` family under
`ValueError`. When in doubt, catch the leaf class.

**Symptom — `SyntaxError: multiple exception types must be parenthesized when
using 'as'` after adopting the 3.14 unparenthesized form.** Cause: PEP 758 allows
the bare list only without `as`. Fix: add the parentheses back for that clause.

**Symptom — a file using `except A, B:` fails to import on 3.13 or earlier with
a confusing error.** Cause: PEP 758 is 3.14+. Fix: keep parentheses until 3.14 is
your minimum supported version; the parenthesized form is valid everywhere.

**Symptom — a configuration-driven `except RETRYABLE:` stops catching
anything.** Cause: the tuple evaluated to `()`, which is legal and matches
nothing. Fix: assert the tuple is non-empty where it is built, or special-case
the empty configuration explicitly.

**Symptom — the `except` line itself raises, and none of the sibling clauses
run.** Cause: an expression in the header failed to evaluate, which cancels the
handler search and treats the whole `try` as having raised. Fix: headers should
be names and tuples of names — never calls, never attribute chains on things
that might be `None`.

**Symptom — duplicate clauses for the same exception, the second one dead.**
Cause: a merge, or a copy-paste. Fix: `ruff` `B025` flags duplicate exception
types across clauses of the same `try`.

## Interview questions

**★ Q: Does the order of `except` clauses matter?**
Yes, entirely. The search *"inspects the `except` clauses in turn until one is
found that matches"*, so a base class placed above its subclass makes the
subclass clause unreachable. Read the clause list as an `if`/`elif` chain and
order specific-to-general. Python does not warn; a linter will.

**★ Q: How do you catch two exception types in one handler?**
A tuple: `except (ValueError, TypeError):`. From Python 3.14, PEP 758 also allows
`except ValueError, TypeError:` without parentheses — but *"only when not using
the `as` clause"*; with `as` the parentheses are still mandatory. On any earlier
version the unparenthesized form is a `SyntaxError`.

**Q: What does `except ():` do?**
Nothing — an empty tuple contains no classes, so nothing matches and the clause
never runs. It is valid syntax, occasionally useful for configuration-driven
retry sets, and a silent bug when a filtering expression produces `()` by
accident.

**Q: Should you use the new unparenthesized form?**
Only if 3.14 is your minimum version, and even then it is a coin flip: the
parenthesized form works everywhere, looks identical to the `as` form which still
requires parentheses, and does not resemble the Python 2 syntax where a comma
meant something completely different.

---

← Prev: [The bare `except:`](04b-the-bare-except.md) · Index: [Exceptions](README.md) · Next → [Choosing the exception type](05b-choosing-the-exception-type.md)
