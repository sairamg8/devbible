---
title: "Cache surgery: forcing a re-import, restoring sys.modules, and making a new file visible"
sidebar_label: "1d · Cache surgery"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (the module cache),
> [`importlib.invalidate_caches`](https://docs.python.org/3.14/library/importlib.html#importlib.invalidate_caches)
> and [`importlib.import_module`](https://docs.python.org/3.14/library/importlib.html#importlib.import_module).
> Target: **CPython 3.14**.

**There are two caches between your source tree and a working `import`, and they
fail differently. `sys.modules` holds already-executed modules, so editing it
changes what a name resolves to but never updates anyone already holding a
reference. The finders hold cached directory listings, so a file created after
the interpreter started can be invisible even though it is plainly on
`sys.path`. Knowing which cache you are fighting is most of the fix.**

## Hand-managing `sys.modules`

`sys.modules` is writable, so the obvious "force a re-import" is
`del sys.modules["mymod"]` followed by `import mymod`. The reference warns about
the result:

> *"Beware though, as if you keep a reference to the module object, invalidate its
> cache entry in `sys.modules`, and then re-import the named module, the two
> module objects will *not* be the same. By contrast, `importlib.reload()` will
> reuse the *same* module object…"*

So the choice is between two flavours of the same problem:
[`reload`](01b-reload-and-monkeypatching.md) keeps one object with a merged dict,
and delete-plus-reimport gives a clean object that nothing else is holding.
Neither makes existing references catch up.

If you must do it in a test, do it through a fixture that restores the mapping,
and use `monkeypatch.delitem` rather than a bare `del` so the removal is undone
even when the test fails:

```python
@pytest.fixture
def fresh_config(monkeypatch):
    monkeypatch.delitem(sys.modules, "myapp.config", raising=False)
    import myapp.config
    return myapp.config
```

Note the trap this only half-solves: any *other* module that already did
`from myapp.config import SETTINGS` still holds the old object, and re-importing
`myapp.config` does not update it. The fresh module is only fresh for code that
reads it after the fixture ran.

The blunter instrument — snapshot and restore the whole mapping — at least makes
the blast radius explicit:

```python
@pytest.fixture
def isolated_modules():
    saved = dict(sys.modules)
    try:
        yield
    finally:
        sys.modules.clear()
        sys.modules.update(saved)
```

That still does not undo class objects handed out during the test. For a
genuinely clean module graph the only correct tool is a fresh process.

## When Python does not see a file you just created

The other half of "the cache lied to me" is not `sys.modules` at all — it is the
finders' own directory caches. If your program writes a `.py` file and then
imports it, the import may fail because the path entry finder cached the
directory listing from before the write:

> *"If you are dynamically importing a module that was created since the
> interpreter began execution (e.g., created a Python source file), you may need
> to call `invalidate_caches()` in order for the new module to be noticed by the
> import system."*

> *"Invalidate the internal caches of finders stored at `sys.meta_path`. If a
> finder implements `invalidate_caches()` then it will be called to perform the
> invalidation. This function should be called if any modules are
> created/installed while your program is running to guarantee all finders will
> notice the new module's existence."*

```python
import importlib, pathlib

pathlib.Path("plugins/new_plugin.py").write_text(source)
importlib.invalidate_caches()             # required, not optional
mod = importlib.import_module("plugins.new_plugin")
```

This is the correct call for code generators, plugin installers, and any test
that writes a module into a `tmp_path` on `sys.path`. It is *not* a substitute
for `reload` — it makes a new module findable, it does not re-run an old one. The
3.10 release note extends it to namespace packages: *"Namespace packages
created/installed in a different `sys.path` location after the same namespace was
already imported are noticed."*

## Gotchas

**Symptom:** deleting an entry from `sys.modules` and re-importing gives an object that fails identity checks against the old one
**Cause:** the reference warns about exactly this — invalidating the cache and re-importing produces a *different* module object, while existing references still point at the old one
**Fix:** do not hand-manage `sys.modules` outside tests. If you must, delete the entry and re-import everything that referenced it, or restart the process

**Symptom:** a test that deletes a `sys.modules` key breaks a completely different test file later in the run
**Cause:** the deletion was not undone, so the next importer re-executes the module body and gets a second copy of its module-level state
**Fix:** `monkeypatch.delitem(sys.modules, name, raising=False)`, which restores the entry at teardown. Never a bare `del sys.modules[...]` in a test body

**Symptom:** a fixture that restores `sys.modules` still leaks state between tests
**Cause:** restoring the mapping does not undo the objects handed out while it was modified — classes, instances, registered callbacks and `from x import y` bindings all survive
**Fix:** accept the limit and isolate at the process level (`pytest-forked`, `pytest-xdist` with one test per worker, or a subprocess) when the module under test genuinely cannot be re-entered

**Symptom:** a plugin file written at runtime raises `ModuleNotFoundError` even though it is on disk and on `sys.path`
**Cause:** the path entry finder cached the directory contents before the file existed
**Fix:** `importlib.invalidate_caches()` before the import — the documented remedy for modules created after interpreter start

**Symptom:** installing a package with `pip` from inside a long-running process does not make it importable
**Cause:** the same finder caches, plus a possible new `.pth` file that only `site` processing would read
**Fix:** `importlib.invalidate_caches()` covers the finder side. It does not re-run `site`, so a distribution that relies on a `.pth` file still needs a restart

**Symptom:** a namespace package gains a new portion at runtime and imports of it still fail
**Cause:** the same finder cache, in the one place where it is least expected — namespace `__path__` recomputation is driven by the parent path changing, not by the directory changing
**Fix:** `importlib.invalidate_caches()`; the 3.10 change note states that namespace packages *"created/installed in a different `sys.path` location after the same namespace was already imported are noticed"*

**Symptom:** `del sys.modules["pkg.sub"]` and a re-import produce a `pkg.sub` that is not `pkg.sub`
**Cause:** deleting the child does not clear the attribute binding on the parent package, so `pkg.sub` still names the old module object while `sys.modules["pkg.sub"]` names the new one — the reference's submodule invariant is broken by hand
**Fix:** delete the parent's attribute too, or delete both cache entries. Better: do not do this outside a throwaway process

**Symptom:** `importlib.import_module` with a relative name raises `TypeError` or resolves to the wrong module
**Cause:** the relative form requires the anchor — *"the `package` argument must be set to the name of the package which is to act as the anchor for resolving the package name"*
**Fix:** `importlib.import_module("..mod", "pkg.subpkg")`, or just pass the absolute name. Dynamic imports are one of the few places where an absolute name is unambiguously right

## Interview questions

**★ How would you force a module to re-run its body, and what breaks?**
Delete its key from `sys.modules` (through `monkeypatch.delitem` so it is
restored) and import it again. What breaks is everything that already holds a
reference: the reference says the two module objects will *not* be the same, so
any earlier `from mymod import thing` still holds the old `thing`, any class the
module defines now has two versions, and `isinstance` across the boundary fails.
If a test needs a genuinely clean module graph, the honest tool is a subprocess.

**★ A program writes a module to disk and imports it. It works on your laptop and
fails in CI. First hypothesis?**
No `importlib.invalidate_caches()` between the write and the import. Path entry
finders cache directory listings, and the docs state that a module created after
interpreter start may not be noticed without invalidating them. Whether the stale
cache bites depends on whether that directory was ever scanned before the write —
exactly the kind of ordering difference another machine changes.

**★ Is snapshotting and restoring `sys.modules` a safe way to isolate tests?**
It restores the *mapping*, not the world. Class objects, instances, registries
and `from x import y` bindings handed out during the test survive the restore and
now point at modules that are no longer in the cache. It is better than nothing
for one well-understood module, and it is not equivalent to a fresh process —
which is what real test isolation costs.

**What is the difference between `importlib.reload(m)` and
`del sys.modules[name]; import name`?**
`reload` re-executes the body into the *same* module object, so external
references keep working but see a dict that is a merge of old and new. The delete
form produces a brand-new module object with a clean dict, which nothing else is
pointing at. Neither updates existing `from`-imports. Choose `reload` when you
want existing references to keep resolving; choose the delete form when you want
a guaranteed-fresh namespace and control every importer.

**Does `importlib.invalidate_caches()` help with a module that is already
imported?**
No. It invalidates the *finders*, so a subsequent search can discover files that
did not exist before. A module already in `sys.modules` is never searched for
again, so invalidation has no effect on it — that case needs `reload` or a cache
deletion, or a restart.

**Why does deleting `sys.modules["pkg.sub"]` not fully undo the import?**
Because the import system also bound `sub` as an attribute of `pkg`, and the
reference states that binding as an invariant of a loaded submodule. Removing the
cache entry leaves the attribute pointing at the old module object, so `pkg.sub`
and `sys.modules["pkg.sub"]` can disagree — which is worse than either state
alone, because code that reaches the module by attribute and code that reaches it
by import now get different objects.

---

← Prev: [Attributes and specs](01c-module-attributes-and-specs.md) · Index: [Imports](README.md) · Next → [`sys.path`](02-sys-path.md)
