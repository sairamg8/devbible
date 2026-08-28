---
title: "The module object is cached before its body runs, and that single fact is what a circular import error is telling you"
sidebar_label: "6 · Circular imports"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (the module cache, loading, submodules),
> [§7.11 The `import` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-import-statement)
> (the `from` form's lookup order), and the CPython 3.14 sources
> [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)
> and [`Objects/moduleobject.c`](https://github.com/python/cpython/blob/3.14/Objects/moduleobject.c)
> for the exact wording of the "partially initialized module" errors.
> Target: **CPython 3.14**.

**Python inserts a module into `sys.modules` *before* executing its body. That is
what stops a cycle from recursing forever — the second import finds the cache
entry and returns immediately — and it is also what makes the module it returns
half-built. A circular import never fails because of the cycle; it fails because
some name you asked for had not been defined yet when you asked. Which means the
question to ask is never "how do I break this cycle?" but "what had not run
yet, and did I need it at import time or at call time?"**

## The order of operations, and why it must be this way

For a cache miss, the machinery creates the module object, **inserts it into
`sys.modules`, and only then executes the body**. The reference makes the reason
explicit in its loading description: the module is placed in the cache first so
that *"if the module is already in `sys.modules`… the import statement will
return it"* — including when the importer is the module's own transitive
dependency.

Trace `import a` where `a` imports `b` and `b` imports `a`:

1. `sys.modules["a"]` is created, empty. `a`'s body starts.
2. Line 1 of `a` is `import b`. `sys.modules["b"]` is created, empty. `b`'s body
   starts.
3. Line 1 of `b` is `import a`. **`sys.modules["a"]` already exists**, so the
   name `a` binds to the half-built module object and `b` continues.
4. `b`'s body finishes. Control returns to `a` line 2.
5. `a`'s body finishes.

No error anywhere. The cycle terminated because of the cache, and `b` got a
module object that was missing everything defined after line 1 of `a` — which was
fine, because `b` only stored the reference and did not read anything off it yet.

Now change one word.

## `import x` and `from x import y` are not interchangeable here

```python
# a.py
import b
X = 1
```

```python
# b.py
from a import X          # needs a.X to EXIST, right now
```

Step 3 now becomes: `a` is in `sys.modules` but has no attribute `X` yet, because
`X = 1` is on the line *after* `import b`. The `from` form is specified to look
for the attribute first and then to try importing a submodule of that name, and
neither succeeds, so it raises. CPython's `Python/ceval.c` formats the message as
`cannot import name %R from partially initialized module %R (most likely due to a
circular import) (%S)` — the parenthesised path at the end being the file it
looked in.

The asymmetry is exact:

| Form | What it requires at the moment it runs |
|---|---|
| `import a` | that `sys.modules["a"]` exists — true from the first instant |
| `from a import X` | that the *attribute* `a.X` already exists |
| `import a` then `a.X` **inside a function** | that `a.X` exists when the function is *called* |
| `import a` then `a.X` **at module level** | that `a.X` exists now — same failure as `from` |

That table is the whole chapter. `import a` defers the lookup to the point of
use; `from a import X` performs the lookup immediately. In a cycle, "immediately"
means "before the other module has finished defining things".

## The three shapes, and the message each produces

**Shape 1 — `from` import at module level.** As above:
`cannot import name 'X' from partially initialized module 'a' (most likely due to
a circular import)`. The named module is *not* broken; it is merely unfinished.

**Shape 2 — attribute access at module level.**

```python
# a.py
import b
X = 1
```
```python
# b.py
import a
Y = a.X                  # attribute read at import time — same problem
```

`Objects/moduleobject.c` produces `partially initialized module '%U' from '%U'
has no attribute '%U' (most likely due to a circular import)`. Note this is an
`AttributeError`, not an `ImportError` — so a `try: ... except ImportError:`
guard will not catch it.

**Shape 3 — submodule access before the submodule finished.** The same source
carries a third message, `cannot access submodule '%U' of module '%U' (most
likely due to a circular import)`, emitted when the attribute names a submodule
whose spec exists but which has not been initialised. This is the shape that
appears in packages whose `__init__.py` imports submodules that import each
other.

And there is a fourth wording you will meet that is *not* about cycles at all:
when the module is fully initialised, CPython emits the plain
`cannot import name %R from %R (%S)`. If you see the version *without* "partially
initialized", the cycle is not your problem — the name genuinely does not exist,
usually a version mismatch.

Conversely, the "(most likely due to a circular import)" wording is a heuristic
and it lies in one specific case: [chunk 3](03-shadowing-the-stdlib.md) showed
that a shadowing file reached through `PYTHONPATH` rather than `sys.path[0]`
produces exactly this message with no cycle in sight. Always confirm with
`module.__file__` before you start restructuring.

## Why moving the import "to the bottom" sometimes works and is still wrong

```python
# a.py
X = 1
import b                 # moved below the definition — b's `from a import X` now works
```

This does fix shape 1, and it is the single most common patch applied to a
circular import. It is also a landmine, for three reasons:

1. It makes correctness depend on **statement order within a module body**, which
   nothing in the codebase documents and every autoformatter, linter and
   "organise imports" command wants to undo. `ruff`'s `E402`
   (module-level-import-not-at-top-of-file) exists precisely to flag it.
2. It fixes exactly one entry point. The order `import a` works; the order
   `import b` first may still fail, because then `b` runs before `a` has defined
   anything.
3. It hides the real problem, which is a design cycle between two modules.

Whether it works at all depends on which module is imported *first*, and that is
determined by whichever unrelated file the interpreter happens to reach first —
not something you control across an application, a test suite and a
`multiprocessing` child.

The fixes that hold are in [chunk 6b](06b-breaking-circular-imports.md).

## Cycles that never fail, and why they are worse

A cycle where both sides use only `import x` and only touch attributes inside
functions works perfectly. It also:

- makes import order load-bearing in a way no test exercises;
- turns any future `from x import y` — added by someone who does not know about
  the cycle — into an error at a distance;
- makes the modules impossible to import individually, so a REPL session or a
  focused unit test that imports only the "lower" module executes the "higher"
  one too;
- doubles as a latent startup cost, because importing either module imports both.

A cycle that does not currently raise is not a cycle that is fine. It is a cycle
whose failure has been deferred to whoever next edits either file.

## Gotchas

**Symptom:** `ImportError: cannot import name 'X' from partially initialized module 'a'`
**Cause:** a cycle plus a `from` import: `a` is in `sys.modules` but has not yet executed the line that defines `X`
**Fix:** change the importer to `import a` and use `a.X` at call time, or move `X` into a third module both can import. See [chunk 6b](06b-breaking-circular-imports.md)

**Symptom:** `AttributeError: partially initialized module 'a' … has no attribute 'X'`
**Cause:** the same cycle, but the access was `a.X` at module level rather than a `from` import
**Fix:** the same remedies — but note this one is an `AttributeError`, so any `except ImportError:` optional-dependency guard silently fails to catch it

**Symptom:** `cannot access submodule 'sub' of module 'pkg' (most likely due to a circular import)`
**Cause:** the submodule's spec exists but its body has not completed; something reached `pkg.sub` while `pkg.sub` was still importing
**Fix:** import the submodule where it is used rather than relying on the parent attribute, and stop `__init__.py` from importing submodules that import each other

**Symptom:** the error says "most likely due to a circular import" and there is no cycle
**Cause:** a shadowing module reached `sys.path` other than through `sys.path[0]`, so CPython's shadowing heuristic declined to mention it
**Fix:** print `__file__` for the module named in the message. If it is in your project and its name is a stdlib or installed-package name, it is a shadow, not a cycle

**Symptom:** the error message says "cannot import name X from Y" with *no* "partially initialized"
**Cause:** `Y` finished importing and simply has no `X` — a renamed symbol, a version mismatch, a typo
**Fix:** check the installed version. This is not a circular import and restructuring will not help

**Symptom:** an import works from one entry point and fails from another
**Cause:** which module of the cycle is imported first is decided by the entry point, and only one order happens to define the needed names in time
**Fix:** do not tune the order. A cycle that is correct in only one direction is not correct

**Symptom:** moving an import to the bottom of the file fixed it, and CI now fails on `E402`
**Cause:** the fix depends on statement order, which the linter is designed to prevent
**Fix:** treat the lint failure as accurate. Apply a structural fix instead of adding a `noqa`

**Symptom:** a test that imports only one module of a pair pulls in both
**Cause:** the cycle — importing either module imports the other
**Fix:** this is the diagnostic, not the bug. It is how you find cycles that never raise: import each module of the package alone and watch what else appears in `sys.modules`

**Symptom:** the cycle appeared the moment `__init__.py` gained re-exports
**Cause:** `mypkg/__init__.py` imports `mypkg.engine`, and `mypkg/engine.py` does `from mypkg import Config` — but `mypkg` is only partially initialised while its own `__init__.py` is running
**Fix:** submodules must never import from their own package root. Import from the defining submodule: `from mypkg.config import Config`

**Symptom:** a cycle only shows up under `multiprocessing` or in a frozen build
**Cause:** those re-import the main module or import modules in a different order, exposing an order dependency the normal entry point hid
**Fix:** the order dependency is the bug. Remove the cycle rather than special-casing the launcher

## Interview questions

**★ What does "cannot import name X from partially initialized module Y" actually mean?**
That `Y` is present in `sys.modules` — so it is already being imported somewhere
up the stack — but its body has not yet reached the line that defines `X`. The
module object is inserted into the cache *before* its body executes, which is
what prevents infinite recursion in a cycle; the price is that a cycle hands you
a half-built module. The error is about *timing*, not about the cycle as such.

**★ Why does `import x` survive a circular import when `from x import y` does not?**
`import x` only requires the module object to exist, and it exists from the
instant the import begins, because it is cached before the body runs. Every use
of `x.y` afterwards is an attribute lookup performed at that moment — so if it
happens inside a function, it happens long after both modules finished.
`from x import y` performs the attribute lookup immediately, while `x` is still
half-executed, and there is nothing to fetch.

**★ Why doesn't a circular import recurse forever?**
Because `sys.modules` is checked first and the module object is inserted there
before its body runs. The second, re-entrant import finds the entry and returns
it straight away. Without the insert-before-execute ordering, `a` importing `b`
importing `a` would restart `a`'s body and never terminate.

**Is a circular import that does not raise an error acceptable?**
It works, and it is still a defect. It makes import order load-bearing without
any test covering it, so the next `from` import someone adds — or a different
entry point, or a `multiprocessing` child that imports in another order — turns
it into a failure. It also means neither module can be imported alone, which
inflates startup cost and makes focused testing impossible.

**How do you tell a real circular import from a shadowed module?**
Print `__file__` of the module the message names. A genuine cycle names a module
of yours that appears twice in the import stack — the traceback shows both
frames. A shadow names a stdlib or third-party module whose `__file__` points
into your project. CPython's "most likely due to a circular import" wording is a
heuristic and is emitted for shadowing files that are not in `sys.path[0]`.

**Which exception type does a circular import raise?**
Both, depending on the syntax. A failing `from a import X` raises `ImportError`;
a failing `a.X` at module level raises `AttributeError`, because by then it is an
ordinary attribute lookup on a module object. That matters for error handling: an
`except ImportError:` guard around an optional dependency will not catch the
attribute form.

**Where do circular imports come from, structurally?**
Almost always from two modules that share a concept neither owns — a type used in
both directions, a settings object, a registry — or from submodules importing
their own package's `__init__.py`. Both are design problems with structural
fixes: extract the shared piece, or invert the dependency so one side stops
knowing about the other.

---

← Prev: [Running a module](05b-running-a-module.md) · Index: [Imports](README.md) · Next → [Breaking circular imports](06b-breaking-circular-imports.md)
