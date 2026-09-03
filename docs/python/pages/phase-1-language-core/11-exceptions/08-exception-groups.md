---
title: "`ExceptionGroup` exists because \"the first error\" is the wrong answer when twenty things ran at once"
sidebar_label: "8 · Exception groups"
sidebar_position: 127
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`ExceptionGroup` and `BaseExceptionGroup`](https://docs.python.org/3.14/library/exceptions.html#ExceptionGroup)
> (including `message`, `exceptions`, `subgroup`, `split`, `derive`),
> [`asyncio.TaskGroup`](https://docs.python.org/3.14/library/asyncio-task.html#task-groups),
> [`traceback`](https://docs.python.org/3.14/library/traceback.html)
> (`max_group_width`, `max_group_depth`, `show_group`),
> the [Tutorial — raising and handling multiple unrelated exceptions](https://docs.python.org/3.14/tutorial/errors.html#raising-and-handling-multiple-unrelated-exceptions),
> and [PEP 654](https://peps.python.org/pep-0654/).
> Target: **CPython 3.14** · groups and `except*` **added in 3.11**.

Everything before this chunk assumes one exception at a time. That assumption
breaks the moment work happens in parallel or in a batch: twenty uploads, five
of which failed for three different reasons. `raise` can carry one exception, so
until 3.11 the options were to lose nineteen failures, invent a wrapper class
with a list inside it, or log-and-continue and return no error at all. PEP 654
made the wrapper a builtin and gave it a matching statement.

## Two classes, and the split between them is `Exception`

> The difference between the two classes is that `BaseExceptionGroup` extends
> `BaseException` and it can wrap any exception, while `ExceptionGroup` extends
> `Exception` and it can only wrap subclasses of `Exception`. This design is so
> that `except Exception` catches an `ExceptionGroup` but not
> `BaseExceptionGroup`.

That sentence is the entire design. The rule from
[the hierarchy](04-the-exception-hierarchy.md) — that `except Exception:` must
not swallow a `KeyboardInterrupt` — has to keep holding when the interrupt is
one of five things inside a container, and it does, because a group holding a
`BaseException` is itself a `BaseException`.

You rarely have to choose:

> The `BaseExceptionGroup` constructor returns an `ExceptionGroup` rather than a
> `BaseExceptionGroup` if all contained exceptions are `Exception` instances, so
> it can be used to make the selection automatic.

The reverse is not forgiving: the `ExceptionGroup` constructor *"raises a
`TypeError` if any contained exception is not an `Exception` subclass"*. So
`BaseExceptionGroup` is the safe constructor for a collection you did not
curate, and `ExceptionGroup` is the one that asserts the collection is ordinary.

## Raising one

The tutorial's pattern is the pattern:

```python
errors = []
for record in batch:
    try:
        process(record)
    except Exception as exc:
        exc.add_note(f"record {record.id}")
        errors.append(exc)

if errors:
    raise ExceptionGroup(f"{len(errors)} of {len(batch)} records failed", errors)
```

Three things about it. The message is a **summary**, because the details are in
the members. `add_note` per member is what makes the group readable — otherwise
five identical `OSError: operation failed` lines tell you nothing about which
record produced them. And the tutorial is explicit that *"the exceptions nested
in an exception group must be instances, not types"* — `[ValueError]` is a
`TypeError`, `[ValueError()]` is a group.

Both `message` and `exceptions` are **read-only attributes**. A group is not a
list you append to after the fact; build the list, then build the group.

## Groups nest, and that is deliberate

A member of a group can be a group, which is how a batch of batches keeps its
shape:

```python
raise ExceptionGroup("import failed", [
    ExceptionGroup("users.csv", [ValueError("row 4"), ValueError("row 91")]),
    ExceptionGroup("orders.csv", [KeyError("customer_id")]),
])
```

The formatter renders the tree — and truncates it. `traceback` takes
`max_group_width` (default **15**) and `max_group_depth` (default **10**), and
*"the formatted output is truncated when either limit is exceeded"*. A batch of
10,000 failures does not produce 10,000 tracebacks; it produces fifteen and a
count. Worth knowing before you conclude the rest were swallowed.

## Catching a group with plain `except`

A group is an exception, so `except ExceptionGroup as eg:` works and is
sometimes the right tool — when you want to treat the batch as one outcome:

```python
try:
    run_batch(records)
except ExceptionGroup as eg:
    log.error("batch failed: %d errors", len(eg.exceptions), exc_info=eg)
    raise BatchRejected(str(eg)) from eg
```

`except*` is for when you want to act on **kinds** of member. Plain `except` is
for when you want to act on the **batch**.

## Gotchas

**★ Symptom — `TypeError: Item 0 of second argument (exceptions) is not an
exception`.** Cause: classes were passed instead of instances —
`ExceptionGroup("x", [ValueError])`. Fix: instantiate, or better, append the
exceptions you actually caught.

**★ Symptom — `TypeError` when building a group that contains a
`KeyboardInterrupt` or `SystemExit`.** Cause: `ExceptionGroup` refuses anything
that is not an `Exception` subclass. Fix: build with `BaseExceptionGroup`, which
downgrades itself to an `ExceptionGroup` automatically when every member turns
out to be ordinary.

**★ Symptom — a `BaseExceptionGroup` sails through an `except Exception:`
service boundary and kills the process.** Cause: that is the documented design —
a group holding a `BaseException` is a `BaseException`. Fix: nothing to fix in
the mechanism; if the boundary must survive it, catch `BaseException` there
explicitly and re-raise after cleanup, exactly as you would for a bare
`KeyboardInterrupt`.

**★ Symptom — a group's `str()` in a log shows only the summary and the
sub-exception count, so the real errors never reach the log aggregator.** Cause:
`str(eg)` is the message plus the count; the members are only rendered by the
traceback formatter. Fix: log with `exc_info`, or format explicitly.

```python
log.error("batch failed", exc_info=eg)                     # renders the tree
log.error("".join(traceback.format_exception(eg)))         # or format it yourself
```

**★ Symptom — a group with 10,000 members prints fifteen and stops, and someone
concludes the rest were dropped.** Cause: `max_group_width` (15) and
`max_group_depth` (10) truncate the *display*, not the group. Fix: read
`len(eg.exceptions)`, or aggregate deliberately — `collections.Counter` over
`type(e).__name__` beats ten thousand tracebacks.

**★ Symptom — everything in the batch is the same failure and the group is pure
noise.** Cause: a group was raised where one exception plus a count was the
information. Fix: collapse deliberately — if every member is the same type,
raise one with a note saying how many, and keep the group for the mixed case.

**★ Symptom — `except*` inside a library, and callers on 3.10 cannot import the
module at all.** Cause: `except*` is **syntax**, so it fails at compile time,
not at the call. Fix: for code that must run on 3.10, catch the group with plain
`except` and use `split`/`subgroup` — those are library functions, and the
`exceptiongroup` backport provides them.

## Interview questions

**★ Q: What problem do exception groups solve?**
`raise` carries exactly one exception, so any code that runs several operations
— concurrently or in a batch — had to discard every failure but the first. A
group is a single exception that wraps a list of them, so the whole outcome
propagates with every traceback intact, and `except*` lets a handler take the
members it understands and leave the rest to propagate.

**★ Q: `ExceptionGroup` or `BaseExceptionGroup`?**
`ExceptionGroup` extends `Exception` and can only hold `Exception` subclasses;
`BaseExceptionGroup` extends `BaseException` and can hold anything. The split
exists so `except Exception:` still cannot swallow a `KeyboardInterrupt` hiding
in a group. Construct with `BaseExceptionGroup` when the members are not
curated — it returns an `ExceptionGroup` automatically when they all turn out to
be ordinary.

**Q: Should a function that does one thing ever raise a group?**
No. A group says "several independent things failed". One operation failing has
one exception, and wrapping it forces every caller to unwrap for nothing. The
honest signal for "I did N things" is a group; the honest signal for "I did one
thing" is the exception itself.

---

← Prev: [Custom exceptions](07-custom-exceptions.md) · Index: [Exceptions](README.md) · Next → [`split`, `subgroup` and subclasses](08b-split-subgroup-and-subclasses.md)
