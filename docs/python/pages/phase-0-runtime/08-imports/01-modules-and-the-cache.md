---
title: "Modules and the cache: sys.modules, and a body that runs exactly once"
sidebar_label: "1 · Modules and the cache"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (the module cache and submodule binding),
> [`sys.modules`](https://docs.python.org/3.14/library/sys.html#sys.modules) and
> [`importlib.reload`](https://docs.python.org/3.14/library/importlib.html#importlib.reload).
> Target: **CPython 3.14**.

**A module is an ordinary object whose attributes are the names its file defined,
and `sys.modules` is a plain dict mapping names to those objects. The import
statement checks that dict first, so a module body executes exactly once per
process no matter how many files import it. Almost everything surprising about
imports — module-level state behaving as a singleton, a monkeypatch that does
nothing, `reload` that half-works — is a direct consequence of those two
sentences.**

## A module is an object; import is assignment plus a side effect

```python
import json

type(json)          # <class 'module'>
json.dumps          # an attribute lookup on a module object — a dict lookup
json.__name__       # 'json'
json.__file__       # the path it was loaded from (absent for built-ins)
```

`import json` binds the name `json` in the *current* namespace to the module
object. `from json import dumps` binds `dumps` to the function object that is
currently the `dumps` attribute of that module. That difference is small, it is
permanent, and chunk [6 · Circular imports](06-circular-imports.md) and the
monkeypatching section below both turn on it.

## `sys.modules` is the cache, and it is a plain writable dict

> *"`sys.modules` is writable. Deleting a key may not destroy the associated
> module (as other modules may hold references to it), but it will invalidate the
> cache entry for the named module, causing Python to search anew for the named
> module upon its next import. The key can also be assigned to `None`, forcing
> the next import of the module to result in a `ModuleNotFoundError`."*

Three practical facts follow.

**The body runs once per process.** Ten files importing `config` produce one
execution of `config.py`. Whatever that body did — read an environment variable,
open a connection, build a registry, start a thread — happened once, at the
moment of the *first* import, in whatever order the program happened to import
things.

```python
# config.py
import os
print("configuring")                      # runs once, ever
DATABASE_URL = os.environ["DATABASE_URL"]  # read once, at first import
```

If `DATABASE_URL` is set after this module is first imported — by a test fixture,
by a `.env` loader that runs later, by a container init script — the module has
already captured the old value and will never look again. This is the single most
common reason "the env var is set but the app does not see it".

The fix is to make the read lazy rather than to fight the import system:

```python
# config.py
import os
import functools

@functools.cache                # computed on first call, not at import
def database_url() -> str:
    return os.environ["DATABASE_URL"]
```

**Module-level state is a process-wide singleton, whether you meant it or not.**

```python
# registry.py
_HANDLERS = {}                  # ONE dict for the process

def register(name, fn):
    _HANDLERS[name] = fn
```

That is the standard Python singleton and it is fine — as long as you know it is
one. It is also why a test that registers a handler pollutes every later test in
the same process, and why a `pytest` suite that passes file-by-file fails when
run together.

**The cache is keyed by the module's *name*, not its file.** Import the same file
under two names and you get two module objects with two independent copies of
every global:

```python
import mypkg.thing          # sys.modules['mypkg.thing']
import thing                # sys.modules['thing'] — a SECOND execution of the
                            # same file if both paths reach it
```

This is not hypothetical: it happens whenever a project is on `sys.path` both as
a package and as a directory of loose modules, which a `src`-less layout plus a
`pytest` rootdir insertion arranges routinely. The symptom is a class whose
`isinstance` check fails against an object that is visibly of that class — two
class objects from two executions of one file.

## Submodules are bound onto the parent package

> *"When a submodule is loaded using any mechanism (e.g. `importlib` APIs, the
> `import` or `import-from` statements, or built-in `__import__()`) a binding is
> placed in the parent module's namespace to the submodule object. For example,
> if package `spam` has a submodule `foo`, after importing `spam.foo`, `spam`
> will have an attribute `foo` which is bound to the submodule."*

The reference calls this an invariant: if `sys.modules['spam.foo']` exists, it
must be reachable as `spam.foo`. The practical consequence is a
frequently-misdiagnosed `AttributeError`:

```python
import os
os.path.join("a", "b")      # works — os imports os.path itself

import xml
xml.etree.ElementTree       # AttributeError: module 'xml' has no attribute 'etree'
```

`os` works because `os` imports `os.path` in its own body, so the binding exists.
`xml` does not import `xml.etree`, so nothing has ever bound that attribute.
`import xml.etree.ElementTree` (or `from xml.etree import ElementTree`) both
performs the import and creates the bindings. **Importing a package does not
import its submodules** — a package's `__init__.py` decides which submodules,
if any, are pulled in.

The mirror image bites too: because some *other* module imported `xml.etree`
earlier, `xml.etree` may be available in your module without you importing it.
That works until the day the other import is removed, and then your untouched
file starts raising `AttributeError`. Import what you use.

## Why your monkeypatch did nothing

This is `from x import y` colliding with the cache, and it is worth being very
concrete.

```python
# service.py
from utils import now          # binds service.now to the CURRENT utils.now object

def stamp():
    return now()
```

```python
# test_service.py — DOES NOT WORK
import utils
utils.now = fake_now           # rebinds utils.now
service.stamp()                # still calls the original: service.now was bound
                               # at import time and points at the old function
```

`service.now` and `utils.now` are two names that happened to point at one object.
Rebinding one does not move the other — the whole of topic
[07 · Everything is an object](../07-everything-is-an-object/README.md) in a
single failure. Two fixes:

```python
# Fix 1 — patch where the name is USED, not where it is defined
monkeypatch.setattr("service.now", fake_now)     # pytest
# or: unittest.mock.patch("service.now")
```

```python
# Fix 2 — import the module, not the name, so the lookup is deferred to call time
# service.py
import utils

def stamp():
    return utils.now()        # attribute lookup happens NOW, sees the patch
```

Fix 2 is the more robust design and it is the same technique that resolves
circular imports in chunk [6](06-circular-imports.md): **importing a module defers
the name lookup; importing a name freezes it at import time.**

## `importlib.reload` and why it disappoints

```python
import importlib
importlib.reload(mymodule)
```

Reload re-executes the module body **into the existing module object**. The docs
list the consequences, and every one of them is a reason not to rely on it:

> *"Other references to the old objects (such as names external to the module) are
> not rebound to refer to the new objects and must be updated in each namespace
> where they occur if that is desired."*

> *"If a module imports objects from another module using `from … import …`,
> calling `reload()` for the other module does not redefine the objects imported
> from it — one way around this is to re-execute the `from` statement, another is
> to use `import` and qualified names (module.name) instead."*

> *"If the new version of a module does not define a name that was defined by the
> old version, the old definition remains."*

> *"If a module instantiates instances of a class, reloading the module that
> defines the class does not affect the method definitions of the instances —
> they continue to use the old class definition."*

Read together: after a reload you have a module whose dict is a *merge* of the
old and new versions, live objects still pointing at the old classes and
functions, and any `from x import y` elsewhere still holding the old `y`. It is
also documented as **not thread-safe**. Reload is a REPL convenience, and even
there it lies often enough that restarting the process is the honest move. In a
service, restart. In tests, use a subprocess or a fixture that constructs fresh
objects.

There is one legitimate production-adjacent use: the docs point out that a module
can *cooperate* with reload by guarding its own state, which is how a module
keeps a cache across reloads:

```python
try:
    cache
except NameError:
    cache = {}
```

## Gotchas

**Symptom:** an environment variable is set, but the module reads the old value or raises `KeyError`
**Cause:** the module body ran at first import and captured the value then; setting the variable afterwards changes nothing
**Fix:** read the environment inside a function, cached with `functools.cache` if the lookup cost matters. Module-level `os.environ[...]` is a compile-time-ish constant in disguise

**Symptom:** a test passes alone and fails in the suite
**Cause:** module-level state is a process-wide singleton; an earlier test mutated it and nothing reset it
**Fix:** a fixture that snapshots and restores the state, or a module-level `reset()` the fixture calls. If the state is a registry, prefer passing it explicitly to letting import order build it

**Symptom:** `monkeypatch.setattr("utils.now", fake)` has no effect on `service.stamp()`
**Cause:** `service.py` did `from utils import now`, binding its own name at import time; patching `utils.now` moves a different label
**Fix:** patch the name where it is used — `monkeypatch.setattr("service.now", fake)` — or change `service.py` to `import utils` and call `utils.now()`

**Symptom:** `AttributeError: module 'xml' has no attribute 'etree'`
**Cause:** importing a package does not import its submodules; nothing has bound `etree` onto `xml`
**Fix:** `import xml.etree.ElementTree` or `from xml.etree import ElementTree`. The same applies to `os.path` only *appearing* to be an exception — `os` imports it explicitly

**Symptom:** code works because some unrelated module imported a submodule for you, then breaks when that module changes
**Cause:** submodule binding is global — once anything imports `pkg.sub`, `pkg.sub` is an attribute for everyone
**Fix:** import every module you reference. This is exactly the class of bug `ruff`'s implicit-import rules and a strict type checker catch for free

**Symptom:** `isinstance(obj, MyClass)` is False for an object that is obviously a `MyClass`
**Cause:** the defining file was executed twice under two module names, producing two distinct class objects
**Fix:** find the duplicate — `import sys; [m for m in sys.modules if m.endswith("mymodule")]` will usually show both keys. The root cause is nearly always a directory that is on `sys.path` *and* inside an importable package; a `src/` layout removes the possibility

**Symptom:** deleting an entry from `sys.modules` and re-importing gives an object that fails identity checks against the old one
**Cause:** the docs warn about exactly this — invalidating the cache and re-importing produces a *different* module object, while existing references still point at the old one
**Fix:** do not hand-manage `sys.modules` outside tests. If you must, delete the entry and re-import everything that referenced it, or restart the process

**Symptom:** `importlib.reload` picked up some edits and not others
**Cause:** reload merges into the existing module dict, leaves removed names in place, does not rebind `from`-imports elsewhere, and does not affect existing instances' classes
**Fix:** restart the process. Reload is a REPL convenience with documented, unfixable limits — and it is documented as not thread-safe

**Symptom:** a module body starts a thread, opens a socket or connects to a database, and it happens during test collection
**Cause:** import executes the body; `pytest` imports every test module and everything they import, at collection time
**Fix:** move side effects into a function the caller invokes. A module body should define things, not do things — that is also the precondition for the lazy imports in [11 · Startup and import cost](../11-startup-and-import-cost.md)

## Interview questions

**★ What does `import x` actually do?**
It checks `sys.modules` for the key `"x"`; if present it binds the name and stops.
Otherwise it finds the module (walking `sys.meta_path`, and for the path finder,
`sys.path`), creates a module object, **inserts it into `sys.modules` before
executing anything**, runs the module body top to bottom, and binds the name in
the importing namespace. For a submodule it also binds it as an attribute of the
parent package. The insert-before-execute step is what makes circular imports
fail with a "partially initialized module" error instead of recursing forever.

**★ How many times does a module body run?**
Once per process per name in `sys.modules`. Ten importers share one execution.
That is why module-level state is a singleton, why an `os.environ` read at module
level captures a snapshot, and why import-time side effects — connections,
threads, file writes — happen at an unpredictable point determined by import
order rather than by your control flow.

**★ Why did my monkeypatch not take effect?**
Because the module under test did `from helpers import now`, which bound *its
own* name to the function object at import time. Patching `helpers.now` rebinds a
different name; the module under test still holds a reference to the original
object. Patch `module_under_test.now`, or write the source as `import helpers`
and `helpers.now()` so the attribute lookup happens at call time and sees the
patch.

**★ Why does `import xml` not give you `xml.etree`?**
Because importing a package executes only its `__init__.py`; it does not import
submodules. The attribute `xml.etree` exists only after something imports
`xml.etree`. `os.path` looks like a counterexample but is not — `os` imports it
in its own body. The rule is: import the module you actually use, and never rely
on an attribute another module's import happened to create.

**What is the difference between `import x` and `from x import y`, beyond syntax?**
`import x` binds a module object; every use is an attribute lookup performed at
call time. `from x import y` performs the same import and then binds `y` in your
namespace to whatever object `x.y` is *at that moment*, permanently. That makes
`from` imports slightly faster to call, immune to later rebinding of `x.y`
(good for stability, bad for patching), and fragile under circular imports —
because it requires `y` to already exist when your module body runs, whereas
`import x` only requires the module object to exist.

**When is `importlib.reload` the right tool?**
Almost never outside an interactive session. It re-executes the body into the
existing module object, so the module's dict becomes a merge of old and new,
names deleted in the new version survive, existing instances keep their old
classes, and every `from x import y` elsewhere still holds the old object. It is
also documented as not thread-safe. For a development loop, restart the process
or use a watcher that does. For plugin systems, design for a fresh subprocess or
a real plugin API rather than reload.

**How would you find out why two "identical" classes fail an `isinstance` check?**
Print `MyClass.__module__` for both, and inspect `sys.modules` for two keys whose
values have the same `__file__`. That confirms the file was executed twice under
two names, which yields two unrelated class objects. The cause is a path
arrangement where the same file is reachable both as a top-level module and as a
package submodule — remove the duplicate `sys.path` entry, or adopt a `src/`
layout so the ambiguity cannot arise.

---

← Index: [Imports](README.md) · Next → [`sys.path`](02-sys-path.md)
