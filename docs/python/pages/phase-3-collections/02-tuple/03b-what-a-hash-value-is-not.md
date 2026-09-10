---
title: "A hash value is a bucket hint, not an identity: equal numbers of different types collapse into one key, string hashes change every process, and the integer is truncated to a machine word"
sidebar_label: "3b · What a hash value is not"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14
> [`hash()`](https://docs.python.org/3.14/library/functions.html#hash) built-in;
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)
> — the salting and truncation notes;
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types);
> the [standard type hierarchy on `bool`](https://docs.python.org/3.14/reference/datamodel.html#boolean-type-bool);
> [`sys.hash_info`](https://docs.python.org/3.14/library/sys.html#sys.hash_info);
> [`hashlib`](https://docs.python.org/3.14/library/hashlib.html); and
> [`PYTHONHASHSEED`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED).
> Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**A tuple's hash is derived from its elements, so every property of `hash()` becomes a
property of your composite keys. Three of them break real services: numbers that compare
equal hash equal *across types*, so `1`, `1.0` and `True` are one dict key; string hashes
are salted per process, so a hash is meaningless the moment it leaves the interpreter that
made it; and the value is truncated to a machine word, so collisions exist by
construction and `hash(a) == hash(b)` proves nothing.**

## Equal numbers collapse into one key

This one surprises people building composite keys out of database columns:

> *"Numeric values that compare equal have the same hash value (**even if they are of
> different types, as is the case for 1 and 1.0**)."* —
> [`hash()`](https://docs.python.org/3.14/library/functions.html#hash)

> *"For numbers ``x`` and ``y``, possibly of different types, it's a requirement that
> ``hash(x) == hash(y)`` whenever ``x == y``"* —
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types)

Because tuples compare element-by-element and hash from their elements, this propagates:

```python
counts = {}
counts[(1, "orders")] = 10
counts[(1.0, "orders")] = 20      # SAME key — overwrites, does not add
counts[(True, "orders")] = 30     # STILL the same key: True == 1
# len(counts) is 1
```

`bool` is documented as a subtype of `int` —

> *"These represent the truth values False and True.  The two objects representing the
> values ``False`` and ``True`` are the only Boolean objects. **The Boolean type is a
> subtype of the integer type**, and Boolean values behave like the values 0 and 1,
> respectively, in almost all contexts"* —
> [the standard type hierarchy](https://docs.python.org/3.14/reference/datamodel.html#boolean-type-bool)

— so a flag column read as a boolean and an integer column read as `1` produce one dict
entry, not two. If the distinction matters, normalise the type before it reaches the key:

```python
def counter_key(row):
    return (int(row.tenant_id), str(row.status))   # one canonical spelling per value
```

or lift the value into a type that does not compare equal to an integer at all:

```python
from enum import Enum

class Status(Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"

key = (row.tenant_id, Status(row.status))          # never equal to 1 or True
```

🔴 The general form of this rule: **a dict key is defined by `__eq__`, not by type.** Two
tuples of different-typed-but-equal elements are the same key. `Decimal("1")`,
`Fraction(1, 1)`, `1` and `1.0` all collapse together, because the numeric tower is
required to keep `hash` consistent with `==` across types.

## Hash values are salted, per process

> *"By default, the `__hash__` values of str and bytes objects are "salted" with an
> unpredictable random value.  Although they remain constant within an individual Python
> process, **they are not predictable between repeated invocations of Python.**"*

> *"This is intended to provide protection against a denial-of-service caused by carefully
> chosen inputs that exploit the worst case performance of a dict insertion, *O*(*n*²)
> complexity."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

So `hash(("acme", "orders"))` is a different integer in tomorrow's process, and in the
worker next to this one. **Never persist a `hash()` value, never put one in a cache key
that outlives the process, and never write it into a database column** — and do not shard
on one unless you have read the `PYTHONHASHSEED` note below and accepted every condition
in it.

The correct tool when the value has to survive a restart is a cryptographic or
non-cryptographic digest over a *canonical encoding* you control:

```python
import hashlib

def stable_shard_key(tenant: str, day: str, buckets: int) -> int:
    payload = f"{tenant}\x00{day}".encode("utf-8")
    digest = hashlib.blake2b(payload, digest_size=8).digest()
    return int.from_bytes(digest, "big") % buckets
```

The `\x00` separator matters: without it, `("ab", "c")` and `("a", "bc")` encode to the
same bytes. A tuple has an unambiguous structure; a concatenated string does not, and
re-creating that structure is your job at the serialisation boundary.

⚠️ `PYTHONHASHSEED` can pin the salt, and the documentation is more permissive here than
folklore suggests — read it precisely:

> *"If :envvar:`PYTHONHASHSEED` is set to an integer value, it is used as a fixed seed for
> generating the hash() of the types covered by the hash randomization."*
>
> *"Its purpose is to allow repeatable hashing, such as for selftests for the interpreter
> itself, or **to allow a cluster of python processes to share hash values**."*
>
> *"The integer must be a decimal number in the range [0,4294967295].  **Specifying the
> value 0 will disable hash randomization.**"* —
> [`PYTHONHASHSEED`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED)

So a **fixed non-zero** seed, kept secret and shared across a cluster, is a documented and
supported way to make hashes agree between processes. `PYTHONHASHSEED=0` is different: it
disables randomisation entirely and re-opens the denial-of-service hole the feature exists
to close. And neither survives a Python upgrade, because nothing promises the hash
*algorithm* is stable across versions — for anything persisted, still use `hashlib`.

## Hash values are truncated

> *"`hash()` truncates the value returned from an object's custom `__hash__` method to the
> size of a `Py_ssize_t`.  This is typically 8 bytes on 64-bit builds and 4 bytes on 32-bit
> builds.  If an object's `__hash__` must interoperate on builds of different bit sizes, be
> sure to check the width on all supported builds.  An easy way to do this is with
> `python -c "import sys; print(sys.hash_info.width)"`."*

Two consequences:

1. **Collisions are guaranteed to exist.** There are more distinct tuples than there are
   machine words. `hash(a) == hash(b)` therefore never implies `a == b`; dicts and sets
   resolve the bucket collision by falling back to `==`.
2. **A `__hash__` returning a huge integer is silently narrowed.** If you compute a
   64-bit-ish value and run on a 32-bit build, the top half is gone — which is fine for
   correctness (the contract only requires equal objects to hash equal) but means you
   cannot treat the return value as a fingerprint.

## What a hash value *is* good for

Exactly one thing: letting a `dict` or `set` pick a bucket so it can avoid comparing your
key against every other key. Everything else — identity, fingerprinting, sharding,
persistence, change detection — needs a different tool:

| You want | Use |
|---|---|
| dict / set membership | `hash()`, implicitly. Never call it yourself |
| a stable fingerprint across processes | `hashlib.blake2b` / `sha256` over a canonical encoding |
| "did this record change" | compare the tuples with `==`, or store a digest |
| a shard number | a digest, then modulo — not `hash()` |
| object identity | `is` against a sentinel; see [1b](01b-thread-safety-and-identity.md) |

## Gotchas

**★ Symptom: a dict keyed on `(row_id, flag)` has half the rows you expect.** Cause:
`True == 1` and `1 == 1.0`, and the docs require equal numbers to hash equal — so
`(1, "x")`, `(1.0, "x")` and `(True, "x")` are one key. Fix: normalise the component type
before it enters the key.

```python
key = (int(row_id), str(flag))              # one canonical spelling per value
```

**★ Symptom: `hash()` of the same key differs between two processes, breaking a sharding
scheme.** Cause: string and bytes hashes are salted per process by design, as a
denial-of-service defence. Fix: use a stable digest for anything that crosses a process
boundary.

```python
import hashlib
shard = hashlib.blake2b(f"{tenant}\x00{day}".encode(), digest_size=8).digest()
```

**★ Symptom: two different tuples produce the same persisted cache key.** Cause: the
tuple was flattened into a string without a separator, so `("ab", "c")` and `("a", "bc")`
encoded identically. Fix: encode the structure, not just the characters — a separator that
cannot occur in the fields, or a real serialiser.

```python
import json
payload = json.dumps(list(key), separators=(",", ":")).encode()
```

**Symptom: a `set` of tuples silently deduplicated rows you wanted to keep.** Cause: two
rows produced equal tuples — possibly through the numeric-equality rule above. Fix: add a
discriminating field, or use a `list` if duplicates are meaningful.

```python
rows = {(r.tenant, r.day, r.id) for r in results}   # id makes each row distinct
```

**Symptom: comparing `hash(a) == hash(b)` to decide equality gives false positives.**
Cause: hashes are truncated to the platform word size, so collisions exist by
construction. Fix: compare the objects.

```python
if a == b:      # dicts and sets do exactly this after the bucket lookup
    ...
```

**Symptom: a test asserts an exact `hash()` value and fails on CI.** Cause: the value
depends on the per-process salt and on the build's word width. Fix: assert the property
you actually need — that equal keys hash equal, and that the dict finds the entry.

```python
assert hash(key_a) == hash(key_b)     # a real, portable invariant
assert cache[key_a] == expected       # what you meant to test
```

**Symptom: setting `PYTHONHASHSEED=0` in production "fixed" a flaky sharding bug.**
Cause: the docs are explicit that *"specifying the value 0 will disable hash
randomization"* — string hashes become reproducible, and the algorithmic-complexity attack
randomisation exists to prevent comes back. A fixed *non-zero* seed is the documented way
to share hash values across a cluster, but it still does not survive a Python upgrade.
Fix: move the sharding onto `hashlib`, where the algorithm is specified.

```bash
# not this
PYTHONHASHSEED=0 python -m app.worker
```

## Interview questions

**★ `d[(1, 'x')] = 'a'` then `d[(True, 'x')] = 'b'`. How many entries?**
One. `True == 1`, and the documentation requires that *"numeric values that compare equal
have the same hash value"*, so the two tuples are equal and hash equal. `bool` being a
subtype of `int` is the mechanism; the same collapse happens for `1` and `1.0`, and for
`Decimal("1")` and `Fraction(1, 1)`. If two values must be distinct keys, they must not
compare equal — normalise to one type, or use a string or an `Enum`.

**★ Is `hash()` stable across runs?**
For `int` and most numeric types, yes in practice. For `str` and `bytes`, explicitly no —
the docs say their hashes are *"salted with an unpredictable random value"* that is
constant within a process but not between invocations, as a defence against a
denial-of-service attack that feeds a server colliding keys. Since a tuple's hash is
derived from its elements, any tuple containing a string inherits that instability. Never
persist, shard on, or transmit a `hash()` value; use `hashlib` when the value must outlive
the process.

**★ You need to shard a composite key across 16 Redis instances. What do you use?**
Not `hash()`. Encode the tuple canonically — with a separator that cannot appear in the
fields, or via a real serialiser — then take a digest and modulo it. `blake2b` with a
small `digest_size` is fast and stable across processes, versions and machines. The whole
point of a shard function is that every process agrees on it, which is exactly the
guarantee `hash()` does not make for strings.

**Does `hash(a) == hash(b)` mean `a == b`?**
No, and it never can — hash values are truncated to a machine word, so there are far more
possible objects than hash values. Dicts and sets use the hash only to pick a bucket and
then settle the question with `==`. Application code comparing hashes is either an
optimisation that needs an `==` follow-up or a bug.

**Is `PYTHONHASHSEED` a legitimate way to make hashes agree across a cluster?**
The documentation says yes, with conditions: a fixed integer seed *"is used as a fixed
seed for generating the hash() of the types covered by the hash randomization"*, and its
stated purpose includes *"to allow a cluster of python processes to share hash values"*.
Two caveats decide whether you should. `PYTHONHASHSEED=0` is not that — it *disables*
randomisation and restores the vulnerability. And nothing documents the hash algorithm
itself as stable across Python versions, so a seed pinned today is not a persistence
format. For anything that outlives the process, `hashlib` is the answer.

**Why is hash randomisation on by default at all?**
Because a dict degrades to *O*(*n*) per insertion when every key lands in the same bucket,
and an attacker who can choose the strings a server puts into a dict — form fields, JSON
keys, headers — can manufacture exactly that. The docs describe the defence as protection
against *"a denial-of-service caused by carefully chosen inputs that exploit the worst
case performance of a dict insertion, O(n²) complexity"*. Randomising the salt makes the
colliding set unpredictable and therefore un-constructible.

**Your `__hash__` returns a 128-bit integer. Is that a problem?**
Not for correctness — `hash()` truncates it to `Py_ssize_t`, and the only contract is that
equal objects hash equal, which truncation preserves. It is a problem if you were treating
the return value as a fingerprint, because the truncation is silent and its width differs
between 64-bit and 32-bit builds. The docs even give the check:
`python -c "import sys; print(sys.hash_info.width)"`.

---

← [Hashability](03-hashability.md) · [Topic index](README.md) · Next → [Tuples as keys](04-tuples-as-keys.md)
