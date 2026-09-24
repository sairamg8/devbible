---
name: research-python-p01-t12-eafp-vs-lbyl
description: Banked primary-source research for devbible Python phase 1 topic 12 (EAFP vs LBYL) — the glossary definitions, the os.access security-hole note, hasattr/getattr, the iterable test, dict lookup APIs, defaultdict.__missing__, pathlib/os flags, zero-cost exceptions, free-threading thread safety, mypy narrowing. Verbatim quotes with URLs, gathered 2026-09-03. Do not re-derive.
metadata:
  type: project
---

# research · python phase 1 topic 12 · EAFP vs LBYL

**Gathered 2026-09-03 for `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`.**
Every chunk of that topic is written from this file. 🔴 **Do not re-derive** — if a later
session needs a claim that is not here, add it here with its URL rather than fetching
the same page twice.

**Version spine: Python 3.14** (3.14.7, Aug 2026). All `docs.python.org/3.14/…` URLs.

---

## 1 · The glossary — the two names, verbatim

`https://docs.python.org/3.14/glossary.html`

**EAFP:**
> *"Easier to ask for forgiveness than permission. This common Python coding style
> assumes the existence of valid keys or attributes and catches exceptions if the
> assumption proves false. This clean and fast style is characterized by the presence of
> many `try` and `except` statements. The technique contrasts with the LBYL style common
> to many other languages such as C."*

**LBYL:**
> *"Look before you leap. This coding style explicitly tests for pre-conditions before
> making calls or lookups. This style contrasts with the EAFP approach and is
> characterized by the presence of many `if` statements."*
>
> *"In a multi-threaded environment, the LBYL approach can risk introducing a race
> condition between "the looking" and "the leaping". For example, the code, `if key in
> mapping: return mapping[key]` can fail if another thread removes key from mapping
> after the test, but before the lookup. This issue can be solved with locks or by using
> the EAFP approach. See also thread-safe."*

**duck-typing:**
> *"A programming style which does not look at an object's type to determine if it has
> the right interface; instead, the method or attribute is simply called or used ("If it
> looks like a duck and quacks like a duck, it must be a duck.") By emphasizing
> interfaces rather than specific types, well-designed code improves its flexibility by
> allowing polymorphic substitution. Duck-typing avoids tests using `type()` or
> `isinstance()`. (Note, however, that duck-typing can be complemented with abstract
> base classes.) Instead, it typically employs `hasattr()` tests or EAFP programming."*

**iterable** (relevant clause): iterables include *"objects of any classes you define
with an `__iter__()` method or with a `__getitem__()` method that implements sequence
semantics."*

Notes for writing: the glossary calls EAFP *"clean and fast"* — that is the docs' own
value judgement, quotable. It gives **no** performance number. LBYL's only *stated*
hazard in the glossary is the race condition.

---

## 2 · `os.access` — the docs prescribe EAFP, with a worked example

`https://docs.python.org/3.14/library/os.html#os.access`

> *"Using `access()` to check if a user is authorized to e.g. open a file before actually
> doing so using `open()` creates a security hole, because the user might exploit the
> short time interval between checking and opening the file to manipulate it. It's
> preferable to use EAFP techniques."*

The docs' own before/after (verbatim code):

```python
if os.access("myfile", os.R_OK):
    with open("myfile") as fp:
        return fp.read()
return "some default data"
```

*"is better written as:"*

```python
try:
    fp = open("myfile")
except PermissionError:
    return "some default data"
else:
    with fp:
        return fp.read()
```

Second note, same entry:
> *"I/O operations may fail even when `access()` indicates that they would succeed,
> particularly for operations on network filesystems which may have permissions
> semantics beyond the usual POSIX permission-bit model."*

⚠️ Their EAFP rewrite catches `PermissionError` **only** — it still propagates
`FileNotFoundError`, and the `else:` clause exists so the `return` inside the `with` is
not inside the `try`. Both are worth pointing out: it is a faithful translation of the
`R_OK` check, not a catch-all.

---

## 3 · `os.path` / `pathlib` — what a "look" actually returns

`https://docs.python.org/3.14/library/os.path.html`

> `os.path.exists(path)` — *"Return `True` if path refers to an existing path or an open
> file descriptor. Returns `False` for broken symbolic links. On some platforms, this
> function may return `False` if permission is not granted to execute `os.stat()` on the
> requested file, even if the path physically exists."*

> `os.path.lexists(path)` — *"Return `True` if path refers to an existing path, including
> broken symbolic links."*

> `os.path.isfile(path)` — *"Return `True` if path is an existing regular file. This
> follows symbolic links, so both `islink()` and `isfile()` can be true for the same
> path."*

`https://docs.python.org/3.14/library/pathlib.html`

> `Path.exists(*, follow_symlinks=True)` — *"Return `True` if the path points to an
> existing file or directory. `False` will be returned if the path is invalid,
> inaccessible or missing. Use `Path.stat()` to distinguish between these cases."*
> *Changed in 3.12: the follow_symlinks parameter was added.*

> `Path.is_file(*, follow_symlinks=True)` — *"Return `True` if the path points to a
> regular file. `False` will be returned if the path is invalid, inaccessible or missing,
> or if it points to something other than a regular file. Use `Path.stat()` to
> distinguish between these cases."* *Changed in 3.13: follow_symlinks added.*

🔴 **Load-bearing:** a `Path.exists()` "look" collapses *missing*, *invalid* and
*inaccessible* into one `False`. The docs' own remedy is `Path.stat()` — i.e. **catch the
exception**, which is EAFP.

**The flags the API already gives you** (LBYL done atomically, inside the call):

> `Path.mkdir(mode=0o777, parents=False, exist_ok=False)` — *"If the path already exists,
> `FileExistsError` is raised."* … *"If exist_ok is false (the default), `FileExistsError`
> is raised if the target directory already exists."* … *"If exist_ok is true,
> `FileExistsError` will not be raised unless the given path already exists in the file
> system and is not a directory (same behavior as the POSIX `mkdir -p` command)."*
> *Changed in 3.5: exist_ok added.*

> `Path.unlink(missing_ok=False)` — *"If missing_ok is false (the default),
> `FileNotFoundError` is raised if the path does not exist. If missing_ok is true,
> `FileNotFoundError` exceptions will be ignored (same behavior as the POSIX `rm -f`
> command)."* *Changed in 3.8: missing_ok added.*

`https://docs.python.org/3.14/library/functions.html#open`

> mode `'x'` — *"open for exclusive creation, failing if the file already exists"*.
> Added in 3.3; *"`FileExistsError` is now raised if the file opened in exclusive
> creation mode (`'x'`) already exists."*

---

## 4 · Attributes — `hasattr`, `getattr`, `getattr_static`

`https://docs.python.org/3.14/library/functions.html`

> `hasattr(object, name, /)` — *"The arguments are an object and a string. The result is
> `True` if the string is the name of one of the object's attributes, `False` if not.
> (This is implemented by calling `getattr(object, name)` and seeing whether it raises an
> `AttributeError` or not.)"*

> `getattr(object, name, /)` / `getattr(object, name, default, /)` — *"Return the value of
> the named attribute of object. … If the named attribute does not exist, default is
> returned if provided, otherwise `AttributeError` is raised."* Plus the note that
> **private name mangling happens at compile time**, so `getattr(x, '__secret')` must be
> mangled by hand.

Inference that is safe to state (and only this much): because `hasattr` is *defined* as
"call `getattr` and see whether it raises `AttributeError`", (a) it **runs** the
attribute — a property's body executes, side effects included; (b) an `AttributeError`
raised *inside* a property is indistinguishable from the attribute not existing; and (c)
any **other** exception type propagates out of `hasattr`. The current docs state the
implementation, not those three consequences — write them as consequences of the quoted
sentence, not as quotes.

`https://docs.python.org/3.14/library/inspect.html#inspect.getattr_static`

> *"Retrieve attributes without triggering dynamic lookup via the descriptor protocol,
> `__getattr__()` or `__getattribute__()`."*
> *"Note: this function may not be able to retrieve all attributes that getattr can fetch
> (like dynamically created attributes) and may find attributes that getattr can't (like
> descriptors that raise AttributeError). It can also return descriptors objects instead
> of instance members."*
> *"If the instance `__dict__` is shadowed by another member (for example a property) then
> this function will be unable to find instance members."* Added in 3.2.
> ⚠️ The docs do **not** state what it raises when the attribute is missing and no
> default is given, and say nothing about its speed. Do not claim either.

---

## 5 · The iterability test — the one place the docs say "the only reliable way"

`https://docs.python.org/3.14/library/collections.abc.html`

> *"Checking `isinstance(obj, Iterable)` detects classes that are registered as `Iterable`
> or that have an `__iter__()` method, but it does not detect classes that iterate with
> the `__getitem__()` method. The only reliable way to determine whether an object is
> iterable is to call `iter(obj)`."*

Footnote [1] on the special-method ABCs:
> *"These ABCs override `__subclasshook__()` to support testing an interface by verifying
> the required methods are present and have not been set to `None`. This only works for
> simple interfaces. More complex interfaces require registration or direct subclassing."*

`https://docs.python.org/3.14/library/functions.html#iter`

> `iter()` without a sentinel: *"the single argument must be a collection object which
> supports the iterable protocol (the `__iter__()` method), or it must support the
> sequence protocol (the `__getitem__()` method with integer arguments starting at `0`).
> If it does not support either of those protocols, `TypeError` is raised."*

---

## 6 · Mappings — every lookup API, and what each does on a miss

`https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict`

> `d[key]` — *"Return the item of dictionary d with key key. Raises a `KeyError` if key is
> not in the dictionary."* … *"If a subclass of `dict` defines a method `__missing__()`
> and key is not present, the `d[key]` operation calls that method with the key key as
> argument."*

> `get(key, default=None)` — *"Return the value for key if key is in the dictionary, else
> default. If default is not given, it defaults to `None`, so that this method never
> raises a `KeyError`."*

> `setdefault(key, default=None)` — *"If key is in the dictionary, return its value. If
> not, insert key with a value of default and return default."*

> `pop(key[, default])` — *"If key is in the dictionary, remove it and return its value,
> else return default. If default is not given and key is not in the dictionary, a
> `KeyError` is raised."*

> `key in d` — *"Return `True` if d has a key key, else `False`."*

> `sequence.index(value)` — *"Return the index of the first occurrence of value in
> sequence. Raises `ValueError` if value is not found in sequence."*

`https://docs.python.org/3.14/library/collections.html#collections.defaultdict`

> `__missing__(key, /)` — *"If the `default_factory` attribute is `None`, this raises a
> `KeyError` exception with the key as argument. If `default_factory` is not `None`, it is
> called without arguments to provide a default value for the given key, this value is
> inserted in the dictionary for the key, and returned. If calling `default_factory`
> raises an exception this exception is propagated unchanged."*
> *"This method is called by the `__getitem__()` method of the `dict` class when the
> requested key is not found; whatever it returns or raises is then returned or raised by
> `__getitem__()`."*

🔴 > *"Note that `__missing__()` is not called for any operations besides `__getitem__()`.
> This means that `get()` will, like normal dictionaries, return `None` as a default rather
> than using `default_factory`."*

And on `setdefault`:
> *"This technique is simpler and faster than an equivalent technique using
> `dict.setdefault()`"* — of the `defaultdict(list)` grouping idiom versus
> `d.setdefault(k, []).append(v)`.

**Consequence to teach:** inside a `defaultdict`, an EAFP `try: d[k] / except KeyError`
**never fires and silently inserts a key** — the `except` branch is dead code and the
dict grows. `.get()` bypasses the factory entirely.

---

## 7 · The cost argument — the only documented numbers

`https://docs.python.org/3.14/whatsnew/3.11.html` (Misc)

> *""Zero-cost" exceptions are implemented, eliminating the cost of `try` statements when
> no exception is raised."* (Mark Shannon, bpo-40222.)

> *"A more concise representation of exceptions in the interpreter reduced the time
> required for catching an exception by about 10%."* (Irit Katriel, bpo-45711.)

⚠️ These are the **only** cost figures the docs give. There is no documented per-raise
cost, no comparison against an `if`, and no benchmark. Anything beyond "entering a `try`
that does not raise costs nothing; raising and catching still costs something" is
invention — say so on the page rather than estimating.

---

## 8 · Threads — the race is not hypothetical in 3.14

`https://docs.python.org/3.14/howto/free-threading-python.html#thread-safety`

> *"The free-threaded build of CPython aims to provide similar thread-safety behavior at
> the Python level to the default GIL-enabled build. Built-in types like `dict`, `list`,
> and `set` use internal locks to protect against concurrent modifications in ways that
> behave similarly to the GIL. However, Python has not historically guaranteed specific
> behavior for concurrent modifications to these built-in types, so this should be
> treated as a description of the current implementation, not a guarantee of current or
> future behavior."*

> *"It's recommended to use the `threading.Lock` or other synchronization primitives
> instead of relying on the internal locks of built-in types, when possible."*

**The precise claim to make:** individual `dict` operations are protected; a *pair* of
operations (`if k in d` then `d[k]`) never was, in either build. The glossary's race
condition is about the gap between two operations, and no internal lock closes it.

---

## 9 · Async — the EAFP handler that eats a cancellation

`https://docs.python.org/3.14/library/asyncio-exceptions.html`

> `asyncio.CancelledError` — *"The operation has been cancelled. This exception can be
> caught to perform custom operations when asyncio Tasks are cancelled. In almost all
> situations the exception must be re-raised."* *Changed in 3.8: `CancelledError` is now a
> subclass of `BaseException` rather than `Exception`.*

> `asyncio.TimeoutError` — *"A deprecated alias of `TimeoutError`"*; alias since 3.11.

---

## 10 · The LBYL test that is wrong about its own domain

`https://docs.python.org/3.14/library/stdtypes.html#str.isdigit`

> `str.isdigit()` — *"Return `True` if all characters in the string are digits and there is
> at least one character, `False` otherwise. Digits include decimal characters and digits
> that need special handling, such as the compatibility superscript digits. This covers
> digits which cannot be used to form numbers in base 10, like the Kharosthi numbers.
> Formally, a digit is a character that has the property value Numeric_Type=Digit or
> Numeric_Type=Decimal."*

Docs' own examples, verbatim:

```python
>>> '⅕'.isdigit()   # Vulgar fraction one fifth
False
>>> '²'.isdecimal(), '²'.isdigit(),  '²'.isnumeric()
(False, True, True)
```

> `str.isdecimal()` — *"Return `True` if all characters in the string are decimal
> characters … Decimal characters are those that can be used to form numbers in base 10,
> such as U+0660, ARABIC-INDIC DIGIT ZERO. Formally a decimal character is a character in
> the Unicode General Category "Nd"."*

> `str.isnumeric()` — *"Numeric characters include digit characters, and all characters
> that have the Unicode numeric value property, e.g. U+2155, VULGAR FRACTION ONE FIFTH."*

**Consequence:** `'²'.isdigit()` is `True` while `int('²')` raises `ValueError` — the LBYL
guard passes and the leap fails anyway. Also `'-1'.isdigit()` is `False` for a string
`int()` accepts (no sign character is a digit; that follows from "all characters … are
digits", not from a quote about signs). The doc-safe framing: `isdigit` answers a
**Unicode property** question, `int()` answers a **parsing** question, and they are not
the same question.

---

## 11 · Type checkers — what narrows and what does not

`https://mypy.readthedocs.io/en/stable/type_narrowing.html`

> *"This section is dedicated to several type narrowing techniques which are supported by
> mypy. Type narrowing is when you convince a type checker that a broader type is
> actually more specific, for instance, that an object of type `Shape` is actually of the
> narrower type `Square`."*

The constructs the page documents: `isinstance()`, `issubclass()`, `type(obj) is int`,
`callable()`, `obj is not None`, truthiness, and `assert`.

⚠️ **`try` / `except` is not among them**, and the page does not enumerate what fails to
narrow. So the honest claim is: *the narrowing constructs mypy documents are all
conditions; an `except` handler is not one of them* — not "mypy cannot narrow in a
handler", which the page never says.

---

## What is NOT settled by any source above

- Any **relative** cost of `try` versus `if` beyond the two 3.11 sentences in §7.
- Whether `inspect.getattr_static` raises `AttributeError` on a miss (docs silent).
- Whether `hasattr` swallowed non-`AttributeError` exceptions in some older version —
  the 3.14 page carries no such "Changed in version" note; do not assert one.
- Any claim about `dict` operation atomicity as a **guarantee**; §8's own words are
  *"not a guarantee of current or future behavior"*.

---

## 12 · `queue` — the library disowning its own pre-check

`https://docs.python.org/3.14/library/queue.html`

> `Queue.empty()` — *"Return `True` if the queue is empty, `False` otherwise. If `empty()`
> returns `True` it doesn't guarantee that a subsequent call to `put()` will not block.
> Similarly, if `empty()` returns `False` it doesn't guarantee that a subsequent call to
> `get()` will not block."*

> `Queue.qsize()` — *"Return the approximate size of the queue. Note, `qsize() > 0`
> doesn't guarantee that a subsequent `get()` will not block, nor will `qsize() < maxsize`
> guarantee that `put()` will not block."*

> `Queue.full()` — same double disclaimer, in both directions.

> `Queue.get()` — *"Otherwise (block is false), return an item if one is immediately
> available, else raise the `Empty` exception (timeout is ignored in that case)."*

> `queue.Empty` — *"Exception raised when non-blocking `get()` (or `get_nowait()`) is
> called on a `Queue` object which is empty."*

## 13 · `Counter` — the doc quote, and the one fact only a probe settles

`https://docs.python.org/3.14/library/collections.html#collections.Counter`

> *"Counter objects have a dictionary interface except that they return a zero count for
> missing items instead of raising a `KeyError`"*

> *"Setting a count to zero does not remove an element from a counter. Use `del` to remove
> it entirely"*

⚠️ The docs do **not** say whether reading a missing `Counter` key inserts it. **T1 probe,
installed CPython 3.14.4** (corpus pin 3.14.7, same feature release):
`Counter(['eggs'])['bacon']` returns `0` and leaves `'bacon' in c` **False**, while
`defaultdict(int)['x']` leaves `{'x': 0}` behind. So `Counter` reads without inserting and
`defaultdict` does not — cite it as probed, never as documented.

## 14 · `set` and sequence miss semantics — docstrings, probed 3.14.4

- `set.remove.__doc__` — *"Remove an element from a set; it must be a member. If the
  element is not a member, raise a `KeyError`."*
- `set.discard.__doc__` — *"Remove an element from a set if it is a member. Unlike
  `set.remove()`, the `discard()` method does not raise an exception when an element is
  missing from the set."*
- `set.pop.__doc__` — *"Remove and return an arbitrary set element. Raises `KeyError` if
  the set is empty."*
- `dict.setdefault.__doc__` — *"Insert key with a value of default if key is not in the
  dictionary. Return the value for key if key is in the dictionary, else default."*

`https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations`

> `sequence.index(value)` — *"Raises `ValueError` if value is not found in sequence."*
> `sequence.remove(value, /)` — *"Remove the first item from sequence where
> `sequence[i] == value`. Raises `ValueError` if value is not found in sequence."*
> ⚠️ The `set` section of `stdtypes.html` is past the point where a whole-page fetch
> truncates — that is why the set entries above are docstring probes, not page quotes.

## 15 · PEP 8 — the `try`-width rule, and its own correct/wrong pair

`https://peps.python.org/pep-0008/` (Programming Recommendations) — fetched 2026-09-03
for chunk `06-narrowing-the-try.md`.

> *"Additionally, for all try/except clauses, limit the `try` clause to the absolute
> minimum amount of code necessary. Again, this avoids masking bugs:"*

PEP 8's own example, verbatim including its comments:

```python
# Correct:
try:
    value = collection[key]
except KeyError:
    return key_not_found(key)
else:
    return handle_value(value)

# Wrong:
try:
    # Too broad!
    return handle_value(collection[key])
except KeyError:
    # Will also catch KeyError raised by handle_value()
    return key_not_found(key)
```

🔴 **Load-bearing for the "whose exception is it?" argument:** PEP 8's comment names the
exact defect — *"Will also catch KeyError raised by handle_value()"*. This is the primary
source for the claim that a wide `try` absorbs a callee's bug, and the correct half shows
both repairs at once: the assignment is hoisted out of the leap, and the follow-on work
moves to `else`.

Also relevant to width, same section (already cited in topic 11):

- Language Reference, [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement):
  > *"The optional `else` clause is executed if the control flow leaves the `try` suite,
  > no exception was raised, and no `return`, `continue`, or `break` statement was
  > executed. Exceptions in the `else` clause are not handled by the preceding `except`
  > clauses."*
- Tutorial, [Errors and Exceptions](https://docs.python.org/3.14/tutorial/errors.html):
  > *"It is useful for code that must be executed if the try clause does not raise an
  > exception. The use of the `else` clause is better than adding additional code to the
  > `try` clause because it avoids accidentally catching an exception that wasn't raised
  > by the code being protected by the `try` … `except` statement."*
- [`contextlib.suppress`](https://docs.python.org/3.14/library/contextlib.html#contextlib.suppress):
  > *"As with any other mechanism that completely suppresses exceptions, this context
  > manager should be used only to cover very specific errors where silently continuing
  > with program execution is known to be the right thing to do."*

## 16 · `assert` — why it is not a trust-boundary check (added 2026-09-03, for chunk 05)

Language Reference, [The `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement):

> *"Assert statements are a convenient way to insert debugging assertions into a
> program"*

> *"The simple form, `assert expression`, is equivalent to*
> ```
> if __debug__:
>     if not expression: raise AssertionError
> ```
> *The extended form, `assert expression1, expression2`, is equivalent to*
> ```
> if __debug__:
>     if not expression1: raise AssertionError(expression2)
> ```
> *"*

> *"In the current implementation, the built-in variable `__debug__` is `True` under
> normal circumstances, `False` when optimization is requested (command line option
> `-O`). The current code generator emits no code for an `assert` statement when
> optimization is requested at compile time."*

> *"Assignments to `__debug__` are illegal. The value for the built-in variable is
> determined when the interpreter starts."*

**Load-bearing for chunk 05:** an `assert` is a *conditional* — so it is on mypy's
narrowing list (§11) — but it is compiled out under `-O`, so it can never be the check
that validates untrusted input. Trust-boundary validation must be an `if` that raises;
`assert` is an interior tripwire for a condition the boundary already established.

## 17 · The "zero-cost" MECHANISM — CPython implementation notes (appended 2026-09-03, chunk 07)

`https://github.com/python/cpython/blob/main/InternalDocs/exception_handling.md`
(CPython's own internal implementation notes, **`main` branch**, read 2026-09-03. These
describe CPython's implementation, not a language guarantee, and the branch is ahead of
the 3.14 pin — cite it as an implementation note, never as the language spec.)

Title of the document: *"Zero-Cost Exception Handling in Python"*.

> *"In the common case (where no exception is raised) the cost is reduced to zero (or
> close to zero)."*

> *"The cost of raising an exception is increased, but not by much."*

> *"The exception table is stored in the code object's `co_exceptiontable` field."*

> *"At runtime, when an exception occurs, the interpreter calls
> `get_exception_handler()` in Python/ceval.c to look up the offset of the current
> instruction in the exception table."*

**Why this matters for the cost chunk:** it supplies the *mechanism* the What's New
sentence in §7 only asserts — the handler location lives in a compile-time table
attached to the code object, and that table is consulted **only when an exception
occurs**, so the no-raise path performs no handler bookkeeping. Note the doc's own two
hedges: *"or close to zero"* and *"increased, but not by much"* — neither side is
quantified anywhere, and there is still **no** published comparison of `try` against
`if`. Do not exceed these words.

## 18 · Built-in Exceptions — the breadth of each class you might name

`https://docs.python.org/3.14/library/exceptions.html` — fetched 2026-09-03 for chunk
`06c-the-breadth-of-one-class.md` (the "how wide is this class?" argument).

**`OSError`:**
> *"This exception is raised when a system function returns a system-related error,
> including I/O failures such as "file not found" or "disk full" (not for illegal
> argument types or other incidental errors)."*
> *"The constructor often actually returns a subclass of `OSError`, as described in OS
> exceptions below. The particular subclass depends on the final `errno` value. This
> behaviour only occurs when constructing `OSError` directly or via an alias, and is not
> inherited when subclassing."*
> `errno` — *"A numeric error code from the C variable `errno`."*
> `strerror` — *"The corresponding error message, as provided by the operating system."*
> `filename` / `filename2` — *"For exceptions that involve a file system path (such as
> `open()` or `os.unlink()`), `filename` is the file name passed to the function."*
> *Changed in version 3.3: `EnvironmentError`, `IOError`, `WindowsError`,
> `socket.error`, `select.error` and `mmap.error` have been merged into `OSError`, and
> the constructor may return a subclass.*

🔴 **The 3.3 merge is the load-bearing fact for width:** `socket.error` and `IOError`
are `OSError`, so `except OSError` around a filesystem call also owns every network
failure in the same suite.

**The OS exceptions, verbatim, each with its `errno`:**

| Class | Doc sentence | `errno` |
|---|---|---|
| `BlockingIOError` | *"Raised when an operation would block on an object (e.g. socket) set for non-blocking operation."* | `EAGAIN`, `EALREADY`, `EWOULDBLOCK`, `EINPROGRESS` |
| `ChildProcessError` | *"Raised when an operation on a child process failed."* | `ECHILD` |
| `ConnectionError` | *"A base class for connection-related issues."* | — |
| `BrokenPipeError` | *"A subclass of `ConnectionError`, raised when trying to write on a pipe while the other end has been closed, or trying to write on a socket which has been shutdown for writing."* | `EPIPE`, `ESHUTDOWN` |
| `ConnectionAbortedError` | *"A subclass of `ConnectionError`, raised when a connection attempt is aborted by the peer."* | `ECONNABORTED` |
| `ConnectionRefusedError` | *"A subclass of `ConnectionError`, raised when a connection attempt is refused by the peer."* | `ECONNREFUSED` |
| `ConnectionResetError` | *"A subclass of `ConnectionError`, raised when a connection is reset by the peer."* | `ECONNRESET` |
| `FileExistsError` | *"Raised when trying to create a file or directory which already exists."* | `EEXIST` |
| `FileNotFoundError` | *"Raised when a file or directory is requested but doesn't exist."* | `ENOENT` |
| `InterruptedError` | *"Raised when a system call is interrupted by an incoming signal."* | `EINTR` |
| `IsADirectoryError` | *"Raised when a file operation (such as `os.remove()`) is requested on a directory."* | `EISDIR` |
| `NotADirectoryError` | *"Raised when a directory operation (such as `os.listdir()`) is requested on something which is not a directory. On most POSIX platforms, it may also be raised if an operation attempts to open or traverse a non-directory file as if it were a directory."* | `ENOTDIR` |
| `PermissionError` | *"Raised when trying to run an operation without the adequate access rights - for example filesystem permissions."* | `EACCES`, `EPERM`, `ENOTCAPABLE` |
| `ProcessLookupError` | *"Raised when a given process doesn't exist."* | `ESRCH` |
| `TimeoutError` | *"Raised when a system function timed out at the system level."* | `ETIMEDOUT` |

⚠️ There is **no** documented `OSError` subclass for `ENOSPC` (disk full) — the `OSError`
description names *"disk full"* as an example of what `OSError` covers, and no subclass
maps to it. So "disk full" can only be distinguished by inspecting `errno`, which is
itself an argument for not writing `except OSError` with a data-shaped recovery.

**The other classes named in the width argument:**

> `LookupError` — *"The base class for the exceptions that are raised when a key or index
> used on a mapping or sequence is invalid: `IndexError`, `KeyError`. This can be raised
> directly by `codecs.lookup()`."*

> `IndexError` — *"Raised when a sequence subscript is out of range. (Slice indices are
> silently truncated to fall in the allowed range; if an index is not an integer,
> `TypeError` is raised.)"*

> `KeyError` — *"Raised when a mapping (dictionary) key is not found in the set of
> existing keys."*

> `AttributeError` — *"Raised when an attribute reference (see Attribute references) or
> assignment fails. (When an object does not support attribute references or attribute
> assignments at all, `TypeError` is raised.)"*

> `ValueError` — *"Raised when an operation or function receives an argument that has the
> right type but an inappropriate value, and the situation is not described by a more
> precise exception such as `IndexError`."*

> `Exception` — *"All built-in, non-system-exiting exceptions are derived from this
> class. All user-defined exceptions should also be derived from this class."*

🔴 Note `AttributeError`'s parenthetical: an attribute *assignment* failure is the same
class as a read failure, so `except AttributeError` around a block containing both cannot
tell them apart. And `LookupError` is documented as covering exactly two classes plus a
direct raise from `codecs.lookup()` — which is why it is defensible only when both a
mapping and a sequence lookup in the block are optional in the same way.

---

## 19 · `finally`, the grammar, and ambient state (appended 2026-09-04, for chunks 06f–06h)

🔴 **Do not re-derive.** Every quote below was fetched from the 3.14 docs on 2026-09-04.
⚠️ Heading numbers 15 and 16 are each used twice above; this section is 17 to avoid a third
collision, so the sequence above is not contiguous.

### 17.1 · The `try` statement — matching, order, `finally`

`https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement`

**The matching rule — the load-bearing quote for the whole "whose exception is it" argument.
Note what is absent: no mention of which line, function, module or frame raised.**

> *"When an exception occurs in the `try` suite, a search for an exception handler is
> started. This search inspects the `except` clauses in turn until one is found that matches
> the exception."*

> *"The raised exception matches an `except` clause whose expression evaluates to the class
> or a non-virtual base class of the exception object, or to a tuple that contains such a
> class."*

**The `else` clause:**

> *"The optional `else` clause is executed if the control flow leaves the `try` suite, no
> exception was raised, and no `return`, `continue`, or `break` statement was executed.
> Exceptions in the `else` clause are not handled by the preceding `except` clauses."*

**The grammar (`try1_stmt`)** spells the handler part as **one or more** `except` clauses,
with `["else" ":" suite]` and `["finally" ":" suite]` optional and in that order. Therefore:
`try` / `finally` with no `except` is legal; **`try` / `else` with no `except` is a
`SyntaxError`**. The Tutorial states the ordering rule in prose — the `else` clause *"when
present, must follow all except clauses"*.

**`finally` — the full execution paragraph:**

> *"If `finally` is present, it specifies a 'cleanup' handler. The `try` clause is executed,
> including any `except` and `else` clauses. If an exception occurs in any of the clauses
> and is not handled, the exception is temporarily saved. The `finally` clause is executed.
> If there is a saved exception it is re-raised at the end of the `finally` clause. If the
> `finally` clause raises another exception, the saved exception is set as the context of
> the new exception."*

🔴 *"including any `except` and `else` clauses"* is the sentence that settles the obvious
follow-up question to the `else`-narrowing advice: **`else` narrows what the HANDLERS own,
not what cleanup covers.** `finally` has no width knob at all.

> *"When a `return`, `break` or `continue` statement is executed in the `try` suite of a
> `try`…`finally` statement, the `finally` clause is also executed 'on the way out.'"*

> *"If the `finally` clause executes a `return`, `break` or `continue` statement, the saved
> exception is discarded."*

> *"The return value of a function is determined by the last `return` statement executed.
> Since the `finally` clause always executes, a `return` statement executed in the `finally`
> clause will always be the last one executed."*

The docs ship this function and state it returns `'finally'`:

```python
def foo():
    try:
        return 'try'
    finally:
        return 'finally'
```

> *"Changed in version 3.14: The compiler emits a `SyntaxWarning` when a `return`, `break`
> or `continue` appears in a `finally` block (see PEP 765)."*

### 17.2 · PEP 765 — `https://peps.python.org/pep-0765/`

Title: *"Disallow return/break/continue that exit a finally block"*.

> Abstract: *"This PEP proposes to withdraw support for `return`, `break` and `continue`
> statements that break out of a `finally` block."*

Motivation names **two** behaviours, and the second is the one people miss:

> *"If the `finally` clause executes a `break`, `continue` or `return` statement, exceptions
> are not re-raised."*

> *"If a `finally` clause includes a `return` statement, the returned value will be the one
> from the `finally` clause's `return` statement, not the value from the `try` clause's
> `return` statement."*

> *"CPython will emit a `SyntaxWarning` in version 3.14, and we leave it open whether, and
> when, this will become a `SyntaxError`."*

> *"a `SyntaxError` is permitted by the language spec, so that other Python implementations
> can choose to implement that."*

⚠️ **Not settled by any source:** whether bytecode caching suppresses a repeat emission of a
compile-time `SyntaxWarning`. Pages state the `compileall` form as belt-and-braces rather
than as a documented guarantee: `python -W error::SyntaxWarning -m compileall -q src/`.

### 17.3 · Traceback objects — `https://docs.python.org/3.14/reference/datamodel.html#traceback-objects`

> *"When an exception handler is entered, the stack trace is made available to the program.
> It is accessible as the third item of the tuple returned by `sys.exc_info()`, and as the
> `__traceback__` attribute of the caught exception."*

> `tb_next` — *"The special writable attribute `tb_next` is the next level in the stack trace
> (towards the frame where the exception occurred), or `None` if there is no next level."*

> `tb_frame` — *"Points to the execution frame of the current level."* · `tb_lineno` —
> *"Gives the line number where the exception occurred"*.

Used for the "the traceback knows; the clause does not" argument: the raising frame is
reachable **after** the match, never as part of it.

### 17.4 · `sys.exception` / `sys.exc_info` — `https://docs.python.org/3.14/library/sys.html#sys.exception`

> `sys.exception()` — *"This function, when called while an exception handler is executing
> (such as an `except` or `except*` clause), returns the exception instance that was caught
> by this handler. When exception handlers are nested within one another, only the exception
> handled by the innermost handler is accessible."*

> `sys.exc_info()` — *"If an exception `e` is currently handled (so `exception()` would
> return `e`), `exc_info()` returns the tuple `(type(e), e, e.__traceback__)`."* · *"If no
> exception is being handled anywhere on the stack, this function return a tuple containing
> three `None` values."*

⚠️ **Not settled:** neither entry mentions `finally`. Both are defined in terms of an
*exception handler* (`except` / `except*`). Whether the saved exception inside a `finally`
clause is reported by `sys.exception()` is **not stated by the documentation** — pages say
so explicitly rather than asserting either way.

### 17.5 · `decimal` — the class family, and why raising is ambient

`https://docs.python.org/3.14/library/decimal.html`

> `DecimalException` — *"Base class for other signals and a subclass of `ArithmeticError`."*

🔴 So **no clause naming `ValueError` will ever catch a decimal signal**, however much "that
string is not a number" sounds like a `ValueError`.

**Whether the constructor raises at all is a property of the ambient context:**

> *"The purpose of the context argument is determining what to do if value is a malformed
> string. If the context traps `InvalidOperation`, an exception is raised; otherwise, the
> constructor returns a new Decimal with the value of `NaN`."*

> `DefaultContext` — *"The default values are `Context.prec`=`28`, `Context.rounding`=
> `ROUND_HALF_EVEN`, and enabled traps for `Overflow`, `InvalidOperation`, and
> `DivisionByZero`."*

So `Decimal("abc")` **does** raise `decimal.InvalidOperation` in a process that has not
touched the context — and returns `Decimal('NaN')` silently in one that installed a
narrower `traps` list. A correct guard, a correct class, and nothing raised.

> `BasicContext` — *"All traps are enabled (treated as exceptions) except `Inexact`,
> `Rounded`, and `Subnormal`."*

> *"For each signal there is a flag and a trap enabler. When a signal is encountered, its
> flag is set to one, then, if the trap enabler is set to one, an exception is raised."*

**The context is per-thread — this is the load-bearing fact for a threaded server:**

> *"Each thread has its own current context which is accessed or changed using the
> `getcontext()` and `setcontext()` functions."*

> `localcontext(ctx=None, **kwargs)` — *"Return a context manager that will set the current
> context for the active thread to a copy of ctx on entry to the with-statement and restore
> the previous context when exiting the with-statement. If no context is specified, a copy
> of the current context is used. The kwargs argument is used to set the attributes of the
> new context."* · *"Changed in version 3.11: `localcontext()` now supports setting context
> attributes through the use of keyword arguments."*

So `with localcontext(traps={decimal.InvalidOperation: True}):` is the 3.11+ one-liner, and
a `setcontext()` at import time configures **the importing thread only**.

### 17.6 · `os.access` addendum to §2 above — the identity it actually tests

§2 already banks both notes. It does **not** bank this, and it is a third independent
failure mode alongside "stale" and "wrong permission model":

> *"Use the real uid/gid to test for access to path. Note that most operations will use the
> effective uid/gid, therefore this routine can be used in a suid/sgid environment to test
> if the invoking user has the specified access to path. If effective_ids is `True`,
> `access()` will perform its access checks using the effective uid/gid instead of the real
> uid/gid."*

---

## 20 · Typing and the signature — no checked exceptions, Optional, Never, overloads, sentinels, assert_never (appended 2026-09-04, for chunks 05j–05s)

### 17.1 · PEP 484 § Exceptions — the whole of Python's position on checked exceptions

`https://peps.python.org/pep-0484/#exceptions`

> *"No syntax for listing explicitly raised exceptions is proposed. Currently the only known
> use case for this feature is documentational, in which case the recommendation is to put
> this information in a docstring."*

🔴 **Load-bearing for the whole 05j–05s run.** This is the primary source for "Python has no
checked exceptions" AND for "put it in a `Raises:` docstring" — both sentences, one place.
No checker can compare a call site against what a callee raises, because there is no
declaration.

### 17.2 · `typing.Optional` — and the note everyone misreads

`https://docs.python.org/3.14/library/typing.html#typing.Optional`

> *"`Optional[X]` is equivalent to `X | None` (or `Union[X, None]`)."*

> *"Note that this is not the same concept as an optional argument, which is one that has a
> default. An optional argument with a default does not require the `Optional` qualifier on
> its type annotation just because it is optional."*

Their example: `def foo(arg: int = 0) -> None:` (optional argument, type is plainly `int`).
*Changed in 3.10: Optional can now be written as `X | None`.*

### 17.3 · PEP 604 — the `|` union syntax

`https://peps.python.org/pep-0604/` — **Final, Python-Version 3.10.**

> *"This PEP proposes overloading the `|` operator on types to allow writing `Union[X, Y]` as
> `X | Y`, and allows it to appear in `isinstance` and `issubclass` calls."*

> *"Optional values should be equivalent to the new union syntax: `None | t ==
> typing.Optional[t]`"*

### 17.4 · `typing.Never` / `typing.NoReturn` — the bottom type

`https://docs.python.org/3.14/library/typing.html#typing.Never`

> *"`Never` and `NoReturn` represent the bottom type, a type that has no members."*

> *"They can be used to indicate that a function never returns, such as `sys.exit()`."*

> *"`Never` and `NoReturn` have the same meaning in the type system and static type checkers
> treat both equivalently."*

The docs' own parameter-position example (this is why `assert_never` works):

```python
def never_call_me(arg: Never) -> None:
    pass

def int_or_str(arg: int | str) -> None:
    never_call_me(arg)  # type checker error
    match arg:
        case int():
            print("It's an int")
        case str():
            print("It's a str")
        case _:
            never_call_me(arg)  # OK, arg is of type Never (or NoReturn)
```

*Added in 3.6.2: `NoReturn`. Added in 3.11: `Never`.*

### 17.5 · `typing.assert_never` — exhaustiveness

`https://docs.python.org/3.14/library/typing.html#typing.assert_never`

> *"Ask a static type checker to confirm that a line of code is unreachable."*

> *"If a type checker finds that a call to `assert_never()` is reachable, it will emit an
> error. For example, if the type annotation for `arg` was instead `int | str | float`, the
> type checker would emit an error pointing out that `unreachable` is of type `float`. For a
> call to `assert_never` to pass type checking, the inferred type of the argument passed in
> must be the bottom type, `Never`, and nothing else."*

> *"At runtime, this throws an exception when called."*

*Added in 3.11.* See-also link on the page:
`https://typing.python.org/en/latest/guides/unreachable.html`

🔴 It is a **function call**, not the `assert` statement — so it is **not** removed under
`-O`, unlike `assert`. That contrast is the load-bearing one against `assert False`.

### 17.6 · `@typing.overload`

`https://docs.python.org/3.14/library/typing.html#typing.overload`

> *"The `@overload` decorator allows describing functions and methods that support multiple
> different combinations of argument types. A series of `@overload`-decorated definitions
> must be followed by exactly one non-`@overload`-decorated definition (for the same
> function/method)."*

> *"`@overload`-decorated definitions are for the benefit of the type checker only, since
> they will be overwritten by the non-`@overload`-decorated definition. The
> non-`@overload`-decorated definition, meanwhile, will be used at runtime but should be
> ignored by a type checker. At runtime, calling an `@overload`-decorated function directly
> will raise `NotImplementedError`."*

*Changed in 3.11: overloaded functions can now be introspected at runtime.*

### 17.7 · typeshed's `dict.get` — the canonical overload set

`https://github.com/python/typeshed/blob/main/stdlib/builtins.pyi` (read 2026-09-04,
`class dict` begins line 1289):

```python
    # Positional-only in dict, but not in MutableMapping
    @overload  # type: ignore[override]
    def get(self, key: _KT, default: None = None, /) -> _VT | None: ...
    @overload
    def get(self, key: _KT, default: _VT, /) -> _VT: ...
    @overload
    def get(self, key: _KT, default: _T, /) -> _VT | _T: ...
```

Order is load-bearing: overloads match top-down, so the `default: None = None` form must lead.
`d.get(k)` → `_VT | None`; `d.get(k, 0)` → `_VT` (**no narrowing required**);
`d.get(k, "n/a")` → `_VT | str`.

### 17.8 · PEP 661 — Sentinel Values. 🔴 **Final, Python-Version 3.15** (resolution 23-Apr-2026)

`https://peps.python.org/pep-0661/` — **NOT available on 3.14.** The PEP page now says the
canonical documentation is the `sentinel` docs.

Motivation, the three drawbacks of `_sentinel = object()`:

> *"Some do not have a distinct type, hence it is impossible to define clear type signatures
> for functions with such sentinels as default values."*

> *"They behave unexpectedly after being copied, due to a separate instance being created and
> thus comparisons using `is` failing. Some common sentinel idioms have similar problems after
> being pickled and unpickled."*

> *"However, this object has an uninformative and overly verbose repr, causing the function's
> signature to be overly long and hard to read"*

Specification:

> *"`sentinel()` takes a single required positional-only argument, `name`, which must be a
> `str`, and an optional keyword-only argument, `repr`."*

> *"Each call to `sentinel(name)` returns a new sentinel object."*

> *"Checking if a value is such a sentinel should be done using the `is` operator, as is
> recommended for `None`."*

> *"Sentinel objects are 'truthy', i.e. boolean evaluation will result in `True`. This
> parallels the default for arbitrary classes, as well as the boolean value of `Ellipsis`.
> This is unlike `None`, which is 'falsy'."*

> *"Creating a copy of a sentinel object, such as by using `copy.copy()` or by
> `copy.deepcopy()`, will return the same object."*

Typing section:

> *"Sentinel objects may be used in type expressions, representing themselves. This is similar
> to how `None` is handled in the existing type system."*

> *"Type checkers should support narrowing union types involving sentinels using the `is` and
> `is not` operators."*

Rejected idea — why NOT `Literal["MISSING"]`:

> *"However, it was pointed out that this would cause potential confusion, due to e.g.
> `Literal["MISSING"]` referring to the string value `"MISSING"` rather than being a
> forward-reference to a sentinel value `MISSING`."*

Additional note:

> *"To define multiple, related sentinel values, possibly with a defined ordering among them,
> one should instead use `Enum` or something similar."*

⚠️ **On 3.14 the workaround that types is a single-member `enum.Enum` + `typing.Literal`** —
`Literal[_Sentinel.UNSET]`. That is a community idiom, **not** documented in the 3.14 library
reference; how thoroughly a given checker narrows it is that checker's behaviour, not a
language guarantee. Do not assert it as documented.

### 17.9 · `str.find` / `str.index` / `re.search` — in-band vs out-of-band sentinels

`https://docs.python.org/3.14/library/stdtypes.html#str.find`

> *"Return the lowest index in the string where substring sub is found within the slice
> `s[start:end]`. Optional arguments start and end are interpreted as in slice notation.
> Return `-1` if sub is not found."*

The note directly under it:
> *"The `find()` method should be used only if you need to know the position of sub. To check
> if sub is a substring or not, use the `in` operator"*

> `str.index` — *"Like `find()`, but raise `ValueError` when the substring is not found."*

`https://docs.python.org/3.14/library/re.html#re.search`
> *"Scan through string looking for the first location where the regular expression pattern
> produces a match, and return a corresponding `Match`. Return `None` if no position in the
> string matches the pattern; note that this is different from finding a zero-length match at
> some point in the string."*

🔴 The whole argument: `find` is typed `-> int`, so `-1` is **inside** the success type and no
checker can force a test; `search` is typed `Match[str] | None`, so it can.

### 17.10 · `warnings` — DeprecationWarning is ignored by default

`https://docs.python.org/3.14/library/warnings.html#warning-categories`

> *"`DeprecationWarning` — Base category for warnings about deprecated features when those
> warnings are intended for other Python developers (ignored by default, unless triggered by
> code in `__main__`)."*

Signature (for `stacklevel`):
`warnings.warn(message, category=None, stacklevel=1, source=None, *, skip_file_prefixes=())`

⚠️ There is **no** `#default-warning-filters` anchor on the 3.14 page; the categories section
anchor is `#warning-categories`.

### 17.11 · PEP 561 — `py.typed`, why an unmarked package's annotations are invisible

`https://peps.python.org/pep-0561/#packaging-type-information`

> *"Package maintainers who wish to support type checking of their code MUST add a marker file
> named `py.typed` to their package supporting typing. This marker applies recursively: if a
> top-level package includes it, all its sub-packages MUST support type checking as well."*

### 17.12 · mypy — exhaustiveness checking (checker documentation, NOT the language)

`https://mypy.readthedocs.io/en/stable/literal_types.html`

Works for `Literal` unions, `Enum` members and `match`. Documented error text, quotable
inline: `Argument 1 to "assert_never" has incompatible type "Direction"; expected "NoReturn"`.

> *"For match statements specifically, inexhaustive matches can be caught without needing to
> use `assert_never` by using `--enable-error-code exhaustive-match`."*

⚠️ mypy narrows enum members on **`is`**, not `==` — its own counter-example uses
`direction == Direction.up` and produces the error above.

---

## What §20 could NOT settle (do not assert these)

- **Whether a specific checker other than mypy** narrows `Literal[EnumMember]` sentinels or
  `if/elif` `isinstance` ladders for `assert_never`. mypy documents its own behaviour; the
  language reference does not specify any of it. Write it as "check the checker your CI runs".
- **Any claim that "mypy cannot narrow inside an `except` handler"** — see §11; the page lists
  what *does* narrow, never what fails to.
- **Whether `python -O` affects `assert_never`** is not stated anywhere as such; it follows
  from `assert_never` being a *function call* rather than the `assert` statement (the `assert`
  removal under `-O` is documented). Present it as the mechanism, not as a doc quote.
- **Any runtime cost comparison** between a union return, a raise and a `None` return. Nothing
  measures it and there is no sandbox.

## 21 · The `with` statement and `contextlib` (appended 2026-09-08, for chunks 06o–06q)

🔴 **Do not re-derive.** Fetched from the 3.14 docs on 2026-09-08.

### 21.1 · The seven execution steps — `https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement`

> *"1. The context expression (the expression given in the `with_item`) is evaluated to
> obtain a context manager. 2. The context manager's `__enter__()` is loaded for later use.
> 3. The context manager's `__exit__()` is loaded for later use. 4. The context manager's
> `__enter__()` method is invoked. 5. If a target was included in the `with` statement, the
> return value from `__enter__()` is assigned to it. 6. The suite is executed. 7. The context
> manager's `__exit__()` method is invoked."*

🔴 **Steps 2 and 3 are LOOKUPS and they precede the step-4 call.** So a manager missing
`__exit__` fails before `__enter__` acquires anything, and an `__exit__` reassigned during
the suite is not the one that runs. Neither fact is stated in prose anywhere — both come
only from the numbered order.

**The guarantee, a Note attached to step 5:**

> *"The `with` statement guarantees that if the `__enter__()` method returns without an
> error, then `__exit__()` will always be called. Thus, if an error occurs during the
> assignment to the target list, it will be treated the same as an error occurring within
> the suite would be. See step 7 below."*

🔴 The second sentence is the boundary: a raise **inside `__enter__` (step 4)** leaks;
a raise **assigning the `as` target (step 5)** does not — that one gets cleanup.

**Step 7, all three paragraphs. The third is the one pages stop short of:**

> *"The context manager's `__exit__()` method is invoked. If an exception caused the suite
> to be exited, its type, value, and traceback are passed as arguments to `__exit__()`.
> Otherwise, three `None` arguments are supplied."*

> *"If the suite was exited due to an exception, and the return value from the `__exit__()`
> method was false, the exception is reraised. If the return value was true, the exception is
> suppressed, and execution continues with the statement following the `with` statement."*

> *"If the suite was exited for any reason other than an exception, the return value from
> `__exit__()` is ignored, and execution proceeds at the normal location for the kind of exit
> that was taken."*

🔴 **Therefore a truthy `__exit__` is NOT equivalent to a `return` in a `finally`.** It is
consulted only on the exception path; it cannot discard a `return`, `break` or `continue`,
and it cannot replace a return value. The `finally` jump is strictly wider. Any page equating
the two defects is wrong, and one did until 2026-09-08.

**Multi-item:**

> *"With more than one item, the context managers are processed as if multiple `with`
> statements were nested"* … `with A() as a, B() as b:` is *"semantically equivalent to"*
> `with A() as a:` containing `with B() as b:`.

> *"Changed in version 3.1: Support for multiple context expressions."* ·
> *"Changed in version 3.10: Support for using grouping parentheses to break the statement in
> multiple lines."*

### 21.2 · `contextlib` — `https://docs.python.org/3.14/library/contextlib.html`

**`@contextmanager` — the re-raise obligation, verbatim:**

> *"At the point where the generator yields, the block nested in the `with` statement is
> executed. The generator is then resumed after the block is exited. If an unhandled exception
> occurs in the block, it is reraised inside the generator at the point where the yield
> occurred. Thus, you can use a `try`…`except`…`finally` statement to trap the error (if any),
> or ensure that some cleanup takes place. If an exception is trapped merely in order to log it
> or to perform some action (rather than to suppress it entirely), the generator must reraise
> that exception. Otherwise the generator context manager will indicate to the `with` statement
> that the exception has been handled, and execution will resume with the statement immediately
> following the `with` statement."*

**`closing` — the doc's own equivalent implementation:**

> *"Return a context manager that closes thing upon completion of the block. This is basically
> equivalent to:"*
```python
from contextlib import contextmanager

@contextmanager
def closing(thing):
    try:
        yield thing
    finally:
        thing.close()
```
> *"…without needing to explicitly close `page`. Even if an error occurs, `page.close()` will
> be called when the `with` block is exited."*

**`ExitStack`:**

> *"A context manager that is designed to make it easy to programmatically combine other
> context managers and cleanup functions, especially those that are optional or otherwise
> driven by input data."*

> *"Since registered callbacks are invoked in the reverse order of registration, this ends up
> behaving as if multiple nested `with` statements had been used with the registered set of
> callbacks."*

**`suppress`:**

> *"Return a context manager that suppresses any of the specified exceptions if they occur in
> the body of a `with` statement and then resumes execution with the first statement following
> the end of the `with` statement."*

> *"As with any other mechanism that completely suppresses exceptions, this context manager
> should be used only to cover very specific errors where silently continuing with program
> execution is known to be the right thing to do."*

### What §21 could NOT settle (do not assert these)

- The `object.__enter__` / `object.__exit__` datamodel entries were **not** retrieved — the
  page truncated before that section. In particular the often-quoted *"should not reraise the
  passed-in exception"* line is **NOT banked** and must not be quoted until someone fetches
  `https://docs.python.org/3.14/reference/datamodel.html#with-statement-context-managers`.
- Whether `with (A(), B()):` — parentheses, no `as` — parses as two context managers or as a
  tuple, and in which versions. The reference documents only the `as`-bearing parenthesised
  form. Not asserted anywhere.

---

## 22 · `contextlib`'s unbanked members, `-O`/PEP 488, and warning filters (appended 2026-09-10, for chunks 06q–06zc, 06m/06s, 06t/06u)

Four parallel authoring agents paid to fetch these. §21 banks `@contextmanager`, `closing`,
`ExitStack`'s purpose and reverse-order sentence, and `suppress` — it banks **none** of the
members below, which is why they were fetched again. Bank them so nobody pays a third time.

### 22.1 `contextlib` — the members §21 does not cover
Source: https://docs.python.org/3.14/library/contextlib.html

- Single use: > *"Context managers created using `@contextmanager` are also single use context managers, and will complain about the underlying generator failing to yield if an attempt is made to use them a second time"*
- One yield: > *"This iterator must yield exactly one value, which will be bound to the targets in the `with` statement's `as` clause, if any."*
- `ContextDecorator`: > *"A base class that enables a context manager to also be used as a decorator."* · > *"`__exit__` retains its optional exception handling even when used as a decorator."* · > *"`ContextDecorator` is used by `@contextmanager`, so you get this functionality automatically."*
- `enter_context`: > *"The return value is the result of the context manager's own `__enter__()` method."* · > *"These context managers may suppress exceptions just as they normally would…"*
- `callback`: > *"Unlike the other methods, callbacks added this way cannot suppress exceptions (as they are never passed the exception details)."*
- `push`: > *"As `__enter__` is not invoked, this method can be used to cover part of an `__enter__()` implementation with a context manager's own `__exit__()` method."* · > *"By returning true values, these callbacks can suppress exceptions the same way context manager `__exit__()` methods can."*
- `pop_all`: > *"Transfers the callback stack to a fresh `ExitStack` instance and returns it. No callbacks are invoked by this operation…"*
- `close`: > *"For any context managers and exit callbacks registered, the arguments passed in will indicate that no exception occurred."*
- `nullcontext`: > *"Return a context manager that returns enter_result from `__enter__()`, but otherwise does nothing."*
- Reusable: > *"…will fail (or otherwise not work correctly) if the specific context manager instance has already been used in a containing with statement."* · Reentrant: > *"…may also be used inside a `with` statement that is already using the same context manager"*, examples `threading.RLock`, `suppress()`, `redirect_stdout()`, `chdir()`
- `closing` Note: > *"`closing()` is most useful for third party types that don't support context managers."*

### 22.2 `except*` / `ExceptionGroup`
Reference https://docs.python.org/3.14/reference/compound_stmts.html#except-star · PEP 654 · https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup

- > *"A `try` statement can have either `except` or `except*` clauses, but not both."*
- > *"The exception type for matching is mandatory in the case of `except*`, so `except*:` is a syntax error."*
- > *"A `TypeError` is raised if a matching type is a subclass of `BaseExceptionGroup`, because that would have ambiguous semantics."*
- > *"After all `except*` clauses execute, the group of unhandled exceptions is merged with any exceptions that were raised or re-raised from within `except*` clauses. This merged exception group propagates on."*
- > *"An expression-less `except` clause, if present, must be last; it matches any exception."*
- The two-class design sentence ending > *"This design is so that `except Exception` catches an `ExceptionGroup` but not `BaseExceptionGroup`."*; `split()` → > *"returns the pair `(match, rest)`"*
- PEP 654: > *"`continue`, `break`, and `return` are disallowed in `except*` clauses, causing a `SyntaxError`. This is because the exceptions in an `ExceptionGroup` are assumed to be independent, and the presence or absence of one of them should not impact handling of the others, as could happen if we allow an `except*` clause to change the way control flows through other clauses."*

### 22.3 `-O`, `__debug__`, PEP 488 and the bytecode cache
https://docs.python.org/3.14/using/cmdline.html#cmdoption-O · https://docs.python.org/3.14/library/constants.html · https://peps.python.org/pep-0488/ · https://docs.python.org/3.14/reference/import.html#pyc-invalidation · https://docs.python.org/3.14/library/compileall.html · https://docs.python.org/3.14/library/sys.html#sys.flags

- `-O`: > *"Remove assert statements and any code conditional on the value of `__debug__`. Augment the filename for compiled (bytecode) files by adding `.opt-1` before the `.pyc` extension (see PEP 488)."* · `-OO`: > *"Do `-O` and also discard docstrings."*
- `__debug__`: > *"This constant is true if Python was not started with an `-O` option."* · > *"cannot be reassigned (assignments to them, even as an attribute name, raise `SyntaxError`)"*
- PEP 488: > *"'{name}.{cache_tag}.opt-{optimization}.pyc'.format(…)"* · > *"When no optimization level is specified, the pre-PEP `.pyc` file name will be used"* · > *"the import system looks for a single bytecode file based on the optimization level of the interpreter already…"* · bytecode-only distributors > *"will have to choose which optimization level they want their bytecode files to be"*
- Import reference: > *"For unchecked hash-based `.pyc` files, Python simply assumes the cache file is valid if it exists."*
- `compileall -o`: > *"May be used multiple times to compile for multiple levels at a time (for example, `compileall -o 1 -o 2`)."*
- `sys.flags`: > *"The named tuple flags exposes the status of command line flags"*; `flags.optimize` ↔ > *"`-O` or `-OO`"*
- `importlib.util.cache_from_source`: > *"`None` causes the interpreter's optimization level to be used"*
- doctest: > *"The module docstring, and all function, class and method docstrings are searched."* · Click: > *"For commands, the docstring of the function is automatically used if provided."*

### 22.4 Warning filters
https://docs.python.org/3.14/library/warnings.html · https://docs.python.org/3.14/using/cmdline.html#cmdoption-W

- `filterwarnings`: > *"The entry is inserted at the front by default; if append is true, it is inserted at the end. … Entries closer to the front of the list override entries later in the list."*
- `resetwarnings`: > *"This discards the effect of all previous calls to `filterwarnings()`, including that of the `-W` command line options and calls to `simplefilter()`."*
- `-W`: > *"Multiple `-W` options can be given; when a warning matches more than one option, the action for the last matching option is performed. Invalid `-W` options are ignored."*
- 3.14 concurrency: > *"The behavior of `catch_warnings` … depends on the `sys.flags.context_aware_warnings` flag. … The flag defaults to true for free-threaded builds and false otherwise."* · > *"When record is true and the flag is true … the `showwarning()` function will not be restored when exiting the context handler."*
- `SyntaxWarning`: > *"typically emitted when compiling Python source code, and hence may not be suppressed by runtime filters"*

### 22.5 `decimal`
- `ExtendedContext`: > *"No traps are enabled (so that exceptions are not raised during computations)"*
- `DefaultContext`: > *"Changing one of the fields before threads are started has the effect of setting system-wide defaults."*
- `create_decimal`: > *"Unlike the `Decimal` constructor, the context precision, rounding method, flags, and traps are applied to the conversion."*

### 🔴 What §22 could NOT settle — do not assert these

1. **The `message` field of `-W`.** The two doc pages contradict each other. `warnings` says
   > *"`message` is a literal string that the start of the warning message must contain (case-insensitively)"*; `cmdline` says > *"The message field must match the whole warning message"*.
   pytest's docs side with `warnings`. **Unresolved.** `06t` states the disagreement openly and
   advises putting message-matching in `filterwarnings()`.
2. **`PYTHONOPTIMIZE=0`.** The docs give two rules with opposite outcomes for `"0"` — a
   non-empty string implies `-O`; an integer means `-O` that many times. **Unresolved**; the
   advice is to unset the variable rather than set it to `0`.
3. **`-OO` and doctest.** The doctest page never mentions `-OO`. Stated only as the consequence
   of two quoted sentences, and flagged as such.
4. **What `__doc__` holds under `-OO`.** Docs say only *"discard docstrings"*. Never claim it
   becomes `None`.
5. **Whether a normal run elides `if not __debug__:` blocks.** Not documented; not claimed.
6. **When the `BaseExceptionGroup`-subclass `TypeError` fires.** The reference states the rule
   but never says at what point. Written as a runtime failure at match time, by inference,
   flagged as mechanism in prose and never quoted as doc text.
7. **What a generator that yields twice raises.** Contract is *"must yield exactly one value"*;
   the exception type and message are not confirmed. Do not write a test asserting on it.
8. **`ContextDecorator`'s `_recreate_cm` mechanism.** Only the documented facts are used.
9. **`-W error::SyntaxWarning -m compileall`** — no source settles whether bytecode caching
   suppresses a repeat compile-time `SyntaxWarning`. Written as a fix to apply, never as a
   documented guarantee.
10. **§21's ban still stands**: the `object.__enter__`/`__exit__` datamodel section was never
    retrieved, so *"should not reraise the passed-in exception"* remains unbanked. Verified
    absent from all 2,133 lines of the contextlib chapter.
