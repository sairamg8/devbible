---
title: "The default encoding is the locale's — and 3.15 finally changes that"
sidebar_label: "3 · The default encoding"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [`open()`](https://docs.python.org/3.14/library/functions.html#open) reference,
> [`locale.getencoding()`](https://docs.python.org/3.14/library/locale.html#locale.getencoding),
> [`EncodingWarning`](https://docs.python.org/3.14/library/exceptions.html#EncodingWarning),
> [PEP 540](https://peps.python.org/pep-0540/) (UTF-8 Mode),
> [PEP 597](https://peps.python.org/pep-0597/) (`EncodingWarning`) and
> [PEP 686](https://peps.python.org/pep-0686/) (**Status: Final,
> Python-Version: 3.15**). Target: **CPython 3.14**.

**`open(path)` in text mode does not default to UTF-8. The reference is
explicit: *"In text mode, if encoding is not specified the encoding used is
platform-dependent: `locale.getencoding()` is called to get the current locale
encoding."* On a modern Linux or macOS box that is usually UTF-8; on Windows it
is typically a legacy code page such as cp1252. So the same program reads the
same file two different ways on two machines, and neither one warns you. This
is the single most productive source of encoding bugs in Python, and PEP 686 —
**Final, targeting 3.15** — is the fix.**

## The situation on 3.14

```python
open(path)                       # encoding = locale.getencoding()  ← platform-dependent
open(path, encoding="utf-8")     # explicit, portable, correct
open(path, encoding="locale")    # explicitly the locale encoding (3.10+)
open(path, "rb")                 # no decoding at all — you get bytes
```

Three encodings are easy to confuse, and only one of them is locale-dependent:

| What | Value on 3.14 |
|---|---|
| `str.encode()` / `bytes.decode()` default | **UTF-8**, always |
| `sys.getdefaultencoding()` | **`'utf-8'`**, always — a legacy of Python 2, and rarely what you want to check |
| `open()` in text mode | **`locale.getencoding()`** — platform-dependent |
| `subprocess` with `text=True` | the locale encoding, unless `encoding=` is given |

So `"x".encode()` and `open(p).read()` do not necessarily agree, which is
exactly the asymmetry that makes the bug hard to see: the round trip works on
the developer's machine and fails in CI.

## UTF-8 Mode (PEP 540)

Since 3.7 you can force the whole interpreter to use UTF-8 regardless of the
locale:

```bash
python -X utf8 app.py
PYTHONUTF8=1 python app.py
```

UTF-8 Mode changes the default encoding for `open()`, for the standard streams
and for the filesystem encoding, and it uses `surrogateescape` as the error
handler for `stdin`/`stdout` so undecodable data still round-trips. It does
**not** override an explicit `encoding=` argument, and since 3.11 it correctly
leaves `encoding="locale"` alone — that inconsistency was one of the things
PEP 686 records as fixed.

`PYTHONUTF8=1` in a Dockerfile or a service manifest is a one-line way to make
a deployment behave the same everywhere, and it costs nothing.

## Finding the bugs before 3.15 does: `EncodingWarning`

PEP 597 added a warning that fires wherever a locale-dependent default is
actually used:

```bash
python -X warn_default_encoding app.py
PYTHONWARNDEFAULTENCODING=1 python -W error::EncodingWarning -m pytest
```

Every `open()` without an `encoding=` lights up. That second form — turning the
warning into an error under the test suite — is the practical way to clear a
codebase, and it is worth doing *before* 3.15 rather than after, because the
change of default will alter behaviour silently in the other direction on
Windows.

## What PEP 686 changes in 3.15

PEP 686 is **Final** and targets **Python 3.15**: UTF-8 becomes the default
text encoding — for files, for the standard streams and for pipes. The escape
hatch is the existing UTF-8 Mode switch used in reverse:

```bash
PYTHONUTF8=0 python legacy_app.py
python -X utf8=0 legacy_app.py
```

Three things follow for code you are writing now:

- **An explicit `encoding="utf-8"` is correct on both sides of the change.**
  It is the migration, and it needs no version check.
- **`encoding="locale"` keeps meaning the locale encoding** even in UTF-8 Mode
  — that behaviour was corrected in 3.11 specifically so this migration would
  have a way to say "I really do mean the locale here".
- **Code that silently relied on cp1252 on Windows will break in 3.15.** That
  code is already broken on every other platform; 3.15 makes it uniform. Find
  it now with `EncodingWarning`.

This belongs on the same shelf as free-threading becoming officially supported
in 3.14: it is a default that most published Python material still describes the
old way, and the material will be wrong rather than merely dated.

## The filesystem encoding is a separate question

Filenames have their own encoding, reported by `sys.getfilesystemencoding()`,
and their own error handler, `sys.getfilesystemencodeerrors()` — normally
`surrogateescape` on POSIX, so that undecodable names survive as covered in
[the error handlers](02b-error-handlers.md). `os.fsencode` and `os.fsdecode`
convert using exactly that pair, which is why they are the correct tools rather
than a hand-written `encode`/`decode`.

## Other defaults worth knowing

```python
import sys, locale

sys.getdefaultencoding()          # 'utf-8' — the str/bytes method default
sys.getfilesystemencoding()       # how paths are encoded
sys.stdout.encoding               # the stream's encoding
locale.getencoding()              # what open() uses when you do not say (3.11+)
locale.getpreferredencoding(False)  # the older spelling
```

`sys.stdout` is its own trap: redirecting output to a file or a pipe can change
its encoding, which is why a script that prints fine in a terminal can raise
`UnicodeEncodeError` under `>` on a machine with a non-UTF-8 locale.
`sys.stdout.reconfigure(encoding="utf-8")` (3.7+) fixes it in place, and UTF-8
Mode fixes it globally.

## Gotchas

### `open()` without `encoding=`
**Symptom.** A file that reads correctly in development raises
`UnicodeDecodeError` in CI, or reads with mangled accents on Windows.
**Cause.** The default is the locale encoding, not UTF-8.
**Fix.** `open(path, encoding="utf-8")`. Every text-mode `open`, every time —
and enforce it with `ruff`'s `PLW1514`/flake8's equivalent.

### Assuming `sys.getdefaultencoding()` tells you what `open()` uses
**Symptom.** Debugging output says `'utf-8'` while the file is being read as
cp1252.
**Cause.** `sys.getdefaultencoding()` is the `str`/`bytes` method default and is
always `'utf-8'`; `open()` uses `locale.getencoding()`.
**Fix.** Check `locale.getencoding()`, or better, stop depending on either.

### `print()` raising on a redirect
**Symptom.** A script works interactively and fails with
`UnicodeEncodeError` when its output is piped to a file.
**Cause.** `sys.stdout`'s encoding is derived from the environment and can
differ between a terminal and a pipe.
**Fix.** `PYTHONUTF8=1`, or `sys.stdout.reconfigure(encoding="utf-8")`.

### A `subprocess` decoding with the locale
**Symptom.** `text=True` output is mangled for non-ASCII, on the same machine
where files read fine.
**Cause.** `text=True` decodes with the locale encoding unless told otherwise.
**Fix.** `subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")`.

### Relying on cp1252 behaviour that 3.15 will remove
**Symptom.** Nothing yet — that is the problem.
**Cause.** A Windows-only codebase that has never specified an encoding is
currently reading and writing cp1252 by default. In 3.15 the default becomes
UTF-8 and every existing file becomes unreadable the old way.
**Fix.** Run the test suite now with `PYTHONWARNDEFAULTENCODING=1 -W
error::EncodingWarning`, and add an explicit `encoding=` at every site — either
`"utf-8"` for new data or `"cp1252"` for genuinely legacy files.

### Setting `PYTHONUTF8=1` and expecting it to fix an explicit encoding
**Symptom.** UTF-8 Mode is on and a file still decodes as cp1252.
**Cause.** UTF-8 Mode changes *defaults*; an explicit `encoding=` argument
always wins, as does `encoding="locale"` since 3.11.
**Fix.** Correct the call site. UTF-8 Mode is a safety net, not an override.

## Interview questions

**Q: What encoding does `open(path)` use in text mode?**
The locale encoding — `locale.getencoding()` — which is platform-dependent.
Not UTF-8. That is different from `str.encode()`/`bytes.decode()`, which do
default to UTF-8, and it is the reason the same code behaves differently on
Linux and Windows.

**Q: What is `sys.getdefaultencoding()` then?**
The default for the `str`/`bytes` methods, always `'utf-8'` on Python 3. It is a
Python 2 leftover and is almost never the value you actually want to inspect —
checking it while debugging an `open()` problem is a classic dead end.

**Q: What is UTF-8 Mode and how do you turn it on?**
PEP 540, since 3.7. `-X utf8` or `PYTHONUTF8=1` makes the interpreter use UTF-8
for `open()`, the standard streams and the filesystem encoding regardless of
locale, with `surrogateescape` on stdin/stdout. It does not override an explicit
`encoding=` argument.

**Q: What is `EncodingWarning` and how do you use it?**
PEP 597. Enabled with `-X warn_default_encoding` or
`PYTHONWARNDEFAULTENCODING=1`, it fires wherever a locale-dependent default is
actually used. Run the test suite with `-W error::EncodingWarning` to find every
site that needs an explicit encoding.

**Q: What does PEP 686 change, and when?**
It makes UTF-8 the default text encoding — files, standard streams and pipes.
Status Final, targeting **Python 3.15**. `PYTHONUTF8=0` or `-X utf8=0` opts
back out.

**Q: How do you write code today that is correct both before and after 3.15?**
Pass `encoding="utf-8"` explicitly. It is unaffected by the default and by
UTF-8 Mode, so it needs no version check.

**Q: What does `encoding="locale"` mean, and why does it exist?**
It explicitly requests the locale encoding, and since 3.11 it is honoured even
in UTF-8 Mode. It exists so that code which genuinely means "whatever this
machine is configured for" can say so, and survive the migration to a UTF-8
default.

**Q: Why can a script print fine in a terminal and raise `UnicodeEncodeError`
when redirected?**
`sys.stdout`'s encoding comes from the environment and can differ between an
interactive terminal and a pipe or file. `sys.stdout.reconfigure(encoding="utf-8")`
or UTF-8 Mode fixes it.

**Q: Which encoding do filenames use, and why is it special?**
`sys.getfilesystemencoding()`, with the error handler from
`sys.getfilesystemencodeerrors()` — `surrogateescape` on POSIX, because a POSIX
filename is bytes with no guaranteed encoding. Use `os.fsencode`/`os.fsdecode`
rather than encoding by hand, so you get both halves right.

---

← Prev: [Error handlers](02b-error-handlers.md) · Index: [`bytes` vs `str`](README.md) · Next → [Truthiness](../05-truthiness/README.md)
