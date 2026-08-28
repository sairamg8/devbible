---
title: "Stale bytecode, the four-command diagnosis, and the layouts that make shadowing impossible"
sidebar_label: "3b · Diagnosis and prevention"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [PEP 3147](https://peps.python.org/pep-3147/) (the `__pycache__` layout and
> source-less imports), the Python 3.14
> [cached bytecode invalidation](https://docs.python.org/3.14/reference/import.html#cached-bytecode-invalidation)
> reference,
> [`sys.stdlib_module_names`](https://docs.python.org/3.14/library/sys.html#sys.stdlib_module_names),
> [`importlib.metadata.packages_distributions`](https://docs.python.org/3.14/library/importlib.metadata.html#package-distributions)
> and [PEP 420](https://peps.python.org/pep-0420/).
> Target: **CPython 3.14**.

**Half of what developers believe about stale `.pyc` files is wrong: a
`__pycache__` entry cannot outlive its source, and the folklore that it can sends
people deleting caches instead of finding the real leftover. This chunk sets out
what actually survives a rename, the four commands that identify a shadow in
under a minute, and the two structural changes that make the entire class of bug
impossible rather than merely rare.**

## `__pycache__` leftovers: what actually survives a rename

The folklore says a stale `.pyc` keeps the shadow alive after you delete the
`.py`. For the modern `__pycache__` layout that is **false**, and PEP 3147 says
so explicitly:

> *"If the py source file is missing, the pyc file inside `__pycache__` will be
> ignored. This eliminates the problem of accidental stale pyc file imports."*

> *"Python will not import a pyc file from the cache directory unless the source
> file exists."*

So deleting or renaming `random.py` does clear the shadow, even with
`__pycache__/random.cpython-314.pyc` still on disk. Three real leftovers remain,
and they are the ones to check:

1. **A legacy `.pyc` sitting where the `.py` would be.** PEP 3147 preserved
   source-less imports for exactly this location:

   > *"For backward compatibility, Python will still support pyc-only
   > distributions, however it will only do so when the pyc file lives in the
   > directory where the py file would have been, i.e. not in the `__pycache__`
   > directory. pyc file outside of `__pycache__` will only be imported if the py
   > source file is missing."*

   A `random.pyc` next to your code, produced by an old build step or copied out
   of a wheel, keeps shadowing after `random.py` is gone.

2. **An empty directory that is still a package.** Delete `email/__init__.py` and
   leave `email/` in place with its `__pycache__` inside, and the directory
   becomes an *implicit namespace package* under PEP 420 — which still shadows,
   and now with an `__init__.py`-less package that behaves even more strangely.
   [Chunk 4c](04c-namespace-packages.md) covers that mechanism; the diagnostic
   consequence is that `rm mypkg/__init__.py` does not un-shadow a directory,
   `rm -r mypkg/` does.

3. **A stale cache entry, not a stale file.** If the shadowing module was already
   imported in a long-running process, deleting the file changes nothing until
   the process restarts, because `sys.modules` is checked first.

The genuinely stale-`.pyc` case that does still exist is invalidation, not
shadowing: the timestamp-and-size scheme means a source file restored with its
original size and mtime is served from cache. The reference describes both
schemes — *"By default, Python does this by storing the source's last-modified
timestamp and size in the cache file"* — and offers hash-based `.pyc` files as
the deterministic alternative, with *"unchecked"* hash-based files being the one
variant Python *"simply assumes… is valid if it exists"*.

## The fast diagnosis recipe

Four commands, in order. All of them must be run with the same interpreter and
from the same working directory as the failure.

```bash
# 1. What did that name actually resolve to?
python -c "import random; print(random.__file__)"

# 2. If step 1 already failed: where would it resolve to, without executing it?
python -c "import importlib.util as u; print(u.find_spec('random'))"

# 3. Is anything in this directory named after a stdlib module?
python -c "
import pathlib, sys
names = sys.stdlib_module_names
for p in pathlib.Path('.').iterdir():
    stem = p.stem if p.suffix == '.py' else p.name
    if stem in names:
        print('shadows stdlib:', p)
"

# 4. Does the problem survive without your directory on the path?
python -P -c "import myapp"
```

Step 3 is the one to wire into CI. It is five lines, it uses the same frozenset
CPython uses, and it catches the bug at review time instead of at 2am. Step 4 is
the confirmation: if `-P` fixes it, the cause is a file in your own directory,
full stop.

For the third-party version of the same bug — your `requests.py` shadowing the
installed `requests` — swap `sys.stdlib_module_names` for the keys of
`importlib.metadata.packages_distributions()`, which maps every importable
top-level name to the distributions providing it.

## Prevention that actually holds

- **A `src/` layout.** The project root stops being importable, so a file in the
  repository root cannot shadow anything. This is the structural fix and it is
  why the layout exists.
- **`PYTHONSAFEPATH=1` / `-P` for every installed entry point.** Removes
  `sys.path[0]` entirely; the class of bug becomes impossible. Accept that you
  also lose the diagnostic hint.
- **Never a single-word module name at the top level of a package-less
  directory.** Inside a package the name is `mypkg.random`, which shadows
  nothing.
- **The CI check from step 3.** Cheap, exact, and it fires on the pull request
  that introduces `types.py` rather than on the deploy that follows it.

## Gotchas

**Symptom:** you renamed the file and the shadow persisted
**Cause:** a *legacy* `.pyc` in the same directory (not in `__pycache__`), which PEP 3147 keeps importable when the source is missing — or the process was never restarted, so `sys.modules` still holds the old module
**Fix:** `find . -name '*.pyc' -not -path '*/__pycache__/*'` and delete them; restart the process. A `__pycache__` entry alone cannot cause this

**Symptom:** you deleted `mypkg/__init__.py` to "remove the package" and it still shadows
**Cause:** the directory is now an implicit namespace package under PEP 420, which still matches the name
**Fix:** remove the directory, not the `__init__.py`

**Symptom:** an edit to a `.py` file has no effect, and there is no shadowing involved
**Cause:** timestamp-and-size invalidation — a file restored from a backup or a VCS checkout can land with a size and mtime that match the cached `.pyc`
**Fix:** delete the `__pycache__` entry, or build with hash-based `.pyc` files, which the reference describes as validating by hashing the source rather than by metadata

**Symptom:** a deployed wheel ignores your patched source file entirely
**Cause:** an *unchecked* hash-based `.pyc` — the reference states Python *"simply assumes the cache file is valid if it exists"* for that variant
**Fix:** `--check-hash-based-pycs always` to override at runtime, and do not patch installed code in place

**Symptom:** the CI shadowing check passes and the bug still ships
**Cause:** the check scanned the repository root but the offending file is in a directory `pytest` or a deployment script adds to `sys.path`
**Fix:** run the check against every directory that ends up on `sys.path`, computed from the running process rather than assumed

## Interview questions

**★ Does deleting the file always fix it?**
Only if you also restart the process, because `sys.modules` is consulted before
any search. And check for a legacy `.pyc` sitting where the `.py` was: PEP 3147
kept source-less imports working for `.pyc` files *outside* `__pycache__`. A
`.pyc` inside `__pycache__` is ignored when the source is gone, which the PEP
describes as eliminating *"the problem of accidental stale pyc file imports"* —
so the common folklore about `__pycache__` keeping a shadow alive is wrong.

**How would you prevent this class of bug across a team?**
Structurally, a `src/` layout, so the repository root is never on `sys.path` and
a stray file there cannot shadow anything. Operationally,
`PYTHONSAFEPATH=1` on every deployed entry point. And as a cheap backstop, a CI
check that walks the importable directories and flags any module whose stem is in
`sys.stdlib_module_names` or in `importlib.metadata.packages_distributions()`.
Each of the three catches cases the others miss.

**★ What is the fastest way to confirm a shadowing bug?**
`python -c "import random; print(random.__file__)"` from the failing working
directory with the failing interpreter. If the path points into your project, you
are done. If the import itself fails, `importlib.util.find_spec("random")` gives
you the origin without executing anything. And `python -P` is the confirmation:
if the failure disappears with `sys.path[0]` removed, the cause is a file in your
own directory.

**Is a `__pycache__` directory ever the cause of a stale import?**
Not for a module whose source is gone — PEP 3147 states the cache entry is
ignored when the `.py` is missing, and calls that out as eliminating accidental
stale imports. It *can* be the cause when the source still exists but its
timestamp and size match the cached entry, which happens with backups, archive
extraction and some VCS operations. The deterministic fix is hash-based `.pyc`
files.

**Your team keeps hitting this. What do you change?**
The layout, first: a `src/` directory means the repository root is never on
`sys.path`, so a stray `types.py` at the top level cannot shadow anything.
Then `PYTHONSAFEPATH=1` on every deployed entry point, which removes
`sys.path[0]` altogether. Then a CI check comparing module stems against
`sys.stdlib_module_names` and `importlib.metadata.packages_distributions()`.
The three catch different cases: the layout fixes development, the flag fixes
deployment, the check fixes review.

---

← Prev: [Shadowing the standard library](03-shadowing-the-stdlib.md) · Index: [Imports](README.md) · Next → [Packages and `__init__.py`](04-packages-and-init.md)
