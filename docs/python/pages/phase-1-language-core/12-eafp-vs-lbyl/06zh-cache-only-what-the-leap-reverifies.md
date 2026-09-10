---
title: "A cached True is usually survivable because the operation is about to check it again, a cached False never is because nothing afterwards will — and even the survivable half only holds when the leap asks the same question the guard asked"
sidebar_label: "06zh · Cache only what the leap re-verifies"
sidebar_position: 177
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation —
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access),
> [`shutil.which`](https://docs.python.org/3.14/library/shutil.html#shutil.which),
> [`time.monotonic`](https://docs.python.org/3.14/library/time.html#time.monotonic),
> [Glossary: `LBYL`](https://docs.python.org/3.14/glossary.html#term-LBYL).
> Target: **Python 3.14**. Documentation-validated; **no timings, nothing run**.

**There is one rule that separates a cached check you can live with from one that will
eventually page someone: cache only the answer that the operation is going to re-verify
anyway, and check that it re-verifies the same question. A remembered `True` is normally
followed by the real call, which fails on its own terms if the world moved. A remembered
`False` is followed by the other branch — and the code path that would have discovered the
truth is precisely the one the `False` disabled. This chunk is negative caching, the TTL that
bounds rather than fixes it, the second half of the rule that the `os.access` security hole
lives in, and why the whole staleness argument outranks the speed argument without needing a
single measurement. Who owns the invalidation is **the caches you did not
write** *(not written yet)*.**

## The rule, and the half of it that is easy to lose

**Cache only what the leap re-verifies.**

A cached `True` that is immediately followed by the real operation is usually survivable,
because the operation performs its own check and fails on its own terms if the answer has
changed. A cached `False` is never safe by that argument, because nothing runs afterwards to
correct it.

The second half is where the `os.access` security hole actually lives, and it is the part
that gets dropped when the rule is repeated: **the operation re-verifies its own question,
not the guard's.**

`os.access` asks *"may the **real** uid read this path?"* — the docs say it *"Use[s] the real
uid/gid to test for access to path"*. `open()` asks "may the **effective** uid read whatever
this path resolves to *now*?". Two questions, two answers, and in a setuid program the second
succeeding tells you nothing about the first. That is why the docs call the combination a
security hole rather than merely a race:

> *"Using `access()` to check if a user is authorized to e.g. open a file before actually
> doing so using `open()` creates a security hole, because the user might exploit the short
> time interval between checking and opening the file to manipulate it."*

The re-verification argument only holds when the guard and the operation ask **the same
question of the same object** — and when they do, that is also the argument for deleting the
guard, because the operation was already asking it.

## Negative caching: the `False` that outlives the fix

Positive caching goes stale. Negative caching goes stale **and nothing ever revisits it**.

```python
import shutil
from functools import cache


@cache
def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None
```

`shutil.which` is documented as *"Return the path to an executable which would be run if the
given cmd was called. If no cmd would be called, return `None`."* — a look, and a perfectly
good one. It is also, by its own documentation, the same look one layer down: *"mode is a
permission mask passed to `os.access`, by default determining if the file exists and is
executable."* Everything the `os.access` note says applies here unchanged. The defect,
though, is not `which` — it is the `@cache` above it.

Call this once during application start-up — from a health probe, a capability banner, a
metrics gauge — before the sidecar has mounted its volume or before `PATH` is populated by
the entrypoint script. The answer is `False`, the answer is now permanent, and the feature is
off for the life of the process. The operator installs the tool, the deploy is declared
fixed, and nothing changes until a restart nobody has connected to the symptom.

Note that a zero-argument function makes the bug maximally sharp: the key is the empty tuple,
so there is exactly one entry and it can never be displaced.

The honest repair is to bound the negative and leave the positive alone, because only the
negative is unrecoverable:

```python
import shutil
import time

_TTL_SECONDS = 30.0
_ffmpeg_cache: tuple[float, bool] | None = None


def has_ffmpeg() -> bool:
    global _ffmpeg_cache
    now = time.monotonic()
    if _ffmpeg_cache is not None:
        checked_at, answer = _ffmpeg_cache
        if answer or now - checked_at < _TTL_SECONDS:
            return answer
    answer = shutil.which("ffmpeg") is not None
    _ffmpeg_cache = (now, answer)
    return answer
```

`time.monotonic()` and not `time.time()`: the docs describe it as *"a monotonic clock, i.e. a
clock that cannot go backwards"* which *"is not affected by system clock updates"*. A TTL
built on the wall clock can be silently extended by an NTP step — a stale-cache bug wearing a
different hat.

And the TTL is still not the guard. The operation is:

```python
import subprocess


class ToolUnavailable(RuntimeError):
    pass


def transcode(src: str, dst: str) -> None:
    if not has_ffmpeg():
        raise ToolUnavailable("ffmpeg")          # advisory, and possibly stale
    try:
        subprocess.run(["ffmpeg", "-i", src, dst], check=True)
    except FileNotFoundError as exc:             # authoritative, always current
        raise ToolUnavailable("ffmpeg") from exc
```

The cached check buys a fast, legible refusal. The `except FileNotFoundError` is what makes
the function correct, and it is why the cached `True` costs nothing here: the leap
re-verifies it, and asks the same question — *can this executable be launched?* The cached
`False` still refuses work that would have succeeded; the TTL only bounds how long, which is
the best a cached negative can ever do.

## Why staleness is the stronger argument

[07 · The cost argument](07-the-cost-argument.md) shows how little the published record
actually says about speed: two sentences in the 3.11 release notes, neither comparing a `try`
with an `if`. Staleness needs no benchmark. It follows from a gap the glossary already
describes, in the language's own documentation, and it does not change sign when the workload
changes — unlike the speed argument, which inverts at a high enough miss rate
([07b](07b-the-miss-rate-decides.md)).

That is why a cached check belongs to **atomicity**, the first question in
[07g](07g-provability-and-the-order-to-decide.md)'s order, and is settled before cost is ever
raised. A cache is not a faster check. It is the same check, with the window widened on
purpose, and the decision was made at step one.

## Gotchas

**★ Symptom: an operator fixes a permission or installs a missing tool, and the service keeps
reporting it as unavailable until a restart.** Cause: a cached negative. The `False` disabled
the only code path that would have discovered the truth, so no amount of retrying reaches the
check again. Fix: bound the negative with a monotonic TTL and leave the positive uncapped, as
in `has_ffmpeg` above — and keep the `except` on the real operation, because the TTL bounds
the wrongness rather than removing it.

**★ Symptom: a "cache warming" step at start-up makes an intermittent bug permanent.** Cause:
warming a cache of predicates runs every check at the single least representative moment in
the process's life — before mounts, before secrets, before the network is up — and then
freezes the results. Fix: warm caches of *derived work keyed by a fingerprint*
([06zg](06zg-keying-the-work-not-the-question.md)), never caches of *predicates about
current state*. If a warm-up must probe availability, have it record a metric and not a
decision.

**★ Symptom: the health check is green and the feature is off.** Cause: the health check
tested the resource directly and the request path consulted a cached predicate, so the two
disagree by construction — and the more reliable the health check, the longer the
contradiction survives triage. Fix: have the health check call the same function the request
path calls. A probe that takes a different route to the answer is testing a system nobody is
running.

**Symptom: a cached negative in one process and a fresh answer in another, on the same host.**
Cause: process-local caches diverge as soon as they are populated at different times; with
several workers you get a fleet where some requests work and some do not, keyed by nothing
the caller can see. Fix: this is the load-balancer bug that is not a load-balancer bug — the
cure is not a shared cache but no cached predicate, because a shared cache makes the stale
answer consistent rather than correct.

## Interview questions

**★ Why is caching a `False` worse than caching a `True`?**
Because a `True` is normally followed by the operation, and the operation re-checks; a `False`
is followed by the other branch, and nothing re-checks anything. If you cache "the tool is
present" and it has since vanished, the subprocess launch raises `FileNotFoundError` and your
handler converts a stale optimism into the correct failure. If you cache "the tool is absent"
and it has since appeared, no code runs that could discover it — the cached answer removed
the only witness. That asymmetry is why the TTL in the example bounds the negative and lets
the positive stand. The caveat is that "the operation re-checks" is only true when the
operation asks the same question: `os.access` and `open()` ask about different uids and,
after a symlink swap, about different files, which is exactly the hole the `os.access` note
describes.

**★ Is a TTL a fix or a smaller bug?**
A smaller bug, deliberately chosen, and it should be described that way in review rather than
as a fix. A 30-second TTL means the program may act on a wrong answer for up to 30 seconds; it
converts an unbounded error into a bounded one, which is a real improvement when the wrong
answer is recoverable and the caller retries. It is not an improvement when the wrong answer
is a security decision or an irreversible action — there, bounded-wrong and unbounded-wrong
are the same category, which is [05d · Irreversible leaps](05d-irreversible-leaps.md)'s
subject. Build it on `time.monotonic()`, *"a clock that cannot go backwards"* which *"is not
affected by system clock updates"*, because a wall-clock TTL can be extended by an NTP
adjustment at the worst possible moment.

**★ The team wants a shared Redis cache so the workers stop disagreeing about whether a file
exists. Good idea?**
No — it fixes the symptom people noticed and makes the real defect harder to see. Divergent
workers are at least self-correcting in aggregate: a retry may land somewhere with a fresher
answer, and the inconsistency is what made anyone look. A shared cache makes every worker
wrong in the same way at the same time, and adds a network round trip to a question the local
filesystem could have answered outright. If the check is expensive enough to want a shared
cache, the thing to share is *derived work under a content-addressed key*, never a predicate
about current state.

**Why does the `has_ffmpeg` example keep the check at all, if the `except` is what makes it
correct?**
Because a check whose only effect is on what the program *says* is legitimate, and this one
is close to that line. It turns a subprocess launch failure into an immediate, specific
refusal, which is better for the caller and better for the logs. The rule from
[06s](06s-the-check-that-lies.md) is the test to apply: if a `False` changes what the program
*does* rather than what it *says*, it is doing load-bearing work and must be correct. Here it
does change what the program does — it refuses — so the TTL is not optional, and neither is
the handler. A version where the check only annotated an error raised by the operation would
need neither.

**Does `@cache` on a zero-argument function have any safe use?**
Yes, for genuinely immutable derived values: a compiled regex, a parsed schema shipped inside
the package, a lookup table built from constants. The key is the empty tuple and there is
exactly one entry, which is fine when the answer cannot change and catastrophic when it can —
the single entry is also single-shot, so a wrong first answer is wrong forever with no
eviction pressure to dislodge it. The question to ask is not "is this expensive?" but "could
the answer differ if this ran a second later?" If yes, the empty-tuple key is the worst
possible key.

---

← Prev: [Keying the work, not the question](06zg-keying-the-work-not-the-question.md) · Index: [EAFP vs LBYL](README.md) · Next → [The cost argument](07-the-cost-argument.md)
