---
title: "The with statement guarantees cleanup only once __enter__ has returned, so a manager that acquires two things leaks the first — and multi-item nesting is the fix, because it makes each acquisition a suite the previous manager is already cleaning up after"
sidebar_label: "06p · The guarantee and the nesting"
sidebar_position: 151
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `with` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement)
> (the guarantee note attached to step 5, the target-assignment sentence, the multi-item
> equivalence, and the version notes for 3.1 and 3.10). Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**[06o](06o-with-is-the-sanctioned-form.md) showed what `with` decides before it begins.
This page is the one thing it does *not* promise. The guarantee that `__exit__` runs is
conditional — the reference attaches it to step 5 and words it as "if the `__enter__()`
method returns without an error" — so a manager that acquires two resources and fails on the
second has leaked the first, permanently, with no clause anywhere that will release it. The
same paragraph draws the boundary in the other direction: a failure in the `as` target
assignment is late enough to count as inside the block and does get cleanup. And multi-item
nesting is not sugar for saving a line; it is the structural repair for the leak, because it
turns the second acquisition into code running inside the first manager's suite. When the
object cannot be made to fit the protocol at all, that is
[06q](06q-contextlib-when-the-object-does-not-cooperate.md).**

## The guarantee is conditional on `__enter__` succeeding

The promise is a Note attached to step 5, and its precision is the point:

> *"The `with` statement guarantees that if the `__enter__()` method returns without an
> error, then `__exit__()` will always be called. Thus, if an error occurs during the
> assignment to the target list, it will be treated the same as an error occurring within
> the suite would be."*

**If `__enter__` itself raises, `__exit__` is never called** — `__enter__` is step 4 and
`__exit__` is step 7, so a raise at step 4 means steps 5 to 7 do not happen. The second
sentence draws the line exactly: a failure in the *target assignment* at step 5 is late
enough to count as inside the block, and does get cleanup. A failure at step 4 is not.

So a context manager that acquires two things in `__enter__` and fails on the second has
leaked the first, and no amount of `with` will clean it up:

```python
class Transaction:
    def __enter__(self):
        self.conn = pool.acquire()
        self.cur = self.conn.cursor()   # 🔴 if this raises, __exit__ never runs
        return self.cur                 #    and self.conn is leaked forever
```

`__enter__` must therefore be its own transaction — clean up after itself on the way out:

```python
class Transaction:
    def __enter__(self):
        self.conn = pool.acquire()
        try:
            self.cur = self.conn.cursor()
        except Exception:
            self.conn.release()         # __exit__ will not run; this is the only chance
            raise
        return self.cur

    def __exit__(self, exc_type, exc, tb):
        self.cur.close()
        self.conn.release()
```

Notice which rule that `try` / `except` obeys. It is 06n's second question — *can the cleanup
raise?* — answered inside `__enter__`, where the acquisition either completes or unwinds. The
`with` statement gives you the lifetime only after that point; before it, you are writing the
same longhand a `finally` would have needed.

## Acquiring in `__init__` is outside the guarantee entirely

The same note explains a subtler leak. Step 1 evaluates the context expression to *obtain* the
manager, and only step 4 invokes `__enter__` — so anything a constructor acquires is held
before the guarantee starts, and is released only if the statement reaches step 7:

```python
class Reader:
    def __init__(self, path):
        self.fp = open(path)          # 🔴 acquired at step 1, outside the guarantee

    def __enter__(self):
        return self.fp

    def __exit__(self, exc_type, exc, tb):
        self.fp.close()
```

`Reader(path)` on its own — in a comprehension, in a list of managers built ahead of time, in
a line that raises before the `with` is entered — opens a file that nothing will close. Move
the acquisition into `__enter__` and the object becomes inert until the statement takes
responsibility for it:

```python
class Reader:
    def __init__(self, path):
        self.path = path              # inert: constructing a Reader acquires nothing

    def __enter__(self):
        self.fp = open(self.path)     # acquired at step 4; step 7 is now guaranteed
        return self.fp

    def __exit__(self, exc_type, exc, tb):
        self.fp.close()
```

## Step 5 assigns what `__enter__` returned, not the manager

The `as` target receives *"the return value from `__enter__()`"*, which is why `return self`
is the near-universal last line of an `__enter__`. A method that falls off the end returns
`None`, and the statement dutifully binds it:

```python
class Session:
    def __enter__(self):
        self.conn = pool.acquire()    # no return statement
    def __exit__(self, exc_type, exc, tb):
        self.conn.release()

with Session() as session:
    session.execute(query)            # AttributeError: 'NoneType' has no attribute 'execute'
```

The manager still works — cleanup runs correctly, because the statement is holding the object
from step 1 and not the value from step 5. Only the name is wrong. That is worth knowing
because it splits a class of bug in two: `as` binding the wrong thing is a return-value
mistake, while cleanup not running is a guarantee mistake, and they have nothing to do with
each other.

## Multiple items nest, and nesting decides cleanup order

> *"With more than one item, the context managers are processed as if multiple `with`
> statements were nested"* — so `with A() as a, B() as b:` is *"semantically equivalent to"*
> `with A() as a:` containing `with B() as b:`.

Two consequences worth holding. Cleanup runs **inside-out**: `B.__exit__` before
`A.__exit__`, which is what you want when B was acquired from A. And a failure in `B()`'s
construction happens *inside* A's `with`, so `A.__exit__` does run — unlike the
single-manager `__enter__` case above.

🔴 **That second consequence is the cheap fix for the `Transaction` leak.** One acquisition
per manager, and the nesting unwinds them; the hand-written `try` / `except` inside `__enter__`
becomes unnecessary because the second acquisition is no longer happening in a place the
statement has not yet started guarding:

```python
with pool.acquire() as conn, conn.cursor() as cur:
    cur.execute(query)            # conn.cursor() runs inside conn's with; conn is released
```

The parenthesised multi-line form, supported since 3.10, is the same statement:

```python
with (
    pool.acquire() as conn,
    conn.cursor() as cur,
):
    cur.execute(query)
```

Multiple context expressions in one `with` have been legal since 3.1; only the grouping
parentheses are recent. A codebase pinned below 3.10 writes genuinely nested statements
instead — the semantics are identical, because the reference defines the one-line form *in
terms of* the nested form.

## Gotchas

**★ Symptom: connections leak only when the database is slow, and the pool eventually
starves.** Cause: `__enter__` acquired the connection and then raised while opening a
cursor. The guarantee is conditional — *"if the `__enter__()` method returns without an
error, then `__exit__()` will always be called"* — so `__exit__` never ran and the
connection was never released. Fix: guard the second acquisition inside `__enter__` and
release on the way out, because nothing downstream will.

```python
def __enter__(self):
    self.conn = pool.acquire()
    try:
        self.cur = self.conn.cursor()
    except Exception:
        self.conn.release()
        raise
    return self.cur
```

**★ Symptom: `AttributeError` on `None` for the name bound by `as`, while cleanup demonstrably
runs.** Cause: `__enter__` has no `return` statement, so step 5 assigned `None`. The statement
kept the manager it obtained at step 1, which is why `__exit__` still works — the two are
different objects and only one of them was wrong. Fix: `return self`, or return the thing the
block should actually be holding.

```python
def __enter__(self):
    self.conn = pool.acquire()
    return self                   # step 5 binds this, not the manager
```

**★ Symptom: file descriptors leak in a code path that never entered the `with` at all.**
Cause: the resource was acquired in `__init__`, which runs at step 1 while the guarantee only
begins at step 4. Constructing the manager and then raising — or building a list of managers
before entering any of them — holds resources nothing will release. Fix: make construction
inert and acquire in `__enter__`.

```python
def __enter__(self):
    self.fp = open(self.path)     # acquired inside the guarantee, not before it
    return self.fp
```

**Symptom: cleanup ran in the wrong order and closed a connection before its cursor.**
Cause: the two managers were on separate statements, or acquired in the wrong sequence — in
one `with` they are *"processed as if multiple `with` statements were nested"*, so the last
one acquired is the first one released. Fix: acquire in dependency order in a single `with`
and let the nesting do it.

```python
with pool.acquire() as conn, conn.cursor() as cur:
    cur.execute(query)            # cur.__exit__ runs first, then conn.__exit__
```

**Symptom: a review comment claims `with open(p) as (a, b):` leaks the file when the unpack
fails.** Cause: a reasonable but wrong reading of the guarantee. The note settles it in the
opposite direction — a failure *"during the assignment to the target list"* is *"treated the
same as an error occurring within the suite"*, so `__exit__` runs and the file closes. Fix:
none needed; the leak is at step 4, not step 5. Knowing which side of the line a failure falls
on is the whole value of reading the note.

## Interview questions

**★ If `__enter__` raises halfway through acquiring two resources, does `__exit__` run?**
No, and this is the one place the `with` statement's guarantee is narrower than people
assume. The reference words it exactly: *"The `with` statement guarantees that if the
`__enter__()` method returns without an error, then `__exit__()` will always be called."*
The conditional is load-bearing — `__enter__` is step 4 of seven and `__exit__` is step 7,
so a raise at step 4 skips it. A context manager that acquires more than one thing must
therefore unwind its own partial state before re-raising, exactly as if it were a
transaction. The alternative is to acquire one thing per manager and let multi-item nesting
handle the rest, since a failure constructing the second manager happens *inside* the
first's `with` and does trigger its `__exit__`.

**★ In `with A() as a, B() as b:`, which `__exit__` runs first, and why does it matter?**
`B`'s. The reference says multi-item managers are *"processed as if multiple `with`
statements were nested"*, so the form is equivalent to `with A()` containing `with B()`, and
an inner block's cleanup completes before the outer block's. It matters whenever the second
resource was derived from the first — a cursor from a connection, a file from a temporary
directory — because releasing the outer one first would invalidate the inner one mid-close.
It also means a failure while *constructing* `B()` is a failure inside `A`'s block, so
`A.__exit__` does run; that is the difference between splitting acquisitions across managers
and cramming them both into one `__enter__`.

**Where exactly is the line between "leaks" and "cleans up", and what sentence draws it?**
Between step 4 and step 5. The note says the guarantee starts once *"the `__enter__()` method
returns without an error"*, and then explicitly places target-assignment failure on the safe
side: it *"will be treated the same as an error occurring within the suite would be"*. So a
raise inside `__enter__` leaks whatever `__enter__` had already taken, while a raise while
binding `as`, or anywhere in the suite, is cleaned up normally. That single sentence is why
the repair for a two-resource manager is always inside `__enter__` and never in the caller —
the caller's `with` has not started guarding anything yet.

**A colleague says `with` is "just `try` / `finally` with nicer syntax". Where does that
break down?**
In three places, all of them in the reference rather than in taste. The cleanup is bound to an
object resolved at step 3, so it cannot run for something that was never acquired — the
unbound-name failure of a `finally` has no analogue. The cleanup is *given* the exception, as
three arguments at step 7, where a `finally` clause has no name for it at all. And the
cleanup's return value can suppress selectively, which a `finally` can only do by jumping, and
only in the wider, warned-about way. The framing also hides the sharp edge in the other
direction: `try` / `finally` always runs its cleanup, whereas `with` runs `__exit__` only if
`__enter__` returned — so the "nicer syntax" has a failure mode the longhand does not.

**Should a context manager acquire in `__init__` or in `__enter__`, and does it matter if it
is only ever used in a `with`?**
`__enter__`, and it matters even then. Step 1 obtains the manager and step 4 invokes
`__enter__`, so anything taken in the constructor is held before the guarantee applies; if the
statement is never reached — the expression is one item in a list built ahead of time, or a
line between construction and the `with` raises — nothing will release it. Acquiring in
`__enter__` also makes the manager re-enterable in the ordinary case and keeps construction
cheap and side-effect-free, which is what lets a caller build managers conditionally and enter
only the ones it needs. The rule is easy to state: a constructor may record *what* to acquire;
only `__enter__` may acquire it.

---

← Prev: [`with` is the sanctioned form](06o-with-is-the-sanctioned-form.md) · Index: [EAFP vs LBYL](README.md) · Next → [`contextlib` when the object won't cooperate](06q-contextlib-when-the-object-does-not-cooperate.md)
