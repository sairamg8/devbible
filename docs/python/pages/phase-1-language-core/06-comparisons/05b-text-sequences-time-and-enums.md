---
title: "Four cross-type equality rules that return False instead of raising: bytes against str, list against tuple, naive datetime against aware, and an Enum member against its own value"
sidebar_label: "5b · Text, sequences, time, enums"
sidebar_position: 71
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> [`-b` / `-bb`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-b),
> the [`datetime`](https://docs.python.org/3.14/library/datetime.html) supported
> operations, and [`enum`](https://docs.python.org/3.14/library/enum.html).
> Version spine: **CPython 3.14**.

**Four built-in type families have a cross-type equality rule that returns `False`
instead of raising, and every one of them produces a bug that no exception announces:
a `bytes` compared against a `str`, a `list` compared against a `tuple`, a naive
`datetime` compared against an aware one, and an `Enum` member compared against its
own value. Ordering, in every one of those four cases, does raise — so the same
mistake is loud in a `sort` and silent in an `if`.**

## `bytes` and `str`: never equal, never ordered

> *"Strings and binary sequences cannot be directly compared."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

Equality does not raise; it returns `False`:

```python
b"abc" == "abc"        # False  — silently
b"abc" < "abc"         # TypeError
```

That silent `False` is the entire failure mode of the `bytes`/`str` split
([04-bytes-and-encoding](../04-bytes-and-encoding/01-two-types-that-never-mix.md)),
and Python ships a flag to make it audible:

> *"Issue a warning when converting `bytes` or `bytearray` to `str` without specifying
> encoding or comparing `bytes` or `bytearray` with `str` or `bytes` with `int`. Issue
> an error when the option is given twice (`-bb`)."* —
> [`-b`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-b)

Run your test suite under `python -bb` and any accidental `bytes`-vs-`str` comparison
becomes a `BytesWarning` raised as an error. It is a one-flag audit for a whole class
of decoding bug. Note the third case it covers: comparing `bytes` with `int`, which
is how `b"x"[0] == b"x"` goes wrong — indexing a `bytes` yields an `int`.

`bytes` and `bytearray` *do* compare with each other, both for equality and ordering,
*"lexicographically using the numeric values of their elements"*.

## Sequences: `[1, 2] == (1, 2)` is `False`

> *"For two collections to compare equal, they must be of the same type, have the same
> length, and each pair of corresponding elements must compare equal (for example,
> `[1,2] == (1,2)` is false because the type is not the same)."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

And ordering across sequence types raises:

> *"Sequences (instances of `tuple`, `list`, or `range`) can be compared only within
> each of their types, with the restriction that ranges do not support order
> comparison. Equality comparison across these types results in inequality, and
> ordering comparison across these types raises `TypeError`."*

This is the bug in every test that asserts a function's return value against a literal
of the wrong bracket type — `assert f() == [1, 2]` when `f` returns a tuple — and it
is silent. Note `range` in that list: `range(3) == range(3)` is `True` (ranges compare
by the sequence they represent), but `range(3) < range(4)` raises.

## `datetime`: equality is quiet, ordering raises

The asymmetry appears again, and this one is a production incident waiting to happen:

> *"Naive and aware `datetime` objects are never equal."*
>
> *"Order comparison between naive and aware `datetime` objects raises `TypeError`."* —
> [`datetime`](https://docs.python.org/3.14/library/datetime.html)

```python
naive = datetime(2026, 9, 2, 12, 0)
aware = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)

naive == aware      # False — silently, even though they "look" identical
naive < aware       # TypeError: can't compare offset-naive and offset-aware datetimes
```

The docs also record that this used to raise for equality too: *"Changed in version
3.3: Equality comparisons between aware and naive `datetime` instances don't raise
`TypeError`."* So a cache keyed on a `datetime` misses forever if half your code path
produces aware values and half produces naive ones — no exception, just a permanent
miss. The fix is a policy, not a comparison: everything is aware and in UTC from the
moment it enters the process.

Two aware datetimes in different zones compare correctly: the docs say the comparison
*"acts as comparands were first converted to UTC datetimes"*. And `date` vs
`datetime` is its own trap — a `datetime` is a subclass of `date`, and comparing the
two is documented separately; check the version's docs before relying on it.

## `Enum`: identity for members, no ordering

> *"ordered comparisons between enumeration values are not supported (Enum members are
> not integers)"* and *"equality comparisons against non-enumeration values will always
> compare not equal"* —
> [`enum`](https://docs.python.org/3.14/library/enum.html)

```python
class Status(Enum):
    ACTIVE = "active"
    BANNED = "banned"

Status.ACTIVE == "active"      # False! the value is "active", the member is not
Status.ACTIVE.value == "active"# True
Status.ACTIVE < Status.BANNED  # TypeError
```

`Status.ACTIVE == "active"` returning `False` is the single most common `enum`
surprise, and it is exactly what the docs say will happen. The fixes are
`Status.ACTIVE.value == s`, `Status(s) is Status.ACTIVE`, or declaring the enum as a
`StrEnum` (3.11+) / `IntEnum`, which are documented as *"drop-in replacements for
existing integer- and string-based values"* and do compare equal to their underlying
type. Between members themselves, `is` is the right operator: members are singletons.

## Gotchas

**★ `b"abc" == "abc"` silently `False` after a missed `.decode()`.** Fix: run tests
under `python -bb`, which turns the comparison into an error via `BytesWarning`.

**★ `data[0] == b"\x00"` always `False`.** Indexing `bytes` yields an `int`, not a
one-byte `bytes`. `-b` covers this case too (`bytes` compared with `int`). Fix:
`data[0] == 0`, or slice instead of index — `data[0:1] == b"\x00"`.

**★ `assert result == [1, 2]` failing against a function that returns a tuple.**
Sequences of different types are never equal, however identical their contents. Fix:
compare like with like, or `list(result) == [1, 2]` if the type genuinely does not
matter.

**★ `range(3) < range(4)` raising `TypeError` while `range(3) == range(3)` is
`True`.** Ranges compare equal by the sequence they represent but are documented not
to support order comparison. Fix: `list(range(3)) < list(range(4))` if you really
want lexicographic ordering of the materialised sequences.

**★ A cache or a dedup keyed on `datetime` never hitting.** Half the code path
produces `tzinfo`-aware values and half produces naive ones, and naive and aware are
documented never to be equal. No exception is raised. Fix: make every datetime aware
and UTC at the boundary; add an assertion in the constructor if the codebase is large.

**★ `TypeError: can't compare offset-naive and offset-aware datetimes` appearing only
for some rows.** A database driver returned naive values for one column and aware for
another, or `datetime.now()` was used somewhere instead of
`datetime.now(timezone.utc)`. Fix: the same policy — never construct a naive datetime.

**★ Two aware datetimes in different zones compared and assumed unequal.** They are
not: the docs say the comparison acts as if both were first converted to UTC, so
`12:00+02:00 == 10:00+00:00` is `True`. Fix: nothing — but do not use `==` on
datetimes to test "same wall clock reading"; compare the naive components explicitly
if that is the question.

**★ `Status.ACTIVE == "active"` returning `False`.** An `Enum` member is not its
value, and the docs state that equality against non-enumeration values always compares
not equal. Fix: `.value`, or `Status(s)`, or make it a `StrEnum`.

**★ `sorted(list_of_enum_members)` raising `TypeError`.** Plain `Enum` supports no
ordered comparison — the docs say so, "Enum members are not integers". Fix: sort by
`.value`, by a declared `order` attribute, or use `IntEnum` if the underlying values
carry the ordering.

**★ A JSON round trip turning an `Enum` into a plain string that no longer compares
equal to the member.** `json.dumps` serialises `StrEnum`/`IntEnum` transparently but
plain `Enum` not at all without a custom encoder — and on the way back you have a
`str`. Fix: convert at the boundary with `Status(value)`, which raises `ValueError`
on an unknown value; that raise is the point.

## Interview questions

**★ Q: What happens when you compare a naive and an aware `datetime`?**
Equality returns `False` — the docs state naive and aware datetimes are never equal —
and ordering raises `TypeError`. Equality used to raise as well, until 3.3. The
practical consequence is that a mixed codebase gets silent cache misses rather than
exceptions, so the fix is a policy of aware-UTC everywhere, not a comparison change.

**★ Q: Why is `Status.ACTIVE == "active"` `False`?**
An `Enum` member is a distinct object whose `.value` is the string; the docs say
equality comparisons against non-enumeration values always compare not equal. Compare
`.value`, or convert with `Status(s)`, or use `StrEnum`, which is documented as a
drop-in replacement for string values.

**★ Q: What does `python -bb` do and why would you use it?**
It turns the `BytesWarning` for `bytes`-vs-`str` conversion and comparison — and for
`bytes`-vs-`int` comparison — into an error. Running a test suite under it is a
cheap, complete audit for the silent `b"x" == "x"` bug and for `data[0] == b"\x00"`.

**Q: Why is `[1, 2] == (1, 2)` `False`?**
The reference requires two collections to be of the same type, the same length, and
element-wise equal. Type first. Ordering across the two raises `TypeError` rather than
returning `False`.

**Q: How do two aware datetimes in different time zones compare?**
Correctly, by instant: the docs say the comparison acts as if both comparands were
first converted to UTC. So the same moment expressed in two zones compares equal, and
ordering reflects real elapsed time rather than wall-clock digits.

**Q: What is the right operator for comparing two `Enum` members?**
`is`. Members are singletons created once at class definition, so identity is exact,
cheap and cannot be intercepted — and it makes the intent ("this specific member")
obvious. `==` also works between members; `is` is preferred for the same reason it is
preferred for `None`.

**Q: Do `bytes` and `bytearray` compare with each other?**
Yes — the reference says binary sequences can be compared within and across their
types, lexicographically using the numeric values of their elements. It is only the
`bytes`/`str` boundary that is closed.

---

← Prev: [Cross-type comparison](05-cross-type-comparison.md) · Index: [Comparisons](README.md) · Next → [`None` never orders](05c-none-never-orders.md)
