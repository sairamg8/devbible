---
title: "The width axis that survives review is the one where the code looks tight: except OSError around a single open() covers fifteen documented situations, and since 3.3 it owns every socket failure in the same block too"
sidebar_label: "06c · The breadth of one class"
sidebar_position: 143
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html) reference —
> the `OSError` entry, its `errno` / `strerror` / `filename` attributes, its
> constructor-dispatch note, the **3.3** merge note, and the complete "OS exceptions"
> list, all quoted verbatim below. Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**Axes 1 and 2 from [06](06-narrowing-the-try.md) are visible: you can count statements
and you can count commas. Axis 3 is not, and that is why it survives review — a
one-statement `try` with a single `except OSError` clause looks like exemplary narrow
EAFP and covers fifteen separately documented situations with fifteen different right
answers. Since Python 3.3 it also covers every socket error, because `socket.error` was
merged into `OSError`, and there is no longer any class meaning "file I/O only". This
chunk is `OSError` in full — the question that picks a class, the fifteen subclasses with
their `errno` values, the one situation that has no subclass at all, and the ladder to
climb when nothing narrower exists. The other broad classes people reach for —
`LookupError`, `AttributeError`, `ValueError`, `Exception` — are
[06d](06d-the-lookup-classes.md).**

## The question that picks the class

> **Name the narrowest class whose failures your recovery is correct for — not the
> narrowest class your `try` can raise.**

Those are different, and the difference is the whole chunk. `open()` can raise
`OSError`, so `except OSError` looks like a tight fit for the *operation*. But if the
recovery is `return DEFAULT_CONFIG`, the question is which failures that answer is right
for, and there is exactly one: the file does not exist yet. Everything else `OSError`
covers — a full disk, a permission change, a directory in the way, a broken mount —
becomes a node quietly serving defaults.

## `OSError`: fifteen classes and one merge you have to know about

The reference:

> *"This exception is raised when a system function returns a system-related error,
> including I/O failures such as "file not found" or "disk full" (not for illegal
> argument types or other incidental errors)."*

And the fact that decides how wide `except OSError` really is:

> *Changed in version 3.3: `EnvironmentError`, `IOError`, `WindowsError`,
> `socket.error`, `select.error` and `mmap.error` have been merged into `OSError`, and
> the constructor may return a subclass.*

🔴 **`socket.error` is `OSError`.** So an `except OSError` written around a file read, in
a function that also talks to a cache or a database in the same suite, owns every network
failure in that suite as well. There is no separate "I/O errors" class to reach for; the
merge removed it.

The documented subclasses, each with the `errno` it corresponds to — this is the list an
`except OSError` clause is signing for:

| Class | The documented situation | `errno` |
|---|---|---|
| `FileNotFoundError` | *"Raised when a file or directory is requested but doesn't exist."* | `ENOENT` |
| `FileExistsError` | *"Raised when trying to create a file or directory which already exists."* | `EEXIST` |
| `PermissionError` | *"Raised when trying to run an operation without the adequate access rights - for example filesystem permissions."* | `EACCES`, `EPERM`, `ENOTCAPABLE` |
| `IsADirectoryError` | *"Raised when a file operation (such as `os.remove()`) is requested on a directory."* | `EISDIR` |
| `NotADirectoryError` | *"Raised when a directory operation (such as `os.listdir()`) is requested on something which is not a directory."* | `ENOTDIR` |
| `BlockingIOError` | *"Raised when an operation would block on an object (e.g. socket) set for non-blocking operation."* | `EAGAIN`, `EALREADY`, `EWOULDBLOCK`, `EINPROGRESS` |
| `InterruptedError` | *"Raised when a system call is interrupted by an incoming signal."* | `EINTR` |
| `ChildProcessError` | *"Raised when an operation on a child process failed."* | `ECHILD` |
| `ProcessLookupError` | *"Raised when a given process doesn't exist."* | `ESRCH` |
| `TimeoutError` | *"Raised when a system function timed out at the system level."* | `ETIMEDOUT` |
| `ConnectionError` | *"A base class for connection-related issues."* | — |
| `BrokenPipeError` | *"…raised when trying to write on a pipe while the other end has been closed, or trying to write on a socket which has been shutdown for writing."* | `EPIPE`, `ESHUTDOWN` |
| `ConnectionAbortedError` | *"…raised when a connection attempt is aborted by the peer."* | `ECONNABORTED` |
| `ConnectionRefusedError` | *"…raised when a connection attempt is refused by the peer."* | `ECONNREFUSED` |
| `ConnectionResetError` | *"…raised when a connection is reset by the peer."* | `ECONNRESET` |

⚠️ **And note what is *not* in the table: disk full.** The `OSError` description names
*"disk full"* as an example of what the class covers, and no documented subclass
corresponds to `ENOSPC`. So the situation you most want to distinguish from "file
missing" is the one you cannot distinguish by class at all — only by reading `errno`:

```python
import errno

try:
    fp = open(config_path)
except FileNotFoundError:
    return DEFAULT_CONFIG                       # the one case the default is for
except OSError as exc:
    if exc.errno == errno.ENOSPC:               # no subclass exists for this
        raise DiskFull(config_path) from exc
    raise
else:
    with fp:
        return parse_config(fp)
```

`OSError` also carries the diagnosis, which is the strongest argument for catching the
narrow class and *reading* the object rather than catching the broad one and discarding
it: `errno` is *"A numeric error code from the C variable `errno`"*, `strerror` is *"The
corresponding error message, as provided by the operating system"*, and `filename` is
*"the file name passed to the function"*.

One more mechanical detail from the same entry, because it surprises people writing
custom exceptions:

> *"The constructor often actually returns a subclass of `OSError`, as described in OS
> exceptions below. The particular subclass depends on the final `errno` value. This
> behaviour only occurs when constructing `OSError` directly or via an alias, and is not
> inherited when subclassing."*

So `OSError(errno.ENOENT, "nope")` gives you a `FileNotFoundError`, but your own
`class StorageError(OSError)` does not get that behaviour.

## The narrowing ladder

When a class is too broad and there is no narrower one, you have three options, in this
order of preference:

1. **A narrower documented subclass** — `FileNotFoundError` rather than `OSError`,
   `json.JSONDecodeError` rather than `ValueError`, the library's own class rather than
   a builtin.
2. **Catch the broad class, inspect an attribute, re-raise what is not yours** —
   `exc.errno`, a driver's `exc.pgcode`, an HTTP client's `exc.response.status_code`.
   The `raise` with no argument re-raises the original with its traceback intact; topic
   11's [06 · The `raise` statement](../11-exceptions/06-the-raise-statement.md) covers
   why a bare `raise` beats `raise exc`.
3. **Do not catch it here.** If neither of the first two produces a handler you can
   describe in one sentence, the frame is wrong — move the handler to one that has enough
   context to decide.

The same ladder applies to the other broad classes, and three of them have traps
`OSError` does not: `LookupError` can be raised by `codecs.lookup()`, `AttributeError`
covers assignment as well as reference, and `ValueError` is defined *residually*. Those
are
[06d · The lookup classes](06d-the-lookup-classes.md) and
[06e · Attribute, value and `Exception`](06e-attribute-value-and-exception.md).

## Gotchas

**★ Symptom: a node with a full disk serves the bundled default configuration.** Cause:
axis 3 — `except OSError` around the config load covers `ENOSPC`, `EACCES` and `ENFILE`
as enthusiastically as it covers "the file is not there yet", and no `OSError` subclass
exists for a full disk. Fix: name the one subclass the fallback is for, and re-raise the
rest.

```python
try:
    fp = open(config_path)
except FileNotFoundError:            # not OSError: only "not created yet" has a default
    return DEFAULT_CONFIG
else:
    with fp:
        return parse_config(fp)
```

**★ Symptom: a database connection failure is logged as a missing cache file.** Cause:
the 3.3 merge — `socket.error` is now `OSError`, so one `except OSError` in a suite that
does a file read *and* a network call owns both. Fix: split the suite; the two operations
were never one assumption.

```python
try:
    fp = open(cache_path)
except FileNotFoundError:
    fp = None

if fp is None:
    record = api_client.fetch(doc_id)        # its ConnectionError is not a cache miss
else:
    with fp:
        record = json.load(fp)
```

**★ Symptom: `except OSError as exc: log.error(str(exc))` produces log lines nobody can
act on.** Cause: the broad class was caught and then the object's diagnosis was thrown
away — `errno`, `strerror` and `filename` are all on it. Fix: log the structured fields,
or better, catch the subclass and let the rest propagate with their traceback.

```python
except OSError as exc:
    log.error("io failure errno=%s file=%s: %s", exc.errno, exc.filename, exc.strerror)
    raise
```

**Symptom: a custom `class StorageError(OSError)` does not become a
`FileNotFoundError` when constructed with `ENOENT`.** Cause: the documented
subclass-dispatch behaviour *"only occurs when constructing `OSError` directly or via an
alias, and is not inherited when subclassing"*. Fix: do not rely on it — raise the
specific class you mean, or set `errno` yourself and document it.

**Symptom: a clause names an exception class the guarded call cannot raise, and nobody
notices for two years.** Cause: the tuple was copied from another module, so it lists
classes unreachable here — harmless until a refactor makes one reachable with the wrong
recovery attached. Fix: name only what the callee *documents*; unreachable clauses are
dead code and should be deleted, not kept "just in case".

## Interview questions

**★ Why is `except OSError` around a single `open()` a width defect, when it is one
statement and one class?**
Because the class is a family of fifteen documented subclasses spanning missing files,
permission denials, directories, signal interruptions, child processes, timeouts and —
since the 3.3 merge of `socket.error` — every network failure. If the recovery is "use
the bundled default", it is correct for `FileNotFoundError` and wrong for a full disk, a
revoked permission and a broken mount. The rule is to name the narrowest class your
*recovery* is right for, not the narrowest class the operation can raise.

**★ What changed in Python 3.3 that makes `except OSError` wider than people expect?**
`EnvironmentError`, `IOError`, `WindowsError`, `socket.error`, `select.error` and
`mmap.error` were *"merged into `OSError`"*, and the `OSError` constructor may now return
a subclass chosen by `errno`. The practical consequence is that there is no longer a
class meaning "file I/O errors only" — a single `except OSError` in a suite that reads a
file and calls a socket owns both, and the code gives no hint that it does.

**★ You need to distinguish "disk full" from "file missing". How?**
By `errno`, because there is no subclass for it: the `OSError` description names *"disk
full"* as an example of what the class covers, and the documented OS-exception list has
no entry corresponding to `ENOSPC`. So catch `FileNotFoundError` for the case with a
recovery, then catch `OSError`, compare `exc.errno` against `errno.ENOSPC`, raise your
own class for it, and bare-`raise` everything else so its traceback survives.

**★ How do you narrow a handler when there is no narrower class available?**
Three options, in order. Look for a documented subclass or a library-specific class
first. If there is none, catch the broad class, inspect the attribute that carries the
distinction (`errno`, a driver error code, an HTTP status) and **bare-`raise`** everything
that is not yours — which preserves the original traceback. If neither produces a handler
you can describe in one sentence, do not catch it in this frame at all; the frame does not
have enough context to decide, and a caller does.

**Your `class StorageError(OSError)` is constructed with `errno.ENOENT` and does not
behave like `FileNotFoundError`. Why?**
Because the subclass dispatch is a property of the `OSError` constructor, not of the
hierarchy. The reference: the behaviour *"only occurs when constructing `OSError`
directly or via an alias, and is not inherited when subclassing"*. So a subclass of
`OSError` is just a subclass; if you want a caller to be able to distinguish causes,
either raise the specific builtin or expose your own attribute and document it.

**Where does the class-breadth question stop being a code question and become a design
question?**
At the point where you would need to inspect an attribute to decide. If the distinction
that matters to your recovery is not expressible as a class, the callee is under-reporting
— and the right fix is often a custom exception type in the callee rather than an `errno`
comparison in every caller. That is
[07 · Custom exceptions](../11-exceptions/07-custom-exceptions.md), and it is why
"choose the narrowest class" sometimes means "create it".

---

← Prev: [A worked width repair](06b-a-worked-width-repair.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The lookup classes](06d-the-lookup-classes.md)
