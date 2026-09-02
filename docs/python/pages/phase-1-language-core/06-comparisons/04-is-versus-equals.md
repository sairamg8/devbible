---
title: "is asks whether two names point at one object; == asks whether two objects mean the same thing — and only one of them is right for None"
sidebar_label: "4 · `is` versus `==`"
sidebar_position: 67
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Identity comparisons](https://docs.python.org/3.14/reference/expressions.html#is)
> and [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> [`id()`](https://docs.python.org/3.14/library/functions.html#id),
> [`object.__bool__`](https://docs.python.org/3.14/reference/datamodel.html#object.__bool__),
> and [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/#programming-recommendations).
> Version spine: **CPython 3.14**.

**`is` is the only comparison operator a class cannot intercept. It compares object
identity — `id(x) == id(y)` — and it is right in exactly one family of situations:
when the thing on the right is a singleton you control the creation of. `None` is the
canonical case, sentinels are the interesting one, and everything else is a bug
waiting for a payload big enough to fall out of an interpreter cache. `==` asks a
question about *value* and dispatches into your code; `is` asks a question about
*memory* and dispatches nowhere.**

## The definition

> *"The operators `is` and `is not` test for an object's identity: `x is y` is true if
> and only if x and y are the same object. An Object's identity is determined using
> the `id()` function. `x is not y` yields the inverse truth value."* —
> [Identity comparisons](https://docs.python.org/3.14/reference/expressions.html#is)

And `id()`:

> *"Return the "identity" of an object. This is an integer which is guaranteed to be
> unique and constant for this object during its lifetime. Two objects with
> non-overlapping lifetimes may have the same `id()` value."*
>
> *"**CPython implementation detail:** This is the address of the object in memory."* —
> [`id()`](https://docs.python.org/3.14/library/functions.html#id)

Read the second sentence of the `id()` docs again: *"Two objects with non-overlapping
lifetimes may have the same `id()` value."* An `id` is not a durable handle. Store one
in a dict and the object it referred to can be freed and its address reused by an
entirely different object. `id()` is a debugging aid, not an identifier.

## Three properties `is` has and `==` does not

**1 · It cannot be overloaded.** There is no `__is__`. Whatever class you are holding,
`x is y` is a pointer comparison. That is what makes it trustworthy for sentinels —
a hostile or buggy `__eq__` cannot change the answer.

**2 · It cannot raise.** `==` calls a method that can raise, return an array, hit the
database, or return `NotImplemented` and end up raising `TypeError` from an ordering
fallback. `is` cannot fail. In an `except` handler or a `__del__`, that matters.

**3 · It is O(1).** `==` on two 10-MB strings compares 10 MB. `is` compares two
pointers. (CPython's `str.__eq__` does check identity first as a shortcut, and the
reference notes built-in containers do the same, but that is an optimisation of `==`,
not a property of it.)

## `is None` — the one everybody agrees on

PEP 8:

> *"Comparisons to singletons like None should always be done with `is` or `is not`,
> never the equality operators."* —
> [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations)

And the language reference gives the same advice from the other direction:

> *"`None` and `NotImplemented` are singletons. **PEP 8** advises that comparisons for
> singletons should always be done with `is` or `is not`, never the equality
> operators."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

`x == None` is not merely unidiomatic, it is *unreliable*: any class can define
`__eq__` to return `True` when compared against `None`, and several real ones do.
`unittest.mock.ANY` compares equal to everything, including `None`. A pandas Series
compared to `None` returns a Series. SQLAlchemy's `column == None` builds
`column IS NULL` and is truthy as an object. Every one of those breaks `if x ==
None:` and none of them can break `if x is None:`.

```python
def process(timeout=None):
    if timeout is None:            # ✅
        timeout = DEFAULT_TIMEOUT
```

And the negation, which PEP 8 also has an opinion about:

> *"Use `is not` operator rather than `not ... is`. While both expressions are
> functionally identical, the former is more readable and preferred."*

```python
if x is not None:      # ✅
if not x is None:      # ✗ same result, reads as "not x" for one beat
```

## `if x:` is not `if x is not None:`

PEP 8 again, and this is the bug the truthiness topic is about:

> *"Also, beware of writing `if x` when you really mean `if x is not None` – e.g. when
> testing whether a variable or argument that defaults to None was set to some other
> value."*

`0`, `0.0`, `""`, `[]`, `{}`, `set()`, `Decimal("0")` and `datetime.time(0, 0)` are
all falsy and all legitimate values. A `limit=None` parameter tested with `if limit:`
treats an explicit `limit=0` as "not supplied":

```python
def fetch(limit=None):
    if limit is None:              # ✅ distinguishes 0 from unset
        limit = DEFAULT_LIMIT
```

## Sentinels: when `None` itself is a valid value

The pattern `def f(x=None)` breaks down the moment `None` is a meaningful argument —
"set this field to null" versus "do not touch this field". The fix is a private
sentinel, compared with `is`:

```python
_UNSET = object()

def update(record, *, nickname=_UNSET, bio=_UNSET):
    if nickname is not _UNSET:
        record.nickname = nickname     # may legitimately be None
    if bio is not _UNSET:
        record.bio = bio
```

`object()` is the minimal choice: a fresh, unique, hashable, falsy-free object that
compares equal to nothing but itself. Two refinements worth knowing:

```python
class _Unset:
    __slots__ = ()
    def __repr__(self): return "<unset>"
    def __bool__(self): return False    # only if you want `if x:` to treat it as absent
_UNSET = _Unset()
```

A `__repr__` makes tracebacks and log lines readable — a bare `object()` prints as
`<object object at 0x...>`, which tells a reader nothing. Do *not* give a sentinel an
`__eq__`; the whole point is that `is` is the test.

`dataclasses.MISSING`, `inspect.Parameter.empty` and `enum.auto`'s internals are all
this pattern in the standard library. Since 3.11 the typing spec also has
`typing.Never`-adjacent conventions for annotating these, but a plain
`Final` module-level sentinel with a small class is the portable version.

## `is True` and `is False`: nearly always wrong

PEP 8 says not to compare booleans with `==`, and adds that `is` is worse. Three
distinct failures:

```python
flag = 1
flag == True      # True   — bool is a subclass of int; 1 == True
flag is True      # False  — 1 and True are different objects
if flag:          # True   — what you meant
```

```python
x = np.bool_(True)     # or numpy's bool scalar, or a SQLAlchemy result
x == True              # True
x is True              # False — not the same object as the builtin singleton
```

The single legitimate use is a **three-state** value where `True`, `False` and `None`
must be told apart and the source guarantees actual `bool` objects:

```python
match consent:            # tri-state: granted / refused / never asked
    case True:  ...
    case False: ...
    case None:  ...
```

Even there, `if consent is None: ... elif consent: ...` is clearer. Note that `match`
patterns for `True`/`False`/`None` are specified to use `is`, which is one of the few
places the language does it for you.

## `type(x) is C` versus `isinstance(x, C)`

`is` is correct here and is not a "bad `is`" — it is exactly the question "is this the
class itself, not a subclass":

```python
type(x) is dict            # exactly a dict, not a defaultdict/OrderedDict
isinstance(x, dict)        # a dict or any subclass, or a virtual subclass
```

Use `type(x) is C` when subclass behaviour would be wrong — serialisers that dispatch
on exact type, `__eq__` implementations that must not treat a subclass as equal, a
fast path that assumes the exact C layout. Use `isinstance` everywhere else. Never
write `type(x) == C`: it invites a metaclass with a custom `__eq__` and reads as a
value comparison of two classes.

## Gotchas

**★ `if x == None:` returning `True` for an object that is not `None`.** `==`
dispatches to `__eq__`, which any class can define — `unittest.mock.ANY` compares
equal to everything, and mocks with `__eq__` configured do too. Fix: `if x is None:`,
always; it cannot be intercepted.

**★ `if x == None:` returning a Series or a SQL expression instead of a bool.**
pandas and SQLAlchemy overload `__eq__`; the `if` then either raises or takes a branch
based on the truthiness of an object. Fix: `is None`. In SQLAlchemy, when you *want*
`IS NULL` in the SQL, `column.is_(None)` says so explicitly.

**★ `if limit:` treating `limit=0` as "not provided".** `0` is falsy; `None` is a
different question. Fix: `if limit is None:`. PEP 8 calls this out by name.

**★ A `None` default that cannot express "set this to null".** The API needs three
states — absent, `None`, a value — and `None` is being used for two of them. Fix: a
module-level `_UNSET = object()` sentinel compared with `is`.

**★ A sentinel with an `__eq__` that leaks.** Someone adds `__eq__` to the sentinel
class "for tests", and now an unrelated object can compare equal to it, defeating the
whole design. Fix: sentinels get `__repr__` and nothing else; the test is `is`.

**★ `flag is True` failing for a value that is genuinely true.** `1`, `np.True_`, a
`bool` subclass instance, or a `True` reconstructed by `pickle`/`copy` in some
implementations are not the singleton. Fix: `if flag:` for truthiness, `flag ==
True` never, and `flag is True` only for a strictly tri-state `bool | None` you
produced yourself.

**★ `id()` values reused, making a "have I seen this object" cache report false
hits.** The docs say two objects with non-overlapping lifetimes may share an `id`.
Fix: keep a reference to the object (a `list`, or `weakref.WeakSet` if you must not
prolong its life) rather than storing bare `id()` integers.

**★ `not x is None` reviewed as equivalent to `not (x is None)` — which it is, but
only after a pause.** `not` binds looser than `is`, so the meaning is right and the
reading is wrong. Fix: `x is not None`, per PEP 8.

**★ `type(x) == C` used for an exact-type check.** It works today and invites a
metaclass `__eq__` to change the answer, and it reads as a value comparison. Fix:
`type(x) is C`, or `isinstance` if subclasses should pass.

## Interview questions

**★ Q: What is the difference between `is` and `==`?**
`is` compares identity — whether the two names refer to the same object, determined
by `id()` — and cannot be overloaded or raise. `==` compares value by dispatching to
`__eq__` on the operands, can return anything at all, and can raise. `is` is a
question about memory; `==` is a question about meaning.

**★ Q: Why must you write `if x is None` rather than `if x == None`?**
Because `==` runs user code. Any object can define `__eq__` to compare equal to
`None`, and several real ones do — `unittest.mock.ANY`, mocks, array types that
return an element-wise result, ORM columns that build SQL. `is` compares the pointer
against the `None` singleton and cannot be intercepted. PEP 8 states the rule for all
singletons.

**★ Q: When is `is` the right operator on something other than `None`?**
When the right-hand side is a singleton whose creation you control: `is True`/`is
False` for a strictly tri-state boolean, `is Ellipsis`, `is NotImplemented`, `x is
_UNSET` for a module-level sentinel, and `type(x) is C` for an exact-type check.
The common thread is that exactly one instance exists by construction.

**★ Q: What is a sentinel and why not just use `None`?**
A unique private object used to mean "no value supplied", needed when `None` is
itself a legal argument — "set this field to null" versus "leave it alone". Create it
as `_UNSET = object()` at module level (or a tiny class with a `__repr__` for
readable tracebacks) and test it with `is`, never `==`.

**Q: Why does `if x:` not mean `if x is not None:`?**
Because falsy is a much larger set than `None`: `0`, `0.0`, `""`, `[]`, `{}`,
`set()`, `Decimal(0)`, `time(0, 0)` and any object whose `__bool__` or `__len__` says
so. PEP 8 warns about exactly this when testing an argument that defaults to `None`.

**Q: Is `id()` a stable identifier for an object?**
Only for that object's lifetime. The docs say two objects with non-overlapping
lifetimes may have the same `id()`, and in CPython it is the memory address, which is
reused. Never persist an `id()`, and never use one as a cache key without holding a
reference to the object.

**Q: `type(x) is C` or `isinstance(x, C)`?**
`isinstance` by default — it accepts subclasses and ABC registrations, which is
usually what polymorphism wants. `type(x) is C` when a subclass would be wrong:
exact-type dispatch in a serialiser, an `__eq__` that must not equate a subclass, a
fast path relying on an exact layout. Never `type(x) == C`.

**Q: Can `is` raise an exception?**
No. It is a pointer comparison with no dispatch into Python code, which is why it is
safe in `__del__`, in exception handlers, and against objects in a half-constructed
state where `__eq__` would blow up.

---

← Prev: [What else chains](03b-what-else-chains.md) · Index: [Comparisons](README.md) · Next → [Why `is` seems to work](04b-why-is-seems-to-work.md)
