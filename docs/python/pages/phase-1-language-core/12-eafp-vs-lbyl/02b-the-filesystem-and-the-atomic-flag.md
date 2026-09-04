---
title: "On a filesystem there is no such thing as a look: os.access before open is documented as a security hole, Path.exists collapses three different failures into False, and the fix is always an operation that decides and acts in one step"
sidebar_label: "02b · The filesystem and the atomic flag"
sidebar_position: 123
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access),
> [`os.path.exists` / `lexists` / `isfile`](https://docs.python.org/3.14/library/os.path.html),
> [`pathlib`](https://docs.python.org/3.14/library/pathlib.html)
> (`Path.exists`, `Path.is_file`, `Path.mkdir`, `Path.unlink`),
> [`open()` modes](https://docs.python.org/3.14/library/functions.html#open),
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html) (`OSError`
> subclasses). Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**The filesystem is the case where LBYL stops being a style question and becomes a
documented defect. Two facts do it. First, a check and an operation are two syscalls, and
the interval between them belongs to every other process on the machine — the `os.access`
documentation calls the pattern a *"security hole"* in those words and prints the EAFP
rewrite it wants instead. Second, a filesystem "look" answers a much coarser question
than the operation does: `Path.exists()` returns `False` for a path that is *"invalid,
inaccessible or missing"* alike, so the branch you take reports the case you guessed at
rather than the case you have. What replaces the check is never a better check — it is a
call that decides and acts together: `exist_ok`, `missing_ok`, or exclusive-creation
mode.**

## The filesystem: the docs call this one a security hole

The `os.access` entry does not merely prefer EAFP, it names LBYL as a vulnerability:

> *"Using `access()` to check if a user is authorized to e.g. open a file before actually
> doing so using `open()` creates a security hole, because the user might exploit the
> short time interval between checking and opening the file to manipulate it. It's
> preferable to use EAFP techniques."*

And a second note that kills the check on its own terms:

> *"I/O operations may fail even when `access()` indicates that they would succeed,
> particularly for operations on network filesystems which may have permissions semantics
> beyond the usual POSIX permission-bit model."*

So the check can be *out of date* (the race) and *wrong when it was made* (network
filesystems). What is left for it to do? The same reasoning applies to every
`os.path.exists` / `Path.is_file` guard in front of an `open`:

```python
# 🔴 Two syscalls, one gap. The file can vanish, be replaced, or be a symlink swap.
if os.path.exists(path):
    with open(path) as f:
        return f.read()
return ""

# One syscall. The kernel resolves and opens the same object, atomically.
try:
    with open(path) as f:
        return f.read()
except FileNotFoundError:
    return ""
```

**A "look" at the filesystem also answers a coarser question than you think.** The
`pathlib` docs say `Path.exists()` returns *"`False` … if the path is invalid,
inaccessible or missing"* and that you should *"use `Path.stat()` to distinguish between
these cases"* — that is, catch the exception, because `stat()` raises. The `os.path`
version is blunter still:

> *"Return `True` if path refers to an existing path or an open file descriptor. Returns
> `False` for broken symbolic links. On some platforms, this function may return `False` if
> permission is not granted to execute `os.stat()` on the requested file, even if the path
> physically exists."*

Three distinct realities — *not there*, *there but I cannot see it*, *there but a broken
link* — collapse into one `False`, and your error message then tells the user the file is
missing when it is a permissions problem. The exception from `open()` distinguishes them
for free: `FileNotFoundError`, `PermissionError`, `IsADirectoryError`,
`NotADirectoryError` are separate types with `errno` and `filename` attached. (For the
broken-symlink case specifically, `os.path.lexists` exists: *"Return `True` if path refers
to an existing path, including broken symbolic links."*)

### The atomic operations the filesystem API already gives you

For the three most common filesystem LBYL patterns, the leap itself takes a flag and the
check disappears:

```python
from pathlib import Path

# Create a directory if it is not there. Was: if not p.exists(): p.mkdir()
Path("var/cache").mkdir(parents=True, exist_ok=True)

# Delete a file if it is there. Was: if p.exists(): p.unlink()
Path("var/cache/stale.json").unlink(missing_ok=True)

# Create a file only if nobody else has. No check can express this — the mode can.
try:
    with open("var/run/import.lock", "x") as lock:
        lock.write(str(os.getpid()))
except FileExistsError:
    raise AlreadyRunning("another import holds the lock")
```

The documented semantics, verbatim: `mkdir` — *"If exist_ok is true, `FileExistsError`
will not be raised unless the given path already exists in the file system and is not a
directory (same behavior as the POSIX `mkdir -p` command)"*; `unlink` — *"If missing_ok is
true, `FileNotFoundError` exceptions will be ignored (same behavior as the POSIX `rm -f`
command)"*; mode `'x'` — *"open for exclusive creation, failing if the file already
exists"*. The last one is the important one conceptually: **exclusive creation is a
test-and-set the kernel performs in one step, and no amount of `if not exists()` can
emulate it.** That is the shape of every correct answer to a race — not a better check,
but an operation that decides and acts together.

## Gotchas

**★ Symptom: `FileNotFoundError` on the `open()` line inside `if os.path.exists(path):`.**
Cause: two syscalls with a gap — a cleanup job, a log rotator, a container restart or a
test fixture removed the file in between. Fix: drop the check and handle the failure of
the real call.

```python
try:
    with open(path) as f:
        return f.read()
except FileNotFoundError:
    return ""
```

**★ Symptom: `FileExistsError` from `mkdir` in code that checked `if not p.exists()` —
only ever under load, or in parallel CI.** Cause: two processes both saw "missing" and
both created. Fix: the flag, which the kernel applies atomically.

```python
Path(target).mkdir(parents=True, exist_ok=True)
```

**★ Symptom: the error message says "file not found" and the file is plainly there.**
Cause: an LBYL check on `Path.exists()`, which returns `False` for *"invalid, inaccessible
or missing"* alike — so you reported the only case you thought about. Fix: let the
operation raise and report the exception's own type; `PermissionError` and
`FileNotFoundError` are different sentences to a user.

```python
try:
    return path.read_text(encoding="utf-8")
except FileNotFoundError:
    raise ConfigMissing(path) from None
except PermissionError as exc:
    raise ConfigUnreadable(path, exc.errno) from exc
```

**Symptom: a security review flags an `os.access` call in front of an `open`.** Cause:
the documented TOCTOU hole — the interval between checking and opening is attacker-usable,
and on a network filesystem the check can be wrong even without an attacker. Fix: the
docs' own rewrite, which guards only the `open` and puts the read in `else:`.

**Symptom: code that checks for a broken symlink reports it as absent, then fails to
create the file.** Cause: `os.path.exists` *"returns `False` for broken symbolic links"*,
so the "it is not there, I will create it" branch runs and the create hits the existing
link. Fix: `os.path.lexists` where presence-including-broken-links is genuinely the
question — otherwise attempt the operation and handle `FileExistsError`.

**Symptom: a test suite passes serially and fails with `pytest -n auto`.** Cause: LBYL
against a shared temp path — every worker checked, saw nothing, and created. Fix:
per-worker directories (pytest's `tmp_path` is already unique per test) and
`exist_ok=True` on anything shared.

**Symptom: two cron runs of the same importer overlap and both "hold the lock".** Cause:
`if not os.path.exists(lockfile): create()` — a check and a create with a gap, which is
exactly what mutual exclusion cannot be built from. Fix: exclusive creation mode, which
is a test-and-set the kernel performs in one step.

```python
try:
    with open("var/run/import.lock", "x") as lock:
        lock.write(str(os.getpid()))
except FileExistsError:
    raise AlreadyRunning("another import holds the lock")
```

**Symptom: `shutil.rmtree` or `unlink` raises `FileNotFoundError` in a cleanup path that
"already checked".** Cause: two things cleaning up the same directory, or the same
cleanup running twice on a retry. Fix: `missing_ok=True` for a file — documented as
*"`FileNotFoundError` exceptions will be ignored (same behavior as the POSIX `rm -f`
command)"* — and for a tree, catch `FileNotFoundError` around the whole call. A cleanup
step should be idempotent by construction, not by inspection.

**Symptom: an `is_file()` check passes and the subsequent `open()` raises
`IsADirectoryError`.** Cause: the path was replaced between the two calls, or the check
followed a symlink that now points elsewhere. `is_file()` *"normally follows symlinks"*,
so it answers a question about the target at look-time, not at leap-time. Fix: open it
and handle the type errors — `IsADirectoryError` and `NotADirectoryError` are distinct
`OSError` subclasses precisely so you can.

**Symptom: a permission check passes in development and fails in production on the same
code.** Cause: `os.access` uses *"the real uid/gid"* while most operations use the
effective one, so a suid/sgid or container-user difference makes the check answer for the
wrong identity. Fix: stop asking and attempt the operation; `PermissionError` is
authoritative because it comes from the same call that would have failed anyway.

**Symptom: "we check that the file exists so we can give a nicer error" — and the nice
error now appears for unreadable files, full disks and dangling mounts.** Cause: one
`False` standing in for every `OSError`. Fix: keep the friendly message, but derive it
from the exception you caught rather than from a check you made; the `OSError` subclass
hierarchy is the taxonomy you were trying to invent.

## Interview questions

**★ Why is `open(path, "x")` interesting?**
Because it is a test-and-set that Python code cannot express with an `if`. Documented as
*"open for exclusive creation, failing if the file already exists"*, it asks the kernel to
create the file *only* if it does not exist and to fail otherwise — one atomic decision.
`if not exists(): open(path, "w")` is the same intent with a race in the middle. It is
the cleanest illustration of the general principle: the fix for a race is not a better
check, it is an operation that decides and acts together.

**★ Why does `Path.exists()` returning `False` make a poor error message?**
Because it is three different facts wearing one value. The docs say `False` is returned
*"if the path is invalid, inaccessible or missing"*, and recommend `Path.stat()` — which
raises — to tell them apart. So an LBYL branch can only report the case you guessed at,
usually "not found", while the actual cause may be a permission or a path-type problem.
The exception from the real operation carries the distinction in its type, plus `errno`
and `filename`.

**★ The documentation calls one Python pattern a security hole. Which, and what is the
mechanism?**
`os.access` before `open`: *"Using `access()` to check if a user is authorized to e.g.
open a file before actually doing so using `open()` creates a security hole, because the
user might exploit the short time interval between checking and opening the file to
manipulate it."* The mechanism is that the check and the open resolve the path separately,
so between them an attacker can replace a benign path with a symlink to something
sensitive — the check passed on one object and the open acted on another. The
documentation's own remedy is *"EAFP techniques"*.

**In the docs' EAFP rewrite of the `access()` example, why is the read in an `else:`
clause?**
So that only the `open()` call is guarded. If `with fp: return fp.read()` sat inside the
`try`, a `PermissionError` raised by the *read* — or by anything else in that block —
would be absorbed by a handler written for the open. The `else` clause runs only when the
`try` body completed without raising, which keeps one assumption to one handler. That
clause is [topic 11's](../11-exceptions/02-the-else-clause.md) subject.

**Is there a race in `if not os.path.exists(lockfile): create_lock()`?**
Yes, the classic one: two processes both find no lock file and both proceed to "hold" it.
This is the pattern `open(path, "x")` exists for. The wider lesson is that mutual
exclusion cannot be built out of a check and a create in Python code — it has to come
from a primitive that is exclusive one level down: an exclusive file mode, a `UNIQUE`
constraint, an OS-level lock, or a real lock manager.

**When is `os.path.exists` the right call to make?**
When existence itself is the answer you want, not a precondition for something else — a
health check that reports which of several config locations are populated, a diagnostic
that lists missing fixtures, a `--dry-run` that says what it would create. The
distinguishing question is whether you *act* on the result: reporting is safe, and
leaping is not.

**Why does `os.access` sometimes answer for a different user than the one who will do the
work?**
Because it deliberately *"use[s] the real uid/gid to test for access to path"*, while most
operations use the effective uid/gid — the entry says so in its first sentence and offers
`effective_ids=True` where the platform supports it. In a suid/sgid program, or a
container whose user differs from the file owner, the check and the operation can be
asking about two different identities. That is a second, independent reason the check
cannot substitute for the attempt.

**Both `exist_ok=True` and `except FileExistsError` express "do not fail if it is already
there". Which is better?**
The flag, when the API has one. It is one call rather than two, its scope is exactly the
one exception the operation can raise for that reason, and it cannot accidentally absorb
a `FileExistsError` from some other line inside the same `try`. Prefer the flag; keep the
handler for the cases where no flag exists — `open(..., "x")` is the notable one, where
the exception *is* the return channel.

---

← Prev: [The race between look and leap](02-the-race-between-look-and-leap.md) · Index: [EAFP vs LBYL](README.md) · Next → [Databases, networks and where the race test clears LBYL](02c-databases-queues-and-when-lbyl-clears.md)
