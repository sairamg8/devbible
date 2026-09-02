---
title: "`for`/`else` and `while`/`else`: the clause that means \"no `break`\""
sidebar_label: "3 · `for`/`else` and `while`/`else`"
sidebar_position: 83
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> [The `while` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-while-statement),
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> and [PEP 3136](https://peps.python.org/pep-3136/).
> Target: **CPython 3.14**.

**A loop's `else` clause runs when the loop finished **normally** — the iterator
was exhausted, or the `while` condition became false — and is skipped when the
loop exited via `break`. It has nothing to do with the `else` of an `if`, which
is why almost everyone misreads it on first contact. The mental substitution
that fixes it permanently: read `else` as **`nobreak`**. It exists for one
pattern — search a sequence, do something if you found it, do something else if
you got all the way through without finding it — and for that pattern it is
better than the flag variable it replaces.**

## What the reference actually says

For `for`:

> *"When the iterator is exhausted, the suite in the `else` clause, if present,
> is executed, and the loop terminates. A `break` statement executed in the
> first suite terminates the loop without executing the `else` clause's suite."*

For `while`:

> *"This repeatedly tests the expression and, if it is true, executes the first
> suite; if the expression is false (which may be the first time it is tested)
> the suite of the `else` clause, if present, is executed and the loop
> terminates. A `break` statement executed in the first suite terminates the
> loop without executing the `else` clause's suite."*

Two details in there that are easy to skim past:

- **"which may be the first time it is tested"** — a `while` whose condition is
  false immediately still runs its `else`. The `else` is not "after the loop
  body ran at least once".
- The same is true of `for` over an **empty** iterable: zero iterations, then
  the `else`. An empty search space means "not found", which is exactly right.

And a third, from the `for` section, about `continue`:

> *"A `continue` statement executed in the first suite skips the rest of the
> suite and continues with the next item, or with the `else` clause if there is
> no next item."*

So `continue` on the final iteration falls into the `else`. `continue` does not
suppress it; only `break` does.

## The pattern it exists for

Search-and-report. Without `else` you need a flag:

```python
found = False
for user in users:
    if user.is_admin:
        found = True
        break
if not found:
    raise NoAdminError(group)
```

With it, the flag disappears and the "not found" branch attaches to the loop it
belongs to:

```python
for user in users:
    if user.is_admin:
        break
else:
    raise NoAdminError(group)

promote(user)        # `user` is the admin — the loop target survives the loop
```

That works because [the loop target outlives the loop](01-the-for-statement.md),
and it is the one idiom where relying on that leak is correct: the `else`
guarantees you only reach the code after it via `break`, so `user` is
necessarily the item that matched.

The `while` form is the same shape for a retry loop:

```python
attempt = 0
while attempt < MAX_RETRIES:
    if try_connect():
        break
    attempt += 1
    time.sleep(backoff(attempt))
else:
    raise ConnectionError(f"failed after {MAX_RETRIES} attempts")
```

The `else` is the "we ran out of retries" branch, and it cannot be reached by a
successful connection. Compare the flag version, where a misplaced `success =
True` produces a silent false positive.

## Why it reads wrong

`else` in an `if` means "the condition was false". `else` on a loop means "the
loop was not broken out of" — an unrelated idea sharing a keyword. Python's own
documentation and community have long acknowledged the naming as a mistake;
`nobreak` is the name most people wish it had, and substituting that word while
reading is the fastest way to stop mis-parsing it.

The two misreadings to inoculate against:

```python
for x in xs:
    ...
else:
    ...        # NOT "if xs was empty" — it runs when xs was empty AND when
               # the loop completed all iterations. It runs unless you break.

while cond:
    ...
else:
    ...        # NOT "if cond was false initially" — it runs then, and also
               # after a normal exit. It runs unless you break.
```

## The `try`/`else` parallel

`try` has an `else` too, and it is the same underlying idea:

| Construct | `else` runs when |
|---|---|
| `for` / `while` | the loop finished without `break` |
| `try` | the `try` block finished without raising |

In both cases `else` means *"the block completed by the normal route, not the
abnormal one"*. Seen that way the keyword is consistent, even if it is still the
wrong word — and knowing the pattern makes `try`/`else` read naturally when you
meet it in **Exceptions** *(not written yet)*.

## When not to use it

`for`/`else` is a genuine win for search-and-report and a liability everywhere
else. Two honest cautions:

**If the loop body is more than a few lines, the `else` is too far from the
`break` to read.** By the time a reader reaches `else:` they have forgotten what
could break out. Extract a function.

**If an expression says it, use the expression.** Many `for`/`else` searches are
one line:

```python
admin = next((u for u in users if u.is_admin), None)
if admin is None:
    raise NoAdminError(group)
```

That version names the "not found" value explicitly rather than encoding it in
control flow, and it does not rely on the loop-variable leak. Prefer it when you
only need the item. Keep `for`/`else` when the loop body does real work per item
— accumulating, logging, side effects — that an expression cannot express.

**A `for`/`else` whose loop cannot `break` is dead weight.** If there is no
`break` in the body, the `else` always runs, and it should simply be the next
statement. Linters flag this (`ruff` `PLW0120`, *else clause on loop without a
break statement*).

## Gotchas

**Symptom — the `else` block runs when you expected it not to, on an empty
collection.** Cause: an empty iterable means zero iterations and then the
`else` — the loop finished normally, having done nothing. Fix: this is correct
for a search ("not found"), but if you meant "the collection was empty", test
that separately before the loop.

**Symptom — a `while`'s `else` runs even though the body never executed.**
Cause: the reference is explicit that the condition being false *"the first time
it is tested"* still leads to the `else`. Fix: as above — `else` means "not
broken out of", not "ran at least once".

**Symptom — `continue` on the last iteration unexpectedly triggers the `else`.**
Cause: documented behaviour — `continue` moves to the next item, *"or with the
`else` clause if there is no next item"*. Only `break` suppresses the `else`.
Fix: none needed, but do not use `continue` expecting it to skip the `else`.

**Symptom — code after a `for`/`else` uses the loop variable and gets the last
item rather than the match.** Cause: it was reached without a `break` — which
should have been impossible if the `else` raises or returns. Fix: make sure the
`else` branch actually exits (raise, return, or assign a definite "not found"
value); an `else` that only logs falls through into code that assumes a match.

**Symptom — an `else` on a loop with no `break` always runs and confuses
readers.** Cause: with nothing to skip it, the clause is unconditional. Fix:
delete the `else` and dedent its body. `ruff` flags it as `PLW0120`.

**Symptom — a `try`/`finally` inside a loop makes `break` behave unexpectedly.**
Cause: `finally` runs on the way out, so a `return` or `break` inside `try` still
executes the `finally` first — and a `break`/`return` *inside* the `finally`
itself discards the pending exception. Fix: never `break`, `continue` or
`return` from a `finally` block; it silently swallows exceptions.

**Symptom — a reviewer misreads `for`/`else` as "if the loop did not run".**
Cause: the keyword genuinely reads that way; it is a known naming mistake. Fix:
substitute `nobreak` mentally, and consider a comment (`# else: no break — not
found`) on any non-obvious use.

**Symptom — a `for`/`else` search silently changes meaning after someone adds a
second `break` to the body.** Cause: the `else` means "no break took place",
without distinguishing *which* break. A break added for an unrelated reason —
an early exit on a fatal row — now also suppresses the not-found handling. Fix:
one `break` per `for`/`else`, or a flag, or extract to a function with distinct
return values.

**Symptom — a `while`/`else` retry loop reports failure after a success.**
Cause: the success path incremented the counter and fell out of the condition
instead of using `break`, so the loop ended "normally" and the `else` fired.
Fix: the success path must `break`. That is the whole contract of the idiom, and
it is why `while`/`else` is safer than a `success` flag — the mistake is visible
rather than silent.

## Interview questions

**★ Q: When does a loop's `else` clause run?**
When the loop terminates **normally** — the iterator is exhausted, or the
`while` condition becomes false — and not when it exits via `break`. Read it as
`nobreak`. It runs for an empty iterable (zero iterations, then the `else`) and
it runs after a `continue` on the final iteration; only `break` skips it.

**★ Q: What is `for`/`else` actually for?**
The search-and-report pattern: loop looking for something, `break` when you find
it, and put the "not found" handling in the `else`. It replaces a `found = False`
flag with something the language enforces — you cannot reach the code after the
`else` except via `break`, so the loop variable is guaranteed to be the match.

**Q: Does `continue` skip the `else` clause?**
No. Only `break` does. The reference says `continue` proceeds with the next item
*"or with the `else` clause if there is no next item"* — so a `continue` on the
last iteration lands in the `else`.

**Q: Why is it called `else`, and what should it have been called?**
It is widely considered a naming mistake. The unifying idea across `for`, `while`
and `try` is "the block completed by the normal route rather than the abnormal
one" — no `break`, no exception — but `else` does not say that. `nobreak` is the
name most people substitute while reading.

**Q: How does `try`/`else` relate to `for`/`else`?**
Same shape: `try`'s `else` runs when the `try` block completed without raising,
just as a loop's `else` runs when the loop completed without breaking. In both
cases it is the "normal exit" branch, and in both cases putting the code there
rather than at the end of the block narrows what the guard actually covers.

**Q: When should you *not* use `for`/`else`?**
When the body is long enough that the `else` is far from the `break`; when there
is no `break` at all (the clause is then unconditional and linters flag it);
when the body has more than one `break`, since the `else` cannot tell them
apart; and when the whole loop is really an expression —
`next((x for x in xs if p(x)), None)` names the not-found case explicitly
instead of encoding it in control flow.

**Q: Is it safe to `break` out of a `try` block inside a loop?**
Yes — the `finally` still runs first. What is not safe is a `break`, `continue`
or `return` *inside* a `finally` block: it discards any in-flight exception,
silently turning a failure into a normal exit.

**Q: Rewrite this with a flag and say which you prefer: `for u in users: if u.is_admin: break` / `else: raise`.**
The flag version needs `found = False` before the loop, `found = True` beside the
`break`, and `if not found: raise` after it — three places to keep in sync, and
a misplaced assignment gives a silent false positive. The `for`/`else` version
has one exit and the language guarantees the invariant. Prefer `for`/`else` when
the body does per-item work; prefer `next((u for u in users if u.is_admin), None)`
when it does not.

---

← Prev: [`zip` idioms and neighbours](02b-zip-idioms-and-neighbours.md) · Index: [Control flow](README.md) · Next → [Nested loops and the labelled break Python does not have](03b-nested-loops.md)
