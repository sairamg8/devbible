---
title: "The cost comparison that decides between a look and a leap is not check-versus-try — both are cheap — it is the price of a leap that should not have been made, and once you measure that the rule falls out in both directions"
sidebar_label: "05f · The asymmetry"
sidebar_position: 136
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [What's New in Python 3.11 — Misc](https://docs.python.org/3.14/whatsnew/3.11.html)
> (*"zero-cost" exceptions*, and the ~10% catch improvement),
> [`Path.replace`](https://docs.python.org/3.14/library/pathlib.html#pathlib.Path.replace),
> [Glossary: `EAFP`, `LBYL`](https://docs.python.org/3.14/glossary.html#term-EAFP).
> Target: **Python 3.14**. Documentation-validated; **no timings, no sandbox run** — the
> only cost figures quoted are the two the CPython documentation publishes.

**The cost argument about EAFP and LBYL is almost always run on the wrong quantity. Both
operations are cheap: a membership test is a hash and a comparison, and since 3.11 entering
a `try` that does not raise is documented as costing nothing. What is expensive is neither
of those — it is the *bad leap*: the truncated file, the duplicated charge, the 3,999 rows
written before the loop discovered row 4,000 was invalid. Compare against that instead of
against each other and the rule falls out, in both directions: when the look is microseconds
and the failure is unbounded, buy the check; when the look is a network round trip and the
leap is retryable, the identical argument tells you to delete it.**

## The asymmetry, measured against the right thing

The documentation gives exactly two cost facts, and they are both about exceptions rather
than about checks:

> *""Zero-cost" exceptions are implemented, eliminating the cost of `try` statements when
> no exception is raised."*

> *"A more concise representation of exceptions in the interpreter reduced the time
> required for catching an exception by about 10%."*

Anything more precise than that is a benchmark nobody in the conversation has run. But the
useful conclusion does not need numbers: **the interesting term in the comparison is not
the check and not the `try`, it is what a wrong leap costs.**

| The leap | Cost of getting it wrong | What the asymmetry says |
|---|---|---|
| `d[key]` on a missing key | one raise, one catch | ignore the check; EAFP or `.get` |
| `open(path)` on a missing file | one `OSError` | ignore the check; the docs insist on it |
| a bulk `INSERT` that fails at row 4,000 | 3,999 rows written, or a rollback of real work | validate first, then write |
| an in-place file rewrite that raises mid-write | a truncated file where valid data used to be | write a temp file, then `replace` |
| a payment capture on a cancelled order | a charge to reverse and a support ticket | check first, then claim |
| `DROP COLUMN` against the wrong database | a restore from backup and an incident | check, refuse, and involve a human |

Two consequences, and the second is the one that gets missed.

**When the ratio is large, pay for the check even though it is provably stale.** A guard
that eliminates almost all bad calls in front of an unrecoverable operation is worth two
operations, and it remains worth them after you have accepted that it eliminates *none* of
the race — those are different failure populations, as
[05d](05d-irreversible-leaps.md) works through.

**When the ratio inverts, the same argument deletes the check.** A look that costs a
network round trip in front of a leap that is cheap and retryable is pure waste: an
`exists()` call before a download, a `SELECT` before an idempotent `INSERT`, a `HEAD`
before a `GET`. It doubles the latency, doubles the failure surface, and answers a question
the leap answers better. The asymmetry argument is not pro-LBYL; it is pro-*measuring the
right two things*, and most of the time it comes out against the check.

## The catastrophic leap you can neutralise instead of guarding

Sometimes the right response to the asymmetry is neither a check nor a handler: it is to
make the expensive failure impossible. An in-place rewrite is the canonical case — an
exception halfway through leaves a truncated file where valid data used to be, and no
`if` in front of it helps, because the failure happens *during* the leap rather than
before it.

```python
import json
from pathlib import Path


def write_config(target: Path, config: dict[str, object]) -> None:
    """Never leave a partial file: write beside the target, then rename over it."""
    tmp = target.with_suffix(target.suffix + ".tmp")
    try:
        with tmp.open("w", encoding="utf-8") as fp:
            json.dump(config, fp, indent=2)
            fp.flush()
        tmp.replace(target)          # atomic within a filesystem: readers see old or new
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
```

The cost of the bad leap has been engineered down to "a stray `.tmp` file", at which point
the asymmetry no longer justifies any pre-check at all. That is the strongest move available
whenever you find yourself defending an expensive guard: ask whether the expense can be
removed instead of predicted. The atomic-publication mechanics are
[the filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md); the point
here is the decision rule.

## Gotchas

**Symptom: p99 latency doubled after someone added an "existence check" for safety.**
Cause: the asymmetry running the other way — a network round trip spent to predict a cheap,
retryable operation that reports its own failure precisely. Fix: delete the check and handle
the error; keep a pre-check only where the leap is irreversible or the message quality
genuinely depends on it.

```python
# Was: if bucket.exists(key): body = bucket.download(key)
try:
    body = bucket.download(key)
except ObjectNotFound:
    body = None
```

**Symptom: a pre-check was added "because the operation is expensive", and the operation
turns out to be idempotent.** Cause: expense was confused with irreversibility. A costly but
repeatable call — a large `GET`, a re-computation, a cache warm — loses you time on failure
and nothing else, so the failure is bounded and the handler is enough. Fix: reserve
pre-checks for unbounded failures, and spend the effort on making the expensive call
cacheable or resumable.

**Symptom: the team argues about `try` versus `if` performance in review, with no
measurement on either side.** Cause: the two documented sentences about exception cost get
stretched into a general claim. Fix: settle it structurally instead — pick the form with
fewer operations on shared state, and if the hot path genuinely matters, note that
`if k in d: d[k]` hashes the key twice while `d.get(k, default)` and `try: d[k]` hash it
once. That is a mechanical fact about operation counts, not a timing claim.

## Interview questions

**★ "Exceptions are slow, so I use `if`." What does the documentation actually support?**
Two sentences, and neither one supports that. From What's New in 3.11: *""Zero-cost"
exceptions are implemented, eliminating the cost of `try` statements when no exception is
raised"*, and separately that a change *"reduced the time required for catching an exception
by about 10%"*. So the guard is free on the success path and raising still costs something —
which means EAFP is cheaper when the assumption usually holds and more expensive when it
usually fails. Beyond that the docs publish no figures, and the honest answer names the term
that actually dominates: not the `if` and not the `try`, but the cost of a leap that should
not have been made.

**When does the asymmetry argument tell you to delete a check?**
Whenever the look costs more than the failure. A `SELECT` before an idempotent `INSERT`, an
`exists()` before a download, a `HEAD` before a `GET`, a token-expiry check before a call
that will answer 401 anyway — in each of these the check is a full round trip, the leap
reports its own failure precisely, and the failure costs one retry. The check then adds
latency, an extra dependency on a component that can be down, and a second answer that can
disagree with the first. Keep it only if you need the *message* before attempting, or the
attempt is irreversible.

**Why is "the failed leap is free" the hidden premise of every EAFP argument?**
Because EAFP tests by doing. If the operation is a dictionary lookup, the test costs a raise
and a catch and leaves the world unchanged, so testing by doing is strictly better than
predicting. The moment the operation writes, sends, charges or destroys, "test by doing"
means the test has consequences — and the whole argument has to be re-run with the cost of a
wrong attempt in it. Everything this chunk and its neighbours say about irreversible leaps is
that one premise being false; nothing about exceptions changed.

---

← Prev: [Claim, then leap](05e-claim-then-leap.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Closing the gap with a lock](05g-closing-the-gap-with-a-lock.md)
