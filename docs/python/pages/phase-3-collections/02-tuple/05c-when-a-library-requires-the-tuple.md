---
title: "printf-style formatting, logging and every DB-API driver take a tuple of arguments — so a missing comma is not a type error, it is a wrong-length error, and a string is the worst possible wrong length"
sidebar_label: "5c · When a library requires the tuple"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14
> [printf-style String Formatting](https://docs.python.org/3.14/library/stdtypes.html#printf-style-string-formatting);
> [`sqlite3` — how to use placeholders](https://docs.python.org/3.14/library/sqlite3.html#how-to-use-placeholders-to-bind-values-in-sql-queries)
> and [`Cursor.execute`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.execute);
> [`logging.Logger.debug`](https://docs.python.org/3.14/library/logging.html#logging.Logger.debug);
> [PEP 249 — Python Database API Specification v2.0](https://peps.python.org/pep-0249/);
> and the [glossary entry for *sequence*](https://docs.python.org/3.14/glossary.html#term-sequence).
> Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**Two very old APIs — `%`-formatting and the DB-API — take their arguments as a *tuple*
rather than as varargs, and both of them special-case what happens when you pass something
that is not one. That makes the missing comma invisible in a new way: `("abc")` is not a
type error, it is a **three-element sequence**, because a string is a sequence of
characters. The driver reports a mismatch in the number of bindings, the message names no
comma, and a one-character value would have passed.**

## 3 · `%` formatting needs a tuple, and one value is special-cased

> *"If *format* requires a single argument, *values* may be a single non-tuple object.
> Otherwise, *values* must be a tuple with exactly the number of items specified by the
> format string, or a single mapping object (for example, a dictionary)."* —
> [printf-style String Formatting](https://docs.python.org/3.14/library/stdtypes.html#printf-style-string-formatting)

Read that carefully: the single-argument case is a *special case*, and it breaks the moment
the single argument happens to be a tuple.

```python
point = (3, 4)
"coordinates: %s" % point        # TypeError: not all arguments converted
                                 # — `point` was taken as the argument LIST
"coordinates: %s" % (point,)     # correct: a 1-tuple whose only item is `point`
```

The same trap bites `logging`, whose `%`-style formatting is deferred:

```python
logger.info("processing %s", record_id)        # correct: one argument
logger.info("processing %s", (host, port))     # logs the tuple — usually what you meant
logger.info("processing %s %s", host, port)    # two placeholders, two arguments
```

**The habit that removes the whole class:** use f-strings for message construction and
`%`-style only where the formatting must be deferred, which in practice means `logging`.

## 4 · DB-API parameters are a sequence, and a string is a sequence

> *"To insert a variable into a query string, use a placeholder in the string, and
> substitute the actual values into the query by providing them as a `tuple` of values to
> the second argument of the cursor's `execute()` method."*

> *"For the qmark style, *parameters* must be a `sequence` whose length must match the
> number of placeholders, or a `ProgrammingError` is raised."* —
> [`sqlite3` placeholders](https://docs.python.org/3.14/library/sqlite3.html#how-to-use-placeholders-to-bind-values-in-sql-queries)

Two failures follow from those two sentences:

```python
# 1. Forgetting the comma: an int is not a sequence.
cur.execute("SELECT * FROM orders WHERE id = ?", (order_id))    # -> order_id, bare
cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))   # correct

# 2. Forgetting the comma with a str: a str IS a sequence, of characters.
cur.execute("SELECT * FROM orders WHERE ref = ?", ("A17"))      # 3 parameters!
cur.execute("SELECT * FROM orders WHERE ref = ?", ("A17",))     # correct
```

Case 2 is the nastier one: it does not fail on a type check, it fails on a *length* check,
so the error talks about the number of bindings and not about the missing comma. And a
one-character ref would pass, which is how it reaches production.

🔴 **Never build the SQL by formatting.** The same documentation opens with the reason:

> *"beware of using Python's string operations to assemble queries, as they are vulnerable
> to SQL injection attacks"*

The tuple is not a stylistic preference here — it is the parameter-binding boundary.

## Why these two APIs work this way at all

Both predate `*args`. `%`-formatting is modelled on C's `printf`, where the arguments are a
list; the DB-API's `execute()` signature is fixed by PEP 249, which specifies a single
*parameters* argument so that drivers can also accept a mapping for named placeholders:

> *"`.execute(operation [, parameters])` — Prepare and execute a database operation (query
> or command).  Parameters may be provided as sequence or mapping and will be bound to
> variables in the operation."* —
> [PEP 249](https://peps.python.org/pep-0249/#id15)

*"sequence or mapping"* is the whole story: the API cannot use `*args`, because then a
mapping could not be told apart from a keyword call. So the sequence has to be built by the
caller, and building a one-element sequence in Python means a comma.

`sqlite3` documents the same contract for its own `execute`:

> *"A `dict` if named placeholders are used. A `sequence` if unnamed placeholders are
> used."* — [`Cursor.execute`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.execute)

## The shapes that are always safe

```python
# One parameter — the comma is mandatory.
cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))

# One parameter, no comma to forget — a list is also a sequence.
cur.execute("SELECT * FROM orders WHERE id = ?", [order_id])

# Named placeholders — a dict, and no comma question arises.
cur.execute("SELECT * FROM orders WHERE id = :id", {"id": order_id})

# Many rows — executemany takes a sequence OF sequences.
cur.executemany("INSERT INTO lang VALUES(?, ?)", [("C", 1972), ("Python", 1991)])
```

🔴 **`[order_id]` is the pragmatic answer for hand-written call sites.** A list literal has
no invisible failure mode: `["A17"]` is one element and `["A17",]` is still one element.
The tuple is idiomatic and the list is comma-proof; in a code path where a wrong binding
count is a production incident, take the list.

⚠️ Named placeholders remove the problem entirely and are worth the extra characters in any
query with more than two parameters, because they also make the call site
order-independent.

## Gotchas

**★ Symptom: `TypeError: not all arguments converted during string formatting` when the
value being formatted is itself a tuple.** Cause: `%` treats a tuple right-hand side as the
*argument list*, and the single-value shortcut only applies to non-tuples. Fix: wrap it in
a 1-tuple, or use an f-string.

```python
msg = "coordinates: %s" % (point,)
msg = f"coordinates: {point}"          # no special cases at all
```

**★ Symptom: `ProgrammingError` about the number of bindings from a query with one
placeholder.** Cause: the parameter was passed as `("A17")` — a plain string, which the
DB-API sees as a 3-element sequence. Fix: the comma.

```python
cur.execute("SELECT * FROM orders WHERE ref = ?", ("A17",))
```

**★ Symptom: the same query works for one ref and fails for another.** Cause: the same
missing comma — a one-character parameter accidentally has the right length. Fix: as above,
and add a test with a multi-character value.

**Symptom: a `logging` call prints the format string with `%s` unsubstituted.** Cause: the
arguments were passed as one tuple rather than as separate positional arguments, or the
placeholder count does not match. Fix: pass them positionally and let `logging` do the
deferred formatting.

```python
logger.info("processing %s on %s", record_id, host)
```

**Symptom: a query built with an f-string works locally and is flagged by a security
review.** Cause: string interpolation is not parameter binding — the `sqlite3` docs open
this section with *"beware of using Python's string operations to assemble queries, as they
are vulnerable to SQL injection attacks"*. Fix: placeholders and a parameter sequence,
always, including for values you believe are safe.

```python
cur.execute("SELECT * FROM stocks WHERE symbol = ?", (symbol,))
```

**Symptom: `executemany` inserted one row of garbage instead of N rows.** Cause: it takes a
sequence *of sequences*, and a flat sequence of scalars was passed — each scalar was then
treated as a row. Fix: build a list of tuples.

```python
cur.executemany("INSERT INTO lang VALUES(?, ?)", [(n, y) for n, y in rows])
```

**Symptom: `logging` formatted the message even though the level was disabled.** Cause: the
message was pre-formatted with an f-string, so the work happened before `logging` could
decide to discard it. Fix: pass the format string and the arguments separately and let the
deferred `%`-formatting happen only if the record is emitted.

```python
logger.debug("expensive %s", expensive_repr(obj))   # still evaluates the call
logger.debug("record %s on %s", record_id, host)    # cheap args, deferred format
```

## Interview questions

**★ `"%s" % some_tuple` raises. Why, and what is the fix?**
Because `%` treats a tuple on the right as the argument list, so a 2-tuple supplies two
arguments to a format string that wants one. The documentation makes the asymmetry
explicit: *"if format requires a single argument, values may be a single non-tuple object.
Otherwise, values must be a tuple with exactly the number of items specified by the format
string."* The fix is `"%s" % (some_tuple,)` — a 1-tuple whose single item is the tuple you
wanted to print — or an f-string, which has no such special case.

**★ Why does `cur.execute(sql, ("abc"))` fail while `cur.execute(sql, ("abc",))` works?**
Because `("abc")` is not a tuple — no comma — it is just the string, and a string is a
sequence of characters. The DB-API requires *"a sequence whose length must match the number
of placeholders"*, so the driver sees three parameters for one placeholder and raises. The
version with the comma is a 1-element sequence. The reason this reaches production is that
a single-character value would satisfy the length check.

**★ Why does the DB-API take a sequence instead of `*args`?**
Because `execute()` must also accept a *mapping* for named placeholders, and with `*args`
there would be no way to distinguish a mapping argument from a keyword call. PEP 249
specifies it as *"Parameters may be provided as sequence or mapping and will be bound to
variables in the operation."* One positional *parameters* argument covers both. The cost is
that a single parameter has to be spelled as a one-element sequence, which is where the
comma bug comes from.

**★ Is there a way to write DB-API parameters that cannot silently break?**
Use a list literal or a dict. `[value]` is a one-element sequence with no invisible
single-element form, so there is no comma to forget; a dict with named placeholders removes
positional binding entirely and makes the call site order-independent. The tuple is the
idiomatic spelling and is fine when it is generated rather than typed — for hand-written
query call sites, prefer the shape that cannot be wrong.

**Why should `logging` calls pass arguments rather than an f-string?**
Because `logging` formats lazily: it only applies the `%`-style substitution if a handler
actually emits the record, so a suppressed `DEBUG` line costs nothing beyond the call. An
f-string is evaluated by the interpreter before `logging` is even entered, so the formatting
happens whether or not the level is enabled. The caveat worth stating: the *arguments* are
still evaluated eagerly, so `logger.debug("%s", expensive())` does not save the call — only
the formatting.

**What is the general rule these two APIs share?**
Both take "the arguments" as one object rather than as varargs, so the caller must build
the container. Any API shaped that way turns a missing comma into a wrong-arity error
rather than a type error, and Python has no syntax that makes a one-element container
visually obvious — `(x,)` and `(x)` differ by one character with entirely different
meanings. Wherever you meet that shape, either annotate the parameter so a type checker
sees the arity, or use a container whose one-element form is unambiguous.

---

← [Trailing-comma bugs](05b-trailing-comma-bugs.md) · [Topic index](README.md) · Next → [Packing and unpacking](06-packing-and-unpacking.md)
