---
title: "Every container ships the same three choices, and set.discard exists purely so absence need not be an event — while a chain of subscripts under one except KeyError is the widest handler in ordinary Python"
sidebar_label: "03c · Sequences, sets and nesting"
sidebar_position: 127
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (`index`, `remove`),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict).
> `set` method semantics **probed** on the installed interpreter, CPython **3.14.4**
> (`set.remove.__doc__`, `set.discard.__doc__`, `set.pop.__doc__`) — one patch behind the
> corpus pin of **Python 3.14.7**. Target: **Python 3.14**; no sandbox run.

**The dictionary is where this argument is usually held, but every container repeats it,
and two of them make the point better than `dict` does. `set` ships `remove` and
`discard` — identical on a hit, differing only in whether absence raises — which is the
EAFP/LBYL choice reduced to a method name. And a list's `index` raises `ValueError`
rather than returning `-1`, so the LBYL spelling scans the sequence twice for one answer.
The chunk closes on the pattern that breaks the rule hardest: a chain of subscripts under
a single `except KeyError`, which is a handler three or four times wider than any
assumption its author could state.**

## Sequences and sets: the same three families

Every container repeats the pattern, and the "neither" column is where the library has
already done the work for you.

| Want | LBYL | EAFP | Neither (preferred) |
|---|---|---|---|
| index of a value | `if x in lst: lst.index(x)` | `try: lst.index(x)` / `except ValueError` | build a `dict` index once |
| remove a value | `if x in lst: lst.remove(x)` | `try: lst.remove(x)` / `except ValueError` | — |
| remove from a set | `if x in s: s.remove(x)` | `try: s.remove(x)` / `except KeyError` | `s.discard(x)` |
| drop a key | `if k in d: del d[k]` | `try: del d[k]` / `except KeyError` | `d.pop(k, None)` |

`list.index` and `list.remove` are documented as raising `ValueError` — *"Raises
`ValueError` if value is not found in sequence"* — and the LBYL form scans the list
**twice**: once for `in`, once for `index`. On a list of any size that is the more
expensive spelling as well as the racier one.

For sets, the API ships both halves of the choice explicitly. Probed on the installed
CPython **3.14.4**:

- `set.remove.__doc__` — *"Remove an element from a set; it must be a member. If the
  element is not a member, raise a `KeyError`."*
- `set.discard.__doc__` — *"Remove an element from a set if it is a member. Unlike
  `set.remove()`, the `discard()` method does not raise an exception when an element is
  missing from the set."*

That pair is the whole topic in miniature: two methods, identical effect on a hit,
differing only in whether absence is an event. Choosing `discard` is not "avoiding an
exception" — it is stating that absence is not exceptional here.

## Nested lookups: whose `KeyError` is it?

```python
# 🔴 Three subscripts, one handler. Which key was missing? The handler cannot tell you.
def email_of(payload: dict) -> str | None:
    try:
        return payload["user"]["contact"]["email"]
    except KeyError:
        return None
```

The `except KeyError` catches a miss on `"user"`, on `"contact"`, on `"email"` — and also
a `KeyError` raised by a `__missing__` hook three levels down, or by any code a custom
mapping runs. Returning `None` for all of them throws away the difference between "this
payload has no user" (a routing bug) and "this user has no email" (ordinary). Two repairs,
depending on what the contract says:

```python
# If every level is required, do not catch at all — the KeyError names the level.
def email_of_strict(payload: dict) -> str:
    return payload["user"]["contact"]["email"]

# If each level is optional, say so once per level with the "neither" spelling.
def email_of_optional(payload: dict) -> str | None:
    user = payload.get("user") or {}
    contact = user.get("contact") or {}
    return contact.get("email")
```

The general rule — one assumption per `try`, and never a handler wider than the
assumption — is **narrowing the `try`** *(not written yet)*, and mapping chains are
where it is broken most often.

## Gotchas

**★ Symptom: membership tests are the hot spot in a profile of a list-heavy loop.**
Cause: `x in lst` is a linear scan, and `if x in lst: lst.index(x)` scans twice. Fix:
build a `dict` or `set` index once outside the loop; the EAFP form (`try: lst.index(x)`)
halves the work but does not change the complexity.

```python
position = {value: i for i, value in enumerate(values)}   # once
idx = position.get(value)                                  # per lookup
```

**★ Symptom: `set.remove` raises `KeyError` during a retry or a second cleanup pass.**
Cause: the element was already removed by the first attempt, and `remove` asserts
membership — probed on CPython 3.14.4, *"Remove an element from a set; it must be a
member. If the element is not a member, raise a `KeyError`."* Fix: `discard`, which exists
for exactly this one-word change.

```python
active_sessions.discard(session_id)     # idempotent; remove() would raise on the retry
```

**★ Symptom: `except KeyError` around a chained lookup hides a bug in a `__missing__`
hook, a property or a helper.** Cause: the handler is wider than the assumption, so a
`KeyError` raised by *code you called* is indistinguishable from the key you were
testing. Fix: one subscript per `try`, or `get` per level.

**Symptom: `list.remove(x)` raises `ValueError` where the author expected a silent
no-op.** Cause: sequences have no `discard` — the documented behaviour is *"Raises
`ValueError` if value is not found in sequence"*. Fix: EAFP with `except ValueError`, or
a membership test if the list is short and unshared, or a `set` if order does not matter.

**Symptom: code checks `if item in seq` and then indexes with a stale position.** Cause:
`in` tells you presence, not position, so the author reached for `index` afterwards — two
scans and two moments. Fix: one call that returns the position, with the miss handled
where it happens.

```python
try:
    idx = seq.index(item)
except ValueError:
    idx = None
```

**Symptom: `next(iter(...))` raises `StopIteration` inside a generator and the generator
just... ends.** Cause: an LBYL-free "take the first" that leaks `StopIteration` into a
generator frame, where it is interpreted as exhaustion rather than as an error. Fix: give
`next` its default — `next(it, None)` — which is the "neither" spelling for iterators, and
never let a bare `StopIteration` cross a generator boundary.

**Symptom: a chained `.get(...)` walk returns `None` and nobody can say which level was
absent.** Cause: the same information loss as the wide `except`, in the opposite
spelling. Fix: if the distinction matters, walk explicitly and name the level in the
error; if it does not, document that the function returns `None` for "any level missing"
and stop pretending it is precise.

**Symptom: `payload["items"][0]` raises `IndexError` in a handler written for
`KeyError`.** Cause: a chain mixes two container types, and each has its own miss
exception — `KeyError` for the mapping, `IndexError` for the sequence. Fix: catch
`LookupError`, their documented common base, when you genuinely mean "any lookup in this
chain failed", and say so in a comment; otherwise split the chain.

**Symptom: `dict.keys()` membership was replaced by `in dict` in review, and a
`set`-based intersection got slower.** Cause: `d.keys()` is a set-like view with useful
operations (`&`, `|`, `-`), so replacing every occurrence mechanically loses the ones
that were doing set algebra rather than a membership test. Fix: `key in d` for membership,
`d.keys() & other` when the operation is genuinely on sets of keys.

## Interview questions

**★ What is wrong with `try: return payload["a"]["b"]["c"] except KeyError: return
None`?**
The handler is three times wider than any assumption you could state. It cannot say which
level was missing, so a structural bug ("no user on this event") and an ordinary optional
field ("this user has no email") produce the same `None`, and a `KeyError` raised by a
custom mapping's `__missing__` deep inside is swallowed too. Either every level is
required — in which case do not catch, and let the `KeyError` name the level — or each is
optional, in which case say so per level with `get`.

**★ `set.remove` versus `set.discard`: how do you choose?**
By whether absence is an event. `remove` *"must be a member … if the element is not a
member, raise a `KeyError`"*, so it asserts membership as a precondition; `discard`
*"does not raise an exception when an element is missing from the set"*, so it asserts
only the postcondition — afterwards the element is gone. Idempotent cleanup wants
`discard`; code where a missing element means the bookkeeping is broken wants `remove`
and the exception.

**★ Why does `list.index` raise instead of returning `-1` like some other languages?**
Because `-1` is a valid index in Python, so a sentinel return would be ambiguous with a
real answer — `seq[-1]` is the last element. Raising `ValueError` keeps the failure out of
the value domain entirely, which is the same reason `d[key]` raises rather than returning
`None`: a mapping may legitimately contain `None`. Where a sentinel *is* wanted, the
library gives you an explicit one (`get`'s default, `next`'s default) rather than
overloading a real value.

**When is `if x in lst` before `lst.index(x)` acceptable?**
When the list is small, local and unshared, and the two-scan cost is irrelevant — a
handful of enum names, a parsed command line. Even then the single-call form is shorter
and cannot go stale. The pattern becomes indefensible on a large list (two O(n) scans
where one would do) or a shared one (the gap), and its usual real fix is neither style: a
`dict` index built once.

**Why does catching `LookupError` sometimes make sense in a chained lookup?**
Because `KeyError` and `IndexError` share it as a base class, so a chain that mixes
mappings and sequences has one honest "any lookup failed" handler instead of a tuple that
someone will forget to extend. It is still a wide handler, so it needs the same
justification as any other: you must be able to say that *every* lookup in the block is
optional in the same way. If they are not, split the block.

**A colleague replaces every `except KeyError: pass` in a module with
`contextlib.suppress(KeyError)`. Better?**
Usually clearer, and identical in effect — but it inherits the same width problem, and
adds one of its own: the suppressed block is *skipped from the raise onward*, not
resumed. Both are only as good as the narrowness of the block they wrap.
[`suppress` and the explicit ignore](../11-exceptions/11-suppress-and-the-explicit-ignore.md)
covers its semantics and the tests that disqualify it.

**Is there an EAFP/LBYL question for iterators?**
Yes, and it has the same three answers. `next(it)` is the leap and raises
`StopIteration`; `next(it, default)` is the "neither" form; and there is no useful
"look", because asking an iterator whether it has a next item means consuming one. That
asymmetry is why the third family dominates here — and why leaking `StopIteration` out of
a helper into a generator frame is such a common bug that Python has a
[`PEP 479`](https://peps.python.org/pep-0479/) rule about it.

---

← Prev: [Writing on a miss](03b-writing-on-a-miss.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → **Attributes and duck typing** *(not written yet)*
