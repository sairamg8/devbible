---
title: "SQLAlchemy makes == build SQL and mock.ANY makes == always true, so a shared utility can only trust is for its sentinels"
sidebar_label: "10b · ORMs, mocks, defensive code"
sidebar_position: 82
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons),
> [`unittest.mock.ANY`](https://docs.python.org/3.14/library/unittest.mock.html#any),
> and the
> [SQLAlchemy 2.0 operator reference](https://docs.sqlalchemy.org/en/20/core/operators.html).
> Version spine: **CPython 3.14**; SQLAlchemy 2.0.

**An array type at least has the decency to raise. An ORM expression object and a
`mock.ANY` are worse: they are *truthy*, so `if User.deleted_at == None:` takes the
branch every time and `if x == None:` takes it for anything a fixture leaked. This is
the chunk about the comparisons that lie quietly rather than failing loudly, and about
what a library author can actually rely on when the caller's types are unknown.**

## SQLAlchemy: `==` builds SQL

An ORM's instrumented attributes overload the comparison operators to produce SQL
expression objects rather than booleans:

```python
stmt = select(User).where(User.name == "ada")     # `==` produced a SQL construct
```

The SQLAlchemy operator reference documents the `None` case specifically: the
`ColumnOperators.is_()` operator is automatically invoked when the overloaded `==` is
used in conjunction with `None`, producing `x IS NULL` rather than the never-true
`x = NULL`. That is a deliberate convenience, and it means `column == None` is *correct
SQL* and *always truthy Python*:

```python
if User.deleted_at == None:      # 🔴 always takes the branch — this is an object
    ...
```

The expression object is truthy, so the `if` fires regardless. Rules that hold:

- **Never put a model-attribute comparison in an `if`.** It belongs in a `where`, a
  `filter`, an `order_by`.
- **`col.is_(None)` / `col.is_not(None)`** when you want the SQL to say so explicitly;
  linters flag `== None` as an E711 style error, which fights the ORM idiom, so most
  projects standardise on `is_()`.
- **Comparing an *instance* attribute is a normal Python comparison.**
  `user.name == "ada"` on a loaded instance is a plain `bool`; `User.name == "ada"` on
  the class is a SQL construct. One character apart.

Django's ORM makes the same move differently: `F` expressions and `Q` objects build
query trees, and `Q(a=1) & Q(b=2)` uses the bitwise operators for exactly the reason
NumPy does — `and` would call `bool()`.

## Mocks and test helpers: `==` that is always `True`

> *"A helper object that compares equal to everything."*
>
> *"To ignore certain arguments you can pass in objects that compare equal to
> everything. Calls to `assert_called_with()` and `assert_called_once_with()` will then
> succeed no matter what was passed in."* —
> [`unittest.mock.ANY`](https://docs.python.org/3.14/library/unittest.mock.html#any)

```python
mock.assert_called_once_with("foo", bar=ANY)
m.mock_calls == [call(1), call(1, 2), ANY]
self.assertEqual(s.split(), ['hello', ANY])
```

`ANY` is genuinely useful and genuinely dangerous: it is reflexively equal to
everything, including `None`. A production `if x == None:` compared against an `ANY`
that leaked out of a fixture takes the branch. This is one of the concrete reasons
`is None` is the rule ([04](04-is-versus-equals.md)).

Related shapes worth recognising:

- **A `Mock` with no spec** returns a new `Mock` for any attribute access, but its
  `==` is identity-based by default — so `mock == mock` is `True` and `mock ==
  anything_else` is `False`. Configuring `__eq__` on a `MagicMock` changes that and is
  a common source of tests that pass for the wrong reason.
- **`pytest.approx`** overloads `__eq__` so that `value == approx(expected)` is a
  tolerance comparison. It is intentionally not symmetric in spirit even though it
  works both ways, and it returns a `bool` — but it means `==` in a test file does not
  necessarily mean exact equality.
- **`hamcrest`/`assertpy`-style matcher objects** are the same pattern generalised.

## How to write code that survives all of this

If you write a library or a shared utility, you cannot know what types your callers
will pass. Four defensive habits:

```python
# 1. `is` for sentinels and singletons — cannot be intercepted.
if value is None: ...
if value is _UNSET: ...

# 2. Never rely on `==` producing a bool; if you must, force it.
if bool(a == b): ...          # explicit, and raises loudly on an array

# 3. Use `operator.eq` when comparison is data, and check the result type
#    at the boundary rather than deep inside.
result = operator.eq(a, b)
if not isinstance(result, bool):
    raise TypeError(f"comparison returned {type(result).__name__}")

# 4. For numeric containers, dispatch explicitly rather than duck-typing.
if isinstance(x, np.ndarray):
    ...
```

And one habit that matters more than the other four: **`if x:` on an unknown type is a
`bool()` call**. Every array type, every ORM construct and every lazy object gets a say
in what that means. `if x is None:`, `if len(x) == 0:` and `if x.empty:` all say
something specific; `if x:` says "whatever this library decided".

## The SQL `NULL` contrast, once more

[05c](05c-none-never-orders.md) covers three-valued logic in full. The one line to keep
here: SQL's comparison operators return `TRUE`, `FALSE` or `UNKNOWN`, and `WHERE` keeps
only `TRUE`. Python has no `UNKNOWN` — a comparison returns a value or raises. So an
ORM expression is not just "a lazy boolean": it is a fragment of a *different logic*,
and its Python truthiness is meaningless by construction. `pandas`' `pd.NA` deliberately
imports the SQL model: `pd.NA == pd.NA` is `pd.NA`, and `bool(pd.NA)` raises.

## Gotchas

**★ `if User.deleted_at == None:` always taking the branch.** On the *class*, `==`
builds a SQL expression object, which is truthy. Fix: model-attribute comparisons go in
`where`/`filter`, never in an `if`; use `col.is_(None)` to make the SQL explicit.

**★ `User.name == "ada"` and `user.name == "ada"` behaving differently.** The first is
a class attribute and produces SQL; the second is an instance attribute and produces a
`bool`. Fix: read the case of the receiver, and prefer explicit `select(...).where(...)`
so the two never appear in the same expression style.

**★ A linter demanding `is None` inside a SQLAlchemy filter.** E711 flags `== None`,
but `col == None` is the ORM's documented way to get `IS NULL`. Fix: use
`col.is_(None)`, which satisfies both the linter and the ORM, rather than adding a
blanket `noqa`.

**★ `Q(a=1) and Q(b=2)` in Django silently returning one of the two.** `and` returns an
operand, not a combined query — and both `Q` objects are truthy, so you get the second
one and lose the first condition entirely. No error. Fix: `Q(a=1) & Q(b=2)`.

**★ A test passing because `ANY` compared equal to a wrong value.** `ANY` is documented
to compare equal to everything, which is the point and also the risk. Fix: use `ANY`
only for arguments you genuinely do not care about, and assert the interesting ones
precisely.

**★ `if x == None:` taking the branch for a mock or an `ANY`.** Any object can define
`__eq__` to equal `None`. Fix: `is None`, always.

**★ A `MagicMock` with `__eq__` configured making an unrelated assertion pass.**
Configuring `__eq__` on a mock changes the answer for every comparison it participates
in, including ones in code under test. Fix: prefer `spec=`/`autospec=` mocks and
`ANY` over hand-configured `__eq__`.

**★ `assert value == pytest.approx(expected)` used on a value that is not a number.**
`approx` is a tolerance comparison; against a non-numeric it falls back to ordinary
equality or raises, depending on the type. Fix: know that `==` in a test file does not
necessarily mean exact equality, and read what the right-hand side actually is.

**★ Writing `__eq__` on your own type that returns a non-bool "for convenience".** You
are now one of these libraries, and every `if`, `in`, `assert`, dict lookup and
`unittest.assertEqual` involving your type acquires a hidden `bool()` call. Fix: do it
only if you are genuinely building an expression DSL, and document it loudly.

**★ A utility function that works for every caller until one passes a Series.** The
function did `if value:` or `if a == b:` on a type it does not control. Fix: `is` for
sentinels, explicit `bool()` where a boolean is required, and type dispatch where array
support is intended.

## Interview questions

**★ Q: What does `User.name == "ada"` return in SQLAlchemy?**
A SQL expression object, not a boolean — the comparison operators on instrumented class
attributes are overloaded to build query constructs. It is truthy, so putting it in an
`if` always takes the branch. `user.name == "ada"` on a loaded *instance* is an
ordinary Python comparison returning a `bool`.

**★ Q: What is `unittest.mock.ANY` and what is the risk?**
An object documented as comparing equal to everything, used to ignore arguments you do
not care about in `assert_called_with`. The risk is that "everything" includes `None`
and includes wrong values, so an over-used `ANY` makes an assertion that cannot fail —
and an `ANY` that escapes a fixture makes a production `== None` check take the branch.

**★ Q: Why does `col == None` produce `IS NULL` in SQLAlchemy when `x = NULL` is never
true in SQL?**
Because SQLAlchemy special-cases it: the operator reference says `ColumnOperators.is_()`
is automatically invoked when `__eq__` is used with `None`. It is a deliberate
convenience so that Python's `== None` idiom produces correct SQL — at the cost of the
expression being an object rather than a boolean, and of fighting the `is None` lint
rule.

**★ Q: How would you make a shared utility function safe against all of these types?**
Use `is` for every sentinel and singleton test, never test the truthiness of a value
whose type you do not control, and if you must branch on `==`, wrap it in an explicit
`bool()` so the failure happens at your line rather than three frames later. Where the
function genuinely supports arrays, dispatch on type rather than duck-typing the
comparison.

**Q: Why do Django and NumPy both use `&` and `|` rather than `and` and `or`?**
Because `and`/`or` are control flow: they call `bool()` on the left operand and return
one of the operands rather than a combined result. Neither can be overloaded. `&` and
`|` dispatch to `__and__`/`__or__`, which a library *can* overload — so they are the
only way to express "combine these two expression objects".

**Q: What is the connection between this chunk and SQL's three-valued logic?**
Both are about a comparison that does not produce a Python boolean. SQL's operators
return `TRUE`/`FALSE`/`UNKNOWN` and `WHERE` keeps only `TRUE`; an ORM expression object
is a fragment of that logic, not a lazy boolean, which is why its Python truthiness is
meaningless. pandas' `pd.NA` imports the model directly — `pd.NA == pd.NA` is `pd.NA`
and `bool(pd.NA)` raises.

**Q: When is it legitimate to make `__eq__` return a non-boolean?**
When you are deliberately building an expression language whose comparisons are *data*
— a query builder, an array library, a symbolic maths system. Then the non-boolean
result is the product, and the cost is that your objects can never be used in a plain
`if`, `in`, `assert` or `sorted()` without care. Anything short of that, return a
`bool`.

---

← Prev: [`==` is not a boolean](10-when-equality-is-not-a-boolean.md) · Index: [Comparisons](README.md) · Next → [Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)
