---
title: "Sequence, mapping and class patterns: taking a subject apart by shape"
sidebar_label: "2 · Sequence, mapping, class"
sidebar_position: 102
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `match` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement),
> [PEP 634 — Specification](https://peps.python.org/pep-0634/),
> [PEP 636 — Tutorial](https://peps.python.org/pep-0636/),
> and [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html).
> Target: **CPython 3.14**.

**Three pattern kinds do the actual destructuring, and each has one rule that is
not obvious from the syntax. Sequence patterns match by length and position —
but **`str`, `bytes` and `bytearray` are deliberately excluded**, so `case [a,
b]:` never decomposes a string. Mapping patterns are **partial**: extra keys in
the subject are ignored, which is what makes them right for JSON. And class
patterns are an `isinstance` check plus attribute extraction, with a special
single-positional form for a handful of builtins that matches the whole subject
rather than an attribute.**

## Sequence patterns

```python
match point:
    case []:                    # empty
    case [x]:                   # exactly one
    case [x, y]:                # exactly two
    case [Point(), *rest]:      # first is a Point, rest captures the remainder
    case [_, _, third, *_]:     # at least three; only the third is bound
```

Square brackets and parentheses are **interchangeable** in a sequence pattern —
`case [x, y]:` and `case (x, y):` mean the same thing, and neither restricts the
subject to a list or a tuple specifically. The pattern tests *sequence-ness*,
not the exact type.

At most one `*name` is allowed, and it captures a `list` of the remaining
elements regardless of the subject's type. `*_` is the "and any number more"
form that binds nothing.

### What counts as a sequence — and what deliberately does not

PEP 634 defines the set by capability: classes inheriting from or registered
with `collections.abc.Sequence`, or with the `Py_TPFLAGS_SEQUENCE` bit set. In
practice that means `list`, `tuple`, `range`, `collections.deque`,
`array.array`, `memoryview`, and your own `Sequence` subclasses.

And then the exclusion that matters:

> *"`str`, `bytes`, and `bytearray` are … not included in the above list and do
> not match sequence patterns."*

```python
match "hi":
    case [a, b]:
        print("never reached")
    case _:
        print("a str is not a sequence pattern subject")
```

This is deliberate, and it is the right call. Strings are iterable and
sequence-like, so without the exclusion every `case [first, *rest]:` written for
a list of tokens would also match a bare string and quietly decompose it into
characters — the same class of bug as `for c in "word"` when you meant a list of
words. `match` refuses.

The corollary: a `dict` is not a sequence either, so `case [k, v]:` does not
match a two-item mapping. And `set`/`frozenset` are unordered and therefore
match no sequence pattern at all.

## Mapping patterns

```python
match config:
    case {"host": host, "port": int(port)}:
        connect(host, port)
    case {"url": url, **rest}:
        connect_url(url, extra=rest)
```

Two rules define them, and the first is what makes them useful:

**Matching is partial.** A mapping pattern succeeds if the subject contains
*at least* the listed keys; extra keys are ignored. That is the opposite of a
sequence pattern, where length must match exactly (absent a `*`). It is exactly
right for JSON payloads, where an API adding a field must not break your
handler.

**Lookup uses `get`.** PEP 634 specifies that key-value pairs are matched using
*"the two-argument form of the subject's `get()` method"*, meaning matched pairs
*"must already exist in the mapping rather than being created dynamically by
`__missing__` or `__getitem__`"*. So a `defaultdict` does **not** manufacture a
key to satisfy a pattern — the pattern simply fails. That is the behaviour you
want, and it is worth knowing because `d["k"]` on the same `defaultdict` would
have created it.

**`**rest` captures the remaining keys** as a new `dict`. But:

> *"`**_` is disallowed by this syntax."*

Because a mapping pattern already ignores extra keys, `**_` would mean nothing,
and the grammar rejects it rather than letting people write a no-op that looks
significant.

**Duplicate keys are an error.** PEP 634: duplicate key values *"cannot
appear — this constitutes a syntax error when all keys are literals, or raises
`ValueError` at runtime otherwise."* The runtime case arises when keys are value
patterns that happen to be equal.

## Class patterns

A class pattern is an `isinstance` check plus attribute extraction:

```python
match shape:
    case Circle(radius=r):              # isinstance + shape.radius
        return math.pi * r * r
    case Rectangle(width=w, height=h):
        return w * h
    case Shape():                       # isinstance only, binds nothing
        raise NotImplementedError(type(shape))
```

Note `case Shape():` with empty parentheses — that is an isinstance test and
nothing more. **The parentheses are required**; `case Shape:` without them is a
*value* pattern comparing the subject to the class object itself with `==`,
which is almost never what you want and is a quiet way to write a case that
never matches.

### Positional arguments need `__match_args__`

```python
class Point:
    __match_args__ = ("x", "y")
    def __init__(self, x, y):
        self.x, self.y = x, y

match p:
    case Point(0, 0):       # → Point(x=0, y=0)
        print("origin")
```

The reference: *"Positional pattern `i` is converted to a keyword pattern using
`__match_args__[i]` as the keyword."* Without `__match_args__`, a positional
class pattern raises `TypeError` at match time — not at compile time, so it is a
runtime failure in a branch that may be rare.

`@dataclass` generates `__match_args__` from the fields in order, which is the
main reason dataclasses and `match` fit together so well. `NamedTuple` provides
it too. For a hand-written class you must declare it, and you must keep its
order in sync with the constructor — a reordering is a silent behaviour change,
because the pattern still compiles and still matches, just against the wrong
attributes.

### The self-matching builtins

A handful of builtins treat a single positional subpattern as matching the
**whole subject** rather than an attribute. PEP 634 names them: `bool`,
`bytearray`, `bytes`, `dict`, `float`, `frozenset`, `int`, `list`, `set`, `str`
and `tuple`.

```python
case str(name):         # subject is a str; bind the whole thing to name
case int(port):         # subject is an int; bind it to port
case {"port": int()}:   # the value at "port" is an int; bind nothing
```

This is how you write a **type test inside a larger pattern**, and it is the
idiom that makes `match` genuinely good at validating payloads:

```python
match payload:
    case {"id": int(id), "name": str(name), "tags": [*tags]}:
        ...     # id is an int, name is a str, tags is a sequence — all checked
```

Doing that with `if`/`elif` means three `isinstance` calls and three `.get`
lookups that can each raise.

## Gotchas

**Symptom — `case [a, b]:` never matches a two-character string.** Cause:
deliberate — `str`, `bytes` and `bytearray` are excluded from sequence patterns
so that patterns written for token lists do not silently decompose strings into
characters. Fix: none needed; if you truly want characters, convert with
`list(s)` first, or use a literal or `str()` class pattern.

**Symptom — `case Shape:` never matches, with no error.** Cause: without
parentheses it is a *value* pattern comparing the subject to the class object
with `==`, not an isinstance check. Fix: `case Shape():`. This is a close cousin
of the bare-name capture trap and just as quiet.

**Symptom — `TypeError` from a class pattern in a rarely-hit branch.** Cause:
the class has no `__match_args__` and the pattern used positional arguments; the
failure is at match time, not compile time. Fix: declare `__match_args__`, use a
`@dataclass`, or write the pattern with keywords.

**Symptom — a class pattern binds the wrong attributes after a refactor.**
Cause: `__match_args__` order was changed, or the dataclass fields were
reordered, so positional patterns now map to different attributes. It still
compiles and still matches. Fix: prefer keyword patterns
(`case Point(x=0, y=0):`) in code that will outlive the refactor;
`__match_args__` order is a public API.

**Symptom — a mapping pattern matches even though the payload has extra
fields.** Cause: mapping patterns are partial by design — extra keys are
ignored. Fix: this is what you want for API payloads. If you must reject
unknown keys, capture them with `**rest` and check `if not rest`, or validate
with a schema library instead.

**Symptom — a `defaultdict` does not satisfy a mapping pattern for a key that
`d[k]` would have created.** Cause: matching uses the two-argument `get()`, so
`__missing__` is never invoked and the key must already be present. Fix: this is
the correct behaviour; do not rely on a pattern to populate a default.

**Symptom — `SyntaxError` on a mapping pattern with `**_`.** Cause: PEP 634
disallows it, because extra keys are ignored anyway and `**_` would be a no-op
that looks meaningful. Fix: delete it.

**Symptom — `ValueError` at runtime from a mapping pattern.** Cause: two keys in
the pattern evaluated to the same value. With literal keys it is a
`SyntaxError`; with value patterns it can only be caught at runtime. Fix: remove
the duplicate — usually two constants that turned out to be equal.

**Symptom — a set or a dict does not match `case [a, b]:`.** Cause: neither is a
sequence for pattern-matching purposes; sets are unordered and match no sequence
pattern at all. Fix: use a mapping pattern for dicts; for sets, match on
`set()` as a class pattern and test membership in a guard.

**Symptom — `case (x, y):` matches a list, surprising a reviewer who expected a
tuple.** Cause: brackets and parentheses are interchangeable in sequence
patterns; neither constrains the concrete type. Fix: if the type matters, add a
class pattern — `case tuple((x, y)):` or `case [x, y] if isinstance(...)` — but
usually it does not, and testing shape rather than type is the point.

## Interview questions

**★ Q: Why doesn't `case [a, b]:` match the string `"hi"`?**
Because `str`, `bytes` and `bytearray` are explicitly excluded from sequence
patterns. It is deliberate: strings are sequence-like, so without the exclusion
every pattern written for a list of tokens would also match a bare string and
decompose it into characters. It is the same class of bug as iterating a string
when you meant a list of words, prevented at the language level.

**★ Q: Are mapping patterns exact or partial?**
Partial. A mapping pattern succeeds if the subject has *at least* the listed
keys; extra keys are ignored. That is the opposite of sequence patterns, which
match length exactly unless you use `*`. The partial behaviour is what makes
`match` safe for API payloads — a server adding a field does not break your
handler.

**★ Q: What is `__match_args__` for?**
It maps positional sub-patterns in a class pattern to attribute names — the
reference says positional pattern `i` is converted to a keyword pattern using
`__match_args__[i]`. Without it, a positional class pattern raises `TypeError`
at match time. `@dataclass` and `NamedTuple` generate it; a hand-written class
must declare it, and its order is a public API that a refactor can silently
break.

**Q: What does `case Shape:` do, without parentheses?**
It is a *value* pattern: it compares the subject to the class object itself with
`==`, which essentially never matches an instance. The isinstance test is
`case Shape():` with empty parentheses. It is the same shape of mistake as the
bare-name capture trap.

**Q: How do you assert a type inside a pattern?**
With a self-matching builtin class pattern: `case {"id": int(id)}:` checks that
the value is an `int` and binds it. PEP 634 lists the builtins that treat a
single positional sub-pattern as matching the whole subject — `bool`,
`bytearray`, `bytes`, `dict`, `float`, `frozenset`, `int`, `list`, `set`, `str`,
`tuple`. This is what makes `match` good at validating payload shapes.

**Q: Does a mapping pattern trigger `__missing__` on a `defaultdict`?**
No. Matching uses the two-argument form of `get()`, so the key must already be
present; `__missing__` and `__getitem__` are not called. The pattern simply
fails, which is the right behaviour — a pattern should not have the side effect
of populating the subject.

**Q: Why is `**_` disallowed in a mapping pattern?**
Because mapping patterns already ignore extra keys, so `**_` would be a no-op
that reads as though it did something. PEP 634 rejects it in the grammar rather
than allowing a misleading spelling.

**Q: Can a sequence pattern tell a list from a tuple?**
Not by itself — brackets and parentheses are interchangeable and both test
sequence-ness rather than a concrete type. If the exact type matters, add a
class pattern around it. Usually it should not matter: matching on shape rather
than type is the whole idea.

---

← Prev: [Capture versus value patterns](01b-capture-versus-value-patterns.md) · Index: [`match` — structural pattern matching](README.md) · Next → [Guards, OR patterns and AS patterns](03-guards-or-and-as.md)
