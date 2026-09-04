---
title: "The only reliable way to find out whether an object is iterable is to call iter() on it — the documentation says so, and every type-shaped check you write instead is an approximation with a documented list of things it misses"
sidebar_label: "04b · Duck typing and type-shaped checks"
sidebar_position: 129
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `duck-typing`, `iterable`](https://docs.python.org/3.14/glossary.html),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html)
> (the `Iterable` note and footnote 1 on `__subclasshook__`),
> [`iter`](https://docs.python.org/3.14/library/functions.html#iter),
> [`isinstance`](https://docs.python.org/3.14/library/functions.html#isinstance),
> [`typing.runtime_checkable`](https://docs.python.org/3.14/library/typing.html#typing.runtime_checkable),
> [`inspect.getattr_static`](https://docs.python.org/3.14/library/inspect.html#inspect.getattr_static),
> [`hasattr`](https://docs.python.org/3.14/library/functions.html#hasattr).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**A type-shaped check answers "does this object belong to a category"; the operation
answers "does this work". Those are different questions, and the standard library
documents the gap between them in unusually plain language. `collections.abc` says
`isinstance(obj, Iterable)` *"does not detect classes that iterate with the
`__getitem__()` method"* and that *"the only reliable way to determine whether an object is
iterable is to call `iter(obj)`"*. `typing` says a runtime-checkable protocol *"will check
only the presence of the required methods or attributes, not their type signatures or
types"* and offers `ssl.SSLObject` — which passes a `Callable` check and cannot be called —
as its own counterexample. None of that makes these checks useless. It makes them checks
about *structure*, to be chosen when structure is the question, and never mistaken for a
guarantee that the leap will land.**

## When `hasattr` is the right call

It is not a construct to avoid; it is a construct to use knowingly. It fits when:

- **The attribute is plain data on an object you own** — no property, no `__getattr__`, so
  none of the three consequences can fire.
- **You are branching on a capability, not fetching a value** — `if hasattr(handler,
  "on_close")`, in a plugin loader, where the next step is to *call* it and you want the
  registration decision separated from the invocation.
- **A protocol check needs to be fast** — the `typing` documentation actively recommends
  it over `isinstance` against a runtime-checkable protocol: *"An `isinstance()` check
  against a runtime-checkable protocol can be surprisingly slow compared to an
  `isinstance()` check against a non-protocol class. Consider using alternative idioms such
  as `hasattr()` calls for structural checks in performance-sensitive code."*
- **The alternative is worse** — `getattr(obj, name, sentinel) is not sentinel` says the
  same thing with more code, and only avoids the double lookup, not the property run.

The glossary lists it as a duck-typing technique in its own right — duck-typing
*"typically employs `hasattr()` tests or EAFP programming"* — so the two are siblings, not
rivals. What the glossary does not say, and this page does, is that the first is
implemented in terms of the second.

## The iterability test: the documentation names the only reliable one

`collections.abc` states the limitation and the remedy in one sentence:

> *"Checking `isinstance(obj, Iterable)` detects classes that are registered as `Iterable`
> or that have an `__iter__()` method, but it does not detect classes that iterate with the
> `__getitem__()` method. The only reliable way to determine whether an object is iterable
> is to call `iter(obj)`."*

The gap is not hypothetical — the glossary's own definition of *iterable* includes
*"objects of any classes you define with an `__iter__()` method **or with a
`__getitem__()` method that implements sequence semantics**"*, and `for` handles both. So a
legacy sequence class with only `__getitem__` iterates perfectly and fails the ABC check.

```python
class Deck:
    """Old-style sequence: iterable via __getitem__, with no __iter__."""

    def __init__(self, cards: list[str]):
        self._cards = cards

    def __getitem__(self, index: int) -> str:
        return self._cards[index]


deck = Deck(["AS", "KH"])

for card in deck:                  # works — the sequence protocol is enough
    print(card)

# 🔴 The type-shaped check disagrees with the language.
from collections.abc import Iterable
isinstance(deck, Iterable)         # False

# The documented reliable test — and it is EAFP, because iter() raises.
def is_iterable(obj: object) -> bool:
    try:
        iter(obj)
    except TypeError:
        return False
    return True
```

`iter()`'s own entry supplies the other half: the argument *"must support the iterable
protocol (the `__iter__()` method), or it must support the sequence protocol (the
`__getitem__()` method with integer arguments starting at `0`). If it does not support
either of those protocols, `TypeError` is raised."* That `TypeError` is the answer channel
— which is why the reliable test is a `try`, not an `if`.

⚠️ Better still, in most real code, is not to ask. If the next thing you do is iterate,
iterate; the `TypeError` arrives with a message naming the type, at the line that needed
it. The predicate above earns its place only when the answer must be *reported* rather
than acted on — a validator, a serialiser choosing a strategy, an error message.

### The `str` trap, which is the reverse failure

The famous iterability bug is not a false negative but a false positive: `str` is
iterable, so "is this a collection of names or a single name" cannot be answered by
iterability at all.

```python
def notify(recipients) -> None:
    for r in recipients:           # "ada@example.com" iterates as 19 characters
        send(r)

# Fix: test the specific type you must exclude, before the general capability.
def notify_safe(recipients: str | list[str]) -> None:
    if isinstance(recipients, str):
        recipients = [recipients]
    for r in recipients:
        send(r)
```

This is a case where LBYL is simply right, and for the reason [where LBYL is right](05-where-lbyl-is-right.md) gives: the check is about the shape
of your own argument, nothing can mutate it between look and leap, and the failure it
prevents is silent rather than loud.

## Gotchas

**★ Symptom: a class that iterates fine in a `for` loop fails an
`isinstance(x, Iterable)` check.** Cause: it implements the sequence protocol
(`__getitem__`) rather than `__iter__`, which the ABC is documented not to detect. Fix:
call `iter()` — *"the only reliable way to determine whether an object is iterable"* — or
better, iterate and let the `TypeError` speak.

```python
try:
    iterator = iter(candidate)
except TypeError:
    raise ConfigError(f"expected a list of hosts, got {type(candidate).__name__}")
```

**★ Symptom: passing a single string where a list of strings was expected sends one
message per character.** Cause: `str` is iterable, so a capability check cannot
distinguish "one item" from "many items". Fix: exclude the specific type first — one of
the clearest cases where a type check beats duck typing.

**★ Symptom: a duck-typed function accepts an object, calls the method, and gets `None`
back.** Cause: the name existed, so every presence check passed, but the implementation is
a stub. Fix: validate the *result*, not the interface — and if you own both sides, an
abstract base class with an abstract method is the version of this check that fails at
class-definition time instead of at 3am.

**Symptom: `isinstance(x, dict)` rejects a perfectly good mapping.** Cause: the check
tests inheritance, not capability, so a `MappingProxyType`, a `ChainMap`, a
`TypedDict`-shaped object or someone's `UserDict` fails it. Fix: check against the ABC
(`collections.abc.Mapping`) if a category test is really wanted, and against nothing at
all if you simply intend to subscript it.

**Symptom: a `bytes` argument is treated as a sequence of small integers.** Cause: the
same false-positive shape as `str` — `bytes` is iterable, and iterating it yields `int`.
Fix: type the parameter and exclude the scalar-ish types explicitly before the general
capability branch; `isinstance(arg, (str, bytes))` first, iterate second.

**Symptom: a validator built on `iter()` consumed the thing it was validating.** Cause:
`iter()` on a generator or a file object returns an iterator over live state; calling it
to answer a predicate leaves the object partially consumed for the real work. Fix: do not
probe consumables — accept them, or materialise first (`items = list(candidate)`) and
validate the list.

**Symptom: a `for` loop over an argument silently does nothing instead of failing.**
Cause: the argument was an empty container, or an exhausted iterator, and iterability was
never the question — presence of items was. Fix: distinguish "not iterable" (a `TypeError`
you want) from "iterable and empty" (a value you must decide about), which is
[truthiness](../05-truthiness/README.md) territory.

## Interview questions

**★ How do you test whether an object is iterable?**
Call `iter()` on it inside a `try`. The `collections.abc` documentation says so directly:
`isinstance(obj, Iterable)` *"does not detect classes that iterate with the
`__getitem__()` method"*, and *"the only reliable way to determine whether an object is
iterable is to call `iter(obj)`"*. It is a rare case where the standard library names a
specific EAFP construct as the correct answer — and the better answer in most code is not
to test at all, but to iterate and let `iter()`'s own `TypeError` reach the caller.

**★ When is a type check better than duck typing?**
When the type *is* the distinction you need and duck typing cannot see it. The canonical
case is `str` versus a list of strings: both are iterable, so only an explicit
`isinstance(x, str)` separates "one recipient" from "many". It generalises to any case
where two types satisfy the same protocol with different meanings — `bytes` versus a
sequence of ints, a `Mapping` versus a sequence of pairs, a `Path` versus a string. In
those, an early type check prevents a silent wrong answer rather than a loud failure.

**★ The glossary says duck typing "avoids tests using `type()` or `isinstance()`" but also
that it "typically employs `hasattr()` tests". Is that a contradiction?**
No — it is a distinction between category tests and capability tests. Duck typing rejects
"is this a `Duck`" and permits "can this `quack`". The reason `hasattr` still sits
uneasily there is the one [chunk 04](04-hasattr-is-eafp-in-disguise.md) makes: it is
implemented as an attribute access, so it is a capability test that pays the cost of the
operation without giving you its result. Where the next step is to use the attribute,
using it is both cheaper and more accurate.

**Your function needs a file-like object. What do you check?**
Nothing, in the usual case: call `.read()` and let a missing or wrong `read` produce
`AttributeError` or `TypeError` at the line that needed it. If the function must choose
between two strategies rather than fail — a path versus an open file — test for the thing
you can test reliably (`isinstance(arg, (str, os.PathLike))`) and treat everything else as
the stream. That is a type check where the type genuinely is the distinction, and it does
not pretend to have verified that the stream reads.

**Why is "do not test, just iterate" usually better than the reliable `iter()` predicate?**
Because the predicate throws away everything except a boolean. Iterating gives you the
items *and* a `TypeError` whose message names the offending type, raised at the line that
needed the items — which is strictly more information for the same work. Keep the
predicate for the case where the answer is reported rather than acted on: a validator
collecting problems, a serialiser choosing a strategy, a friendly error message at a
boundary.

**Is `hasattr(obj, "__iter__")` a reasonable iterability test?**
No, in two directions. It misses `__getitem__`-only sequences, exactly as the ABC does,
and it can be fooled by a `__getattr__` hook that answers every name. It also inherits
`hasattr`'s own problem of running whatever it finds. The documented test exists and is
one line; use it.

---

← Prev: [`hasattr` is EAFP in disguise](04-hasattr-is-eafp-in-disguise.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Protocols and structural checks](04c-protocols-and-structural-checks.md)
