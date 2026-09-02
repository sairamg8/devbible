---
title: "The truthiness protocol: writing `__bool__` and the `__len__` fallback"
sidebar_label: "1b · The truthiness protocol"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [`object.__len__`](https://docs.python.org/3.14/reference/datamodel.html#object.__len__),
> the Library Reference
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing)
> and [`len()`](https://docs.python.org/3.14/library/functions.html#len).
> Target: **CPython 3.14**.

**This is the implementer's half of truthiness: how to give your own type a
truth value. There are exactly two methods, `__bool__` and `__len__`, and the
choice between them is a design decision rather than a style one — `__len__`
answers two questions at once and is right for anything container-shaped, while
`__bool__` is what you reach for when "empty" and "false" need to mean different
things. Getting this wrong produces a class that is truthy forever, or a
condition that means something the call site never says out loud.**

## Writing `__bool__` for your own class

If your object has a meaningful notion of "empty" or "nothing here", say so
explicitly:

```python
class Cart:
    def __init__(self, lines=None):
        self.lines = lines if lines is not None else []

    def __bool__(self):
        return bool(self.lines)
```

Now `if cart:` means "has anything in it". Without that method, `if cart:` is
`True` for every cart that was ever constructed, which is almost certainly not
what the reader of the call site expects.

`__bool__` must return an actual `bool`. Returning an `int` raises
`TypeError: __bool__ should return bool, returned int` — the interpreter checks
the type rather than truth-testing the result recursively, because otherwise the
protocol could recurse forever. So `return len(self.lines)` is a bug and
`return bool(self.lines)` is the fix; the `bool()` call here is doing real work,
unlike inside an `if`.

## Or write `__len__` and get truthiness for free

For anything container-shaped, `__len__` is the better method because it answers
two questions at once. The Language Reference is explicit that the fallback is
deliberate:

> *"Called to implement the built-in function `len()`. Should return the length
> of the object, an integer >= 0. Also, an object that doesn't define a
> `__bool__()` method and whose `__len__()` method returns zero is considered to
> be false in a Boolean context."*

```python
class Cart:
    def __init__(self, lines=None):
        self.lines = lines if lines is not None else []

    def __len__(self):
        return len(self.lines)      # len(cart) AND if cart: both work now
```

Two constraints come from the same section and both are real:

- **It must be non-negative.** A negative return raises `ValueError`.
- **CPython caps it at `sys.maxsize`.** The docs note that *"the length is
  required to be at most `sys.maxsize`"* and that features such as `len()` may
  raise `OverflowError` past that — `len(range(2 ** 100))` is the documented
  example. There is a subtler note in the same paragraph: *"To prevent
  unintended truncation to 32 bits, Python raises `ValueError` when attempting to
  set `__len__()` to a value that would cause an error on the current
  platform."* A lazy or generated collection that reports a huge length can
  therefore raise from inside `if x:`, which is not an error anyone expects a
  condition to produce.

## Defining both, on purpose

Defining both is right whenever "empty" and "false" are not the same question, or
whenever length is expensive:

```python
class ResultPage:
    """A page of results that knows it is a page even when it holds nothing."""
    def __init__(self, rows, next_cursor=None):
        self.rows = rows
        self.next_cursor = next_cursor

    def __len__(self):
        return len(self.rows)

    def __bool__(self):
        return True     # a page always exists; use len() to ask if it is empty
```

Here `if page:` means "we got a page back" and `if page.rows:` means "the page
has rows" — two different questions that a bare `__len__` would have collapsed
into one. Collapsing them is the most common truthiness bug in application code,
and [chunk 2](02-empty-versus-missing.md) is about nothing else.

The stdlib itself uses this split. `re.Match` objects are always truthy — a
match that matched the empty string is still a match — which is exactly why
`if m := pattern.search(s):` is the correct idiom. Had `Match` taken its truth
value from the length of the matched text, every zero-width match would have
read as a failure.

## The `__bool__` you should not write

Two anti-patterns, both seen in real code:

```python
class Response:
    def __bool__(self):
        return self.status_code < 400     # "truthy means success"
```

This is `requests`' actual design, and it is defensible for a library with a
strong idiom — but in application code it means `if response:` no longer answers
"did I get a response", which is what the words say. Every reader has to know
your convention. Prefer a named property: `if response.ok:`.

```python
class Config:
    def __bool__(self):
        return self.load()                # runs I/O
```

A condition that performs a side effect is a trap for anyone who adds a log line
(`logger.debug("config=%s", bool(cfg))`) and doubles the I/O. Keep `__bool__`
cheap and pure. If the question is expensive, make it a method with a verb in
its name. [What `if x:` costs](01c-what-if-x-costs.md) is the caller's side of
that same coin.

## A checklist for a new class

| Your type is… | Define | Because |
|---|---|---|
| A container with a cheap count | `__len__` only | One method gives you `len()` and truthiness, consistently |
| A container with an expensive count | `__len__` **and** a cheap `__bool__` | Otherwise every `if x:` pays for a full count |
| Always a valid object, sometimes empty | `__len__` and `__bool__` returning `True` | Separates "did I get one" from "is it empty" |
| A value object with a natural zero (money, duration, vector) | `__bool__` | "Zero" is a domain concept, not a length |
| A handle, connection, or identity | Neither | The default (always true) is correct; emptiness is meaningless |

The last row matters more than it looks. Not defining a truth value is a
legitimate design choice, and the default — always truthy — is usually the
right one for objects that are not collections. Adding `__bool__` to a `User`
because "an anonymous user should be falsy" is how you get a codebase where
`if user:` and `if user is not None:` mean different things and nobody remembers
which is which.

## Gotchas

**Symptom — your own class is always truthy even when it is obviously empty.**
Cause: you defined neither `__bool__` nor `__len__`, and the documented default
for every object is true. Fix: define `__len__` if the object is
container-shaped (you get `len()` too), or `__bool__` if "empty" needs a
definition of its own.

**Symptom — `TypeError: __bool__ should return bool, returned int`.** Cause:
your `__bool__` returns `len(self)` or `self.count` rather than a `bool`. Fix:
wrap it — `return bool(self.lines)` — or define `__len__` instead and let the
documented fallback do the work.

**Symptom — `if response:` is `False` for a perfectly good HTTP 404.** Cause: a
library (notably `requests`) defines `__bool__` as "status code below 400", so
truthiness means *success*, not *existence*. Fix: read the library's own docs
before truth-testing its objects, and in your own code prefer a named property
(`response.ok`) over overloading `__bool__` with a domain meaning.

**Symptom — a class with an expensive `__len__` is fast in one code path and
slow in another that looks identical.** Cause: `if x:` calls `__bool__` if it
exists and only falls back to `__len__` otherwise — so adding a cheap
`__bool__` changes the cost of every existing condition in the codebase. Fix:
this is the feature, not the bug. If length is expensive, define a cheap
`__bool__` alongside it deliberately, and say so in the docstring.

**Symptom — `len(obj)` raises `ValueError` on a class you just wrote.** Cause:
`__len__` returned a negative number — often from a subtraction like
`return self.high - self.low` where the bounds can invert. Fix: clamp at zero
(`return max(0, self.high - self.low)`) and decide whether an inverted range is
a bug worth raising for instead.

**Symptom — subclassing a container and overriding `__len__` silently changes
what `if x:` means.** Cause: the truthiness fallback follows the MRO like any
other method, so a subclass that redefines length has redefined truth. Fix:
intentional or not, make it explicit — if the subclass should keep the parent's
truth semantics, define `__bool__` on the subclass rather than leaving it to
the fallback.

**Symptom — a `__bool__` on a lazily-loaded object triggers the load, and the
load needs the object to be truthy.** Cause: `__bool__` calling into
initialisation that itself truth-tests the object recurses or deadlocks. Fix:
`__bool__` must only read already-materialised state. Move the loading into an
explicit method and have `__bool__` report on the loaded flag.

## Interview questions

**★ Q: `__bool__` and `__len__` are both defined. Which one is used?**
`__bool__`. `__len__` is consulted only when `__bool__` is absent. That is what
lets a class say "I am always a valid object" (`__bool__` returning `True`) while
still reporting a length of zero — the `ResultPage` pattern, where "did I get a
page" and "does the page have rows" are different questions.

**★ Q: Which should you define for a new container class?**
`__len__`, if the count is cheap. One method gives you `len()` and truthiness
and guarantees the two agree. Add a `__bool__` only when the count is expensive
(so `if x:` need not pay for it) or when existence and emptiness are genuinely
different questions.

**Q: Why must `__bool__` return a `bool` rather than anything truthy?**
Because the interpreter type-checks the result rather than recursively
truth-testing it — otherwise the protocol could recurse. Returning an `int`
raises `TypeError: __bool__ should return bool, returned int`, which is why
`return bool(self.items)` is the correct body and `return len(self.items)` is
not.

**Q: Can `__len__` return anything it likes?**
No. It must be an integer `>= 0` — a negative value raises `ValueError` — and in
CPython it is capped at `sys.maxsize`, past which `len()` may raise
`OverflowError`. The documented example is `range(2 ** 100)`. CPython also
raises `ValueError` up front if you set `__len__` to a value that would truncate
to 32 bits on the current platform.

**Q: Should `__bool__` ever mean something other than "non-empty"?**
Only with a very strong, well-documented idiom, and preferably not in
application code. `requests.Response.__bool__` means "status below 400", which
turns `if response:` into a success check rather than an existence check — every
reader has to know that. A named property (`response.ok`, `cart.is_empty`) costs
one word at the call site and removes the ambiguity entirely.

**Q: Is it acceptable to define neither method?**
Yes, and for non-container types it is usually correct. The default truth value
is `True`, which is the right answer for a handle, a connection, a `User`, a
`Decimal`-wrapping value object with no natural zero. Adding truthiness to such
a type creates a codebase where `if x:` and `if x is not None:` differ and
nobody can remember how.

**Q: Why is `re.Match` always truthy rather than reflecting the matched text?**
Because a zero-width match is still a match — `re.search(r"x*", "abc")` succeeds
and matches the empty string. If `Match` derived truth from length, that success
would read as a failure, and the standard `if m := pattern.search(s):` idiom
would silently skip it.

---

← Prev: [What falsy means](01-what-falsy-means.md) · Index: [Truthiness](README.md) · Next → [What `if x:` costs](01c-what-if-x-costs.md)
