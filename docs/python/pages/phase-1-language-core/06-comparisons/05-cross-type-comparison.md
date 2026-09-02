---
title: "1 == 1.0 == Decimal(1) is True and exact, while 1 < 'a' raises — Python 3 compares across types only where the comparison means something"
sidebar_label: "5 · Cross-type comparison"
sidebar_position: 70
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> the library reference on
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types),
> [`-b` / `-bb`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-b),
> the [`datetime`](https://docs.python.org/3.14/library/datetime.html) supported
> operations, [`enum`](https://docs.python.org/3.14/library/enum.html),
> and [What's New In Python 3.0 — Ordering Comparisons](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.0.rst).
> Version spine: **CPython 3.14**.

**The reference draws one line: numbers compare across their types *"mathematically
(algorithmically) correct without loss of precision"*, and everything else either has
a documented cross-type rule or raises. Python 2 would happily order an `int` against
a `str` by comparing type names; Python 3 deleted that, and the `TypeError` you get
instead is the single most common runtime failure in code that sorts data parsed from
a file. Equality never raises — objects of incomparable types simply compare unequal —
which is why the *equality* version of the same bug is silent.**

## Numbers: exact across the whole tower

> *"Numbers of built-in numeric types and of the standard library types
> `fractions.Fraction` and `decimal.Decimal` can be compared within and across their
> types, with the restriction that complex numbers do not support order comparison.
> Within the limits of the types involved, they compare mathematically
> (algorithmically) correct without loss of precision."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

"Without loss of precision" is a strong promise and it is kept. `int` vs `float`
comparison is **not** implemented by converting the `int` to a `float` — that would
lose precision above 2⁵³ — so:

```python
2**53 == float(2**53)          # True   — representable
2**53 + 1 == float(2**53 + 1)  # False  — the float rounds; the int does not
                               #          and the comparison knows it
```

Similarly `Decimal("0.1") == 0.1` is `False`, because `0.1` as a `float` is not
exactly one tenth and the comparison compares the *actual* values rather than
rounding one to the other. `Fraction(1, 3) < 0.3334` is decided exactly.

And the equalities that do hold:

```python
1 == 1.0 == Decimal(1) == Fraction(1) == True     # all True
{1, 1.0, Decimal(1), True}                        # one element
```

`True` is in that chain because `bool` is a subclass of `int` with `True == 1`, and
the set collapses because equal numbers are required to hash equally
([02c](02c-ne-hash-and-the-contract.md)).

**Identity is a different question entirely.** `1 is 1.0` is `False` — they are
objects of different types, so they cannot be the same object, no matter that they
compare equal. This is the cleanest demonstration that `is` and `==` ask different
questions.

**`complex` has no ordering.** `1j < 2j` raises `TypeError`. Equality works
(`complex(1, 0) == 1` is `True`), and so does hashing. That is the numeric tower's
one hole, and it is why `sorted()` on a list of complex numbers fails while
`set(complex_list)` works.

## Everything else: no ordering across types

> *"The ordering comparison operators (`<`, `<=`, `>=`, `>`) raise a `TypeError`
> exception when the operands don't have a meaningful natural ordering. Thus,
> expressions like `1 < ''`, `0 > None` or `len <= len` are no longer valid, and e.g.
> `None < None` raises `TypeError` instead of returning `False`. A corollary is that
> sorting a heterogeneous list no longer makes sense — all the elements must be
> comparable to each other. Note that this does not apply to the `==` and `!=`
> operators: objects of different incomparable types always compare unequal to each
> other."* —
> [What's New In Python 3.0](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.0.rst)

That paragraph is the whole design in one place, and note its last sentence: the
asymmetry between ordering and equality is deliberate.

```python
1 < "a"
# TypeError: '<' not supported between instances of 'int' and 'str'

1 == "a"       # False. Quietly.
```

In Python 2, `1 < "a"` was `True`, because objects of different types were ordered by
type name — `int` before `str`. Code written against that produced stable but
meaningless orderings. Python 3 removed it, which converts a class of silent bugs into
loud ones, at the cost of a `TypeError` in every codebase that sorted mixed data.

## Where the `TypeError` actually shows up

Not at the comparison you wrote — at a `sort`, a `min`, a `max`, a `heapq.push` or a
`bisect.insort` deep inside library code:

```python
rows = [{"id": 3}, {"id": "12"}, {"id": 7}]        # one id came through as a string
sorted(rows, key=lambda r: r["id"])
# TypeError: '<' not supported between instances of 'str' and 'int'
```

Three fixes, in order of preference:

```python
# 1. Fix the data at the boundary — the real fix
rows = [{**r, "id": int(r["id"])} for r in rows]

# 2. Coerce inside the key, if the source is genuinely heterogeneous
sorted(rows, key=lambda r: int(r["id"]))

# 3. Sort by a normalising tuple when types must be kept apart
sorted(rows, key=lambda r: (isinstance(r["id"], str), r["id"]))
#    -> all ints first (False sorts before True), then all strings,
#       each group ordered within itself. No TypeError, because the
#       second element is only ever compared within one group.
```

Fix 3 is the general trick for any heterogeneous sort: make the first tuple element
partition by type so that the second element is never compared across the partition.
It also generalises to the `None` case ([05c](05c-none-never-orders.md)).

`min()` and `max()` fail the same way and for the same reason. So does
`heapq.heappush` on a list of `(priority, payload)` tuples where two priorities tie
and the payloads are not orderable — the tuple comparison falls through to the second
element. The standard fix is a monotonically increasing tie-breaker:

```python
import heapq, itertools
counter = itertools.count()
heapq.heappush(heap, (priority, next(counter), task))   # task never compared
```

## `bool` is an `int`, everywhere

```python
True == 1              # True
False == 0             # True
True + True            # 2
sorted([True, 0, 2, False])      # [False, 0, True, 2]  — or [0, False, ...]:
                                 # False and 0 compare equal, so their relative
                                 # order is whatever the input order was (stable sort)
[1, 2] == [True, 2]              # True — element-wise equality, and True == 1
{"a": 1}["a"] == True            # True
```

This is a frequent source of "why does my `if value == 1:` branch fire for `True`"
and of dict keys colliding: `{1: "int", True: "bool"}` is a one-element dict whose key
is `1` and whose value is `"bool"`. See `../02-numbers/04-bool-is-an-int.md` in the
numbers topic for the full treatment.

## Gotchas

**★ `TypeError: '<' not supported between instances of 'str' and 'int'` from inside
`sorted()`.** One record's field came through as the wrong type — a numeric ID quoted
in JSON, a CSV column never coerced. The comparison you never wrote is the one that
raised. Fix: coerce at the boundary; if the heterogeneity is real, sort by a
partitioning tuple such as `(isinstance(v, str), v)`.

**★ `1 == "1"` being `False` and nothing complaining.** Equality across incomparable
types is defined to be `False`, not an error — the 3.0 notes say so explicitly. So a
lookup that compares a parsed `int` id against a `str` id simply never matches. Fix:
normalise types at ingest; a `TypeError` would have been the kinder failure, and you
have to create it yourself with an assertion or a validating parser.

**★ `{1: "a", True: "b"}` having one entry.** `True == 1` and their hashes are equal,
so the second literal overwrites the first value while keeping the first key. Fix:
never mix `bool` and `int` keys; if you must distinguish, key on
`(type(k).__name__, k)`.

**★ `sorted(complex_numbers)` raising while `set(complex_numbers)` works.** The
reference carves complex numbers out of the numeric tower's ordering while leaving
equality and hashing intact. Fix: sort by `abs()`, by `(z.real, z.imag)`, or by
whatever ordering your domain actually means.

**★ `heapq` raising `TypeError` only occasionally.** Tuples compare element-wise, so
the second element is reached only when the priorities tie — and then the payloads
have to be orderable. Fix: insert a `next(itertools.count())` sequence number as the
second element so the payload is never compared.

**★ `Decimal("0.1") == 0.1` being `False` and looking like a bug.** It is correct: the
comparison is exact, and the `float` `0.1` is not exactly one tenth. Fix: compare
`Decimal` to `Decimal`, and construct decimals from strings rather than floats. See
`../02-numbers/10-decimal-for-money.md`.

**★ `if value == 1:` firing for `True`.** `bool` is a subclass of `int` and `True ==
1`. Fix: `if value is True:` if you genuinely need the singleton, `if value == 1 and
not isinstance(value, bool):` if you need "the integer one and not a boolean", and
usually a rethink of why a field holds both types.

**★ A `float` comparison against a large `int` returning a surprising answer.** The
comparison is exact and refuses to round the `int` down to a `float`, so
`2**53 + 1 != float(2**53 + 1)`. Fix: nothing — this is the correct behaviour, and
the surprise is that other languages get it wrong.

## Interview questions

**★ Q: Is `1 == 1.0` `True`? Is `1 is 1.0`?**
`==` is `True` — the reference guarantees numbers compare across their types
mathematically correctly without loss of precision. `is` is `False`: they are objects
of different types, so they cannot be the same object. It is the tidiest illustration
of the two operators asking different questions.

**★ Q: Why does `sorted()` raise `TypeError` on a list of mixed `int` and `str`?**
Python 3 removed Python 2's arbitrary cross-type ordering. The 3.0 release notes say
the ordering operators raise `TypeError` when the operands have no meaningful natural
ordering, and that sorting a heterogeneous list therefore no longer makes sense. The
error surfaces inside `sorted()` because that is where the `<` happens.

**★ Q: How would you sort a list that genuinely contains both `int`s and `str`s?**
With a key whose first element partitions by type:
`sorted(xs, key=lambda v: (isinstance(v, str), v))`. `False` sorts before `True`, so
all the numbers come first, ordered among themselves, then all the strings, ordered
among themselves — and the second tuple element is never compared across the
partition, so no `TypeError` is possible.

**★ Q: Why does `1 == "a"` return `False` instead of raising?**
Because the language treats equality and ordering differently on purpose. Equality
falls back to identity when neither operand knows the other, so any two objects can
be compared for equality; ordering has no such fallback and raises. The 3.0 notes
state that objects of different incomparable types always compare unequal.

**Q: Does `2**53 + 1 == float(2**53 + 1)` hold?**
No. The `float` cannot represent that integer, so it rounds, and the comparison is
performed exactly rather than by converting the `int` to a `float`. The reference's
"without loss of precision" is what makes the answer `False` instead of an accidental
`True`.

**Q: Which numeric type is left out of the ordering rules?**
`complex`. It participates in cross-type equality and hashing but supports no order
comparison — there is no ordering of the complex plane that respects arithmetic — so
`sorted()` on complex numbers raises while `set()` works.

**Q: Why does `{1, 1.0, True}` have one element?**
All three compare equal, and equal numbers are required to hash equally, so a set
keeps only the first one inserted. `bool` is a subclass of `int`, which is what puts
`True` in the same equivalence class as `1`.

**Q: How do you make a `heapq` priority queue safe when priorities tie?**
Push `(priority, next(counter), payload)` with `counter = itertools.count()`. Tuple
comparison is element-wise, so when two priorities are equal the heap compares the
sequence numbers — which are always distinct and always orderable — and never reaches
the payload.

---

← Prev: [The warning and lifetimes](04c-the-syntaxwarning-and-lifetimes.md) · Index: [Comparisons](README.md) · Next → [Text, sequences, time and enums](05b-text-sequences-time-and-enums.md)
