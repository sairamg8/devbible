---
title: "There is no handler-side fix for a wide try — the repair is structural, and it is always the same two moves: hoist the leap so the try suite holds one expression, and put the work that consumes it in else"
sidebar_label: "06g · Width at a boundary"
sidebar_position: 147
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (the `else` clause semantics and the `try1_stmt` grammar), the
> [Tutorial — Errors and Exceptions](https://docs.python.org/3.14/tutorial/errors.html)
> (the rationale for `else` and the clause-ordering rule), and
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access) — **both** of its
> notes, plus the real-vs-effective uid paragraph.
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06f](06f-whose-exception-is-it.md) established that an `except` clause matches on class
alone and cannot ask who raised. The consequence is that there is nothing you can write
*inside* the handler to fix a wide `try` — the only lever is the boundary of the guarded
suite itself. Two moves cover almost every case: hoist the leap so the `try` suite holds
one expression, and move the work that consumes the result into `else`, which the
reference defines as being inside the statement and outside the handlers. The
documentation demonstrates both, in the same six lines, in the `os.access` entry.**

## `else` is the narrowing tool, and the docs use it on purpose

The Language Reference:

> *"The optional `else` clause is executed if the control flow leaves the `try` suite, no
> exception was raised, and no `return`, `continue`, or `break` statement was executed.
> Exceptions in the `else` clause are not handled by the preceding `except` clauses."*

That last sentence is the whole mechanism: **`else` is inside the statement and outside
the handlers.** The tutorial states the intent:

> *"It is useful for code that must be executed if the try clause does not raise an
> exception. The use of the `else` clause is better than adding additional code to the
> `try` clause because it avoids accidentally catching an exception that wasn't raised by
> the code being protected by the `try` … `except` statement."*

Two grammar constraints follow from the reference's own production, and both surprise
people: `else` **must come after every `except` clause** — the tutorial says it *"must
follow all except clauses"* — and `else` **requires at least one `except` clause**, because
the grammar spells the except part as one-or-more. A `try` / `finally` with no `except` is
legal; a `try` / `else` with no `except` is a `SyntaxError`.

## The `os.access` rewrite is three narrowing decisions in six lines

The `os.access` entry warns that the check-then-open shape *"creates a security hole"* and
prints this LBYL original:

```python
if os.access("myfile", os.R_OK):
    with open("myfile") as fp:
        return fp.read()
return "some default data"
```

and, in the docs' words, *"is better written as"*:

```python
try:
    fp = open("myfile")
except PermissionError:
    return "some default data"
else:
    with fp:
        return fp.read()
```

Read that as a width decision rather than an EAFP demo — there are three of them:

1. **Only `open()` is in the `try`.** The `with` and the `read()` are in `else`, so a
   `PermissionError` raised by the *read* propagates instead of being answered with
   default data.
2. **The clause is `except PermissionError`, not `except OSError`.** A missing file still
   raises `FileNotFoundError` at the caller, because "unreadable" and "absent" are
   different answers.
3. **The success-path `return` lives in `else`, not in `try`.** That is what makes
   decision 1 expressible at all — see the gotcha below.

The clause's full semantics are [topic 11 · the `else`
clause](../11-exceptions/02-the-else-clause.md); why the LBYL original is a *security*
defect is [02b · The filesystem and the atomic
flag](02b-the-filesystem-and-the-atomic-flag.md).

### The second note: even a correct check can be wrong

The same entry carries a second warning that is usually skipped, and it is the strongest
argument on the page for making the operation itself the guard:

> *"I/O operations may fail even when `access()` indicates that they would succeed,
> particularly for operations on network filesystems which may have permissions semantics
> beyond the usual POSIX permission-bit model."*

⚠️ And `access()` is not even asking the question most callers think it is: it *"Use[s] the
real uid/gid to test for access to path. Note that most operations will use the effective
uid/gid"*. So the check can be wrong about the permission model, wrong about the identity,
and stale by the time you act — three independent reasons the `try` around `open()` is the
only formulation that answers the actual question.

## Keep the assignment out of the `try`

The subtlest width defect is a single statement that is secretly two operations, and the
usual shape is an assignment whose right-hand side wraps the leap in a call:

```python
try:
    value = compute_discount(cart[coupon_code])   # 🔴 compute_discount is guarded too
except KeyError:
    value = Decimal("0")
```

`cart[coupon_code]` is the leap; `compute_discount(...)` is work that happens to be on
the same line. Hoist:

```python
try:
    coupon = cart[coupon_code]                    # leap
except KeyError:
    value = Decimal("0")
else:
    value = compute_discount(coupon)              # work
```

The rule generalises: **the `try` suite should contain the expression that can fail and
nothing else** — not the call that consumes it, not the `return` that ships it, not the
logging that describes it. Two more shapes of the same mistake:

```python
# 🔴 The f-string is inside the guard; a __repr__ that raises becomes a cache miss.
try:
    return render(f"hit: {cache[key]}")
except KeyError:
    return render("miss")

# 🔴 The whole managed block is guarded, not the acquisition.
try:
    with open(path) as fp:
        return json.load(fp)          # read errors inside the parse are OSErrors too
except OSError:
    return {}
```

The second is worth dwelling on. `except OSError` around a `with` block guards
*everything the block does*, and because `json.load` reads from the handle, an `OSError`
mid-read is answered with `{}` — a truncated file becomes an empty config. Narrow it by
moving the parse where its own failures are visible:

```python
try:
    fp = open(path)
except FileNotFoundError:
    return {}                          # the one assumption: this file may not exist yet
else:
    with fp:
        return json.load(fp)           # decode and read errors now reach the caller
```

## Gotchas

**★ Symptom: moving code into `else` did not narrow anything, because the `try` suite still
`return`s.** Cause: the reference is explicit that `else` runs only when *"no `return`,
`continue`, or `break` statement was executed"* — a `try` suite that returns skips the
`else` entirely, so the guarded call and the returned expression are still the same
statement. Fix: assign in the `try`, return in the `else`.

```python
try:
    value = collection[key]     # assign here
except KeyError:
    return None
else:
    return transform(value)     # return here
```

**★ Symptom: a truncated config file is silently read as an empty config.** Cause:
`except OSError` wrapped a whole `with open(...)` block, so a read failure partway
through the parse produced the "file absent" recovery. Fix: guard the acquisition only
and parse in `else` — shown above.

**★ Symptom: an f-string inside a `try` turned a `__repr__` bug into a cache miss.** Cause:
formatting runs code — `__str__`, `__repr__`, `__format__` — and its exceptions are
raised inside the guarded suite. Fix: build the value, leave the suite, then format.

```python
try:
    hit = cache[key]
except KeyError:
    return render("miss")
else:
    return render(f"hit: {hit}")
```

**★ Symptom: a retry loop retries a deterministic bug forever.** Cause: `except
ConnectionError` wrapped both the request and the decoding of its response, so a parser
defect looked like a transient network failure and the loop re-issued the same request
until the budget ran out. Fix: guard only the call that can fail transiently, decode in
`else`.

```python
for attempt in range(3):
    try:
        response = client.get(url)       # only this is transient
    except ConnectionError:
        continue
    else:
        return parse(response)           # a parser bug escapes on the first attempt
raise Unavailable(url)
```

**Symptom: a handler that returns a default is reached when the *handler's own*
dependency is broken.** Cause: the `try` suite included the call that builds the fallback,
so a failure in the fallback path matched the same clause. Fix: build the fallback
outside the guarded suite.

```python
fallback = DEFAULT_SETTINGS          # constructed before the leap, never inside it
try:
    raw = store[tenant_id]
except KeyError:
    return fallback
else:
    return merge(fallback, decode(raw))
```

**Symptom: `except AttributeError` around `config.database.host` reports "not
configured" for a misspelling of `host`.** Cause: three attribute accesses in one
expression, one clause, and no way to tell which failed — the same defect as a chained
subscript. Fix: one access at a time, with the default form where the attribute really is
optional.

```python
db = config.database                       # a missing `database` is a real error
host = getattr(db, "host", "localhost")    # this one is genuinely optional
```

## Interview questions

**★ Why does the `else` clause exist, and how does it narrow a handler?**
Because there is no other way to say "run this only if the guarded operation succeeded,
but do not guard it". The reference: *"Exceptions in the `else` clause are not handled by
the preceding `except` clauses."* So moving the follow-on work from `try` to `else`
removes it from the handler's scope without removing it from the success path. The
tutorial gives the rationale directly — it *"avoids accidentally catching an exception
that wasn't raised by the code being protected"*.

**★ In the documentation's own EAFP rewrite of the `os.access` example, three separate
narrowing decisions were made. What are they?**
First, only `open()` is inside the `try` — the `with` and the `read()` are in `else`, so a
read failure is not answered with default data. Second, the clause is
`except PermissionError`, not `except OSError`, so a missing file still raises
`FileNotFoundError` at the caller. Third, the success-path `return` lives in `else` rather
than in `try`, which is what makes the first decision expressible at all. It is a faithful
translation of an `os.R_OK` check, not a catch-all.

**★ Why should the assignment be outside the `try` when the value is not used until
afterwards anyway?**
Because "the assignment" is usually two operations on one line.
`value = compute_discount(cart[code])` has the leap (`cart[code]`) and the work
(`compute_discount`) inside the same guard, so the work's exceptions are in the handler's
scope. Hoisting the leap into a `try` of its own and putting the work in `else` costs two
lines and removes an entire class of misattributed failure. It is exactly what PEP 8's
"Correct" example does.

**You moved the follow-on work into `else` and nothing changed. Why?**
Almost certainly because the `try` suite still contains a `return`. The reference says
`else` runs only if *"the control flow leaves the `try` suite, no exception was raised,
and no `return`, `continue`, or `break` statement was executed"* — so a returning `try`
suite skips `else` altogether, and whatever you moved is unreachable. Assign inside the
`try`, return inside the `else`.

**Can you write `try` / `else` with no `except` clause?**
No — it is a `SyntaxError`. The reference's grammar requires one or more `except` clauses
in the form that admits `else`, and the tutorial adds that the `else` clause *"when
present, must follow all except clauses"*. `try` / `finally` with no handler is legal;
`try` / `else` is not. The constraint makes sense once you see what `else` is for: it
exists to shrink the scope of handlers, so with no handlers there is nothing to shrink.

**Is an f-string inside a `try` really a width problem?**
Yes, and a common one. Formatting invokes `__str__`, `__repr__` or `__format__`, all of
which run arbitrary code, so `f"hit: {cache[key]}"` inside a `try` guarded by
`except KeyError` covers both the lookup and anything the value's `__repr__` does. It is
the same defect as a call on the right-hand side of an assignment, in a shape people do
not read as a call.

**How do you find out, in review, whether a handler is catching a callee's exception?**
Ask of every line in the `try` suite: *would I want this handler to fire if this line
failed?* Then ask it about everything those lines call, transitively — which is the point
at which you stop and narrow the block, because you cannot audit a call tree you do not
own. That is why "the `try` suite contains one expression" is a rule rather than a
preference: it is the only version of the question you can actually answer.

---

← Prev: [Whose exception is it?](06f-whose-exception-is-it.md) · Index: [EAFP vs LBYL](README.md) · Next → [Where `finally` sits](06h-finally-and-the-widest-handler.md)
