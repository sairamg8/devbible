---
title: "Imports: a cache, a search path, and a module body that runs exactly once"
sidebar_label: "08 · Imports"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html),
> [`sys.path` initialisation](https://docs.python.org/3.14/library/sys_path_init.html),
> the [`importlib`](https://docs.python.org/3.14/library/importlib.html) and
> [`sys`](https://docs.python.org/3.14/library/sys.html) module docs,
> [PEP 328](https://peps.python.org/pep-0328/) (absolute and relative imports) and
> [PEP 420](https://peps.python.org/pep-0420/) (implicit namespace packages).
> Target: **CPython 3.14**.

**`import x` does three things: it looks in a cache, and if the name is absent it
searches a list of directories, executes the file it finds as a module body, and
stores the resulting module object in the cache. Every import bug you will ever
debug is one of those three steps behaving exactly as designed. The cache is why
your monkeypatch did not take and why module-level state is a singleton. The
search path is why naming a file `random.py` breaks a library you never called.
The one-time execution is why a circular import fails with a message about a
"partially initialized module".**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Modules and the cache](01-modules-and-the-cache.md)** | What a module object is; `sys.modules`; the body runs once; module-level state; submodule binding onto the parent |
| 1b | **[Reload and monkeypatching](01b-reload-and-monkeypatching.md)** | Why patching the wrong name does nothing; where to patch; `importlib.reload` and its documented limits |
| 1c | **[Attributes and specs](01c-module-attributes-and-specs.md)** | `__name__`, `__spec__`, `__file__`; the `__package__` removal in 3.15; `ModuleSpec`; `find_spec` |
| 1d | **[Cache surgery](01d-cache-surgery.md)** | Forcing a re-import, restoring `sys.modules` in tests, and `importlib.invalidate_caches` |
| 2 | **[`sys.path`](02-sys-path.md)** | The five stages; what the launch mode puts at `sys.path[0]`; `-m` vs a file vs a directory vs the REPL; what `pytest` inserts |
| 2b | **[`PYTHONPATH` and site-packages](02b-pythonpath-and-site-packages.md)** | `PYTHONPATH`, `prefix`/`exec_prefix`, venvs and `pyvenv.cfg`, `.pth` files, `sitecustomize` |
| 2c | **[Controlling `sys.path`](02c-controlling-sys-path.md)** | `-P`/`PYTHONSAFEPATH`, `-I`, `-E`, `-s`, `-S`, `._pth`, and the `sys.path.insert` you should not write |
| 2d | **[Diagnosing failures](02d-diagnosing-import-failures.md)** | `ImportError` vs `ModuleNotFoundError`, `exc.name`, the six-command recipe, `-X importtime`, `packages_distributions` |
| 3 | **[Shadowing the standard library](03-shadowing-the-stdlib.md)** | The `random.py` bug in full — three failure shapes, exactly when CPython's hint fires, and the names that bite |
| 3b | **[Diagnosis and prevention](03b-diagnosing-and-preventing-shadowing.md)** | What a `__pycache__` leftover really does, stale `.pyc` invalidation, the four-command check, `src/` layouts |
| 4 | **[Packages and `__init__.py`](04-packages-and-init.md)** | Regular packages; `__path__`; what re-exporting costs at import time; lazy re-export with PEP 562 `__getattr__` |
| 4b | **[Exports and `__all__`](04b-exports-and-all.md)** | `from pkg import name` checking an attribute before a submodule; what `__all__` does and does not do |
| 4c | **[Namespace packages](04c-namespace-packages.md)** | PEP 420; how a portion scan works; the accidental namespace package that works in the repo and breaks once installed |
| 5 | **[Absolute and relative imports](05-relative-imports.md)** | Dots resolved against `__spec__.parent`; why implicit relative imports are gone; the two relative-import errors |
| 5b | **[Running a module](05b-running-a-module.md)** | `python -m pkg.mod` vs `python pkg/mod.py`; `runpy`; the `__main__` double-import; why the PEP 366 trick expired |
| 6 | **[Circular imports](06-circular-imports.md)** | Cached-before-executed; what "partially initialized module" means; the `import x` / `from x import y` asymmetry |
| 6b | **[Breaking circular imports](06b-breaking-circular-imports.md)** | The four structural fixes, in code: defer, localise, extract, invert |
| 6c | **[Type-checking-only imports](06c-type-checking-imports.md)** | `if TYPE_CHECKING`; what PEP 649 changed on 3.14; the runtime-introspection trap |

## The mechanism, in one pass

`import foo.bar` is roughly:

1. **Cache check.** Is `"foo.bar"` a key in `sys.modules`? If yes, bind and stop.
   Nothing else happens — no file is read, no code runs.
2. **Parent first.** `foo` is imported before `foo.bar`, recursively, same rules.
3. **Find.** The finders in `sys.meta_path` are consulted in order; the last of
   them, `PathFinder`, walks `sys.path` (or `foo.__path__` for a submodule) looking
   for a match.
4. **Create and cache.** A module object is created and inserted into
   `sys.modules` **before** its body runs — this is what makes circular imports
   fail the way they do rather than recursing forever.
5. **Execute.** The module body runs top to bottom, once.
6. **Bind.** The name is bound in the importing namespace, and the submodule is
   bound as an attribute of its parent package.

Steps 1, 4 and 5 are the ones people are surprised by, and they are the subject
of chunks 1 and 6.

## Why this is a Master row

- **It is the most common cause of "it works on my machine".** Path
  construction depends on how you launched the process, not on where the files
  are. The same source tree imports differently under `python app.py`,
  `python -m app`, `pytest`, and a container `CMD`.
- **The failure modes lie about their cause.** A shadowed stdlib module produces
  an `AttributeError` deep inside a third-party library. A circular import
  produces an `ImportError` naming a module that is perfectly fine. Nothing in
  the message points at the file you need to rename or the import you need to
  move.
- **It is the foundation of Phase 7 (packaging).** `src` layouts, editable
  installs, entry points and "why does my package work in the repo and not once
  installed" are all consequences of the rules in this topic.

## Where this connects

- **09 · `if __name__ == "__main__"`** *(not written yet)* is the direct
  sequel: the guard exists because `multiprocessing` re-imports your main module
  in the child process.
- **11 · Startup and import cost** *(not written yet)* turns
  "the body runs once" into "the body runs once *and you pay for it at startup*",
  and introduces PEP 810 lazy imports.
- **Phase 6 — Typing** picks up `if TYPE_CHECKING`, introduced in
  [chunk 6c](06c-type-checking-imports.md) as a circular-import remedy.
- **Phase 7 — Packaging** turns `__init__.py`, namespace packages and the `src`
  layout into project structure decisions.

---

← Prev: [Everything is an object](../07-everything-is-an-object/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [Modules and the cache](01-modules-and-the-cache.md)
