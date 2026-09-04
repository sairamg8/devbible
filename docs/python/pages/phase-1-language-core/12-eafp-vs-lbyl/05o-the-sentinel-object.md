---
title: "When None is itself a legitimate value it stops being a sentinel — a cache that can hold a null re-fetches for ever and a PATCH endpoint clears fields nobody mentioned, and the only repair is a third object whose entire purpose is to be distinguishable"
sidebar_label: "05o · The sentinel object"
sidebar_position: 140.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get)
> (*"If `default` is not given, it defaults to `None`…"*, quoted below),
> [Built-in Constants — `Ellipsis`, `NotImplemented`](https://docs.python.org/3.14/library/constants.html) —
> and [PEP 661 — Sentinel Values](https://peps.python.org/pep-0661/) (**Final**,
> Python-Version **3.15**; *"Each call to `sentinel()` creates a distinct object"*).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[05n](05n-choosing-a-sentinel.md) established the rule: a sentinel must not be a member of
the success type. `None` satisfies that rule for almost everything — until the day `None` is
a value your function can legitimately store or receive, and then it is *inside* the success
type and stops distinguishing anything. That day arrives for every cache that can hold a
null and every PATCH endpoint where "leave it alone" and "clear it" are different requests.
The answer is a third object whose only job is to be distinguishable — and getting that
object right at runtime is this chunk. Getting the *annotation* right is harder than it
looks and is [05p](05p-typing-the-sentinel.md).**

## When `None` is a legitimate value, the sentinel cannot be `None`

`dict.get`'s contract has one seam, and the docs' own wording shows exactly where it is:

> *"Return the value for key if key is in the dictionary, else `default`. If `default` is
> not given, it defaults to `None`, so that this method never raises a `KeyError`."*

If `None` is a value you actually store, `d.get(k)` returning `None` no longer distinguishes
"absent" from "present and null" — and a cache built on it will miss on every entry whose
value is legitimately `None`, re-fetching for ever.

```python
_CACHE: dict[str, str | None] = {}

# 🔴 A cached None is indistinguishable from a miss: this refetches every time.
def lookup(key: str) -> str | None:
    value = _CACHE.get(key)
    if value is None:
        value = _slow_fetch(key)          # returns str | None
        _CACHE[key] = value
    return value
```

Two fixes exist and they are not equivalent:

```python
# Fix A: ask the membership question, because `in` distinguishes what `get` cannot.
def lookup(key: str) -> str | None:
    if key not in _CACHE:                        # one extra lookup, exact answer
        _CACHE[key] = _slow_fetch(key)
    return _CACHE[key]

# Fix B: a sentinel that cannot collide with any stored value.
_MISSING = object()

def lookup(key: str) -> str | None:
    value = _CACHE.get(key, _MISSING)            # one lookup
    if value is _MISSING:
        value = _slow_fetch(key)
        _CACHE[key] = value
    return value
```

Fix A is two lookups and needs no new concept; Fix B is one lookup and introduces a value
whose whole purpose is to be distinguishable. Which to prefer under concurrency — because
`in` followed by `[]` is a look and a leap — is
[03 · Mappings, the decision table](03-mappings-the-decision-table.md) and
[02 · The race between the look and the leap](02-the-race-between-look-and-leap.md); the
single-`get` form of Fix B is the atomic one.

The same problem appears in a **parameter default**, and there it has no Fix A:

```python
_UNSET = object()


def update_profile(user_id: int, bio: str | None | object = _UNSET) -> None:
    """Update the bio. Omitting `bio` leaves it alone; passing None clears it."""
    if bio is not _UNSET:
        _db.set_bio(user_id, bio)       # None here genuinely means "clear the field"
```

⚠️ That annotation — `str | None | object` — is already broken, and it is broken in a way
the runtime will never tell you about: `object` is the supertype of everything, so the union
accepts a `list`, a `Decimal`, anything. The signature has stopped meaning anything while the
code still works perfectly. Why that happens and what to write instead is
[05p · Typing the sentinel](05p-typing-the-sentinel.md).

`bio=None` and "no `bio` argument" are two different requests — clear the field versus leave
it — and only a third value can tell them apart. This is the shape every PATCH endpoint
eventually needs, and it is the same tri-state as an absent JSON key versus a JSON `null`;
[tri-states and the API boundary](../05-truthiness/02c-tri-states-and-the-api-boundary.md)
covers the wire side of it.

## Gotchas

**★ Symptom: a cache re-fetches every time for a particular key, and only for keys whose
value happens to be `None`.** Cause: `d.get(k)` returns `None` for both "absent" and "present
and `None`", so a legitimately-null cached value is read as a miss for ever. Fix: give `get` a
sentinel that cannot collide with any stored value.

```python
_MISSING = object()

value = _CACHE.get(key, _MISSING)
if value is _MISSING:
    value = _slow_fetch(key)
    _CACHE[key] = value
```

**★ Symptom: a PATCH endpoint clears a field the client never mentioned.** Cause: the handler
used `None` as its "not supplied" default, so an omitted key and an explicit `null` produced
the same value and the code chose "clear". Fix: three states need three values — the sentinel
for absent, `None` for an explicit null, and the value itself.

```python
def patch_profile(user_id: int, payload: dict[str, object]) -> None:
    bio = payload.get("bio", UNSET)          # UNSET: key absent; None: explicit null
    if bio is not UNSET:
        _db.set_bio(user_id, bio)
```

**Symptom: two "sentinels" compare unequal and a branch never runs.** Cause: the sentinel was
created inside a function body, so a new object exists per call — PEP 661 notes the same of
its own API, that *"Each call to `sentinel()` creates a distinct object"*. Fix: define it once
at module level and reference that object everywhere.

```python
_MISSING = object()          # module level, exactly one instance
```

**Symptom: `help()` on a function shows a default like an object repr with a hex address, and
nobody can read the signature.** Cause: `object()` has no meaningful `repr` — the problem PEP
661 opens with, describing it as *"an uninformative and overly verbose repr, causing the
function's signature to be overly long and hard to read"*. Fix: the enum form, whose member
has a readable repr, or a small class with `__repr__` defined if you do not need the `Literal`
typing.

```python
class _Missing:
    def __repr__(self) -> str:
        return "MISSING"


MISSING = _Missing()
```

**Symptom: a public function's signature exposes a private sentinel, and a caller imports it
to pass explicitly.** Cause: the sentinel leaked into the API surface, so its identity is now
part of your contract and you cannot change how it is implemented. Fix: keep the name private
and document the behaviour as "omit the argument", not "pass `UNSET`" — or, if callers
genuinely need to pass it, make it public and treat it as a versioned name like any other.

```python
__all__ = ["update_profile"]     # UNSET is not exported
```

## Interview questions

**★ When is a module-level sentinel better than `None`, and why not always use one?**
When `None` is a value the function can legitimately receive or store, so it can no longer
serve as the marker for "nothing". Two cases dominate: a cache whose values may be `None`,
where `d.get(k)` cannot tell a stored null from a miss and the cache re-fetches for ever; and
a parameter where "not supplied" and "supplied as `None`" are different requests — leave the
bio alone versus clear it — which is what every PATCH endpoint eventually discovers. You do
not use one always because it costs you: on 3.14 the annotation has to admit `object`, which
collapses the union and destroys the signature, so a sentinel is something you introduce when
`None` has genuinely run out of room, not as a default habit.

**Why should a sentinel be compared with `is` rather than `==` or truthiness?**
Because identity is the only property a sentinel actually has. `==` may be overridden by
whatever ended up on the other side — a value object with a permissive `__eq__` can compare
equal to things it should not — while `is` asks the one question the sentinel was created to
answer: is this *that* object. PEP 661 says so directly: *"Checking if a value is such a
sentinel should be done using the `is` operator, as is recommended for `None`."* Truthiness is
worse still, because the specification makes sentinel objects truthy *"unlike `None`, which is
'falsy'"* — so `if not value:` never fires for a sentinel and `if value:` fires for it always.
It is the same rule that governs `None`, for the same reason.

**A colleague uses `Ellipsis` (`...`) as a "missing" marker because it is already a
singleton. What do you say?**
That it works right up until it does not, and the failure is confusing rather than loud.
`Ellipsis` is a real object with real uses — slicing, and as a body placeholder in stubs and
`@overload` definitions — so a value that legitimately *is* `...` cannot be distinguished from
your marker, and a reader encountering `if x is ...:` has to work out which of the two
meanings you intended. The same objection applies more strongly to `NotImplemented`, whose
boolean evaluation is deprecated. A private module-level object costs one line, collides with
nothing, and says in its name what it is for. If you want the readable repr and the working
annotation as well, use the enum form on 3.14 and `sentinel()` from 3.15.

**How do you handle three states — absent, null, and a value — across an API boundary?**
By keeping three representations all the way through rather than collapsing early. On the
wire, an absent JSON key and a JSON `null` are already distinct, so the parse step must not
use `payload.get("bio")` with its `None` default, which merges them; it uses
`payload.get("bio", UNSET)` so absence is a value of its own. Inside, the type is
`str | None | Literal[_Sentinel.UNSET]` on 3.14, and each branch does something different:
`UNSET` leaves the column alone, `None` writes SQL `NULL`, a string writes the string. The
failure mode to describe is the one that generates support tickets — a PATCH that clears a
field the client never mentioned — and it happens the moment somebody uses `None` for two of
the three states.

---

← Prev: [Choosing a sentinel](05n-choosing-a-sentinel.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Typing the sentinel](05p-typing-the-sentinel.md)
