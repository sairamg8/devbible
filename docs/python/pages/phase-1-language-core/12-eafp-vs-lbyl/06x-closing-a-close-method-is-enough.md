---
title: "closing() is five published lines that turn any object with a close() method into a context manager, and reading those five lines tells you the three things it promises and the two it does not"
sidebar_label: "06x · `closing` — a `close()` is enough"
sidebar_position: 155
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html) (`closing`, its published
> equivalent implementation, and the Note on third-party types) — and the Python 3.14 Language
> Reference,
> [The `with` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement)
> (step 1, for where the context expression is evaluated). Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**The commonest form of "the object does not cooperate" is the smallest: a client that has a
perfectly good `close()` and no `__exit__`. `closing()` is the adapter, and it is unusual among
standard-library helpers in that the documentation publishes its entire implementation — five
lines. That matters more than the convenience, because those five lines answer every question you
might otherwise guess at: it calls the method named `close` and no other, it calls it from a
`finally` so the exception path is covered, and it has no `except`, so it can never suppress
anything of yours. It also shows you the two things it cannot do — it does not cover the
construction of the object, and it does not make a double close safe.**

## Why it exists, in the docs' own words

> *"Most types managing resources support the context manager protocol, which closes thing on
> leaving the `with` statement. As such, `closing()` is most useful for third party types that
> don't support context managers."*

That is the whole selection rule. Files, sockets, database connections from a modern driver and
almost everything in the standard library already implement `__enter__` and `__exit__`; wrapping
those in `closing()` adds a layer that does nothing. The population it is for is narrow and
identifiable: an SDK generated from a WSDL, a vendor client written before 2010, an internal
utility class nobody has revisited.

```python
from contextlib import closing

with closing(LegacySoapClient(endpoint)) as client:
    client.submit(order_payload)
```

## The five published lines, and what each one settles

> *"Return a context manager that closes thing upon completion of the block. This is basically
> equivalent to:"*

```python
from contextlib import contextmanager

@contextmanager
def closing(thing):
    try:
        yield thing
    finally:
        thing.close()
```

> *"…without needing to explicitly close `page`. Even if an error occurs, `page.close()` will be
> called when the `with` block is exited."*

Three promises are visible in that code and are worth stating as promises:

- **It calls `close`, by that name.** There is no protocol negotiation and no duck-typed search
  for a plausible teardown method.
- **It uses `finally`.** The close happens on the exception path, which is the sentence the docs
  add underneath: *"Even if an error occurs, `page.close()` will be called."*
- **It has no `except`, so it never suppresses.** Whatever left your block leaves the `with`
  statement too. That is exactly the property you want from a wrapper whose semantics you did not
  choose — compare a hand-written `@contextmanager`, where forgetting a `raise` silences callers
  ([06q](06q-contextlib-when-the-object-does-not-cooperate.md)).

And two non-promises, equally visible:

- **It does not cover construction.** `closing(LegacySoapClient(endpoint))` evaluates the
  constructor as part of the context expression at step 1 of the `with` statement — before the
  manager exists, before `__enter__`, and therefore outside 06p's guarantee entirely.
- **It does not make `close()` idempotent or safe.** If `close()` raises, the raise happens in a
  `finally` and displaces whatever the block was already raising, exactly as 06o's `__exit__`
  gotcha describes.

## When to reach for it instead of writing `__exit__`

**If you own the class, implement the protocol.** A caller then cannot forget the wrapper, the
lifetime is documented on the object, and `closing` disappears from every call site at once:

```python
class ReportClient:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()

    def close(self):
        self._session.close()
```

**If you do not own it, wrap at the call site.** Do not subclass a vendor class to bolt on
`__enter__` — the wrapper is one line, it is local to the code that actually needs the guarantee,
and it is deleted the day upstream ships the protocol itself. A subclass, by contrast, is a
permanent piece of your type hierarchy standing between you and every upgrade.

It also works on anything else that answers to `close()`, including a generator you want to
finalise promptly rather than at an unpredictable collection time:

```python
def stream_rows(conn, query):
    cursor = conn.cursor()
    try:
        cursor.execute(query)
        yield from cursor
    finally:
        cursor.close()

with closing(stream_rows(conn, ORDERS_QUERY)) as rows:
    for row in rows:
        if row.total > threshold:
            break                    # the generator's finally runs here, not later
```

## Gotchas

**★ Symptom: `AttributeError` naming `close`, raised from inside `closing()`.** Cause: the
published implementation calls `thing.close()` and nothing else — a client whose teardown is
`disconnect()`, `shutdown()`, `release()` or `quit()` is not covered. Fix: write the same five
lines against the right method name; that is all `closing` is.

```python
from contextlib import contextmanager

@contextmanager
def disconnecting(client):
    try:
        yield client
    finally:
        client.disconnect()
```

**★ Symptom: a socket or file descriptor leaks even though the client is wrapped in
`closing()`.** Cause: the constructor runs as part of the context expression, evaluated at step 1
of the `with` statement — if it acquires a socket and then raises while handshaking, no manager
was ever built and 06p's guarantee never started. `closing` wraps a *finished* object. Fix: make
the construction itself a manager, so the partial state has an owner.

```python
@contextmanager
def soap_client(endpoint):
    client = LegacySoapClient(endpoint)
    try:
        client.handshake()
        yield client
    finally:
        client.close()
```

**★ Symptom: a pooled connection stops being reusable after one request, and the pool drains.**
Cause: `closing()` was wrapped around something whose correct teardown is *return to the pool*,
not *close*. The helper is named for what it does; it will close a pooled connection just as
happily as a private one. Fix: use the object's own release path.

```python
@contextmanager
def pooled(pool):
    conn = pool.acquire()
    try:
        yield conn
    finally:
        pool.release(conn)          # not conn.close()
```

**Symptom: the real error is hidden and the traceback ends inside `close()`.** Cause: the close
runs in a `finally`, so an exception it raises displaces the exception the block was already
raising — the original survives only on `__context__`. `closing()` adds no protection against
this, and the five published lines show exactly why. Fix: if the teardown is known to be flaky,
handle it in your own wrapper rather than using `closing`.

```python
@contextmanager
def closing_quietly(thing):
    try:
        yield thing
    finally:
        try:
            thing.close()
        except OSError:
            log.warning("close failed", exc_info=True)   # does not displace the real error
```

**Symptom: a reviewer asks why `with closing(open(path)) as fp:` is written that way.** Cause:
the object already implements the protocol, so the wrapper is inert decoration — the docs are
direct that *"`closing()` is most useful for third party types that don't support context
managers"*, and that their own example *"is purely for illustration purposes"*. Fix: enter the
object directly.

```python
with open(path, encoding="utf-8") as fp:
    header = fp.readline()
```

**Symptom: an exception the block raised vanishes, and `closing()` gets the blame.** Cause: it
was not `closing()` — the published implementation has no `except` clause, so it cannot suppress
anything. Look at the manager nested inside, or at a hand-written `@contextmanager` in the same
statement. Fix: none for `closing`; this gotcha exists to stop you spending an hour on the wrong
suspect.

## Interview questions

**★ When do you use `closing()` rather than implementing `__enter__` and `__exit__`?**
When you do not own the class. The docs put it exactly: *"`closing()` is most useful for third
party types that don't support context managers."* If you own the type, implementing the protocol
is strictly better — a caller who forgets the wrapper still gets cleanup, and the object documents
its own lifetime instead of relying on every call site to remember. If you do not own it,
`closing` is a local, deletable one-liner with no semantics of its own to get wrong: its published
equivalent is a `try` / `finally` around `thing.close()` with no `except`, so it cannot swallow
your exceptions and cannot skip the close.

**★ Where does `closing()` stop helping?**
Three places, all readable off the five published lines. The teardown method must literally be
called `close`, so a `disconnect()` needs your own wrapper. It only covers a fully constructed
object, because the constructor is part of the context expression evaluated at step 1 — an object
that opens a socket in `__init__` and then raises has leaked it before any manager existed. And
it offers no protection when `close()` itself raises: that raise happens inside a `finally` and
displaces the exception the block was raising. None of those are surprises if you read the
implementation; all of them are surprises if you read only the one-line description.

**★ Why is publishing the equivalent implementation more useful than describing the behaviour?**
Because it settles questions the prose does not raise. From `try: yield thing / finally:
thing.close()` you can immediately answer *does it close on the error path* (yes), *can it
suppress my exception* (no — there is no `except`), *does it call anything other than `close`*
(no), and *what happens if `close()` raises* (it propagates from a `finally`). A description would
have had to anticipate each of those. It is the argument for reading source or an equivalent
implementation whenever a helper sits on your cleanup path: five lines answer more questions than
five sentences.

**Is `with closing(x)` any different from writing `try` / `finally` around `x.close()` by hand?**
Semantically, no — that is precisely what the docs say it is *"basically equivalent to"*. The
difference is in what the two shapes resist. The hand-written version invites edits: someone adds
an `except` to log something and forgets the `raise`, or moves the acquisition inside the `try`,
or adds a second resource and unwinds it in the wrong order. `closing()` has no interior to edit,
its name states the whole contract, and it composes — an `ExitStack` can register it, a multi-item
`with` can nest it. The value is not brevity; it is that the cleanup stops being code anyone can
change.

---

← Prev: [The decorator form](06w-the-decorator-form.md) · Index: [EAFP vs LBYL](README.md) · Next → [`suppress`](06z-suppress.md)
