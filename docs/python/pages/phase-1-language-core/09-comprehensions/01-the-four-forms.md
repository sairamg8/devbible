---
title: "The four comprehension forms: three displays and one expression, distinguished only by their brackets"
sidebar_label: "1 · The four forms"
sidebar_position: 90
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> [List displays](https://docs.python.org/3.14/reference/expressions.html#list-displays),
> [Set displays](https://docs.python.org/3.14/reference/expressions.html#set-displays),
> [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays),
> [Generator expressions](https://docs.python.org/3.14/reference/expressions.html#generator-expressions),
> the Library Reference
> [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> and the [Glossary](https://docs.python.org/3.14/glossary.html#term-list-comprehension).
> Target: **CPython 3.14**.

**There is one comprehension grammar in Python and four things you can wrap it
in. Square brackets build a `list`, curly braces build a `set`, curly braces
with a colon in the element expression build a `dict`, and parentheses build a
lazy generator iterator that builds nothing at all until something asks. The
brackets are the entire difference — the clause syntax after the element
expression is byte-for-byte identical across all four. Two facts in this chunk
cause real bugs: `{}` is an empty **dict**, not an empty set, and a generator
expression's parentheses can be the call's own parentheses only when it is the
sole argument.**

## One grammar, four wrappers

The reference defines the comprehension once and then reuses it in each display:

> *"The comprehension consists of a single expression followed by at least one
> `for` clause and zero or more `for` or `if` clauses."*

```python
nums = [1, 2, 3, 4, 4]

[n * n for n in nums]            # list  → [1, 4, 9, 16, 16]
{n * n for n in nums}            # set   → {1, 4, 9, 16}   (deduplicated)
{n: n * n for n in nums}         # dict  → {1: 1, 2: 4, 3: 9, 4: 16}
(n * n for n in nums)            # generator iterator — nothing computed yet
```

| Form | Brackets | Produces | Eager? | Reusable? |
|---|---|---|---|---|
| List comprehension | `[ ... ]` | a new `list` | yes | yes |
| Set comprehension | `{ ... }` | a new `set` | yes | yes |
| Dict comprehension | `{ k: v ... }` | a new `dict` | yes | yes |
| Generator expression | `( ... )` | a generator iterator | **no** | **no — one-shot** |

Only the dict form differs in shape, and the reference is explicit about why:

> *"A dict comprehension, in contrast to list and set comprehensions, needs two
> expressions separated with a colon followed by the usual 'for' and 'if'
> clauses."*

That colon is the only thing distinguishing the two brace forms. The reference
puts it the other way round for sets: a set display is *"distinguishable from
dictionary displays by the lack of colons separating keys and values"*.

## `{}` is an empty dict, and there is no empty-set literal

The reference states it in one sentence:

> *"An empty set cannot be constructed with `{}`; this literal constructs an
> empty dictionary."*

```python
type({})            # <class 'dict'>
type(set())         # <class 'set'>
type({1, 2})        # <class 'set'>
```

This has a specific failure mode that is not the one people expect. Nobody
writes `{}` meaning an empty set on purpose; they get there by *filtering a set
comprehension down to nothing* — and that still gives a `set`, because the
comprehension form is chosen at compile time by the presence of the colon, not
at runtime by the number of elements. The bug appears in **defaults**:

```python
def tag(items, extra={}):          # intended an empty set, got an empty dict
    return set(items) | extra      # TypeError: unsupported operand type(s)
```

And in code that accumulates:

```python
seen = {}                          # meant a set
seen.add(x)                        # AttributeError: 'dict' object has no attribute 'add'
```

The `AttributeError` names `dict` and is easy to read; the union `TypeError`
is not. Write `set()` and the ambiguity never arises. (The mutable-default
problem in that first example is a separate and worse bug —
see [Mutable default argument](../07-assignment-and-aliasing/06-mutable-default-argument.md).)

## A generator expression is not a tuple comprehension

`(x for x in xs)` does not produce a tuple. There is no tuple comprehension in
Python; parentheses around a comprehension mean *generator*, which is why
`tuple(x for x in xs)` is how you build one. The reference:

> *"The syntax for generator expressions is the same as for list comprehensions,
> except that they are enclosed in parentheses instead of brackets."*

```python
squares = (n * n for n in nums)    # <generator object <genexpr> at ...>
tuple(n * n for n in nums)         # (1, 4, 9, 16, 16)
```

The `repr` shown by the interactive prompt is documented in the reference as
`<generator object <genexpr> at ...>` — a genexp's code object is named
`<genexpr>`, exactly as a generator function's would be named after the
function.

## The parenthesis rule: sole argument, no keywords

This is the rule people half-remember. The reference:

> *"The enclosing parentheses can be omitted in calls when the generator
> expression is the only positional argument and there are no keyword
> arguments."*

The documentation gives both sides:

```python
# The parentheses after `sum` are part of the call syntax:
sum(x ** 2 for x in range(10))

# The generator needs its own parentheses if it's not the only argument:
sum((x ** 2 for x in range(10)), start=1000)
```

Both of those lines are quoted from the reference, including the comments. Note
what triggers the requirement: `start=1000` is a **keyword** argument, and the
mere presence of a keyword argument is enough — you do not need a second
positional argument for the bare form to become a `SyntaxError`.

```python
max(len(s) for s in names)                    # fine — sole argument
max((len(s) for s in names), default=0)       # parens required
min(x for x in xs)                            # fine
zip(x for x in xs, y for y in ys)             # SyntaxError — two arguments
zip((x for x in xs), (y for y in ys))         # correct
"".join(str(n) for n in nums)                 # fine — sole argument to join
```

PEP 289, which introduced generator expressions, states the rule the same way:
*"If a function call has a single positional argument, it can be a generator
expression without extra parentheses, but in all other cases you have to
parenthesize it."*

The practical consequence: the moment you add `key=`, `default=`, `start=` or
`sep=` to a call whose argument is a bare genexp, the line stops compiling, and
the error points at the comma rather than at the keyword you just added.

## The tuple-element trap

A comprehension whose element expression is a tuple needs its own parentheses.
The Functional HOWTO spells it out:

> *"To avoid introducing an ambiguity into Python's grammar, if `expression` is
> creating a tuple, it must be surrounded with parentheses."*

```python
[x, y for x in seq1 for y in seq2]      # SyntaxError
[(x, y) for x in seq1 for y in seq2]    # correct
```

Both lines are from the HOWTO. The same applies to a dict comprehension whose
*key* is a tuple — `{(a, b): v for ...}` — though there the braces plus colon
usually make it obvious.

## `yield` is banned inside a comprehension

Since 3.8:

> *"To ensure the comprehension always results in a container of the appropriate
> type, `yield` and `yield from` expressions are prohibited in the implicitly
> nested scope."*

Before 3.8 a `yield` inside a list comprehension in a generator function did
something surprising — the comprehension became part of the enclosing
generator. That is now a `SyntaxError`, and the message says so. If you want the
values yielded, the comprehension you want is a generator expression, or a
`yield from` of one:

```python
def chunks(rows):
    yield from (transform(r) for r in rows)   # correct
    # yield from [transform(r) for r in rows] # also correct, but builds a list first
```

## Gotchas

**★ Symptom — `AttributeError: 'dict' object has no attribute 'add'` on a
variable you were sure was a set.** Cause: it was initialised with `{}`, which
the reference defines as an empty *dictionary* literal; there is no empty-set
literal in the language. Fix: `seen = set()`. If you want the emptiness to be
type-checked, annotate it: `seen: set[str] = set()`.

**★ Symptom — `SyntaxError: Generator expression must be parenthesized` after
you added a keyword argument to a call that previously worked.** Cause: the bare
form is only legal when the genexp is the sole positional argument and there are
*no* keyword arguments; `default=`, `start=`, `key=` all disqualify it. Fix:
wrap the genexp in its own parentheses — `max((len(s) for s in names),
default=0)`.

**★ Symptom — a "tuple comprehension" returns a generator object where you
expected a tuple, and `len()` on it raises `TypeError`.** Cause: parentheses
around a comprehension mean generator expression; Python has no tuple
comprehension. Fix: `tuple(x for x in xs)`. If you actually wanted the length,
you wanted a list or tuple in the first place — a generator has no length by
design.

**Symptom — `SyntaxError` on `[x, y for x in a for y in b]` pointing at the
`for`.** Cause: an unparenthesised tuple as the element expression is
grammatically ambiguous with a multi-element list display. Fix: parenthesise the
tuple — `[(x, y) for x in a for y in b]`.

**Symptom — a set comprehension quietly returns fewer elements than the input.**
Cause: that is what a set is; duplicate results collapse. It is a bug only when
you meant to count things. Fix: use a list comprehension, or
`collections.Counter`, when multiplicity matters.

**Symptom — `SyntaxError: 'yield' inside list comprehension`.** Cause: since 3.8
`yield` and `yield from` are prohibited in a comprehension's implicitly nested
scope, so the comprehension always produces its declared container type. Fix:
use a generator expression and `yield from` it, or write the loop out.

**Symptom — a dict comprehension you wrote as `{k for k in ...}` produced a set
and the next line raised `TypeError: 'set' object is not subscriptable`.**
Cause: braces without a colon are a *set* display. Fix: add the value expression
— `{k: lookup(k) for k in ...}` — or use `dict.fromkeys(...)` if every value is
the same.

## Interview questions

**★ Q: What is the difference between `[x for x in xs]` and `(x for x in xs)`?**
The brackets build a `list` immediately, running the whole loop and allocating
one object per element. The parentheses build a *generator iterator* and run
nothing — no element is computed until something iterates it, and each element is
discarded after it is yielded. The list can be indexed, measured with `len()`,
and iterated any number of times; the generator can be iterated exactly once and
supports none of those operations. Use the list when you need the data more than
once or need random access; use the genexp when you are feeding it straight into
`sum`, `any`, `max`, `join` or a `for` loop.

**★ Q: How do you make an empty set?**
`set()`. `{}` is an empty dict — the reference says an empty set *"cannot be
constructed with `{}`"*. There is no empty-set literal because the brace syntax
was taken by dicts first.

**★ Q: When do you need extra parentheses around a generator expression passed
to a function?**
Whenever it is not the only argument. The reference's rule is that the enclosing
parentheses may be omitted *"when the generator expression is the only positional
argument and there are no keyword arguments"*. So `sum(x*x for x in xs)` is fine
and `sum((x*x for x in xs), start=10)` is not optional — the second one needs
them.

**Q: Is there a tuple comprehension?**
No. Parentheses are already spoken for by generator expressions. `tuple(x for x
in xs)` is the way, and it is one call, not a conversion of an intermediate
list — the `tuple` constructor consumes the generator directly.

**Q: Which is faster, `tuple(x for x in xs)` or `tuple([x for x in xs])`?**
The second builds a list and then copies it into a tuple, so it does strictly
more allocation. The first avoids the intermediate list but pays generator
resumption per element. Which wins depends on the size and on the CPython
version, and it is not worth guessing — `timeit` both on your data. What is
certain is that the second one's peak memory is higher.

**Q: Why does `{x: y for ...}` produce a dict but `{x for ...}` produce a set,
when both use braces?**
The colon in the element expression is the discriminator, and it is resolved at
*compile* time by the grammar, not at runtime. `dict_comprehension` is a
separate production requiring `expression ":" expression`; anything else inside
braces with a `for` clause is a set comprehension.

**Q: What happens if you put `yield` inside a list comprehension?**
`SyntaxError`, since Python 3.8. The reference explains the reason: `yield` is
prohibited *"to ensure the comprehension always results in a container of the
appropriate type"*. Before 3.8 it silently turned the enclosing function's
semantics inside out.

---

← Prev: [Control flow](../08-control-flow/README.md) · Index: [Comprehensions](README.md) · Next → [The grammar and clause order](02-the-grammar-and-clause-order.md)
