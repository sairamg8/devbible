---
title: "sitecustomize, usercustomize and .pth files run in every interpreter you start, not just interactive ones — and the documentation warns that a mistake in them causes a silent and perhaps mysterious failure of the process"
sidebar_label: "6e · sitecustomize and .pth"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`site`](https://docs.python.org/3.14/library/site.html) (`sitecustomize`,
> `usercustomize`, path configuration files, `ENABLE_USER_SITE`) and
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-s`, `-S`, `-I`, `PYTHONNOUSERSITE`).
> Version spine: **Python 3.14.7**.

**`PYTHONSTARTUP` only affects interactive sessions, so the moment someone wants
the same convenience in a script they move it into `sitecustomize` — and now it
runs inside every Python process on the machine, including pip, the build tool
and CI. That is worth knowing on its own; what makes it a page is the documented
failure mode. `site` swallows an `ImportError` from these modules and nothing
else, so any other exception takes the interpreter down with, in the docs' own
words, "a silent and perhaps mysterious failure of the process". `.pth` files are
the third member of the same family and can execute code too.**

## The two customisation modules, verbatim

> *"After these path manipulations, an attempt is made to import a module named
> `sitecustomize`, which can perform arbitrary site-specific customizations. It is
> typically created by a system administrator in the site-packages directory. If
> this import fails with an `ImportError` or its subclass exception, and the
> exception's `name` attribute equals `'sitecustomize'`, it is silently ignored.
> If Python is started without output streams available, as with `pythonw.exe` on
> Windows (which is used by default to start IDLE), attempted output from
> `sitecustomize` is ignored. **Any other exception causes a silent and perhaps
> mysterious failure of the process.**"*

> *"After this, an attempt is made to import a module named `usercustomize`, which
> can perform arbitrary user-specific customizations, if `ENABLE_USER_SITE` is
> true. This file is intended to be created in the user site-packages directory
> (see below), which is part of `sys.path` unless disabled by `-s`. If this import
> fails with an `ImportError` or its subclass exception, and the exception's
> `name` attribute equals `'usercustomize'`, it is silently ignored."*

Read the error handling precisely. Only `ImportError` **whose `name` is exactly
the module's own name** is swallowed. An `ImportError` raised *inside*
`sitecustomize` because it imports something missing has a different `name`, so it
is **not** swallowed — it kills the process. That distinction is the whole trap:
the file is designed to be optional, not to be forgiving.

Find where `usercustomize` belongs:

```python
import site
site.getusersitepackages()
```

## `.pth` files — the same family, and they can run code

> *"A path configuration file is a file whose name has the form `name.pth` and
> exists in one of the four directories mentioned above; its contents are
> additional items (one per line) to be added to `sys.path`. Non-existing items
> are never added to `sys.path`, and no check is made that the item refers to a
> directory rather than a file. No item is added to `sys.path` more than once.
> Blank lines and lines beginning with `#` are skipped. Lines starting with
> `import` (followed by space or tab) are executed."*

That last clause is the one people do not know: a `.pth` file is not purely
declarative. The docs attach a warning to it:

> *"An executable line in a `.pth` file is run at every Python startup, regardless
> of whether a particular module is actually going to be used. Its impact should
> thus be kept to a minimum. The primary intended purpose of executable lines is
> to make the corresponding module(s) importable (load 3rd-party import hooks,
> adjust `PATH` etc). Any other initialization is supposed to be done upon a
> module's actual import, if and when it happens. Limiting a code chunk to a
> single line is a deliberate measure to discourage putting anything more complex
> here."*

This is how editable installs, coverage-on-subprocess hooks and some debugger
integrations attach themselves, and it is why `python -X importtime` sometimes
shows work happening before your program's first line. *"Non-existing items are
never added to `sys.path`"* is the other half — it is why a moved project's
editable install stops working with no error at all
([`../05-virtual-environments/05-not-relocatable.md`](../05-virtual-environments/05-not-relocatable.md)).

## Turning each layer off, in order of bluntness

```bash
python -s      # no user site directory: no usercustomize, no user .pth files
python -S      # no site at all: no sitecustomize, no usercustomize, no .pth, no completion
python -I      # isolated mode: implies -E, -P and -s
PYTHONNOUSERSITE=1 python      # the environment form of -s
```

**`python -S` is the single most useful diagnostic on this page.** If a problem
disappears under `-S`, it came from `site` — one of the two customisation modules
or a `.pth` file — and not from your program. Narrow from there with `-s`, which
removes only the user layer.

Check the user-site state directly:

```bash
python -c "import site; print(site.ENABLE_USER_SITE, site.getusersitepackages())"
```

And see what `.pth` files are actually in play:

```bash
python -c "import site, pathlib; [print(p) for d in site.getsitepackages() for p in pathlib.Path(d).glob('*.pth')]"
```

## Gotchas

**★ `PYTHONSTARTUP` had no effect on a script, so someone moved its contents into
`sitecustomize`.**
It now runs inside every Python process on the machine — pip, the build backend,
every CI step, every subprocess your program spawns. And a mistake in it is
documented to cause *"a silent and perhaps mysterious failure of the process"*. If
a script needs setup, the script should import it.

**★ Python starts failing with no error message, on one machine only.**
`sitecustomize` raising anything other than its own `ImportError` is the
documented cause. Confirm with `python -S`; if that works, the problem is in
`site`'s customisation path, not in your code.

**★ A `sitecustomize` that imports a missing third-party package kills every
Python process.**
Only an `ImportError` whose `name` equals `'sitecustomize'` is swallowed. An
`ImportError` for `requests` raised *from inside* `sitecustomize` has
`name == 'requests'` and propagates. Guard the body:

```python
# sitecustomize.py
try:
    import our_internal_tracing_hook   # noqa: F401
except Exception:
    pass       # never let a customisation module take down the interpreter
```

**★ `usercustomize` does not run and nobody can say why.**
It is imported only *"if `ENABLE_USER_SITE` is true"*, and the user site directory
is removed by `-s`, by `-I`, by `PYTHONNOUSERSITE`, and in virtual environments
configured without it.
`python -c "import site; print(site.ENABLE_USER_SITE)"` answers it in one line.

**★ Output from `sitecustomize` disappears on Windows.**
Documented: *"If Python is started without output streams available, as with
`pythonw.exe` on Windows […] attempted output from `sitecustomize` is ignored."*
Never rely on printing from these modules; use a file or the logging module if you
must observe them.

**★ Startup got slower after installing a package and nothing in your code
changed.**
The package shipped a `.pth` file with an executable `import` line, which *"is run
at every Python startup, regardless of whether a particular module is actually
going to be used"*. `python -X importtime` shows it; `python -S` proves it.

**★ An editable-installed package silently stops importing after a directory
move.**
The `.pth` entry names a path that no longer exists, and *"non-existing items are
never added to `sys.path`"* — no warning, no error, just an import that fails
later. Re-run the editable install from the new location.

**★ A `.pth` line was written with leading whitespace and does nothing.**
The rule is *"lines starting with `import`"*, and blank lines plus lines beginning
with `#` are skipped. An indented line is neither an executable line nor a valid
path, so it contributes nothing and reports nothing.

**★ `-S` "fixes" a problem and gets baked into a wrapper script.**
`-S` also removes `site-packages` from `sys.path`, which is almost never what you
want outside diagnosis. Use it to *locate* the problem, then fix the offending
module.

## Interview questions

**★ What is the difference between `sitecustomize` and `PYTHONSTARTUP`?**
Scope and timing. `sitecustomize` is imported by `site` during startup for *every*
interpreter invocation — scripts, `-c`, subprocesses, build tools — and is
normally an administrator's file in `site-packages`. `PYTHONSTARTUP` is a
per-user, interactive-only file that executes in the session's own namespace.
Putting personal conveniences in `sitecustomize` makes them run inside every tool
on the machine, and the docs warn that an exception there causes *"a silent and
perhaps mysterious failure of the process"*.

**★ A machine's Python exits immediately with no message. Where do you look
first?**
`python -S`. If that works, `site` is the culprit — a broken `sitecustomize`, a
broken `usercustomize`, or a `.pth` file executing code. The `sitecustomize`
documentation names this exact failure: only its own `ImportError` is swallowed,
and any other exception takes the process down without a useful message. Narrow
with `-s` (user layer only) and `-I` (fully isolated).

**★ Can a `.pth` file execute code?**
Yes. The `site` documentation states that *"lines starting with `import`
(followed by space or tab) are executed"*, and warns that such a line *"is run at
every Python startup, regardless of whether a particular module is actually going
to be used"*. Its intended purpose is narrow — making modules importable, loading
import hooks — and the one-line restriction is described as *"a deliberate
measure to discourage putting anything more complex here"*. It is also the
mechanism behind editable installs and coverage's subprocess support.

**★ Why does an editable install stop working after you rename the project
directory, with no error?**
Because the install is a `.pth` entry containing an absolute path, and the docs
say *"non-existing items are never added to `sys.path`"*. Nothing raises; the
entry simply contributes nothing, and your own package stops being importable —
which reads like a broken install rather than a moved one. Re-run the editable
install from the new location.

**★ How would you write a `sitecustomize` safely, if you had to?**
Wrap the entire body in `try: … except Exception: pass`, keep it to a few lines,
never print from it, and never let it import anything that is not guaranteed
present. The failure mode is not an error message — it is every Python process on
the host dying quietly, including the ones you would use to diagnose it.

**★ What is the practical difference between `-s`, `-S` and `-I`?**
`-s` drops the user site-packages directory, so `usercustomize` and user-level
`.pth` files stop applying. `-S` skips the `site` module entirely: no
customisation modules, no `.pth` processing, no `site-packages` on the path, and
no interactive completion or history. `-I` is isolated mode and implies `-E`
(ignore `PYTHON*` variables), `-P` (no script directory or cwd on the path) and
`-s`, but *not* `-S` — so an isolated interpreter still has its environment's
`site-packages`.

---

← Prev: [Configuring the session](06d-configuring-the-session.md) · Index: [Running code](README.md) · Next → [Dropping into a REPL on purpose](06f-dropping-into-a-repl.md)

{/* FOOTER */}
