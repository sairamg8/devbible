---
title: "Four structural fixes for a circular import, only one of which is a trick"
sidebar_label: "6b · Breaking circular imports"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html),
> [§7.11 The `import` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-import-statement)
> and [`typing.Protocol`](https://docs.python.org/3.14/library/typing.html#typing.Protocol).
> Target: **CPython 3.14**.

**There are four ways to fix a circular import, and only one of them is a trick.
Defer the lookup to call time; move the import inside the function that needs it;
extract the shared piece into a module both sides can depend on; or invert the
dependency so one side stops knowing about the other. The first two rearrange
when things happen; the last two change the shape of the program, which is why
they are the ones that hold. A fifth case — an import that exists only for a type
checker — is not a cycle at all, and [chunk 6c](06c-type-checking-imports.md)
handles it separately.**

## Fix 1 — defer the lookup by importing the module, not the name

The cheapest change, and often the only one needed.

```python
# BEFORE — b.py
from a import compute          # needs a.compute to exist at import time

def run(x):
    return compute(x)
```

```python
# AFTER — b.py
import a                       # only needs sys.modules['a'] to exist

def run(x):
    return a.compute(x)        # attribute lookup happens when run() is called
```

By the time anything calls `run`, both module bodies have finished. This is the
same technique that makes monkeypatching work
([chunk 1b](01b-reload-and-monkeypatching.md)), for the same reason: the name is
resolved late rather than frozen early.

It costs one dict lookup per call and it fails only if you need the name *at
module level* — a decorator, a base class, a default argument, a module-level
constant. Those cases need one of the fixes below.

## Fix 2 — move the import inside the function

```python
# b.py
def run(x):
    from a import compute      # executed on first call, not at import
    return compute(x)
```

Honest accounting, because this one is over-used:

- **It works** even when the name is needed at module level elsewhere, because
  the import simply does not happen during module execution.
- **It is not free.** Every call re-executes the `IMPORT_NAME`/`IMPORT_FROM`
  pair. The module body itself runs only once — `sys.modules` sees to that — but
  the cache lookup and the attribute fetch happen every time. In a hot loop,
  hoist it to a module-level `import a` and use `a.compute`.
- **It hides the dependency.** Nothing in the file's import block says `b`
  depends on `a`; dependency graphs, `ruff`'s import rules and human reviewers all
  miss it.
- **It moves the failure.** An import error now surfaces at first call, possibly
  in production, possibly inside an exception handler, instead of at startup.

Use it deliberately — for a genuinely optional dependency, or as the surgical
patch that unblocks a release — and leave a comment saying which cycle it is
breaking. It is not a design.

## Fix 3 — extract the shared piece into a third module

This is the fix that is almost always correct, because a cycle nearly always
means two modules are sharing something neither of them owns.

```python
# BEFORE
# models.py
from db import Session                 # models needs a session type
class User: ...

# db.py
from models import User                # db needs to serialise a User
class Session: ...
```

The shared concept is "what a user looks like", and it belongs to neither file.

```python
# AFTER
# types.py  →  name it something that is NOT a stdlib module: entities.py
class User: ...

# db.py
from entities import User
class Session: ...

# models.py
from entities import User
from db import Session
```

The dependency graph becomes a tree. Note the naming aside in that snippet — the
instinctive name for this module is `types.py`, which is one of the worst
possible names ([chunk 3](03-shadowing-the-stdlib.md)). `entities.py`,
`domain.py`, `_types.py` or `interfaces.py` all work.

## Fix 4 — invert the dependency

When the shared thing is *behaviour* rather than data, extraction does not help;
the answer is to make the lower-level module stop knowing about the higher-level
one.

```python
# BEFORE — the cycle is behavioural
# plugin.py
from app import Application            # plugin calls back into the app

# app.py
from plugin import Plugin              # app instantiates plugins
```

```python
# AFTER — the app hands itself in; the plugin knows nothing about it
# plugin.py
class Plugin:
    def start(self, app):              # a parameter, not an import
        app.register(self)

# app.py
from plugin import Plugin
class Application:
    def boot(self):
        Plugin().start(self)
```

Same information flow, one direction of dependency. Parameters, callbacks,
registries and `typing.Protocol` are all versions of this move, and it is the
only one of the four that improves the design rather than merely rearranging the
imports.

A registry is the usual concrete form:

```python
# registry.py — depends on nothing
_HANDLERS = {}
def register(name):
    def deco(fn):
        _HANDLERS[name] = fn
        return fn
    return deco
def get(name):
    return _HANDLERS[name]
```

Both the producer and the consumer now depend on `registry`, and neither depends
on the other. (The cost is the one [chunk 1](01-modules-and-the-cache.md) named:
the registry is populated by import side effects, so *something* must import the
producers.)

## Choosing between them

| Situation | Fix |
|---|---|
| Name used only inside functions | 1 — `import a`, call `a.thing()` |
| Name needed at module level, cycle is unavoidable today | 2 — function-local import, with a comment |
| Two modules share a type, a constant or a data shape | 3 — extract to a third module |
| Two modules share *behaviour*; one calls back into the other | 4 — invert: parameter, callback or registry |
| The import exists only for annotations | 5 — `if TYPE_CHECKING`, see [chunk 6c](06c-type-checking-imports.md) |
| Cycle appeared when `__init__.py` gained re-exports | import from the defining submodule, never from the package root |

## Gotchas

**Symptom:** a function-local import fixed the cycle and a profiler now shows import overhead in a hot path
**Cause:** the `IMPORT_NAME`/`IMPORT_FROM` pair runs on every call, even though the module body runs once
**Fix:** hoist to a module-level `import a` and use `a.thing()` at call sites — fix 1 gives the same deferral without the per-call cost

**Symptom:** extracting shared types into `types.py` broke the whole project
**Cause:** `types` is a standard library module, and a file of that name at `sys.path[0]` shadows it for `enum`, `dataclasses` and much of the standard library
**Fix:** name it `entities.py`, `domain.py` or `_types.py`. Check any new top-level module name against `sys.stdlib_module_names`

**Symptom:** the registry is empty at the point of use
**Cause:** registration happens as an import side effect, and nothing has imported the producer modules yet
**Fix:** an explicit discovery step — `pkgutil.iter_modules` plus `importlib.import_module`, or entry points — rather than relying on someone importing the right module first

**Symptom:** the cycle comes back every few months
**Cause:** nothing enforces the layering, so the next feature re-adds the import
**Fix:** enforce it in CI. `ruff`'s banned-api / isort section rules, `import-linter` contracts, or a simple test that imports each module in isolation and asserts what appeared in `sys.modules`

**Symptom:** fix 1 does not apply because the name is needed as a base class, a decorator or a default argument
**Cause:** those are evaluated while the module body runs, so there is nothing to defer to call time
**Fix:** fix 3 or fix 4 — extract the base class into a third module, or invert so the decorator lives on the side that owns the concept

**Symptom:** extraction produced a module that everything imports and nothing owns
**Cause:** the shared piece was extracted mechanically rather than by concept, so `common.py` became a bag of unrelated things
**Fix:** name the extracted module after the concept it holds. If you cannot name it, the two modules probably wanted fix 4 instead

**Symptom:** a function-local import raises on the first request after a deploy, not at startup
**Cause:** the import is deferred to first call, so a missing dependency or a broken module surfaces in a request handler
**Fix:** if the dependency is mandatory, import it at module level and solve the cycle structurally. Deferred imports belong to genuinely optional dependencies

**Symptom:** the cycle disappears in the application and reappears under `multiprocessing` or a frozen build
**Cause:** those launchers import in a different order, and the surviving cycle was only correct in one direction
**Fix:** import each module of the package alone in a fresh interpreter as a test; anything that drags in a second module of the same package is a cycle

## Interview questions

**★ How do you fix a circular import?**
Four options, in the order I would try them. Change `from a import thing` to
`import a` and use `a.thing()` inside functions, so the lookup happens at call
time. Move the import into the function that needs it, accepting the per-call
cost and the hidden dependency. Extract whatever the two modules share into a
third module both can depend on — usually the right answer, because a cycle
usually means a shared concept has no home. Or invert the dependency, passing the
higher-level object in as a parameter or going through a registry, so the
lower-level module stops importing the higher-level one.

**Why is a function-local import not the default answer?**
Because it pays a lookup on every call, hides the dependency from every tool that
reads the import block, and defers the failure from startup to first use — which
in a web service means a request rather than a deploy. It is a legitimate
surgical patch and a legitimate pattern for genuinely optional dependencies. As
a standing answer to "we have a cycle", it converts a visible design problem into
an invisible one.

**When is extraction the wrong fix?**
When what the two modules share is behaviour rather than a data shape. Extracting
a function that still needs to call back into both sides just moves the cycle. In
that case invert the dependency: pass the collaborator in, or define a `Protocol`
in the lower-level module and have the higher-level one satisfy it.

**How would you stop cycles from coming back?**
Make the layering machine-checkable. `import-linter` contracts express "layer A
may not import layer B" directly; `ruff` and `isort` section configuration can
enforce a subset; and a cheap test that imports each module of the package in a
fresh subprocess and asserts which other modules appeared in `sys.modules` will
catch a re-introduced cycle on the pull request that adds it.

**Which of the four fixes would you reach for first, and why not the others?**
Fix 1 — `import a` plus `a.thing()` — because it is a two-line change with no
structural risk and it resolves the majority of cases, where the name is only
ever used inside a function. I would skip straight past it only when the name is
needed while the module body runs: a base class, a decorator, a default argument
or a module-level constant. Those cannot be deferred, so they need extraction or
inversion.

**What is the difference between fix 3 and fix 4?**
Fix 3 moves *data* — a type, a constant, a schema — into a module both sides
import, turning the graph into a tree. Fix 4 moves *behaviour*: the lower-level
module stops importing the higher-level one and receives it as a parameter, a
callback or through a registry. If the shared thing is a noun, extract it; if it
is a verb, invert.

---

← Prev: [Circular imports](06-circular-imports.md) · Index: [Imports](README.md) · Next → [Type-checking-only imports](06c-type-checking-imports.md)
