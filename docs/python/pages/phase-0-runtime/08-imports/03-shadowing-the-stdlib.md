---
title: "Naming a file random.py breaks a library you never called, and the traceback points at the library"
sidebar_label: "3 · Shadowing the stdlib"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (finders and the module cache),
> [`sys.path` initialization](https://docs.python.org/3.14/library/sys_path_init.html),
> [`sys.stdlib_module_names` and `sys.builtin_module_names`](https://docs.python.org/3.14/library/sys.html#sys.stdlib_module_names),
> and the CPython 3.14 sources
> [`Objects/moduleobject.c`](https://github.com/python/cpython/blob/3.14/Objects/moduleobject.c)
> and [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)
> for the exact wording and conditions of the shadowing hints.
> Target: **CPython 3.14**.

**`sys.path[0]` is your directory and the standard library is much further down
the list, so a file you name `random.py` *is* the `random` module for the whole
process — including for every third-party library that imports it. The failure
therefore appears inside code you did not write, describing a symbol you have
never heard of, at a point in the program that has nothing to do with your file.
Since 3.13 CPython tries to tell you, but only in the exact case where the file
sits in `sys.path[0]`; everywhere else you are on your own.**

## The mechanism is one sentence long

Imports are resolved by walking `sys.path` in order and taking the first match.
[Chunk 2](02-sys-path.md) established that the front of that list is your script
directory or your working directory, and that the standard library arrives at
stage 3, two stages later. So for any pure-Python standard library module, a file
of the same name in your directory wins.

There is one exception, and it is worth knowing precisely because it explains why
some names are safe. The import reference describes the default finders:

> *"Python includes a number of default finders and importers. The first one
> knows how to locate built-in modules, and the second knows how to locate frozen
> modules. A third default finder searches an import path for modules."*

`sys.path` is only consulted by that *third* finder. So modules compiled into the
interpreter — the ones listed in `sys.builtin_module_names`, *"a tuple of strings
containing the names of all modules that are compiled into this Python
interpreter"* — cannot be shadowed by a file at all. `sys` and `time` are safe.
`random`, `email`, `types`, `select` and the rest of the pure-Python standard
library are not.

The list of names that *can* be shadowed is available at runtime:
`sys.stdlib_module_names`, *"a frozenset of strings containing the names of
standard library modules… the same on all platforms"*. That frozenset is exactly
what CPython itself consults when deciding whether to warn you, and it is what a
lint rule should consult too.

## Three shapes of failure, none of which names your file first

**Shape 1 — you shadow it and then import it yourself.** A file `random.py` that
contains `import random` imports *itself*: `sys.modules["random"]` is already
being populated with your module, so the name binds to a partially initialised
copy of your own file. The subsequent `random.randint(...)` raises
`AttributeError`, and on 3.13+ CPython appends the hint *"consider renaming …
since it has the same name as the standard library module named 'random' and
prevents importing that standard library module"*.

**Shape 2 — something else imports it, and fails inside the standard library.**
This is the one that costs an afternoon. Put an empty `types.py` in your working
directory and import `dataclasses`; the traceback ends inside `enum.py`, in the
standard library, on the line `from types import MappingProxyType,
DynamicClassAttribute`, raising `ImportError`. Nothing in the frames mentions
your file except the hint at the end. Without the hint — and there are conditions
where it does not fire — the error is a naked *"cannot import name
'MappingProxyType' from 'types'"* pointing at a stdlib file you have never
edited.

**Shape 3 — you shadow a *package*, and there is no hint at all.** A directory
named `email/` containing an `__init__.py` shadows the standard library's `email`
package. `import email.message` then fails with `ModuleNotFoundError: No module
named 'email.message'`, because your `email` package genuinely has no `message`
submodule. The hint machinery lives in the attribute-lookup and `from`-import
paths; a plain `ModuleNotFoundError` for a submodule goes through neither.
This shape is the hardest of the three, and it is the one a `tests/` or `email/`
or `logging/` directory in a repo root produces.

## Exactly when CPython helps you, and when it does not

The hint is not magic and it is not universal. CPython computes a flag
`is_possibly_shadowing`, and the source states the condition as pseudocode:

> *"Returns 1 if the module at origin could be shadowing a module of the same
> name later in the module search path. The condition we check is basically:
> `root = os.path.dirname(origin.removesuffix(os.sep + "__init__.py"))`;
> `return not sys.flags.safe_path and root == (sys.path[0] or os.getcwd())`"*
> — `_PyModule_IsPossiblyShadowing`, `Objects/moduleobject.c`

Then, if the module's name is also in `sys.stdlib_module_names`, you get the
strong message. Both `Objects/moduleobject.c` (for attribute access on a module)
and `Python/ceval.c` (for `from … import …`) carry the same two-tier logic:

- **stdlib shadow, file in `sys.path[0]`** → *"consider renaming … since it has
  the same name as the standard library module named … and prevents importing
  that standard library module"*.
- **non-stdlib shadow, file in `sys.path[0]`, module still initialising** →
  *"consider renaming … if it has the same name as a library you intended to
  import"*. The source comments this as *"For non-stdlib modules, only mention
  the possibility of shadowing if the module is being initialized."*
- **anything else** → the generic *"partially initialized module … has no
  attribute …"* / *"cannot import name … from partially initialized module …
  (most likely due to a circular import)"*.

Read the condition carefully, because two consequences follow that will
eventually catch you:

1. **The file must be in `sys.path[0]` itself, not merely on `sys.path`.** A
   shadowing `random.py` reached through `PYTHONPATH`, through a `.pth` file, or
   in a subdirectory added by hand gets no hint — it gets the *circular import*
   message instead, which sends you looking in entirely the wrong place.
2. **`-P` / `PYTHONSAFEPATH` disables the hint**, because the condition begins
   `not sys.flags.safe_path`. That is coherent — safe path mode removes the
   directory that causes the problem — but it means "turn on `-P`" and "get good
   shadowing diagnostics" are mutually exclusive settings.

The messages are also a *third*-party shadowing detector, not only a stdlib one:
the second-tier wording exists precisely for the case where your `requests.py`
shadows the installed `requests`.

## The names that bite most often

Short, obvious, and exactly what a developer names a first file:

| Name | What it breaks when shadowed |
|---|---|
| `random.py` | anything sampling or generating IDs, plus much of `secrets` |
| `types.py` | `enum`, `dataclasses`, `typing` — i.e. nearly everything |
| `email.py` / `email/` | `smtplib`, HTTP libraries, anything parsing headers |
| `string.py` | `logging`, `re`-adjacent helpers, template code |
| `test.py` / `test/` | the stdlib's own `test` package; breaks some tooling |
| `abc.py` | `collections.abc` consumers, most ORMs |
| `code.py` | `pdb` and interactive tooling |
| `copy.py` | `pickle`, `dataclasses`, deep-copy anywhere |
| `enum.py` | almost the entire standard library |
| `json.py`, `csv.py`, `logging.py`, `socket.py`, `select.py`, `queue.py`, `parser.py`, `token.py`, `statistics.py`, `secrets.py`, `platform.py`, `signal.py` | the obvious, plus non-obvious transitive users |

The pattern to internalise is not the list; it is that **any single-word file
name in a directory that ends up on `sys.path[0]` is a candidate**. The check is
one line: is the stem in `sys.stdlib_module_names`?

## Gotchas

**Symptom:** `AttributeError` on a standard library module you have used a hundred times
**Cause:** a file in `sys.path[0]` has the same name; your file is what got imported
**Fix:** read the hint if 3.13+ gave you one, otherwise `print(mod.__file__)`. Rename your file; a leading verb or a package prefix is enough

**Symptom:** the traceback ends inside a standard library file you have never edited
**Cause:** shape 2 — a *third* module imported the name you shadowed, and it broke there
**Fix:** the failing line names the shadowed module (`from types import …`). That name, not the file in the traceback, is what to search your project for

**Symptom:** `ModuleNotFoundError` for a stdlib *submodule* — `email.message`, `xml.etree` — with no hint at all
**Cause:** you shadowed the *package*, with a directory. The hint machinery does not cover this path
**Fix:** look for a directory of that name in your project root. `find . -maxdepth 2 -name email` is faster than reading the traceback again

**Symptom:** the error says "most likely due to a circular import" and there is no cycle
**Cause:** the shadowing file is on `sys.path` but is not in `sys.path[0]` — via `PYTHONPATH`, a `.pth` file, or a `sys.path.insert` — so CPython's shadowing check returns 0 and you get the generic message
**Fix:** distrust the "circular import" wording whenever the module named is a stdlib module. Check `mod.__file__` before believing it

**Symptom:** the helpful "consider renaming" hint disappeared after a deployment change
**Cause:** `-P` or `PYTHONSAFEPATH` was enabled; the check begins `not sys.flags.safe_path`
**Fix:** expected trade-off. The flag prevents the common case; diagnose the remaining cases with `find_spec` and `__file__`

**Symptom:** a shadow appears only in the test suite
**Cause:** `pytest` inserted a directory onto `sys.path` that no production launch inserts — commonly a `tests/` tree containing a `types.py` or `logging.py` helper
**Fix:** name test helpers distinctly (`_helpers.py`, `conftest.py`), and add `__init__.py` files so test modules are not top-level names

**Symptom:** shadowing a `sys`-like name has no effect at all
**Cause:** built-in modules are found by the first meta path finder, which never consults `sys.path`
**Fix:** nothing to fix — but do not generalise from it. Only names in `sys.builtin_module_names` are immune; the pure-Python standard library is not

**Symptom:** an installed third-party package stops working when a colleague adds a file
**Cause:** the same mechanism with a non-stdlib name — a local `requests.py` beats `site-packages/requests/`
**Fix:** the second-tier hint mentions this case explicitly. Check `packages_distributions()` for collisions in CI, exactly as you check `sys.stdlib_module_names`

## Interview questions

**★ Why does creating `random.py` break a library that has nothing to do with your code?**
Because `import random` is resolved against `sys.path` in order, and your
directory is at the front while the standard library is two stages further down.
Your file therefore *is* the `random` module for every importer in the process,
including third-party code. Since the failure occurs wherever that other code
uses a name your file does not define, the traceback points at the library, not
at you.

**★ Why does the traceback point somewhere else entirely, and how do you find the
real cause fast?**
Because the error occurs at the point of *use*, not at the point of shadowing —
typically an `AttributeError` or an `ImportError` inside a stdlib or third-party
module. The fastest resolution is to print `__file__` of the module named in the
failing line: if it points into your project, you have found it. On 3.13+ CPython
often appends a "consider renaming" hint, but only when the file is in
`sys.path[0]` and `-P` is off, so its absence proves nothing.

**★ Which standard library names can you *not* shadow, and why?**
The ones compiled into the interpreter — `sys.builtin_module_names`. The first
default meta path finder handles built-in modules and never looks at `sys.path`,
so no file can outrank them. Everything in the pure-Python standard library goes
through the path-based finder and is shadowable. The runtime list of names worth
protecting is `sys.stdlib_module_names`.

**Someone reports "cannot import name X from partially initialized module Y
(most likely due to a circular import)" and there is no cycle. What now?**
Suspect shadowing. That generic message is what CPython emits when it decides the
module is *not* possibly shadowing — which includes the case where a shadowing
file reached `sys.path` through `PYTHONPATH`, a `.pth` file or a manual insert
rather than sitting in `sys.path[0]`. Print `Y.__file__`. If it points at
something in your project rather than at the standard library, the message is
misleading and the cause is a name collision.

**Why is a shadowing *directory* worse than a shadowing file?**
Because the failure mode is a plain `ModuleNotFoundError` for a submodule, with
no hint attached — the hint logic lives in module attribute access and in the
`from … import …` path, and a missing submodule goes through neither. It also
survives the intuitive fix: deleting the directory's `__init__.py` turns it into
a PEP 420 implicit namespace package, which still matches the name.

---

← Prev: [Diagnosing an import failure](02d-diagnosing-import-failures.md) · Index: [Imports](README.md) · Next → [Stale bytecode, diagnosis and prevention](03b-diagnosing-and-preventing-shadowing.md)
