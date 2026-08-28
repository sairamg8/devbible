---
title: "Why your monkeypatch did nothing, and why importlib.reload will not save you"
sidebar_label: "1b · Reload and monkeypatching"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [`importlib.reload`](https://docs.python.org/3.14/library/importlib.html#importlib.reload),
> the [import system reference](https://docs.python.org/3.14/reference/import.html)
> (module cache), and
> [`unittest.mock` — Where to patch](https://docs.python.org/3.14/library/unittest.mock.html#where-to-patch).
> Target: **CPython 3.14**.

**Two facts from [chunk 1](01-modules-and-the-cache.md) — that `from x import y`
copies a reference into your namespace, and that a module body never runs a
second time — are the whole explanation for the two most frustrating import
experiences a Python developer has: a patch that silently does nothing, and a
`reload` that picks up half your edits. Neither is a bug. Both are the documented
behaviour of a name-binding language with a module cache, and the correct
responses are structural, not clever.**

## Two names, one object

```python
# utils.py
import datetime

def now():
    return datetime.datetime.now(datetime.UTC)
```

```python
# service.py
from utils import now          # binds service.now to the CURRENT utils.now object

def stamp():
    return now().isoformat()
```

At the moment `service.py` is imported, the import machinery looks up the
attribute `now` on the `utils` module object and stores **that object** under the
name `now` in `service`'s namespace. From then on there are two names —
`utils.now` and `service.now` — pointing at one function object. They are
independent labels; neither knows the other exists.

```python
# test_service.py — DOES NOT WORK
import utils
utils.now = fake_now           # rebinds utils.now
service.stamp()                # still calls the original: service.now was bound
                               # at import time and points at the old function
```

The `unittest.mock` documentation states the principle directly, and it is worth
reading as a statement about names rather than about mocking:

> *"`patch()` works by (temporarily) changing the object that a *name* points to
> with another one. There can be many names pointing to any individual object, so
> for patching to work you must ensure that you patch the name used by the system
> under test."*

> *"The basic principle is that you patch where an object is *looked up*, which is
> not necessarily the same place as where it is defined."*

And it walks through this exact layout:

> *"If we use `patch()` to mock out `a.SomeClass` then it will have no effect on
> our test; module b already has a reference to the *real* `SomeClass` and it
> looks like our patching had no effect."*

> *"The key is to patch out `SomeClass` where it is used (or where it is looked
> up). In this case `some_function` will actually look up `SomeClass` in module b,
> where we have imported it."*

## The two fixes, both shown

**Fix 1 — patch the name the code under test actually reads.**

```python
# pytest
def test_stamp(monkeypatch):
    monkeypatch.setattr("service.now", fake_now)   # service's OWN name
    assert service.stamp() == "1970-01-01T00:00:00+00:00"

# unittest
@patch("service.now")            # NOT "utils.now"
def test_stamp(mock_now): ...
```

**Fix 2 — import the module, not the name, so the lookup happens at call time.**

```python
# service.py
import utils

def stamp():
    return utils.now().isoformat()   # attribute lookup happens NOW, sees a patch
```

With Fix 2, `utils.now` is resolved on every call, so patching `utils.now` works
and so does patching `service.utils.now` (they are the same object). The mock
docs note both forms are common and require different targets:

> *"However, consider the alternative scenario where instead of `from a import
> SomeClass` module b does `import a` and `some_function` uses `a.SomeClass`. Both
> of these import forms are common. In this case the class we want to patch is
> being looked up in the module and so we have to patch `a.SomeClass` instead."*

Fix 2 is the more robust design, and it is the same technique that resolves
circular imports in chunk [6](06-circular-imports.md): **importing a module defers
the name lookup; importing a name freezes it at import time.** The cost is one
extra dict lookup per call, which matters in a hot loop and nowhere else.

There is a third, worse option people reach for — re-executing the `from`
statement inside the function — and it is worth naming so you can reject it:

```python
def stamp():
    from utils import now        # re-runs the from-import on EVERY call
    return now().isoformat()
```

This does make the patch visible, because the cache lookup plus attribute fetch
happens per call. It also hides the dependency from every static tool you own,
and it is strictly slower than Fix 2 for the same effect. Use it only when you
are breaking a cycle and cannot restructure — see chunk 6.

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

> *"When a module is reloaded, its dictionary (containing the module's global
> variables) is retained. Redefinitions of names will override the old
> definitions… If the new version of a module does not define a name that was
> defined by the old version, the old definition remains."*

> *"If a module imports objects from another module using `from` … `import` …,
> calling `reload()` for the other module does not redefine the objects imported
> from it — one way around this is to re-execute the `from` statement, another is
> to use `import` and qualified names (module.name) instead."*

> *"If a module instantiates instances of a class, reloading the module that
> defines the class does not affect the method definitions of the instances —
> they continue to use the old class definition. The same is true for derived
> classes."*

> *"It is generally not very useful to reload built-in or dynamically loaded
> modules. Reloading `sys`, `__main__`, `builtins` and other key modules is not
> recommended. In many cases extension modules are not designed to be initialized
> more than once, and may fail in arbitrary ways when reloaded."*

And a standalone warning in the same entry:

> *"This function is not thread-safe. Calling it from multiple threads can result
> in unexpected behavior."*

Read together: after a reload you have a module whose dict is a *merge* of the
old and new versions, live objects still pointing at the old classes and
functions, every `from x import y` elsewhere still holding the old `y`, and — if
your module defines a class — instances and subclasses stranded on the previous
class object. `isinstance` checks across a reload boundary therefore start
failing for exactly the reason chunk 1 described: two class objects from two
executions of one file.

Reload is a REPL convenience, and even there it lies often enough that restarting
the process is the honest move. In a service, restart. In tests, use a subprocess
or a fixture that constructs fresh objects.

There is one legitimate use of the merge behaviour: a module can *cooperate* with
reload by guarding its own state, which is how a module keeps a cache across
reloads. The docs supply the idiom:

```python
try:
    cache
except NameError:
    cache = {}
```

## Gotchas

**Symptom:** `monkeypatch.setattr("utils.now", fake)` has no effect on `service.stamp()`
**Cause:** `service.py` did `from utils import now`, binding its own name at import time; patching `utils.now` moves a different label
**Fix:** patch the name where it is used — `monkeypatch.setattr("service.now", fake)` — or change `service.py` to `import utils` and call `utils.now()`

**Symptom:** the same patch target works in one test module and not another
**Cause:** the two modules under test use different import forms — one `from utils import now`, the other `import utils` — so the name that must be patched differs per module
**Fix:** pick one convention in the codebase. `import utils` + `utils.now()` makes every patch target predictable, which is usually worth more than the saved keystrokes

**Symptom:** patching a class attribute works on the class but the instance still uses the old method
**Cause:** the instance was created before the patch and — if a reload was involved — is bound to the *previous* class object entirely
**Fix:** create the instance inside the test, after the patch. Never reload a module that has live instances

**Symptom:** `importlib.reload` picked up some edits and not others
**Cause:** reload merges into the existing module dict, leaves removed names in place, does not rebind `from`-imports elsewhere, and does not affect existing instances' classes
**Fix:** restart the process. Reload is a REPL convenience with documented, unfixable limits — and it is documented as not thread-safe

**Symptom:** a name you deleted from a module is still importable after a reload
**Cause:** documented behaviour — *"If the new version of a module does not define a name that was defined by the old version, the old definition remains"*
**Fix:** restart. A "deleted" symbol surviving a reload is the clearest possible signal that reload is not a re-import

**Symptom:** reloading a module that wraps a C extension crashes or behaves strangely
**Cause:** the docs state the `init` function of extension modules is not called a second time and that extension modules are often not designed to be initialized more than once
**Fix:** never reload anything that imports a compiled extension. In practice that rules out most of the scientific and database stack

**Symptom:** the auto-reloading dev server serves stale code after a syntax error is fixed
**Cause:** the reload happened into a module whose body raised partway through, so the module dict holds a half-built namespace merged with the previous run
**Fix:** treat a failed import as fatal and restart the worker. This is why production-grade reloaders fork a fresh process per change instead of calling `importlib.reload`

## Interview questions

**★ Why did my monkeypatch not take effect?**
Because the module under test did `from helpers import now`, which bound *its
own* name to the function object at import time. Patching `helpers.now` rebinds a
different name; the module under test still holds a reference to the original
object. Patch `module_under_test.now`, or write the source as `import helpers`
and `helpers.now()` so the attribute lookup happens at call time and sees the
patch. The `unittest.mock` docs summarise it as "patch where an object is looked
up, which is not necessarily the same place as where it is defined".

**★ What is the difference between `import x` and `from x import y`, beyond syntax?**
`import x` binds a module object; every use is an attribute lookup performed at
call time. `from x import y` performs the same import and then binds `y` in your
namespace to whatever object `x.y` is *at that moment*, permanently. That makes
`from` imports marginally faster to call, immune to later rebinding of `x.y`
(good for stability, bad for patching), and fragile under circular imports —
because it requires `y` to already exist when your module body runs, whereas
`import x` only requires the module object to exist.

**★ When is `importlib.reload` the right tool?**
Almost never outside an interactive session. It re-executes the body into the
existing module object, so the module's dict becomes a merge of old and new,
names deleted in the new version survive, existing instances keep their old
classes, `from x import y` elsewhere still holds the old object, and extension
modules do not get re-initialised at all. It is also documented as not
thread-safe. For a development loop, restart the process or use a watcher that
does. For plugin systems, design for a fresh subprocess or a real plugin API.

**Your team uses `import module` everywhere and mine uses `from module import
name`. Which is better?**
For testability and for surviving circular imports, `import module` wins, because
every reference is resolved at call time and there is exactly one place to patch.
For readability in code that uses one symbol from a module twenty times, and for
the small call-time saving, `from module import name` wins. The style that causes
real damage is mixing them arbitrarily, because then the correct patch target
depends on which file you are testing.

**What does it mean that `reload()` returns a module object, and why can it differ
from the one you passed in?**
The docs note the return value *"can be different if re-importing causes a
different object to be placed in `sys.modules`"* — a module body is allowed to
replace its own entry in the cache, which some lazy-loading and compatibility
shims do. So the safe pattern is `mod = importlib.reload(mod)`, never
`importlib.reload(mod)` on its own followed by continued use of the old name.

---

← Prev: [Modules and the cache](01-modules-and-the-cache.md) · Index: [Imports](README.md) · Next → [Module attributes and specs](01c-module-attributes-and-specs.md)
