---
title: "A guard's answer is a claim about the past the instant it returns, so memoising a filesystem or permission predicate does not make the check cheaper — it widens the window the glossary already warned about from microseconds to the lifetime of the process"
sidebar_label: "06ze · The answer with a shelf life"
sidebar_position: 175
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation —
> [Glossary: `LBYL`](https://docs.python.org/3.14/glossary.html#term-LBYL),
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access),
> [`functools.lru_cache` / `functools.cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache).
> Target: **Python 3.14**. Documentation-validated; **no timings, nothing run**.

**Every LBYL check answers a question about a moment that has already passed by the time the
`if` evaluates. That gap is this topic's whole argument, and the glossary states it outright.
A cache does not remove the gap — it is a decision to keep answering from inside it. `@cache`
over `os.path.exists`, a module-level `HAS_FFMPEG` flag, a `DirEntry` held past its loop:
each converts a window measured in instructions into a window measured in process uptime,
and a race that fires occasionally into an answer that is reliably wrong. This chunk is the
mechanism and the first fix — delete the check.
[06zg](06zg-keying-the-work-not-the-question.md) is the second fix, caching the work instead
of the question; [06zh](06zh-cache-only-what-the-leap-reverifies.md) is negative caching and
who owns the invalidation, and the cases where caching a check is genuinely right.**

## The window is open before you cache anything

The glossary's warning about LBYL does not mention performance at all. It names a gap:

> *"In a multi-threaded environment, the LBYL approach can risk introducing a race condition
> between "the looking" and "the leaping". For example, the code, `if key in mapping: return
> mapping[key]` can fail if another thread removes key from mapping after the test, but
> before the lookup."*

`os.access` says the same thing about a filesystem, and escalates it from *flaky* to
*exploitable*:

> *"Using `access()` to check if a user is authorized to e.g. open a file before actually
> doing so using `open()` creates a security hole, because the user might exploit the short
> time interval between checking and opening the file to manipulate it. It's preferable to
> use EAFP techniques."*

Note the phrase the docs chose: *"the short time interval"*. **Short** is doing no work in
that sentence — the hole exists because the interval is non-zero, not because it is long.
Caching takes the one property nobody was relying on and removes it.

## What `@cache` does to a filesystem predicate

Here is the shape. It arrives in a pull request labelled "avoid a syscall on the hot path",
two people review it, and nothing about it looks wrong:

```python
import json
import os
from functools import cache

DEFAULT_CONFIG: dict = {"timeout": 30, "retries": 3}


@cache
def config_is_readable(path: str) -> bool:
    return os.access(path, os.R_OK)


def load_config(path: str) -> dict:
    if config_is_readable(path):
        with open(path) as fp:
            return json.load(fp)
    return DEFAULT_CONFIG
```

`functools.cache` is documented as a *"Simple lightweight unbounded function cache"* that
*"Returns the same as `lru_cache(maxsize=None)`, creating a thin wrapper around a dictionary
lookup for the function arguments."* **A dictionary lookup for the function arguments** is
the entire mechanism, and it is also the entire bug: the key is the arguments, and the answer
does not depend only on the arguments.

The `lru_cache` entry states the precondition in plain terms:

> *"In general, the LRU cache should only be used when you want to reuse previously computed
> values. Accordingly, it doesn't make sense to cache functions with side-effects, functions
> that need to create distinct mutable objects on each call (such as generators and async
> functions), or impure functions such as `time()` or `random()`."*

`os.access(path, os.R_OK)` belongs in the same category as `time()`. It is not a function of
`path`; it is a function of `path` **and the state of the filesystem at the instant of the
call**, exactly as `time()` is a function of the instant alone. Memoising it records the
second input nowhere and then behaves as though it never existed.

## The cache key is the tell

One question settles almost every cache-correctness argument:

> **Does the key contain everything the value depends on?**

For `config_is_readable`, the value depends on `(path, filesystem state)` and the key
contains `path`. That mismatch is not a tuning problem, a TTL problem or a size problem — it
is the definition of a wrong cache. And it makes the failure mode precise: the entry is not
*sometimes* stale, it is **permanently frozen** at whatever the world looked like the first
time anyone asked. A race that fired one time in ten thousand has become a wrong answer that
fires every time, for as long as the process lives.

Two fixes follow, and which one you want depends on whether you were caching to skip a
*check* or to skip *work*. This chunk covers the first; the second is
[06zg](06zg-keying-the-work-not-the-question.md).

## Fix 1 — you were caching a check, so delete the check

If the predicate exists only to decide whether to do the operation, the operation already
answers it. This is the `os.access` entry's own rewrite, adapted to the loader:

```python
import json

DEFAULT_CONFIG: dict = {"timeout": 30, "retries": 3}


def load_config(path: str) -> dict:
    try:
        fp = open(path)
    except PermissionError:
        return DEFAULT_CONFIG
    else:
        with fp:
            return json.load(fp)
```

There is no cache to invalidate because there is no remembered answer: the only claim this
function makes about the filesystem is one it obtained by acting on it. The `else:` clause is
not decoration — it keeps `json.load` outside the `try`, so an `OSError` raised while reading
a slow network mount cannot be absorbed by a handler written for the open.

The version that started this chunk had three separate memories of the filesystem: the cache
entry, the `if`, and the `open`. This one has one, and it is the one that decides.

## Gotchas

**★ Symptom: a config change takes effect only after a restart, and only in production.**
Cause: a `@cache` or `@lru_cache` sits on a function that reads or tests a file. In
development the process restarts on every save, so the cache is never older than the last
edit and the bug is invisible; a long-lived worker holds the first answer for days. Fix:
delete the cache from the predicate. If the parsing cost was real, cache the parse keyed on a
fingerprint of the file instead — [06zg](06zg-keying-the-work-not-the-question.md).

**★ Symptom: a user whose access was revoked keeps getting through, and only on one
instance.** Cause: an authorisation predicate behind `@cache` — `user_can_write(user_id,
resource_id)` is the same shape as `config_is_readable`, with the grant table playing the
part of the filesystem. The instance that cached the old answer is the one that keeps
honouring it, which is why it looks like a load-balancer bug. Fix: authorisation is never
memoised on a bare identity key; re-ask at the point of use, and if the lookup is genuinely
expensive, cache it under a key that includes a version or generation number the grant table
bumps on every write.

```python
from functools import lru_cache

from myapp.stores import document_store, grant_store
from myapp.errors import PermissionDenied


@lru_cache(maxsize=4096)
def _may_write(user_id: str, doc_id: str, grants_version: int) -> bool:
    return grant_store.may_write(user_id, doc_id)


def write_document(user_id: str, doc_id: str, body: str) -> None:
    grants_version = grant_store.version()          # cheap, always current
    if not _may_write(user_id, doc_id, grants_version):
        raise PermissionDenied(user_id, doc_id)
    document_store.write(doc_id, body)
```

Every write to the grant table bumps `version()`, so a revocation makes every cached entry
unreachable in one step. The cache is still there and still doing its job; it simply cannot
answer a question about a world that no longer exists.

**★ Symptom: a test passes alone and fails in the suite, or the reverse.** Cause: a
module-level cache is shared state that survives between tests, so test order decides the
answer — a test that writes a fixture file after another test has already cached its absence
sees the stale `False`. Fix: clear it in an autouse fixture, and treat any cache that cannot
be cleared from a test as a design defect.

```python
import pytest

from myapp.config import config_is_readable


@pytest.fixture(autouse=True)
def _clear_config_cache():
    config_is_readable.cache_clear()
    yield
    config_is_readable.cache_clear()
```

That fixture is a stopgap for a cache you have not deleted yet, and it is worth naming as
one: it makes the suite deterministic without making production correct.

**★ Symptom: an environment-variable feature flag never picks up a change, though the process
was restarted "with the new value".** Cause: the same defect with a different resource — a
`@cache` (or a module-level constant evaluated at import) reading `os.environ`. The restart
in question restarted a supervisor, not the worker. Fix: read the variable at the point of
use; if parsing it is expensive enough to matter, parse it once at start-up **explicitly**,
in a named function the tests can call, so the lifetime of the answer is a design decision
rather than an accident of import order.

**Symptom: the "hot path" the cache was added for turns out never to have been hot.** Cause:
the pull request was justified by a syscall count, not a profile. Fix: this is the ordering
error [07g](07g-provability-and-the-order-to-decide.md) exists to prevent — atomicity is
decided before cost, and a cached predicate loses on atomicity before the profiler is ever
opened. Revert the cache and, if the cost is real, measure first
([07e](07e-measuring-instead-of-arguing.md)).

## Interview questions

**★ Why does staleness argue for EAFP more strongly than slowness does?**
Because it is an argument about correctness, it needs no measurement, and it does not change
sign with the workload. The speed argument rests on two sentences in the 3.11 release notes —
*""Zero-cost" exceptions are implemented, eliminating the cost of `try` statements when no
exception is raised"* and a roughly 10% improvement in the time to catch one — and neither
compares a `try` against an `if`. Worse, whatever advantage exists inverts once misses become
common, which is [07b](07b-the-miss-rate-decides.md)'s subject: at a high enough miss rate
the check-first version wins on time. The staleness argument has no such crossover. The gap
between the look and the leap is stated in the glossary as a property of the shape itself,
and a stale check is not *slower* than the operation — it is answering a different question
from the one the program is about to act on. A wrong answer does not get better when the
machine gets faster. That is why atomicity is first in
[07g](07g-provability-and-the-order-to-decide.md)'s decision order and cost is last, and it
is why a page arguing EAFP from speed is on far weaker ground than one arguing it from the
window.

**★ `os.path.exists` is a pure function of its argument — you pass a string, you get a bool.
So why is memoising it a bug?**
Because it is not pure; it only has a pure *signature*. Its value depends on the path and on
the state of the filesystem, and only the first appears in the argument list.
`functools.cache` is documented as *"a thin wrapper around a dictionary lookup for the
function arguments"*, so the input that is not in the arguments is an input the cache cannot
see change. The `lru_cache` docs draw the boundary explicitly by naming *"impure functions
such as `time()` or `random()`"* as things it does not make sense to cache; `os.path.exists`
differs from `time()` only in that its hidden input changes less often, which makes the bug
rarer and therefore much harder to find. The test to apply is whether the key contains
everything the value depends on — here it does not, so the entry is not stale after a while,
it is frozen from the first call onwards.

**★ A colleague says the cached check is fine because the window was always there, and a few
extra milliseconds of staleness changes nothing. What is the answer?**
That the difference between "a window exists" and "the window is the process lifetime" is the
difference between a bug you can argue about and a bug you can schedule. A one-instruction
gap fires when an adversary or an unlucky interleaving hits it; a cached gap is not a window
at all, it is a **decision to stop asking**. Concretely: with no cache, the operator's
`chmod` takes effect on the next request. With a cache, it takes effect on the next deploy,
and nobody writing the `chmod` knows that. The `os.access` note calls the uncached version a
security hole while the interval is merely *"short"* — the cached version is the same hole
held open on purpose.

**Where in the decision order does "should I cache this check?" belong?**
Nowhere near the top, and the question is usually a symptom that the order was skipped.
[07g](07g-provability-and-the-order-to-decide.md) puts atomicity first: can the state change
between the look and the leap? A cache is an admission that it can and that you intend to
ignore it, so the answer at step one is already "do not use a check here", and cost — step
four, and only with a profile — never gets asked. The rare legitimate case reverses the
justification rather than the order: the value is immutable, so the gap is not a gap.
**The caches you did not write** *(not written yet)* will work through those.

**Why not just say "never cache anything derived from I/O"?**
Because that rule forbids things that are plainly correct, and a rule people must break daily
stops being followed at all. Caching a value keyed by a content hash is safe because the key
changes whenever the value could. Caching a parse keyed on mtime and size is safe enough that
the standard library uses the same class of trick for bytecode. What is never safe is caching
a **predicate about the current state of a resource** and then acting on it — that shape is
narrow enough to state precisely: if the cached value is a claim about *right now* rather
than a function of the inputs, it has a shelf life, and the code using it will outlive the
shelf life.

---

← Prev: [The check that lies](06s-the-check-that-lies.md) · Index: [EAFP vs LBYL](README.md) · Next → [Keying the work, not the question](06zg-keying-the-work-not-the-question.md)
