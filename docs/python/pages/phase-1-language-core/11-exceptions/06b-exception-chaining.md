---
title: "`__context__` happens to you, `__cause__` is something you say: the two chains, and why `from None` hides an exception without deleting it"
sidebar_label: "6b · Exception chaining"
sidebar_position: 125
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement),
> the Library Reference
> [`BaseException.__cause__`](https://docs.python.org/3.14/library/exceptions.html#BaseException.__cause__),
> [`__context__`](https://docs.python.org/3.14/library/exceptions.html#BaseException.__context__),
> [`__suppress_context__`](https://docs.python.org/3.14/library/exceptions.html#BaseException.__suppress_context__),
> [`add_note`](https://docs.python.org/3.14/library/exceptions.html#BaseException.add_note),
> the [Tutorial — raising exceptions with `from`](https://docs.python.org/3.14/tutorial/errors.html#exception-chaining),
> and [PEP 3134](https://peps.python.org/pep-3134/), [PEP 678](https://peps.python.org/pep-0678/).
> Target: **CPython 3.14**.

Two exceptions can be linked, and Python has two different links for it. One is
automatic and means *this happened while that was being handled*. The other is
deliberate and means *this happened because of that*. They print differently,
they live in different attributes, and the difference is the difference between
a traceback that explains a failure and one that merely reports two of them.

## The implicit chain: `__context__`

You get this one for free, whether you want it or not. The reference:

> A similar mechanism works implicitly if a new exception is raised when an
> exception is already being handled. An exception may be handled when an
> `except` or `finally` clause, or a `with` statement, is used. The previous
> exception is then attached as the new exception's `__context__` attribute

```python
try:
    config = data["timeout"]
except KeyError:
    config = int(os.environ["TIMEOUT"])   # KeyError again -> chained
```

If the environment variable is missing too, the second `KeyError` carries the
first in `__context__`, and the interpreter prints both, separated by *"During
handling of the above exception, another exception occurred:"*. That sentence is
a statement about **timing**, not causation — which is why it is so often the
signal that your handler itself is broken.

Note the three places that count as handling: `except`, `finally`, **and a
`with` statement**. An exception raised by `__exit__` chains the one that was
propagating through it.

## The explicit chain: `__cause__`

```python
try:
    func()
except ConnectionError as exc:
    raise RuntimeError('Failed to open database') from exc
```

The reference:

> The `from` clause is used for exception chaining: if given, the second
> expression must be another exception class or instance. If the second
> expression is an exception instance, it will be attached to the raised
> exception as the `__cause__` attribute (which is writable). If the expression
> is an exception class, the class will be instantiated

Two consequences that are easy to miss. **`from SomeError`** — a class, not an
instance — is legal and instantiates it, so you get a cause with no message,
which is almost never what you meant. And per the library reference, *"Setting
`__cause__` also implicitly sets the `__suppress_context__` attribute to
`True`"*: an explicit cause replaces the implicit context **in the display**,
because saying *because of that* is strictly more informative than *while that
was happening*.

The interpreter's wording for a cause is *"The above exception was the direct
cause of the following exception:"*.

## `from None`: a display decision, not a deletion

```python
try:
    return self._cache[key]
except KeyError:
    raise AttributeError(key) from None
```

This is the `__getattr__` idiom: a `KeyError` from an internal dict is an
implementation detail, and letting it print would leak the storage into every
traceback. The library reference is precise about what happens:

> Using `raise new_exc from None` effectively replaces the old exception with
> the new one for display purposes (e.g., converting `KeyError` to
> `AttributeError`), while leaving the old exception available in `__context__`
> for introspection when debugging.

🔴 **`from None` sets `__suppress_context__`; it does not clear
`__context__`.** The original is still on the object, reachable in a debugger or
in a logging handler that walks the chain. That is the argument for using it
where it genuinely reduces noise — and the argument against reaching for it to
make a confusing traceback quieter, because the confusion is the information.

## When to wrap, and when to let it fly

Chaining is a boundary tool. The useful rule is that an exception should be
translated when it crosses a layer whose callers cannot be expected to know the
layer below:

```python
class RepositoryError(Exception):
    """Anything the storage layer could not do."""

def get_user(conn, user_id):
    try:
        row = conn.execute(SELECT_USER, (user_id,)).fetchone()
    except sqlite3.Error as exc:
        raise RepositoryError(f"could not load user {user_id}") from exc
    if row is None:
        raise UserNotFound(user_id)
    return User(*row)
```

The caller catches `RepositoryError` and never imports `sqlite3`. The DBA
reading the log still gets the driver's message, because `from exc` kept it.

Inside a single layer, do not wrap. A `ValueError` from your own validation
helper does not need a `ValidationError` around it — it needs to reach the
handler that already knows what to do with it.

## `add_note` is the cheaper option

When you want to add *context* rather than a new exception type, PEP 678's
`add_note` (3.11) attaches a string to the existing exception and re-raises it
unchanged:

```python
try:
    process(record)
except Exception as exc:
    exc.add_note(f"while processing record {record.id} from {path}")
    raise
```

The class, the traceback and the original message all survive; the note prints
after the exception line. This is strictly better than
`raise RuntimeError(f"record {record.id}") from exc` when you have nothing new
to *say about the kind* of failure — you are only saying **which** one.

`add_note` raises `TypeError` if the note is not a string, and the notes live in
`__notes__`, which is created on first use.

## Reading a chain in a log

Three links, three meanings, and the order they print in is oldest-first:

| Attribute | Set by | Printed as | Means |
|---|---|---|---|
| `__context__` | automatic, while handling | *During handling of the above exception…* | these two happened in sequence |
| `__cause__` | `raise … from exc` | *The above exception was the direct cause…* | the second is a consequence of the first |
| `__notes__` | `add_note(str)` | after the exception message | extra facts about **this** exception |

`traceback.format_exc()` and every handler in `logging` walk the chain by
default — `chain=True` — so you get all of it for free unless something in your
stack formats `str(exc)` instead. That failure mode is
[losing the traceback](13-losing-the-traceback.md).

## Gotchas

**★ Symptom — the traceback says "During handling of the above exception,
another exception occurred" and the *second* exception is inside your own
`except` block.** Cause: the handler is broken, and the implicit chain is
telling you so. It is not a chaining problem, it is a bug in the recovery path
— the classic being a `KeyError` in the code that formats the error message.
Fix: read the **bottom** exception first; it is the one your handler caused.

```python
except KeyError as exc:
    log.error("missing field %s in %s", exc.args[0], record["id"])  # KeyError again
    log.error("missing field %s in %r", exc.args[0], record)        # fix: no lookup
```

**★ Symptom — a wrapped exception loses the original message, and the log says
only "database error".** Cause: the wrap re-created the message instead of
chaining — `raise RepositoryError(str(exc))`, or worse
`raise RepositoryError("database error")`. Fix: `from exc`, and keep your own
message about *your* layer.

```python
raise RepositoryError(f"could not load user {user_id}") from exc
```

**★ Symptom — `from None` was added to tidy the logs and now nobody can
diagnose the failure.** Cause: the suppression was applied to a boundary where
the inner exception *was* the diagnosis, not an implementation detail. Fix:
drop the `from None`, or keep it and log `exc.__context__` explicitly if the
display really must stay clean.

```python
except KeyError as exc:
    log.debug("cache miss detail", exc_info=exc.__context__)  # still reachable
    raise AttributeError(name) from None
```

**★ Symptom — `TypeError: exception causes must derive from BaseException`.**
Cause: something that is not an exception was passed after `from` — a string, a
dict, an error code, or a variable that held `exc.args[0]` rather than `exc`.
Fix: pass the exception instance; put the string in your own message.

**★ Symptom — the cause in the traceback has no message at all, just the class
name.** Cause: `raise X from SomeError` passed the **class**, which the
reference says is instantiated — with no arguments, so no message. Fix: pass
the instance you caught.

```python
except OSError as exc:
    raise ConfigError("cannot read config") from exc     # not: from OSError
```

**★ Symptom — a retry loop produces a traceback with five nested "during
handling" sections and the real cause is unreadable.** Cause: each attempt
raised inside the handler for the previous one, so every failure chained onto
the last. Fix: collect the attempts and raise once — an `ExceptionGroup` if
they are genuinely different failures, or `add_note` for the count.

```python
errors = []
for attempt in range(3):
    try:
        return call()
    except TransientError as exc:
        errors.append(exc)
raise ExceptionGroup("all retries failed", errors)
```

**★ Symptom — `raise exc from exc.__context__` or similar hand-wiring produces a
cycle and the formatter loops or truncates.** Cause: an exception was made its
own ancestor. Fix: never assign the chain by hand; `raise … from exc` and
`add_note` cover the real cases. If you must set it, assign `__cause__` once,
to an exception that is not in the chain already.

## Interview questions

**★ Q: What is the difference between `__cause__` and `__context__`?**
`__context__` is set automatically when an exception is raised while another one
is being handled — in an `except`, a `finally`, or a `with` — and prints as
"During handling of the above exception, another exception occurred". It is a
statement about sequence. `__cause__` is set only by `raise … from exc`, prints
as "The above exception was the direct cause of the following exception", and is
a statement about causation. Setting a cause also sets `__suppress_context__`,
so the explicit link wins the display.

**★ Q: What exactly does `raise … from None` do?**
It sets `__suppress_context__` to `True`, which stops the implicit context from
being **displayed**. The docs are explicit that the old exception is still
available in `__context__` for introspection. So it is a formatting decision,
not a deletion — useful in `__getattr__` where an internal `KeyError` would leak
the storage layer, dangerous anywhere the suppressed exception was the actual
diagnosis.

**★ Q: When should you wrap an exception rather than let it propagate?**
When it crosses a boundary whose callers should not know the layer below —
a repository turning `sqlite3.Error` into `RepositoryError`, a client turning
`httpx.HTTPError` into `PaymentGatewayError`. Always with `from exc`. Within one
layer, wrapping only adds a class and destroys the specificity the caller needed.

**Q: You want to add "which record failed" to an exception without changing its
type. What is the tool?**
`exc.add_note(...)` then a bare `raise` (PEP 678, 3.11). The type, message and
traceback are untouched and the note prints after the exception line. Wrapping
would have replaced the type for no reason.

**Q: What does a bare `raise` do outside a handler?**
Raises `RuntimeError`. The reference says a bare `raise` re-raises the active
exception, and if there isn't one, `RuntimeError` is raised "indicating that
this is an error". This is why a bare `raise` in a `finally` that is *not*
running because of an exception is a bug, not a no-op.

**Q: Does chaining cost anything?**
It keeps the earlier exception object — and therefore its traceback and every
frame it references — alive as long as the outer one lives. That is the same
reference-cycle concern behind [the deleted `as` target](05c-the-as-target-is-deleted.md),
and the reason not to stash exceptions on long-lived objects.

---

← Prev: [The `raise` statement](06-the-raise-statement.md) · Index: [Exceptions](README.md) · Next → [Custom exceptions](07-custom-exceptions.md)
