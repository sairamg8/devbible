---
title: "Parentheses group, commas build: every tuple in Python is made by a comma, and the empty tuple is the single exception that proves it"
sidebar_label: "5 · The comma makes the tuple"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference —
> [Parenthesized forms](https://docs.python.org/3.14/reference/expressions.html#parenthesized-forms),
> [Expression lists](https://docs.python.org/3.14/reference/expressions.html#expression-lists),
> [Comma-separated subscripts](https://docs.python.org/3.14/reference/expressions.html#comma-separated-subscripts)
> and the [standard type hierarchy on tuples](https://docs.python.org/3.14/reference/datamodel.html#tuples);
> [`tuple`](https://docs.python.org/3.14/library/stdtypes.html#tuple);
> the [tutorial on tuples](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences);
> and the [`return`](https://docs.python.org/3.14/reference/simple_stmts.html#the-return-statement)
> and [`yield`](https://docs.python.org/3.14/reference/simple_stmts.html#the-yield-statement)
> statements. Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**Almost every Python programmer believes tuples are made with parentheses, and almost
every Python programmer has been bitten by that belief. The documentation says the
opposite in as many words: the comma builds the tuple and the parentheses are grouping,
optional except where the expression would otherwise be ambiguous — and in the one case
where nothing is left to put a comma between. Once you read `(1, 2)` as "a grouped
expression list" rather than "a tuple literal", the trailing-comma bugs in
[5b](05b-trailing-comma-bugs.md) stop being mysteries and become arithmetic.**

## The rule, stated three times by three documents

> *"Note that it is actually the comma which makes a tuple, not the parentheses. The
> parentheses are optional, except in the empty tuple case, or when they are needed to
> avoid syntactic ambiguity. For example, ``f(a, b, c)`` is a function call with three
> arguments, while ``f((a, b, c))`` is a function call with a 3-tuple as the sole
> argument."* — [`tuple`](https://docs.python.org/3.14/library/stdtypes.html#tuple)

> *"Note that tuples are not formed by the parentheses, but rather by use of the comma.
> The exception is the empty tuple, for which parentheses *are* required --- allowing
> unparenthesized "nothing" in expressions would cause ambiguities and allow common typos
> to pass uncaught."* —
> [Parenthesized forms](https://docs.python.org/3.14/reference/expressions.html#parenthesized-forms)

> *"A tuple of one item (a 'singleton') can be formed by affixing a comma to an expression
> (an expression by itself does not create a tuple, since parentheses must be usable for
> grouping of expressions).  An empty tuple can be formed by an empty pair of
> parentheses."* —
> [the standard type hierarchy](https://docs.python.org/3.14/reference/datamodel.html#tuples)

The parenthetical in that last quote is the *reason*: `(x)` has to stay available as
"x, grouped", because arithmetic needs it. Python cannot have both `(x)` meaning a 1-tuple
and `(a + b) * c` meaning what everyone expects.

## The four constructions, from the docs

> *"Tuples may be constructed in a number of ways:
>  * Using a pair of parentheses to denote the empty tuple: ``()``
>  * Using a trailing comma for a singleton tuple: ``a,`` or ``(a,)``
>  * Separating items with commas: ``a, b, c`` or ``(a, b, c)``
>  * Using the `tuple` built-in: ``tuple()`` or ``tuple(iterable)``"*

```python
empty     = ()               # parentheses REQUIRED — nothing to comma
singleton = ("prod",)        # the comma is the tuple; parentheses are decoration
pair      = "prod", "eu"     # no parentheses at all — still a tuple
built     = tuple("abc")     # ('a', 'b', 'c') — iterates the argument
```

⚠️ **`tuple("abc")` gives `('a', 'b', 'c')`, not `("abc",)`.** The constructor iterates;
it does not wrap. If you want a 1-tuple, use the comma — `("abc",)`.

The tutorial's verdict on the singleton syntax is worth quoting because it is the reason
the mistake is forgivable:

> *"A special problem is the construction of tuples containing 0 or 1 items: the syntax has
> some extra quirks to accommodate these.  Empty tuples are constructed by an empty pair of
> parentheses; a tuple with one item is constructed by following a value with a comma (it is
> not sufficient to enclose a single value in parentheses). **Ugly, but effective.**"* —
> [the tutorial](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences)

## Where the parentheses are genuinely required

The general rule from the expression-list grammar:

> *"**Except when part of a list or set display, an expression list containing at least one
> comma yields a tuple.**  The length of the tuple is the number of expressions in the list.
> The expressions are evaluated from left to right."* —
> [Expression lists](https://docs.python.org/3.14/reference/expressions.html#expression-lists)

So the parentheses are load-bearing in exactly the places where a bare comma already means
something else:

**1 · As a single argument to a call.** `f(a, b, c)` is three arguments; `f((a, b, c))` is
one tuple.

```python
print(1, 2, 3)        # three arguments -> "1 2 3"
print((1, 2, 3))      # one argument    -> "(1, 2, 3)"
```

**2 · Inside a list, set or dict display.** The comma there separates *elements*, so a
tuple element must be parenthesised:

```python
pairs   = [("a", 1), ("b", 2)]     # a list of two tuples
flat    = ["a", 1, "b", 2]         # a list of four items
tup_set = {("a", 1), ("b", 2)}     # a set of two tuples
```

The same rule makes `[x, y for x in items]` a `SyntaxError` — inside a display, `x, y` is
two elements, and a comprehension has no room for two. Write `[(x, y) for x in items]`.

**3 · After a `lambda`.** A lambda's body is a single `expression`, which binds tighter
than the expression list around it:

```python
handlers = lambda x: x, 1      # this is a 2-TUPLE: (lambda x: x, 1)
handlers = lambda x: (x, 1)    # this is a lambda returning a 2-tuple
```

**4 · Around a conditional expression or anything with lower precedence than the comma.**
Nothing binds looser than the comma in an expression list, so anything ambiguous needs
grouping:

```python
status = ("active" if ok else "failed"), timestamp     # a 2-tuple
status = "active" if ok else ("failed", timestamp)     # a str OR a 2-tuple
```

**5 · As a generator expression next to other arguments.** A bare genexp is allowed only
as the *sole* argument:

```python
total = sum(x * 2 for x in items)          # legal: sole argument
total = sum((x * 2 for x in items), 0)     # parentheses required once there are two
```

## Where the parentheses are pure noise

**In a `return`.** The return value is an expression list, so the comma already does the
work:

```python
def parse_range(text):
    start, _, end = text.partition("-")
    return int(start), int(end)      # returns a 2-tuple; no parentheses needed
```

**In a `yield`.** Same rule:

```python
def enumerate_pages(pages):
    for index, page in enumerate(pages, start=1):
        yield index, page            # yields 2-tuples
```

**In an assignment, on either side.**

```python
host, port = "localhost", 5432       # pack on the right, unpack on the left
```

**In a `for` header.**

```python
for method, path in ("GET", "/health"), ("POST", "/orders"):
    register(method, path)
```

**In a subscript.** `d[a, b]` builds the tuple for you — see
[4 · Tuples as keys](04-tuples-as-keys.md):

> *"the interpreter constructs a `tuple` of the results of the expressions or slices, and
> passes this tuple to the `__getitem__` … special method"* —
> [Comma-separated subscripts](https://docs.python.org/3.14/reference/expressions.html#comma-separated-subscripts)

**House rule worth adopting anyway:** write the parentheses when the tuple is a *value*
you are constructing, and omit them when the comma is doing structural work (`return`,
unpacking, a `for` target). Readers scan for the parentheses; the language does not need
them, but the reviewer does.

## Gotchas

**★ Symptom: `tuple("acme")` produced `('a', 'c', 'm', 'e')` instead of a 1-tuple.**
Cause: the constructor iterates its argument — *"the constructor builds a tuple whose items
are the same and in the same order as *iterable*'s items"* — and a string is an iterable of
characters. Fix: use the comma.

```python
key = ("acme",)          # 1-tuple
key = tuple(["acme"])    # also works, and reads worse
```

**★ Symptom: `[x, y for x in rows]` is a `SyntaxError` with no useful message.** Cause:
inside a list display the comma separates elements, so the parser sees two elements and
then a `for`. Fix: parenthesise the tuple.

```python
pairs = [(x, y) for x, y in rows]
```

**★ Symptom: a `lambda` assigned to a name turned out to be a tuple.** Cause: the lambda
body is one expression, and the comma after it built an expression list. Fix: parenthesise
the body, or use `def`.

```python
transform = lambda x: (x, x * 2)     # a lambda returning a tuple
def transform(x):                    # clearer still
    return x, x * 2
```

**Symptom: `print((a, b))` printed the parentheses and `print(a, b)` did not.** Cause: the
first passes one tuple, the second passes two arguments. Fix: whichever you meant — the
distinction is exactly the FAQ's `f(a, b, c)` versus `f((a, b, c))`.

**Symptom: `()` in a place expecting "nothing" was rejected as an empty tuple.** Cause:
`()` is a value, and the only tuple form where parentheses are mandatory. Fix: if you meant
"no value", write `None`; `()` is a real, empty, falsy sequence and is not the same thing.

```python
default_scopes = ()        # an empty sequence — iterable, len 0, falsy
missing_scopes = None      # "not supplied" — not iterable
```

**Symptom: `sum(x for x in items, 0)` is a `SyntaxError`.** Cause: an unparenthesised
generator expression is legal only as the sole argument to a call. Fix: parenthesise it.

```python
total = sum((x for x in items), 0)
```

**Symptom: a conditional expression swallowed the rest of the tuple.** Cause: `if/else`
binds tighter than the comma only in the direction you did not expect — `a if c else b, d`
is `(a if c else b), d`, and `a, b if c else d` is `a, (b if c else d)`. Fix: parenthesise
whichever half you meant, always.

```python
row = (name if name else "anonymous"), created_at
```

## Interview questions

**★ What makes a tuple — the parentheses or the comma?**
The comma. The library reference says it directly: *"it is actually the comma which makes a
tuple, not the parentheses. The parentheses are optional, except in the empty tuple case,
or when they are needed to avoid syntactic ambiguity."* The parentheses are the ordinary
grouping operator, which is why `(x)` is just `x` and `(x,)` is a 1-tuple. The empty tuple
is the exception because there is nothing to put a comma between, and the reference
explains that choice too — allowing unparenthesised nothing *"would cause ambiguities and
allow common typos to pass uncaught."*

**★ What is `("abc")` and what is `("abc",)`?**
The first is the string `"abc"` with redundant parentheses — no tuple is created, because
no comma appears. The second is a 1-tuple containing that string. This is the single most
common tuple bug in Python, and it is silent: both are valid expressions, both are truthy,
both support `in` and `len`, and the difference only shows up when something iterates the
value and gets three characters instead of one string.

**★ Why is `f(x, y)` different from `f((x, y))`?**
Because inside a call, the comma separates arguments — it is not an expression list. The
first form passes two arguments; the second passes one, a 2-tuple. The library reference
uses exactly this pair as its example. The same rule appears in list, set and dict
displays, where a comma separates elements, which is why a tuple element inside a list has
to be parenthesised.

**Where must you write parentheses around a tuple?**
Five places. The empty tuple `()`, because there is no comma. As a single argument to a
call, or as an element inside a list/set/dict display, because the comma already means
"separator" there. After a `lambda`, because the body is one expression and the comma binds
looser. Around a conditional expression, for the same precedence reason. And around a
generator expression once the call has more than one argument.

**Where are the parentheses pure noise?**
`return a, b`; `yield a, b`; both sides of an assignment; a `for` header; and a subscript,
where the reference specifies that a comma-separated subscript is collected into a tuple
before `__getitem__` sees it. The style question is separate from the syntax question — a
lot of codebases write them anyway, because the reader scans for a shape and the parser
does not.

**Is `()` the same as `None`?**
No. `()` is an empty tuple: a real object, a sequence, iterable, `len` 0, and falsy. `None`
is the absence of a value: not iterable, not a sequence, and `len(None)` raises. They are
both falsy, which is exactly why confusing them survives a `if not x:` test and fails at
the first `for item in x:`.

**Why does `tuple(x)` iterate instead of wrapping?**
Because it is a *conversion*, not a constructor of a 1-tuple — it has the same shape as
`list(x)` and `set(x)`, all of which consume an iterable. There is no built-in "wrap in a
1-tuple" function because the comma already is one; `(x,)` is shorter than any function
call would be.

---

← [The cost of a flat key](04b-the-cost-of-a-flat-key.md) · [Topic index](README.md) · Next → [Trailing-comma bugs](05b-trailing-comma-bugs.md)
