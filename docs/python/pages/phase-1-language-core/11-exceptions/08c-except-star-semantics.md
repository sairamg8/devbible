---
title: "`except*` runs every clause that matches, at most once each, and hands each one a group — including when only one exception was raised"
sidebar_label: "8c · `except*` semantics"
sidebar_position: 129
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (the `try2_stmt` grammar and the `except*` paragraphs),
> [`sys.exception`](https://docs.python.org/3.14/library/sys.html#sys.exception),
> [`BaseExceptionGroup.split`](https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup.split),
> and [PEP 654](https://peps.python.org/pep-0654/).
> Target: **CPython 3.14** · `except*` **added in 3.11**.

`except*` is a second exception statement, not a variant of the first. Its
clauses are not alternatives — several of them can run for a single `raise` —
and the name it binds is never the exception you named. Every surprise below
follows from those two sentences.

## The rule, from the reference

> When an exception group is raised in the try block, each `except*` clause
> splits (see `split()`) it into the subgroups of matching and non-matching
> exceptions. If the matching subgroup is not empty, it becomes the handled
> exception (the value returned from `sys.exception()`) and assigned to the
> target of the `except*` clause (if there is one). Then, the body of the
> `except*` clause executes.

And PEP 654 on the execution model:

> a single exception group can cause several `except*` clauses to execute, but
> each such clause executes at most once (for all matching exceptions from the
> group) and each exception is either handled by exactly one clause (the first
> one that matches its type) or is reraised at the end

Read those together and the whole statement falls out. Clauses are tried in
order against an `unhandled` group that **shrinks** as each clause takes its
members. A member goes to the first clause whose type matches it. A clause with
no members does not run. Whatever is left at the end propagates.

```python
try:
    raise ExceptionGroup("batch", [OSError("disk"), ValueError("row 4"), OSError("net")])
except* OSError as eg:
    print(len(eg.exceptions))   # 2 — both OSErrors, one clause, one execution
except* ValueError as eg:
    print(len(eg.exceptions))   # 1
```

Both bodies run. With plain `except`, the first matching clause would have been
the only one — see [catching specific types](05-catching-specific-types.md),
where first-match-wins is the rule. Here first-match-wins applies **per
exception**, not per statement.

## `as` binds a group, always

The target is the *matching subgroup*, not the exception:

```python
except* ValueError as eg:
    eg.args            # the group's args, not the ValueError's
    eg.exceptions      # (ValueError('row 4'),)  <- the ones you asked for
```

Even when one plain exception was raised. PEP 654: a naked exception that
matches is *"wrapped by an `ExceptionGroup` (or `BaseExceptionGroup` if it is
not an `Exception` subclass) with an empty message string."* So this is a group
of one:

```python
try:
    raise ValueError("solo")
except* ValueError as eg:
    print(type(eg))          # <class 'ExceptionGroup'>
    print(eg.exceptions[0])  # solo
```

That uniformity is the point — a handler never has to ask whether it got one or
many — and it is also the single most common mistake, because
`except* ValueError as e: log.error(e.args[0])` reads fine and logs the wrong
thing.

PEP 654 also warns that the bound group is *"an ephemeral object"*: it is built
for this clause, so do not stash it expecting the identity to mean anything.
`sys.exception()` inside the clause returns that same matching subgroup.

## Four hard syntax rules

Each of these is a `SyntaxError` — a compile-time failure, not a runtime one, so
a module using them cannot even import:

**1 — You cannot mix the two forms.**

> A `try` statement can have either `except` or `except*` clauses, but not
> both.

**2 — A bare `except*:` does not exist.**

> The exception type for matching is mandatory in the case of `except*`, so
> `except*:` is a syntax error.

There is no "catch everything" spelling. `except* Exception:` is the closest,
and it means something different — it takes the *ordinary* members and leaves
`BaseException` members in the group to propagate.

**3 — No `break`, `continue` or `return` inside an `except*` clause.**

> `break`, `continue` and `return` cannot appear in an `except*` clause.

Because clauses are independent and several may run, a jump out of one would
have to decide the fate of the others. PEP 654's reasoning is that exception
independence requires consistent handling across clauses. The practical effect:
you cannot write the retry loop you would write with `except`.

```python
for attempt in range(3):
    try:
        return call_all()          # fine
    except* TransientError as eg:
        continue                   # SyntaxError
```

The rewrite is a flag, or a helper function whose `return` is outside the
handler:

```python
for attempt in range(3):
    failed = False
    try:
        return call_all()
    except* TransientError:
        failed = True
    if not failed:
        break
```

**4 — `except*` cannot catch the group type itself.**

> It is possible to catch the `ExceptionGroup` and `BaseExceptionGroup` types
> with `except`, but not with `except*`

`except* ExceptionGroup:` is refused because splitting a group by "is a group"
has no coherent answer. Catch the container with plain `except`, the members
with `except*`.

`else` and `finally` are permitted — the grammar's `try2_stmt` carries both —
and mean exactly what they mean for `except`. See
[the four clauses](01-the-four-clauses.md) and
[`finally`](03-finally-and-its-guarantees.md).

## Raising inside a clause, and the shape of what escapes

Two different things can leave an `except*` clause and they compose differently.

A **bare `raise`** re-raises the matching subgroup, and PEP 654 says the
reraised and unhandled parts *"are subgroups of the original group, and share
its metadata (cause, context, traceback)"* — so what propagates is
recognisably the original group, minus what other clauses handled.

A **new exception** is independent:

> When exceptions are raised explicitly, they are independent of the original
> exception group, and cannot be merged with it (they have their own cause,
> context and traceback). Instead, they are combined into a new
> `ExceptionGroup` (or `BaseExceptionGroup`), which also contains the
> reraised/unhandled subgroup.

So a clause that translates a failure does not replace the group — it adds to
one:

```python
try:
    run_batch(records)
except* TransientError as eg:
    raise BatchRejected(len(eg.exceptions)) from eg   # ends up inside a new group
```

The caller catches a group containing `BatchRejected` **and** anything no clause
handled. If you wanted a single exception out of the boundary, catch the group
with plain `except` and raise from there — that is the
[wrap-at-a-boundary](06b-exception-chaining.md) pattern, and it is why plain
`except` on a group is still the right tool at an API edge.

## Gotchas

**★ Symptom — `SyntaxError` on a module that imports fine on 3.11+ but not on
3.10, and the traceback points at a line nobody changed.** Cause: `except*` is
syntax, so an old parser rejects the whole file — the feature landed in 3.11.
Fix: for code that must run on 3.10, use plain `except` plus `split`/`subgroup`
(see [`split` and `subgroup`](08b-split-subgroup-and-subclasses.md)), or the
`exceptiongroup` backport.

**★ Symptom — `str(e)` or `e.args[0]` in an `except*` handler logs the group's
message instead of the error.** Cause: the target is the matching subgroup, and
for a naked exception that is a group with an **empty message**. Fix: go through
`exceptions`.

```python
except* ValueError as eg:
    for exc in eg.exceptions:
        log.error("bad row: %s", exc)
```

**★ Symptom — `SyntaxError: 'continue' not supported inside 'except*' block`
(or the same for `break`/`return`).** Cause: the documented restriction. Fix:
set a flag in the clause and act on it after the `try`, or move the `return`
into a helper called from the `try` body.

**★ Symptom — two `except*` clauses both run and someone reports it as a bug.**
Cause: that is the specification — one clause per *matching kind*, each at most
once. Fix: nothing; if you need alternatives, you wanted plain `except` on the
group.

**★ Symptom — a member of the group is handled by the "wrong" clause.** Cause:
per-exception first-match-wins, and the clauses are ordered — an
`except* OSError` before `except* FileNotFoundError` takes the
`FileNotFoundError` too, because it matches first. Fix: order narrow to broad,
exactly as with plain `except`.

**★ Symptom — `except* ExceptionGroup:` is a `SyntaxError`.** Cause: the group
types cannot be matched by `except*`. Fix: `except ExceptionGroup:` — plain —
when you want the container.

**★ Symptom — after handling a group with `except*`, an exception still
escapes.** Cause: the members no clause matched are re-raised at the end. That
is the design, and it is what makes `except*` safer than a hand-written
`split`. Fix: if the boundary must absorb everything, add a final
`except* Exception:` clause — and then own the decision to swallow.

**★ Symptom — a clause that raises a translated error produces a group, and the
caller's `except BatchRejected:` misses it.** Cause: an explicitly raised
exception is combined into a **new group** with the unhandled remainder rather
than replacing it. Fix: translate outside the `except*` statement — catch the
group with plain `except` and raise there.

**★ Symptom — the handled group's identity is used as a dict key or compared
with `is`, and the behaviour is inconsistent.** Cause: PEP 654 calls the bound
group *ephemeral* — it is constructed by the split for this clause. Fix: key on
the members, or on something stable you put there yourself.

## Interview questions

**★ Q: How does `except*` differ from `except`?**
`except` picks one clause — the first whose type matches — and runs it.
`except*` splits the group and runs **every** clause that has at least one
matching member, each at most once, with the target bound to that clause's
matching subgroup. Members no clause matched are re-raised at the end. So
first-match-wins applies per exception in `except*`, and per statement in
`except`.

**★ Q: What is bound by `as` in an `except* ValueError as e:` clause?**
An exception group containing the matching `ValueError`s — never a bare
`ValueError`. If a naked `ValueError` was raised, it is wrapped in an
`ExceptionGroup` with an empty message so the handler's shape is the same either
way. Handlers must go through `e.exceptions`.

**★ Q: Why are `break`, `continue` and `return` banned inside `except*`?**
Because several clauses can run for one raise, so a jump out of one clause would
have to decide what happens to the others — including whether the unhandled
remainder is still re-raised. Rather than pick a confusing answer, PEP 654 makes
it a `SyntaxError`. The workaround is a flag, or a helper function.

**Q: Can you mix `except` and `except*` in one `try`?**
No — the reference says a `try` can have either but not both, and there is no
bare `except*:` either, since the type is mandatory. If you need both behaviours
you need two statements, usually a plain `except ExceptionGroup` at the boundary
and `except*` deeper in.

**Q: What escapes an `except*` statement?**
Whatever no clause matched — as a subgroup of the original, sharing its cause,
context and traceback — plus anything a clause raised explicitly, combined with
it into a new group. A bare `raise` in a clause puts that clause's subgroup back
into the propagating group.

**Q: You are writing a library that must support 3.10. Can you still handle
groups?**
Yes, but not with `except*`, which is syntax and fails at import. Catch the
group with plain `except` and use `split`/`subgroup` — those are methods — or
depend on the `exceptiongroup` backport, which provides the types and the API.

**Q: Which is right at an HTTP boundary: `except*` or `except`?**
Plain `except ExceptionGroup:`. The edge has to produce one response, so it
wants the batch as a single outcome, and translating inside an `except*` clause
produces a *group* containing your translated error rather than the error
itself. `except*` belongs where you genuinely act on several kinds of failure
independently.

---

← Prev: [`split`, `subgroup` and subclasses](08b-split-subgroup-and-subclasses.md) · Index: [Exceptions](README.md) · Next → [Traceback objects](09-traceback-objects.md)
