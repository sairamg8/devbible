---
title: "ContextDecorator lets the same factory be spelled with an @ instead of a with, which is free on every @contextmanager — but the decorator form has nowhere to put an as target, still suppresses if the manager suppresses, and wraps only the call, which is not the same as the body when the body is a generator"
sidebar_label: "06w · The decorator form"
sidebar_position: 154
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html) (`ContextDecorator` and
> the sentence tying it to `@contextmanager`). Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**[06v](06v-one-yield-and-one-use.md) ended on the rule that you keep the factory and never the
manager. `ContextDecorator` is what that rule buys you: a factory written for `with` can be
applied to a whole function with an `@`, and the caller then holds no manager at all. It costs
nothing to adopt — every `@contextmanager` result already has it. What it does not do is change
any of the semantics: a manager that suppresses still suppresses, and the visible symptom simply
changes from "execution continued after the block" to "the function returned `None`". Two
structural limits follow from the form rather than from the library: the decorator has nowhere to
bind an `as` target, and it wraps the *call*, which stops meaning "the body" the moment the
decorated function is a generator function.**

## It is free on every `@contextmanager`

> *"A base class that enables a context manager to also be used as a decorator."*

> *"`ContextDecorator` is used by `@contextmanager`, so you get this functionality
> automatically."*

So a factory written for `with` needs no change to be used as a decorator:

```python
from contextlib import contextmanager

@contextmanager
def timed(metrics, label):
    start = time.perf_counter()
    try:
        yield
    finally:
        metrics.timing(f"{label}.duration_ms", (time.perf_counter() - start) * 1000)

@timed(metrics, "import_orders")
def import_orders(rows):
    for row in rows:
        upsert_order(row)
```

The two spellings are for two different scopes. `with` scopes the manager to a *region* of a
function; `@` scopes it to *the whole function*, and puts that fact in the signature where a
reader sees it before the body. Reach for `@` when the manager applies to everything the function
does — timing, a lock held for the duration, a temporary working directory — and for `with` the
moment there is a line that should be outside it.

⚠️ **The mechanism by which a decorated function can be called repeatedly, despite the manager
being single use, is not stated on the page I verified against.** The documented facts are the
two sentences above; build on those, not on an assumption about how the manager is rebuilt per
call.

## The decorator arguments are evaluated once, at `def` time

`@timed(metrics, "import_orders")` is a call. It runs when the `def` is executed — at import, for
a module-level function — and whatever it captures is captured then, for the life of the process:

```python
conn = connect(DATABASE_URL)          # opened at import to satisfy the decorator

@advisory_lock(conn, ORDER_LOCK_KEY)  # 🔴 this conn is frozen into the decoration
def place_order(order):
    insert_order(conn, order)
```

That is fine for a metrics client and wrong for anything per-request. When the manager needs a
value the *caller* supplies, the decorator form cannot express it and `with` inside the body is
the answer:

```python
def place_order(conn, order):
    with advisory_lock(conn, ORDER_LOCK_KEY):
        insert_order(conn, order)
```

## Two things the decorator form cannot do

**It has nowhere to put an `as` target.** The value `__enter__` returns is bound by the `with`
statement's `as` clause; a decorator has no clause and no name to bind. A function that needs the
entered resource must take the `with` inside:

```python
@contextmanager
def temp_workspace():
    path = tempfile.mkdtemp(prefix="orders-")
    try:
        yield pathlib.Path(path)
    finally:
        shutil.rmtree(path, ignore_errors=True)

def export_orders(rows):
    with temp_workspace() as workspace:     # the decorator form could not name `workspace`
        write_csv(workspace / "orders.csv", rows)
        upload(workspace / "orders.csv")
```

A decorator is still usable when the resource is *ambient* rather than named — a lock, a changed
working directory, a redirected stream — because the body reaches it through the environment
instead of through a name.

**It wraps the call, not the body.** For an ordinary function those are the same thing. For a
generator function they are not: calling a generator function builds a generator and returns
immediately, without running a single line of the body.

```python
@timed(metrics, "stream_orders")
def stream_orders(conn):                # 🔴 the timer measures the construction of a
    for row in conn.stream(query):      #    generator object, not the streaming
        yield transform(row)
```

The manager is entered and exited around the construction, so the timing is meaningless and — for
a manager that holds a lock or a temporary directory — the resource is already released before
the consumer iterates a single item. The fix is a `with` inside the generator body, which does
span the iteration:

```python
def stream_orders(conn):
    with timed(metrics, "stream_orders"):
        for row in conn.stream(query):
            yield transform(row)
```

## A class-based manager can take the same route

A manager written as a class is not callable, so decorating with it fails until it inherits the
base class:

> *"Context managers inheriting from `ContextDecorator` have to implement `__enter__()` and
> `__exit__()` as normal. `__exit__` retains its optional exception handling even when used as a
> decorator."*

```python
from contextlib import ContextDecorator

class chdir_to(ContextDecorator):
    def __init__(self, path):
        self.path = path

    def __enter__(self):
        self.previous = os.getcwd()
        os.chdir(self.path)

    def __exit__(self, exc_type, exc, tb):
        os.chdir(self.previous)

@chdir_to("/srv/exports")
def write_manifest(entries):
    with open("manifest.json", "w") as fp:
        json.dump(entries, fp)
```

Note which half of that quote is the warning. *"`__exit__` retains its optional exception
handling even when used as a decorator"* means the suppression rule of 06o survives the change of
spelling — a truthy `__exit__` still swallows, and the caller of `write_manifest` sees a normal
return instead of a raise.

## Gotchas

**★ Symptom: a decorated function returns `None` instead of raising, and the caller treats the
`None` as a real answer.** Cause: the manager suppresses — a truthy `__exit__`, or a generator
that trapped the exception without reraising — and *"`__exit__` retains its optional exception
handling even when used as a decorator"*. The body never reached its `return`, so the wrapper had
nothing to hand back. Fix: reraise in the manager; the decorator form gives you no separate
control over this.

```python
@contextmanager
def timed(metrics, label):
    start = time.perf_counter()
    try:
        yield
    except Exception:
        metrics.increment(f"{label}.failure")
        raise                                   # the decorated function raises, as it should
    finally:
        metrics.timing(f"{label}.duration_ms", (time.perf_counter() - start) * 1000)
```

**★ Symptom: a decorator on a generator function reports a duration near zero, or releases a lock
before the consumer has read anything.** Cause: the decorator wraps the *call*, and calling a
generator function returns a generator without executing the body. The manager is entered and
exited around that construction. Fix: put the `with` inside the generator, where it spans the
iteration.

```python
def stream_orders(conn):
    with timed(metrics, "stream_orders"):
        for row in conn.stream(query):
            yield transform(row)
```

**★ Symptom: a per-request resource is shared across every request, or a connection opened at
import is still in use hours later.** Cause: the decorator expression is evaluated when the `def`
executes, so its arguments are bound once for the process. Fix: take the value as a parameter and
use `with` in the body.

```python
def place_order(conn, order):
    with advisory_lock(conn, ORDER_LOCK_KEY):
        insert_order(conn, order)
```

**Symptom: applying a hand-written context manager class as a decorator fails, because the
manager instance is not callable.** Cause: only managers deriving from `ContextDecorator` gain
the decorator behaviour — it is *"a base class that enables a context manager to also be used as
a decorator"*, and nothing else in the protocol implies it. Fix: inherit it; `__enter__` and
`__exit__` stay exactly as they were.

```python
class chdir_to(ContextDecorator):
    def __enter__(self):
        self.previous = os.getcwd()
        os.chdir(self.path)

    def __exit__(self, exc_type, exc, tb):
        os.chdir(self.previous)
```

**Symptom: the function needs the object the manager produced, and the decorator gives no way to
name it.** Cause: `as` is a clause of the `with` *statement*; a decorator has no equivalent. Fix:
use `with` inside the function — and read the limitation as a signal, since a manager whose
product the body needs is usually scoped to part of the function rather than all of it.

```python
def export_orders(rows):
    with temp_workspace() as workspace:
        write_csv(workspace / "orders.csv", rows)
```

## Interview questions

**★ What is the difference between decorating a function with a context manager and putting a
`with` as its first statement?**
For an ordinary function, nothing semantically — both enter before the body and exit after it.
The differences are in scope and in what the reader sees. The decorator applies to the entire
function and announces itself in the signature, which is right when the manager is a property of
the function (this function is timed, this function runs under the export directory). A `with`
can cover part of the body, can bind an `as` target, and can take arguments the caller passed in.
And for a generator function the two are genuinely different: the decorator wraps the call that
constructs the generator, while a `with` inside the body wraps the iteration.

**★ A colleague decorates a generator function with `@timed(...)`. What actually gets measured?**
The construction of the generator object, which does essentially no work — calling a generator
function runs none of the body. So the timer opens and closes before the first item is produced,
and the metric is meaningless. Worse, if the manager held something — a lock, a temporary
directory, a database transaction — it is released while the consumer still believes it is
inside. The fix is a `with` inside the generator body, and the general rule is that a decorator's
"scope" is the call, and the call and the body coincide only for functions that are not
generators.

**★ Why does a decorated function silently return `None` when the manager suppresses?**
Because the body did not reach its `return`. The manager swallowed the exception — either a
truthy `__exit__` or a generator that trapped without reraising — and *"`__exit__` retains its
optional exception handling even when used as a decorator"*, so the wrapper resumes after the
managed block with no value to give back. In a `with` block, suppression is at least visible as
execution continuing at a statement you can point to; in the decorator form it becomes a `None`
that travels into the caller and fails somewhere else entirely. That asymmetry is a reason to be
stricter about suppression in a manager you intend to use as a decorator.

**Why does `@timed(metrics, "import_orders")` work as a decorator when the manager it produces
can only be entered once?**
Because the decorator machinery, not the manager, is what handles repeated calls: the base class
*"enables a context manager to also be used as a decorator"*, and *"`ContextDecorator` is used by
`@contextmanager`, so you get this functionality automatically"*. Entering a single-use manager
twice raises `RuntimeError: generator didn't yield` ([06v](06v-one-yield-and-one-use.md)), and yet
a decorated function can be called in a loop — so the two facts coexist only if something builds a
fresh manager per call. ⚠️ The `contextlib` page I verified against does not state that mechanism,
so the honest answer stops there: the decorator form is documented as supported, and how it is
implemented is not something to design against.

**When would you make a class inherit `ContextDecorator` rather than writing a
`@contextmanager`?**
When the manager has state or configuration that belongs to an object — a depth counter for
reentrancy, a saved previous value to restore, a handle that other methods also need — or when
you want a manager that is genuinely reusable across many `with` statements, which a generator
result can never be ([06v](06v-one-yield-and-one-use.md)). Inheriting the base class costs one
name in the class statement and changes nothing else: *"Context managers inheriting from
`ContextDecorator` have to implement `__enter__()` and `__exit__()` as normal."* For everything
else the generator form is shorter and the decorator behaviour arrives with it anyway, since
*"`ContextDecorator` is used by `@contextmanager`"*.

---

← Prev: [One yield and one use](06v-one-yield-and-one-use.md) · Index: [EAFP vs LBYL](README.md) · Next → [`closing` — a `close()` method is enough](06x-closing-a-close-method-is-enough.md)
