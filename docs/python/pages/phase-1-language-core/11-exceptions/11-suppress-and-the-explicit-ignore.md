---
title: "`contextlib.suppress` is `try`/`except X: pass` with the ignored class where you cannot miss it — and it skips the rest of the block, not just the failing line"
sidebar_label: "11 · `suppress` and the explicit ignore"
sidebar_position: 132
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`contextlib.suppress`](https://docs.python.org/3.14/library/contextlib.html#contextlib.suppress),
> [`BaseExceptionGroup.derive`](https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup.derive),
> and [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations).
> Target: **CPython 3.14**.

[The bare `except:`](04b-the-bare-except.md) is about the dishonest way to
ignore a failure. This chunk and [the next](11b-warnings.md) are the honest
ones, and the distinction between them is not style — it is who acts, and when.

| The caller | The tool |
|---|---|
| does not need to know, and nothing needs to happen | `contextlib.suppress(SpecificError)` — this chunk |
| should change something eventually, but the call worked | `warnings.warn(...)` — [next chunk](11b-warnings.md) |
| must deal with it now, or the result is wrong | `raise` — [the `raise` statement](06-the-raise-statement.md) |

## `contextlib.suppress`

> Return a context manager that suppresses any of the specified exceptions if
> they occur in the body of a `with` statement and then resumes execution with
> the first statement following the end of the `with` statement.

The docs give the equivalence themselves — this:

```python
from contextlib import suppress

with suppress(FileNotFoundError):
    os.remove('somefile.tmp')
```

is *"equivalent to"* this:

```python
try:
    os.remove('somefile.tmp')
except FileNotFoundError:
    pass
```

Same semantics, one line, and the exception class is impossible to miss when
reading. It is also **reentrant**, so nesting it is fine.

And the warning that comes with it, in the docs' own words:

> As with any other mechanism that completely suppresses exceptions, this
> context manager should be used only to cover very specific errors where
> silently continuing with program execution is known to be the right thing to
> do.

`suppress(Exception)` is a bare `except:` with better manners. The value is
entirely in the narrowness of the class you name.

## 🔴 The body is skipped, not resumed

The phrase *"resumes execution with the first statement following the end of the
`with` statement"* is the trap. A `suppress` block is not a per-statement
`try`:

```python
with suppress(FileNotFoundError):
    os.remove(tmp_path)          # raises FileNotFoundError
    log.info("removed %s", tmp_path)   # NEVER RUNS
    metrics.incr("tmp.cleaned")        # NEVER RUNS
```

Everything after the raising line is skipped silently, which is exactly the
behaviour a `try`/`except`/`pass` around three statements would have — the
difference is that `suppress` looks like a decoration rather than a block, so
the skipped lines read as if they still run. One statement per `suppress`, or
use `try`/`except` where the shape is visible.

## `suppress` and exception groups, since 3.12

> Changed in version 3.12: `suppress` now supports suppressing exceptions raised
> as part of a `BaseExceptionGroup`. If the code within the `with` block raises
> a `BaseExceptionGroup`, suppressed exceptions are removed from the group. Any
> exceptions of the group which are not suppressed are re-raised in a new group
> which is created using the original group's `derive()` method.

So a `suppress(FileNotFoundError)` around a `TaskGroup` removes the
`FileNotFoundError`s from the group and re-raises the remainder — which is the
`split`-and-re-raise pattern from
[`split` and `subgroup`](08b-split-subgroup-and-subclasses.md), done for you,
and one of the few places where suppression composes safely. On 3.11 the same
code suppresses nothing, because the group is not a `FileNotFoundError`.

## `suppress` as the EAFP spelling

The idiomatic use is the one where the check and the operation cannot be
separated without a race:

```python
with suppress(KeyError):
    del cache[key]              # not: if key in cache: del cache[key]
```

The `if` version is wrong under concurrency and slower in the common case. That
argument is the subject of the next topic, [EAFP vs LBYL](../12-eafp-vs-lbyl/README.md).
## When it is the wrong tool

Three tests, and any one of them disqualifies it:

- **Something has to happen on failure** — a log line, a metric, a fallback
  value. `suppress` has no handler body; you wanted `try`/`except`.
- **You cannot name the class narrowly.** `suppress(Exception)` is a bare
  `except:` wearing a nicer hat.
- **More than one statement is inside it.** See above — the rest of the block
  is skipped, and that is almost never what the shape implies.

## Gotchas

**★ Symptom — code after the failing line inside a `with suppress(...)` block
never runs, and nobody notices for months.** Cause: `suppress` skips to the
statement *after the whole block*, not the next statement. Fix: one operation per
`suppress` block.

```python
with suppress(FileNotFoundError):
    os.remove(tmp_path)
log.info("cleanup done")          # outside — always runs
```

**★ Symptom — `suppress(Exception)` hides a bug for a release cycle.** Cause:
the class named is as broad as a bare `except:`, so a `TypeError` from a
refactor is swallowed with the `FileNotFoundError` that was intended. Fix: name
the narrowest class that describes the ignorable failure — the docs restrict
this tool to *"very specific errors"*.

**★ Symptom — a `suppress` around an `asyncio.TaskGroup` suppresses nothing on
3.11 and works on 3.12.** Cause: group-aware suppression was added in 3.12; on
3.11 the raised object is a group, which is not an instance of the suppressed
class. Fix: on 3.11, split the group explicitly.
**★ Symptom — a `suppress` block hides a failure that a metric was supposed to
count.** Cause: `suppress` has no body to run on the failure path, so
"ignore it but count it" cannot be expressed with it. Fix: a real handler.

```python
try:
    os.remove(tmp_path)
except FileNotFoundError:
    metrics.incr("tmp.already_gone")     # the thing suppress cannot do
```

**★ Symptom — `suppress` is used around a `return`, and the function silently
returns `None`.** Cause: the suppressed exception skips the `return` along with
the rest of the block, and the function falls off the end. Fix: return outside
the block, with an explicit default.

```python
def read_optional(path):
    with suppress(FileNotFoundError):
        return path.read_text()
    return None                          # explicit, not accidental
```

## Interview questions

**★ Q: `contextlib.suppress(X)` or `try: … except X: pass`?**
They are equivalent — the docs state the equivalence directly — so prefer
`suppress` for the readability: the ignored class is at the top of the block and
impossible to overlook. The one thing to remember is that the rest of the block
is skipped when the exception fires, so keep it to a single operation. Both are
only defensible for very specific errors where continuing is known to be right.
**★ Q: When is `suppress` the wrong choice?**
Whenever something has to happen on the failure path — a log, a metric, a
fallback — because `suppress` has no handler body; whenever the class cannot be
named narrowly, since `suppress(Exception)` is a bare `except:`; and whenever
more than one statement is inside the block, because the remainder is skipped
rather than resumed and the syntax does not look like it.

**Q: Why is `with suppress(KeyError): del d[k]` better than
`if k in d: del d[k]`?**
Two lookups become one, and the race between the check and the delete
disappears — between the `in` and the `del`, another thread or another callback
can remove the key and the `del` raises anyway. It is the EAFP form, and it is
the subject of [EAFP vs LBYL](../12-eafp-vs-lbyl/README.md).

---

← Prev: [`assert`](10-assert.md) · Index: [Exceptions](README.md) · Next → [Warnings](11b-warnings.md)
