---
title: "Picking a no-result contract: `None`, empty, or raise — and meaning it"
sidebar_label: "2 · Picking a contract"
sidebar_position: 141
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`typing.Optional`](https://docs.python.org/3.14/library/typing.html#typing.Optional),
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get),
> [`re.search`](https://docs.python.org/3.14/library/re.html#re.search),
> [`json`](https://docs.python.org/3.14/library/json.html),
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html),
> and [PEP 484](https://peps.python.org/pep-0484/), [PEP 604](https://peps.python.org/pep-0604/).
> Target: **CPython 3.14**.

**A function that might not have an answer has exactly three honest options:
return `None`, return an empty container, or raise. All three are correct; what
is not correct is having two of them in the same codebase for the same kind of
question, or picking one by accident. The standard library itself uses all
three deliberately — `dict.get` returns `None`, `re.findall` returns `[]`,
`dict[key]` raises `KeyError` — and each choice tells the caller something.
Pick one per function, annotate it, and mean it.**

## The three contracts

```python
# 1. return None — "there may be no answer, and that is ordinary"
def find_user(user_id: int) -> User | None:
    return db.get(user_id)

# 2. return empty — "the answer is a collection; it may have nothing in it"
def find_users(role: str) -> list[User]:
    return db.query(role)          # [] when nobody matches

# 3. raise — "not finding it is exceptional and the caller cannot continue"
def get_user(user_id: int) -> User:
    user = db.get(user_id)
    if user is None:
        raise UserNotFound(user_id)
    return user
```

The choice is not arbitrary. Each says something different about how *normal*
the empty case is.

| Contract | Use when | The caller must |
|---|---|---|
| `T \| None` | Absence is routine and the caller will branch on it | Test `is None` — a checker enforces it |
| Empty container | The result is naturally plural | Nothing special; iterating `[]` is a no-op |
| Raise | Absence means the caller's assumption was wrong | Handle it or let it propagate |

**A collection-returning function should essentially never return `None`.** An
empty list is already the correct representation of "nothing found", and it
composes: the caller can iterate, `len`, or truth-test it without a guard.
Returning `None` instead forces every call site to write `for x in (result or
[]):` — and that idiom is itself an
[empty-versus-missing](../05-truthiness/02-empty-versus-missing.md) bug waiting
for a caller who needed to know the difference.

**A raise is the right default for a lookup by a key the caller supplied.**
`get_user(user_id)` where the id came from a URL should raise: the caller
believed the user existed, and a `None` flowing onward turns a 404 into a
`AttributeError` in a template three layers up. That is exactly why `dict[key]`
raises and `dict.get(key)` does not — the standard library gives you both and
makes you choose.

### The naming convention that carries the contract

The stdlib's own pattern, worth copying:

- **`get_x`** raises if absent (`dict[key]`-like), or is a plain accessor.
- **`find_x`** / **`x_or_none`** returns `None` if absent.
- **`get_x(default)`** returns the default — `dict.get`'s shape.

Whatever you pick, be consistent inside a module. Two functions named
`find_order` and `get_order` that behave identically are worse than either.

## `None` propagation is the real cost

The reason to prefer raising when absence is exceptional is that `None` spreads:

```python
user = find_user(uid)                    # User | None
profile = find_profile(user.id)          # AttributeError if user is None
```

Each `T | None` in a chain is a branch someone has to write, and the failure
mode when they do not is an `AttributeError` far from the source. Python has no
`?.` operator to make the propagation cheap —
[PEP 505](https://peps.python.org/pep-0505/) proposed one and is **deferred** —
so the ergonomics push you toward resolving the `None` early:

```python
user = find_user(uid)
if user is None:
    raise UserNotFound(uid)              # resolve it once, here
profile = find_profile(user.id)          # everything below is unconditional
```

This is the "parse, don't validate" shape: convert the uncertain value into a
certain one at a single boundary, and let the rest of the function be simple.

## Let the annotation carry the contract

```python
def find_user(uid: int) -> User | None: ...     # PEP 604 union, 3.10+
def find_user(uid: int) -> Optional[User]: ...  # the older spelling, identical
```

`X | None` and `Optional[X]` mean exactly the same thing; the `|` form is
preferred in new code. The annotation is what turns the contract from a docstring
promise into something a checker enforces at every call site — it will flag
`user.name` when `user` is `User | None`, which is precisely the bug that
otherwise ships.

Two things the annotation does **not** do, and both matter:

**It does not say what the absence means.** `-> list[str] | None` could mean "no
such post" or "the post has no tags"; the type is identical. If those are
different situations for the caller, the type cannot express it — a docstring
must, or the function should be split.

**It is not enforced at runtime.** Annotations are not checked unless you run a
checker. A function annotated `-> User` that returns `None` on some path is a
runtime `None` like any other; the annotation only helps if something reads it.

## `None` does not compare, sort, or arithmetic

```python
None < 1                     # TypeError: '<' not supported between
                             # instances of 'NoneType' and 'int'
sorted([3, None, 1])         # TypeError — one None poisons the whole sort
sum([1, None])               # TypeError
max([], default=None)        # fine — `default` is how you handle empty
```

A single `None` in a column is enough to break a sort, and the traceback names
the types rather than the row. The three fixes, in the order they are usually
right:

```python
rows.sort(key=lambda r: (r.score is None, r.score))   # Nones last, stable
rows.sort(key=lambda r: r.score or 0)                  # ⚠ conflates None and 0
clean = [r for r in rows if r.score is not None]       # exclude them
```

The middle one is the trap: `r.score or 0` also rewrites a legitimate `0`, which
is the [`or`-default bug](../05-truthiness/03-and-or-return-operands.md) in a
sort key. The first form is the idiomatic one — a tuple key whose first element
is a boolean pushes `None`s to one end without touching the values.

Equality is fine, though: `None == None` is `True` and `None == anything_else`
is `False`, with no `TypeError`. Only *ordering* is undefined.
[Comparisons](../06-comparisons/README.md) covers why Python 3 removed the
arbitrary ordering Python 2 had.

## `None` at the boundaries

`None` is the Python end of a chain of "no value" representations, and the
mapping is not always faithful:

| Elsewhere | Python | Note |
|---|---|---|
| JSON `null` | `None` | Round-trips exactly, both ways |
| SQL `NULL` | `None` | But `NULL = NULL` is unknown in SQL, while `None == None` is `True` |
| An absent JSON key | *nothing* | Distinct from `null` — see [tri-states](../05-truthiness/02c-tri-states-and-the-api-boundary.md) |
| An unset env var | absent from `os.environ` | `VAR=` gives `""`, not `None` |
| A CSV empty cell | `""` | Not `None` — `csv` has no null |

The SQL row is the one that produces real bugs. Python's `None == None` is
`True`; SQL's `NULL = NULL` is *unknown*, so a `WHERE col = :value` with a
`None` parameter matches **nothing**, not the NULL rows. The fix is `IS NULL` in
the query, and most query builders will not do it for you.

The CSV row matters for the opposite reason: an empty cell arrives as `""`, so
code that checks `is None` to find missing values finds none of them.

## Gotchas

**Symptom — a caller writes `for x in (result or []):` around your function.**
Cause: a collection-returning function returns `None` for "nothing found"
instead of an empty container. Fix: return `[]`. The `or []` idiom at the call
site is itself a bug, since it also fires for a legitimately empty result the
caller might have wanted to distinguish.

**Symptom — `AttributeError: 'NoneType' object has no attribute ...` several
layers away from the lookup.** Cause: a function returned `None` for a
not-found case that the caller did not check, and the `None` propagated. Fix:
resolve it at the boundary — raise, or check once and branch — rather than
letting `T | None` flow through the call chain.

**Symptom — `TypeError: '<' not supported between instances of 'NoneType' and
'int'` from a sort.** Cause: one `None` in the sort key; ordering against `None`
is undefined. Fix: a tuple key that segregates them —
`key=lambda r: (r.x is None, r.x)` — or filter them out. Avoid
`key=lambda r: r.x or 0`, which also rewrites legitimate zeros.

**Symptom — a SQL query with a `None` parameter matches zero rows that clearly
have NULL in that column.** Cause: SQL's `NULL = NULL` is unknown, not true, so
`WHERE col = ?` never matches NULLs however you bind it. Fix: branch in the
query builder and emit `IS NULL`. Python's `None == None` being `True` is what
makes this counter-intuitive.

**Symptom — `is None` checks never find the missing values in a CSV import.**
Cause: `csv` yields `""` for an empty cell, never `None`. Fix: normalise at the
boundary — convert `""` to `None` once, on read, and work in `None` afterwards.

**Symptom — a function annotated `-> User` returns `None` in production.**
Cause: annotations are not enforced at runtime; only a checker reads them, and
only if you run one. Fix: run the checker in CI. The annotation is a contract
with a tool, not with the interpreter.

**Symptom — two functions in the same module disagree about whether not-found
raises.** Cause: no convention was chosen. Fix: adopt the stdlib's naming
shape — `get_x` raises, `find_x` returns `None`, `get_x(default)` returns the
default — and apply it consistently. The inconsistency costs more than either
choice.

**Symptom — a type annotation says `list[str] | None` and nobody can tell what
`None` means.** Cause: the type expresses *that* there may be no value, never
*what the absence means* — "no such post" and "a post with no tags" have the
same type. Fix: document it, or split the function so each has one meaning.

**Symptom — `sum()` or `max()` raises on a column that is usually fine.**
Cause: a `None` in the data, or an empty sequence for `max`. Fix: filter the
`None`s explicitly, and use `max(xs, default=None)` for the empty case rather
than wrapping the call in `try`.

## Interview questions

**★ Q: A lookup might not find anything. What are your options?**
Return `None`, return an empty container, or raise. Return `None` when absence
is routine and the caller will branch; return `[]`/`{}` when the result is
naturally plural, because an empty container already means "nothing found" and
composes without a guard; raise when absence means the caller's assumption was
wrong. The standard library uses all three deliberately — `dict.get`,
`re.findall`, `dict[key]`.

**★ Q: Should a function that returns a list ever return `None`?**
Essentially never. `[]` already represents "nothing found", and it lets callers
iterate, `len` and truth-test without a guard. Returning `None` forces every
call site to write `result or []`, which is itself an empty-versus-missing bug —
it silently treats a legitimately empty result the same as a failure.

**★ Q: Why does one `None` break `sorted()`?**
Because ordering comparisons against `None` are undefined — Python 3 removed the
arbitrary cross-type ordering Python 2 had, so `None < 1` raises `TypeError`.
Equality is fine; only ordering is not. Segregate with a tuple key,
`key=lambda r: (r.x is None, r.x)`, rather than `r.x or 0`, which would also
rewrite a legitimate zero.

**Q: `Optional[X]` or `X | None`?**
Identical in meaning; `X | None` (PEP 604, 3.10+) is preferred in new code.
Neither is enforced at runtime — a checker has to read it. And neither expresses
*what* the absence means, which is why a `-> list[str] | None` still needs a
docstring saying whether `None` is "not found" or something else.

**Q: `None` maps to SQL `NULL`. Where does the analogy break?**
On equality. `None == None` is `True` in Python; `NULL = NULL` is *unknown* in
SQL, so a parameterised `WHERE col = ?` bound to `None` matches no rows at all,
including the NULL ones. The query has to say `IS NULL`, and most builders will
not rewrite it for you.

**Q: Why do you prefer raising over returning `None` for `get_user(id)`?**
Because the caller passed an id it believed in, so absence is exceptional, and a
`None` returned here propagates: it becomes an `AttributeError` in a template
three layers away with a traceback that does not mention the lookup. Raising
puts the failure at the point where the assumption was actually wrong. Python has
no `?.` to make propagation cheap — PEP 505 is deferred — so the ergonomics
agree.

**Q: How do you name functions so the contract is visible?**
Follow the stdlib: `get_x` raises (like `d[k]`), `find_x` returns `None`, and
`get_x(default)` returns the default (like `d.get`). The specific convention
matters less than having one — two functions in a module that behave differently
under the same name shape is worse than either choice.

---

← Prev: [What `None` is](01-what-none-is.md) · Index: [`None` and the no-result contract](README.md) · Next → **PEP 8 and idiom** *(not written yet)*
