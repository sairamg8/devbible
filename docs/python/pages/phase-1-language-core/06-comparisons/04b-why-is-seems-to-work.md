---
title: "is on integers and strings appears to work because CPython caches and interns them, and the compiler emits a SyntaxWarning naming the literal's type"
sidebar_label: "4b · Why `is` seems to work"
sidebar_position: 68
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 C API
> [`PyLong_FromLong`](https://docs.python.org/3.14/c-api/long.html#c.PyLong_FromLong),
> [`sys.intern`](https://docs.python.org/3.14/library/sys.html#sys.intern),
> [`id()`](https://docs.python.org/3.14/library/functions.html#id),
> the [glossary entry for *immortal*](https://docs.python.org/3.14/glossary.html#term-immortal)
> and [PEP 683](https://peps.python.org/pep-0683/),
> the [What's New in Python 3.8 porting notes](https://docs.python.org/3.14/whatsnew/3.8.html)
> (verified against
> [`Doc/whatsnew/3.8.rst`](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.8.rst)),
> and CPython
> [`Python/codegen.c`](https://github.com/python/cpython/blob/3.14/Python/codegen.c)
> for the exact warning text.
> Version spine: **CPython 3.14**.

**`x is 256` is `True` and `x is 257` is `False`, and neither of those is a language
guarantee — they are artefacts of a CPython cache. Every "`is` works fine on
integers" belief is built on the small-integer cache, string interning, and the fact
that constants inside a single code object are shared, all three of which hold in the
REPL and in a unit test and stop holding the moment the value arrives from JSON, a
socket or a database. Since Python 3.8 the compiler warns you by name.**

## The small-integer cache

> *"**CPython implementation detail:** CPython keeps an array of integer objects for
> all integers between `-5` and `256`. When you create an int in that range you
> actually just get back a reference to the existing object."* —
> [`PyLong_FromLong`](https://docs.python.org/3.14/c-api/long.html#c.PyLong_FromLong)

Two things to take from that. First, the range: `-5` through `256` inclusive, i.e.
262 objects. Second, the label: **CPython implementation detail**. PyPy, GraalPy and
MicroPython are free to cache a different range or none. Nothing about `is` on small
integers is portable.

The practical consequence is that identity comparison on integers succeeds for
exactly the values that appear in tests — HTTP status codes are the notable
exception, since `is 404` and `is 500` are outside the cache — and fails for the
values that appear in production:

```python
a = 256
b = 256
a is b        # True in CPython — both names point at the cached object

a = 257
b = 257
a is b        # in CPython, this depends on whether the compiler shared the constant
```

That second case is *not* simply `False`, which is why the REPL and a script
disagree. Read on.

## Constants are shared inside one code object

The compiler stores each code object's literals in a `co_consts` tuple and merges
equal, equal-typed constants within that tuple. So two occurrences of `257` in the
*same function body* are one object, while two occurrences typed as separate REPL
statements are two objects — each statement is its own code object.

```python
def f():
    a = 257
    b = 257
    return a is b        # in CPython: the two literals share one constant
```

versus two consecutive lines pasted into an interactive session, which compile
separately. This is why "`is` on integers" behaves one way in a REPL demonstration
and the other way in the file the demonstration was supposed to explain. It is also
why you should never conclude anything about the language from an identity test on a
literal.

The same merging applies to strings, tuples of constants, and — since the compiler's
constant folding runs first — to the *results* of constant expressions like `2 ** 8`.

## String interning

Interning is the string version of the same phenomenon:

> *"Enter string in the table of "interned" strings and return the interned string –
> which is string itself or a copy. Interning strings is useful to gain a little
> performance on dictionary lookup – if the keys in a dictionary are interned, and the
> lookup key is interned, the key comparisons (after hashing) can be done by a pointer
> compare instead of a string compare. **Normally, the names used in Python programs
> are automatically interned, and the dictionaries used to hold module, class or
> instance attributes have interned keys.**"* —
> [`sys.intern`](https://docs.python.org/3.14/library/sys.html#sys.intern)

"The names used in Python programs" is the operative phrase: identifiers, attribute
names, and string literals that look like identifiers are interned by the compiler.
So:

```python
a = "user_id"
b = "user_id"
a is b            # identifier-shaped literal: interned, so True in CPython

c = "user id"     # contains a space — not identifier-shaped
d = "user id"
c is d            # not guaranteed; depends on constant merging in the code object

e = "user" + input()   # built at runtime — certainly not interned
```

The killer is the last line. A key that arrives from a network read, a file, a
database driver or `json.loads` is a *new* string object every time, even when its
characters are identical to a literal in your source. `parsed["status"] is "active"`
is therefore `False` for real data and `True` in the test where you constructed the
dict from literals. That is the exact shape of a bug that passes CI and fails in
production.

`sys.intern` exists if you genuinely want pointer-compare speed on a hot dict, with a
caveat:

> *"Interned strings are not immortal; you must keep a reference to the return value of
> `intern()` around to benefit from it."*

## Gotchas

**★ `if status is "active":` passing every test and failing on real data.** The test
built the dict from string literals, which the compiler interned; production builds
the string from a socket read, which it does not. Fix: `==`. There is no correct
version of this with `is`.

**★ `a is b` being `True` for `256` and `False` for `257`.** The small-integer cache
covers `-5` to `256` inclusive; above that you get fresh objects unless the compiler
merged two literals in one code object. Fix: never use `is` on numbers. Use `==`.

**★ The same two-line snippet giving different answers in the REPL and in a file.**
In a file both literals live in one code object and are merged into one constant; in
the REPL each statement is its own code object. Fix: stop drawing conclusions from
identity tests on literals — the answer is an artefact of compilation units.

**★ A `dict` lookup that is unexpectedly slow after switching from literal keys to
parsed keys.** Interned literal keys compare by pointer after hashing; parsed strings
do not, so every collision costs a full character comparison. Fix: `sys.intern` the
parsed keys on ingest if the dict is hot — and keep the returned reference, because
interned strings are not immortal.

**★ Assuming interning makes `is` safe because "CPython interns short strings".**
There is no documented rule about length. The documented rule is that *names* used in
Python programs are interned; everything else is unspecified and has changed between
versions. Fix: treat every `is` on a `str` as a bug.

**★ `is` used on a `bool` returned by a C extension or NumPy.** `np.True_` is not the
`True` singleton, so `x is True` is `False` while `x == True` is `True`. Fix: `if x:`
for truthiness; convert explicitly with `bool(x)` at the boundary if you need the
singleton.

**★ `x is 0` used as a fast zero test.** `0` is in the cache so it works, right up
until the value is a `float` `0.0`, a `Decimal("0")`, a `numpy.int64(0)` or a
`bool`. Fix: `x == 0`, or `not x` if falsiness is what you meant.

## Interview questions

**★ Q: Why is `a is b` `True` for `a = b = 256` and `False` for `257`?**
CPython preallocates an array of integer objects for every value from `-5` to `256`
and hands back a reference to the shared object, so any two `256`s are the same
object. `257` is constructed fresh — unless both literals sit in the same code
object, in which case the compiler merged them into one constant. The C API
documentation labels the cache a CPython implementation detail; nothing about it is
guaranteed by the language.

**★ Q: Why does `s is "active"` work in my tests and fail in production?**
String literals that look like identifiers are interned by the compiler, and constants
within one code object are merged, so two literal `"active"`s in your test are one
object. A string parsed from JSON, read from a socket or returned by a database
driver is a new object with the same characters. `is` asks about the object; `==`
asks about the characters, and you wanted the characters.

**Q: What is string interning, and when would you call `sys.intern` deliberately?**
Interning stores one canonical copy of a string in a global table so that equal
strings can be compared by pointer after hashing. The docs give the motivation: faster
dictionary lookup when both the stored keys and the lookup key are interned. You would
call it explicitly on a hot dict whose keys are parsed at runtime — and you must keep
a reference to the returned string, because interned strings are not immortal.

**Q: Does any of this behave the same on PyPy?**
Not necessarily. The integer cache, the interning rules and constant merging are all
documented as CPython implementation details. Code whose correctness depends on them
is code that will behave differently on another implementation, which is the strongest
argument for never writing it.

**Q: Why do the REPL and a script disagree about `a is b` for a large literal?**
Because the unit of constant merging is the code object. Two statements typed at the
prompt compile to two code objects with separate `co_consts` tuples; two lines in one
function body compile to one code object whose equal, same-typed constants are shared.
The identity answer is therefore a fact about how the source was compiled, not about
the values.

---

← Prev: [`is` versus `==`](04-is-versus-equals.md) · Index: [Comparisons](README.md) · Next → [The `is`-with-a-literal warning](04c-the-syntaxwarning-and-lifetimes.md)
