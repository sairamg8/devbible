---
title: "Where the gap opens: return contracts, `dict.get`, default arguments, and the sentinel pattern"
sidebar_label: "2b · Where the gap opens"
sidebar_position: 54
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get),
> [`hasattr`](https://docs.python.org/3.14/library/functions.html#hasattr),
> [`dataclasses.MISSING`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.MISSING),
> [`inspect.Parameter.empty`](https://docs.python.org/3.14/library/inspect.html#inspect.Parameter.empty),
> [`argparse`](https://docs.python.org/3.14/library/argparse.html)
> and [`functools`](https://docs.python.org/3.14/library/functools.html).
> Target: **CPython 3.14**.

**The principle is one line — establish existence, then ask about emptiness —
and it is easy to agree with and easy to forget, because the gap opens in
specific places and each looks different. This chunk covers three of them: a
function with two return shapes, a `dict.get` that cannot tell absent from null,
and a default argument standing in for "not supplied". Then the pattern that
handles the case `None` cannot: a private sentinel, which the standard library
uses in at least four places under four different names.**

## 1. A function that returns `None` on one path and a container on another

```python
def find_tags(post_id):
    row = db.fetch(post_id)
    if row is None:
        return None            # no such post
    return row.tags            # may legitimately be []
```

The caller who writes `if find_tags(pid):` cannot distinguish "no such post"
from "a post with no tags". Three honest options, and the job is to pick one per
function and hold it:

```python
# a) always a list; missing is exceptional
def find_tags(post_id: int) -> list[str]:
    row = db.fetch(post_id)
    if row is None:
        raise PostNotFound(post_id)
    return row.tags

# b) None means missing, documented and annotated
def find_tags(post_id: int) -> list[str] | None:
    """Return the post's tags, or None if there is no such post."""

# c) return both facts, so the caller cannot ignore one
def find_tags(post_id: int) -> tuple[bool, list[str]]:
    """(found, tags) — tags is [] when found is False."""
```

Option (a) is usually right for an internal lookup where the caller controls the
id; (b) for a lookup where "not found" is routine; (c) when the caller genuinely
needs both facts and you want the type system to force the unpack. **`None` and
the "no result" contract** *(not written yet)*, later in this phase, is the full
treatment.

What makes this the root shape is that the ambiguity is created *inside* the
function and every caller inherits it. Fixing it at one call site fixes one bug;
fixing the contract fixes all of them.

## 2. `dict.get()` collapsing "absent key" into "value is None"

```python
config.get("timeout")     # None — but is the key absent, or set to null?
```

`dict.get` returns the default (which is `None` if you do not pass one) for a
missing key, and it also returns `None` for a key whose value *is* `None`. When
that difference matters, use a private sentinel or ask directly:

```python
_MISSING = object()

value = config.get("timeout", _MISSING)
if value is _MISSING:
    ...           # the key was not supplied at all
elif value is None:
    ...           # the key was supplied as null — an explicit "no timeout"

# or, when you only need the boolean:
if "timeout" in config:
    ...
```

`in` is the cheapest form and reads best. The sentinel form wins when you need
the value *and* the presence in one lookup — `in` followed by `[...]` hashes the
key twice, which matters inside a hot loop or when the key is expensive to hash.

The same distinction exists for attributes: `getattr(obj, "x", _MISSING)` versus
`hasattr(obj, "x")`. `hasattr` is documented as being implemented by calling
`getattr` and catching `AttributeError`, which is why a `property` whose getter
raises `AttributeError` for an unrelated reason reports as *absent* rather than
as broken.

## 3. A default argument of `None` standing in for "not supplied"

```python
def search(query, limit=None, tags=None):
    if limit is None:
        limit = 50               # correct — a limit of 0 stays 0
    if tags is None:
        tags = []                # correct — a caller-supplied [] stays []
```

Written with truthiness, both defaults silently override legitimate input:
`if not limit: limit = 50` turns a deliberate `limit=0` into 50, and
`if not tags: tags = []` is harmless only by accident. The `None`-sentinel form
is also the fix for the mutable-default trap — **Assignment semantics and
aliasing** *(not written yet)* owns that half of the story.

## The sentinel pattern: when `None` is itself a legitimate value

```python
_UNSET = object()

def update_profile(user, bio=_UNSET):
    if bio is not _UNSET:
        user.bio = bio          # includes bio=None, meaning "clear it"
```

`object()` is the standard spelling because every instance is unique, it is
cheap, and `is` against it can never accidentally match a caller's value. Give
it a leading underscore and keep it module-private; a sentinel that leaks into a
public API becomes something callers have to import and compare against.

The stdlib does exactly this in several places, and knowing the names is worth
more than knowing the pattern:

| Sentinel | Where | What it marks |
|---|---|---|
| `dataclasses.MISSING` | `dataclasses` | Documented as *"a sentinel value signifying a missing default or default_factory"* |
| `inspect.Parameter.empty` | `inspect.signature` | A parameter with no default, or no annotation |
| `argparse.SUPPRESS` | `argparse` | Makes an unsupplied argument **absent from the namespace** rather than present-and-`None` |
| `functools.Placeholder` | `functools.partial` (3.14) | A positional slot to be filled by a later call |

`argparse.SUPPRESS` is the instructive one for this topic: it is the standard
library choosing "the attribute does not exist" over "the attribute is `None`",
precisely so that `hasattr(args, "x")` can answer a question `args.x is None`
cannot.

### Making a sentinel the type checker understands

A bare `object()` is typed as `object`, so `x is not _UNSET` narrows nothing and
a checker still believes `bio` might be an `object`. The form the typing
community settled on is a single-member enum, which checkers *do* narrow on:

```python
from enum import Enum

class _Unset(Enum):
    token = 0

UNSET = _Unset.token

def update_profile(user, bio: str | None | _Unset = UNSET) -> None:
    if bio is not UNSET:
        user.bio = bio          # checker knows: str | None here
```

It also gives you a readable repr in a traceback, where `<object object at
0x7f…>` tells you nothing.

## Gotchas

**Symptom — `d.get(key)` returns `None` and you cannot tell whether the key was
missing.** Cause: `dict.get` returns its default for an absent key and also
returns a stored `None`. Fix: `_MISSING = object()` and `d.get(key, _MISSING)`,
or `if key in d:` when you do not need the value.

**Symptom — a caller passes `None` to mean "clear this" and it is ignored.**
Cause: the parameter defaults to `None`, so "clear it" and "not supplied" are
the same value. Fix: a private `_UNSET = object()` sentinel as the default, and
test `is not _UNSET`. This is the one case where `None` is genuinely not enough.

**Symptom — `hasattr(obj, "x")` returns `False` for an attribute that plainly
exists.** Cause: `hasattr` is implemented by calling `getattr` and catching
`AttributeError`, so a `property` whose getter raises `AttributeError` for an
unrelated reason — a missing dependency, a typo inside the getter — reports as
absent. Fix: `getattr(obj, "x", _MISSING)` when you want the value anyway, and
never let an unrelated `AttributeError` escape a property getter.

**Symptom — a type checker will not narrow on your sentinel.** Cause: a bare
`_UNSET = object()` is typed as `object`, so `x is not _UNSET` tells the checker
nothing. Fix: use a single-member `Enum` (`class _Unset(Enum): token = 0`),
which checkers do narrow on, and include it in the parameter's annotated union.

**Symptom — an `argparse` option you did not pass is present in the namespace as
`None`, and `None` is a valid value for it.** Cause: unsupplied options default
to `None` unless told otherwise. Fix: `default=argparse.SUPPRESS`, which leaves
the attribute off the namespace entirely so `hasattr` can answer the question.

**Symptom — a config merge overwrites good values with `None`.** Cause: the
merge iterates over every key of the incoming dict, including keys the user
never set, which the parser filled in with `None`. Fix: build the incoming dict
from only the keys actually supplied (`exclude_unset`, `SUPPRESS`, or a sentinel
default) before merging.

**Symptom — a sentinel comparison intermittently matches a real value.** Cause:
the sentinel is a string or a small int (`_UNSET = "__unset__"`, `_UNSET = -1`)
and the comparison is `==` rather than `is`. Fix: `object()` or a single-member
enum, and always `is`. Small ints and short strings are additionally subject to
CPython caching, which makes `is` *appear* to work in the REPL and fail
elsewhere.

**Symptom — a public function's sentinel default shows up in generated
documentation as `<object object at 0x…>`.** Cause: `object()` has no useful
repr. Fix: the single-member enum form, or a tiny class with `__repr__`
returning something like `<UNSET>`. Cosmetic until someone has to read a
traceback at 3am.

**Symptom — `inspect.signature(f).parameters["x"].default is None` is `True` for
a parameter with no default at all.** Cause: you compared against `None` rather
than the documented marker. Fix: compare against `inspect.Parameter.empty`,
which is what `inspect` uses precisely because `None` is a legal default.

## Interview questions

**★ Q: Why is `def f(x, opts=None)` followed by `if opts is None: opts = {}` better than `if not opts: opts = {}`?**
Because a caller who deliberately passes an empty dict, or a falsy-but-valid
value, gets it replaced under the truthiness form. `is None` distinguishes "not
supplied" from "supplied as empty". It is also the fix for the mutable-default
trap, since the empty dict is now created per call rather than once at
definition time.

**★ Q: When is `None` not good enough as "not supplied"?**
When `None` is itself a legitimate value the caller might send — clearing a
field, an explicitly unlimited timeout, a nullable column being set to null.
Then you need a private sentinel: `_UNSET = object()`. The stdlib does exactly
this with `dataclasses.MISSING`, `inspect.Parameter.empty` and
`argparse.SUPPRESS`.

**Q: `d.get("k")` returned `None`. Was the key missing?**
Cannot tell. `dict.get` returns its default for an absent key, and a stored
`None` is also `None`. Use `"k" in d`, or `d.get("k", sentinel)` with a private
`sentinel = object()`, when the difference matters.

**Q: Why `object()` for a sentinel rather than a string like `"__UNSET__"`?**
Because `object()` is guaranteed unique — no caller can accidentally pass a
value that compares `is` to it. A string sentinel can collide with real data,
and a comparison against it usually gets written as `==` rather than `is`, which
makes the collision easier. For type-checker narrowing, a single-member `Enum` is
the modern refinement of the same idea.

**Q: What does `argparse.SUPPRESS` do, and why does it exist?**
It leaves an unsupplied argument off the namespace entirely rather than setting
it to `None`. It exists precisely because "absent" and "present as `None`" are
different, and with `SUPPRESS` you can ask `hasattr(args, "x")` — a question
`args.x is None` cannot answer when `None` is also a valid supplied value.

**Q: Why can `hasattr` lie?**
Because it is implemented as `getattr` in a `try` that swallows
`AttributeError`. A property whose getter raises `AttributeError` for an
unrelated reason — a typo, a missing dependency — is reported as absent. Any
`AttributeError` escaping a property getter turns into a false "no such
attribute" somewhere else in the program.

**Q: A function can return "not found" or "found but empty". What are your options?**
Three: raise for not-found and always return a container; return `None` for
not-found and annotate `T | None`; or return both facts as a tuple the caller
must unpack. Pick one per function and document it — the bug is not any of the
three, it is having two of them in the same codebase for the same kind of
lookup.

**Q: How does `inspect` mark "this parameter has no default"?**
With `inspect.Parameter.empty`, not with `None` — because `None` is a perfectly
common actual default. It is the same sentinel reasoning applied inside the
standard library, and comparing against `None` instead is a real bug in
signature-introspecting code.

---

← Prev: [Empty versus missing](02-empty-versus-missing.md) · Index: [Truthiness](README.md) · Next → [Tri-states and the API boundary](02c-tri-states-and-the-api-boundary.md)
