---
name: research-python-p02-t04-lambda
description: Banked Research: Python Phase 2 · Topic 04 — lambda
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 04 — lambda

> Verified: 2026-09-03 against Python 3.14 Language Reference (§6.14 Lambdas),
> Python Standard Library (operator module), and PEP 8 (Programming Recommendations).
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Language Reference §6.14 — Lambdas
URL: https://docs.python.org/3.14/reference/expressions.html#lambda
- *"Lambda expressions (sometimes called lambda forms) are used to create anonymous functions. The expression `lambda parameters: expression` yields a function object."*
- *"The unnamed object behaves like a function object defined with: `def <lambda>(parameters): return expression`."*
- *"Note that functions created with lambda expressions cannot contain statements or annotations."*
- *"A lambda form cannot contain statements, and can only consist of an expression."*

### PEP 8 — Programming Recommendations: Lambda Assignment
URL: https://peps.python.org/pep-0008/#programming-recommendations
- *"Always use a `def` statement instead of an assignment statement that binds a lambda expression directly to an identifier."*
- *"`# Correct:`"*
  `def f(x): return 2*x`
- *"`# Wrong:`"*
  `f = lambda x: 2*x`
- *"The first form means that the name of the resulting function object is specifically 'f' instead of the generic `<lambda>`. This is more useful for tracebacks and string representations in general. The use of the assignment statement eliminates the sole benefit that a lambda expression can offer over an explicit `def` statement (i.e. that it can be embedded inside a larger expression)."*

### Python 3.14 Library Reference — operator module
URL: https://docs.python.org/3.14/library/operator.html
- `operator.itemgetter(*items)`: returns a callable object that fetches item(s) from its operand using `__getitem__()`. C-accelerated in CPython.
- `operator.attrgetter(attr, ...)`: returns a callable that fetches attribute(s) from its operand using `getattr()`.
- `operator.methodcaller(name, /, *args, **kwargs)`: returns a callable that calls method `name` on its operand.

---

## 2. Key Insights & Architecture

1. **Syntax vs Capabilities**:
   A lambda is purely syntactic sugar for a function returning an expression. It produces an ordinary `types.FunctionType` instance. It creates its own local scope and supports closures.
2. **Missing Features compared to `def`**:
   - No statements (cannot use `try/except`, `while`, `for`, `assert`, `with`, `del`).
   - No type annotations on parameters or return value (inline syntax does not exist).
   - No docstrings (`__doc__` is `None`).
   - `__name__` is always `"<lambda>"`.
3. **Idiomatic Usage**:
   - Short throwaway key functions: `sorted(items, key=lambda x: x.priority)`.
   - Small single-use transformation closures.
   - When extracting items/attributes, `operator.itemgetter`/`operator.attrgetter` are faster and more descriptive.
4. **Anti-patterns**:
   - Named lambdas (`foo = lambda x: ...` violates PEP 8 E731).
   - Complex nested ternary expressions inside lambdas.
   - Multi-line lambdas (using backslashes or parentheses) that should be refactored to standard `def`.
