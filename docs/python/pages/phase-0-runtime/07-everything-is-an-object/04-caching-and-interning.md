---
title: "Caching and interning: the implementation details that make wrong code pass its tests"
sidebar_label: "4 · Caching and interning"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [C-API `PyLong_FromLong`](https://docs.python.org/3.14/c-api/long.html)
> small-integer note and
> [`sys.intern`](https://docs.python.org/3.14/library/sys.html#sys.intern), plus
> CPython 3.14 source for the string-constant interning rule
> ([`Objects/codeobject.c`](https://github.com/python/cpython/blob/3.14/Objects/codeobject.c)),
> the per-compilation constant cache
> ([`Python/compile.c`](https://github.com/python/cpython/blob/3.14/Python/compile.c))
> and the constant-folding limits
> ([`Python/flowgraph.c`](https://github.com/python/cpython/blob/3.14/Python/flowgraph.c)).
> Target: **CPython 3.14**.

**CPython reuses objects aggressively: small integers come from a fixed table,
equal constants inside one compilation are merged into one object, constant
expressions are folded at compile time, and string constants shaped like
identifiers are interned. Every one of these is an *implementation detail*, and
every one has the same effect on your code — it makes `is` where you meant `==`
return True in your tests and False in production. That is why this chunk exists.
Not because the caches are interesting, but because they are the mechanism by
which a specific class of bug hides.**

The rule this chunk exists to defend is stated in chunk
[3](03-identity-and-equality.md): **`is` is for `None`, for `True`/`False`, and
for sentinels you created. Nothing else.** Immortal objects, what free-threading
changes, and the closing argument are chunk
[4b · Immortal objects](04b-immortal-objects.md).

## The small-integer cache

The C-API documentation states it as an implementation detail, in those words:

> *"CPython implementation detail: CPython keeps an array of integer objects for
> all integers between `-5` and `256`. When you create an int in that range you
> actually just get back a reference to the existing object."*

```python
a = 256
b = 256
a is b            # True on CPython — both names got the one cached object

x = 257
y = 257
x is y            # depends entirely on how the code was compiled; see below
```

Two consequences worth naming explicitly:

- **The range is arbitrary and not part of the language.** `-5` and `256` are
  numbers someone chose; PyPy, GraalPy, MicroPython and a future CPython are free
  to choose differently. Nothing in the language reference promises them.
- **It exists for allocation cost, not for you.** Small integers are created and
  destroyed constantly — loop counters, list indices, `len()` results — and a
  fixed table means those never hit the allocator. The identity side effect is
  incidental.

The reason this matters is HTTP status codes. `200`, `201`, `404` are all inside
the cached range; `1000`, `1001` and every business ID you will ever compare are
not. `if code is 200` passes every test you write and then fails the first time
somebody adds a status of `999`… except that `999` is *also* outside the range,
so it fails immediately and loudly. The real disaster is the reverse: a value
that used to be small and became large after a data migration.

## Compile-time constant merging: why `1000 is 1000` can be True

Independently of the small-int cache, the CPython **compiler** deduplicates equal
constants. `_PyCompile_AddConst` looks each constant up in a per-compilation
cache (`c_const_cache`) keyed by type *and* value — so `1` and `1.0` and `True`
stay distinct — and reuses the existing object if it has already seen one.

The scope of that cache is **one compilation unit**: one call to `compile()`, one
`.py` file, one REPL statement. That single fact explains the whole confusing
pattern:

```python
# in a file, run as a script — ONE compilation of the whole module
a = 1000
b = 1000
print(a is b)          # True: both constants merged into one object at compile time

def f():
    return 1000

print(f() is a)        # also True on CPython 3.14: the function's code object
                       # was compiled in the same unit, sharing the const cache
```

```python
# at the REPL — each statement is compiled separately
>>> a = 1000
>>> b = 1000
>>> a is b             # False: two compilations, two const caches, two objects
```

```python
# and never across a runtime boundary
n = int(input())       # 1000 typed by the user
n is a                 # False: this int was built at run time, not folded in
                       # (unless it happens to land in the -5..256 table)
```

🔴 **The lesson is not "learn the rule".** The lesson is that the answer depends
on the compilation boundary, which is invisible in the source, differs between
the REPL and a file, differs between CPython versions, and has never been
specified. Anyone reasoning about it in production code has already lost.

Constant folding runs alongside: `2 ** 10`, `"-" * 40`, `(1, 2) + (3,)` and
`60 * 60 * 24` are evaluated by the compiler and stored as a single constant. It
is deliberately bounded, so that a `.pyc` file cannot be blown up by a
pathological expression — the limits in CPython 3.14's `flowgraph.c` are:

| Limit | Value | Applies to |
|---|---|---|
| `MAX_INT_SIZE` | 128 bits | products and powers of integers |
| `MAX_COLLECTION_SIZE` | 256 items | tuple repetition |
| `MAX_STR_SIZE` | 4096 characters | string and bytes repetition |
| `MAX_TOTAL_ITEMS` | 1024 (including nested) | nested collection repetition |

So `2 ** 64` is folded and `2 ** 1000` is not; `"x" * 100` is folded and
`"x" * 100000` is not. This is a real, useful thing to know when reading a
disassembly — see topic **12 · Bytecode inspection with `dis`** *(not written yet)*
— and a terrible thing to build on.

## String interning

Interning means keeping a table of strings so that equal strings can be the same
object. The `sys.intern` documentation explains why it exists:

> *"Enter string in the table of 'interned' strings and return the interned
> string – which is string itself or a copy. Interning strings is useful to gain
> a little performance on dictionary lookup – if the keys in a dictionary are
> interned, and the lookup key is interned, the key comparisons (after hashing)
> can be done by a pointer compare instead of a string compare. Normally, the
> names used in Python programs are automatically interned, and the dictionaries
> used to hold module, class or instance attributes have interned keys."*

**That last sentence is the real reason interning exists.** Every attribute
access — `self.count`, `request.headers`, `module.function` — is a dict lookup
keyed by a string. Interning the identifiers turns the post-hash comparison from
a memcmp into a pointer comparison. It is an optimisation for the interpreter's
own hot path, and your `is` comparisons are riding on it by accident.

**Which string constants get interned automatically** is decided by
`should_intern_string` in `Objects/codeobject.c`. In the default (GIL) build the
rule is exactly: the string is ASCII, and every character matches
`[a-zA-Z0-9_]`.

```python
a = "user_id"
b = "user_id"
a is b            # True — matches [a-zA-Z0-9_], interned at compile time

c = "user id"
d = "user id"
c is d            # the space disqualifies it from interning; whether these are
                  # the same object then depends only on constant merging above
```

Two further facts that make this a trap rather than a rule:

- **Runtime-built strings are not interned.** `"user" + "_id"` is folded at
  compile time and interned; `"user" + suffix` where `suffix` is a variable, or
  `f"user_{kind}"`, or a string decoded from JSON, from a socket, from a database
  driver, or read from a file, is a fresh object. This is precisely why
  `if role is "admin"` passes unit tests full of literals and fails against a
  real request body.
- **The free-threaded build interns everything.** The source is explicit —
  `#ifdef Py_GIL_DISABLED` returns 1 unconditionally, with the comment *"The
  free-threaded build interns (and immortalizes) all string constants"*. So the
  identity of two string constants can differ **between two builds of the same
  CPython version**. If you needed one more argument that identity of strings is
  not a language property, that is it.

`sys.intern` is the explicit form, and it has one legitimate use: you are
building a large table (millions of rows) whose keys come from a small vocabulary
read at run time, and you want them to share storage and compare by pointer.

```python
import sys

# a parser reading millions of records with a handful of distinct field names
fields = {sys.intern(name): parse(value) for name, value in raw_pairs}
```

The doc adds the caveat that goes with it:

> *"Interned strings are not immortal; you must keep a reference to the return
> value of `intern()` around to benefit from it."*

Interning a string and throwing the result away accomplishes nothing — the
interned copy is collected like anything else. Store the return value.

## Gotchas

**Symptom:** `if code is 200:` works, `if code is 1000:` does not
**Cause:** 200 is inside CPython's `-5..256` small-integer table; 1000 is not, so two `1000` objects created at run time are distinct
**Fix:** `==`. There is no threshold to memorise here — the table is an implementation detail with no promised bounds

**Symptom:** `a = 1000; b = 1000; a is b` is True in a script and False in the REPL
**Cause:** the compiler merges equal constants within one compilation unit; a script is one unit, each REPL statement is its own
**Fix:** stop asking the question in code. If you are genuinely investigating, `dis` will show both names loading the same `LOAD_CONST` index — see topic **12 · Bytecode inspection with `dis`** *(not written yet)* — but the answer is not portable and must not be relied on

**Symptom:** a string comparison with `is` passes locally against literals and fails against a request body
**Cause:** identifier-shaped string *literals* are interned at compile time; a string decoded from JSON or read from a socket is a fresh object
**Fix:** `==`, and enable `ruff` F632 so the pattern cannot be committed again

**Symptom:** `"user id" is "user id"` behaves differently from `"user_id" is "user_id"`
**Cause:** CPython interns string constants only when the string is ASCII and every character matches `[a-zA-Z0-9_]`; the space disqualifies the first
**Fix:** none needed — do not use `is` on strings. The point of the rule is that you never have to know this one

**Symptom:** `sys.intern(name)` did not reduce memory
**Cause:** the return value was discarded — the docs say interned strings are not immortal and you must keep a reference to the return value to benefit
**Fix:** use the returned object as the key: `d[sys.intern(name)] = value`, not `sys.intern(name); d[name] = value`

**Symptom:** a test asserts `obj1 is obj2` for two objects built from the same literal, and it breaks on a Python upgrade
**Cause:** the test encoded a compiler implementation detail as a requirement
**Fix:** assert `==`. If identity genuinely is the property under test — a cache returning the same instance, a singleton factory — construct one object in the test and assert the second call returns *that* object, not that two literals coincide

**Symptom:** a huge constant expression like `[0] * 10_000_000` is not folded, while `[0] * 10` is
**Cause:** constant folding is bounded so a pathological expression cannot bloat the `.pyc`; the 3.14 limits are 128 bits for integer products, 256 items for tuple repetition, 4096 characters for string repetition and 1024 total items for nested collections
**Fix:** nothing to fix — but be aware when reading a disassembly that an unfolded expression means you crossed a limit, not that the compiler failed

**Symptom:** two identical-looking constants in different modules of the same package are different objects
**Cause:** the constant cache is per compilation unit, and each module is compiled separately
**Fix:** if a shared constant must be one object — because it is a sentinel — define it in one module and import it. `from ._sentinels import MISSING` is the only way to guarantee identity across modules

## Interview questions

**★ Why is `a is b` True for `a = 256; b = 256` but not for `a = 257; b = 257` at the REPL?**
CPython pre-allocates an array of integer objects for `-5` through `256` and
hands out references to them rather than allocating, so every `256` in the
process is one object. `257` is outside that table, so each REPL statement — a
separate compilation — creates its own object. In a *script*, both `257`
constants are usually merged by the compiler's per-compilation constant cache and
`is` would say True there. All of it is unspecified implementation behaviour, and
none of it belongs in a comparison you ship.

**★ Why does `if name is "admin"` pass tests and fail in production?**
Because string literals shaped like identifiers are interned at compile time, so
two occurrences of `"admin"` in your source are one object and `is` is True. The
production value arrives from a JSON body, a database driver or a socket and is
built at run time, so it is a different object with the same value. `==` was
always the correct operator; interning is what delayed the failure until the code
was live.

**★ What is string interning and why does CPython do it?**
It is a table mapping a string's value to a canonical object, so equal strings can
be the same object. The documented motivation is dictionary lookup: attribute
access and namespace lookup are dict lookups keyed by identifier strings, and if
both the stored key and the lookup key are interned, the post-hash comparison is a
pointer compare instead of a character-by-character compare. It is an
optimisation for the interpreter's own hottest operation. `sys.intern` exposes it
for the case where you build a huge table from a small vocabulary of runtime
strings — and the docs warn that you must keep the returned object, because
interned strings are not immortal.

**What does the compiler do with `60 * 60 * 24` in your source?**
It folds it to the single constant `86400` at compile time, and stores that one
object in the code object's constants. Writing the multiplication out is therefore
free at run time and strictly better for readability than a magic `86400`.
Folding is bounded — CPython 3.14 refuses to fold integer products beyond 128
bits, string repetition beyond 4096 characters and collection repetition beyond
256 items — so `2 ** 64` is folded and `2 ** 1000` is not.

**Where does the compiler's constant cache stop?**
At the compilation unit: one `compile()` call, one `.py` file, one REPL
statement. Within a unit, equal constants of the same type are merged into a
single object — including across the module body and the functions defined in
it, since they are compiled together. Across units, nothing is shared. That
boundary is invisible in the source, which is exactly why identity of constants
is not something to reason about in production code.

---

← Prev: [Container comparison](03c-container-comparison.md) · Index: [Everything is an object](README.md) · Next → [Immortal objects](04b-immortal-objects.md)
