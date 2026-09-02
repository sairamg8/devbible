---
title: "The compiler warns about is with a literal but not about is with a constant, and an id() you kept outlives the object that owned it"
sidebar_label: "4c · The warning and lifetimes"
sidebar_position: 69
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against CPython
> [`Python/codegen.c`](https://github.com/python/cpython/blob/3.14/Python/codegen.c)
> (warning text and `check_is_arg`),
> [`Doc/whatsnew/3.8.rst`](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.8.rst)
> porting notes,
> [`id()`](https://docs.python.org/3.14/library/functions.html#id),
> the [glossary entry for *immortal*](https://docs.python.org/3.14/glossary.html#term-immortal)
> and [PEP 683](https://peps.python.org/pep-0683/).
> Version spine: **CPython 3.14**.

**Python 3.8 gave the `is`-with-a-literal mistake a compile-time warning, and the
warning is narrower than most people assume: it inspects *constants only*, it exempts
exactly the four singletons `is` is for, and it is completely blind to `x is
STATUS_ACTIVE` where the name holds a string. The other half of this chunk is the
lifetime story — why an `id()` you stored is not a handle to anything, and why
"immortal" in 3.12+ is a refcount optimisation rather than a promise about
identity.**

## The `SyntaxWarning`, and exactly when it fires

Python 3.8 added a compile-time warning:

> *"The compiler now produces a `SyntaxWarning` when identity checks (`is` and `is
> not`) are used with certain types of literals (e.g. strings, numbers). These can
> often work by accident in CPython, but are not guaranteed by the language spec. The
> warning advises users to use equality tests (`==` and `!=`) instead."* —
> [What's New In Python 3.8](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.8.rst),
> porting notes

In CPython 3.14 the message templates are, verbatim from `Python/codegen.c`:

```
"is" with '%.200s' literal. Did you mean "=="?
"is not" with '%.200s' literal. Did you mean "!="?
```

where `%.200s` is filled in with the *inferred type name* of the offending literal —
so you see `SyntaxWarning: "is" with 'str' literal. Did you mean "=="?` or
`... with 'int' literal ...`.

The exemption list is worth knowing, because it is the precise set of things `is` is
*for*. The compiler's `check_is_arg` treats an operand as acceptable unless it is a
constant, and the constants it still accepts are:

```c
return (value == Py_None
     || value == Py_False
     || value == Py_True
     || value == Py_Ellipsis);
```

So `x is None`, `x is True`, `x is False` and `x is ...` never warn. A tuple operand
warns only if every element is a constant (`is_const_tuple`), so `x is ()` warns and
`x is (a, b)` does not.

Three things the warning does **not** catch, and they are the ones that reach
production:

- `x is y` where `y` is a *variable* that happens to hold `"active"`. No literal, no
  warning.
- `x is CONSTANT` where `CONSTANT = "active"` at module level. Same reason.
- Any `is` on a value that came from outside the process.

The warning is a compile-time syntactic check, not a semantic one. Treat it as a
floor, and configure your linter (`ruff`'s `F632`, `pylint`'s
`literal-comparison`) to catch the same class of error.

## Immortality is not identity

Since Python 3.12, `None`, `True`, `False`, `Ellipsis`, `NotImplemented`, static
types and the small-int cache entries are *immortal* (PEP 683): the runtime stops
touching their reference counts so they are never deallocated. The glossary:

> *"Immortal objects are a CPython implementation detail introduced in PEP 683. If an
> object is immortal, its reference count is never modified, and therefore it is never
> deallocated while the interpreter is running. For example, `True` and `None` are
> immortal in CPython."* —
> [glossary](https://docs.python.org/3.14/glossary.html#term-immortal)

This is a refcount optimisation, not a promise about `is`. It does mean the objects
`is None` compares against will never be freed and never have their address reused,
which is a small extra reason the `None` case is safe — but it changes nothing about
`is` on a string or a large int.

## `id()` reuse, and why "have I seen this object" caches break

The `id()` docs: *"Two objects with non-overlapping lifetimes may have the same `id()`
value."* In CPython, `id()` is the memory address, and the allocator reuses freed
blocks aggressively. So:

```python
seen = set()
for row in rows:
    obj = build(row)
    if id(obj) in seen:      # 🔴 broken
        continue
    seen.add(id(obj))
    # obj becomes garbage at the end of the iteration; its address is reused
```

The next `build()` can land at the same address, and the loop skips a genuinely new
object. The fix is to hold a reference for as long as the `id()` is in the set, which is
exactly what a `set` of the objects themselves does. Two caveats if you go that way:
`set` membership uses `__hash__`/`__eq__`, not identity, so value-equal-but-distinct
objects collapse into one entry; and holding the objects keeps them alive.
`weakref.WeakSet` avoids the second problem but still uses `__eq__`/`__hash__` for
membership. If you truly need identity semantics *and* must not extend lifetimes, the
honest answer is that the standard library has no drop-in identity set — keep an
`{id(obj): obj}` dict so the reference and the key live and die together.

## Gotchas

**★ `SyntaxWarning: "is" with 'str' literal. Did you mean "=="?` appearing in
someone else's dependency and being suppressed globally.** The warning is emitted at
compile time, so `-W ignore::SyntaxWarning` hides your own bugs too — and, because
`.pyc` files are cached, a suppressed warning may not reappear on the next run even
after you unsuppress it. Fix: fix the call site; if the code is vendored, patch it
rather than muting the category.

**★ No warning at all for `if status is ACTIVE:` where `ACTIVE = "active"`.** The
compiler only inspects *literals*; a name is not a literal, however constant it looks.
Fix: rely on the linter (`ruff`'s `F632`, `pylint`'s `literal-comparison`) and on
review, not on the warning.

**★ `x is ()` warning while `x is (a, b)` does not.** `check_is_arg` flags a tuple
only when all its elements are constants. Both are wrong uses of `is` — the empty
tuple happens to be a shared singleton in CPython, which is exactly the kind of
accident these two chunks are about. Fix: `== ()` or, better, `not x` /
`len(x) == 0`.

**★ The warning fires only on first compilation, so a second run is silent.** Bytecode
is cached in `__pycache__`; the compiler does not re-run, so the `SyntaxWarning` does
not re-emit. A CI job that greps the log for warnings can pass on a warm cache. Fix:
run the check with `PYTHONDONTWRITEBYTECODE=1` on a clean checkout, or use a linter,
which does not depend on compilation state.

**★ An identity-based memo keyed on `id()` returning stale or wrong entries.** Object
addresses are reused after collection, and the docs say two objects with
non-overlapping lifetimes may share an `id()`. Fix: hold a reference for exactly as
long as the key lives — an `{id(obj): obj}` dict does that — or key on a real
identifier from the data.

**★ `id()` written into a log or an API response as an object identifier.** It is a
memory address, unstable across processes and reused within one. Fix: use a UUID, a
database primary key, or `hashlib` over the object's stable fields.

**★ Assuming immortality means `is` is now reliable in general.** PEP 683 immortality
covers the runtime-global singletons, static types and the small-int cache; it changes
refcounting, not identity semantics, and says nothing about strings you built at
runtime. Fix: unchanged advice — `is` for `None`, `True`, `False`, `Ellipsis`,
`NotImplemented` and your own sentinels; `==` for everything else.

**★ `sys._is_immortal()` used in production code.** The leading underscore is the
whole message: it is a CPython introspection hook for debugging the implementation,
not an API. Fix: do not branch on it.

## Interview questions

**★ Q: What warning does Python emit for `x is 5`, and what does it not catch?**
Since 3.8 the compiler emits `SyntaxWarning: "is" with 'int' literal. Did you mean
"=="?` — with the literal's inferred type name in the message. It fires only for
constant operands, and it exempts `None`, `True`, `False` and `Ellipsis`. It does
*not* fire when the right-hand side is a variable or a module-level constant, which is
where the surviving bugs live.

**Q: Which literals does the `is`-with-a-literal warning deliberately allow?**
`None`, `True`, `False` and `Ellipsis` — the compiler's `check_is_arg` lists exactly
those four as acceptable constants. They are the singletons `is` is *for*. Tuples are
flagged only when every element is itself a constant, so `x is ()` warns and
`x is (a, b)` does not.

**Q: Why might the warning not appear on a second run of the same program?**
Because it is emitted by the compiler, and compiled bytecode is cached in
`__pycache__`. If the module is not recompiled, the warning is not re-emitted. That
makes "no warnings in the log" a weak signal; a linter is the reliable check.

**★ Q: Is `id()` a safe key for a "have I already processed this object" set?**
No. The docs say two objects with non-overlapping lifetimes may share an `id()`, and
in CPython an `id()` is a memory address that the allocator reuses. If you do not hold
a reference, the object can be collected and a different object can land at the same
address, producing a false "already seen". Hold the object alongside the id, or use a
real identifier.

**Q: What does "immortal" mean in CPython 3.12+, and does it make `is` safer?**
It means the object's reference count is never modified, so it is never deallocated
while the interpreter runs — PEP 683, applied to `None`, `True`, `False`, `Ellipsis`,
`NotImplemented`, static types and the small-int cache. It is a refcounting
optimisation motivated by free-threading and subinterpreters. It guarantees those
particular objects stay alive and keep their addresses; it says nothing about `is` on
strings or large integers.

**Q: How would you enforce "no `is` on non-singletons" across a codebase?**
`ruff` rule `F632` (`is`-comparison with a literal) as an error in CI, plus a review
habit for the variable case the compiler cannot see. Neither catches
`x is SOME_CONSTANT`; for that, the durable fix is a code-review rule that `is` is
only ever written against `None`, `True`, `False`, `Ellipsis`, `NotImplemented` or a
name ending in a sentinel convention such as `_UNSET`.

---

← Prev: [Why `is` seems to work](04b-why-is-seems-to-work.md) · Index: [Comparisons](README.md) · Next → [Cross-type comparison](05-cross-type-comparison.md)
