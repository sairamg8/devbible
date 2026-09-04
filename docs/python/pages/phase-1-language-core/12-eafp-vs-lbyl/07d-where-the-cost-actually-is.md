---
title: "On any path that touches the disk or the network the guard is a rounding error and the duplicated round trip is the whole cost — which is why the standard library gives you one-call spellings and why the spelling only ever matters in a tight in-process loop a profile has named"
sidebar_label: "07d · Where the cost actually is"
sidebar_position: 151
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Python 3.14 documentation —
> [`pathlib.Path.mkdir` / `Path.unlink`](https://docs.python.org/3.14/library/pathlib.html),
> [`open` mode `'x'`](https://docs.python.org/3.14/library/functions.html#open),
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access),
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict).
> Target: **Python 3.14**. Documentation-validated; **no timings, nothing run**.

**Two chunks of argument about lookups and raises are worth very little on the paths
where most application code spends its time, because on those paths the operation being
guarded is a system call or a network round trip and the guard is a rounding error beside
it. That does not make the choice irrelevant — it inverts which part of it matters. The
expensive thing is not `try` versus `if`, it is that LBYL performs the **expensive**
operation twice: two `stat` calls, two round trips, two requests. The standard library
already ships one-call spellings for most of these, and they are the right answer for
correctness reasons anyway. The spelling itself only becomes the largest remaining term
in a tight in-process loop that a profile has already pointed at — and at that point
there are three cheaper moves to make first. How to measure once you are genuinely there
is [07e · Measuring instead of arguing](07e-measuring-instead-of-arguing.md).**

## The guard is noise; the duplicated round trip is not

Compare what the two spellings actually ask the operating system to do:

```python
# LBYL: two trips into the kernel, and the answer can change between them.
if not os.path.isdir(target):
    os.mkdir(target)

# One trip. The check happens inside the syscall, where it is atomic.
target.mkdir(exist_ok=True)
```

The docs describe the second as doing exactly the job of the first, inside one call:

> *"If exist_ok is false (the default), `FileExistsError` is raised if the target
> directory already exists."* … *"If exist_ok is true, `FileExistsError` will not be
> raised unless the given path already exists in the file system and is not a directory
> (same behavior as the POSIX `mkdir -p` command)."*

The same pattern exists for deletion and for exclusive creation:

> `Path.unlink(missing_ok=False)` — *"If missing_ok is false (the default),
> `FileNotFoundError` is raised if the path does not exist. If missing_ok is true,
> `FileNotFoundError` exceptions will be ignored (same behavior as the POSIX `rm -f`
> command)."*

> mode `'x'` — *"open for exclusive creation, failing if the file already exists"*.

```python
path.unlink(missing_ok=True)          # not: if path.exists(): path.unlink()

try:
    with open(lock_path, "x") as fp:  # not: if not exists: open(..., "w")
        fp.write(str(os.getpid()))
except FileExistsError:
    raise AlreadyRunning(lock_path) from None
```

**The honest form of the "I/O dominates" claim.** No official source publishes a ratio
between a dictionary lookup and a `stat` call, or between a `try` and a database round
trip, and I am not going to invent one. What you can say without any measurement is that
these are **different classes of work** — one stays inside the interpreter, the other
crosses into the kernel or onto the network — and that the LBYL spelling performs the
crossing **twice**. That is the argument. The ratio is your profiler's job, and it is the
only tool in this discussion that knows your disk.

Note that on exactly these paths, LBYL is also the racy spelling: the docs call
`os.access`-then-`open` a *"security hole"* and prescribe EAFP instead
([02b · The filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md)).
When the cheap answer and the correct answer coincide, stop optimising and take it.

## The one case where the spelling really is the cost

A tight, in-process loop with no I/O in it, that a profile has already named. Everywhere
else, this discussion is a way of avoiding work. When you are genuinely there, the order
of moves is:

```python
# 1 · Delete the branch, do not micro-tune it: one lookup, no raise, no double read.
counts = defaultdict(int)
for word in words:
    counts[word] += 1

# 2 · Hoist what does not change out of the loop — this is nearly always bigger than
#     the guard. The attribute lookup and the bound method were the real per-iteration
#     cost, not the choice of guard.
append = out.append
lookup = index.get
for key in keys:
    row = lookup(key)
    if row is not None:
        append(row)

# 3 · Restructure so the miss cannot happen, and both spellings become unreachable.
known = keys & index.keys()
for key in known:
    out.append(index[key])
```

Only after those three does the difference between `try` and `if` become the largest
remaining term, and at that point you are no longer arguing — you are measuring.

## Gotchas

**★ Symptom: the guard on a request handler was micro-optimised and the latency
percentiles did not move.** Cause: the handler makes a database round trip, and both
spellings of the guard pay that once — the guard was never the cost. Fix: stop tuning the
guard and delete the duplicated round trip instead; that is a whole operation removed,
not a fraction of one.

```python
# Two round trips, and a race between them.
if not db.execute("SELECT 1 FROM users WHERE email = %s", [email]).fetchone():
    db.execute("INSERT INTO users (email) VALUES (%s)", [email])

# One round trip; the UNIQUE constraint is the check, and it is atomic.
try:
    db.execute("INSERT INTO users (email) VALUES (%s)", [email])
except UniqueViolation as exc:
    raise DuplicateEmail(email) from exc
```

**★ Symptom: profiling shows the time going into the `except` block, and the raise itself
is not what is expensive — the handler is.** Cause: the published cost claims cover
raising and catching; they say nothing about what *your* handler does, and a handler that
formats a traceback and writes a log line does far more work than the raise it is
reacting to. Fix: aggregate in the loop and report once outside it.

```python
# A traceback formatted and a log line written per bad row.
for row in rows:
    try:
        store(parse(row))
    except ValueError:
        log.exception("bad row")

# Count in the loop; report once.
rejected = []
for row in rows:
    try:
        store(parse(row))
    except ValueError as exc:
        rejected.append((row, str(exc)))
if rejected:
    log.warning("%d of %d rows rejected; first: %r", len(rejected), len(rows), rejected[0])
```

**★ Symptom: an HTTP client sends a `HEAD` before every `GET` "to check the resource is
there", and the service's outbound request count is double what anyone expected.** Cause:
the pre-check is a full network round trip, so the LBYL spelling costs one extra round
trip per call — and the resource can still disappear, or return a different status, between
the two. Fix: make the request you actually want and branch on what comes back.

```python
response = session.get(url)
if response.status_code == 404:
    return DEFAULT_PAYLOAD
response.raise_for_status()
return response.json()
```

**Symptom: a `try` was replaced by an `if` on an I/O path "to avoid the exception", and
now the code has a TOCTOU bug that only appears under load.** Cause: the exception was
never the cost, and the check-then-act rewrite introduced the gap the docs warn about —
`os.access` before `open` is described as creating *"a security hole"*. Fix: put the
single atomic call back.

```python
try:
    with open(path) as fp:
        return fp.read()
except (FileNotFoundError, PermissionError):
    return DEFAULT_DATA
```

## Interview questions

**★ Where is the cost of this choice genuinely irrelevant?**
Anywhere the guarded operation leaves the interpreter — a file read, a `stat`, a socket, a
database round trip, a subprocess. Both spellings pay that same operation at least once,
so the difference between them is a fraction of the cheap part. What is *not* irrelevant
on those paths is that LBYL performs the expensive operation twice: `exists` then `open`,
`SELECT` then `INSERT`, `HEAD` then `GET`. Removing the duplicate is a real saving of a
whole round trip, and it fixes the race at the same time. So on I/O paths EAFP tends to
win the cost argument for a reason that has nothing to do with exception machinery.

**Why is it wrong to hoist the "avoid the exception" rewrite onto an I/O path?**
Because on an I/O path the pre-check is not a cheap guard, it is a second syscall or a
second round trip, and the interval between the two is exactly the window the standard
library warns about — the `os.access` documentation calls the check-then-open pattern
*"a security hole"* and says *"it's preferable to use EAFP techniques"*. You would be
paying a second expensive operation to buy a race condition. The single atomic call, with
the exception as its failure channel, is both cheaper in operations and correct.

**Your loop is slow and it uses EAFP. What do you try before touching the guard?**
Remove the need for the branch entirely — `defaultdict`, `Counter`, `get` with a default,
or precomputing the intersection of keys so the miss cannot occur. Then hoist the
invariant work out of the loop: repeated attribute lookups and bound-method resolution
happen every iteration and are usually a bigger term than the guard. Then reconsider the
data structure, because the wrong container is worth more than any spelling. The guard is
the last thing to touch, and only with a profile pointing at that line.


**Without a profiler in front of you, how can you tell whether this choice can possibly
matter on a given line?**
Count boundary crossings in the operation being guarded, not cycles. If the guarded
operation leaves the process — a syscall, a socket, a subprocess, a database — then the
difference between `try` and `if` is a fraction of the cheap part and cannot matter, while
the *duplication* of that crossing very much can; so the answer there is "remove the second
crossing", never "tune the guard". If everything stays inside the interpreter and it is
inside a loop that runs often, the spelling is at least in the running — and that is the
point at which you stop reasoning and get a profile. Either way you have decided something
useful without measuring anything.

---

← Prev: [The double-work argument](07c-the-double-work-argument.md) · Index: [EAFP vs LBYL](README.md) · Next → [Measuring instead of arguing](07e-measuring-instead-of-arguing.md)
