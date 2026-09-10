---
title: "The other half of the ambient-state problem is a guard that runs and answers wrongly — os.access documents three independent reasons its True is not the answer you wanted, os.path.exists documents two reasons its False is a lie, and pathlib collapses three distinct failures into one boolean"
sidebar_label: "06s · The check that lies"
sidebar_position: 169
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 library reference — [`os.access`](https://docs.python.org/3.14/library/os.html#os.access)
> (both notes, the real-vs-effective uid paragraph, `effective_ids` and `os.supports_effective_ids`),
> [`os.path.exists` / `lexists` / `isfile`](https://docs.python.org/3.14/library/os.path.html#os.path.exists),
> [`pathlib.Path.exists` / `Path.is_file`](https://docs.python.org/3.14/library/pathlib.html#pathlib.Path.exists).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06m](06m-the-guard-the-platform-deletes.md) covered the guard the interpreter deletes.
This one covers the guard that survives, executes, returns a confident boolean — and is
wrong. `os.access` documents three independent reasons its answer may not be the answer
you act on: it goes stale, it is asked in a permission model the filesystem may not use,
and it is asked about a different identity than the one that will do the work.
`os.path.exists` documents two reasons its `False` is a lie, and `pathlib` documents that
its `False` merges three separate outcomes and tells you to catch an exception to tell
them apart. None of these apply to a `try` around the operation, because the operation is
the question. The chunk closes the whole width argument with the three questions to ask of
any guard.**

## What `os.access` admits about itself

The `os.access` entry that supplied [06g](06g-width-at-a-boundary.md)'s rewrite carries a
**second** note, and it is the strongest argument in the standard library for making the
operation itself the guard:

> *"I/O operations may fail even when `access()` indicates that they would succeed,
> particularly for operations on network filesystems which may have permissions semantics
> beyond the usual POSIX permission-bit model."*

The first note says the check goes **stale** — the window between the check and the open is
exploitable, which is [02b](02b-the-filesystem-and-the-atomic-flag.md)'s subject. This one
says the check can be **wrong on arrival**, with no race required and no attacker involved:
the file's real access rules are simply not expressible in the model `access()` queries.

And a third sentence in the same entry says it may not be asking about the right principal:

> *"Use the real uid/gid to test for access to path. Note that most operations will use the
> effective uid/gid, therefore this routine can be used in a suid/sgid environment to test if
> the invoking user has the specified access to path."*

That is a deliberate feature with one narrow use — asking "may the *invoking* user do this?"
in a setuid program — and a trap everywhere else, because `open()` will act as the effective
user. The parameter that switches it is not portable:

> *"If `effective_ids` is `True`, `access()` will perform its access checks using the
> effective uid/gid instead of the real uid/gid. `effective_ids` may not be supported on your
> platform; you can check whether or not it is available using `os.supports_effective_ids`.
> If it is unavailable, using it will raise a `NotImplementedError`."*

Three independent failure modes — stale, wrong model, wrong identity — plus a fix for the
third that raises on some platforms. None of them apply to a `try` around `open()`, because
it *is* the operation whose result you wanted.

### `os.path.exists` lies too, and more quietly

`os.access` at least documents its problems under a **Note** heading. The function people
actually reach for buries the same class of caveat in its one-paragraph description:

> *"Return `True` if path refers to an existing path or an open file descriptor. Returns
> `False` for broken symbolic links. On some platforms, this function may return `False` if
> permission is not granted to execute `os.stat()` on the requested file, even if the path
> physically exists."*

Two distinct falsehoods in one sentence. A broken symlink *exists* as a directory entry and
`exists()` says `False` — use `os.path.lexists`, which is documented to *"Return `True` if
path refers to an existing path, including broken symbolic links"*, if that distinction
matters. And a file you cannot `stat` reports as absent, so an `exists()` check on a
permission-restricted directory produces "no such file" for a file that is right there,
after which your code creates it, or reports a 404, or skips a migration.

```python
# 🔴 Reports "config not found" for a config that exists but is not stat-able,
#    and for a symlink whose target moved.
if not os.path.exists(path):
    return DEFAULTS
with open(path) as fp:
    return json.load(fp)
```

```python
try:
    fp = open(path)
except FileNotFoundError:          # the real, specific answer, from the real operation
    return DEFAULTS
else:
    with fp:
        return json.load(fp)       # PermissionError is now distinct, and escapes
```

The EAFP version distinguishes three outcomes the LBYL version collapses into one: the file
is absent, the file is unreadable, the file is unparseable.

### `pathlib` says the quiet part out loud

The modern API does not hide it — it documents the collapse and then prescribes the EAFP
remedy in the same two sentences:

> *"Return `True` if the path points to an existing file or directory. `False` will be
> returned if the path is invalid, inaccessible or missing. Use `Path.stat()` to distinguish
> between these cases."*

`Path.is_file` repeats it, with a fourth outcome folded in:

> *"Return `True` if the path points to a regular file. `False` will be returned if the path
> is invalid, inaccessible or missing, or if it points to something other than a regular
> file. Use `Path.stat()` to distinguish between these cases."*

Read that recommendation for what it is. `Path.stat()` does not return a richer boolean — it
**raises**, with the specific `OSError` subclass for the specific failure. The documented way
to get an accurate answer out of a `pathlib` predicate is to stop calling the predicate and
call something that can raise. That is EAFP, prescribed by the API that looks the most
LBYL-friendly in the standard library.

A `Path.exists()` guard is therefore three guards' worth of ambiguity in one `if`:

```python
# 🔴 One False, four causes: missing, unreadable parent, invalid path, not a file.
if not config_path.is_file():
    return DEFAULTS
return json.loads(config_path.read_text())
```

```python
try:
    text = config_path.read_text()
except FileNotFoundError:
    return DEFAULTS                       # genuinely absent
except IsADirectoryError:
    raise ConfigInvalid(f"{config_path} is a directory")
except PermissionError:
    raise ConfigUnreadable(config_path)   # present, and someone must fix the mount
return json.loads(text)
```

⚠️ Note the version boundary if you are tempted to keep the predicate and make it precise:
`Path.exists()` only grew `follow_symlinks` in **3.12**, `Path.is_file()` only in **3.13**, and
on anything older the symlink half of the question cannot be asked through `pathlib` at all.

## The three questions to ask of any guard

The topic collapses to this. Before trusting a `try`, ask in order:

1. **Does the class match?** Is it what the callee documents, and is it the leaf rather than
   a base? — [06c](06c-the-breadth-of-one-class.md)
2. **Does the scope match?** Is the guarded suite the one expression that can fail, with the
   consumer in `else`? — [06g](06g-width-at-a-boundary.md)
3. **Does this process make it raise at all?** Contexts, warning filters, `-O`, platform. —
   [06j](06j-ambient-state-the-guard-cannot-see.md), [06m](06m-the-guard-the-platform-deletes.md)
   and this page

Questions 1 and 2 are answerable by reading the file. Question 3 is not, which is why it is
the one that survives review and reaches production.

## Gotchas

**★ Symptom: `os.access(path, os.R_OK)` returned `True` and the `open()` on the next line
raised anyway.** Cause: the documented one — *"I/O operations may fail even when `access()`
indicates that they would succeed, particularly for operations on network filesystems"* — and
`access()` tests the real uid/gid while the open will use the effective one. Fix: delete the
check; the operation is the only reliable test.

```python
try:
    fp = open(path)
except PermissionError:
    return "some default data"
else:
    with fp:
        return fp.read()
```

**★ Symptom: `os.path.exists()` says a file is missing and `ls` says it is there.** Cause:
*"this function may return `False` if permission is not granted to execute `os.stat()` on the
requested file, even if the path physically exists"* — and it also returns `False` for a
broken symlink. Fix: open the file; if you truly need the existence question and nothing
else, `lexists` at least answers the symlink half honestly.

```python
try:
    fp = open(path)
except FileNotFoundError:
    return DEFAULTS                # absent
except PermissionError:
    raise ConfigUnreadable(path)   # present but not readable — a different problem
else:
    with fp:
        return json.load(fp)
```

**★ Symptom: an upload handler reports "file not found" for files that were definitely
written, and only in the container.** Cause: `Path.exists()` — *"`False` will be returned if
the path is invalid, inaccessible or missing"* — a mode-`0700` mount directory owned by
another uid makes every path inside it "missing" to a process that cannot traverse it. The
predicate cannot express "I was not allowed to look". Fix: do what the docs tell you and use
the call that raises, then let the two causes carry different names.

```python
try:
    size = upload_path.stat().st_size
except FileNotFoundError:
    raise UploadMissing(upload_path)          # really absent
except PermissionError:
    raise StorageMisconfigured(upload_path)   # the mount, not the upload
```

**Symptom: `os.access(path, os.R_OK, effective_ids=True)` raised `NotImplementedError` in
production and not on the developer's laptop.** Cause: *"`effective_ids` may not be supported
on your platform; you can check whether or not it is available using
`os.supports_effective_ids`. If it is unavailable, using it will raise a
`NotImplementedError`."* Fix: do not repair the check — remove it. If you genuinely need the
pre-flight for a user-facing message rather than for control flow, gate it on the capability
set and say which identity you asked about.

```python
if "effective_ids" in os.supports_effective_ids:
    readable = os.access(path, os.R_OK, effective_ids=True)
else:
    readable = os.access(path, os.R_OK)     # answers about the real uid; say so in the UI
```

**Symptom: a health check reports a required data file as present, and the worker that
opens it fails.** Cause: the health check ran `os.path.isfile`, which is documented to
follow symbolic links — *"This follows symbolic links, so both `islink()` and `isfile()` can
be true for the same path"* — so a symlink to a file on a volume the worker does not have
mounted still reports `True` from a process that does. Two processes, two views, one
boolean. Fix: a health check that claims a file is usable must open it, in the process that
will use it.

```python
def check_dataset(path):
    try:
        with open(path, "rb") as fp:
            fp.read(1)
    except OSError as exc:                 # covers absent, unreadable, bad mount, EIO
        return Unhealthy(f"{path}: {exc}")
    return Healthy()
```

## Interview questions

**★ The `os.access` entry has a second note, about network filesystems. Why does it matter to
the width argument?** Because it removes the last defence of the check-first shape. The first
note is the race — the check goes stale between checking and opening, and an attacker can
exploit the window. The second says the check can be wrong with no race and no attacker at
all: *"I/O operations may fail even when `access()` indicates that they would succeed,
particularly for operations on network filesystems which may have permissions semantics
beyond the usual POSIX permission-bit model."* And a third sentence says it may not be asking
about the right principal: it *"Use[s] the real uid/gid"* while *"most operations will use
the effective uid/gid"*. Stale, wrong model, wrong identity — the `try` around `open()` has
none of the three, because it is the operation whose result you wanted in the first place.

**★ `os.path.exists()` returned `False` for a file that is definitely there. Give two
documented reasons.**
Broken symlink and unreadable parent. The docs cover both in the same paragraph: it *"Returns
`False` for broken symbolic links"*, and *"On some platforms, this function may return `False`
if permission is not granted to execute `os.stat()` on the requested file, even if the path
physically exists."* The second is the operationally nastier one, because it converts a
permissions problem into a "not found" and sends whoever is debugging in the wrong direction
entirely — they go looking for a missing deployment artefact. `os.path.lexists` fixes the
symlink half by design; nothing fixes the permissions half, which is the argument for opening
the file and letting `FileNotFoundError` and `PermissionError` stay distinct.

**★ `pathlib` is the modern API. Does it fix the problem?**
No — it documents it and then prescribes EAFP. `Path.exists()` states plainly that *"`False`
will be returned if the path is invalid, inaccessible or missing"* and that you should *"Use
`Path.stat()` to distinguish between these cases"*, and `Path.is_file()` adds a fourth case
("points to something other than a regular file") to the same collapsed `False`. The
recommended remedy is a call that **raises** rather than a predicate that returns, which is
the whole EAFP argument stated by the standard library about its own LBYL surface. The one
thing `pathlib` genuinely improved is the symlink question, and only recently:
`follow_symlinks` arrived on `Path.exists()` in 3.12 and on `Path.is_file()` in 3.13.

**`os.access` has an `effective_ids` parameter. Does using it fix the security note?**
No, and reaching for it usually means the first note was not read. `effective_ids` fixes only
the *identity* mismatch — *"`access()` will perform its access checks using the effective
uid/gid instead of the real uid/gid"* — and it does not exist everywhere: *"`effective_ids`
may not be supported on your platform … If it is unavailable, using it will raise a
`NotImplementedError`."* The race is untouched, and so is the network-filesystem note. You
would have swapped one wrong answer for a more precisely wrong answer, on the platforms that
support it. The documented recommendation is to stop asking and open the file.

**Is there any legitimate use left for `os.access`?**
Two, and neither is control flow. The first is the one the docs single out: a setuid or
setgid program asking whether the *invoking* user — the real uid — may reach a path, which is
a genuine authorisation question that `open()` cannot answer because `open()` will act as the
effective user. The second is user experience: printing "that directory does not look
writable" *before* a long job starts, provided the job still opens the file and still handles
the exception, so a wrong pre-flight only costs a misleading message and never a wrong
decision. The rule that separates the two: if a `False` from `access()` changes what the
program *does* rather than what it *says*, it is the security hole the docs describe.

---

← Prev: [The guard the platform deletes](06m-the-guard-the-platform-deletes.md) · Index: [EAFP vs LBYL](README.md) · Next → [The cost argument](07-the-cost-argument.md)
