---
title: "`try`/`else` exists to shrink the `try` block, and shrinking the `try` block is the single highest-value habit in exception handling"
sidebar_label: "2 · The `else` clause"
sidebar_position: 111
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement — `else` clause](https://docs.python.org/3.14/reference/compound_stmts.html#else-clause),
> the Tutorial
> [Handling Exceptions](https://docs.python.org/3.14/tutorial/errors.html#handling-exceptions),
> and [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/#programming-recommendations).
> Target: **CPython 3.14**.

**`else` on a `try` is the same idea as `else` on a `for`: the block completed by
the normal route rather than the abnormal one. Its purpose is not decoration —
it is the only way to write "this code runs on success" *without* putting that
code inside the handler's blast radius. Every line you leave in the `try` suite
is a line whose exceptions your `except` clause will claim as its own, and
because handlers cover the entire call tree beneath the `try`, that radius is
much larger than it looks.**

## The exact rule

The reference is one sentence and every clause of it is load-bearing:

> *"The optional `else` clause is executed if the control flow leaves the `try`
> suite, no exception was raised, and no `return`, `continue`, or `break`
> statement was executed. Exceptions in the `else` clause are not handled by the
> preceding `except` clauses."*

Four separate facts:

1. **Control flow must leave the `try` suite.** Falling off the end counts.
2. **No exception was raised.** A *handled* exception does not count — if a
   handler ran, `else` does not.
3. **No `return`, `continue` or `break` was executed** in the `try` suite. A
   `try` suite that returns skips the `else` entirely (though not the `finally`).
4. **`else` is outside the handlers.** An exception raised in `else` propagates
   past the sibling `except` clauses as though the whole statement raised it.

Point 4 is the whole point of the clause.

## Why it exists — the tutorial says it plainly

> *"It is useful for code that must be executed if the try clause does not raise
> an exception. The use of the `else` clause is better than adding additional
> code to the `try` clause because it avoids accidentally catching an exception
> that wasn't raised by the code being protected by the `try` … `except`
> statement."*

The tutorial's own example:

```python
for arg in sys.argv[1:]:
    try:
        f = open(arg, 'r')
    except OSError:
        print('cannot open', arg)
    else:
        print(arg, 'has', len(f.readlines()), 'lines')
        f.close()
```

`open()` raises `OSError`. So does `f.readlines()` — on a decode failure, on a
directory, on a disconnected network mount. If `readlines()` sat in the `try`,
a read error would print `cannot open`, which is a lie, and the bug report you
get back would send you to look at permissions on a file that opened fine.

## The failure this prevents, in the shape you will actually meet it

```python
# WRONG — the handler claims failures it does not own
try:
    row = db.fetch_one(user_id)
    profile = json.loads(row.payload)          # ValueError on bad JSON
    return render(profile)
except ValueError:
    return default_profile()
```

`db.fetch_one` may itself raise `ValueError` from deep inside a driver's
parameter validation. `render` may raise `ValueError` from a formatting call.
Both now silently return `default_profile()`. The handler was written for one
`json.loads` and is guarding three.

```python
# RIGHT — the try covers exactly the operation whose failure you named
try:
    profile = json.loads(row.payload)
except ValueError:
    logger.warning("unparseable payload for user %s", user_id)
    return default_profile()
else:
    return render(profile)
```

Now a `ValueError` from `render` propagates, is logged with its real traceback,
and becomes a bug you fix instead of a user who silently sees a blank profile.

Note that `row = db.fetch_one(user_id)` moved *out* of the statement entirely.
The three destinations for a line are: inside `try` if this handler is meant to
catch its failure, inside `else` if it is success-path work, and outside the
statement if it is neither.

## PEP 8's version of the same rule

> *"Additionally, for all try/except clauses, limit the `try` clause to the
> absolute minimum amount of code necessary. Again, this avoids masking bugs"*

"Absolute minimum" in practice means **one call**. If your `try` has more than
one statement in it, ask of each one: *would I want my handler to fire if this
line failed?* If the answer is no, it belongs in `else`.

## The parallel with `for`/`else`

[`for`/`else` and `while`/`else`](../08-control-flow/03-for-else-and-while-else.md)
covers the loop side; the unifying idea is one sentence:

| Construct | `else` runs when |
|---|---|
| `for` / `while` | the loop finished without `break` |
| `try` | the suite finished without raising |

In both cases `else` means *the block completed by the normal route*. Neither has
anything to do with `if`/`else`, and that shared keyword is why both read wrong
on first contact. The difference in usefulness is sharp, though: `for`/`else` is
a niche idiom worth using for exactly one pattern, whereas `try`/`else` is
something you should reach for constantly — it is a correctness tool, not a
stylistic one.

## `else` versus `finally` — they are not interchangeable

```python
try:
    conn = pool.acquire()
except PoolExhausted:
    return SERVICE_UNAVAILABLE
else:
    return handle(conn)          # only on success
finally:
    metrics.record_attempt()     # on every route out
```

- `else` = "the try succeeded".
- `finally` = "regardless".

Cleanup that must happen even when acquisition *failed* goes in `finally`. Work
that assumes acquisition *succeeded* goes in `else` — putting it in `finally`
would run it after the `except` returned, with `conn` unbound, producing a
`NameError` that buries the original failure.

## `else` with `return`: where to put the return

Because a `return` in the `try` suite suppresses the `else`, these two are not
equivalent:

```python
try:
    value = parse(raw)
    return transform(value)      # `else` never runs — and transform() is guarded
except ParseError:
    return None
```

```python
try:
    value = parse(raw)
except ParseError:
    return None
else:
    return transform(value)      # unguarded, which is what you want
```

The second form is what you mean in almost every case. The first form both skips
the `else` and puts `transform` inside the handler's reach.

## When `else` is not worth it

Two honest cases:

**When the `try` suite is the last thing in the function and the handler
returns.** Then `else` and "the code after the statement" are the same thing, and
the flat version reads better:

```python
try:
    value = parse(raw)
except ParseError:
    return None
return transform(value)
```

This is exactly as safe as the `else` version — the handler returned, so the
following line is unreachable on failure — and one indentation level shallower.
Use `else` when the statement is *not* the last thing, or when a `finally`
follows and you need the ordering to be explicit.

**When there is a `finally` but no `except`.** `try`/`else`/`finally` is not
valid grammar, and it would mean nothing anyway: with no handler, "no exception
was raised" and "we got past the statement" are the same condition.

## Gotchas

**★ Symptom — a handler written for one specific call fires for a completely
different reason, and the error message sends you to the wrong place.** Cause:
extra statements left in the `try` suite; handlers cover the whole dynamic
extent, including everything called. Fix: one call in `try`, the rest in `else`
or outside the statement. This is PEP 8's *"absolute minimum amount of code"*
rule and it is the highest-value habit in this whole topic.

**★ Symptom — the `else` block silently never runs, with no error.** Cause: the
`try` suite executed a `return`, `break` or `continue`. The reference names all
three as suppressing the `else`. Fix: move the `return` into the `else` clause.

**Symptom — an exception raised in `else` is not caught by the `except` clause
right above it, which looks like a bug.** Cause: documented and intended —
*"Exceptions in the `else` clause are not handled by the preceding `except`
clauses."* Fix: none; this is the feature. If you genuinely want that code
guarded, it belongs in `try`.

**Symptom — `SyntaxError` writing `try`/`else`/`finally`.** Cause: `else`
requires at least one `except` clause; the grammar has no production for
`try`/`else`. Fix: drop the `else` and put the code after the statement, or add
the handler you meant to write.

**Symptom — code in `finally` that assumes success blows up with `NameError`
after the handler ran.** Cause: `finally` runs on the failure path too, where the
name was never bound. Fix: success-only work goes in `else`; `finally` gets only
cleanup that is valid in every state, and should guard on whatever it touches.

**Symptom — a reviewer asks "why is this in `else` rather than after the
statement?"** Cause: when every handler exits (returns or raises), the two are
equivalent and `else` is only documentation. Fix: it is a legitimate style call
— but keep `else` whenever a handler *falls through*, because then the two are
genuinely different and the flat version runs on both paths.

**Symptom — a `try`/`except`/`else` inside a loop behaves oddly with
`continue`.** Cause: `continue` in the `try` suite skips the `else` but still
runs the `finally`. Fix: prefer `continue` in the `except` clause (skip this
item because it failed) over `continue` in `try`.

## Interview questions

**★ Q: What does `try`/`else` do, and why would you use it instead of just
putting the code at the end of the `try` block?**
`else` runs when the `try` suite completed without raising and without
`return`/`break`/`continue`. The reason to use it is that it is *outside* the
handlers: code in `try` can have its exceptions claimed by your `except` clause;
code in `else` cannot. The tutorial's wording is that it *"avoids accidentally
catching an exception that wasn't raised by the code being protected."*

**★ Q: How much code should be inside a `try` block?**
PEP 8: *"limit the `try` clause to the absolute minimum amount of code
necessary."* In practice, the one call whose failure the handler names. Anything
else is either success-path work (`else`) or unrelated (outside the statement).
Remember that the guard extends transitively through every function the `try`
calls, so a "small" `try` can still cover thousands of lines.

**Q: Does `else` run if an exception was raised and handled?**
No. A handled exception still counts as "an exception was raised", so the `else`
is skipped. `else` and `except` are alternative routes; at most one runs.

**Q: Does `else` run if the `try` block executes `return`?**
No — but `finally` does. The reference lists `return`, `continue` and `break` as
suppressing the `else`, and separately says the `finally` runs 'on the way out'
for all three.

**Q: Are exceptions raised in the `else` clause caught by the `except` clauses
above it?**
No, explicitly: *"Exceptions in the `else` clause are not handled by the
preceding `except` clauses."* They propagate as though the whole `try` statement
raised — though a `finally` on the same statement still runs first.

**Q: How is `try`/`else` related to `for`/`else`?**
Same underlying idea: the block completed by the *normal* route, not the abnormal
one — no exception for `try`, no `break` for a loop. The keyword is a poor fit in
both cases. The difference is that `for`/`else` is a niche idiom and `try`/`else`
is a routine correctness tool.

**Q: Can you write `try`/`else` without an `except` clause?**
No — the grammar requires at least one `except` before an `else`. And there would
be no meaning to it: with no handler, the only way past the `try` suite is
success.

---

← Prev: [The four clauses](01-the-four-clauses.md) · Index: [Exceptions](README.md) · Next → [`finally` and its guarantees](03-finally-and-its-guarantees.md)
