---
title: "Lazy imports: PEP 810 makes deferral a language feature in 3.15, opt-in, with a soft keyword and four places you may not use it"
sidebar_label: "3 · Lazy imports (PEP 810)"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-28 against
> [PEP 810 – Explicit lazy imports](https://peps.python.org/pep-0810/)
> (status **Final**, targeting **Python 3.15**) and
> [PEP 790](https://peps.python.org/pep-0790/) for the 3.15 schedule.
> Target: **Python 3.15**, whose final release is due **1 October 2026** — so
> everything in this chunk is *forthcoming*, not something to write today.
> Chunk [2](02-what-you-can-actually-do.md) is what works on 3.14.

**Every technique in chunk [2](02-what-you-can-actually-do.md) is a workaround
for a missing language feature: deferring an import means moving the statement
somewhere it reads worse, or driving `importlib` by hand and accepting errors
out of context. PEP 810 makes it syntax. It is Final and targets 3.15, it is
strictly opt-in, and it is worth knowing now because it changes what the right
answer will be — not because you can use it yet.**

## The syntax

A soft keyword in front of an import:

```python
lazy import json
lazy from json import dumps
```

The PEP's own description of what that buys:

> *"Lazy imports defer the loading and execution of a module until the first
> time the imported name is used, in contrast to 'normal' imports, which eagerly
> load and execute a module at the point of the import statement."*

The name is bound immediately; the module is not loaded until something actually
*uses* that name. So the import statement can stay at the top of the file where
PEP 8 wants it, and still cost nothing at startup — which is precisely the trade
that function-level imports could not offer.

`lazy` is a **soft keyword**: existing code using `lazy` as a variable or
function name keeps working.

## Opt-in, and three ways to opt in

The PEP is emphatic that nothing changes by default:

> *"Lazy imports are opt-in. Existing programs continue to run unchanged unless
> a project explicitly enables laziness (via `lazy` syntax, `__lazy_modules__`,
> or an interpreter-wide switch)."*

**1. The keyword**, per import, as above — the normal case.

**2. `__lazy_modules__`**, for code that must also run on older Pythons. Declared
at module scope as a collection of fully qualified module names, it marks those
imports as potentially lazy on 3.15+ while remaining ordinary eager imports on
earlier versions:

```python
__lazy_modules__ = ['expensive_module', 'expensive_module_2']

import expensive_module
from expensive_module_2 import MyClass
```

This is the mechanism for a library that supports several Python versions: the
same source is lazy where it can be and correct where it cannot. The interpreter
tests membership with `__contains__` as each import statement executes.

**3. An interpreter-wide switch**, in three equivalent forms:

```bash
PYTHON_LAZY_IMPORTS=all python -m myapp
python -X lazy_imports=all -m myapp
```

```python
import sys
sys.set_lazy_imports("all")
```

The modes are `"normal"` (the default — only explicit `lazy` is lazy), `"all"`
(every module-level import is potentially lazy), and `"none"` (everything eager,
overriding even explicit `lazy` syntax). Precedence runs runtime function >
command-line option > environment variable.

🔴 **`"none"` is the important one operationally.** It is the escape hatch: if
laziness is implicated in a bug, you can force the entire process back to eager
imports without editing code. Expect it to be the first thing to try when a
lazily-importing application misbehaves — and, like `PYTHON_GIL=1` in topic
[02](../02-the-gil/06b-running-on-the-free-threaded-build.md), expect to find it
set in someone's Dockerfile long after the reason expired.

`"all"` is a blunt instrument. It makes imports lazy that the author never
considered, including ones whose side effects other code depends on — see below.

## Where `lazy` is not allowed

Only module-level imports can be lazy. The keyword is prohibited:

- inside function bodies
- inside class definitions
- inside `try` / `except` blocks
- with wildcard imports — `from module import *`
- with `__future__` imports

Each restriction follows from the semantics. A function-body import is already
deferred, so `lazy` would add nothing. A `try`/`except` around an import exists
precisely to catch the import failing *there* — and a lazy import does not fail
there, so the `except` would silently never fire. A star import cannot know
which names it binds without executing the module. And `__future__` imports must
be processed at compile time by definition.

⚠️ **The `try`/`except` restriction is the one to internalise**, because it is
the shape of the most common optional-dependency idiom:

```python
try:                              # cannot be made lazy — and should not be
    import ujson as json
except ImportError:
    import json
```

This must stay eager. The whole construct is a question asked at import time.

## When the error arrives

The cost of laziness is always error timing, and PEP 810 is explicit about how
it handles that:

> exceptions occurring during lazy import execution are deferred until first
> name access, not raised at the import statement

with a mitigation that `LazyLoader` never offered: **exception chaining that
shows both where the lazy import was defined and where the first access
happened.** That is the difference between a traceback pointing at a random
attribute access and one that names the import you wrote.

One more documented behaviour worth knowing: **a failed reification does not
replace the lazy object — a subsequent use retries the import.** So a transient
failure is not permanently cached as broken, and a genuinely broken import will
raise again at every use rather than once.

## What it does not fix

**Import side effects.** Some modules do work at import that other code depends
on: registering a codec, populating a plugin registry, installing a signal
handler, applying a monkeypatch. If that import becomes lazy and nothing ever
touches the bound name, **the side effect never happens**. The import statement
was never really about the name; the name was a receipt for the side effect.
This is the single largest hazard of the `"all"` mode, and the reason per-import
`lazy` is the sane default.

**Circular imports.** Laziness changes *when* modules execute, which will paper
over some cycles and expose others at a new and less obvious moment. It is not a
fix for a circular import; it is a change to when the cycle bites.

**Anything already imported.** If a module is in `sys.modules`, binding a lazy
name to it costs nothing either way. Laziness helps only for modules that
otherwise would have been loaded and were not needed.

## What to do about it today

Nothing, in code. 3.15 is not released as of this writing — final is due
1 October 2026 — and adopting a feature before its release is not a plan.

What is worth doing now:

- **Keep measuring with `-X importtime`.** The measurement does not change; only
  the remedy does.
- **Prefer restructuring the entry point** over scattering deferred imports. The
  structural fix from chunk [2](02-what-you-can-actually-do.md) — parse
  arguments, then import the chosen subcommand — remains correct after 3.15 and
  is not a workaround for anything.
- **Know which of your imports exist for side effects.** That list is what makes
  a later migration to `lazy` safe, and it is worth knowing regardless.

## Gotchas

**Symptom:** enabled `lazy_imports=all` and a plugin silently stopped registering
**Cause:** the plugin registered itself as an import side effect; nothing ever
used the bound name, so the module never executed
**Fix:** do not use `"all"` on a codebase with side-effecting imports. Mark
individual imports `lazy` instead, and leave the registering ones eager

**Symptom:** `lazy` inside a `try`/`except ImportError` is a syntax error
**Cause:** documented and deliberate — the exception would not be raised at the
import statement, so the handler could never fire
**Fix:** leave optional-dependency probing eager. It is a question that must be
asked at import time

**Symptom:** `lazy` used as a variable name in an old codebase still works
**Cause:** it is a soft keyword, specifically so existing code is unaffected
**Fix:** none needed — this is the designed behaviour

**Symptom:** a traceback appears at an attribute access far from any import
**Cause:** the deferred exception from a lazy import surfacing at first use
**Fix:** read the chained exception — the PEP specifies chaining that shows both
where the lazy import was defined and where it was first accessed

**Symptom:** the same import error keeps recurring on every use rather than once
**Cause:** documented — a failed reification does not replace the lazy object, so
each use retries
**Fix:** expected. Fix the underlying import

**Symptom:** `__lazy_modules__` had no effect
**Cause:** either the interpreter is older than 3.15, where it is deliberately
inert, or the listed name does not match the fully qualified module name the
import statement uses
**Fix:** check the version and the exact dotted name. Being inert on old
versions is the point of the mechanism

## Interview questions

**What are lazy imports and which Python version introduces them?**
PEP 810, Final, targeting 3.15: a soft keyword `lazy` before an import statement
that defers loading and executing the module until the imported name is first
used. It is strictly opt-in — existing programs are unchanged.

**How is `lazy import x` different from importing inside a function?**
The name is bound at module scope and the statement stays at the top of the file
where it is readable, while still costing nothing until first use. A
function-level import achieves the deferral by moving the statement, which reads
worse and re-executes a `sys.modules` lookup on every call.

**Where can you not use `lazy`?**
Only module-level imports can be lazy. It is prohibited in function bodies, in
class definitions, inside `try`/`except`, with `from module import *`, and with
`__future__` imports.

**Why is `lazy` forbidden inside `try`/`except`?**
Because the import no longer fails at the import statement — it fails at first
use. An `except ImportError` there could never fire, so the construct would be
silently broken rather than merely useless. Optional-dependency probing must
stay eager.

**What is the danger of the `"all"` mode?**
Imports that exist for their side effects — registering a plugin or codec,
installing a handler, applying a patch. If nothing uses the bound name, the
module never executes and the side effect never happens. Per-import `lazy` is
deliberate; `"all"` is applied to code whose author never considered it.

**Something is broken and you suspect lazy imports. What is the fastest test?**
Force everything eager without editing code: `PYTHON_LAZY_IMPORTS=none`, or
`-X lazy_imports=none`, or `sys.set_lazy_imports("none")` — `"none"` overrides
even explicit `lazy` syntax. If the problem disappears, laziness is implicated.

**What is `__lazy_modules__` for?**
Supporting multiple Python versions from one source. It is a module-scope
collection of fully qualified module names that are treated as potentially lazy
on 3.15+ and imported eagerly on older versions, so a library does not need the
new syntax to benefit where it is available.

---

← Prev: [What you can actually do today](02-what-you-can-actually-do.md) · Index: [Startup and import cost](README.md) · Next → [Bytecode inspection with `dis`](../12-dis-bytecode/README.md)
