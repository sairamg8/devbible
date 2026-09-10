---
title: "The grammar refuses the narrowing tool you might reach for — there is no else without an except, the clause order is fixed and is the execution order, and the else you can always write is the one on a loop, which means very nearly the opposite thing"
sidebar_label: "06l · The `else` you cannot write"
sidebar_position: 162
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (the `try1_stmt` grammar, the `else` paragraph, the expression-less `except` rule),
> [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement)
> and the `while` statement (the loop `else`),
> [The `break` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-break-statement)
> — and the [Tutorial — Errors and Exceptions](https://docs.python.org/3.14/tutorial/errors.html)
> for the clause-ordering rule.
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06g](06g-width-at-a-boundary.md) made `else` the narrowing tool of choice. This chunk is
the fine print: the grammar will not always let you have it. `else` requires at least one
`except` clause, it must follow all of them, and what it promises is narrower than most
people assume — the reference states outright that exceptions raised *in* the `else` clause
are not handled by the handlers directly above it, which is the whole point and also the
trap. Each restriction looks arbitrary until you see what `else` is actually for, at which
point every one of them is the language refusing to let you write something that could not
mean anything. The chunk closes on the `else` you *can* always write — the one on a `for` or
`while` loop — which uses the same keyword to mean very nearly the opposite thing. The other
grammar, `except*`, refuses far more and gets its own chunk:
[06r](06r-except-star-does-not-mix.md).**

## The grammar: there is no `else` without an `except`

The reference's `try1_stmt` production spells the handler part as **one or more** `except`
clauses, with `else` and `finally` each optional and in that order; the Tutorial states the
ordering rule in prose — the `else` clause *"when present, must follow all except clauses"*.
Two consequences, and the second is the surprising one:

- `try` / `finally` with **no** `except` is legal, and common.
- `try` / `else` with **no** `except` is a `SyntaxError`.

That is not arbitrary once you know what `else` is for. `else` exists to shrink the scope of
handlers; with no handlers there is nothing to shrink, and the code you were about to put in
`else` belongs after the statement:

```python
# 🔴 SyntaxError — there is no handler for `else` to be outside of.
try:
    row = cursor.fetchone()
else:
    return Row.from_tuple(row)

# The two legal readings, and they mean different things:
try:
    row = cursor.fetchone()
except psycopg.OperationalError:
    return None
else:
    return Row.from_tuple(row)        # narrowed: outside the handler's scope

try:
    row = cursor.fetchone()
finally:
    cursor.close()
return Row.from_tuple(row)            # runs only if fetchone did not raise, anyway
```

The third form is worth noticing: after a `try` / `finally` with no handler, ordinary
following code **already has** the property `else` gives you — it is skipped when the suite
raises, because the exception propagates past it. `else` earns its keep only when there is an
`except` clause it needs to stay outside of. That is the whole design, and the grammar is
just enforcing it.

## What `else` actually promises, in the reference's own words

The narrowing argument rests on one paragraph, and both of its sentences matter:

> *"The optional `else` clause is executed if the control flow leaves the `try` suite, no
> exception was raised, and no `return`, `continue`, or `break` statement was executed.
> Exceptions in the `else` clause are not handled by the preceding `except` clauses."*

The first sentence is the one people quote: `else` is the success path. The second is the one
that makes `else` a *narrowing* tool rather than a stylistic preference — the handlers above
it do not cover it. That is exactly why you move the follow-on work there: a `KeyError` from
`transform(value)` is no longer indistinguishable from a `KeyError` raised by the lookup you
were guarding. It is also why an `else` clause is not a free place to put code. Anything that
raises in there propagates straight out of the statement, past handlers that look, on screen,
as though they enclose it.

## The full clause order, and what skips what

| Clause | Runs when | Skipped by |
|---|---|---|
| `try` suite | always, first | nothing |
| `except` | the raised exception matches its class | no exception; an earlier clause matching |
| `else` | no exception **and** no `return`, `continue` or `break` in the suite | a raise; a jump out of the suite |
| `finally` | always, last | nothing ordinary — a jump runs it *"on the way out"* |

Read down the "skipped by" column and the design falls out. `except` and `else` are mutually
exclusive by construction — exactly one of them runs — which is why `else` is the place for
work that must not be in the handler's scope. `finally` is in neither category, which is why
it cannot be narrowed at all ([06h](06h-finally-and-the-widest-handler.md)). And the ordering
in the grammar is the execution order, so a clause out of place is a `SyntaxError` rather
than a subtly different program.

One more ordering rule belongs in the same table, because it is the same kind of refusal:

> *"An expression-less `except` clause, if present, must be last; it matches any exception."*

So the two "must be last" rules stack — the bare `except:` after every typed handler, then
`else`, then `finally` — and none of them can be reordered to read better. The third
condition on that `else` row — no `return`, `continue` or `break` in the suite — is a whole
failure mode of its own and is [06k](06k-the-jump-that-discards.md).

## The other `else` — the one on loops

The same keyword attaches to `for` and `while`, and means something unrelated:

> *"When the iterator is exhausted, the suite in the `else` clause, if present, is executed,
> and the loop terminates."* — and for `while`, *"If the expression is false (which may be
> the first time it is tested) the suite of the `else` clause, if present, is executed and
> the loop terminates."*

> *"A `break` statement executed in the first suite terminates the loop without executing the
> `else` clause's suite."*

So a loop's `else` means **"the loop was not broken out of"** — it runs on the *failure* to
find something, which is the opposite of the reading most people bring to it from `try`. The
one structural echo is real, though, and worth holding on to: in both statements, `else` is
skipped by a jump. `break` skips a loop's `else`; a `return`, `break` or `continue` in a
`try` suite skips a `try`'s `else`. Same word, same "the normal path did not complete"
trigger, opposite consequences.

```python
# `else` here runs when the SKU was NOT found — search exhausted without a break.
for product in catalogue:
    if product.sku == sku:
        break
else:
    raise UnknownSKU(sku)

# `else` here runs when the lookup SUCCEEDED — no exception was raised.
try:
    product = catalogue[sku]
except KeyError:
    raise UnknownSKU(sku)
else:
    return price_for(product, qty)
```

⚠️ And `break` binds tighter than people expect: it *"terminates the nearest enclosing
loop, skipping the optional `else` clause if the loop has one."* In a nested search, a
`break` out of the inner loop leaves the outer loop running and the **outer** `else` still
scheduled to fire.

## Gotchas

**★ Symptom: `SyntaxError: invalid syntax` on a `try` / `else` that reads perfectly.** Cause:
the grammar requires one or more `except` clauses in the form that admits `else`; `try` /
`else` and `try` / `else` / `finally` are not legal statements, however sensible "run this if
the body did not blow up" sounds. Fix: if you have nothing to catch you do not want `else` —
put the code after the statement, or name the class you are actually guarding against.

```python
try:
    row = cursor.fetchone()
except psycopg.OperationalError:   # the clause that makes `else` both legal and useful
    return None
else:
    return Row.from_tuple(row)
```

**★ Symptom: `else` placed before an `except` clause is a `SyntaxError`.** Cause: the
ordering is fixed — the `else` clause *"when present, must follow all except clauses"*, and
`finally` comes after that. There is no reordering that works. Fix: `try` → every `except` →
`else` → `finally`, in that order, always.

```python
try:
    value = collection[key]
except KeyError:
    return None
except TypeError:                  # every except clause first
    raise BadKey(key)
else:
    return transform(value)        # then else
finally:
    metrics.observe()              # then finally
```

**★ Symptom: an exception raised inside the `else` clause escapes the statement, past an
`except` clause that names its class.** Cause: this is the documented contract, not a bug —
*"Exceptions in the `else` clause are not handled by the preceding `except` clauses."* The
handlers guard the `try` suite only, and `else` sits outside them by construction. Fix:
decide which it is. If the follow-on work genuinely needs the same handling, it belongs in
the `try` suite; if it needs different handling — which is usually the case, and the reason
you moved it — it needs its own statement.

```python
try:
    value = collection[key]
except KeyError:
    return None
else:
    try:
        return transform(value)    # its own KeyError is a different failure
    except KeyError as exc:
        raise MalformedRecord(key) from exc
```

**★ Symptom: a `for … else` fires on the success path and nobody can see why.** Cause: it
does not — a loop's `else` runs when *"the iterator is exhausted"*, i.e. when no `break` was
taken, so it is the *not-found* branch. Someone read it with `try` / `else` semantics. Fix:
if the two readings keep colliding in a codebase, use the `break`-less form, which has no
`else` to misread.

```python
match = next((p for p in catalogue if p.sku == sku), None)
if match is None:
    raise UnknownSKU(sku)
```

**Symptom: a nested search raises "not found" for an item it definitely found.** Cause:
`break` *"terminates the nearest enclosing loop"*, so breaking out of the inner loop leaves
the outer loop iterating and the outer `else` still due to run when it exhausts. Fix: do not
try to `break` two levels — put the search in a function and `return` from it, which leaves
no `else` to fire.

```python
def find(catalogue, sku):
    for shelf in catalogue:
        for product in shelf:
            if product.sku == sku:
                return product     # leaves both loops, no else to reason about
    raise UnknownSKU(sku)
```

## Interview questions

**★ Can you write `try` / `else` with no `except` clause?**
No — it is a `SyntaxError`. The reference's grammar requires one or more `except` clauses in
the form that admits `else`, and the Tutorial adds that `else` *"when present, must follow
all except clauses"*. `try` / `finally` with no handler is legal, so the asymmetry surprises
people; it makes sense once you see what `else` is for. `else` exists to shrink the scope of
handlers, so with no handlers there is nothing to shrink — and code placed after a
`try` / `finally` already has the property you wanted, because an exception in the suite
propagates past it.

**★ Two call sites raise the same class and should recover differently. How do you express
that, given `except` matches on class alone?** Not in the clause — in the boundary. Either
give each leap its own `try` so the two handlers have disjoint scopes, which is
[06g](06g-width-at-a-boundary.md)'s hoist applied twice, or have the inner code raise a class
of its own so the outer handler has something meaningful to match on. The second is what a
domain exception is for: catch the mechanical class where it is raised, wrap it in a class
that names the *situation*, and chain it with `from exc` so the mechanism survives as
`__cause__`. Wrapping is the only way to make "who raised this" visible to `except`, because
the class is the whole predicate — which is [06f](06f-whose-exception-is-it.md)'s point,
stated as a design instruction instead of a diagnosis.

**★ `else` on a `for` loop and `else` on a `try` — same keyword. What is the actual
relationship?** Barely any at the level of meaning, and one real one at the level of
mechanism. A loop's `else` runs when *"the iterator is exhausted"* and is skipped by `break`
— it is the *not-found* branch, which is why `for … else` reads backwards to almost everyone.
A `try`'s `else` runs when no exception was raised and no `return`, `continue` or `break` was
executed — it is the *success* branch. The mechanical echo is that both are skipped by a jump
out of the suite: `break` skips a loop's `else` exactly as a `return` skips a `try`'s. If you
can state that, you can also predict the failure people hit with `try` / `else`, which is a
`return` in the suite making the `else` unreachable.

**★ Both `else` and the end of the `try` suite run only on success. Why prefer `else`?**
Because the two differ in what the handlers cover, and the reference says so in one sentence:
*"Exceptions in the `else` clause are not handled by the preceding `except` clauses."* Code
at the end of the `try` suite is inside the handlers' scope, so a `KeyError` it raises is
caught by the `except KeyError` you wrote for the lookup — the handler now answers for a
failure it was never written for, which is the width problem
[06](06-narrowing-the-try.md) is about. Moving that code to `else` narrows the handler to the
line you were actually guarding without splitting the statement in two. The cost, and it is
the reason `else` is not free, is that the `else` clause now has no handler at all: whatever
it raises leaves the statement.

**Why does the clause order in the grammar match the execution order, and what does that buy
you?** Because the grammar is the execution order written down: `try`, then every `except`,
then `else`, then `finally`. The payoff is that a misordered clause is a `SyntaxError` at
compile time rather than a program that runs and means something slightly different — you
cannot accidentally write an `else` that the handlers are inside of, because there is no such
statement. It is a small, real example of the language spending syntax to remove a class of
runtime bug, and it is worth naming in a review when someone proposes "just move the `else`
up so it reads better".

**If `break` only terminates the nearest enclosing loop, how do you leave two?**
You do not — you return. `break` *"terminates the nearest enclosing loop, skipping the
optional `else` clause if the loop has one"*, and there is no labelled break in Python, so
the honest shapes are to extract the nested search into a function and `return` from it, or
to flatten the iteration with `itertools.product` or a generator so there is only one loop
to leave. The extract-a-function version is almost always better, because it also gives the
search a name and gives you somewhere to put the not-found `raise` where no `else` clause is
involved at all.

---

← Prev: [When cleanup raises](06i-when-cleanup-raises-and-the-grammar-refuses.md) · Index: [EAFP vs LBYL](README.md) · Next → [`except*` does not mix](06r-except-star-does-not-mix.md)
