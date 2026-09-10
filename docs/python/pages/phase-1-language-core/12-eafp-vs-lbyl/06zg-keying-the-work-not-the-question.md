---
title: "When the cost you were avoiding was real work rather than a syscall, the repair is not to delete the cache but to move the key onto something that changes when the truth changes — so a stale entry becomes unreachable instead of wrong"
sidebar_label: "06zg · Keying the work, not the question"
sidebar_position: 176
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation —
> [`functools.lru_cache` / `functools.cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache),
> [`hashlib`](https://docs.python.org/3.14/library/hashlib.html),
> [`os.stat_result`](https://docs.python.org/3.14/library/os.html#os.stat_result),
> [`os.replace`](https://docs.python.org/3.14/library/os.html#os.replace).
> Target: **Python 3.14**. Documentation-validated; **no timings, nothing run**.

**[06ze](06ze-the-answer-with-a-shelf-life.md) deleted the cached predicate, which is the
right answer when the thing being avoided was a syscall. It is the wrong answer when the
thing being avoided was parsing a 400-line JSON document on every request. This chunk is the
second fix: keep the cache, move the key. Remember the *derived work*, not the *question about
current state*, and key it on a fingerprint that changes whenever the underlying bytes could
have changed. A correctly keyed cache degrades into wasted memory; an incorrectly keyed one
degrades into wrong answers, and that is the whole difference. The chunk also covers what
`lru_cache` retains, why `@cache` is the wrong decorator for a time-varying key, and the
residual window a fingerprint cannot close.**

## Fix 2 — key it on something that moves with the truth

The fix is not to remember *whether you may read the file*; it is to remember *the parsed
result*, keyed by a value that changes when the file changes:

```python
import json
import os
from functools import lru_cache

DEFAULT_CONFIG: dict = {"timeout": 30, "retries": 3}


@lru_cache(maxsize=32)
def _parse_config(path: str, mtime_ns: int, size: int) -> dict:
    with open(path) as fp:
        return json.load(fp)


def load_config(path: str) -> dict:
    try:
        st = os.stat(path)
    except (FileNotFoundError, PermissionError, NotADirectoryError):
        return DEFAULT_CONFIG
    try:
        return _parse_config(path, st.st_mtime_ns, st.st_size)
    except (OSError, json.JSONDecodeError):
        return DEFAULT_CONFIG
```

Three things changed from the memoised-predicate version, and all three matter.

- **The permission question is no longer cached at all.** Every call does a fresh `os.stat`
  and a fresh `open`; the `except` clauses on both are the guard. Nothing in this function
  remembers a claim about access.
- **The key moved onto the content.** `st_mtime_ns` is documented as *"Time of most recent
  content modification expressed in nanoseconds as an integer"*, so a rewritten file produces
  a different key and **cannot hit a stale entry**. The worst case is a wasted entry, not a
  wrong answer.
- **The cache went bounded.** `maxsize=32` caps it, because a key that varies with mtime has
  unbounded cardinality over time; `@cache` here would retain one dead entry per write, for
  the life of the process.

The `mtime_ns` and `size` arguments are never read inside `_parse_config`. That looks wrong
until you name what they are: they are not inputs to the computation, they are **the version
of the world the computation was performed against**, promoted into the key so the cache can
tell two worlds apart. Writing them as parameters is how you say that in a language whose
memoisation keys on the argument tuple.

## What the fingerprint does and does not prove

⚠️ **`(mtime_ns, size)` is a strong heuristic, not a proof.** The `os.stat_result` docs warn
that *"although `st_atime_ns`, `st_mtime_ns`, `st_ctime_ns` and `st_birthtime_ns` are always
expressed in nanoseconds, many systems do not provide nanosecond precision"* — so two writes
inside one timestamp tick, producing a file of identical length, are indistinguishable to
this key.

If you need the guarantee rather than the heuristic, key on a digest of the bytes:

```python
import hashlib
import json

_parsed_by_digest: dict[str, dict] = {}


def load_config_exact(path: str) -> dict:
    with open(path, "rb") as fp:
        raw = fp.read()
    digest = hashlib.sha256(raw).hexdigest()
    try:
        return _parsed_by_digest[digest]
    except KeyError:
        parsed = json.loads(raw)
        _parsed_by_digest[digest] = parsed
        return parsed
```

Notice what happened: keying on the content means **reading** the content, so the I/O is no
longer avoided and only the *parse* is. That is often still worth it — `json.loads` on a
large document costs more than the read — but it changes what the cache is for, and that
belongs in the pull request description rather than in a later incident review.

The hand-written dict is deliberate here rather than `@lru_cache`. Bytes are hashable, so
`@lru_cache` keyed on `raw` would work, but the docs' retention rule then applies to the key
as well — *"The cache keeps references to the arguments and return values"* — and you would
be holding a full copy of every distinct version of the file. Keying on the digest keeps the
parsed value and discards the bytes. The cost is that you now own the eviction policy this
dict does not have; cap it, or accept the growth knowingly.

## What the cache retains

Two documented sentences decide most memory questions about `lru_cache`:

> *"The cache keeps references to the arguments and return values until they age out of the
> cache or until the cache is cleared."*

> *"If a method is cached, the `self` instance argument is included in the cache."*

The first is why an unbounded `@cache` on a time-varying key is a slow leak rather than a
cache. The second is why a cached method keeps every instance it was ever called on alive —
the instance is part of the key, and the key is a strong reference.

## Gotchas

**★ Symptom: RSS grows steadily on a worker that only reads files.** Cause: `@cache` is
documented as an *"unbounded function cache"*, and the key includes a fingerprint that
changes on every write — so every deploy, every config edit, every log rotation adds an entry
that can never be hit again and can never be evicted. Fix: use `@lru_cache(maxsize=N)`
whenever **any** component of the key is time-varying. That, not the microseconds, is the
difference between the two decorators that actually decides which one you want.

```python
from functools import lru_cache


@lru_cache(maxsize=32)              # not @cache — the key includes an mtime
def _parse_config(path: str, mtime_ns: int, size: int) -> dict:
    import json
    with open(path) as fp:
        return json.load(fp)
```

**★ Symptom: objects are never garbage collected, and the leak points at a cached method.**
Cause: *"If a method is cached, the `self` instance argument is included in the cache."* Fix:
move the cache to a module-level function taking the fields it actually needs, so the key is
data rather than an object:

```python
import os
from functools import lru_cache


@lru_cache(maxsize=256)
def _resolved_root(root: str, follow_symlinks: bool) -> str:
    return os.path.realpath(root) if follow_symlinks else root


class Workspace:
    def __init__(self, root: str) -> None:
        self.root = root

    def resolved(self) -> str:
        return _resolved_root(self.root, True)
```

**★ Symptom: a cached lookup returns a dict that one caller mutated, and every later caller
sees the mutation.** Cause: the cache stores the object, not a copy, and the `lru_cache` docs
warn against caching *"functions that need to create distinct mutable objects on each call"*.
Fix: return an immutable value from the cached function and let callers build their own
mutable copy:

```python
import json
from functools import lru_cache
from types import MappingProxyType
from typing import Mapping


@lru_cache(maxsize=32)
def _parse_frozen(path: str, mtime_ns: int, size: int) -> Mapping[str, object]:
    with open(path) as fp:
        return MappingProxyType(json.load(fp))
```

`MappingProxyType` is a view, not a copy — a caller cannot mutate through it, and the
underlying dict is not shared out. If callers genuinely need to mutate, hand them
`dict(_parse_frozen(...))` at the call site so the copy is visible in the code that needs it.

**★ Symptom: the key includes the mtime, and the cache still served content from before the
last write.** Cause: the `os.stat` that produced the key is itself a look, with its own window
before the leap — another process replaced the file between your `stat` and the `open` inside
the cached function, so the new bytes got stored under the *old* fingerprint. Fix: you cannot
close that window without a lock, so make the write atomic and the residual error harmless. A
writer that replaces rather than truncates means a reader sees either the whole old file or
the whole new one:

```python
import json
import os


def write_config(path: str, data: dict) -> None:
    tmp = f"{path}.tmp.{os.getpid()}"
    with open(tmp, "w") as fp:
        json.dump(data, fp)
        fp.flush()
        os.fsync(fp.fileno())
    os.replace(tmp, path)
```

If the mis-keyed entry must not survive, stat **after** the read and discard the result when
the two fingerprints disagree — that turns a wrong entry into a retry, at the cost of a
second syscall.

**Symptom: two threads both ran the expensive parse.** Cause: documented and intended — *"It
is possible for the wrapped function to be called more than once if another thread makes an
additional call before the initial call has been completed and cached."* Fix: nothing, if the
function is pure — the duplicate is wasted CPU and both results are equal. If the duplicate
call is a *correctness* problem because the function has an effect, claims a resource or must
happen exactly once, then a cache was never the right mechanism; take a lock, as in
[05g · Closing the gap with a lock](05g-closing-the-gap-with-a-lock.md).

**Symptom: keyword-argument order changed and the hit rate collapsed.** Cause: *"Distinct
argument patterns may be considered to be distinct calls with separate cache entries. For
example, `f(a=1, b=2)` and `f(b=2, a=1)` differ in their keyword argument order and may have
two separate cache entries."* Fix: call cached functions positionally, or wrap them in a thin
public function that normalises the arguments before delegating.

## Interview questions

**★ What makes a cache key correct?**
The key must contain every input the value depends on, including the ones that are not
parameters. For a parsed configuration file the value depends on the path and on the bytes;
`(path, st_mtime_ns, st_size)` approximates the bytes with two cheap fields, so a write
produces a new key and the old entry becomes **unreachable rather than wrong**. That
distinction is the property to aim for, and it is the sentence to say in review: a correctly
keyed cache degrades into wasted memory, an incorrectly keyed one degrades into wrong
answers. State the approximation honestly, though — the `os.stat_result` docs note that
*"many systems do not provide nanosecond precision"*, so two writes inside one tick producing
the same file length collide.

**★ `_parse_config` takes `mtime_ns` and `size` and never uses them. Isn't that a code
smell?**
It is an unusual signature that deserves a comment, not a smell. Python memoises on the
argument tuple, so the only way to say "this result belongs to that version of the world" is
to put the version in the arguments. The parameters are the cache's key material, not the
function's inputs, and naming them `mtime_ns` and `size` makes that legible. The alternative
designs are worse: a manual dict keyed on the tuple reimplements `lru_cache` badly, and
hiding the fingerprint inside the function means the cache cannot see it at all — which is
the original bug.

**★ Both `@cache` and `@lru_cache` are available. Which one belongs on a function keyed by a
file fingerprint?**
`@lru_cache(maxsize=N)`, always. `@cache` is documented as unbounded, and its stated advantage
— *"Because it never needs to evict old values, this is smaller and faster than `@lru_cache`
with a size limit"* — is about the cost of eviction, not a suggestion that eviction is
optional for your key space. A fingerprint key grows without bound over time by construction:
every write to the file mints a key that will never be queried again. `@cache` is the right
choice only when the key space is genuinely small and fixed, which a filesystem fingerprint
never is.

**Is a fingerprinted cache still LBYL?**
Yes, and it is the version of LBYL that clears. The `os.stat` is a look and the `open` is a
leap, so the window is still there; what changed is that a wrong answer in the window can no
longer be *served*, only *stored under the wrong name*. That is the same structure as the
cases in [05 · Where LBYL is right](05-where-lbyl-is-right.md): the check is allowed because
the consequence of it being stale is bounded and recoverable, not because the check is
guaranteed fresh. Keep the `except` clauses around the real operation — they, not the stat,
are what make the function correct.

**A reviewer says the second stat after the read is paranoid. Is it?**
It depends entirely on what a mis-keyed entry costs. If the cached value is a configuration
document read once a second by a process that will re-read it a second later, storing one
generation under a stale key is invisible and the second stat is noise. If the cached value
is a compiled artefact that gates a deployment, or anything a human will later be asked to
explain, the extra syscall buys a property you can state: no entry in this cache was ever
computed from bytes other than the ones its key describes. Decide it by the consequence, not
by the syscall count — which is [07g](07g-provability-and-the-order-to-decide.md)'s order
applied to a cache.

---

← Prev: [The answer with a shelf life](06ze-the-answer-with-a-shelf-life.md) · Index: [EAFP vs LBYL](README.md) · Next → [Cache only what the leap re-verifies](06zh-cache-only-what-the-leap-reverifies.md)
