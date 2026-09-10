---
title: "The set operators demand a set on both sides and the named methods take any iterable — `a | lst` raises where `a.union(lst)` works, `==` against a list is silently `False`, the other operand's type decides what is legal, and precedence turns `a - b | c` into something nobody meant"
sidebar_label: "3b · Operators versus methods"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset) (the
> operator-versus-method notes), [dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Set),
> [thread safety for set objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-set-objects)
> — and the language reference — [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> [operator precedence](https://docs.python.org/3.14/reference/expressions.html#operator-precedence).
> Error strings are the format strings in CPython v3.14.7 `Objects/abstract.c` and `Objects/object.c`;
> what `Objects/setobject.c` does beyond the docs is marked *implementation detail*.
> Documentation-verified — **no sandbox run, no program output**.

**Every set operation has two spellings, and they are not synonyms. The operators `|`, `&`, `-`,
`^`, `<=` and `>=` accept only a set or a frozenset on the other side; the named methods
`union()`, `intersection()`, `difference()`, `symmetric_difference()`, `issubset()` and
`issuperset()` accept any iterable, and most of them accept several. The refusal is deliberate —
it exists to catch a string or a list sneaking into set algebra — but it is not uniform: `==`
never refuses, a dictionary view on either side lifts the restriction, and the operators bind
at different precedences, so an expression that reads left to right does not evaluate that way.**
The in-place spellings (`|=`, `update()`) are a second, separate trap and have their own page,
[3e · The in-place forms](03e-the-in-place-forms.md).

## The rule, verbatim

> *"Note, the non-operator versions of `union()`, `intersection()`, `difference()`,
> `symmetric_difference()`, `issubset()`, and `issuperset()` methods will accept any iterable as
> an argument. In contrast, their operator based counterparts require their arguments to be sets.
> This precludes error-prone constructions like `set('abc') & 'cbs'` in favor of the more readable
> `set('abc').intersection('cbs')`."*

> *"Note, the non-operator versions of the `update()`, `intersection_update()`,
> `difference_update()`, and `symmetric_difference_update()` methods will accept any iterable as an
> argument."* — [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

The full map, with the documented signatures. Four relations exist in only one of the two
spellings, and that is where people reach for the wrong one:

| Relation | Operator (sets only) | Method (any iterable) | Arity of the method |
|---|---|---|---|
| union | `a \| b \| c` | `a.union(*others)` | zero or more |
| intersection | `a & b & c` | `a.intersection(*others)` | zero or more |
| difference | `a - b - c` | `a.difference(*others)` | zero or more |
| symmetric difference | `a ^ b` | `a.symmetric_difference(other, /)` | **exactly one** |
| subset | `a <= b` | `a.issubset(other, /)` | one |
| superset | `a >= b` | `a.issuperset(other, /)` | one |
| proper subset / superset | `a < b`, `a > b` | **none** | — |
| equality | `a == b`, `a != b` | **none** | — |
| no common element | **none** | `a.isdisjoint(other, /)` | one |

`isdisjoint` is not in the note's list, but it has no operator to be stricter than; in 3.14.7 it
iterates a non-set argument and stops at the first shared element (implementation detail,
`Objects/setobject.c` `set_isdisjoint`).

## Why the operator refuses, and how

The rationale is the example in the note. A string is an iterable of characters, so
`set('abc').intersection('cbs')` means *"which of these characters appear in `'cbs'`"*. Written as
`set('abc') & 'cbs'` it would look like set algebra between two collections of words and quietly
compute something about letters. The operator forces you to say `set(...)` on the right, which is
where you notice you meant `{'cbs'}`.

The refusal is the ordinary binary-operator protocol, not a special check in the interpreter.
`set.__or__` (C slot `set_or` in 3.14.7) returns `NotImplemented` unless **both** operands are a
`set` or `frozenset`. Python then tries the right operand's reflected method; a `list` has no `|`,
so the statement raises with the generic format string from `Objects/abstract.c` —
`unsupported operand type(s) for |: 'set' and 'list'`. The consequence is that **what is legal
depends on both types**, not on the set: a right operand that implements the reflected operator
itself can succeed where a list fails.

```python
active = {"u1", "u2", "u3"}
from_request = ["u2", "u9"]            # JSON arrays arrive as lists

# active & from_request                # TypeError: unsupported operand type(s) for &: 'set' and 'list'
common = active.intersection(from_request)     # a new set: {"u2"}
also = active & set(from_request)              # same result, one explicit conversion
```

Prefer the method when the argument is naturally some other iterable — it skips building a
throwaway set, and the method's cost for a non-set argument is what the 3.14 table's footnotes
describe ([1d](01d-a-table-that-never-shrinks.md) has them verbatim). Prefer the operator when both
sides are already sets and you want the type error as a guard.

## Comparison: `<=` raises, `==` does not

The comparison operators follow the same protocol with a different fallback. `set_richcompare`
returns `NotImplemented` when the other operand is not a set. For `<`, `<=`, `>` and `>=` there is no
fallback at all:

> *"A default order comparison (`<`, `>`, `<=`, and `>=`) is not provided; an attempt raises
> `TypeError`."*

For `==` and `!=` there is one, and it is identity:

> *"The default behavior for equality comparison (`==` and `!=`) is based on the identity of the
> objects."* — [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

So `{1, 2} <= [1, 2]` raises `'<=' not supported between instances of 'set' and 'list'` (format
string, `Objects/object.c`), and `{1, 2} == [1, 2]` evaluates to `False` — no error, no warning, and
`{1, 2} != [1, 2]` is `True`. `==` is the one set operator whose strictness turns into a wrong answer
instead of an exception. There is no `isequal()` method; convert explicitly, and decide first whether
the list's duplicates matter:

```python
from collections import Counter

def same_members(current: set[str], submitted: list[str]) -> bool:
    return current == set(submitted)              # ignores duplicates in `submitted`

def same_multiset(current: list[str], submitted: list[str]) -> bool:
    return Counter(current) == Counter(submitted)  # counts them
```

`set` and `frozenset` compare with each other by members —
*"`set('abc') == frozenset('abc')` returns `True`"* ([Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)) —
so the refusal is about *kind*, not exact type.

## Who else can sit on the other side

The refusal is `set` returning `NotImplemented`, so an operand that implements the operator itself
changes the rules: a dictionary view or a `collections.abc.Set` on either side accepts any iterable,
returns a plain `set` even opposite a frozenset, and has no named `union()`. That is
[3d · Views and ABC sets as operands](03d-views-and-abc-sets-as-operands.md).

## Methods take several arguments; `symmetric_difference` takes one

`union`, `intersection` and `difference` take `*others`, so a chain of operators and a set of
temporary sets collapses to one call — and `set().union(*iterables)` unions any number of lists or
generators without converting each. `symmetric_difference(other, /)` takes exactly one argument,
because symmetric difference of more than two operands does not mean what it sounds like: `a ^ b ^ c`
keeps elements present in an **odd** number of the operands, so an element in all three survives.
*"In exactly one of them"* is a counting question:

```python
from collections import Counter

def in_exactly_one(*groups: set[str]) -> set[str]:
    counts = Counter(item for group in groups for item in group)   # each group is a set: no double counting
    return {item for item, n in counts.items() if n == 1}
```

## Precedence: the operators are not evaluated left to right

The set operators reuse the bitwise and arithmetic operator slots, so they inherit those
precedences. From the reference table, highest to lowest, the relevant rows are: `+`, `-` · `<<`,
`>>` · `&` · `^` · `|` · then `in`, `not in`, `is`, `<`, `<=`, `>`, `>=`, `!=`, `==` all together.

> *"The following table summarizes the operator precedence in Python, from highest precedence (most
> binding) to lowest precedence (least binding). Operators in the same box have the same
> precedence."* — [operator precedence](https://docs.python.org/3.14/reference/expressions.html#operator-precedence)

So difference binds tighter than intersection, which binds tighter than symmetric difference, which
binds tighter than union, and every one of them binds tighter than a comparison or `in`:

| Written | Parsed as |
|---|---|
| `everyone - admins \| banned` | `(everyone - admins) \| banned` — the banned users are added back |
| `a \| b & c` | `a \| (b & c)` |
| `a ^ b & c` | `a ^ (b & c)` |
| `user in staff \| contractors` | `user in (staff \| contractors)` — correct, and a new set per evaluation |
| `granted & required == required` | `(granted & required) == required` — correct |

The method spelling has no precedence to get wrong: `everyone.difference(admins, banned)` removes
both groups, and it reads as what it does.

## Operators and methods under free threading

On the free-threaded 3.14 build the two spellings also lock differently. The operators *"only
accept `set` or `frozenset` as operands and always lock both objects"*, while *"`set.update()` and
`set.union()` lock both objects only when the other operand is a `set`, `frozenset`, or `dict`"* and
*"`set.intersection()` and `set.difference()` always try to lock all objects"* —
[thread safety for set objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-set-objects).
A list passed to `union()` is iterated without any lock of its own, so another thread mutating that
list mid-call is not serialised against it. The page's own advice applies to both spellings:
*"Consider external synchronization when sharing `set` instances across threads."*

## Gotchas

**★ Symptom: `TypeError: unsupported operand type(s) for |: 'set' and 'list'` from a line that
merges request data into a set.** Cause: the operators require a set on both sides, and JSON arrays
decode to lists. Fix: use the method, which accepts any iterable — do not add a `set(...)` around
every argument out of habit.

```python
def merge_tags(existing: set[str], incoming: list[str]) -> set[str]:
    return existing.union(incoming)
```

**★ Symptom: a "has anything changed?" check always reports a change, although the stored roles and
the submitted roles are the same.** Cause: `stored_roles == submitted_roles` compares a set with a
list; `set_richcompare` declines, equality falls back to identity, and the answer is `False` — never
an error. Fix: compare like with like, and choose whether duplicates count (`same_members` or
`same_multiset` above).

```python
changed = stored_roles != set(submitted_roles)
```

**★ Symptom: a moderation job re-admits banned users.** Cause: `everyone - admins | banned` parses
as `(everyone - admins) | banned`, because `-` binds tighter than `|`. Fix: parenthesise, or use the
method, which has no precedence.

```python
reviewable = everyone.difference(admins, banned)
```

**Symptom: a report of items "in exactly one warehouse" lists items stocked in all three.** Cause:
`a ^ b ^ c` keeps elements present in an odd number of the operands. Fix: count occurrences —
`in_exactly_one` above.

**Symptom: `TypeError` from `set.union(*groups)` for some requests but not others.** Cause: calling
the method through the class makes the first group the receiver, and the receiver must be a set;
requests whose first group arrived as a list fail. Fix: call it on an empty set, which accepts any
iterables.

```python
def all_members(groups: list[list[str]]) -> set[str]:
    return set().union(*groups)
```

**Symptom: `TypeError` from `a.symmetric_difference(b, c)`.** Cause: unlike `union`, it takes exactly
one argument. Fix: decide what you meant — pairwise `(a ^ b) ^ c` for odd-count membership, or
`in_exactly_one(a, b, c)`.

**Symptom: a generator passed to `known.intersection(stream)` was not fully consumed, and the
side effects inside it stopped early.** Cause: in 3.14.7 intersection with a non-set argument stops
iterating once the result is as large as `known` — nothing more could be added (implementation
detail, `set_intersection`). Fix: never put side effects in an iterator you hand to a set method;
materialise it first if every item must be processed.

```python
received = list(stream)                 # every item is consumed and logged here
matched = known.intersection(received)
```

## Interview questions

**★ Why do `|`, `&`, `-` and `^` refuse a list when `union()`, `intersection()`, `difference()` and
`symmetric_difference()` accept one?**
The documentation gives the reason: it *"precludes error-prone constructions like
`set('abc') & 'cbs'`"*. A string is an iterable of characters, so letting the operator accept any
iterable would make `&` silently do character-level algebra whenever a string slipped in. The method
spelling makes the iterable argument explicit, so it is allowed. Mechanically, the set's operator
slot returns `NotImplemented` for a non-set; Python tries the right operand's reflected method, and
when there is none it raises `TypeError`.

**★ Why is `{1, 2} == [1, 2]` `False` rather than an error, while `{1, 2} <= [1, 2]` raises?**
Both comparisons start the same way: the set declines a non-set operand by returning
`NotImplemented`, and so does the list. After that the language treats equality and ordering
differently. Equality has a default — identity — so the result is `False`. Ordering has none; the
reference says *"a default order comparison … is not provided; an attempt raises `TypeError`"*.
The practical lesson is that `==` against the wrong type is a silent logic error, not a crash.

**★ What does `everyone - admins | banned` compute?**
`(everyone - admins) | banned`. Set operators take the precedence of the arithmetic and bitwise
operators they reuse: `-` above `&` above `^` above `|`, and all of them above comparisons. So the
banned users are added back into the result. `everyone - (admins | banned)` or
`everyone.difference(admins, banned)` is what was meant.

**What does `a ^ b ^ c` contain?**
Elements present in an odd number of the three sets — one or three. It is the right operation for
parity (a toggle applied several times), and the wrong one for "in exactly one". That is also why
`symmetric_difference` takes a single argument while `union` and `intersection` take several.

**Which set relations have only an operator, and which have only a method?**
Proper subset and superset (`<`, `>`) and equality have no named method; disjointness has no
operator, only `isdisjoint()`. Everything else has both, with the method accepting any iterable
and, for union, intersection and difference, any number of them.

---

← Prev: [Set comparison is a partial order](03c-set-comparison-is-a-partial-order.md) · [Topic index](README.md) · Next → [Views and ABC sets as operands](03d-views-and-abc-sets-as-operands.md)
