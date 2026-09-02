---
title: "`is` asks whether two names reached the same object and `==` asks whether two objects have the same value, and only the first one tells you whether you have an aliasing bug"
sidebar_label: "2 · Identity, equality and `id()`"
sidebar_position: 72
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [§3.1 Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types),
> [§6.10 Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons),
> [`id()`](https://docs.python.org/3.14/library/functions.html#id),
> [`sys.getrefcount()`](https://docs.python.org/3.14/library/sys.html#sys.getrefcount),
> and the [glossary](https://docs.python.org/3.14/glossary.html#term-reference-count).
> Target: **CPython 3.14**.

**Aliasing is invisible to `==` and obvious to `is`. Two separate lists with the
same contents compare equal and behave completely differently under mutation;
one list with two names also compares equal to itself and is the thing that
will hurt you. `is` and `id()` are the only tools that distinguish them, and
they are debugging instruments — putting `is` into production logic on anything
but `None`, `True`, `False` and your own sentinels is its own bug.**

## The two questions

> *"The operators `is` and `is not` test for an object's identity: `x is y` is
> true if and only if x and y are the same object. An Object's identity is
> determined using the `id()` function."* — Expressions, §6.10.3

> *"Every object has an identity, a type and a value. An object's identity
> never changes once it has been created; you may think of it as the object's
> address in memory."* — Data model, §3.1

So `is` never lies and can never be overridden — there is no `__is__`. `==`
dispatches to `__eq__` and can be made to say anything at all. That asymmetry
is why identity is the diagnostic:

```python
a = [1, 2, 3]
b = [1, 2, 3]
c = a

a == b     # True  — same value
a is b     # False — two objects; mutating a leaves b alone
a == c     # True
a is c     # True  — ONE object; mutating a changes what c sees
```

Whenever you are staring at "why did this change", the question is never
`==`. It is `a is b`, or `id(a) == id(b)`, or `print(id(x))` at three points in
the call chain.

## `id()` and its one sharp edge

> *"Return the 'identity' of an object. This is an integer which is guaranteed
> to be unique and constant for this object during its lifetime. **Two objects
> with non-overlapping lifetimes may have the same `id()` value.**"*

The bolded sentence is the trap. An id is unique *while the object lives*; once
it is collected, the value can be handed out again. In CPython the id is the
address, so freeing a list and allocating another of the same size very often
reuses it. Any design that records `id(obj)` and later looks it up is a
correctness bug waiting for the allocator:

```python
seen = set()
for row in rows:
    if id(row) in seen:      # BROKEN: rows may be freed between iterations
        continue
    seen.add(id(row))
```

If `row` objects are created per iteration and dropped, the second iteration's
row can legitimately have the first's id and be skipped as "seen". The fix is
to keep the object alive rather than a number that describes it — store the
objects themselves in a `list`, or use `weakref.WeakSet` if you want them
collectable and want the entry to disappear with them. `id`-keyed dicts are
also how `copy.deepcopy`'s memo works, and it is safe there precisely because
the memo holds references to the objects for the duration of the copy.

## Which objects are shared, and why you must not depend on it

The data model gives the guarantee and the non-guarantee in one paragraph:

> *"after `a = 1; b = 1`, a and b may or may not refer to the same object with
> the value one, depending on the implementation. This is because `int` is an
> immutable type, so the reference to `1` can be reused. […] However, after
> `c = []; d = []`, c and d are guaranteed to refer to two different, unique,
> newly created empty lists."*

CPython does cache small integers and does intern many strings, so `a is b`
after `a = 1; b = 1` happens to be true, and `"abc" is "abc"` in a single
compilation unit happens to be true — and both are implementation details that
change between versions and between constant-folding contexts. Since 3.8,
comparing to a literal with `is` produces a `SyntaxWarning` telling you exactly
this. **Immutable sharing is legal because you cannot tell**: no operation on
an `int` or a `str` can change it, so two names pointing at one `5` is
indistinguishable from two `5`s. That indistinguishability is the whole reason
immutable objects are exempt from this topic's problems.

Mutable objects get the opposite guarantee: every `[]`, `{}`, `set()` and class
instantiation is a fresh object, because sharing *would* be observable.

## Where `is` belongs in real code

- `if x is None:` — the canonical use, and the only one most code needs.
- `if flag is True:` — almost always wrong; write `if flag:`. See
  [`bool` identity traps](../02-numbers/04b-bool-identity-traps.md) for why
  `is True` fails on `1`, `numpy.True_` and every truthy non-bool.
- Sentinel objects — the correct pattern when `None` is a legal value:

  ```python
  _MISSING = object()

  def get(self, key, default=_MISSING):
      try:
          return self._data[key]
      except KeyError:
          if default is _MISSING:
              raise
          return default
  ```

  `object()` instances have no `__eq__` beyond identity, so `is` is exactly
  right and no user value can ever collide with the sentinel.
- Cache and registry checks — `if result is cached_result:` when you want to
  know whether you got the *same* object back, which is precisely the
  `lru_cache` question in
  [Caches and long-lived workers](11c-caches-workers-and-orm.md).

## `in` compares identity first, and that is documented

Expressions §6.10.2 gives an equivalence that surprises people:

> *"For container types such as list, tuple, set, frozenset, dict, or
> collections.deque, the expression `x in y` is equivalent to
> `any(x is e or x == e for e in y)`."*

The identity check comes first, so an object that is not equal to itself is
still found in a container that holds it:

```python
nan = float("nan")
nan == nan              # False — documented: "not-a-number values are not equal to themselves"
nan in [nan]            # True  — the identity arm of the documented equivalence matches
float("nan") in [nan]   # False — a DIFFERENT nan object, and equality fails
```

`in` is the case the reference settles. CPython applies the same
identity-before-equality shortcut inside `list.index`, `list.remove`,
`list.count` and dict key lookup — it is how `PyObject_RichCompareBool` is
written — but the documentation states the equivalence only for membership
tests, so treat the rest as CPython behaviour rather than a language
guarantee. Either way the lesson holds: removing an object from a list by
value can succeed for the object you hold and fail for an equal-looking copy
of it.

## Reference counts, if you must look

`sys.getrefcount(obj)` returns the count including the temporary reference
created by the call itself, so the number is always at least one higher than
you expect. The glossary is careful to warn against reading anything into it:

> *"In CPython, reference counts are not considered to be stable or
> well-defined values; the number of references to an object, and how that
> number is affected by Python code, may be different between versions."*

Under 3.14's free-threaded build in particular, objects can be immortalised or
biased-reference-counted, so counts are not a debugging tool you should build a
test around. Use it to satisfy curiosity, not to assert.

## Gotchas

### `id()` used as a stable key
**Symptom.** A dedup set, a visited-set or an object registry keyed by `id()`
gives wrong answers under load and is correct in a small test.
**Cause.** ids are reused after collection — *"Two objects with non-overlapping
lifetimes may have the same id() value."* Small tests keep everything alive;
production does not.
**Fix.** Hold the objects (`list`, `dict` value, `weakref.WeakSet`) so their
lifetimes cannot end while the key is live, or key on a real domain identifier.

### `is` used for value comparison and it works in dev
**Symptom.** `if status is "active":` passes locally and fails when the status
arrives from JSON or a database.
**Cause.** Literals in one module can be interned into a single object, so
identity accidentally agrees with equality; a string built at runtime is a
different object with the same value.
**Fix.** Use `==`. Python 3.8+ emits `SyntaxWarning: "is" with a literal. Did
you mean "=="?` — do not silence it.

### Two "different" objects that are the same object
**Symptom.** Two config dicts, two default records, two "fresh" buffers, and
changing one changes both.
**Cause.** They were produced by a chained assignment, a shared default, a
class attribute, or a function returning the same cached object.
**Fix.** Print `id()` of both at the point they are created. If the ids match,
walk backwards to the single expression that made the object; that expression
is the bug.

### `x == x` is `False` and the code "cannot happen"
**Symptom.** A dedup or equality assertion fails on a row containing a
NaN.
**Cause.** IEEE 754: *"not-a-number values are not equal to themselves"*.
**Fix.** `math.isnan` explicitly, or keep NaN out of key positions. See
[NaN, infinity and signed zero](../02-numbers/06-nan-inf-and-signed-zero.md).

### `list.remove(x)` removes the wrong element
**Symptom.** Given two equal-comparing objects, `remove` deletes the first one
rather than "yours".
**Cause.** `remove` scans left to right and stops at the first match, and in
CPython the comparison tries identity before `__eq__` — so it may delete an
equal object that is not your object.
**Fix.** Search by index with an identity test, or key the collection by a real
identifier rather than relying on object equality.

## Interview questions

**★ Q: What is the difference between `is` and `==`?**
`is` compares identity — whether both operands are the same object, decided by
`id()`. `==` compares value and dispatches to `__eq__`, which any class can
define. Two distinct objects can be equal; one object always is itself (except
that `float('nan') == float('nan')` is false because IEEE 754 requires it, even
though `nan is nan` is true).

**★ Q: When should you use `is`?**
Against `None`, against `True`/`False` when you genuinely mean the singleton
and not truthiness (rare), against module-level sentinel objects, and when you
are specifically asking "is this the same object" — for example checking
whether a cache handed you back the original. Never for numbers or strings.

**★ Q: Why is `a is b` sometimes `True` for `a = 1000; b = 1000` and sometimes
not?**
Because the data model permits but does not require reuse of immutable objects.
CPython caches small ints and folds constants within a single code object, so
two `1000` literals compiled together may become one object while two computed
at runtime will not. Nothing in the language guarantees either outcome, so no
program should observe the difference.

**Q: `c = []` and `d = []` — can they be the same object?**
No. The data model guarantees they *"refer to two different, unique, newly
created empty lists"*. Sharing a mutable object would be observable through
mutation, so it is prohibited; sharing an immutable one is not observable, so
it is permitted.

**Q: Is `id()` unique?**
Only over an object's lifetime. The docs state that objects with non-
overlapping lifetimes may share an id. In CPython it is the memory address, so
reuse after deallocation is common rather than theoretical.

**Q: How would you prove that a function is mutating your list rather than
returning a new one?**
Capture `id(items)` before the call and compare it to `id` of what came back
and to `id(items)` after; and compare contents before and after. If the id is
unchanged but contents differ, it mutated in place. `copy.deepcopy` of the
input before the call, then comparing, is the assertion form of the same test.

**Q: Why does `float('nan') in [float('nan')]` differ from `x = float('nan'); x
in [x]`?**
Membership is documented as `any(x is e or x == e for e in y)`. In the second
form the identity arm matches immediately. In the first, the two NaNs are
distinct objects and NaN is not equal to itself, so both arms fail.

**Q: Can `is` be overridden?**
No. There is no `__is__` protocol; identity comparison is performed by the
interpreter on the object pointers. This is exactly why it is trustworthy for
sentinels: a hostile or clever `__eq__` cannot fake it.

---

← Prev: [Targets, binding forms and `del`](01b-assignment-targets-and-del.md) · Index: [Assignment and aliasing](README.md) · Next → [Aliasing: two names, one object](03-aliasing.md)
