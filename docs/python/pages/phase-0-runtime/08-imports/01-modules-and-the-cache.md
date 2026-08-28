---
title: "Modules and the cache: sys.modules, and a body that runs exactly once"
sidebar_label: "1 · Modules and the cache"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (the module cache and submodule binding),
> [§7.11 The `import` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-import-statement)
> and [`sys.modules`](https://docs.python.org/3.14/library/sys.html#sys.modules).
> Target: **CPython 3.14**.

**A module is an ordinary object whose attributes are the names its file defined,
and `sys.modules` is a plain dict mapping names to those objects. The import
statement checks that dict first, so a module body executes exactly once per
process no matter how many files import it. Almost everything surprising about
imports — module-level state behaving as a singleton, an environment variable
read too early, an `AttributeError` on a package you definitely imported — is a
direct consequence of those two sentences.**

## A module is an object; import is assignment plus a side effect

```python
import json

type(json)          # the built-in module type, types.ModuleType
json.dumps          # an attribute lookup on a module object — a dict lookup
json.__name__       # 'json'
json.__file__       # the path it was loaded from (absent for built-ins)
json.__dict__       # the module's namespace, as a mapping
```

A module's global namespace **is** its `__dict__`. When `json.py` executes
`def dumps(...)`, that is a `STORE_NAME` into the module's dict, and
`json.dumps` afterwards is a lookup in that same dict. There is no separate
"exports" mechanism: the module body's leftover globals *are* the public
surface, which is why a stray `import os` at the top of a module makes
`yourmodule.os` a real, working attribute.

The language reference spells out that `import` is fundamentally a binding
statement:

> *"The basic import statement (no `from` clause) is executed in two steps:
> 1. find a module, loading and initializing it if necessary
> 2. define a name or names in the current namespace for the scope where the
> `import` statement occurs, just as an assignment statement would (including
> `global` and `nonlocal` semantics)."*

So `import json` binds the name `json` in the *current* namespace to the module
object. The `from` form does something subtly different, and the reference is
precise about the order of operations:

> *"1. find the module specified in the `from` clause, loading and initializing
> it if necessary; 2. for each of the identifiers specified in the `import`
> clauses: 1. check if the imported module has an attribute by that name 2. if
> not, attempt to import a submodule with that name and then check the imported
> module again for that attribute 3. if the attribute is not found, `ImportError`
> is raised. 4. otherwise, a reference to that value is stored in the current
> namespace…"*

Two things fall out of that quoted list and both matter later.
`from pkg import thing` will happily fetch either an *attribute* of `pkg` or a
*submodule* named `thing` — you cannot tell from the call site which one you
got. And the value stored in your namespace is a reference captured **at that
moment**; it is not a live view of `pkg.thing`. Chunk
[1b · Reload and monkeypatching](01b-reload-and-monkeypatching.md) turns that
second fact into a debugging story, and chunk
[6 · Circular imports](06-circular-imports.md) turns it into a crash.

One more asymmetry from the same section, easy to miss:

> *"If the module being imported is *not* a top level module, then the name of
> the top level package that contains the module is bound in the local namespace
> as a reference to the top level package. The imported module must be accessed
> using its full qualified name rather than directly"*

`import xml.etree.ElementTree` binds the name **`xml`**, not `ElementTree`. That
is why the statement is nearly always written `from xml.etree import ElementTree`
or `import xml.etree.ElementTree as ET`.

## `sys.modules` is the cache, and it is a plain writable dict

> *"The first place checked during import search is `sys.modules`. This mapping
> serves as a cache of all modules that have been previously imported, including
> the intermediate paths. So if `foo.bar.baz` was previously imported,
> `sys.modules` will contain entries for `foo`, `foo.bar`, and `foo.bar.baz`."*

> *"During import, the module name is looked up in `sys.modules` and if present,
> the associated value is the module satisfying the import, and the process
> completes. However, if the value is `None`, then a `ModuleNotFoundError` is
> raised. If the module name is missing, Python will continue searching for the
> module."*

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
print("configuring")                       # runs once, ever
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

The reference calls this an invariant:

> *"The invariant holding is that if you have `sys.modules['spam']` and
> `sys.modules['spam.foo']` (as you would after the above import), the latter
> must appear as the `foo` attribute of the former."*

The practical consequence is a frequently-misdiagnosed `AttributeError`:

```python
import os
os.path.join("a", "b")      # works — os imports os.path itself

import xml
xml.etree.ElementTree       # AttributeError: 'xml' has no attribute 'etree'
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

## Gotchas

**Symptom:** an environment variable is set, but the module reads the old value or raises `KeyError`
**Cause:** the module body ran at first import and captured the value then; setting the variable afterwards changes nothing
**Fix:** read the environment inside a function, cached with `functools.cache` if the lookup cost matters. Module-level `os.environ[...]` is a compile-time-ish constant in disguise

**Symptom:** a test passes alone and fails in the suite
**Cause:** module-level state is a process-wide singleton; an earlier test mutated it and nothing reset it
**Fix:** a fixture that snapshots and restores the state, or a module-level `reset()` the fixture calls. If the state is a registry, prefer passing it explicitly to letting import order build it

**Symptom:** `AttributeError` saying module `xml` has no attribute `etree`
**Cause:** importing a package does not import its submodules; nothing has bound `etree` onto `xml`
**Fix:** `import xml.etree.ElementTree` or `from xml.etree import ElementTree`. `os.path` only *appears* to be an exception — `os` imports it explicitly in its own body

**Symptom:** code works because some unrelated module imported a submodule for you, then breaks when that module changes
**Cause:** submodule binding is global — once anything imports `pkg.sub`, `pkg.sub` is an attribute for everyone
**Fix:** import every module you reference. This is exactly the class of bug `ruff`'s implicit-import rules and a strict type checker catch for free

**Symptom:** `import xml.etree.ElementTree` succeeds but the name `ElementTree` is not defined
**Cause:** for a dotted import with no `as`, the reference binds only the *top level* package name — you got `xml`
**Fix:** `from xml.etree import ElementTree`, or `import xml.etree.ElementTree as ET`

**Symptom:** `isinstance(obj, MyClass)` is False for an object that is obviously a `MyClass`
**Cause:** the defining file was executed twice under two module names, producing two distinct class objects
**Fix:** find the duplicate — `[m for m in sys.modules if m.endswith("mymodule")]` will usually show both keys. The root cause is nearly always a directory that is on `sys.path` *and* inside an importable package; a `src/` layout removes the possibility

**Symptom:** an import that used to work now raises `ModuleNotFoundError` and the file is definitely there
**Cause:** something assigned `None` to that key in `sys.modules`. The reference states that a `None` value forces `ModuleNotFoundError` on the next import — it is a documented "poison the cache" mechanism, sometimes used by test tooling to simulate a missing dependency
**Fix:** check `sys.modules.get("thename", "absent")` for a literal `None`. Delete the key rather than setting it to `None` if you actually want a re-import

**Symptom:** a module body starts a thread, opens a socket or connects to a database, and it happens during test collection
**Cause:** import executes the body; `pytest` imports every test module and everything they import, at collection time
**Fix:** move side effects into a function the caller invokes. A module body should define things, not do things — that is also the precondition for the lazy imports in [11 · Startup and import cost](../11-startup-and-import-cost/README.md)

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
Once per process per key in `sys.modules`. Ten importers share one execution.
That is why module-level state is a singleton, why an `os.environ` read at module
level captures a snapshot, and why import-time side effects — connections,
threads, file writes — happen at an unpredictable point determined by import
order rather than by your control flow. The corollary is that the same *file*
can run twice if it is reachable under two different module *names*, because the
cache is keyed by name, not by path.

**★ Why does `import xml` not give you `xml.etree`?**
Because importing a package executes only its `__init__.py`; it does not import
submodules. The attribute `xml.etree` exists only after something imports
`xml.etree`. `os.path` looks like a counterexample but is not — `os` imports it
in its own body. The rule is: import the module you actually use, and never rely
on an attribute another module's import happened to create.

**★ Where does a module's namespace live, and what does that imply?**
In the module object's `__dict__`. The module body's globals *are* its
attributes, so there is no export list unless you write one. Practical
implications: a helper import at the top of a module is publicly reachable as
`mod.helper`; `del` at the end of a module body is a real (if crude) way to hide
a name; and `from mod import *` needs `__all__` precisely because otherwise
"public" means "every global not starting with an underscore".

**What is the difference between `sys.modules` containing `None` for a key and
not containing the key at all?**
Missing means "not yet imported — go and search". A `None` value is documented to
make the next import raise `ModuleNotFoundError` without searching. That makes it
a deliberate blocking mechanism, and it also makes it a very confusing bug when
some test helper sets it and forgets to clean up, because the file is plainly on
disk and plainly on `sys.path`.

---

← Index: [Imports](README.md) · Next → [Reload and monkeypatching](01b-reload-and-monkeypatching.md)
