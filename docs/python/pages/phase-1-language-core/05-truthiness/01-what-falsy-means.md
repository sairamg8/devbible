---
title: "What \"falsy\" means: the short list, and the rule underneath it"
sidebar_label: "1 · What falsy means"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing),
> [`bool()`](https://docs.python.org/3.14/library/functions.html#bool),
> [`len()`](https://docs.python.org/3.14/library/functions.html#len),
> and [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/#programming-recommendations).
> Target: **CPython 3.14**.

**Every object in Python has a truth value, and the default is `True`. An object
is false only if its class says so — by defining `__bool__` to return `False`, or
by defining `__len__` to return zero. That is the entire rule; the famous "empty
things are falsy" list is not a special case in the language, it is just the
built-in containers implementing `__len__`. Knowing the rule rather than
memorising the list is what lets you predict the answer for a `Decimal`, a
`numpy` array, a generator, or your own class — and each of those has surprised
someone.**

## The rule, in the docs' own words

The Library Reference states it directly:

> *"By default, an object is considered true unless its class defines either a
> `__bool__()` method that returns `False` or a `__len__()` method that returns
> zero, when called with the object."*

Two consequences fall straight out of that sentence and both matter:

1. **The default is true.** A class that defines neither method is *always*
   truthy, forever, no matter what state it is in. Your `class Cart:` with an
   empty `items` list is truthy unless you make it otherwise.
2. **`__bool__` wins.** If both methods exist, `__bool__` is the one consulted.
   `__len__` is only the fallback.

There is a third consequence in the same paragraph that is easy to miss:

> *"If one of the methods raises an exception when called, the exception is
> propagated and the object does not have a truth value."*

So `if x:` is not a safe operation. It runs user code, and that code can raise.
[The next chunk](01b-the-truthiness-protocol.md) is about what that costs.

## The built-in falsy values

The docs call these *"most of the built-in objects considered false"* — note
**most**, not all; the list is illustrative, not exhaustive.

| Category | Falsy values |
|---|---|
| Constants defined to be false | `None`, `False` |
| Zero of any numeric type | `0`, `0.0`, `0j`, `Decimal(0)`, `Fraction(0, 1)` |
| Empty sequences and collections | `''`, `()`, `[]`, `{}`, `set()`, `range(0)` |

Everything else built-in is truthy. Some entries people expect on that list and
which are not:

```python
bool("0")        # True  — a non-empty string
bool("False")    # True  — likewise; it is five characters, not a keyword
bool(" ")        # True  — a space is a character
bool([0])        # True  — a list of one falsy thing is still one thing
bool([[]])       # True  — same
bool({0: None})  # True  — one key
bool(float("nan"))  # True — NaN is not zero, and truthiness is not comparison
bool(-1)         # True  — falsy means *zero*, not "not positive"
bool(0.0)        # False
bool(-0.0)       # False — negative zero is still zero
```

The last few are worth pausing on. `float("nan")` compares equal to nothing at
all, not even itself, but it is still truthy: truth testing asks `__bool__`, and
`float.__bool__` asks "is this zero", which NaN is not. And `-1` is truthy for
the same reason — the rule is zero, not sign. Both have produced real bugs in
code written by people fluent in C, where `0` is false and a return value of
`-1` conventionally means failure.

:::note
`-0.0` is falsy because negative zero *is* zero. The
[signed-zero chunks in topic 02](../02-numbers/06c-signed-zero-and-serialisation.md)
cover why `-0.0` nonetheless survives long enough to reach your JSON.
:::

### Things that are falsy and often forgotten

- **`range(0)`** and any empty range, including `range(5, 5)` and `range(5, 0)`.
- **`b""`** — the empty `bytes` — and `bytearray()`. Anything with a `__len__`.
- **`collections.deque()`**, `Counter()`, `defaultdict(list)` while still empty,
  and every other empty stdlib container: they all implement `__len__`.
- **`Decimal("0.00")`** — quantised to two places, still numerically zero.
- **`Decimal("-0")`** — likewise.
- **`0j`**, and `complex(0, 0)`.
- **`np.array([])`** — an empty array is unambiguously falsy; it is the
  *non-empty* multi-element array that raises.

And two that are **truthy** and catch people out because their string form looks
false: `datetime.time(0, 0)` (midnight) and `datetime.timedelta(0)`. Midnight was
falsy up to Python 3.4 and was changed precisely because the bug it caused —
`if t:` silently skipping midnight — was worse than the convenience.
`timedelta(0)`, by contrast, **is** falsy, because `timedelta` defines
`__bool__` in terms of being a zero duration. Two neighbouring types in the same
module, opposite answers. Do not reason about this family from intuition; check.

## `bool()` is the conversion, not the test

You almost never need to write `bool(x)` in a condition. `if x:` already applies
what the docs call *"the standard truth testing procedure"* — `bool()` is
documented as doing exactly the same thing and returning the result as an object:

> *"Return a Boolean value, i.e. one of `True` or `False`. The argument is
> converted using the standard truth testing procedure. If the argument is false
> or omitted, this returns `False`; otherwise, it returns `True`."*

So `if bool(x):` is `if x:` with extra typing. Where `bool()` *does* earn its
place is when you need the truth value as a **value** rather than as a branch:

```python
# storing the fact, not branching on it
record = {"name": name, "has_tags": bool(tags)}

# normalising before comparing — a str and a list are never ==, their bools are
if bool(a) != bool(b):
    raise ValueError("exactly one of a and b must be provided")

# counting truthy things
active_count = sum(bool(u.session) for u in users)
```

That last one works because `bool` is a subclass of `int`, so `sum()` adds
`True` as `1`. The docs record two facts about the type that the rest of this
topic leans on: `bool` *"is a subclass of `int`"*, and *"it cannot be subclassed
further. Its only instances are `False` and `True`."* The singleton guarantee is
what makes `x is True` a sound (if usually pointless) test; the `int`
inheritance is why `True + True` is `2`. Topic 02 covers both in depth —
[`bool` is an `int`](../02-numbers/04-bool-is-an-int.md).

`bool()` with no argument returns `False`, which is occasionally useful as a
default factory: `defaultdict(bool)` gives you a counter of flags.

## What PEP 8 asks you to write

PEP 8 makes truthiness the recommended style for containers, and it is worth
quoting exactly because the second half is the part people skip:

> *"For sequences, (strings, lists, tuples), use the fact that empty sequences
> are false: `if not seq:` and `if seq:`"*

and, in the same list:

> *"Don't compare boolean values to True or False using `==`: `if greeting:` is
> correct; `if greeting == True:` is wrong. Worse: `if greeting is True:`"*

So `if len(items) == 0:` is not wrong, exactly — it is just noisier than
`if not items:`, and it asserts that `items` has a length, which a generator does
not. But `if items == []:` genuinely *is* worse: it is `False` for a tuple, for a
`deque`, for a `numpy` array and for anything else empty that is not a `list`.
The truthiness form is the one that keeps working when the type changes
underneath it.

And then PEP 8 immediately warns about the trap the next chunk but one is built
around:

> *"Beware of writing `if x` when you really mean `if x is not None` – e.g. when
> testing whether a variable or argument that defaults to None was set to some
> other value. The other value might have a type (such as a container) that could
> be false in a boolean context!"*

That warning is the hinge of this whole topic. Truthiness is the right tool for
"does this container have anything in it". It is the *wrong* tool for "did
someone give me a value", and the two questions look identical at the call site.
[Empty versus missing](02-empty-versus-missing.md) is about nothing else.

## Gotchas

**Symptom — a config flag read from the environment is always on.** Cause: every
non-empty string is truthy, so `os.environ.get("DEBUG", "")` returns `"false"`,
`"0"` or `"no"` and all three are truthy. Fix: parse the string into a bool
explicitly rather than truth-testing it —
`os.environ.get("DEBUG", "").lower() in {"1", "true", "yes", "on"}`. Topic 02's
[reading a bool in](../02-numbers/04f-reading-a-bool-in.md) covers the parsing
rules and `argparse`'s explicit warning against `type=bool`.

**Symptom — `if user_input:` rejects a legitimate `0` or `""`.** Cause: you used
truthiness to mean "was a value supplied", but zero and the empty string are
values *and* falsy. Fix: test for the sentinel instead — `if user_input is not
None:`. This is the subject of [chunk 2](02-empty-versus-missing.md).

**Symptom — `if my_generator:` is always `True`, even for a generator that will
yield nothing.** Cause: a generator object defines neither `__bool__` nor
`__len__`, so it takes the documented default of true. Truth-testing it cannot
possibly work — finding out whether it will yield anything requires running it,
and running it consumes it. Fix: materialise (`items = list(gen)`, then
`if items:`) or peek with `next(gen, _MISSING)`.

**Symptom — a filter written as `if items == []:` stops firing after someone
changes the return type to a tuple.** Cause: equality against a literal empty
container is type-specific; `() == []` is `False`. Fix: `if not items:`, which
asks the question you meant and survives the type change.

**Symptom — `if event_time:` silently skips events at midnight.** Cause: on
Python 3.4 and earlier `datetime.time(0, 0)` was falsy. It is truthy on every
supported version, but the idiom outlived the behaviour and the code still reads
as though it is guarding against "no time". Fix: `if event_time is not None:`.
Note that `timedelta(0)` *is* falsy, so the neighbouring type behaves the
opposite way.

**Symptom — a `Decimal` that displays as `0.00` is treated as a real amount by
one branch and as missing by another.** Cause: `Decimal("0.00")` is falsy —
quantisation does not change the numeric value — so `if amount:` and
`if amount is not None:` disagree about a legitimate zero-value invoice line.
Fix: decide which question the branch is asking and write that one. For money,
"is there a line" and "is the line non-zero" are almost never the same question.

## Interview questions

**★ Q: What makes an object falsy in Python?**
Its class defines `__bool__` returning `False`, or defines `__len__` returning
zero. Nothing else. Every other object is truthy, including objects that look
empty but implement neither method. The built-in "empty is falsy" list —
`None`, `False`, numeric zeros, `''`, `()`, `[]`, `{}`, `set()`, `range(0)` —
is just the built-in types implementing that rule, not a separate mechanism.

**Q: Is `if x:` different from `if bool(x):`?**
No — `bool()` is documented as applying the same standard truth-testing
procedure. `if bool(x):` is redundant. `bool()` earns its place when you want the
truth value as a value: storing it, returning it, comparing two objects' truth
values, or summing over them.

**Q: Is `"False"` falsy?**
No. It is a non-empty string, so it is truthy. So are `"0"`, `"None"` and
`" "`. This is why environment variables and query-string parameters must be
*parsed* rather than truth-tested — the string `"false"` from `DEBUG=false` will
turn debug on if you write `if os.environ.get("DEBUG"):`.

**Q: Is `float('nan')` truthy?**
Yes. Truth testing asks whether the value is zero, and NaN is not zero. This
surprises people because NaN is unequal to everything including itself — but
equality and truthiness are different protocols. `-1` is truthy for the same
reason: the rule is zero, not sign.

**Q: Why does PEP 8 say `if greeting is True:` is *worse* than `if greeting == True:`?**
Because both are redundant, and `is True` additionally fails for anything that
is truthy without being the `True` singleton — `1`, a non-empty list, a
`numpy.bool_`. `if greeting:` asks the question you actually meant, and works for
every type.

**Q: `if not items:` or `if len(items) == 0:` — does it matter?**
Usually only for style, and PEP 8 asks for the first. But it does matter for
anything without a length: a generator, an iterator, a lazy stream. `len()`
raises `TypeError` on those, and truthiness returns the default `True`, so
neither form is *correct* for a generator — that is a signal you need to
materialise or peek instead. `if items == []:` is a third form and is worse than
both: it is type-specific and quietly returns `False` for an empty tuple.

**Q: Name two types where your intuition about truthiness is likely to be wrong.**
`datetime.time(0, 0)` is truthy (it was falsy up to 3.4, and the change was made
because the falsy behaviour was a bug factory), while `datetime.timedelta(0)` in
the same module is falsy. And any object of a custom class with no `__bool__`
and no `__len__` is truthy no matter how empty it looks.

---

← Prev: [`bytes` vs `str`](../04-bytes-and-encoding/README.md) · Index: [Truthiness](README.md) · Next → [The truthiness protocol](01b-the-truthiness-protocol.md)
